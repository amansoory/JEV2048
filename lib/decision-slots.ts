// Per-process CPU/network admission, in addition to shared public protection.
export class DecisionSlots{
 private active=0;private queue:{resolve:(release:()=>void)=>void;reject:(error:Error)=>void;signal:AbortSignal;abort:()=>void}[]=[];
 constructor(private limit=3){}
 acquire(signal:AbortSignal):Promise<()=>void>{
  if(signal.aborted)return Promise.reject(Error('Request cancelled'));
  if(this.active<this.limit){this.active++;return Promise.resolve(this.release());}
  if(this.queue.length>=20)return Promise.reject(Error('Decision queue is full'));
  return new Promise((resolve,reject)=>{const entry={resolve,reject,signal,abort:()=>{this.queue=this.queue.filter(e=>e!==entry);reject(Error('Request cancelled'));}};signal.addEventListener('abort',entry.abort,{once:true});this.queue.push(entry);});
 }
 private release(){let done=false;return ()=>{if(done)return;done=true;const next=this.queue.shift();if(next){next.signal.removeEventListener('abort',next.abort);next.resolve(this.release());}else this.active--;};}
}
const g=globalThis as typeof globalThis&{__jevDecisionSlots?:DecisionSlots};
export const decisionSlots=g.__jevDecisionSlots??=new DecisionSlots(3);
