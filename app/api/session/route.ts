import {NextRequest,NextResponse} from 'next/server';
import {configured,makeSession,publicRequest,sameOrigin,visitorIP} from '@/lib/protection';
export async function POST(req:NextRequest){
  if(!sameOrigin(req))return NextResponse.json({error:'Origin refused'},{status:403});
  if(!publicRequest(req))return NextResponse.json({ok:true});
  if(!configured())return NextResponse.json({error:'Public play needs shared protection configuration.'},{status:503});
  try{
    const raw=await req.text();if(raw.length>4096)return NextResponse.json({error:'Invalid request'},{status:400});
    const {token}=JSON.parse(raw);if(typeof token!=='string'||token.length>2048)throw Error();
    const response=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({secret:process.env.TURNSTILE_SECRET_KEY,response:token,remoteip:visitorIP(req)}),signal:AbortSignal.timeout(8000)});
    const verified=await response.json();
    if(!verified.success||verified.hostname!==new URL('https://'+req.headers.get('host')).hostname||verified.action!=='arcade')return NextResponse.json({error:'Human verification failed. Please try again.'},{status:403});
    const res=NextResponse.json({ok:true});res.cookies.set('jev-session',makeSession(),{httpOnly:true,secure:true,sameSite:'strict',path:'/',maxAge:43200});return res;
  }catch{return NextResponse.json({error:'Could not verify this browser. Please retry.'},{status:503});}
}
