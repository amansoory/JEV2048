import hashlib,json,lzma,pathlib,urllib.request
root=pathlib.Path(__file__).parent
meta=json.loads((root/'provenance.json').read_text())
target=root/'model';target.mkdir(exist_ok=True)
packed=target/'4x6patt.w.xz';weight=target/'4x6patt.w'
def digest(p):
 h=hashlib.sha256()
 with p.open('rb') as f:
  for chunk in iter(lambda:f.read(1024*1024),b''):h.update(chunk)
 return h.hexdigest()
if not packed.exists():
 with urllib.request.urlopen(meta['url'],timeout=90) as src,packed.open('wb') as dest:
  for chunk in iter(lambda:src.read(1024*1024),b''):dest.write(chunk)
if packed.stat().st_size!=meta['compressed_bytes'] or digest(packed)!=meta['compressed_sha256']:raise SystemExit('Compressed checkpoint checksum mismatch')
with lzma.open(packed,'rb') as src,weight.open('wb') as dest:
 for chunk in iter(lambda:src.read(1024*1024),b''):dest.write(chunk)
if weight.stat().st_size!=meta['decompressed_bytes'] or digest(weight)!=meta['decompressed_sha256']:raise SystemExit('Decompressed checkpoint checksum mismatch')
packed.unlink()
print('Checkpoint verified and decompressed.')
