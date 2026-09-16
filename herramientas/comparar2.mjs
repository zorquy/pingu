import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync } from 'node:fs'
const SC = '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad'
const salida = process.argv[2]
const pares = process.argv.slice(3)   // etiqueta:Titulo largo
const b64 = (p) => 'data:image/png;base64,' + readFileSync(p).toString('base64')
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1340, height: 900 } })
const html = pares.map((spec) => {
  const [n, ...rest] = spec.split(':')
  const titulo = rest.join(':') || n
  return `
  <div style="margin-bottom:34px">
    <div style="font:800 17px system-ui;margin-bottom:10px;color:#0d1b2a">${titulo}</div>
    <div style="display:flex;gap:14px">
      <figure style="margin:0;flex:1"><figcaption style="font:700 11px system-ui;color:#999;letter-spacing:.08em;margin-bottom:5px">AHORA</figcaption><img src="${b64(`${SC}/prop-antes/${n}.png`)}" style="width:100%;border:1px solid #ddd;border-radius:6px"></figure>
      <figure style="margin:0;flex:1"><figcaption style="font:700 11px system-ui;color:#2a7;letter-spacing:.08em;margin-bottom:5px">PROPUESTA</figcaption><img src="${b64(`${SC}/prop-despues/${n}.png`)}" style="width:100%;border:1px solid #ddd;border-radius:6px"></figure>
    </div>
  </div>`
}).join('')
await p.setContent(`<body style="margin:20px;background:#fff">${html}</body>`)
await p.waitForTimeout(900)
await p.screenshot({ path: `${SC}/${salida}`, fullPage: true })
await b.close()
console.log(salida)
