// Tanda 754 — escanear desde las fotos de la galería (K5).
//
// Lo que se mira: que el escáner lleva «Desde tus fotos» y que funciona
// SIN cámara (la de pruebas no tiene, como un portátil sin ella); que con
// dos fotos se leen las dos —cada una sus dos franjas, como un disparo— y
// salen en la bandeja con su «+»; que el «+» la añade; que una foto donde
// no se reconoce nada lo dice; y la cuenta pura de dónde está la carta en
// una foto.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'

console.log('── 1. Dónde está la carta en una foto ──')
{
  const { marcoEnLaFoto } = await import(`${RAIZ}/js/mi-coleccion/escaner.js`)
  const vertical = marcoEnLaFoto(3000, 4000)
  const justa = marcoEnLaFoto(630, 880)
  const apaisada = marcoEnLaFoto(4000, 3000)
  check('una foto vertical: la carta a todo lo alto y centrada', Math.round(vertical.alto) === 4000 && Math.round(vertical.x) === 68 && Math.abs(vertical.y) < 1, JSON.stringify(vertical))
  check('  …un escaneo de la carta: la foto entera', justa.x === 0 && justa.y === 0 && justa.ancho === 630 && Math.round(justa.alto) === 880)
  check('  …una apaisada: centrada a lo ancho', Math.round(apaisada.alto) === 3000 && Math.round(apaisada.x) === Math.round((4000 - 3000 * 63 / 88) / 2))
  check('  …y sin medidas, nada', marcoEnLaFoto(0, 10) === null)
}

const browser = await chromium.launch()
const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'es-ES' })
await ctx.addInitScript(() => {
  window.__FAKE_SESSION__ = 'admin-1'
  window.__FAKE_SETS__ = [{ id: 'sv3', name: 'Llamas Obsidianas', serie_id: 'sv', market: 'WEST', card_count_official: 230 }]
  window.__FAKE_CARTAS__ = [
    { id: 'sv3-125', market: 'WEST', set_id: 'sv3', local_id: '125', name: 'Charizard ex', name_es: 'Charizard ex', image_path: 'x/125', variants: { normal: true } },
    { id: 'sv3-26', market: 'WEST', set_id: 'sv3', local_id: '26', name: 'Pidgeot ex', name_es: 'Pidgeot ex', image_path: 'x/26', variants: { normal: true } },
  ]
  window.__FAKE_COLECCION__ = []
})
// El OCR del servidor: lee lo que diga la foto (va en el ancho de la franja,
// que es lo único que cambia entre las tres de mentira).
let lecturas = 0
await ctx.route(/\/\.netlify\/functions\/leer-carta/, async (r) => {
  lecturas++
  const cuerpo = JSON.parse(r.request().postData() || '{}')
  const ok = cuerpo.nombre?.startsWith('data:image/jpeg') && cuerpo.codigo?.startsWith('data:image/jpeg')
  const textos = !ok ? null : lecturas === 1 ? { nombre: 'BÁSICO Charizard ex PV330', codigo: '125/197' } : lecturas === 2 ? { nombre: 'FASE 2 Pidgeot ex PV280', codigo: '26/197' } : { nombre: '', codigo: '' }
  return r.fulfill({ status: ok ? 200 : 400, contentType: 'application/json', body: JSON.stringify(ok ? { textos } : { error: 'sin franjas' }) })
})
await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"></svg>' }))
await ctx.route(/r2\.limitlesstcg\.net|api\.tcgdex\.net/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
const page = await ctx.newPage()
const errores = []
page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
await page.goto(`${BASE}/mi-coleccion.html?ver=buscar&escanear=1`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(3000)
// Tres «fotos» de verdad (PNG): una carta en vertical, otra, y una tercera
// en la que el OCR no lee nada.
const foto = async (color) => Buffer.from((await page.evaluate((c) => { const l = document.createElement('canvas'); l.width = 600; l.height = 840; const x = l.getContext('2d'); x.fillStyle = c; x.fillRect(0, 0, 600, 840); return l.toDataURL('image/png') }, color)).split(',')[1], 'base64')

console.log('── 2. Desde tus fotos, sin cámara ──')
{
  const m = await page.evaluate(() => ({ abierto: document.getElementById('mcEscanerCaja')?.open, fotos: !!document.getElementById('mcEscanerFotos') && !document.getElementById('mcEscanerFotos').disabled, disparo: document.getElementById('mcEscanerDisparo')?.disabled, ayuda: document.getElementById('mcEscanerAyuda')?.textContent }))
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('sin cámara, el disparo se apaga pero «Desde tus fotos» sigue', m.abierto && m.fotos && m.disparo, JSON.stringify(m))
  await page.setInputFiles('#mcEscanerFicheros', [
    { name: 'charizard.png', mimeType: 'image/png', buffer: await foto('#d4471c') },
    { name: 'pidgeot.png', mimeType: 'image/png', buffer: await foto('#2f7fc1') },
    { name: 'borrosa.png', mimeType: 'image/png', buffer: await foto('#777777') },
  ])
  await page.waitForTimeout(3500)
  const b = await page.evaluate(() => ({ visible: !document.getElementById('mcEscanerBandeja').classList.contains('hidden'), cartas: [...document.querySelectorAll('#mcEscanerCandidatas [data-carta]')].map((x) => x.dataset.carta), ayuda: document.getElementById('mcEscanerAyuda').textContent }))
  check('las tres fotos se leen, cada una con sus dos franjas', lecturas === 3, String(lecturas))
  check('  …y las dos con carta salen en la bandeja, cada una con su «+»', b.visible && JSON.stringify(b.cartas) === '["sv3-125","sv3-26"]' && (await page.locator('#mcEscanerCandidatas [data-escaner-anadir]').count()) === 2, JSON.stringify(b))
  check('  …diciendo cuántas y que en una no se reconoció', /^2 de 3 fotos con su carta · en 1 no la he reconocido/.test(b.ayuda), b.ayuda)
  await page.click('#mcEscanerCandidatas [data-escaner-anadir="sv3-125"]')
  await page.waitForTimeout(900)
  const lineas = await page.evaluate(async () => { const { supabase } = await import('/js/supabase.js'); const { data } = await supabase.from('user_collection').select('card_id,cantidad'); return data || [] })
  check('el «+» la añade a tu colección', lineas.some((l) => l.card_id === 'sv3-125' && l.cantidad === 1), JSON.stringify(lineas))
}
await ctx.close()
await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
