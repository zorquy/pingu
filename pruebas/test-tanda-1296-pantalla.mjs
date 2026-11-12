// Tanda 1296 — las fotos del perfil que salían ROTAS (PINGU: «en cartas salen
// como rotas las imágenes y en la vitrina también, pero en la colección no»):
// el Resumen y la losa de «Cartas» copiaban la foto de la vitrina antes de que
// su cadena de respaldo saltara, y se quedaban con la rota. Ahora se llevan la
// cadena y saltan igual. Aquí la primera dirección (TCGdex) no contesta y la
// segunda sí: las tres pantallas acaban en la segunda y se ven.
// Y la losa de una colección PRIVADA dice «colección privada» con «—», no «0»
// (la RLS devuelve una lista vacía, no un error: el 0 era mentira).
import { chromium, contexto, BASE } from './fixtures-app.mjs'

let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')
const b = await chromium.launch()

async function abrir(ruta, movil, extra = '') {
  const ctx = await contexto(b, movil, 'user-1')
  await ctx.route(/assets\.tcgdex\.net/, (r) => r.fulfill({ status: 404, body: '' }))
  await ctx.route(/limitlesstcg|pokemontcg\.io/, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }))
  if (extra) await ctx.addInitScript(extra)
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3500)
  return { ctx, page, errores }
}
const fotos = (page, sel) => page.$$eval(sel, (is) => is.map((i) => ({ src: i.currentSrc || i.src, bien: i.complete && i.naturalWidth > 0, vis: getComputedStyle(i).visibility })))

for (const movil of [false, true]) {
  console.log(`── Tu perfil, ${movil ? 'móvil' : 'PC'}: TCGdex no contesta ──`)
  const { ctx, page, errores } = await abrir('/perfil.html', movil)
  // El Resumen está abierto y la vitrina NO (su pestaña está escondida y sus
  // fotos «lazy» ni se han pedido): por eso la copia se llevaba la primera
  // dirección sin saber todavía que no contesta.
  const res = await fotos(page, '.pr-vitrina img')
  const losa = await fotos(page, '[data-losa="cartas"] .perfil-losa-abanico img')
  const sanas = (l) => l.length > 0 && l.every((f) => f.bien && f.vis !== 'hidden' && !/tcgdex/.test(f.src))
  check('el Resumen: ninguna rota (salta a la segunda de su cadena)', sanas(res), JSON.stringify(res.slice(0, 2)))
  check('la losa de «Cartas» también: tres, ninguna rota', losa.length === 3 && sanas(losa), JSON.stringify(losa))
  await page.click('[data-ptab="vitrina"]')
  await page.waitForTimeout(1200)
  const vit = await fotos(page, '#perfilVitrina img')
  check('la vitrina (Colección), al abrirla, salta igual', sanas(vit), JSON.stringify(vit.slice(0, 2)))
  check('  …y el Resumen enseña las mismas cartas que ella (hasta 8)', res.length >= 1 && res.length <= 8 && res.every((f, i) => f.src === vit[i]?.src), `${res.length}`)
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('── Una foto sin ninguna dirección que conteste: hueco, no icono roto ──')
{
  const ctx = await contexto(b, false, 'user-1')
  await ctx.route(/assets\.tcgdex\.net|limitlesstcg|pokemontcg\.io/, (r) => r.fulfill({ status: 404, body: '' }))
  const page = await ctx.newPage()
  await page.goto(`${BASE}/perfil.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3500)
  const res = await fotos(page, '.pr-vitrina img, [data-losa="cartas"] .perfil-losa-abanico img')
  check('las que no cargan por ningún lado se esconden', res.length > 0 && res.every((f) => f.vis === 'hidden' || f.bien), JSON.stringify(res.filter((f) => f.vis !== 'hidden' && !f.bien)))
  await ctx.close()
}

console.log('── Colección privada de otra persona ──')
{
  const { ctx, page, errores } = await abrir('/usuario/Misty', false, `window.__FAKE_PERFILES__ = [{ id: 'user-2', coleccion_publica: false }]`)
  const t = await page.locator('[data-losa="cartas"]').innerText().then((s) => s.replace(/\s+/g, ' ').trim()).catch(() => '')
  check('la losa dice «—» y «colección privada», no «0»', /—/.test(t) && /colección privada/i.test(t) && !/\b0\b/.test(t), t)
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}
console.log('── Colección pública de otra persona: la cifra de siempre ──')
{
  const { ctx, page } = await abrir('/usuario/Misty', false)
  const t = await page.locator('[data-losa="cartas"]').innerText().then((s) => s.replace(/\s+/g, ' ').trim()).catch(() => '')
  check('sin «colección privada»', !/privada/i.test(t), t)
  await ctx.close()
}
await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
