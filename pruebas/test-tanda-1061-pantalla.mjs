// Tanda 1061 — Deseos y cambios más limpio (la propuesta, con lo recomendado):
//   A · corazón y campana de 28 a la vista (44 al dedo); el corazón puesto ya
//       no es un círculo rosa de 44 (`.puesto` le ganaba al dedo) ni se va
//       detrás de la foto (z-index 2);
//   B · «La da / La busca» en una chapa sobre la foto, y todas miden lo mismo;
//   C · «− N de M +» en una línea; D · el precio a la izquierda;
//   E · el número de la carta siempre a la vista; F · el rótulo con su raya.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 280) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const CAPS = process.env.PD_CAPS || ''

const SETS = [{ id: 'sv8', name: 'Chispas Fulgurantes Con Un Nombre Largo De Verdad', serie_id: 'sv', market: 'WEST', release_date: '2024-11-08', card_count_official: 191 }]
const carta = (n, nombre) => ({ id: `sv8-${n}`, market: 'WEST', set_id: 'sv8', local_id: String(n), name: nombre, name_es: nombre, image_path: `x/sv8-${n}`, rarity: 'Common', category: 'Pokemon', variants: { normal: true }, tcg_sets: { id: 'sv8', name: 'Chispas Fulgurantes Con Un Nombre Largo De Verdad', serie_id: 'sv', release_date: '2024-11-08' } })
const CARTAS = [carta(1, 'Exeggcute'), carta(2, 'Exeggutor'), carta(3, 'Pikachu'), carta(4, 'Raichu')]
const PERFILES = [{ id: 'admin-1', username: 'pingu' }, { id: 'user-1', username: 'lucia_tcg', display_name: 'Lucía' }]
const linea = (id, user, card, cantidad, cambio) => ({ id, user_id: user, card_id: card, market: 'WEST', cantidad, cambio, idioma: 'es', estado: 'NM', variante: 'normal', created_at: '2026-10-01T10:00:00Z' })
// Yo doy Exeggcute (1 de 2) y Exeggutor (1 de 1); Lucía da Pikachu y Raichu.
const COLECCION = [linea('m1', 'admin-1', 'sv8-1', 2, 1), linea('m2', 'admin-1', 'sv8-2', 1, 1), linea('o1', 'user-1', 'sv8-3', 1, 1), linea('o2', 'user-1', 'sv8-4', 1, 1)]
// Lucía busca mi Exeggcute.
const DESEOS = [{ id: 'dl', user_id: 'user-1', card_id: 'sv8-1', idioma: null, prioridad: 1, created_at: '2026-10-20T10:00:00Z' }, { id: 'd1', user_id: 'admin-1', card_id: 'sv8-3', idioma: null, prioridad: 1, created_at: '2026-10-20T10:00:00Z' }, { id: 'd2', user_id: 'admin-1', card_id: 'sv8-4', idioma: null, prioridad: 1, created_at: '2026-10-20T10:00:00Z' }]

const browser = await chromium.launch()
async function abrir(ruta, { movil = false, extra = {} } = {}) {
  const ctx = await browser.newContext({ ...(movil ? { ...devices['iPhone 13'] } : { viewport: { width: 1440, height: 900 } }), locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript((d) => Object.assign(window, { __FAKE_SESSION__: 'admin-1', __FAKE_SETS__: d.SETS, __FAKE_CARTAS__: d.CARTAS, __FAKE_COLECCION__: d.COLECCION, __FAKE_PERFILES__: d.PERFILES, __FAKE_DESEOS__: d.DESEOS, __FAKE_PRECIOS__: [] }, d.extra), { SETS, CARTAS, COLECCION, PERFILES, DESEOS, extra })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|jsdelivr|githubusercontent|scrydex/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#5b8fd1"/></svg>' }))
  await ctx.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  return { ctx, page, errores }
}

// Lo que mide el corazón A LA VISTA: el círculo del ::before en el dedo, el
// botón en el ratón; y si el botón entero lleva fondo (el rosa de 44 de antes).
const corazon = (page, sel) => page.$eval(sel, (b) => {
  const r = b.getBoundingClientRect(), cs = getComputedStyle(b), an = getComputedStyle(b, '::before')
  const conAntes = an.content !== 'none' && an.content !== 'normal'
  const visto = conAntes ? r.width - 2 * parseFloat(an.left) : r.width
  const foto = b.closest('.mc-merc').querySelector('.mc-merc-foto')
  const centro = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
  return { caja: Math.round(r.width), visto: Math.round(visto), fondoBoton: cs.backgroundColor, z: cs.zIndex, encima: b.contains(centro) || centro === b, foto: Boolean(foto) }
})
const transparente = (c) => c === 'rgba(0, 0, 0, 0)' || c === 'transparent'

for (const movil of [true, false]) {
  console.log(`── ${movil ? 'Móvil' : 'PC'}: La quiero ──`)
  {
    const { ctx, page, errores } = await abrir('/mi-coleccion.html?ver=quiero', { movil })
    check('sin errores', errores.length === 0, errores.join(' | '))
    const h = await corazon(page, '.mc-deseo-baldosa .mc-merc-corazon')
    check('A: el corazón se ve de 28', h.visto === 28, JSON.stringify(h))
    if (movil) check('  …con 44 al dedo y sin el botón entero de rosa', h.caja === 44 && transparente(h.fondoBoton), JSON.stringify(h))
    check('  …y por encima de la foto', h.encima && h.z === '2', JSON.stringify(h))
    const av = await page.$eval('.mc-deseo-baldosa .mc-quiero-aviso', (b) => { const r = b.getBoundingClientRect(); const s = b.querySelector('svg').getBoundingClientRect(); const cs = getComputedStyle(b.querySelector('svg')); return { caja: Math.round(r.width), visto: Math.round(s.width + (cs.boxSizing === 'content-box' ? 0 : 0)) } })
    check('  …la campana, de 28 (44 al dedo en el móvil)', (movil ? av.caja === 44 && av.visto === 28 : av.caja === 28), JSON.stringify(av))
    // B: «La da 1» en una chapa sobre la foto; las baldosas miden lo mismo.
    const b = await page.evaluate(() => {
      const ts = [...document.querySelectorAll('#mcQuieroRejilla .mc-deseo-baldosa')]
      return ts.map((t) => { const q = t.querySelector('.mc-deseo-quien'); const f = t.querySelector('.mc-merc-foto').getBoundingClientRect(); const r = q?.getBoundingClientRect(); return { id: t.dataset.deseoCarta, alto: Math.round(t.getBoundingClientRect().height), q: q ? { aria: q.getAttribute('aria-label'), texto: q.innerText.replace(/\s+/g, ' ').trim(), sobre: r.left >= f.left && r.right <= f.right && r.bottom <= f.bottom && r.top >= f.top + f.height / 2 } : null } })
    })
    check('B: las dos baldosas que alguien da llevan la chapa sobre la foto, abajo', b.length === 2 && b.every((x) => x.q?.sobre && x.q.aria === 'La da 1 persona'), JSON.stringify(b))
    check(movil ? '  …en el móvil, solo los avatares y la cifra' : '  …en el PC, «La da 1»', b.every((x) => (movil ? /^\S? ?1$/.test(x.q.texto.replace(/^L ?/, '')) : /La da 1/.test(x.q.texto))), JSON.stringify(b.map((x) => x.q.texto)))
    check('  …y todas miden lo mismo', new Set(b.map((x) => x.alto)).size === 1, JSON.stringify(b.map((x) => x.alto)))
    // E: el número siempre a la vista, aunque el nombre del set se corte.
    const e = await page.$eval('.mc-deseo-baldosa .mc-merc-set', (s) => { const n = s.querySelector('.mc-merc-set-n'), num = s.querySelector('.mc-merc-set-num'); return { num: num?.innerText, corta: n.scrollWidth > n.clientWidth, dentro: num.getBoundingClientRect().right <= s.getBoundingClientRect().right + 1 } })
    check('E: «· 3» entero y dentro, con el nombre largo recortado', /·\s*3/.test(e.num) && e.corta && e.dentro, JSON.stringify(e))
    if (CAPS) await page.screenshot({ path: `${CAPS}/1061-quiero-${movil ? 'm' : 'pc'}.png` })
    await ctx.close()
  }
  console.log(`── ${movil ? 'Móvil' : 'PC'}: Las que doy ──`)
  {
    const { ctx, page, errores } = await abrir('/mi-coleccion.html?ver=quiero', { movil })
    await page.click('#mcPanelQuiero [data-deseos-vista="doy"]')
    await page.waitForTimeout(1200)
    check('sin errores', errores.length === 0, errores.join(' | '))
    const p = await page.$eval('[data-doy-linea="m1"]', (t) => {
      const paso = t.querySelector('.mc-doy-paso'), [m, mas] = paso.querySelectorAll('.mc-doy-boton'), c = paso.querySelector('.mc-doy-cuantas')
      const rm = m.getBoundingClientRect(), rc = c.getBoundingClientRect(), rp = mas.getBoundingClientRect()
      const precio = t.querySelector('.mc-quiero-precio').getBoundingClientRect(), fila = t.querySelector('.mc-deseo-precio-fila').getBoundingClientRect()
      const q = t.querySelector('.mc-deseo-quien'), f = t.querySelector('.mc-merc-foto').getBoundingClientRect(), rq = q.getBoundingClientRect()
      return { orden: rm.right <= rc.left && rc.right <= rp.left, linea: Math.abs(rm.top - rp.top) < 2 && Math.abs((rc.top + rc.height / 2) - (rm.top + rm.height / 2)) < 4, texto: c.innerText.trim(), visto: Math.round(rm.width), dedo: Math.round(rm.height - 2 * parseFloat(getComputedStyle(m, '::after').top)), precioIzq: Math.abs(precio.left - fila.left) < 2, chapa: q.getAttribute('aria-label'), sobre: rq.bottom <= f.bottom && rq.top >= f.top }
    })
    check('C: «− N de M +» en una línea', p.orden && p.linea, JSON.stringify(p))
    check(movil ? '  …«1 de 2» en el móvil' : '  …«Doy 1 de 2» en el PC', p.texto === (movil ? '1 de 2' : 'Doy 1 de 2'), p.texto)
    check('  …círculos de 28 y 44 al dedo', p.visto === 28 && p.dedo >= 44, JSON.stringify(p))
    check('D: el precio a la izquierda', p.precioIzq, JSON.stringify(p))
    check('B: «La busca 1» en una chapa sobre la foto', p.chapa === 'La busca 1 persona' && p.sobre, JSON.stringify(p))
    const r = await page.$eval('#mcDoyRejilla', (g) => { const rot = g.querySelector('.mc-catalogo-rotulo'); return rot ? getComputedStyle(rot).borderBottomWidth : 'sin rótulo' })
    check('F: el rótulo del catálogo con su raya (si hay dos catálogos)', r === 'sin rótulo' || r === '1px', r)
    check('sin irse de ancho', await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth <= 1))
    if (CAPS) await page.screenshot({ path: `${CAPS}/1061-doy-${movil ? 'm' : 'pc'}.png` })
    await ctx.close()
  }
  console.log(`── ${movil ? 'Móvil' : 'PC'}: Mercado ──`)
  {
    const { ctx, page, errores } = await abrir('/mi-coleccion.html?ver=mercado', { movil })
    check('sin errores', errores.length === 0, errores.join(' | '))
    const h = await corazon(page, '#mcMercadoRejilla .mc-merc-corazon.puesto')
    check('A: el corazón puesto se ve de 28, no un círculo rosa de 44', h.visto === 28 && (!movil || transparente(h.fondoBoton)), JSON.stringify(h))
    const h2 = await corazon(page, '#mcMercadoRejilla .mc-merc-corazon:not(.puesto)').catch(() => null)
    if (h2) check('  …y el que no está puesto, igual', h2.visto === 28 && h2.encima, JSON.stringify(h2))
    await ctx.close()
  }
}

await browser.close()
console.log(fails ? `❌ ${fails} FALLAN` : '✅ TODO BIEN')
process.exit(fails ? 1 : 0)
