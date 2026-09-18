import type {Direction} from './engine';
export type OptionFacts={direction:Direction;board:number[];points:number;merges:number;merged_values:number[];empty:number;highest:number;highest_positions:number[];legal_after_slide:Direction[];spawn_fills_board:boolean;spawn_expectation?:{game_over_probability:number;expected_legal_moves:number;expected_best_next_merge_points:number;expected_best_next_empty_cells:number}};
export function optionFacts(board:number[],lookahead?:boolean):OptionFacts[];
export function heuristicScores(board:number[]):{direction:Direction;value:number}[];
export function spawnExpectation(board:number[]):NonNullable<OptionFacts['spawn_expectation']>;
