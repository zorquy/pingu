import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync } from 'node:fs'
const SC = '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad'
const pares = process.argv.slice(3)
const salida = process.argv[2]
const b64 = (p) => 'data:image/png;base64,' + readFileSync(p).toString('base64')
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1300, height: 800 } })
const html = pares.map((n) => `
  <div style="margin-bottom:30px">
    <div style="font:700 16px system-ui;margin-bottom:8px;color:#111">${n}</div>
    <div style="display:flex;gap:14px">
      <figure style="margin:0;flex:1"><figcaption style="font:700 11px system-ui;color:#999;letter-spacing:.08em;margin-bottom:5px">ANTES</figcaption><img src="${b64(`${SC}/antes/${n}.png`)}" style="width:100%;border:1px solid #ddd;border-radius:6px"></figure>
      <figure style="margin:0;flex:1"><figcaption style="font:700 11px system-ui;color:#2a7;letter-spacing:.08em;margin-bottom:5px">DESPUÉS</figcaption><img src="${b64(`${SC}/despues/${n}.png`)}" style="width:100%;border:1px solid #ddd;border-radius:6px"></figure>
    </div>
  </div>`).join('')
await p.setContent(`<body style="margin:18px;background:#fff">${html}</body>`)
await p.waitForTimeout(900)
await p.screenshot({ path: `${SC}/${salida}`, fullPage: true })
await b.close()
console.log(salida)
