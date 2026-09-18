import json,time,urllib.request
end=time.monotonic()+55
while time.monotonic()<end:
 try:
  with urllib.request.urlopen('http://127.0.0.1:7860/ready',timeout=2) as r:
   if json.load(r).get('status')=='ready':raise SystemExit(0)
 except (OSError,ValueError):pass
 time.sleep(1)
raise SystemExit('Native readiness timed out; service startup refused')
