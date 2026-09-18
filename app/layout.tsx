import type {Metadata} from 'next';
import localFont from 'next/font/local';
import './globals.css';
const dmSans=localFont({src:'../node_modules/@fontsource-variable/dm-sans/files/dm-sans-latin-wght-normal.woff2',display:'swap',variable:'--font-arcade'});
export const metadata:Metadata={title:'Jev Arcade | A little game of judgment',description:'Play 2048 against Jev, or watch a model face a fixed heuristic. Real choices. Same starting line.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en" className={dmSans.variable}><body>{children}</body></html>;}
