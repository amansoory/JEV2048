import test from 'node:test';import assert from 'node:assert/strict';
import {buildBlind as reference} from './fixtures/blind-before-optimization';
import {buildBlind,validateBlind,BLIND_IDS,blindClient} from '../lib/blind-policies';
import {prepareEvidence,closeEvidenceWorkers} from '../lib/evidence-pool';
import {legalMoves,slide,newGame} from '../public/engine';
import {DecisionSlots} from '../lib/decision-slots';
import {MatchController} from '../lib/match-controller';
import {TypeSafeClient} from '@typesafe-ai/sdk';import {NextRequest} from 'next/server';import {POST} from '../app/api/decision/route';
const fixtures=[newGame('first-light').board,[2,4,8,16,32,64,128,256,512,1024,2,4,8,16,32,32],[128,64,32,16,8,4,2,0,4,2,0,0,2,0,0,0]];
test.after(()=>closeEvidenceWorkers());
test('worker evidence and sanitized requests exactly match frozen path for every version and shuffle',async()=>{
 for(const board of fixtures){const legal=legalMoves(board),learned={direction:legal[0],options:legal.map((direction,i)=>({direction,value:10000+i*100,gain:slide(board,direction).score}))};
  for(const policy of BLIND_IDS){const prepared=await prepareEvidence(board,policy);for(const draw of [(n:number)=>n-1,()=>0]){
   const before=reference(board,policy,learned,draw),after=buildBlind(board,policy,learned,draw,prepared);assert.deepEqual(after.request,before.request);assert.deepEqual(after.mapping,before.mapping);
   for(const id of Object.keys(before.mapping)){const result={answers:{candidate:{type:'choice',choice:id,probabilities:Object.fromEntries(Object.keys(before.mapping).map(k=>[k,k===id?1:0]))}}};assert.deepEqual(validateBlind(result,after.mapping,board),validateBlind(result,before.mapping,board));}
  }}
 }
});
test('expensive evidence leaves the main event loop responsive',async()=>{let ticks=0;const timer=setInterval(()=>ticks++,2);try{await prepareEvidence(fixtures[0],'blind-feature');assert.ok(ticks>5);}finally{clearInterval(timer);}});
test('learned conditions calculate only the immediate fields they send',async()=>{const p=await prepareEvidence(fixtures[0],'blind-dual');for(const f of Object.values(p.features)){assert.ok(!('bounded_future' in f));assert.ok(!('next_spawn' in f));}assert.ok(p.tails.length>0);});
test('SDK client is reused with the same credential',()=>{assert.equal(blindClient('fake-test-only'),blindClient('fake-test-only'));});
test('three request slots allow concurrency, queue fairly, and support cancellation',async()=>{const slots=new DecisionSlots(3),signal=new AbortController().signal;const releases=await Promise.all([slots.acquire(signal),slots.acquire(signal),slots.acquire(signal)]);let admitted=false;const fourth=slots.acquire(signal).then(r=>{admitted=true;return r});await new Promise(r=>setTimeout(r,5));assert.equal(admitted,false);releases[0]();(await fourth)();releases[1]();releases[2]();const one=new DecisionSlots(1),release=await one.acquire(signal),abort=new AbortController(),waiting=one.acquire(abort.signal);abort.abort();await assert.rejects(waiting);release();});
test('plain and feature Jev skip native; dual batches every candidate in one native request',async()=>{
 const global=globalThis as any,previous=global.__jevNtupleBridge,saved=process.env.TYPESAFE_API_KEY,remote=process.env.NTUPLE_SERVICE_URL,original=TypeSafeClient.prototype.systemOne;let nativeCalls=0,apiCalls=0;
 global.__jevNtupleBridge={decide:async(board:number[])=>{nativeCalls++;return {direction:legalMoves(board)[0],ms:1,computeMs:.003,evidence:{state:{options:legalMoves(board).map((direction,i)=>({direction,reward:slide(board,direction).score,n_tuple_action_value:10000+i}))}}}}};delete process.env.NTUPLE_SERVICE_URL;process.env.TYPESAFE_API_KEY='fake-test-only';
 TypeSafeClient.prototype.systemOne=(async(request:any)=>{apiCalls++;const ids=Object.keys(request.state.candidates);return {model:'mock',answers:{candidate:{type:'choice',choice:ids[0],probabilities:Object.fromEntries(ids.map((id,i)=>[id,i===0?1:0]))}},usage:{input_tokens:1,output_tokens:1}}}) as any;
 try{for(const policy of ['blind-board','blind-feature','blind-dual']){const response=await POST(new NextRequest('http://localhost:2048/api/decision',{method:'POST',headers:{host:'localhost:2048'},body:JSON.stringify({policy,board:fixtures[0],score:0,moves:0,match:policy})}));assert.equal(response.status,200);const r=await response.json();assert.equal(r.evidence.audit_not_sent.status,'pending');assert.equal(nativeCalls,policy==='blind-dual'?1:0);}assert.equal(apiCalls,3);}finally{global.__jevNtupleBridge=previous;TypeSafeClient.prototype.systemOne=original;if(saved===undefined)delete process.env.TYPESAFE_API_KEY;else process.env.TYPESAFE_API_KEY=saved;if(remote===undefined)delete process.env.NTUPLE_SERVICE_URL;else process.env.NTUPLE_SERVICE_URL=remote;}
});
test('audit resolves after move without blocking; restart discards late audit',async()=>{
 let resolve!:(v:any)=>void;const pending=new Promise<any>(r=>resolve=r);
 const m=new MatchController(()=>{},{search:()=>pending,jev:async(p:any)=>({direction:legalMoves(p.board)[0],probabilities:{},ms:1,evidence:{audit_not_sent:{status:'pending'}}})});m.configure('compare',['blind-board','search']);const b=m.boards[0];await m.tick(b);assert.equal(b.game.moves,1);const record=b.records[0],audit=(record.evidence as any).audit_not_sent;assert.equal(audit.status,'pending');resolve({direction:record.direction});await Promise.resolve();assert.equal(audit.status,'complete');assert.equal(audit.agrees_expectimax,true);m.dispose();
 let late!:(v:any)=>void;const gate=new Promise<any>(r=>late=r);const other=new MatchController(()=>{},{search:()=>gate,jev:async(p:any)=>({direction:legalMoves(p.board)[0],probabilities:{},ms:1,evidence:{audit_not_sent:{status:'pending'}}})});other.configure('compare',['blind-board','search']);await other.tick(other.boards[0]);const old=other.boards[0].records[0];other.reset();late({direction:old.direction});await Promise.resolve();assert.equal((old.evidence as any).audit_not_sent.status,'pending');assert.equal(other.boards[0].game.moves,0);other.dispose();
});

