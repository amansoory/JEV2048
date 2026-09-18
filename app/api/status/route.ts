import {NextRequest,NextResponse} from 'next/server';
import {configured,publicRequest,session} from '@/lib/protection';
export const dynamic='force-dynamic';
export function GET(req:NextRequest){const remote=publicRequest(req);return NextResponse.json({configured:!!process.env.TYPESAFE_API_KEY,protected:remote,ready:!!process.env.TYPESAFE_API_KEY&&(!remote||configured()),verified:!remote||!!session(req)},{headers:{'Cache-Control':'no-store'}});}
