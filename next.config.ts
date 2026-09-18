import type { NextConfig } from 'next';
const config: NextConfig = {poweredByHeader:false,outputFileTracingIncludes:{'/api/decision':['./lib/evidence-worker.mjs','./lib/blind-structure.js','./experiments/tail-risk-metrics.mjs','./public/engine.js']},turbopack:{root:process.cwd()},async headers(){return [{source:'/(.*)',headers:[{key:'X-Content-Type-Options',value:'nosniff'},{key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},{key:'X-Frame-Options',value:'DENY'}]}];}};
export default config;
