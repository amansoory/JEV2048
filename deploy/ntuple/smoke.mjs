import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const {fixtures}=JSON.parse(await readFile(new URL('./fixed-board-fixtures.json',import.meta.url),'utf8'));
const url=process.env.NTUPLE_TEST_URL||'http://127.0.0.1:7860',secret=process.env.NTUPLE_SERVICE_SECRET;
if(!secret)throw Error('Set NTUPLE_SERVICE_SECRET in the environment.');
const call=(path,init={})=>fetch(url+path,{...init,signal:AbortSignal.timeout(15000)});
assert.equal((await call('/health')).status,200);
const ready=await call('/ready');assert.equal(ready.status,200);assert.equal((await ready.json()).status,'ready');
const headers={'Content-Type':'application/json',Authorization:'Bearer '+secret};
for(const fixture of fixtures){const r=await call('/v1/evaluate',{method:'POST',headers,body:JSON.stringify({board:fixture.board})});assert.equal(r.status,200);const result=await r.json();assert.equal(result.direction,fixture.direction);assert.deepEqual(result.options,fixture.options);assert.equal(result.checkpoint,fixture.checkpoint);assert.ok(result.compute_ms>=0);}
assert.equal((await call('/v1/evaluate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({board:fixtures[0].board})})).status,401);
for(const body of [{board:[true,...Array(15).fill(2)]},{board:[2]},{board:fixtures[0].board,command:'no'},{board:[32768,32768,...Array(14).fill(0)]}])assert.equal((await call('/v1/evaluate',{method:'POST',headers,body:JSON.stringify(body)})).status,400);
console.log('PASS: health, readiness, 3 exact native fixtures, authentication, board validation and overflow rejection. No games.');
