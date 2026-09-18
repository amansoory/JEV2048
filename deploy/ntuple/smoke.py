"""Three fixed-board checks. No games, Jev calls, or credential output."""
import json,os,pathlib,urllib.request,urllib.error
root=pathlib.Path(__file__).parent
base=os.environ.get('NTUPLE_TEST_URL','http://127.0.0.1:7860').rstrip('/')
secret=os.environ.get('NTUPLE_SERVICE_SECRET')
if not secret:raise SystemExit('Supply NTUPLE_SERVICE_SECRET through the environment')
def request(path,body=None,auth=True):
 headers={'Content-Type':'application/json'}
 if auth:headers['Authorization']='Bearer '+secret
 r=urllib.request.Request(base+path,data=None if body is None else json.dumps(body).encode(),headers=headers)
 try:
  with urllib.request.urlopen(r,timeout=12) as response:return response.status,json.load(response)
 except urllib.error.HTTPError as e:return e.code,json.load(e)
assert request('/health')[0]==200
assert request('/ready')[1]['status']=='ready'
fixtures=json.loads((root/'fixed-board-fixtures.json').read_text())['fixtures']
for f in fixtures:
 status,r=request('/v1/evaluate',{'board':f['board']})
 assert status==200 and r['direction']==f['direction'] and r['options']==f['options'] and r['checkpoint']==f['checkpoint']
assert request('/v1/evaluate',{'board':fixtures[0]['board']},False)[0]==401
for body in [{'board':[True]*16},{'board':[2]*15},{'board':fixtures[0]['board'],'command':'x'},{'board':[32768,32768]+[0]*14}]:
 assert request('/v1/evaluate',body)[0]==400
print('PASS: health, ready, authentication, validation, rank overflow and exact values/actions on three frozen boards. No games.')
