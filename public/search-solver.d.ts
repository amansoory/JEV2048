import type {Direction} from './engine';
export type SearchDecision={direction:Direction|null;options:{direction:Direction;value:number}[];nodes:number;depth:number;ms:number};
export function searchDecision(board:number[]):SearchDecision;
export function searchSlide(board:number[],direction:Direction):number[];
