import {spawn,type ChildProcessWithoutNullStreams} from 'node:child_process';
import {createInterface} from 'node:readline';
import path from 'node:path';
import {legalMoves,slide,type Direction} from '@/public/engine';
export type NtupleDecision={direction:Direction;ms:number;computeMs:number;model:string;evidence:unknown};
type Native={ready?:boolean;direction:Direction;compute_ms:number;options:{direction:Direction;value:number;gain:number;afterstate:number[]}[]};
class NativeBridge {
 private keepWarm=false;
 private child:ChildProcessWithoutNullStreams|null=null;private ready:Promise<Native>|null=null;
 private pending:{resolve:(v:Native)=>void;reject:(e:Error)=>void;timer:ReturnType<typeof setTimeout>}|null=null;
 private queue:Promise<unknown>=Promise.resolve();private count=0;private idle:ReturnType<typeof setTimeout>|null=null;
 private wait(){return new Promise<Native>((resolve,reject)=>{const timer=setTimeout(()=>this.stop('N-tuple timed out. Retry this board.'),15000);this.pending={resolve,reject,timer};});}
 stop(message='N-tuple stopped. Retry this board.'){if(this.idle)clearTimeout(this.idle);this.idle=null;const child=this.child;this.child=null;this.ready=null;if(this.pending){clearTimeout(this.pending.timer);this.pending.reject(Error(message));this.pending=null;}child?.kill();}
 async warm(){this.keepWarm=true;if(this.idle)clearTimeout(this.idle);this.idle=null;const hello=await this.start();if(!hello.ready)throw Error('N-tuple initialization failed.');}
 private start(){if(this.ready)return this.ready;if(process.platform!=='win32'||process.env.VERCEL==='1')throw Error('N-tuple RL requires the local Windows native bridge.');const root=path.resolve(process.cwd(),'../jev-2048-models');const executable=path.join(root,'matched-evaluation/ntuple-bridge.exe'),weights=path.join(root,'TDL2048/4x6patt.w');
 this.ready=this.wait();const child=spawn(executable,[weights],{shell:false,windowsHide:true,env:{NODE_ENV:process.env.NODE_ENV,PATH:path.resolve(root,'../msys64/ucrt64/bin')+';'+process.env.PATH,SystemRoot:process.env.SystemRoot,TEMP:process.env.TEMP,TMP:process.env.TMP},stdio:['pipe','pipe','pipe']});this.child=child;
 child.on('error',()=>{if(this.child===child)this.stop('N-tuple native bridge is unavailable. Check the local executable and weights.');});child.on('exit',()=>{if(this.child===child)this.stop('N-tuple native bridge exited. Retry this board.');});child.stdin.on('error',()=>{if(this.child===child)this.stop('N-tuple connection failed. Retry this board.');});child.stderr.resume();
 createInterface({input:child.stdout}).on('line',line=>{if(this.child!==child)return;try{if(line.length>16384||!this.pending)throw Error();const value=JSON.parse(line) as Native;clearTimeout(this.pending.timer);this.pending.resolve(value);this.pending=null;}catch{this.stop('N-tuple returned an invalid response.');}});return this.ready;}
 decide(board:number[]):Promise<NtupleDecision>{if(this.count>=6)return Promise.reject(Error('N-tuple is busy. Retry this board.'));this.count++;const input=board.slice();const job=this.queue.then(async()=>{if(this.idle)clearTimeout(this.idle);this.idle=null;try{const start=performance.now(),hello=await this.start();if(!hello.ready)throw Error('N-tuple initialization failed.');const pending=this.wait();this.child!.stdin.write(input.map(v=>v?Math.log2(v):0).join(' ')+'\n');const r=await pending,legal=legalMoves(input);if(!legal.includes(r.direction)||!Number.isFinite(r.compute_ms)||r.compute_ms<0||!Array.isArray(r.options)||r.options.length!==legal.length||new Set(r.options.map(o=>o.direction)).size!==legal.length)throw Error('N-tuple returned an invalid decision.');for(const o of r.options){const s=slide(input,o.direction);if(!legal.includes(o.direction)||!Number.isFinite(o.value)||o.gain!==s.score||JSON.stringify(o.afterstate)!==JSON.stringify(s.board))throw Error('N-tuple cannot represent this move safely. No fallback was used.');}
 const ms=performance.now()-start;return {direction:r.direction,ms,computeMs:r.compute_ms,model:'TDL2048+ pretrained 4x6',evidence:{instruction:'Pretrained TD-learning n-tuple policy. Greedy reward plus afterstate value; no future search, training, or external API calls. The controller handles rules and spawning.',state:{board:input,options:r.options.map(o=>({direction:o.direction,board:o.afterstate,reward:o.gain,n_tuple_action_value:o.value}))},native_compute_ms:r.compute_ms,local_request_ms:ms}};
 }finally{if(!this.keepWarm){this.idle=setTimeout(()=>this.stop(),60000);this.idle.unref();}}});this.queue=job.catch(()=>{});return job.finally(()=>{this.count--;});}
}
const globalNative=globalThis as typeof globalThis&{__jevNtupleBridge?:NativeBridge};
export function nativeDecision(board:number[]){return (globalNative.__jevNtupleBridge??=new NativeBridge()).decide(board);}
export function closeNativeBridge(){globalNative.__jevNtupleBridge?.stop();delete globalNative.__jevNtupleBridge;}

export function warmNativeBridge(){return (globalNative.__jevNtupleBridge??=new NativeBridge()).warm();}
