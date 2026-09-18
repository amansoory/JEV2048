import {parentPort} from 'node:worker_threads';
import {legalMoves} from '../public/engine.js';
import {evidence,immediateEvidence} from './blind-structure.js';
import {tailMetrics} from '../experiments/tail-risk-metrics.mjs';
parentPort.on('message',({board,policy})=>{
 try{
  const timing={board_features_ms:0,expectimax_evidence_ms:0},features={};let tails=[];
  const start=performance.now();
  if(['blind-feature','blind-ntuple','blind-dual'].includes(policy))for(const d of legalMoves(board))features[d]=policy==='blind-feature'?evidence(board,d):immediateEvidence(board,d);
  timing.board_features_ms=performance.now()-start;
  if(['blind-expectimax','blind-dual'].includes(policy)){const t=performance.now();tails=tailMetrics(board).options;timing.expectimax_evidence_ms=performance.now()-t;}
  parentPort.postMessage({features,tails,timing});
 }catch{parentPort.postMessage({error:'Decision evidence calculation failed. No substitute was used.'});}
});
