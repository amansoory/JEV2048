"""Authenticated, bounded HTTP wrapper around the unmodified native selector."""
import hashlib,hmac,json,math,os,pathlib,queue,subprocess,threading,time
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
ROOT=pathlib.Path(__file__).parent
META=json.loads((ROOT/'provenance.json').read_text(encoding='utf-8-sig'))
CHECKPOINT=META['decompressed_sha256']
MODEL='TDL2048+ pretrained 4x6'
def slide(board,direction):
 result=board[:];gain=0
 for line in range(4):
  ids=[line*4+i if direction=='left' else line*4+3-i if direction=='right' else i*4+line if direction=='up' else (3-i)*4+line for i in range(4)]
  values=[board[i] for i in ids if board[i]];merged=[];i=0
  while i<len(values):
   if i+1<len(values) and values[i]==values[i+1]:merged.append(values[i]*2);gain+=values[i]*2;i+=2
   else:merged.append(values[i]);i+=1
  for i,j in enumerate(ids):result[j]=merged[i] if i<len(merged) else 0
 return result,gain
DIRECTIONS=('up','right','down','left')
def validate(body):
 if type(body)!=dict or set(body)!={'board'}:raise ValueError('Expected only board')
 board=body['board']
 if type(board)!=list or len(board)!=16 or any(type(v)!=int or v<0 or v==1 or v>32768 or (v and v&(v-1)) for v in board):raise ValueError('Invalid tiles')
 if sum(v!=0 for v in board)<2:raise ValueError('Unreachable board')
 options={d:slide(board,d) for d in DIRECTIONS};options={d:r for d,r in options.items() if r[0]!=board}
 if not options:raise ValueError('Board has no legal move')
 if any(max(b)>32768 for b,g in options.values()):raise ValueError('Move exceeds native rank encoding')
 return board,options
class Worker:
 def __init__(self):
  self.process=None;self.state='loading';self.lock=threading.Lock();self.messages=queue.Queue(maxsize=4);self.starts=0
 def start(self):
  try:
   weights=pathlib.Path(os.environ.get('NTUPLE_WEIGHTS',str(ROOT/'model/4x6patt.w')))
   h=hashlib.sha256()
   with weights.open('rb') as f:
    for chunk in iter(lambda:f.read(1024*1024),b''):h.update(chunk)
   if weights.stat().st_size!=META['decompressed_bytes'] or h.hexdigest()!=CHECKPOINT:raise ValueError('Checkpoint mismatch')
   executable=os.environ.get('NTUPLE_EXECUTABLE',str(ROOT/'native/ntuple-bridge'))
   self.process=subprocess.Popen([executable,str(weights.resolve())],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,text=True,bufsize=1,env={k:v for k,v in os.environ.items() if k in ('PATH','SystemRoot','TEMP','TMP','LANG')})
   self.starts+=1
   def read():
    try:
     for line in self.process.stdout:
      if len(line)>16384:raise ValueError()
      self.messages.put(json.loads(line),timeout=1)
    except Exception:pass
    if self.state!='loading':self.state='unavailable'
   threading.Thread(target=read,daemon=True).start()
   if self.messages.get(timeout=45)!={'ready':True}:raise ValueError()
   self.state='ready'
  except Exception:
   self.state='unavailable'
   if self.process:self.process.kill()
 def evaluate(self,board,options):
  if not self.lock.acquire(timeout=1):raise TimeoutError('busy')
  try:
   if self.state!='ready' or self.process.poll() is not None:raise RuntimeError('unavailable')
   self.process.stdin.write(' '.join(str(int(math.log2(v))) if v else '0' for v in board)+'\n');self.process.stdin.flush()
   try:r=self.messages.get(timeout=3)
   except queue.Empty:
    self.state='unavailable';self.process.kill();raise RuntimeError('unavailable')
   if r.get('direction') not in options or type(r.get('options'))!=list or len(r['options'])!=len(options) or len({o['direction'] for o in r['options']})!=len(options):raise ValueError()
   if not math.isfinite(r['compute_ms']) or r['compute_ms']<0:raise ValueError()
   for o in r['options']:
    if o['direction'] not in options or not math.isfinite(o['value']) or (o['afterstate'],o['gain'])!=options[o['direction']]:raise ValueError()
   return {**r,'model':MODEL,'checkpoint':CHECKPOINT,'source_commit':META['commit']}
  finally:self.lock.release()
WORKER=Worker();ACTIVE=threading.BoundedSemaphore(4)
class Handler(BaseHTTPRequestHandler):
 protocol_version='HTTP/1.0'
 def setup(self):super().setup();self.connection.settimeout(5)
 def log_message(self,*args):pass
 def reply(self,status,data):
  body=json.dumps(data,allow_nan=False).encode();self.send_response(status);self.send_header('Content-Type','application/json');self.send_header('Cache-Control','no-store');self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)
 def do_GET(self):
  if self.path=='/health':return self.reply(200,{'status':'alive'})
  if self.path=='/ready':return self.reply(200 if WORKER.state=='ready' else 503,{'status':WORKER.state,'model':MODEL,'checkpoint':CHECKPOINT})
  self.reply(404,{'code':'not_found'})
 def do_POST(self):
  if self.path!='/v1/evaluate':return self.reply(404,{'code':'not_found'})
  supplied=self.headers.get('Authorization','');expected='Bearer '+os.environ.get('NTUPLE_SERVICE_SECRET','')
  if not os.environ.get('NTUPLE_SERVICE_SECRET') or not hmac.compare_digest(supplied,expected):return self.reply(401,{'code':'unauthorized'})
  if self.headers.get('Transfer-Encoding') or self.headers.get('Content-Type','').split(';')[0]!='application/json':return self.reply(400,{'code':'invalid_board'})
  try:length=int(self.headers.get('Content-Length','0'))
  except ValueError:return self.reply(400,{'code':'invalid_board'})
  if length<1 or length>1024:return self.reply(413,{'code':'invalid_board'})
  if not ACTIVE.acquire(blocking=False):return self.reply(429,{'code':'rate_limited'})
  try:
   try:
    raw=self.rfile.read(length)
    if len(raw)!=length:raise ValueError()
    def unique(pairs):
     result={}
     for k,v in pairs:
      if k in result:raise ValueError('Duplicate field')
      result[k]=v
     return result
    board,options=validate(json.loads(raw,object_pairs_hook=unique))
   except Exception:return self.reply(400,{'code':'invalid_board'})
   if WORKER.state!='ready':return self.reply(503,{'code':WORKER.state})
   try:return self.reply(200,WORKER.evaluate(board,options))
   except TimeoutError:return self.reply(429,{'code':'rate_limited'})
   except RuntimeError:return self.reply(503,{'code':'unavailable'})
   except Exception:return self.reply(500,{'code':'internal_error'})
  finally:ACTIVE.release()
class Server(ThreadingHTTPServer):
 daemon_threads=True;request_queue_size=8
 slots=threading.BoundedSemaphore(12)
 def process_request(self,request,address):
  if not self.slots.acquire(blocking=False):self.shutdown_request(request);return
  try:super().process_request(request,address)
  except Exception:self.slots.release();raise
 def process_request_thread(self,request,address):
  try:super().process_request_thread(request,address)
  finally:self.slots.release()
if __name__=='__main__':
 if len(os.environ.get('NTUPLE_SERVICE_SECRET',''))<24:raise SystemExit('Configure NTUPLE_SERVICE_SECRET before startup')
 threading.Thread(target=WORKER.start,daemon=True).start()
 try:Server(('0.0.0.0',int(os.environ.get('PORT','7860'))),Handler).serve_forever()
 finally:
  if WORKER.process:WORKER.process.kill()
