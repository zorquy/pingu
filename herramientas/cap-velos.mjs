import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
const SC='/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad'
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1160,height:900},deviceScaleFactor:2})
await p.goto('file://'+SC+'/velos.html',{waitUntil:'networkidle'})
await p.screenshot({path:SC+'/velos-315.png',fullPage:true}); await b.close(); console.log('ok')
