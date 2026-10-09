// Tanda 783 — bloque 4 de «PokeDoc al detalle»: MV1 la carta que se mueve
// también con el dedo, MV2 las cifras que cuentan y MV10 anillos y llama.
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
const holo = leer('js/carta-holo.js'), holoCss = leer('css/carta-holo.css')
check('MV1: hasta 12°', /const GRADOS = 12/.test(holo))
check('  …también con el dedo (sin el corte de «solo ratón»)', !/pointer: fine/.test(holo) && /pointercancel/.test(holo))
check('  …el gesto es de la carta en la ficha grande', /\.carta-scan-holo\.holo \{[^}]*touch-action: none/.test(holoCss))
check('  …vuelve con rebote', /cubic-bezier\(0\.34, 1\.56/.test(holoCss))
check('  …y el reverse con su lámina en todo el marco', /data-impresion='reverse'\]\.holo::before/.test(holoCss) && /data-impresion="reverse"/.test(leer('js/mi-coleccion.js')))
check('  …y en la rejilla sigue siendo solo con ratón', /e\.pointerType === 'touch' \|\| !caja \|\| caja\.dataset\.holoPuesto/.test(leer('js/mi-coleccion.js')))
check('MV2: «Hoy» y el Panel cuentan la cifra', /contarCifra\(cifra, 'valor'/.test(leer('js/hoy.js')) && /contarCifra\(cifraPanel, 'valor'/.test(leer('js/mi-coleccion.js')))
check('MV10: la llama viva desde 3 y con destello al renovar', /racha >= 3\) chip\.classList\.add\('viva'\)/.test(leer('js/app.js')) && /\.nav-racha\.renovada svg/.test(leer('css/components.css')))

console.log('── 2. En el navegador ──')
const b = await chromium.launch()
{
  const p = await b.newPage()
  await p.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' })
  const r = await p.evaluate(async () => {
    const { contarCifra } = await import('/js/contar.js')
    const f = (n) => `${Math.round(n)} €`
    const el = document.createElement('b'); document.body.appendChild(el)
    localStorage.removeItem('pd-cifra-prueba')
    const primera = contarCifra(el, 'prueba', 100, f)
    const textoPrimera = el.textContent
    const ayer = new Date(Date.now() - 864e5).toISOString().slice(0, 10)
    localStorage.setItem('pd-cifra-prueba', JSON.stringify({ dia: ayer, valor: 500 }))
    const segunda = contarCifra(el, 'prueba', 100, f)
    const alEmpezar = el.textContent
    await new Promise((r) => setTimeout(r, 1000))
    const alAcabar = el.textContent
    const tercera = contarCifra(el, 'prueba', 120, f)
    return { primera, textoPrimera, segunda, alEmpezar, alAcabar, tercera, textoTercera: el.textContent }
  })
  check('la primera vez de todas no cuenta (no hay de dónde)', r.primera === false && r.textoPrimera === '100 €', JSON.stringify(r))
  check('  …otro día cuenta desde la de ayer, también hacia abajo', r.segunda === true && r.alEmpezar === '500 €' && r.alAcabar === '100 €', JSON.stringify(r))
  check('  …y el mismo día ya no vuelve a contar', r.tercera === false && r.textoTercera === '120 €', JSON.stringify(r))
  await p.close()
}
{
  const p = await b.newPage({ reducedMotion: 'reduce' })
  await p.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' })
  const r = await p.evaluate(async () => {
    const { contarCifra } = await import('/js/contar.js')
    const el = document.createElement('b')
    localStorage.setItem('pd-cifra-q', JSON.stringify({ dia: '2000-01-01', valor: 5 }))
    return { cuenta: contarCifra(el, 'q', 9, String), texto: el.textContent }
  })
  check('con «menos movimiento», la cifra sin cuenta', r.cuenta === false && r.texto === '9', JSON.stringify(r))
  await p.close()
}
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } })
  await ctx.addInitScript(() => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_SETS__ = ['xy5', 'xy6'].map((id, i) => ({ id, name: `Set ${i}`, serie_id: 'xy', market: 'WEST', release_date: `2015-0${i + 2}-04`, card_count_official: 4, card_count_total: 4 }))
    const carta = (set, n) => ({ id: `${set}-${n}`, market: 'WEST', set_id: set, local_id: String(n), name: `C ${n}`, name_es: `C ${n}`, image_path: `x/${set}/${n}`, rarity: 'Common', category: 'Pokemon', dex_ids: [n], tcg_sets: { id: set, name: set, serie_id: 'xy' } })
    window.__FAKE_CARTAS__ = [1, 2, 3, 4].flatMap((n) => [carta('xy5', n), carta('xy6', n)])
    window.__FAKE_COLECCION__ = [1, 2].map((n) => ({ id: `a${n}`, card_id: `xy5-${n}`, market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', created_at: '2026-10-01T10:00:00Z' }))
      .concat([{ id: 'b1', card_id: 'xy6-1', market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', created_at: '2026-10-01T10:00:00Z' }])
  })
  await ctx.route(/assets\.tcgdex\.net|api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const p = await ctx.newPage()
  await p.goto(`${BASE}/mi-coleccion.html?ver=album`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(3000)
  const a = await p.evaluate(() => {
    const todos = [...document.querySelectorAll('.mc-set-anillo, .mc-anillo')]
    return { n: todos.length, marcados: todos.filter((x) => x.classList.contains('por-llenar')).length, llenando: todos.filter((x) => x.classList.contains('llenando')).length }
  })
  check('MV10: los anillos de Expansiones se marcan para llenarse', a.n > 0 && a.marcados === a.n, JSON.stringify(a))
  check('  …y los que se ven, se llenan', a.llenando > 0, JSON.stringify(a))
  await ctx.close()
}
await b.close()

console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
