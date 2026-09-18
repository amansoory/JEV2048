import type {Direction} from '@/public/engine';
export type Decision={id:string;move:number;direction:Direction;before:number[];after:number[];preSpawn:number[];scoreBefore:number;scoreGain:number;spawn:{index:number;value:number};probabilities:Record<string,number>|null;ms:number|null;model?:string;policy?:string;sample?:boolean};
export type Player={decisionMs:number;timedDecisions:number;board:number[];score:number;moves:number;points:{move:number;score:number}[];last:Decision|null};
export type Metrics={calls:number;input:number;output:number;unknown:number;ms:number;timed:number};
