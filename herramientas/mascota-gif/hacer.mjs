import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import gifenc from 'gifenc'
import { PNG } from 'pngjs'
import { writeFileSync } from 'node:fs'
const { GIFEncoder, quantize, applyPalette } = gifenc
const [, , gesto = 'saludar', out = 'mascota.gif', fondo = '#ffffff', segundos = '2.4'] = process.argv
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] })
const p = await b.newPage({ viewport: { width: 240, height: 280 }, deviceScaleFactor: 1 })
p.on('pageerror', (e) => console.log('ERR', e.message))
await p.addInitScript((f) => { document.addEventListener('DOMContentLoaded', () => { document.body.style.background = f === 'none' ? 'transparent' : f }) }, fondo)
await p.goto(`http://localhost:8892/mascota-gif.html?g=${gesto}`)
await p.waitForSelector('.mascota-lista', { timeout: 20000 }).catch(() => console.log('sin mascota-lista'))
const el = await p.$('#h')
const frames = []
const n = Math.round(Number(segundos) * 12.5)
for (let i = 0; i < n; i++) {
  frames.push(await el.screenshot({ type: 'png', omitBackground: fondo === 'none' }))
  await p.waitForTimeout(40)
}
writeFileSync(out.replace('.gif', '-medio.png'), frames[Math.floor(frames.length / 2)])
await b.close()
const enc = GIFEncoder()
for (const buf of frames) {
  const png = PNG.sync.read(buf)
  if (fondo === 'none') {
    const pal = quantize(png.data, 128, { format: 'rgba4444', oneBitAlpha: true })
    const idx = applyPalette(png.data, pal, 'rgba4444')
    const t = pal.findIndex((c) => c[3] === 0)
    enc.writeFrame(idx, png.width, png.height, { palette: pal, delay: 80, transparent: t >= 0, transparentIndex: Math.max(0, t), dispose: 2 })
  } else {
    const pal = quantize(png.data, 128)
    enc.writeFrame(applyPalette(png.data, pal), png.width, png.height, { palette: pal, delay: 80 })
  }
}
enc.finish()
writeFileSync(out, enc.bytes())
console.log(out, frames.length, enc.bytes().length)
