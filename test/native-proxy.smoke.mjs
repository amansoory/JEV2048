import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const {fixtures}=JSON.parse(await readFile(new URL('../deploy/ntuple/fixed-board-fixtures.json',import.meta.url),'utf8'));
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:2050';
if(!['127.0.0.1','localhost'].includes(new URL(base).hostname))throw Error('This smoke test is local-only; public inference requires a verified browser session.');
for(const [sequence,f] of fixtures.entries()){const r=await fetch(base+'/api/ntuple',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({board:f.board,match:'release-proxy-smoke',generation:42,sequence}),signal:AbortSignal.timeout(20000)});assert.equal(r.status,200);const data=await r.json();assert.equal(data.direction,f.direction);assert.equal(data.generation,42);assert.equal(data.sequence,sequence);assert.equal(data.evidence.checkpoint,f.checkpoint);assert.deepEqual(data.evidence.state.options,f.options.map(o=>({direction:o.direction,board:o.afterstate,reward:o.gain,n_tuple_action_value:o.value})));}
console.log('PASS: production Next.js proxy and Linux service match 3 native fixtures; generation and sequence preserved. No games or Jev calls.');
