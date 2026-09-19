import {warmNativeBridge} from '@/lib/ntuple-server';
import {NextRequest,NextResponse} from 'next/server';
import {nativeAvailable} from '@/lib/ntuple-provider';
import {turnstileConfigured,publicRequest,session} from '@/lib/protection';
export const dynamic='force-dynamic';
export async function GET(req:NextRequest){const remote=publicRequest(req);if(!remote&&!process.env.NTUPLE_SERVICE_URL&&process.platform==='win32')await warmNativeBridge().catch(()=>{});return NextResponse.json({native:nativeAvailable(),ultraLocal:!remote&&!process.env.NTUPLE_SERVICE_URL,configured:!!process.env.TYPESAFE_API_KEY,protected:remote,ready:!!process.env.TYPESAFE_API_KEY,verified:!remote||!turnstileConfigured()||!!session(req)},{headers:{'Cache-Control':'no-store'}});}
