import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {NextRequest} from 'next/server';
import {POST} from '../app/api/ntuple/route';
import {closeNativeBridge} from '../lib/ntuple-server';
import {legalMoves} from '../public/engine.js';
test('N-tuple UI route returns the verified native selector moves and evidence on fixed boards',async()=>{
 const module=await import(pathToFileURL(path.resolve('../jev-2048-models/matched-evaluation/policies.mjs')).href);
 const oracle=await module.ntuple();
 try{for(const board of [[2,2,2,2,...Array(12).fill(0)],[2,4,8,16,32,64,128,256,512,1024,2,4,8,16,32,32],[32768,16384,8192,4096,2048,1024,512,256,128,64,32,16,8,4,2,0]]){
 const before=board.slice(),expected=await oracle.decide({board,legal:legalMoves(board)});
 const response=await POST(new NextRequest('http://127.0.0.1:2048/api/ntuple',{method:'POST',headers:{host:'127.0.0.1:2048',origin:'http://127.0.0.1:2048'},body:JSON.stringify({board})}));
 assert.equal(response.status,200);const actual=await response.json();assert.equal(actual.direction,expected.direction);assert.deepEqual(actual.evidence.state.options,expected.options.map((o:any)=>({direction:o.direction,board:o.afterstate,reward:o.gain,n_tuple_action_value:o.value})));assert.deepEqual(board,before);assert.ok(actual.ms>=0&&actual.computeMs>=0);assert.equal(actual.model,'TDL2048+ pretrained 4x6');
 }
 const remote=await POST(new NextRequest('https://example.com/api/ntuple',{method:'POST',headers:{host:'example.com',origin:'https://example.com'},body:JSON.stringify({board:Array(16).fill(2)})}));assert.equal(remote.status,503);
 }finally{oracle.close();closeNativeBridge();}
});
