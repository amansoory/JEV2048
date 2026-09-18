import type {Direction} from './engine';
export type SearchDecision={direction:Direction|null;options:{direction:Direction;value:number}[];nodes:number;depth:number;ms:number};
export function searchDecision(board:number[]):SearchDecision;
export function searchSlide(board:number[],direction:Direction):number[];
export type SearchSummary={direction:Direction;expected_quality:number;horizon_dead_end_probability:number;expected_leaf_legal_moves:number;quality_standard_deviation:number;player_depth:number;spawn_layers:number;probability_cutoff:number};
export function searchSummaries(board:number[]):SearchSummary[];
