/* Expectimax adaptation of nneonneo/2048-ai by Robert Xiao and contributors.
 * MIT license: /licenses/nneonneo-MIT.txt. See SEARCH-SOLVER.md.
 * Pure JavaScript, three player plies, exact 90/10 spawn weighting.
 * No learned model, no access to the seeded stream or future actual spawns.
 */
import {DIRECTIONS} from './engine.js';
const rows=new Map(),p4=Array.from({length:64},(_,n)=>n**4),p35=Array.from({length:64},(_,n)=>n**3.5);
function rowInfo(a,b,c,d){const key=a+b*64+c*4096+d*262144;let cached=rows.get(key);if(cached)return cached;const line=[a,b,c,d],out=[];let empty=0,sum=0,prev=0,count=0,merges=0,up=0,down=0;
 for(let i=0;i<4;i++){const rank=line[i];sum+=p35[rank];if(!rank)empty++;else{if(prev===rank)count++;else if(count){merges+=1+count;count=0;}prev=rank;}if(i){const delta=p4[line[i-1]]-p4[rank];if(delta>0)down+=delta;else up-=delta;}}
 if(count)merges+=1+count;const filled=line.filter(Boolean);for(let i=0;i<filled.length;i++){if(filled[i]===filled[i+1]){out.push(filled[i]+1);i++;}else out.push(filled[i]);}while(out.length<4)out.push(0);
 cached={out,value:200000+270*empty+700*merges-47*Math.min(up,down)-11*sum};rows.set(key,cached);return cached;
}
const indices=DIRECTIONS.map(d=>Array.from({length:4},(_,line)=>Array.from({length:4},(_,i)=>d==='left'?line*4+i:d==='right'?line*4+3-i:d==='up'?i*4+line:(3-i)*4+line)));
function shift(board,dir){const next=Array(16);let changed=false;for(const ids of indices[dir]){const out=rowInfo(board[ids[0]],board[ids[1]],board[ids[2]],board[ids[3]]).out;for(let i=0;i<4;i++){next[ids[i]]=out[i];if(out[i]!==board[ids[i]])changed=true;}}return changed?next:null;}
function evaluate(b){let value=0;for(let i=0;i<4;i++)value+=rowInfo(b[i*4],b[i*4+1],b[i*4+2],b[i*4+3]).value+rowInfo(b[i],b[i+4],b[i+8],b[i+12]).value;return value;}
export function searchSlide(board,direction){const b=board.map(v=>v?Math.log2(v):0),next=shift(b,DIRECTIONS.indexOf(direction));return (next||b).map(v=>v?2**v:0);}
export function searchDecision(board){const start=performance.now(),b=board.map(v=>v?Math.log2(v):0);let nodes=0;
 function chance(state,remaining,probability){nodes++;if(remaining===0||probability<.0001)return evaluate(state);const empty=[];for(let i=0;i<16;i++)if(!state[i])empty.push(i);if(!empty.length)return player(state,remaining,probability);let total=0;for(const i of empty){state[i]=1;total+=.9*player(state,remaining,probability*.9/empty.length);state[i]=2;total+=.1*player(state,remaining,probability*.1/empty.length);state[i]=0;}return total/empty.length;}
 function player(state,remaining,probability){let best=-Infinity;for(let d=0;d<4;d++){const next=shift(state,d);if(next)best=Math.max(best,chance(next,remaining-1,probability));}return best===-Infinity?0:best;}
 const options=[];for(let d=0;d<4;d++){const next=shift(b,d);if(next)options.push({direction:DIRECTIONS[d],value:chance(next,2,1)});}options.sort((a,b)=>b.value-a.value);return {direction:options[0]?.direction??null,options,nodes,depth:3,ms:performance.now()-start};
}
// Comparable moments under this bounded search, not win probabilities.
// Root options deliberately retain legal direction order, never a recommendation.
export function searchSummaries(board){const b=board.map(v=>v?Math.log2(v):0);let nodes=0;
 function leaf(state){let mobility=0;for(let d=0;d<4;d++)if(shift(state,d))mobility++;const q=evaluate(state)/1000;return {q,q2:q*q,dead:0,mobility};}
 function player(state,depth,p){let best=null;for(let d=0;d<4;d++){const next=shift(state,d);if(next){const value=chance(next,depth-1,p);if(!best||value.q>best.q)best=value;}}return best||{q:0,q2:0,dead:1,mobility:0};}
 function chance(state,depth,p){nodes++;if(depth===0||p<.0001)return leaf(state);const empty=[];for(let i=0;i<16;i++)if(!state[i])empty.push(i);const sum={q:0,q2:0,dead:0,mobility:0};for(const i of empty)for(const [tile,prob] of [[1,.9],[2,.1]]){state[i]=tile;const v=player(state,depth,p*prob/empty.length);for(const key of Object.keys(sum))sum[key]+=prob/empty.length*v[key];state[i]=0;}return sum;}
 return DIRECTIONS.flatMap((direction,d)=>{const next=shift(b,d);if(!next)return [];const v=chance(next,2,1),round=x=>Math.round(x*10000)/10000;return [{direction,expected_quality:round(v.q),horizon_dead_end_probability:round(v.dead),expected_leaf_legal_moves:round(v.mobility),quality_standard_deviation:round(Math.sqrt(Math.max(0,v.q2-v.q*v.q))),player_depth:3,spawn_layers:2,probability_cutoff:.0001}];});
}
