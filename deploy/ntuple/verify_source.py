import json,hashlib,pathlib
root=pathlib.Path(__file__).parent
expected=json.loads((root/'source-manifest.json').read_text())
for name,value in expected.items():
 if hashlib.sha256((root/name).read_bytes()).hexdigest()!=value:raise SystemExit('Frozen source checksum mismatch: '+name)
print('Frozen upstream source and bridge verified.')
