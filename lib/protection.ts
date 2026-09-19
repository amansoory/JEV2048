import {Redis} from '@upstash/redis';
import {createHmac,randomUUID,timingSafeEqual} from 'node:crypto';
import type {NextRequest} from 'next/server';
export const publicRequest=(req:Request)=>process.env.VERCEL==='1'||! /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.get('host')||'');
export const redisConfigured=()=>!!(process.env.UPSTASH_REDIS_REST_URL&&process.env.UPSTASH_REDIS_REST_TOKEN);
export const turnstileConfigured=()=>!!(process.env.TURNSTILE_SECRET_KEY&&process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY&&process.env.SESSION_SECRET);
export function configured(){return redisConfigured()&&turnstileConfigured();}
export function sameOrigin(req:Request){
  const origin=req.headers.get('origin');if(!origin)return !publicRequest(req);
  try{const parsed=new URL(origin);return parsed.host===req.headers.get('host')&&(parsed.protocol==='https:'||(!publicRequest(req)&&parsed.protocol==='http:'));}catch{return false;}
}
const sign=(value:string)=>createHmac('sha256',process.env.SESSION_SECRET||'local-only').update(value).digest('hex');
export function makeSession(){const value=randomUUID()+'.'+(Date.now()+12*60*60*1000);return value+'.'+sign(value);}
export function session(req:NextRequest){
  const cookie=req.cookies.get('jev-session')?.value;
  if(!cookie)return null;
  const parts=cookie.split('.');if(parts.length!==3||!Number.isFinite(Number(parts[1]))||Number(parts[1])<Date.now())return null;
  const expected=sign(parts[0]+'.'+parts[1]),actual=parts[2];
  return actual.length===expected.length&&timingSafeEqual(Buffer.from(actual),Buffer.from(expected))?parts[0]:null;
}
export function visitorIP(req:Request){return (req.headers.get('x-vercel-forwarded-for')||req.headers.get('x-forwarded-for')||'unknown').split(',')[0].trim();}
const acquireScript=`
local now=tonumber(ARGV[1])
redis.call('ZREMRANGEBYSCORE',KEYS[1],'-inf',now)
redis.call('ZREMRANGEBYSCORE',KEYS[6],'-inf',now)
local sessionLimit=ARGV[4]=='jev' and 2 or 1
if redis.call('EXISTS',KEYS[2])==1 or redis.call('ZCARD',KEYS[6])>=sessionLimit then return 1 end
if redis.call('ZCARD',KEYS[1])>=8 then return 2 end
if tonumber(redis.call('GET',KEYS[3]) or '0')>=300 or tonumber(redis.call('GET',KEYS[4]) or '0')>=1200 or tonumber(redis.call('GET',KEYS[7]) or '0')>=180 then return 3 end
if ARGV[4]=='jev' and tonumber(redis.call('GET',KEYS[5]) or '0')>=tonumber(ARGV[3]) then return 4 end
redis.call('SET',KEYS[2],ARGV[2],'PX',60000)
redis.call('ZADD',KEYS[6],now+60000,ARGV[2])
redis.call('PEXPIRE',KEYS[6],65000)
redis.call('ZADD',KEYS[1],now+60000,ARGV[2])
redis.call('PEXPIRE',KEYS[1],65000)
for _,i in ipairs({3,4,7}) do redis.call('INCR',KEYS[i]);redis.call('EXPIRE',KEYS[i],120) end
if ARGV[4]=='jev' then redis.call('INCR',KEYS[5]);redis.call('EXPIRE',KEYS[5],172800) end
return 0`;
const releaseScript=`if redis.call('GET',KEYS[2])==ARGV[1] then redis.call('DEL',KEYS[2]) end redis.call('ZREM',KEYS[6],ARGV[1]) redis.call('ZREM',KEYS[1],ARGV[1]) return 1`;
const localLocks=new Set<string>();
// Without Redis these limits apply to this process only, not across Vercel instances.
const publicLocks=new Map<string,{lease:string;expires:number}>();
const publicActive=new Map<string,{kind:string;sid:string;expires:number}>();
const publicCounts=new Map<string,{count:number;expires:number}>();
function acquireLocalPublic(sid:string,ip:string,match:string,kind:string){
 const now=Date.now(),noop=async()=>{};
 for(const [key,value] of publicLocks)if(value.expires<=now)publicLocks.delete(key);
 for(const [key,value] of publicActive)if(value.expires<=now)publicActive.delete(key);
 for(const [key,value] of publicCounts)if(value.expires<=now)publicCounts.delete(key);
 const locks=['board:'+sid+':'+match];
 if(locks.some(key=>publicLocks.has(key))||[...publicActive.values()].filter(v=>v.kind===kind&&v.sid===sid).length>=(kind==='jev'?2:1))return {release:noop,error:'Another request is finishing for this session. Retry shortly.',status:429,code:'rate_limit'};
 const minute=Math.floor(now/60000),day=Math.floor(now/86400000);
 const rates:[string,number][]=[['ip:'+ip+':'+minute,300],['global:'+minute,1200],['session:'+sid+':'+minute,180]];
 if([...publicActive.values()].filter(v=>v.kind===kind).length>=8||rates.some(([key,limit])=>(publicCounts.get(key)?.count??0)>=limit))return {release:noop,error:'The request limit has been reached. Retry shortly.',status:429,code:'rate_limit'};
 const raw=Number(process.env.PUBLIC_DAILY_JEV_CALLS??12000),budget=Number.isSafeInteger(raw)&&raw>=0?raw:0,daily='daily:'+day;
 if(kind==='jev'&&(publicCounts.get(daily)?.count??0)>=budget)return {release:noop,error:'The daily Jev quota has been reached. Retry tomorrow.',status:429,code:'quota_exhausted'};
 const lease=randomUUID();for(const key of locks)publicLocks.set(key,{lease,expires:now+60000});publicActive.set(lease,{kind,sid,expires:now+60000});
 for(const [key] of rates)publicCounts.set(key,{count:(publicCounts.get(key)?.count??0)+1,expires:now+120000});
 if(kind==='jev')publicCounts.set(daily,{count:(publicCounts.get(daily)?.count??0)+1,expires:(day+1)*86400000});
 return {release:async()=>{for(const key of locks)if(publicLocks.get(key)?.lease===lease)publicLocks.delete(key);publicActive.delete(lease);}};
}
export async function acquire(req:NextRequest,match:string,kind:'jev'|'native'='jev'):Promise<{release:()=>Promise<void>;error?:string;status?:number;code?:string}> {
 const noop=async()=>{};
 if(!publicRequest(req)){const key=kind+':'+match;if(localLocks.has(key))return {release:noop,error:'A decision is still finishing. Retry shortly.',status:409,code:'busy'};localLocks.add(key);return {release:async()=>{localLocks.delete(key);}};}
 const verifiedSession=session(req);if(turnstileConfigured()&&!verifiedSession)return {release:noop,error:'Complete the human check to enable inference.',status:401,code:'verification_required'};
 const ip=sign(visitorIP(req)).slice(0,24),sid=verifiedSession||'ip-'+ip;
 if(!redisConfigured())return acquireLocalPublic(sid,ip,match,kind);
 const redis=Redis.fromEnv(),lease=randomUUID(),minute=Math.floor(Date.now()/60000);
 const keys=['study:active:'+kind,'study:board:'+sid+':'+match,'study:ip:'+ip+':'+minute,'study:rate:'+minute,'study:jev:daily:'+Math.floor(Date.now()/86400000),'study:session-active-v2:'+kind+':'+sid,'study:session-rate:'+sid+':'+minute];
 const configuredBudget=Number(process.env.PUBLIC_DAILY_JEV_CALLS??12000),budget=Number.isSafeInteger(configuredBudget)&&configuredBudget>=0?configuredBudget:0;
 const result=Number(await redis.eval(acquireScript,keys,[Date.now(),lease,budget,kind]));
 if(result!==0)return {release:noop,error:result===4?'The daily Jev quota has been reached. Retry tomorrow.':result===1?'Another request is finishing for this session. Retry shortly.':'The shared request limit has been reached. Retry shortly.',status:429,code:result===4?'quota_exhausted':'rate_limit'};
 return {release:async()=>{await redis.eval(releaseScript,keys,[lease]);}};
}
