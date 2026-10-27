// Tanda 1056 — la ficha del Mercado centrada y una tarjeta por persona.
//
// PINGU, con una captura del Goldeen: «el pop-up sale a un lado; ya hemos
// dicho que los pop-ups mejoran en el centro» y «pone la dan dos personas;
// es la misma persona, solo que una copia está en inglés».
//
// Lo que se comprueba:
//   · en el PC la ficha es modal y está centrada; en el iPhone, desde abajo;
//   · quien da la carta en dos idiomas sale UNA vez, con sus dos copias;
//   · el título cuenta personas (y copias si son más): «La dan 2 personas ·
//     5 copias»;
//   · lo puro (porPersona, rotuloDeGente) sin navegador.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 280) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'

console.log('── 1. Lo puro ──')
{
  // mercado.js importa ../app.js (DOM): se leen las funciones del fichero.
  const src = (await import('node:fs')).readFileSync(`${RAIZ}/js/mi-coleccion/mercado.js`, 'utf8')
  const trozo = (n) => src.slice(src.indexOf(`export ${n}`), src.indexOf('\n}\n', src.indexOf(`export ${n}`)) + 3)
  const codigo = [trozo('function porPersona'), src.slice(src.indexOf('export const copiasDe'), src.indexOf('\n', src.indexOf('export const copiasDe'))), trozo('function rotuloDeGente')].join('\n').replace(/export /g, '')
  const { porPersona, rotuloDeGente } = new Function(`${codigo}; return { porPersona, rotuloDeGente }`)()
  const g = porPersona([{ user_id: 'a', idioma: 'en', cambio: 3 }, { user_id: 'b', idioma: 'es', cambio: 1 }, { user_id: 'a', idioma: 'es', cambio: 1 }])
  check('porPersona junta por persona en el orden en que llegan', g.map((x) => `${x.user_id}:${x.copias.length}`).join() === 'a:2,b:1', JSON.stringify(g.map((x) => [x.user_id, x.copias.length])))
  check('rotuloDeGente: «La dan 2 personas · 5 copias»', rotuloDeGente(g) === 'La dan 2 personas · 5 copias', rotuloDeGente(g))
  check('  …una persona con una copia: «La da 1 persona»', rotuloDeGente(porPersona([{ user_id: 'a', cambio: 1 }])) === 'La da 1 persona')
  check('  …una persona con cuatro: «La da 1 persona · 4 copias»', rotuloDeGente(porPersona([{ user_id: 'a', cambio: 3 }, { user_id: 'a', cambio: 1 }])) === 'La da 1 persona · 4 copias')
  check('  …y quien la busca no cuenta copias', rotuloDeGente(porPersona([{ user_id: 'a' }, { user_id: 'a' }]), 'busca') === 'La busca 1 persona')
}

const SETS = [{ id: 'sv2', name: 'Evoluciones en Paldea', serie_id: 'sv', market: 'WEST', release_date: '2023-06-09', card_count_official: 193 }]
const CARTAS = [{ id: 'sv2-269', market: 'WEST', set_id: 'sv2', local_id: '269', name: 'Iono', name_es: 'Iono', image_path: 'x/sv2-269', rarity: 'Rare', category: 'Trainer', variants: { normal: true }, tcg_sets: { id: 'sv2', name: 'Evoluciones en Paldea', serie_id: 'sv' } }]
const PERFILES = [{ id: 'admin-1', username: 'pingu' }, { id: 'user-1', username: 'mcm_tuber', display_name: 'MCM Tuber' }, { id: 'user-2', username: 'danipoke', display_name: 'Dani' }]
const linea = (id, user, idioma, cambio) => ({ id, user_id: user, card_id: 'sv2-269', market: 'WEST', cantidad: cambio, cambio, idioma, estado: 'NM', variante: 'normal', created_at: '2026-10-01T10:00:00Z' })
const COLECCION = [linea('o1', 'user-1', 'en', 3), linea('o2', 'user-1', 'es', 1), linea('o3', 'user-2', 'es', 1)]

const browser = await chromium.launch()
async function abrir({ movil = false } = {}) {
  const ctx = await browser.newContext({ ...(movil ? { ...devices['iPhone 13'] } : { viewport: { width: 1440, height: 900 } }), locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript((d) => Object.assign(window, { __FAKE_SESSION__: 'admin-1', __FAKE_SETS__: d.SETS, __FAKE_CARTAS__: d.CARTAS, __FAKE_COLECCION__: d.COLECCION, __FAKE_PERFILES__: d.PERFILES, __FAKE_DESEOS__: [] }), { SETS, CARTAS, COLECCION, PERFILES })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|jsdelivr|githubusercontent|scrydex/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#5b8fd1"/></svg>' }))
  await ctx.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}/mi-coleccion.html?ver=mercado`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-merc-ficha="sv2-269"]', { timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(800)
  return { ctx, page, errores }
}

for (const movil of [false, true]) {
  console.log(`── 2. La ficha (${movil ? 'iPhone' : 'PC'}) ──`)
  const { ctx, page, errores } = await abrir({ movil })
  await page.click('[data-merc-ficha="sv2-269"]')
  await page.waitForTimeout(1500)
  const r = await page.evaluate(() => {
    const d = document.getElementById('mcMercadoFicha')
    const b = d.getBoundingClientRect()
    return {
      modal: d.matches(':modal'), izq: Math.round(b.left), der: Math.round(innerWidth - b.right), abajo: Math.round(innerHeight - b.bottom), arriba: Math.round(b.top),
      titulo: d.querySelector('.mc-merf-sub')?.textContent.trim(),
      personas: [...d.querySelectorAll('.mc-merf-persona')].map((p) => ({ quien: p.querySelector('.mc-merf-nombre a')?.textContent.trim(), copias: [...p.querySelectorAll('.mc-merf-copias li')].map((l) => l.textContent.trim().replace(/\s+/g, ' ')), botones: p.querySelectorAll('[data-merf-proponer]').length })),
      bloqueada: getComputedStyle(document.documentElement).overflow === 'hidden',
    }
  })
  check('es modal', r.modal, JSON.stringify(r))
  if (movil) check('  …y en el iPhone sale desde abajo', r.abajo <= 1 && r.izq <= 1, JSON.stringify(r))
  else check('  …y en el PC, centrada', Math.abs(r.izq - r.der) <= 2 && r.arriba > 0, JSON.stringify(r))
  check('  …con la página de detrás quieta', r.bloqueada)
  check('el título cuenta personas y copias', r.titulo === 'La dan 2 personas · 5 copias', r.titulo)
  check('MCM Tuber sale UNA vez, con sus dos copias', r.personas.length === 2 && r.personas[0].quien === 'MCM Tuber' && r.personas[0].copias.length === 2 && /Inglés · Near Mint · 3/.test(r.personas[0].copias[0]) && /Español · Near Mint$/.test(r.personas[0].copias[1]), JSON.stringify(r.personas))
  check('  …y sus botones una vez', r.personas.every((p) => p.botones === 1), JSON.stringify(r.personas))
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  check('Esc la cierra', !(await page.evaluate(() => document.getElementById('mcMercadoFicha').open)))
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
