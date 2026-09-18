import {appendFileSync,readFileSync,existsSync,openSync,fsyncSync,closeSync} from 'node:fs';
import {seededRandom} from '../public/engine.js';
export const POLICIES=['raw','strategy','feature','assisted','heuristic','search'];
export const sleep=ms=>new Promise(r=>setTimeout(r,ms));
export function append(file,event){appendFileSync(file,JSON.stringify(event)+'\n');const fd=openSync(file,'a');try{fsyncSync(fd);}finally{closeSync(fd);}}
export function journal(file){if(!existsSync(file))return [];const text=readFileSync(file,'utf8'),lines=text.split('\n'),out=[];for(let i=0;i<lines.length;i++){if(!lines[i])continue;try{out.push(JSON.parse(lines[i]));}catch{if(lines[i+1]?.includes('"type":"recovered_partial_tail"'))continue;if(i!==lines.length-1)throw Error('Corrupt journal: '+file);appendFileSync(file,'\n'+JSON.stringify({type:'recovered_partial_tail',at:new Date().toISOString()})+'\n');}}return out;}
export const mean=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:null;
export const quantile=(a,p)=>{if(!a.length)return null;const b=a.slice().sort((x,y)=>x-y),i=(b.length-1)*p;return b[Math.floor(i)]+(b[Math.ceil(i)]-b[Math.floor(i)])*(i%1);};
export const stats=a=>({mean:mean(a),median:quantile(a,.5),p95:quantile(a,.95),sd:a.length>1?Math.sqrt(a.reduce((s,v)=>s+(v-mean(a))**2,0)/(a.length-1)):null,min:a.length?Math.min(...a):null,max:a.length?Math.max(...a):null});
export function bootstrap(a,seed='study-ci',samples=2000){if(a.length<2)return [null,null];const random=seededRandom(seed),values=Array.from({length:samples},()=>mean(a.map(()=>a[Math.floor(random()*a.length)])));return [quantile(values,.025),quantile(values,.975)];}
export function wilson(k,n){if(!n)return [null,null];const z=1.959964,p=k/n,d=1+z*z/n,c=(p+z*z/(2*n))/d,h=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/d;return [Math.max(0,c-h),Math.min(1,c+h)];}
export class Limiter{
 constructor({rpm=1000,tps=200000,reservation=32768,now=Date.now,wait=sleep}={}){Object.assign(this,{rpm,tps,reservation,now,wait});this.requests=[];this.tokens=[];this.blockedUntil=0;this.queue=Promise.resolve();if(tps<reservation)throw Error('TPS must accommodate one 32768-token reservation');}
 async take(){const previous=this.queue;let release;this.queue=new Promise(r=>release=r);await previous;try{for(;;){const now=this.now();this.requests=this.requests.filter(t=>now-t<60000);this.tokens=this.tokens.filter(t=>now-t<1000);let delay=Math.max(0,this.blockedUntil-now);if(this.requests.length>=this.rpm)delay=Math.max(delay,60000-(now-this.requests[0]));if((this.tokens.length+1)*this.reservation>this.tps)delay=Math.max(delay,1000-(now-this.tokens[0]));if(delay>0){await this.wait(delay+1);continue;}this.requests.push(now);this.tokens.push(now);return;}}finally{release();}}
 cooldown(ms){this.blockedUntil=Math.max(this.blockedUntil,this.now()+ms);}
}
export function retryAfter(error){const h=error?.headers??error?.response?.headers;const ms=h?.get?.('retry-after-ms')??h?.['retry-after-ms'];if(ms!==undefined&&ms!==null&&Number.isFinite(Number(ms)))return Math.max(0,Number(ms));const v=h?.get?.('retry-after')??h?.['retry-after']??error?.retryAfter;if(v===undefined)return 0;const n=Number(v);return Number.isFinite(n)?Math.max(0,n*1000):Math.max(0,Date.parse(v)-Date.now())||0;}
export async function decide({request,validate,limiter,onAttempt,onRetry,stopping=()=>false,wait=sleep}){
 let retries=0,correction=false;
 for(;;){if(stopping())throw Object.assign(Error('Interrupted'),{code:'interrupted'});await limiter.take();if(stopping())throw Object.assign(Error('Interrupted'),{code:'interrupted'});const started=performance.now();let response,error;
 try{response=await request(correction);const check=validate(response);if(check)error={code:check,retryable:check==='invalid_probabilities'};}catch(e){error=e;}
 onAttempt({response,error,ms:performance.now()-started,correction});
 if(!error)return response;
 if(error.code==='illegal_choice'&&!correction){correction=true;continue;}
 if(!error.retryable||retries>=3)throw Object.assign(Error('Incomplete API decision'),{code:error.code||'api_failure'});
 const delay=Math.max(500*2**retries,retryAfter(error));retries++;onRetry({code:error.code,delay_ms:delay});if(error.status===429)limiter.cooldown(delay);await wait(delay);
 }
}
