import type {Metadata} from 'next';
import localFont from 'next/font/local';
import './globals.css';
import './study.css';
const dmSans=localFont({src:'../node_modules/@fontsource-variable/dm-sans/files/dm-sans-latin-wght-normal.woff2',display:'swap',variable:'--font-arcade'});
export const metadata:Metadata={title:'Jev 2048',description:'Play 2048 against Jev or compare bots. Read the methods and recorded results.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en" className={dmSans.variable}><body>{children}</body></html>;}
