// Tanda 1042 — Deseos y cambios y el Modo evento, otra vuelta (PINGU:
// «hazlo con lo recomendado» de la propuesta). (A) las acciones de La
// quiero y Las que doy en UN grupo unido; (B) los desplegables del Mercado
// como chapas «Idioma · Todos» que se rellenan al cambiar; (C) los cruces
// por bandas —perfectos en tarjeta con su balanza, el resto en filas— y
// «Escribir» y «Su perfil» en iconos; (D) el Modo evento con el pase, el QR
// en grande, las acciones arriba, el buscador y los filtros, y dos columnas
// en el PC. Los datos de los cruces son los de la 772.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 280) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'

const SETS = [
  { id: 'swsh7', name: 'Cielos Evolutivos', serie_id: 'swsh', market: 'WEST', release_date: '2021-08-27', card_count_official: 203 },
  { id: 'sv3pt5', name: '151', serie_id: 'sv', market: 'WEST', release_date: '2023-09-22', card_count_official: 165, tcg_online_code: 'MEW' },
  { id: 'sv8', name: 'Chispas Fulgurantes', serie_id: 'sv', market: 'WEST', release_date: '2024-11-08', card_count_official: 191 },
  { id: 'sv2', name: 'Evoluciones en Paldea', serie_id: 'sv', market: 'WEST', release_date: '2023-06-09', card_count_official: 193 },
  { id: 'SV2a', name: 'ポケモンカード151', name_en: 'Pokémon Card 151', serie_id: 'sv', market: 'JP', release_date: '2023-06-16', card_count_official: 165 },
]
const setDe = (id) => SETS.find((s) => s.id === id)
const carta = (id, set, n, nombre, extra = {}) => ({ id, market: setDe(set).market, set_id: set, local_id: String(n), name: nombre, name_es: nombre, image_path: `x/${id}`, rarity: 'Rare', category: 'Pokemon', variants: { normal: true }, tcg_sets: { id: set, name: setDe(set).name, serie_id: setDe(set).serie_id, release_date: setDe(set).release_date }, ...extra })
const CARTAS = [carta('swsh7-215', 'swsh7', 215, 'Umbreon VMAX'), carta('sv3pt5-199', 'sv3pt5', 199, 'Charizard ex'), carta('sv8-238', 'sv8', 238, 'Pikachu ex'), carta('sv2-269', 'sv2', 269, 'Iono'), carta('sv3pt5-151', 'sv3pt5', 151, 'Mew ex'), carta('swsh7-1', 'swsh7', 1, 'Mew'), carta('SV2a-201', 'SV2a', 201, 'リザードン', { name_en: 'Charizard' })]
const U = (n) => `user-${n}`
const PERFILES = [{ id: 'admin-1', username: 'pingu' }, { id: U(1), username: 'lucia_tcg', display_name: 'Lucía' }, { id: U(2), username: 'danipoke', display_name: 'Dani' }, { id: U(3), username: 'marta.jp', display_name: 'Marta' }, { id: U(4), username: 'iker_ex', display_name: 'Íker' }, { id: U(5), username: 'malo', is_banned: true }]
const hace = (h) => new Date(Date.now() - h * 3600e3).toISOString()
const linea = (id, user, card, idioma, cambio, h, o = {}) => ({ id, user_id: user, card_id: card, market: card.startsWith('SV2a') ? 'JP' : 'WEST', cantidad: Math.max(1, cambio), cambio, idioma, estado: 'NM', variante: 'normal', created_at: '2026-10-01T10:00:00Z', updated_at: hace(h), ...o })
// Yo (admin-1) doy Mew ex; Lucía busca Mew ex, así que con ella hay cruce.
const COLECCION = [
  linea('m1', 'admin-1', 'sv3pt5-151', 'es', 1, 1),
  linea('o1', U(1), 'swsh7-215', 'es', 1, 2), linea('o2', U(4), 'swsh7-215', 'en', 1, 3), linea('o3', U(2), 'sv3pt5-199', 'es', 1, 5),
  linea('o4', U(2), 'sv2-269', 'es', 1, 6), linea('o5', U(3), 'sv2-269', 'fr', 2, 7), linea('o6', U(1), 'sv2-269', 'es', 1, 8),
  linea('o7', U(4), 'sv8-238', 'es', 1, 9), linea('o8', U(3), 'SV2a-201', 'ja', 1, 1),
  // La da un baneado y otra con cambio 0: ninguna de las dos sale.
  linea('o9', U(5), 'swsh7-1', 'es', 1, 1), linea('o10', U(4), 'swsh7-1', 'es', 0, 1),
]
const DESEOS = [{ id: 'd1', user_id: 'admin-1', card_id: 'swsh7-215', idioma: null, prioridad: 1, created_at: '2026-10-05T10:00:00Z' }, { id: 'd2', user_id: U(1), card_id: 'sv3pt5-151', idioma: null, prioridad: 1, created_at: '2026-10-05T10:00:00Z' }]
const PRECIOS = [{ card_id: 'swsh7-215', cm_low: 612 }, { card_id: 'sv3pt5-199', cm_low: 118.5 }, { card_id: 'sv8-238', cm_low: 84.9 }, { card_id: 'sv2-269', cm_low: 42 }]

const browser = await chromium.launch()
async function abrir({ movil = false, sesion = true, ancho = 1440, extra = {} } = {}) {
  // Sin service worker: el de la web (745) contesta antes que `route` y la
  // prueba no vería a dónde se va al escribir.
  const ctx = await browser.newContext({ ...(movil ? { ...devices['iPhone 13'] } : { viewport: { width: ancho, height: 900 } }), locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript((d) => {
    window.__FAKE_SESSION__ = d.sesion ? 'admin-1' : 'none'
    window.__FAKE_SETS__ = d.SETS
    window.__FAKE_CARTAS__ = d.CARTAS
    window.__FAKE_COLECCION__ = d.COLECCION
    window.__FAKE_DESEOS__ = d.DESEOS
    window.__FAKE_PERFILES__ = d.PERFILES
    window.__FAKE_PRECIOS__ = d.PRECIOS
    Object.assign(window, d.extra)
  }, { SETS, CARTAS, COLECCION, DESEOS, PERFILES, PRECIOS, sesion, extra })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|jsdelivr|githubusercontent|scrydex/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#5b8fd1"/></svg>' }))
  await ctx.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  // A dónde se va al escribir o al registrarse, sin irse de verdad.
  await ctx.route(/\/(mensajes|auth)\.html/, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>fuera</title>' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  return { ctx, page, errores }
}
const ir = async (page, ruta = '/mi-coleccion.html?ver=mercado') => {
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
}

const MIA = [
  { id: 'm1', user_id: 'admin-1', card_id: 'sv3pt5-151', market: 'WEST', cantidad: 1, cambio: 1, idioma: 'es', estado: 'NM', variante: 'normal', created_at: '2026-10-01T10:00:00Z', updated_at: '2026-10-07T10:00:00Z' },
  { id: 'm2', user_id: 'admin-1', card_id: 'sv2-269', market: 'WEST', cantidad: 3, cambio: 1, idioma: 'es', estado: 'EX', variante: 'normal', created_at: '2026-10-01T10:00:00Z', updated_at: '2026-10-07T09:00:00Z' },
  { id: 'm3', user_id: 'admin-1', card_id: 'sv8-238', market: 'WEST', cantidad: 2, cambio: 0, idioma: 'es', estado: 'NM', variante: 'normal', created_at: '2026-10-01T10:00:00Z', updated_at: '2026-10-07T09:00:00Z' },
]
const OTRAS = COLECCION.filter((l) => l.user_id !== 'admin-1')
const BUSCAN = [
  { id: 'd1', user_id: 'admin-1', card_id: 'swsh7-215', idioma: null, prioridad: 1, created_at: '2026-10-05T10:00:00Z' },
  { id: 'd2', user_id: 'user-1', card_id: 'sv3pt5-151', idioma: null, prioridad: 1, created_at: '2026-10-05T10:00:00Z' },
  { id: 'd3', user_id: 'user-2', card_id: 'sv2-269', idioma: 'es', prioridad: 1, created_at: '2026-10-05T10:00:00Z' },
]
const extra = { __FAKE_PRECIOS__: [...PRECIOS, { card_id: 'sv3pt5-151', cm_low: 21.4 }], __FAKE_COLECCION__: [...MIA, ...OTRAS], __FAKE_DESEOS__: BUSCAN, __FAKE_SEGUIDOS__: [{ following_id: 'user-2' }] }

console.log('── A. Las acciones de La quiero, en un grupo ──')
for (const movil of [true, false]) {
  const { ctx, page, errores } = await abrir({ movil, extra })
  await ir(page, '/mi-coleccion.html?ver=quiero')
  // Desde la 1057 Compartir, Imagen y Álbum van juntos en el ⋯ de la barra.
  await page.click('#mcQuieroMenu')
  await page.waitForTimeout(300)
  const g = await page.$$eval('#mcListasHoja [data-accion]', (bs) => bs.map((b) => ({ accion: b.dataset.accion, alto: Math.round(b.getBoundingClientRect().height), texto: b.innerText.trim() })))
  check(`${movil ? 'móvil' : 'PC'}: Compartir, Imagen y Álbum juntos en el ⋯`, ['compartir', 'imagen', 'album'].every((a) => g.some((x) => x.accion === a)), JSON.stringify(g))
  check('  …de 44 de alto y con su texto', g.every((x) => x.alto >= 44 && x.texto), JSON.stringify(g))
  await page.keyboard.press('Escape')
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── B. Las chapas del Mercado ──')
{
  const { ctx, page, errores } = await abrir({ extra })
  await ir(page, '/mi-coleccion.html?ver=mercado')
  const c = await page.evaluate(() => [...document.querySelectorAll('#mcPanelMercado .mc-mercado-opcion')].map((l) => {
    const s = l.querySelector('select')
    return { et: l.querySelector('.mc-op-et')?.textContent, valor: s.options[s.selectedIndex].textContent, opciones: [...s.options].map((o) => o.textContent), flecha: parseFloat(getComputedStyle(s).paddingRight), cambiada: l.classList.contains('cambiada') }
  }))
  check('dos chapas: «Idioma · Todos» y «Orden · Más recientes»', c.length === 2 && c[0].et === 'Idioma' && c[0].valor === 'Todos' && c[1].et === 'Orden' && c[1].valor === 'Más recientes', JSON.stringify(c))
  check('  …los órdenes dicen qué hacen', c[1]?.opciones.join('|') === 'Más recientes|Más gente la da|Más caras', c[1]?.opciones.join('|'))
  check('  …con sitio para la flecha y sin rellenar', c.every((x) => x.flecha >= 36 && !x.cambiada), JSON.stringify(c))
  await page.selectOption('#mcMercadoIdioma', 'es')
  await page.waitForTimeout(600)
  check('elegir «Español» rellena la chapa del idioma, y la del orden no', await page.evaluate(() => document.getElementById('mcMercadoIdioma').closest('label').classList.contains('cambiada') && !document.getElementById('mcMercadoOrden').closest('label').classList.contains('cambiada')))
  await page.selectOption('#mcMercadoIdioma', '')
  await page.waitForTimeout(400)
  check('  …y volver a «Todos» la vacía', await page.evaluate(() => !document.getElementById('mcMercadoIdioma').closest('label').classList.contains('cambiada')))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── C. Los cruces por bandas ──')
for (const movil of [false, true]) {
  const { ctx, page, errores } = await abrir({ movil, extra })
  await ir(page, '/mi-coleccion.html?ver=cambios')
  await page.waitForTimeout(1200)
  const r = await page.evaluate(() => {
    const bandas = [...document.querySelectorAll('#mcCambiosPanel .mc-cruces-banda')].map((b) => ({ titulo: b.querySelector('.mc-cruces-titulo')?.childNodes[0]?.textContent.trim(), quien: [...b.querySelectorAll('[data-cruce]')].map((c) => c.dataset.cruce + (c.classList.contains('mc-cruce-fila') ? ':fila' : ':tarjeta')) }))
    const lucia = document.querySelector('[data-cruce="user-1"]')
    const bal = lucia?.querySelector('.mc-cruce-balanza')
    const barra = bal ? [...bal.querySelectorAll('.mc-balanza-barra i')].map((i) => Math.round(i.getBoundingClientRect().width)) : []
    const icos = lucia ? [...lucia.querySelectorAll('.mc-cruce-ico')].map((i) => ({ et: i.getAttribute('aria-label'), w: Math.round(i.getBoundingClientRect().width), h: Math.round(i.getBoundingClientRect().height), texto: i.innerText.trim() })) : []
    const fuertes = lucia ? lucia.querySelectorAll('.btn-primary').length : 0
    return { bandas, balanza: bal?.getAttribute('aria-label'), barra, icos, fuertes, fila: document.querySelector('[data-cruce="user-4"]')?.innerText.replace(/\s+/g, ' ').trim(), ancho: document.documentElement.scrollWidth <= innerWidth + 1 }
  })
  const lado = movil ? 'móvil' : 'PC'
  check(`${lado}: tres bandas en orden — perfecto (tarjeta), tienen lo que buscas y buscan lo que das (filas)`, JSON.stringify(r.bandas) === JSON.stringify([{ titulo: 'Cruce perfecto', quien: ['user-1:tarjeta'] }, { titulo: 'Tienen lo que buscas', quien: ['user-4:fila'] }, { titulo: 'Buscan lo que das', quien: ['user-2:fila'] }]), JSON.stringify(r.bandas))
  check('  …la balanza dice quién pone más y cuánto', /^Te da 590,60\s€ más$/.test(r.balanza || ''), r.balanza)
  check('  …y la barra se reparte como el valor (612 contra 21,40)', r.barra.length === 2 && r.barra[0] > r.barra[1] * 20, JSON.stringify(r.barra))
  check('  …un solo botón fuerte y «Escribir» y «Su perfil» en iconos de 44', r.fuertes === 1 && r.icos.length === 2 && r.icos.every((i) => i.w === 44 && i.h === 44 && i.texto === '' && i.et), JSON.stringify(r.icos))
  check('  …la fila de Íker dice lo que mueve y cuánto vale', /Te da 1 de tu lista · ≈ 612,00\s€/.test(r.fila || '') && /Proponer/.test(r.fila || ''), r.fila)
  check('  …sin desplazamiento de lado', r.ancho)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── D. El Modo evento ──')
const EV = { ...extra, __FAKE_COLECCION__: [...MIA, { id: 'm4', user_id: 'admin-1', card_id: 'swsh7-1', market: 'WEST', cantidad: 2, cambio: 2, idioma: 'es', estado: 'NM', variante: 'normal', created_at: '2026-10-01T10:00:00Z' }, ...OTRAS], __FAKE_PRECIOS__: [...PRECIOS, { card_id: 'sv3pt5-151', cm_low: 21.4 }, { card_id: 'swsh7-1', cm_low: 3.5 }] }
for (const movil of [true, false]) {
  const { ctx, page, errores } = await abrir({ movil, extra: EV })
  await ir(page, '/evento.html')
  await page.click('[data-lista="doy"]')
  await page.waitForTimeout(400)
  const p = await page.evaluate(() => {
    const pase = document.querySelector('#eventoQr')
    const qr = pase.querySelector('.evento-pase-qr svg')
    const marca = pase.querySelector('.evento-pase-marca')
    const cajaQr = pase.querySelector('.evento-pase-qr').getBoundingClientRect()
    const m = marca?.getBoundingClientRect()
    const barra = document.querySelector('.evento-barra')
    const hijos = [...barra.children].map((h) => Math.round(h.getBoundingClientRect().top + h.getBoundingClientRect().height / 2))
    const lado = document.querySelector('.evento-lado').getBoundingClientRect()
    const listas = document.querySelector('.evento-listas').getBoundingClientRect()
    return {
      qr: !!qr, lema: pase.querySelector('.evento-pase-lema')?.textContent, cifras: pase.querySelector('.evento-pase-cifras')?.textContent.replace(/\s+/g, ' ').trim(),
      marcaFuera: !!m && (m.bottom <= cajaQr.top || m.top >= cajaQr.bottom || m.right <= cajaQr.left || m.left >= cajaQr.right),
      barraUnaFila: Math.abs(hijos[0] - hijos[1]) < 6,
      grupo: [...document.querySelectorAll('.evento-botones > button')].map((b) => b.getAttribute('aria-label')),
      dosColumnas: lado.right <= listas.left && Math.abs(lado.top - listas.top) < 40,
      arriba: document.querySelector('.evento-botones').getBoundingClientRect().top < document.querySelector('#eventoLista').getBoundingClientRect().top,
      ancho: document.documentElement.scrollWidth <= innerWidth + 1,
    }
  })
  const lado = movil ? 'móvil' : 'PC'
  check(`${lado}: el pase con el QR, «Escanéame para ver mis cartas» y las cuentas`, p.qr && p.lema === 'Escanéame para ver mis cartas' && /3 busco|1 busco/.test(p.cifras) && /doy/.test(p.cifras), JSON.stringify(p))
  check('  …la marca va encima del recuadro del QR, nunca dentro', p.marcaFuera)
  check('  …Copiar, Imagen y CSV en el grupo y ARRIBA de las cartas, en la fila de las pestañas', p.grupo.join('|') === 'Copiar lista|Imagen|Exportar CSV' && p.arriba && p.barraUnaFila, JSON.stringify(p))
  check(movil ? '  …en el móvil, una columna' : '  …en el PC, dos columnas: el pase a la izquierda', movil ? !p.dosColumnas : p.dosColumnas, JSON.stringify(p))
  check('  …sin desplazamiento de lado', p.ancho)
  // Los filtros, sobre «Doy» (Mew ex, Iono y Mew).
  const nombres = () => page.$$eval('#eventoLista .evento-carta b', (bs) => bs.map((b) => b.textContent))
  check('Doy: las tres, por expansión (la más nueva primero)', (await nombres()).join('|') === 'Mew ex|Iono|Mew', (await nombres()).join('|'))
  await page.fill('#eventoBuscar', 'mew')
  await page.waitForTimeout(400)
  check('buscar «mew» deja las dos Mew y dice «2 de 3»', (await nombres()).join('|') === 'Mew ex|Mew' && (await page.textContent('#eventoCuantas')) === '2 de 3', (await nombres()).join('|'))
  await page.fill('#eventoBuscar', '')
  const sets = await page.$$eval('#eventoSet option', (os) => os.map((o) => o.textContent))
  check('la expansión ofrece solo las de la lista, con su cuenta', sets.join('|') === 'Todas|151 (1)|Cielos Evolutivos (1)|Evoluciones en Paldea (1)', sets.join('|'))
  await page.selectOption('#eventoSet', 'Cielos Evolutivos')
  await page.waitForTimeout(300)
  check('  …y elegir una filtra y rellena su chapa', (await nombres()).join('|') === 'Mew' && (await page.evaluate(() => document.getElementById('eventoSet').closest('.evento-op').classList.contains('cambiada'))))
  await page.selectOption('#eventoSet', '')
  await page.selectOption('#eventoOrden', 'caras')
  await page.waitForTimeout(300)
  check('«Más caras»: Iono (42) · Mew ex (21,40) · Mew (3,50)', (await nombres()).join('|') === 'Iono|Mew ex|Mew', (await nombres()).join('|'))
  const precio = () => page.$eval('#eventoLista .evento-precio', (e) => ({ visto: getComputedStyle(e).display !== 'none', texto: e.textContent }))
  check('«Con precio» viene apagado: el precio no se ve', !(await precio()).visto && (await page.getAttribute('#eventoConPrecio', 'aria-pressed')) === 'false')
  await page.click('#eventoConPrecio')
  check('  …y al encenderlo, el de su idioma («42,00 €»)', (await precio()).visto && (await precio()).texto === '42,00 €', JSON.stringify(await precio()))
  await page.click('#eventoAmpliar')
  await page.waitForTimeout(300)
  const g = await page.evaluate(() => { const d = document.getElementById('eventoGrande'); const r = d.querySelector('svg')?.getBoundingClientRect(); return { abierto: d.open, ancho: Math.round(r?.width || 0), fondo: getComputedStyle(d).backgroundColor, nombre: document.getElementById('eventoGrandeNombre').textContent } })
  check('«Ampliar el QR»: el QR en grande sobre blanco, con tu @', g.abierto && g.ancho >= 280 && g.fondo === 'rgb(255, 255, 255)' && g.nombre === '@pingu', JSON.stringify(g))
  await page.click('#eventoGrandeCerrar')
  check('  …y se cierra', !(await page.evaluate(() => document.getElementById('eventoGrande').open)))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n${fails} FALLOS` : '\nTodo en orden')
process.exit(fails ? 1 : 0)
