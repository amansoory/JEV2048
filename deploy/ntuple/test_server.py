import unittest
from server import validate,slide
class Validation(unittest.TestCase):
 def test_shape_and_extra_fields(self):
  for b in [{'board':[0]*16},{'board':[2]*15},{'board':[True]*16},{'board':[3]*16},{'board':[65536]*16},{'board':[2]*16,'command':'x'},{'board':[2]*16,'filename':'x'}]:
   with self.assertRaises(ValueError):validate(b)
 def test_merge_overflow_is_rejected(self):
  with self.assertRaises(ValueError):validate({'board':[32768,32768]+[0]*14})
 def test_legal_actions_and_order(self):
  b=[2,2,2,2]+[0]*12;_,options=validate({'board':b})
  self.assertEqual(options['left'],([4,4]+[0]*14,8));self.assertEqual(b,[2,2,2,2]+[0]*12)


import io,json,lzma,pathlib,tempfile,hashlib,urllib.request
from unittest.mock import patch
from model_setup import setup
class Checkpoint(unittest.TestCase):
 def fixture(self,root):
  raw=b'known fixture weights';packed=lzma.compress(raw)
  meta={'url':'https://example.invalid/model.xz','compressed_bytes':len(packed),'compressed_sha256':hashlib.sha256(packed).hexdigest(),'decompressed_bytes':len(raw),'decompressed_sha256':hashlib.sha256(raw).hexdigest()}
  (root/'provenance.json').write_text(json.dumps(meta));return raw,packed
 def test_verified_atomic_install_and_reuse(self):
  with tempfile.TemporaryDirectory() as d:
   root=pathlib.Path(d);raw,packed=self.fixture(root)
   with patch.object(urllib.request,'urlopen',return_value=io.BytesIO(packed)) as download:setup(root);self.assertEqual(download.call_count,1)
   self.assertEqual((root/'model/4x6patt.w').read_bytes(),raw)
   with patch.object(urllib.request,'urlopen',side_effect=AssertionError('No second download')):setup(root)
   self.assertFalse(list((root/'model').glob('*.partial')))
 def test_hash_failure_never_installs_weights(self):
  with tempfile.TemporaryDirectory() as d:
   root=pathlib.Path(d);raw,packed=self.fixture(root)
   with patch.object(urllib.request,'urlopen',return_value=io.BytesIO(b'x'*len(packed))):
    with self.assertRaisesRegex(ValueError,'checksum'):setup(root)
   self.assertFalse((root/'model/4x6patt.w').exists());self.assertFalse(list((root/'model').glob('*.partial')))
 def test_existing_corruption_fails_closed(self):
  with tempfile.TemporaryDirectory() as d:
   root=pathlib.Path(d);self.fixture(root);(root/'model').mkdir();(root/'model/4x6patt.w').write_bytes(b'corrupted')
   with patch.object(urllib.request,'urlopen',side_effect=AssertionError('No download')):
    with self.assertRaisesRegex(ValueError,'Existing checkpoint checksum'):setup(root)


import threading,types,os,urllib.error,queue
from unittest.mock import Mock
import server
class HTTP(unittest.TestCase):
 def test_endpoints_auth_validation_loading_and_capacity(self):
  fake=types.SimpleNamespace(state='ready',evaluate=lambda b,o:{'direction':next(iter(o)),'options':[]})
  with patch.object(server,'WORKER',fake),patch.dict(os.environ,{'NTUPLE_SERVICE_SECRET':'offline-test-placeholder-only'}):
   http=server.Server(('127.0.0.1',0),server.Handler);thread=threading.Thread(target=http.serve_forever,daemon=True);thread.start()
   def request(path,raw=None,auth=True):
    headers={'Content-Type':'application/json'}
    if auth:headers['Authorization']='Bearer offline-test-placeholder-only'
    r=urllib.request.Request('http://127.0.0.1:'+str(http.server_port)+path,data=raw,headers=headers)
    try:
     with urllib.request.urlopen(r,timeout=2) as response:return response.status,json.load(response)
    except urllib.error.HTTPError as e:return e.code,json.load(e)
   try:
    self.assertEqual(request('/health')[0],200);self.assertEqual(request('/ready')[0],200)
    valid=json.dumps({'board':[2,2]+[0]*14}).encode()
    self.assertEqual(request('/v1/evaluate',valid,False)[0],401)
    self.assertEqual(request('/v1/evaluate',valid)[0],200)
    self.assertEqual(request('/v1/evaluate',b'{"board":[],"board":[]}')[0],400)
    self.assertEqual(request('/v1/evaluate',b'x'*1025)[0],413)
    fake.state='loading';self.assertEqual(request('/ready')[0],503);self.assertEqual(request('/v1/evaluate',valid)[0],503);fake.state='ready'
    for _ in range(4):server.ACTIVE.acquire()
    try:self.assertEqual(request('/v1/evaluate',valid)[0],429)
    finally:
     for _ in range(4):server.ACTIVE.release()
   finally:http.shutdown();http.server_close();thread.join(timeout=2)
 def test_native_timeout_marks_worker_unavailable_and_kills_it(self):
  worker=server.Worker();worker.state='ready';worker.process=Mock();worker.process.poll.return_value=None;worker.messages=Mock();worker.messages.get.side_effect=queue.Empty
  board,options=server.validate({'board':[2,2]+[0]*14})
  with self.assertRaises(RuntimeError):worker.evaluate(board,options)
  self.assertEqual(worker.state,'unavailable');worker.process.kill.assert_called_once()
if __name__=='__main__':unittest.main()
