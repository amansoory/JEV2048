import {choice} from '@typesafe-ai/sdk';
import {legalMoves} from './public/engine.js';
import {optionFacts} from './public/analysis.js';
export const ACTIVE_POLICY='existing';
export function revisedRequest(board,context={},policy='immediate'){
 const legal=legalMoves(board);if(!legal.length)throw Error('No legal options');
 return {state:{board,layout:'row-major 4x4; 0=empty; positions 1-16',score:context.score??0,highest_tile:Math.max(...board),move_number:context.moveNumber??0,legal_directions:legal,options:optionFacts(board,policy==='lookahead')},questions:{direction:choice('Choose the legal move most likely to survive and build large tiles over the full game. Equal adjacent tiles merge once per move. Options show exact boards BEFORE spawning. A valid move spawns a 2 (90%) or 4 (10%) at a uniformly random empty cell. No legal moves means game over. Preserve space and future merge opportunities, not just immediate points.'+(policy==='lookahead'?' spawn_expectation enumerates every possible next spawn with its true probability. Expected best next merge points and empty cells maximize separately over legal replies; they may require different replies. These are averages, not guaranteed outcomes.':''),Object.fromEntries(legal.map(d=>[d,`Slide ${d}`])))}};
}
