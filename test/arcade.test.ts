import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newGame,slide,legalMoves,heuristic,gameOver} from '../public/engine.js';
import {applyMove,player,updatePlayer,sampleDecision,finished} from '../lib/replay';
import {NextRequest} from 'next/server';
import {POST} from '../app/api/decision/route';
import {acquire,configured,sameOrigin} from '../lib/protection';
import {outcomeFeatures} from '../jev.js';

test('animation trajectories track actual merges, including moved unmerged tiles',()=>{
  const b=[0,2,2,4,...Array(12).fill(0)],r=slide(b,'left');
  assert.deepEqual(r.merges,[4]);
  assert.deepEqual(r.transitions.slice(0,3),[{from:1,to:0,value:2,merged:true},{from:2,to:0,value:2,merged:true},{from:3,to:1,value:4,merged:false}]);
  assert.deepEqual(r.board.slice(0,4),[4,4,0,0]);
  assert.deepEqual(outcomeFeatures(b,'left').tiles_merged,[4]);
});
test('real replay records match the rules and identify exactly the spawned tile',()=>{
  const g=newGame('replay'),before=g.board.slice(),d=legalMoves(before)[0],p=player(g);
  const record=applyMove(g,d,{probabilities:{[d]:1},ms:123})!;
  assert.deepEqual(record.before,before);assert.deepEqual(record.preSpawn,slide(before,d).board);
  const diff=record.after.flatMap((v,i)=>v!==record.preSpawn[i]?[i]:[]);
  assert.deepEqual(diff,[record.spawn.index]);assert.equal(record.preSpawn[record.spawn.index],0);
  assert.equal(record.after[record.spawn.index],record.spawn.value);
  assert.equal(record.scoreGain,slide(before,d).score);
  const updated=updatePlayer(p,g,record);assert.deepEqual(updated.points,[{move:0,score:0},{move:1,score:g.score}]);
});
test('sample is marked and has no invented model probabilities or latency',()=>{
  assert.equal(sampleDecision.sample,true);assert.equal(sampleDecision.probabilities,null);assert.equal(sampleDecision.ms,null);
  assert.deepEqual(sampleDecision.preSpawn,slide(sampleDecision.before,sampleDecision.direction).board);
});
test('match finishes only when both boards are over',()=>{
  const full=[2,4,2,4,4,2,4,2,2,4,2,4,4,2,4,2];
  const a=player(newGame('a')),b=player(newGame('b'));a.board=full;
  assert.equal(finished(a,b),false);b.board=full;assert.equal(finished(a,b),true);
});
test('local decision lock refuses overlapping calls and releases',async()=>{
  const req=new NextRequest('http://127.0.0.1:2048/api/decision',{headers:{host:'127.0.0.1:2048'}});
  const a=await acquire(req,'same-board');const b=await acquire(req,'same-board');
  assert.equal(b.status,409);await a.release();const c=await acquire(req,'same-board');assert.equal(c.error,undefined);await c.release();
});
test('public requests fail closed without shared protection, including no provider call',async()=>{
  const names=['UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN','TURNSTILE_SECRET_KEY','SESSION_SECRET','TYPESAFE_API_KEY'];
  const saved=names.map(n=>process.env[n]);
  try{
    for(const n of names)delete process.env[n];
    process.env.TYPESAFE_API_KEY='fake-test-key';
    assert.equal(configured(),false);
    const req=new NextRequest('https://arcade.example/api/decision',{method:'POST',headers:{host:'arcade.example',origin:'https://arcade.example','Content-Type':'application/json'},body:JSON.stringify({board:newGame('a').board,score:0,moves:0,match:'sample'})});
    const res=await POST(req);assert.equal(res.status,503);assert.match((await res.json()).error,/Shared protection/);
  }finally{names.forEach((n,i)=>saved[i]===undefined?delete process.env[n]:process.env[n]=saved[i]);}
});
test('Next route rejects invalid boards and cross-origin requests',async()=>{
  assert.equal(sameOrigin(new Request('http://localhost:2048/api/decision',{headers:{host:'127.0.0.1:2048',origin:'http://127.0.0.1:2048'}})),true);
  const body={board:Array(16).fill(3),score:0,moves:0,match:'test'};
  const res=await POST(new NextRequest('http://localhost:2048/api/decision',{method:'POST',headers:{host:'localhost:2048'},body:JSON.stringify(body)}));assert.equal(res.status,400);
  const cross=await POST(new NextRequest('http://localhost:2048/api/decision',{method:'POST',headers:{host:'localhost:2048',origin:'https://evil.example'},body:JSON.stringify(body)}));assert.equal(cross.status,403);
});
