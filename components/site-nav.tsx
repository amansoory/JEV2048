import Link from 'next/link';
import {ArrowUpRight,Grid2X2} from 'lucide-react';
import {Button} from './ui/button';
export default function SiteNav({active}:{active:'play'|'research'}){return <header className="study-nav"><Link className="study-brand" href="/play"><Grid2X2 size={22}/><span><b>Jev 2048</b></span></Link><nav aria-label="Main navigation"><Link href="/play" aria-current={active==='play'?'page':undefined}>Play</Link><Link href="/research" aria-current={active==='research'?'page':undefined}>Research</Link></nav><Button asChild variant="ghost" size="sm"><a href="https://armanhassan.com">Check out my other work <ArrowUpRight size={15}/></a></Button></header>;}
