import {Redis} from '@upstash/redis';
import {createHmac,randomUUID,timingSafeEqual} from 'node:crypto';
import type {NextRequest} from 'next/server';
export const publicRequest=(req:Request)=>process.env.VERCEL==='1'||! /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.get('host')||'');
export function configured(){return !!(process.env.UPSTASH_REDIS_REST_URL&&process.env.UPSTASH_REDIS_REST_TOKEN&&process.env.TURNSTILE_SECRET_KEY&&process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY&&process.env.SESSION_SECRET);}
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
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now)
if redis.call('EXISTS',KEYS[2])==1 then return 1 end
if redis.call('ZCARD',KEYS[1])>=8 then return 2 end
local ipCount=tonumber(redis.call('GET',KEYS[3]) or '0')
local allCount=tonumber(redis.call('GET',KEYS[4]) or '0')
if ipCount>=600 or allCount>=1200 then return 3 end
redis.call('SET',KEYS[2],ARGV[2],'PX',25000)
redis.call('ZADD',KEYS[1],now+25000,ARGV[2])
redis.call('PEXPIRE',KEYS[1],30000)
redis.call('INCR',KEYS[3])
redis.call('EXPIRE',KEYS[3],120)
redis.call('INCR',KEYS[4])
redis.call('EXPIRE',KEYS[4],120)
return 0`;
const releaseScript=`if redis.call('GET',KEYS[2])==ARGV[1] then redis.call('DEL',KEYS[2]) end redis.call('ZREM',KEYS[1],ARGV[1]) return 1`;
const localLocks=new Set<string>();
export async function acquire(req:NextRequest,match:string):Promise<{release:()=>Promise<void>;error?:string;status?:number}> {
  if(!publicRequest(req)){
    if(localLocks.has(match))return {release:async()=>{},error:'A decision is still finishing. Retry in a moment.',status:409};
    localLocks.add(match);return {release:async()=>{localLocks.delete(match);}};
  }
  if(!configured())return {release:async()=>{},error:'Public Jev play is not enabled yet. Shared protection needs configuration.',status:503};
  const sid=session(req);if(!sid)return {release:async()=>{},error:'Please complete the human check to play Jev.',status:401};
  const redis=Redis.fromEnv(),lease=randomUUID(),minute=Math.floor(Date.now()/60000);
  const ip=sign(visitorIP(req)).slice(0,24);
  const keys=['arcade:active','arcade:session:'+sid,'arcade:ip:'+ip+':'+minute,'arcade:rate:'+minute];
  const result=Number(await redis.eval(acquireScript,keys,[Date.now(),lease]));
  if(result!==0)return {release:async()=>{},error:result===1?'A decision is still finishing. Retry in a moment.':'The arcade is busy. Please retry shortly.',status:429};
  return {release:async()=>{await redis.eval(releaseScript,keys.slice(0,2),[lease]);}};
}
