import {NextRequest,NextResponse} from 'next/server';
import {askJev,validateAnswer,usageOf} from '@/jev';
import {ACTIVE_POLICY} from '@/policy-selection';
import {legalMoves} from '@/public/engine';
import {acquire,sameOrigin} from '@/lib/protection';
export const runtime='nodejs';
export const maxDuration=25;
export async function POST(req:NextRequest){
  if(!sameOrigin(req))return NextResponse.json({error:'Origin refused'},{status:403});
  let release:(()=>Promise<void>)|undefined,attempted=false,usage:ReturnType<typeof usageOf>=null;
  const start=performance.now();
  try{
    const raw=await req.text();if(raw.length>4096)return NextResponse.json({error:'Request too large'},{status:413});
    const {board,score,moves,match}=JSON.parse(raw);
    if(!Array.isArray(board)||board.length!==16||!board.every(v=>Number.isSafeInteger(v)&&(v===0||(v>=2&&v<=2**30&&Number.isInteger(Math.log2(v)))))||!Number.isSafeInteger(score)||score<0||!Number.isSafeInteger(moves)||moves<0||typeof match!=='string'||!/^[\w-]{1,80}$/.test(match))return NextResponse.json({error:'Invalid game state'},{status:400});
    const legal=legalMoves(board);if(!legal.length)return NextResponse.json({error:'This board has no legal moves.'},{status:409});
    if(!process.env.TYPESAFE_API_KEY)return NextResponse.json({error:'Jev is unavailable. The server needs its API key.'},{status:503});
    const lock=await acquire(req,match);if(lock.error)return NextResponse.json({error:lock.error},{status:lock.status});
    release=lock.release;attempted=true;
    const result=await askJev(board,process.env.TYPESAFE_API_KEY,{score,moveNumber:moves});
    usage=usageOf(result);const answer=validateAnswer(result,legal);
    return NextResponse.json({direction:answer.choice,probabilities:answer.probabilities,model:result.model,policy:ACTIVE_POLICY,usage,ms:Math.round(performance.now()-start),attempted},{headers:{'Cache-Control':'no-store'}});
  }catch(error){
    const status=error&&typeof error==='object'&&'status' in error?Number(error.status):null;
    return NextResponse.json({error:attempted?`Jev could not complete this decision${status?' (HTTP '+status+')':''}. No move was applied. Please retry.`:'The decision service is unavailable. Please retry.',attempted,usage,ms:Math.round(performance.now()-start)},{status:502});
  }finally{if(release)await release().catch(()=>{});}
}
