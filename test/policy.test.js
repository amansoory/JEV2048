import test from 'node:test';
import assert from 'node:assert/strict';
import {newGame,heuristic,move,legalMoves,slide} from '../public/engine.js';
import {optionFacts,spawnExpectation,heuristicScores} from '../public/analysis.js';
import {revisedRequest} from '../policies.js';
test('diagnostic heuristic scores preserve the actual unchanged ranking',()=>{for(const seed of ['unit-a','unit-b']){const g=newGame(seed);for(let i=0;i<150&&legalMoves(g.board).length;i++){assert.equal(heuristic(g.board),heuristicScores(g.board).sort((a,b)=>b.value-a.value)[0].direction);move(g,heuristic(g.board));}}});
test('option facts use actual merges and only legal directions',()=>{const b=[2,2,2,2,...Array(12).fill(0)];const f=optionFacts(b);assert.deepEqual(f.map(v=>v.direction),legalMoves(b));const l=f.find(v=>v.direction==='left');assert.equal(l.points,8);assert.equal(l.merges,2);assert.equal(l.empty,14);assert.deepEqual(l.board,slide(b,'left').board);assert.deepEqual(b.slice(0,4),[2,2,2,2]);});
test('spawn expectation distinguishes the 90 percent merge opportunity',()=>{const b=[2,4,8,16,4,8,16,32,8,16,32,64,16,32,2,0];const f=spawnExpectation(b);assert.ok(Math.abs(f.game_over_probability-.1)<1e-12);assert.ok(Math.abs(f.expected_legal_moves-1.8)<1e-12);assert.ok(Math.abs(f.expected_best_next_merge_points-3.6)<1e-12);});
test('revised policies contain exact legal options and no heuristic score',()=>{const g=newGame('request');for(const policy of ['immediate','lookahead']){const r=revisedRequest(g.board,{},policy);assert.deepEqual(r.state.legal_directions,legalMoves(g.board));assert.equal(r.state.options.some(v=>'value' in v),false);assert.equal('spawn_expectation' in r.state.options[0],policy==='lookahead');}});
