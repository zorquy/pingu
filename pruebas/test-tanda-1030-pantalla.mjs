// Tanda 1030 — lo que ve quien escanea el QR del modo evento: /evento/<usuario>
// abre la ficha de esa persona por Cambios (Busca / Da, sin cuenta) con la
// puerta a crear cuenta arriba; con cuenta, el cruce de la pestaña y nada más.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

const SETS = [{ id: 'sv8', name: 'Chispas Fulgurantes', serie_id: 'sv', market: 'WEST', tcg_online_code: 'SSP', card_count_official: 191, card_count_total: 252 }]
const carta = (n, nombre) => ({ id: `sv8-${n}`, set_id: 'sv8', local_id: String(n), name: nombre, name_es: nombre, market: 'WEST', category: 'Pokemon', rarity: 'Rare', rarity_en: 'Rare', image_path: `sv/sv8/${n}`, variants: { normal: true } })
const CARTAS = [carta(1, 'Pikachu ex'), carta(2, 'Charizard ex')]
// user-2 da un Charizard y busca un Pikachu; user-1 (quien mira con cuenta) tiene el Pikachu.
const COLECCION = [
  { id: 'l1', user_id: 'user-2', card_id: 'sv8-2', market: 'WEST', idioma: 'es', estado: 'NM', variante: 'normal', cantidad: 2, cambio: 1 },
  { id: 'l2', user_id: 'user-1', card_id: 'sv8-1', market: 'WEST', idioma: 'es', estado: 'NM', variante: 'normal', cantidad: 1, cambio: 1 },
]
const DESEOS = [{ id: 'd1', user_id: 'user-2', card_id: 'sv8-1', idioma: null }]

const b = await chromium.launch()
async function abrir(ruta, { sesion = null } = {}) {
  const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript((d) => {
    window.__FAKE_SESSION__ = d.sesion || 'none'
    Object.assign(window, { __FAKE_SETS__: d.SETS, __FAKE_CARTAS__: d.CARTAS, __FAKE_COLECCION__: d.COLECCION, __FAKE_DESEOS__: d.DESEOS, __FAKE_PRECIOS__: [] })
    try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())); localStorage.setItem('pokedoc-onboarding', '1') } catch {}
  }, { SETS, CARTAS, COLECCION, DESEOS, sesion })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitless|jsdelivr|githubusercontent/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"/>' }))
  await ctx.route(/\/\.netlify\/functions\//, (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  return { ctx, page, errores }
}
const estado = (page) => page.evaluate(() => {
  const cruce = document.getElementById('perfilCruce')
  const activa = document.querySelector('.tab-btn.active')
  return {
    nombre: document.querySelector('#heroName, .perfil-nombre, h1')?.textContent.trim(),
    cruceVisible: Boolean(cruce) && !cruce.classList.contains('hidden') && cruce.textContent.trim().length > 0,
    cruceTitulo: cruce?.querySelector('h2')?.textContent,
    cruceEnlaces: [...(cruce?.querySelectorAll('a') || [])].map((a) => `${a.textContent.trim()}→${a.getAttribute('href')}`),
    pestania: activa?.dataset.ptab,
    cambiosVisible: !document.querySelector('[data-ptab="cambios"]')?.hidden,
    cambios: document.getElementById('perfilCambios')?.textContent.replace(/\s+/g, ' ').trim().slice(0, 300),
    pcCruce: document.getElementById('pcCruce')?.textContent.replace(/\s+/g, ' ').trim().slice(0, 200) || null,
    cartas: document.querySelectorAll('#perfilCambios img').length,
  }
})

// Desde la 1426 el QR abre el PUESTO DE CAMBIOS (js/evento-puesto.js), no el
// perfil: las cartas primero, la puerta a la cuenta en la cabecera y, con
// cuenta, el cruce en una frase y «Proponer cambio». Lo de abajo lo comprueba
// así; el detalle del puesto, test-tanda-1426-pantalla.mjs.
const puesto = (page) => page.evaluate(() => {
  const p = document.querySelector('.ep-puesto')
  const crear = p?.querySelector('.ep-acciones a.btn-primary')
  const r = crear?.getBoundingClientRect()
  return {
    hay: !!p, cartas: p?.querySelectorAll('.ep-rejilla img').length || 0,
    crear: crear ? { texto: crear.textContent.trim(), href: crear.getAttribute('href'), alto: Math.round(r.height), enPantalla: r.top >= 0 && r.bottom <= innerHeight } : null,
    frase: p?.querySelector('[data-ep-cruce]')?.textContent.trim(),
    proponer: !!p?.querySelector('[data-ep-proponer]:not([disabled])'),
    pestanas: !!document.getElementById('profileTabs'),
  }
})
console.log('── 1. Sin cuenta: el puesto con sus cartas, y la puerta arriba ──')
{
  const { ctx, page, errores } = await abrir('/evento/Misty')
  const e = await puesto(page)
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('abre el puesto de cambios, no el perfil con pestañas', e.hay && !e.pestanas, JSON.stringify(e))
  check('lo que da, en cartas', e.cartas >= 1, JSON.stringify(e))
  check('«Crear cuenta» vuelve a esta misma página, mide 44 px y se ve sin bajar', e.crear?.texto === 'Crear cuenta' && /^\/auth\.html\?registro=1&volver=%2Fevento%2FMisty/.test(e.crear.href) && e.crear.alto >= 44 && e.crear.enPantalla, JSON.stringify(e.crear))
  await ctx.close()
}

console.log('\n── 2. Con cuenta: el cruce en una frase y «Proponer cambio» ──')
{
  const { ctx, page, errores } = await abrir('/evento/Misty', { sesion: 'user-1' })
  const e = await puesto(page)
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('la frase dice que le puedes dar el Pikachu', /^Tú le puedes dar a Misty 1 carta que busca\.$/.test(e.frase || ''), e.frase)
  check('«Proponer cambio» listo', e.proponer, JSON.stringify(e))
  await ctx.close()
}

console.log('\n── 3. El enlace de antes (?cruce=1) sigue pintando la caja ──')
{
  const { ctx, page, errores } = await abrir('/usuario.html?u=Misty&cruce=1', { sesion: 'user-1' })
  const e = await estado(page)
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('la caja «Vuestro cruce» de arriba, como hasta ahora', e.cruceVisible && /Vuestro cruce/.test(e.cruceTitulo || ''), JSON.stringify({ visible: e.cruceVisible, titulo: e.cruceTitulo }))
  await ctx.close()
}

await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
