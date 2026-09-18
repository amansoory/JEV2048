import {setImmediate as yieldTurn} from 'node:timers/promises';
import {gameOver,move} from '@/public/engine';
import {searchDecision} from '@/public/search-solver';
import {nativeDecision} from './ntuple-server';
import {resumeGame,type BatchInput,type BatchMove,type BatchResult,type BatchSnapshot} from './local-batch';
export async function runLocalBatch(input:BatchInput,signal:AbortSignal):Promise<BatchResult>{const game=resumeGame(input.seed,input.board,input.score,input.moves),records:BatchMove[]=[],snapshots:BatchSnapshot[]=[],start=performance.now();let computeMs=0;const snapshot=()=>({board:game.board.slice(),score:game.score,moves:game.moves,highest:Math.max(...game.board)});
 for(let i=0;i<100&&!gameOver(game.board);i++){signal.throwIfAborted();const decision=input.policy==='ntuple'?await nativeDecision(game.board):searchDecision(game.board);signal.throwIfAborted();if(!decision.direction||!move(game,decision.direction))throw Error('Local policy returned an invalid move.');const ms='computeMs' in decision?decision.computeMs:decision.ms;computeMs+=ms;records.push({direction:decision.direction,ms,model:'model' in decision?decision.model:undefined,evidence:'evidence' in decision?decision.evidence:decision});if(records.length%50===0)snapshots.push(snapshot());await yieldTurn();}
 signal.throwIfAborted();const final=snapshot();if(snapshots.at(-1)?.moves!==final.moves)snapshots.push(final);return {session:input.session,generation:input.generation,sequence:input.sequence,records,snapshots,final,elapsedMs:performance.now()-start,computeMs,finished:gameOver(game.board)};
}
