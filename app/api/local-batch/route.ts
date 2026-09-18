import {NextRequest,NextResponse} from 'next/server';
import {sameOrigin,publicRequest} from '@/lib/protection';
import {runLocalBatch} from '@/lib/local-batch-server';
import type {BatchInput} from '@/lib/local-batch';
export const runtime='nodejs';export const dynamic='force-dynamic';
const globalBatches=globalThis as typeof globalThis&{__localBatches?:Map<string,{generation:number;sequence:number;abort:AbortController;done:Promise<void>}>};
const flights=globalBatches.__localBatches??=new Map();
export async function POST(req:NextRequest){if(publicRequest(req)||!sameOrigin(req))return NextResponse.json({error:'Ultra is available only on this local server.'},{status:403});let input:BatchInput;
 try{const raw=await req.text();if(raw.length>2048)throw Error();input=JSON.parse(raw);if(!['search','ntuple'].includes(input.policy)||typeof input.seed!=='string'||input.seed.length>256||typeof input.session!=='string'||!/^[\w-]{1,100}$/.test(input.session)||![input.generation,input.sequence,input.moves,input.score].every(n=>Number.isSafeInteger(n)&&n>=0)||!Array.isArray(input.board)||input.board.length!==16||!input.board.every(v=>Number.isSafeInteger(v)&&(v===0||(v>=2&&v<=2**30&&Number.isInteger(Math.log2(v))))))throw Error();if(input.policy==='ntuple'&&input.board.some(v=>v>32768))return NextResponse.json({error:'N-tuple cannot represent tiles above 32768. No fallback was used.'},{status:400});}catch{return NextResponse.json({error:'Invalid local batch state.'},{status:400});}
 const key=input.session+'-'+input.policy,previous=flights.get(key);if(previous){if(input.generation<previous.generation||(input.generation===previous.generation&&input.sequence<=previous.sequence))return NextResponse.json({error:'Duplicate or stale local batch.'},{status:409});previous.abort.abort();await previous.done;}
 if(req.signal.aborted)return new NextResponse(null,{status:499});if(flights.has(key)||flights.size>=8)return NextResponse.json({error:'Local batches are busy. Retry this board.'},{status:409});
 const abort=new AbortController(),cancel=()=>abort.abort();req.signal.addEventListener('abort',cancel,{once:true});let finish!:()=>void;const done=new Promise<void>(r=>{finish=r;});const flight={generation:input.generation,sequence:input.sequence,abort,done};flights.set(key,flight);
 try{const result=await runLocalBatch(input,abort.signal);return NextResponse.json(result,{headers:{'Cache-Control':'no-store'}});}catch(e){return NextResponse.json({error:abort.signal.aborted?'Local batch cancelled.':e instanceof Error?e.message:'Local batch failed.'},{status:abort.signal.aborted?499:503});}finally{req.signal.removeEventListener('abort',cancel);if(flights.get(key)===flight)flights.delete(key);finish();}
}
