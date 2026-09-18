import {newGame,move,slide,legalMoves,gameOver,type Game,type Direction} from '@/public/engine';
import type {Decision,Player} from './types';
export function player(game:Game):Player{return {decisionMs:0,timedDecisions:0,board:game.board.slice(),score:game.score,moves:game.moves,points:[{move:0,score:0}],last:null};}
export function applyMove(game:Game,direction:Direction,meta:Partial<Decision>={}):Decision|null{
  if(!legalMoves(game.board).includes(direction))return null;
  const before=game.board.slice(),scoreBefore=game.score,calculated=slide(before,direction);
  move(game,direction);
  const index=game.board.findIndex((v,i)=>v!==calculated.board[i]);
  return {...meta,id:meta.id||crypto.randomUUID(),move:game.moves,direction,before,after:game.board.slice(),preSpawn:calculated.board,scoreBefore,scoreGain:game.score-scoreBefore,spawn:{index,value:game.board[index]},probabilities:meta.probabilities??null,ms:meta.ms??null};
}
export function updatePlayer(previous:Player,game:Game,record:Decision):Player{
  return {decisionMs:previous.decisionMs+(record.ms??0),timedDecisions:previous.timedDecisions+(record.ms===null?0:1),board:game.board.slice(),score:game.score,moves:game.moves,points:[...previous.points,{move:game.moves,score:game.score}],last:record};
}
export function finished(left:Player,right:Player){return gameOver(left.board)&&gameOver(right.board);}
export const sampleDecision:Decision=(()=>{
  const game=newGame('clearly-labeled-sample');
  game.board=[2,2,4,0,0,4,0,0,2,0,0,0,0,0,0,0];
  const before=game.board.slice(),result=slide(before,'left'),after=result.board.slice();
  after[15]=2;
  return {id:'sample',sample:true,move:1,direction:'left',before,after,preSpawn:result.board,scoreBefore:0,scoreGain:result.score,spawn:{index:15,value:2},probabilities:null,ms:null};
})();
