// Tanda 791 — NU6, la galería de un ilustrador (/ilustrador/<nombre>), y
// LO7, el estado de la base en /admin al día: las migraciones de la 630 en
// adelante, las que solo crean funciones (se miran sin ejecutarlas) y
// «Copiar el SQL».
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

console.log('── 1. En el código ──')
check('la reescritura /ilustrador/* va a la página', /from = "\/ilustrador\/\*"\s+to = "\/ilustrador\.html"/.test(leer('netlify.toml')))
check('la ficha de carta enlaza al ilustrador', /rutaDeIlustrador\(carta\.illustrator\)/.test(leer('js/carta-nucleo.js')))
check('/ilustrador es de la sección Cartas', /Cartas: \[[^\]]*'ilustrador'/.test(leer('js/barra-movil.js')))
const esquema = leer('js/schema-check.js')
check('el estado de la base llega a las migraciones nuevas (LO7)', ['supabase-migration-mercado.sql', 'supabase-migration-torneos-jornadas.sql', 'supabase-migration-productos-ficha.sql', 'supabase-migration-albumes-portada.sql'].every((f) => esquema.includes(f)))
check('  …y cada fichero que nombra existe', [...esquema.matchAll(/fichero: '([^']+)'/g)].every(([, f]) => { try { leer(f); return true } catch { return false } }))
check('/admin copia el SQL de lo que falta', /data-copiar-sql/.test(leer('admin/js/admin.js')))

console.log('── 2. Lo puro ──')
const b = await chromium.launch()
{
  const p = await b.newPage()
  await p.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' })
  const r = await p.evaluate(async () => {
    const ruta = await import('/js/carta-ruta.js')
    const il = await import('/js/ilustrador.js')
    const sc = await import('/js/schema-check.js')
    return {
      slug: ruta.slugDeIlustrador('Mitsuhiro Arita'),
      acento: ruta.slugDeIlustrador('Ryota Murayama & Ébano'),
      ruta: ruta.rutaDeIlustrador('kawayoo'),
      patron: il.patronDeSlug('mitsuhiro-arita'),
      suyo: il.esDelIlustrador({ illustrator: 'Mitsuhiro Arita' }, 'mitsuhiro-arita'),
      dos: il.esDelIlustrador({ illustrator: 'Mitsuhiro Arita & Kagemaru Himeno' }, 'mitsuhiro-arita'),
      otro: il.esDelIlustrador({ illustrator: 'Mitsuhiro Aritaka' }, 'mitsuhiro-arita'),
      orden: il.ordenarPorFecha([
        { id: 'b', set_id: 's2', local_id: '2', tcg_sets: { release_date: '2020-01-01' } },
        { id: 'a10', set_id: 's1', local_id: '10', tcg_sets: { release_date: '1999-01-09' } },
        { id: 'a2', set_id: 's1', local_id: '2', tcg_sets: { release_date: '1999-01-09' } },
      ]).map((c) => c.id).join(),
      falta: sc.veredictoDeSonda({ code: 'PGRST202', message: 'Could not find the function public.intercambios_mercado in the schema cache' }).estado,
      soloLectura: sc.veredictoDeSonda({ code: '25006', message: 'cannot execute INSERT in a read-only transaction' }).estado,
      sinPermiso: sc.veredictoDeSonda({ code: '42501', message: 'permission denied' }).estado,
      bien: sc.veredictoDeSonda(null).estado,
    }
  })
  check('el trozo de la dirección: sin acentos ni signos', r.slug === 'mitsuhiro-arita' && r.acento === 'ryota-murayama-ebano' && r.ruta === '/ilustrador/kawayoo', JSON.stringify(r))
  check('la búsqueda por partes', r.patron === '%mitsuhiro%arita%', r.patron)
  check('son suyas la firma entera y la compartida, no la parecida', r.suyo && r.dos && !r.otro, JSON.stringify(r))
  check('por fecha y, dentro del set, por número', r.orden === 'a2,a10,b', r.orden)
  check('una función falta solo con PGRST202; cualquier otro error dice que existe', r.falta === 'falta' && r.soloLectura === 'ok' && r.sinPermiso === 'ok' && r.bien === 'ok', JSON.stringify(r))
  await p.close()
}

console.log('── 3. La página ──')
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' })
  await ctx.addInitScript(() => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_SETS__ = [
      { id: 'base1', name: 'Base Set', market: 'WEST', release_date: '1999-01-09', card_count_official: 102, card_count_total: 102 },
      { id: 'sv1', name: 'Escarlata y Púrpura', market: 'WEST', release_date: '2023-03-31', card_count_official: 198, card_count_total: 258 },
    ]
    window.__FAKE_CARTAS__ = [
      { id: 'sv1-10', set_id: 'sv1', local_id: '10', name: 'Pikachu', name_es: 'Pikachu', market: 'WEST', image_path: 'sv/sv1/10', illustrator: 'Mitsuhiro Arita' },
      { id: 'base1-4', set_id: 'base1', local_id: '4', name: 'Charizard', market: 'WEST', image_path: 'base/base1/4', illustrator: 'Mitsuhiro Arita' },
      { id: 'base1-2', set_id: 'base1', local_id: '2', name: 'Blastoise', market: 'WEST', image_path: 'base/base1/2', illustrator: 'Ken Sugimori' },
    ]
    window.__FAKE_COLECCION__ = [{ id: 'l1', card_id: 'base1-4', cantidad: 1, idioma: 'es', estado: 'nueva', variante: 'normal' }]
    window.__FAKE_PRECIOS__ = [{ card_id: 'base1-4', cm_trend: 420 }, { card_id: 'sv1-10', cm_trend: 2 }]
  })
  const p = await ctx.newPage()
  await p.goto(`${BASE}/ilustrador/mitsuhiro-arita`, { waitUntil: 'domcontentloaded' })
  await p.waitForSelector('.il-carta', { timeout: 8000 }).catch(() => {})
  const v = await p.evaluate(() => ({
    h1: document.getElementById('ilNombre')?.textContent,
    cifras: document.getElementById('ilCifras')?.textContent,
    cartas: [...document.querySelectorAll('.il-carta')].map((a) => a.getAttribute('href')),
    tengo: [...document.querySelectorAll('.il-carta.tengo')].length,
    titulo: document.title,
  }))
  check('el nombre del ilustrador en el título', v.h1 === 'Mitsuhiro Arita' && /Mitsuhiro Arita/.test(v.titulo), JSON.stringify(v))
  check('sus dos cartas, la de 1999 primero, y no la de otro', v.cartas.length === 2 && /base1-4/.test(v.cartas[0]) && /sv1-10/.test(v.cartas[1]), JSON.stringify(v.cartas))
  check('cuántas tienes y la más cara', /2 cartas/.test(v.cifras) && /tienes 1/.test(v.cifras) && /Charizard/.test(v.cifras) && v.tengo === 1, v.cifras)
  await p.goto(`${BASE}/ilustrador/nadie-de-nada`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(1500)
  const vacio = await p.evaluate(() => document.querySelector('#ilRejilla .empty-state')?.textContent || '')
  check('un ilustrador sin cartas lo dice', /No tenemos ninguna carta/.test(vacio), vacio)
  await ctx.close()
}
await b.close()

console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
