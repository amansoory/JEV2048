import {decisionSlots} from '@/lib/decision-slots';
import {NextRequest,NextResponse} from 'next/server';
import {BLIND_IDS,requestBlind,type BlindId} from '@/lib/blind-policies';
import {modelDecision,learnedValues,ModelError} from '@/lib/ntuple-provider';
import {legalMoves} from '@/public/engine';
import {acquire,sameOrigin} from '@/lib/protection';
import {requestPolicy,inspectAnswer,classifyError} from '@/decision-policies';
import {usageOf} from '@/lib/provider-usage';
export const runtime='nodejs';export const maxDuration=60;
export async function POST(req:NextRequest){
 if(!sameOrigin(req))return NextResponse.json({error:'Origin refused',retryable:false},{status:403});
 let releaseSlot:(()=>void)|undefined;const timing:Record<string,number>={ntuple_total_ms:0,ntuple_internal_ms:0,ntuple_compute_ms:0};let release:(()=>Promise<void>)|undefined,attempted=false,usage:ReturnType<typeof usageOf>=null;const start=performance.now();
 try{const raw=await req.text();if(raw.length>4096)return NextResponse.json({error:'Request too large',retryable:false},{status:413});const {board,score,moves,match,policy='raw',correction=false}=JSON.parse(raw);
 if(!['raw','strategy','feature','assisted',...BLIND_IDS].includes(policy)||typeof correction!=='boolean'||!Array.isArray(board)||board.length!==16||!board.every(v=>Number.isSafeInteger(v)&&(v===0||(v>=2&&v<=2**30&&Number.isInteger(Math.log2(v)))))||!Number.isSafeInteger(score)||score<0||!Number.isSafeInteger(moves)||moves<0||typeof match!=='string'||!/^[\w-]{1,80}$/.test(match))return NextResponse.json({error:'Invalid game state',retryable:false},{status:400});
 const legal=legalMoves(board);if(!legal.length)return NextResponse.json({error:'This board has finished.',retryable:false},{status:409});
 if(!process.env.TYPESAFE_API_KEY)return NextResponse.json({error:'Jev needs its server API key.',retryable:false},{status:503});const lockStart=performance.now();const lock=await acquire(req,match);timing.lock_acquisition_ms=performance.now()-lockStart;if(lock.error)return NextResponse.json({error:lock.error,retryable:lock.code!=='quota_exhausted'&&(lock.status===429||lock.status===409),code:lock.code,attempted:false},{status:lock.status});release=lock.release;const queueStart=performance.now();releaseSlot=await decisionSlots.acquire(req.signal);timing.queue_wait_ms=performance.now()-queueStart;
 if(BLIND_IDS.includes(policy)){
  const required=['blind-ntuple','blind-dual'].includes(policy);let learned;
  if(required){const nativeStart=performance.now(),native=await modelDecision(board,req.signal);timing.ntuple_total_ms=performance.now()-nativeStart;timing.ntuple_internal_ms=native.ms;timing.ntuple_compute_ms=native.computeMs;learned=learnedValues(native);}
  attempted=true;const blind=await requestBlind(board,policy as BlindId,process.env.TYPESAFE_API_KEY,learned);usage=usageOf(blind.result);
  return NextResponse.json({...blind.selected,model:blind.result.model,policy,evidence:blind.evidence,timing:{...timing,...blind.timing},usage,ms:Math.round(performance.now()-start),attempted},{headers:{'Cache-Control':'no-store'}});
 }
 attempted=true;
 const {result,evidence}=await requestPolicy(board,process.env.TYPESAFE_API_KEY,{score,moveNumber:moves},policy,correction);usage=usageOf(result);const check=inspectAnswer(result,legal);
 if(check.error)return NextResponse.json({error:check.error==='illegal_choice'?'Jev returned an illegal direction. No move applied.':'Jev returned invalid probabilities. No move applied.',code:check.error,retryable:check.error==='invalid_probabilities',attempted,usage,ms:Math.round(performance.now()-start)},{status:422});
 return NextResponse.json({direction:check.answer.choice,probabilities:check.answer.probabilities,model:result.model,policy,evidence,usage,ms:Math.round(performance.now()-start),attempted},{headers:{'Cache-Control':'no-store'}});
 }catch(error){if(error instanceof ModelError)return NextResponse.json({error:error.message,code:error.code,retryable:false,attempted:false},{status:error.status});if((error as {code?:string})?.code==='illegal_choice'||(error as {code?:string})?.code==='invalid_probabilities')return NextResponse.json({error:(error as Error).message,code:(error as {code:string}).code,retryable:false,attempted},{status:422});const c=classifyError(error);return NextResponse.json({error:c.code==='rate_limit'?'Jev is temporarily rate limited.':c.code==='timeout'?'Jev timed out.':'Jev could not finish this decision.',...c,attempted,usage,ms:Math.round(performance.now()-start)},{status:c.status});}finally{releaseSlot?.();if(release)await release().catch(()=>{});}
}
