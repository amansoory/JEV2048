import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../server.js';
import {legalMoves,heuristic} from '../public/engine.js';
import {validateAnswer} from '../jev.js';
function answer(board) {const legal=legalMoves(board),direction=heuristic(board);return {model:'test-only',answers:{direction:{type:'choice',choice:direction,confidence:1,probabilities:Object.fromEntries(legal.map(d=>[d,d===direction?1:0]))}},usage:{input_tokens:12,output_tokens:3}};}
async function harness(t,options) {
  const app=createApp(options);await new Promise(r=>app.listen(0,'127.0.0.1',r));
  t.after(()=>new Promise(r=>{app.close(r);app.closeAllConnections();}));
  const base=`http://127.0.0.1:${app.address().port}`;
  return async(path,data,extra={})=>{const res=await fetch(base+path,{method:data?'POST':'GET',headers:{'Content-Type':'application/json',...extra},body:data?JSON.stringify(data):undefined});return {status:res.status,data:await res.json()};};
}
test('Jev continues beyond the former default cap with legal moves and visible counts',async t=>{
  let calls=0;
  const req=await harness(t,{getKey:()=> 'fake-test-key',decide:async b=>{calls++;return answer(b);}});
  let {data:g}=await req('/api/games',{seed:'s',mode:'jev'});
  assert.equal('cap' in g,false);
  for(let i=1;i<=60;i++) {
    const {status,data:n}=await req('/api/step',{id:g.id});
    assert.equal(status,200);assert.equal(n.moves,i);assert.equal(n.calls,i);
    assert.ok(legalMoves(g.board).includes(n.last.direction));assert.equal(n.last.source,'Jev API');g=n;
  }
  assert.equal(calls,60);assert.equal(g.inputTokens,720);
});
test('provider failure leaves board unchanged, records attempt, then Retry recovers',async t=>{
  let fail=true;
  const req=await harness(t,{getKey:()=> 'fake-test-key',decide:async b=>{if(fail){fail=false;throw Error('sensitive-provider-text');}return answer(b);}});
  const {data:g}=await req('/api/games',{seed:'s',mode:'jev'});
  const {data:n}=await req('/api/step',{id:g.id});
  assert.deepEqual(n.board,g.board);assert.equal(n.moves,0);assert.equal(n.calls,1);assert.equal(n.unknownUsage,1);
  assert.ok(!JSON.stringify(n).includes('sensitive-provider-text'));assert.match(n.error,/No fallback/);
  const {data:retry}=await req('/api/step',{id:g.id});assert.equal(retry.moves,1);assert.equal(retry.calls,2);assert.equal(retry.error,null);
});
test('illegal provider answer rejected before applying move, usage still counted',async t=>{
  const req=await harness(t,{getKey:()=> 'fake-test-key',decide:async b=>{const a=answer(b);a.answers.direction.choice='diagonal';return a;}});
  const {data:g}=await req('/api/games',{seed:'s',mode:'jev'});const {data:n}=await req('/api/step',{id:g.id});
  assert.deepEqual(n.board,g.board);assert.equal(n.inputTokens,12);assert.match(n.error,/Invalid Jev answer/);
});
test('missing credential, heuristic mode, and private file protection',async t=>{
  const req=await harness(t,{getKey:()=>null});
  const {data:g}=await req('/api/games',{seed:'s',mode:'jev'});assert.equal((await req('/api/step',{id:g.id})).status,503);
  const {data:h}=await req('/api/games',{seed:'s',mode:'heuristic'});const {data:n}=await req('/api/step',{id:h.id});
  assert.equal(n.moves,1);assert.equal(n.calls,0);assert.equal(n.last.probabilities,null);assert.equal(n.last.source,'Deterministic heuristic');
  assert.equal((await req('/.env.local')).status,404);assert.equal((await req('/api/games',{seed:'s',mode:'jev'},{Origin:'https://example.com'})).status,403);
});
test('restart invalidates in-flight decision and blocks overlapping calls across games',async t=>{
  let release,started,calls=0;
  const gate=new Promise(r=>release=r),entered=new Promise(r=>started=r);
  const req=await harness(t,{getKey:()=> 'fake-test-key',decide:async b=>{calls++;started();await gate;return answer(b);}});
  const {data:g}=await req('/api/games',{seed:'s',mode:'jev'});
  const first=req('/api/step',{id:g.id});await entered;
  assert.equal((await req('/api/step',{id:g.id})).status,409);
  const {data:fresh}=await req('/api/games',{seed:'s',mode:'jev',previousId:g.id});
  assert.deepEqual(fresh.board,g.board);assert.equal(fresh.moves,0);assert.equal(fresh.calls,0);
  assert.equal((await req('/api/step',{id:fresh.id})).status,409);
  release();const discarded=await first;assert.equal(discarded.status,409);assert.match(discarded.data.error,/discarded/);
  assert.equal((await req('/api/step',{id:g.id})).status,404);
  const {data:n}=await req('/api/step',{id:fresh.id});assert.equal(n.moves,1);assert.equal(n.calls,1);assert.equal(calls,2);
});
test('malformed probabilities and confidence rejected',()=>{
  const b=Array(16).fill(0);b[0]=2;const legal=legalMoves(b);
  for(const mutate of [a=>a.probabilities.down=-1,a=>a.probabilities.extra=0,a=>a.confidence=NaN,a=>a.probabilities.down=0.5]){
    const result=answer(b);mutate(result.answers.direction);assert.throws(()=>validateAnswer(result,legal));
  }
});

