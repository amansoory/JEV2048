import {test} from 'node:test';
import assert from 'node:assert/strict';
import {slide,legalMoves,gameOver,spawn,newGame,move,heuristic} from '../public/engine.js';
const row = values => [...values,...Array(12).fill(0)];
test('slide through gaps without mutation',()=>{ const b=row([0,2,0,4]); assert.deepEqual(slide(b,'left').board,row([2,4,0,0])); assert.deepEqual(b,row([0,2,0,4])); });
test('merge once per move, nearest edge first, correct scores',()=>{
  for(const [input,output,score] of [[[2,2,2,2],[4,4,0,0],8],[[2,2,4,0],[4,4,0,0],4],[[4,4,4,0],[8,4,0,0],8],[[2,0,2,2],[4,2,0,0],4]]) {
    const result=slide(row(input),'left'); assert.deepEqual(result.board,row(output)); assert.equal(result.score,score);
  }
  assert.deepEqual(slide(row([2,2,2,0]),'right').board,row([0,0,2,4]));
});
test('vertical movement and merging',()=>{ const b=[2,0,0,0,2,0,0,0,4,0,0,0,4,0,0,0]; assert.deepEqual(slide(b,'up').board,[4,0,0,0,8,0,0,0,0,0,0,0,0,0,0,0]); assert.equal(slide(b,'down').score,12); assert.deepEqual(slide(b,'down').board,[0,0,0,0,0,0,0,0,4,0,0,0,8,0,0,0]); });
test('legal moves, invalid direction and game over',()=>{ assert.deepEqual(legalMoves(row([2,0,0,0])),['down','right']); assert.throws(()=>slide(row([2,0,0,0]),'bad')); const full=[2,4,2,4,4,2,4,2,2,4,2,4,4,2,4,2]; assert.equal(gameOver(full),true); full[0]=4; assert.equal(gameOver(full),false); });
test('spawn occupies exactly one empty cell, 90% threshold and full board',()=>{ const b=row([2,0,0,0]); const seq=[0,0.8999]; assert.deepEqual(spawn(b,()=>seq.shift()),row([2,2,0,0])); assert.equal(spawn(b,()=>0.9).filter(v=>v===4).length,1); assert.deepEqual(spawn(Array(16).fill(2),()=>{throw Error();}),Array(16).fill(2)); });
test('invalid moves do not spawn, score, count, or consume randomness',()=>{ const g={board:row([2,0,0,0]),score:0,moves:0,random:()=>{throw Error();}}; assert.equal(move(g,'up'),false); assert.equal(g.moves,0); assert.equal(g.score,0); });
test('valid move spawns and updates score and move count',()=>{ const g={board:row([2,2,0,0]),score:10,moves:3,random:()=>0}; assert.equal(move(g,'left'),true); assert.equal(g.score,14); assert.equal(g.moves,4); assert.deepEqual(g.board,row([4,2,0,0])); });
test('seed replay and heuristic stay deterministic and legal over full game',()=>{ const a=newGame('replay'),b=newGame('replay'); assert.equal(a.board.filter(Boolean).length,2); for(let i=0;i<3000&&!gameOver(a.board);i++){ const d=heuristic(a.board); assert.ok(legalMoves(a.board).includes(d)); move(a,d); move(b,d); assert.deepEqual(a.board,b.board); assert.equal(a.score,b.score); } });
