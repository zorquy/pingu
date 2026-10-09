// Tanda 784 — bloque 5 de «PokeDoc al detalle»: MV3 la carta vuela, MV4 el
// set completo con confeti del logo, MV5 la píldora que se desliza, MV9 el
// latido de «La quiero» y del guardar.
import { readFileSync } from 'node:fs'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 240) : ''}`)
}
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const leer = (f) => readFileSync(`${RAIZ}/${f}`, 'utf8')

console.log('── 1. Estático ──')
const ens = leer('js/mi-coleccion/ensenar.js')
check('MV3: al añadir, la carta vuela a la pestaña del Panel (una por lote)', /volarCarta\(img, destino\)/.test(ens) && /ahora - ultimoVuelo > 900/.test(ens))
check('MV4: el set completo tira confeti con los colores del logo y ofrece compartir', /coloresDeLogo\(logo\)/.test(ens) && /data-compartir-completo/.test(ens) && /compartirChecklist/.test(leer('js/mi-coleccion.js')))
check('  …y el confeti respeta «menos movimiento»', /export function burstConfetti\(count = 28, colores = CONFETTI_COLORS\) \{\s*if \(window\.matchMedia\('\(prefers-reduced-motion: reduce\)'\)\.matches\) return/.test(leer('js/app.js')))
check('MV5: la píldora se vigila desde la barra', /vigilarPildoras\(\)/.test(leer('js/app.js')))
check('MV9: «La quiero» late al ponerse', /latir\(boton\)/.test(leer('js/la-quiero.js')))
check('  …y el guardar de una guía también', /latir\(saveBtn\)/.test(leer('js/guide-card.js')) && /latir\(btn\)/.test(leer('js/guia.js')))
// Desde la 787 el botón es solo el icono: el estado lo dicen el dibujo y su aria-label.
check('el botón de guardar de la guía dice cómo QUEDA (estaba al revés)', /btn\.innerHTML = !isSaved \? icons\.bookmark\(16, true\)/.test(leer('js/guia.js')) && /'Guardada · quitar de guardados'/.test(leer('js/guia.js')))

console.log('── 2. Puro ──')
const { coloresDePixeles } = await import(`${RAIZ}/js/efectos.js`)
const px = []
for (let i = 0; i < 30; i++) px.push(200, 30, 30, 255)
for (let i = 0; i < 10; i++) px.push(30, 30, 200, 255)
for (let i = 0; i < 50; i++) px.push(255, 255, 255, 255)
for (let i = 0; i < 50; i++) px.push(0, 0, 0, 0)
const col = coloresDePixeles(new Uint8ClampedArray(px), 3)
check('los colores del logo: el más repetido primero, sin blanco ni transparente', col?.length === 2 && col[0] === 'rgb(200, 30, 30)' && col[1] === 'rgb(30, 30, 200)', JSON.stringify(col))
check('  …y un logo sin color no inventa ninguno', coloresDePixeles(new Uint8ClampedArray([255, 255, 255, 255]), 3) === null)

console.log('── 3. En el navegador ──')
const b = await chromium.launch()
{
  const p = await b.newPage()
  await p.goto(`${BASE}/torneos.html`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(1500)
  const r = await p.evaluate(async () => {
    const seg = document.createElement('div'); seg.className = 'seg'
    seg.innerHTML = '<button class="seg-btn" aria-pressed="true">Uno</button><button class="seg-btn" aria-pressed="false">Dos largo</button>'
    document.body.appendChild(seg)
    await new Promise((r) => setTimeout(r, 300))
    const pil = seg.querySelector('.pildora')
    const [a, bb] = seg.querySelectorAll('.seg-btn')
    const antes = pil && { ancho: Math.round(pil.getBoundingClientRect().width), x: Math.round(pil.getBoundingClientRect().left - a.getBoundingClientRect().left) }
    a.setAttribute('aria-pressed', 'false'); bb.setAttribute('aria-pressed', 'true')
    await new Promise((r) => setTimeout(r, 50))
    const enViaje = getComputedStyle(bb).backgroundColor
    await new Promise((r) => setTimeout(r, 500))
    const rb = bb.getBoundingClientRect(), rp = pil.getBoundingClientRect()
    return { hay: !!pil, antes, anchoUno: Math.round(a.getBoundingClientRect().width), despues: { ancho: Math.round(rp.width), x: Math.round(rp.left - rb.left) }, anchoDos: Math.round(rb.width), enViaje, fondoActiva: getComputedStyle(bb).backgroundColor, transicion: getComputedStyle(pil).transitionProperty }
  })
  check('MV5: el control de pastillas lleva su píldora, debajo de la activa', r.hay && r.antes.x === 0 && r.antes.ancho === r.anchoUno, JSON.stringify(r))
  check('  …que se desliza hasta la nueva y toma su ancho', r.despues.x === 0 && r.despues.ancho === r.anchoDos && /transform/.test(r.transicion), JSON.stringify(r))
  check('  …la activa suelta su fondo mientras la píldora viaja', r.enViaje === 'rgba(0, 0, 0, 0)', r.enViaje)
  check('  …y lo recupera al llegar (en reposo se lee igual que sin píldora)', r.fondoActiva !== 'rgba(0, 0, 0, 0)', r.fondoActiva)
  const l = await p.evaluate(async () => {
    const { latir } = await import('/js/efectos.js')
    const btn = document.createElement('button'); btn.textContent = '♥'; document.body.appendChild(btn)
    latir(btn)
    const chispas = document.querySelectorAll('.chispa').length, late = btn.classList.contains('latiendo')
    await new Promise((r) => setTimeout(r, 900))
    return { chispas, late, quedan: document.querySelectorAll('.chispa').length, sigue: btn.classList.contains('latiendo') }
  })
  check('MV9: late y suelta seis chispas', l.late && l.chispas === 6, JSON.stringify(l))
  check('  …y se recogen solas', l.quedan === 0 && !l.sigue, JSON.stringify(l))
  const v = await p.evaluate(async () => {
    const { volarCarta } = await import('/js/efectos.js')
    const img = document.createElement('img'); img.width = 60; img.height = 84; img.style.cssText = 'position:fixed;left:20px;top:300px;width:60px;height:84px;background:#888'
    const dest = document.createElement('button'); dest.textContent = 'Panel'; dest.style.cssText = 'position:fixed;left:300px;top:20px'
    document.body.append(img, dest)
    const sale = volarCarta(img, dest)
    const enVuelo = document.querySelectorAll('.vuelo-carta').length
    await new Promise((r) => setTimeout(r, 700))
    return { sale, enVuelo, quedan: document.querySelectorAll('.vuelo-carta').length, bota: dest.classList.contains('bota') }
  })
  check('MV3: la copia vuela y el destino bota', v.sale && v.enVuelo === 1 && v.quedan === 0 && v.bota, JSON.stringify(v))
  await p.close()
}
{
  const p = await b.newPage({ reducedMotion: 'reduce' })
  await p.goto(`${BASE}/torneos.html`, { waitUntil: 'domcontentloaded' })
  const r = await p.evaluate(async () => {
    const { volarCarta, latir } = await import('/js/efectos.js')
    const img = document.createElement('img'); img.style.cssText = 'width:60px;height:84px;display:block'
    const btn = document.createElement('button'); document.body.append(img, btn)
    const vuela = volarCarta(img, btn); latir(btn)
    const { burstConfetti } = await import('/js/app.js'); burstConfetti(10)
    return { vuela, chispas: document.querySelectorAll('.chispa').length, confeti: document.querySelectorAll('.confetti-piece').length }
  })
  check('con «menos movimiento»: ni vuelo, ni chispas, ni confeti', r.vuela === false && r.chispas === 0 && r.confeti === 0, JSON.stringify(r))
  await p.close()
}
await b.close()

console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
