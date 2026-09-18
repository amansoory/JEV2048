import type {TurnMeta} from './turn-analytics';
import {validDistribution} from '@/public/probabilities';
import {legalMoves,type Direction} from '@/public/engine';
export type WireDecision={direction:Direction;probabilities:Record<string,number>;model?:string;policy?:string;evidence?:unknown;usage?:{input_tokens:number;output_tokens:number}|null;ms:number;attempted?:boolean;error?:string;code?:string;retryable?:boolean;timing?:Record<string,number>;telemetry?:TurnMeta};
export class PausedDecision extends Error{}
export async function reliableDecision(payload:{board:number[];[key:string]:unknown},options:{canStart:()=>boolean;onStatus:(s:string)=>void;onAttempt:(value:Partial<WireDecision>)=>void;fetcher?:typeof fetch;sleep?:(ms:number)=>Promise<void>;timeoutMs?:number}){
 const fetcher=options.fetcher??fetch,sleep=options.sleep??(ms=>new Promise(r=>setTimeout(r,ms)));let retries=0,corrected=false,attempts=0,browserParseMs=0;const started=performance.now();let lastError:string|null=null;let input:number|null=0,output:number|null=0;const telemetry=():TurnMeta=>({attempts,retries:Math.max(0,attempts-1),browserParseMs,errorCategory:lastError,inputTokens:input,outputTokens:output});
 for(;;){if(!options.canStart())throw new PausedDecision();options.onStatus(retries||corrected?'retrying':'waiting for Jev');let result:Partial<WireDecision>={},status=0;
 const abort=new AbortController(),timeout=setTimeout(()=>abort.abort(),options.timeoutMs??45000);
 try{const response=await fetcher('/api/decision',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,correction:corrected}),signal:abort.signal});status=response.status;const parseStart=performance.now();result=await response.json();browserParseMs+=performance.now()-parseStart;}catch{result={error:'The Jev request timed out or lost its connection.',code:'timeout',retryable:true,attempted:true};}finally{clearTimeout(timeout);}
 attempts++;if(result.error)lastError=result.code??'request_error';if(result.attempted!==false){input=result.usage&&input!==null?input+result.usage.input_tokens:null;output=result.usage&&output!==null?output+result.usage.output_tokens:null;}options.onAttempt(result);
 if(status>=200&&status<300&&result.direction&&legalMoves(payload.board).includes(result.direction)){const p=result.probabilities;if(validDistribution(p,legalMoves(payload.board)))return {...result,telemetry:{...telemetry(),timing:result.timing,serverMs:attempts===1?result.ms:undefined,totalMs:performance.now()-started}} as WireDecision;result={...result,error:'Jev returned invalid probabilities.',retryable:true};}
 else if(result.code==='illegal_choice'||(status>=200&&status<300)){if(!corrected){corrected=true;continue;}throw Object.assign(Error('Jev returned an illegal direction twice. Retry this board.'),{telemetry:telemetry(),code:'illegal_choice'});}
 const transient=result.retryable===true||status===429||status===408||status>=500;
 if(!transient||result.retryable===false||retries>=3)throw Object.assign(Error((result.error||'Jev could not finish this decision.')+' Retry this board.'),{code:result.code,telemetry:telemetry()});
 options.onStatus('retrying');await sleep(Math.min(400*2**retries,3200));retries++;
 }
}
