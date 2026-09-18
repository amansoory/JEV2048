"""Fixed author checkpoint only. Verify both hashes before atomically installing it."""
import hashlib,json,lzma,pathlib,urllib.request

def digest(p):
 h=hashlib.sha256()
 with p.open('rb') as f:
  for chunk in iter(lambda:f.read(1024*1024),b''):h.update(chunk)
 return h.hexdigest()

def setup(root):
 meta=json.loads((root/'provenance.json').read_text())
 target=root/'model';target.mkdir(exist_ok=True)
 weight=target/'4x6patt.w'
 if weight.exists():
  if weight.stat().st_size!=meta['decompressed_bytes'] or digest(weight)!=meta['decompressed_sha256']:raise ValueError('Existing checkpoint checksum mismatch')
  return
 packed=target/'4x6patt.w.xz.partial';pending=target/'4x6patt.w.partial'
 try:
  with urllib.request.urlopen(meta['url'],timeout=90) as src,packed.open('wb') as dest:
   total=0
   for chunk in iter(lambda:src.read(1024*1024),b''):
    total+=len(chunk)
    if total>meta['compressed_bytes']:raise ValueError('Compressed checkpoint too large')
    dest.write(chunk)
  if packed.stat().st_size!=meta['compressed_bytes'] or digest(packed)!=meta['compressed_sha256']:raise ValueError('Compressed checkpoint checksum mismatch')
  with lzma.open(packed,'rb') as src,pending.open('wb') as dest:
   total=0
   for chunk in iter(lambda:src.read(1024*1024),b''):
    total+=len(chunk)
    if total>meta['decompressed_bytes']:raise ValueError('Decompressed checkpoint too large')
    dest.write(chunk)
  if pending.stat().st_size!=meta['decompressed_bytes'] or digest(pending)!=meta['decompressed_sha256']:raise ValueError('Decompressed checkpoint checksum mismatch')
  pending.replace(weight)
 finally:
  packed.unlink(missing_ok=True);pending.unlink(missing_ok=True)

if __name__=='__main__':
 setup(pathlib.Path(__file__).parent)
 print('Checkpoint verified and ready.')
