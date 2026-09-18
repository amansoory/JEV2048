import {Worker} from 'node:worker_threads';
import path from 'node:path';
import type {Direction} from '@/public/engine';
export type PreparedEvidence={features:Partial<Record<Direction,any>>;tails:any[];timing:Record<string,number>};
type Job={board:number[];policy:string;queued:number;resolve:(v:PreparedEvidence)=>void;reject:(e:Error)=>void};
class EvidencePool{
 private slots:{worker:Worker;job?:Job;timer?:ReturnType<typeof setTimeout>}[]=[];
 private queue:Job[]=[];
 run(board:number[],policy:string){return new Promise<PreparedEvidence>((resolve,reject)=>{
  if(this.queue.length>=20){reject(Error('Decision workers are busy. Retry shortly.'));return;}
  this.queue.push({board:board.slice(),policy,queued:performance.now(),resolve,reject});this.pump();
 });}
 private pump(){
  while(this.queue.length){let slot=this.slots.find(s=>!s.job);
   if(!slot&&this.slots.length<2){
    const worker=new Worker(path.join(process.cwd(),'lib/evidence-worker.mjs'),{execArgv:[]});slot={worker};this.slots.push(slot);const owned=slot;
    worker.on('message',result=>{const job=owned.job;if(!job)return;clearTimeout(owned.timer);owned.job=undefined;worker.unref();if(result.error)job.reject(Error(result.error));else job.resolve(result);this.pump();});
    worker.on('error',()=>this.fail(owned));worker.on('exit',()=>this.fail(owned));worker.unref();
   }
   if(!slot)return;const job=this.queue.shift()!;slot.job=job;slot.worker.ref();
   const queued=performance.now()-job.queued,resolve=job.resolve;job.resolve=r=>resolve({...r,timing:{...r.timing,worker_queue_ms:queued}});
   const owned=slot;slot.timer=setTimeout(()=>this.fail(owned),30000);slot.worker.postMessage({board:job.board,policy:job.policy});
  }
 }
 private fail(slot:EvidencePool['slots'][number]){if(!this.slots.includes(slot))return;this.slots=this.slots.filter(s=>s!==slot);clearTimeout(slot.timer);slot.job?.reject(Error('Decision worker unavailable. Retry this board.'));slot.job=undefined;void slot.worker.terminate();this.pump();}
 close(){for(const j of this.queue)j.reject(Error('Decision workers closed'));this.queue=[];for(const s of [...this.slots])this.fail(s);}
}
const globals=globalThis as typeof globalThis&{__jevEvidencePool?:EvidencePool};
export function prepareEvidence(board:number[],policy:string){if(['blind-board','blind-strategy'].includes(policy))return Promise.resolve({features:{},tails:[],timing:{board_features_ms:0,expectimax_evidence_ms:0,worker_queue_ms:0}} as PreparedEvidence);return (globals.__jevEvidencePool??=new EvidencePool()).run(board,policy);}
export function closeEvidenceWorkers(){globals.__jevEvidencePool?.close();delete globals.__jevEvidencePool;}
