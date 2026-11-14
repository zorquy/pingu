// node hoja.mjs salida.png ancho nombre1 nombre2 ...  → una hoja con las capturas (recortadas a alto)
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync } from 'node:fs'
const S = '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad/noche'
const [salida, ancho, alto, ...nombres] = process.argv.slice(2)
const celdas = nombres.map((n) => `<figure><img src="data:image/png;base64,${readFileSync(`${S}/${n}.png`).toString('base64')}"><figcaption>${n}</figcaption></figure>`).join('')
const html = `<style>body{margin:0;background:#fff;display:flex;flex-wrap:wrap;gap:8px;padding:8px;width:${(+ancho + 8) * Math.min(6, nombres.length)}px;font:14px sans-serif}figure{margin:0;width:${ancho}px;height:${+alto + 20}px;overflow:hidden}img{width:${ancho}px;display:block;max-height:${alto}px;object-fit:cover;object-position:top}figcaption{height:20px}</style>${celdas}`
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 400, height: 400 } })
await p.setContent(html); await p.waitForTimeout(300)
await p.screenshot({ path: `${S}/${salida}`, fullPage: true }); await b.close()
