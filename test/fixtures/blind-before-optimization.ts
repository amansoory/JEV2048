// Frozen offline parity reference. Never calls Jev.
import {randomInt} from 'node:crypto';
import {TypeSafeClient,choice} from '@typesafe-ai/sdk';
import {legalMoves,slide,type Direction} from '@/public/engine';
import {validDistribution} from '@/public/probabilities';
import {evidence as structural} from '@/lib/blind-structure';
import {tailMetrics} from '@/experiments/tail-risk-metrics.mjs';
import {searchDecision} from '@/public/search-solver';
export const BLIND_MODEL='jev-1.13.0';
export const BLIND_VERSION='blind-ablation-1';
export const BLIND_IDS=['blind-board','blind-strategy','blind-feature','blind-expectimax','blind-ntuple','blind-dual'] as const;
export type BlindId=typeof BLIND_IDS[number];
export type Learned={direction:Direction;options:{direction:Direction;value:number;gain:number}[]};
const RULES='Choose one supplied anonymous candidate. The current board and candidate outcomes use 4 rows of 4 tiles; zero means empty. Equal tiles merge once per move; merged values add to score. After a valid move, a 2 (90%) or 4 (10%) appears uniformly in an empty cell. Candidate boards are BEFORE that unknown spawn. No legal move means game over. Build larger tiles, reach 2048 and sustain long-term scoring and survival, not only immediate reward. Probabilities are preferences among these candidates, not chances of winning.';
const STRATEGY='Preserve mobility and empty cells. Keep large tiles organized. Avoid fragmenting the board. Preserve merge opportunities. Avoid immediate rewards that damage long-term survival.';
const STRUCTURE='Structural penalties use log2 tile ranks; smaller monotonicity and smoothness penalties mean more ordered rows/columns and more similar adjacent occupied tiles. Positions use row,column starting at 1. Corner stability is retention of an original largest-tile corner. Available merges is the maximum count in one legal move. Spawn sensitivity is the range across all possible next spawns; worst losses are component-wise, not one score. Two-step summaries enumerate two spawn-then-reply steps, weighting all legal replies equally, not assuming optimal play. Bounded summaries and marginal best-recovery indicators are not guarantees.';
const SEARCH='Search evidence uses three player plies, two possible-spawn layers with 90/10 weights and a path-probability cutoff of 0.0001. Future replies maximize a fixed evaluation combining empty cells, merge opportunities, rank sums and ordered lines. Expected and worst values share an affine normalization across all candidates and their worst outcomes; larger is better. Variance is divided by the squared normalization range. Values describe this bounded evaluator, not winning probabilities. Cutoff branches are approximate.';
const LEARNED='Learned values are pretrained temporal-difference pattern estimates, recovered from native action value minus immediate reward. Each is min-max normalized across this decision; the margin is its normalized value minus the mean of other candidates. Equal values map to 0.5. These estimates may reveal relative evaluations; no candidate is recommended. Search and learned evidence use separate scales and are not a combined score.';
const grid=(b:number[])=>Array.from({length:4},(_,i)=>b.slice(4*i,4*i+4));
export function buildBlind(board:number[],policy:BlindId,learned?:Learned,draw:(n:number)=>number=randomInt){
 if(!BLIND_IDS.includes(policy))throw Error('Unknown blinded policy');const legal=legalMoves(board);if(!legal.length)throw Error('Board is complete');
 const order=legal.slice();for(let i=order.length-1;i>0;i--){const j=draw(i+1);if(!Number.isInteger(j)||j<0||j>i)throw Error('Invalid shuffle');[order[i],order[j]]=[order[j],order[i]];}
 const mapping=Object.fromEntries(order.map((d,i)=>[String.fromCharCode(65+i),d])) as Record<string,Direction>;
 const useSearch=policy==='blind-expectimax'||policy==='blind-dual',useLearned=policy==='blind-ntuple'||policy==='blind-dual';
 if(useLearned&&(!learned||learned.options.length!==legal.length||legal.some(d=>!learned.options.some(o=>o.direction===d&&Number.isFinite(o.value)))))throw Error('Learned evaluation unavailable. No substitute was used.');
 const tails=useSearch?tailMetrics(board).options:[],all=tails.flatMap((o:any)=>[o.expected_value,o.worst_case_outcome]),lo=Math.min(...all),span=Math.max(...all)-lo;
 const values=useLearned?learned!.options.map(o=>o.value-o.gain):[],vmin=Math.min(...values),vrange=Math.max(...values)-vmin;
 const normalized=(v:number)=>vrange===0?.5:(v-vmin)/vrange;
 const candidates=Object.fromEntries(Object.entries(mapping).map(([id,d])=>{const r=slide(board,d);const c:Record<string,any>={resulting_board:grid(r.board),immediate_merge_reward:r.score};
 if(policy==='blind-feature'||useLearned){const facts=structural(board,d);if(policy==='blind-feature')Object.assign(c,facts,{congestion:{occupied_cells:16-facts.empty_cells,spawn_fills_board:facts.empty_cells===1}});else c.structural={empty_cells:facts.empty_cells,available_merges:facts.available_merges,monotonicity_penalty:facts.monotonicity_penalty,smoothness_penalty:facts.smoothness_penalty,largest_tile_positions:facts.largest_tile_positions,corner_stability:facts.corner_stability,legal_next_moves:facts.legal_next_moves};}
 if(useSearch){const t=tails.find((o:any)=>o.direction===d)!;c.search={player_depth:3,spawn_layers:2,probability_cutoff:.0001,normalized_expected_value:span===0?.5:(t.expected_value-lo)/span,normalized_worst_value:span===0?.5:(t.worst_case_outcome-lo)/span,normalized_variance:span===0?0:t.outcome_variance/(span*span),cutoff_probability:t.cutoff_probability,searched_dead_end_probability:t.near_term_game_over_probability,structural:{immediate:t.immediate,future_empty_cells:t.future_empty_cells,monotonicity:t.monotonicity,corner_chain_retention:t.corner_chain_retention,recoverability:t.recoverability}};}
 if(useLearned){const o=learned!.options.find(o=>o.direction===d)!,n=normalized(o.value-o.gain),others=values.filter((_,i)=>learned!.options[i].direction!==d);c.learned={normalized_afterstate_value:n,margin_from_other_candidates:others.length?n-others.reduce((s,v)=>s+normalized(v),0)/others.length:0};}return [id,c];}));
 const instruction=RULES+(policy==='blind-strategy'?' '+STRATEGY:'')+(policy==='blind-feature'||useLearned?' '+STRUCTURE:'')+(useSearch?' '+SEARCH:'')+(useLearned?' '+LEARNED:'');
 const request={model:BLIND_MODEL,state:{current_board:grid(board),candidates},questions:{candidate:choice(instruction,Object.fromEntries(Object.keys(mapping).map(id=>[id,'Candidate '+id])))}};
 return {request,mapping,policy,version:BLIND_VERSION};
}
export function validateBlind(result:any,mapping:Record<string,Direction>,board:number[]){const a=result?.answers?.candidate,ids=Object.keys(mapping);if(a?.type!=='choice'||!ids.includes(a?.choice)||!legalMoves(board).includes(mapping[a.choice]))throw Object.assign(Error('Jev returned an illegal candidate. No move applied.'),{code:'illegal_choice'});if(!validDistribution(a.probabilities,ids))throw Object.assign(Error('Jev returned invalid candidate probabilities.'),{code:'invalid_probabilities'});return {direction:mapping[a.choice],candidate:a.choice as string,candidateProbabilities:a.probabilities as Record<string,number>,probabilities:Object.fromEntries(ids.map(id=>[mapping[id],a.probabilities[id]]))};}
