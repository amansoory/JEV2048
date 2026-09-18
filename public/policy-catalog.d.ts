import type {Direction} from './engine';
export type PolicyId='blind-board'|'blind-strategy'|'blind-feature'|'blind-expectimax'|'blind-ntuple'|'blind-dual'|'raw'|'strategy'|'feature'|'assisted'|'heuristic'|'search'|'ntuple';
export const POLICY_LIST:{id:PolicyId;name:string;short:string;jev:boolean;color:string}[];
export function policyInfo(id:string):typeof POLICY_LIST[number]|undefined;
export function features(board:number[]):{direction:Direction;board:number[];points:number;merge_count:number;merge_values:number[];empty_cells:number;legal_moves_before_spawn:number;highest_positions:number[];monotonicity_penalty:number;smoothness_penalty:number;highest_stays_in_same_corner:boolean;highest_in_corner:boolean;spawn_fills_board:boolean;immediate_death_probability:number}[];
