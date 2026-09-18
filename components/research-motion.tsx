'use client';
import {useEffect} from 'react';

export default function ResearchMotion(){
 useEffect(()=>{
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const observer=new IntersectionObserver(entries=>{
   for(const entry of entries)if(entry.isIntersecting){
    entry.target.animate([{opacity:.45,transform:'translateY(18px)'},{opacity:1,transform:'translateY(0)'}],{duration:550,easing:'cubic-bezier(.2,.7,.2,1)'});
    observer.unobserve(entry.target);
   }
  },{threshold:.08});
  document.querySelectorAll('.research-section,.research-panel,.timeline li').forEach(el=>observer.observe(el));
  return ()=>observer.disconnect();
 },[]);
 return null;
}
