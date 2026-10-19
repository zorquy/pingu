// Tanda 904 — «Otros sets»: un grupo de eras al fondo de la estantería, y
// el arreglo de e-Card y Play! Pokémon Prize Pack.
//
// PINGU, desde /admin, metió las nueve series de Play! Pokémon Prize Pack
// en la era de Skyridge, Aquapolis, Best of Game y Expedition y la rebautizó
// «Play! Pokémon Prize Pack». Lo que pidió: esos cuatro vuelven a ser
// «e-Card»; los Prize Pack son su propia era; y esa era cuelga de un grupo
// nuevo, «Otros sets», «abajo, debajo de Base».
//
// Lo que se prueba:
//   1. Lo puro: una era con `grupo` cae al fondo, detrás de todas (colocada
//      a mano o no), con el rótulo «Otros sets» en la primera que cae ahí, y
//      los sets especiales de siempre debajo de ella bajo el mismo rótulo.
//   2. La migración, sentencia a sentencia como el SQL Editor (631), contra
//      PostgreSQL de verdad y el lío tal cual: e-Card recupera su nombre y su
//      orden, los cuatro se quedan, los nueve se van a 'prize-pack' (con su
//      corrección de la 885 cada uno), el japonés no se toca. Y sin fila de
//      era, se crea justo encima de Base.
//   3. Lo estático: `grupo` se pide con respaldo (624), nada escribe la
//      columna si no existe.
//   4. En pantalla: la estantería pinta el rótulo encima de la era del grupo
//      y detrás de Base; /admin → Colecciones lo mismo, y el editor de la
//      era ofrece «Dónde va».
import { readFileSync } from 'node:fs'
import { execFileSync, spawnSync } from 'node:child_process'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const PRUEBAS = new URL('.', import.meta.url).pathname
const leer = (f) => readFileSync(`${RAIZ}/${f}`, 'utf8')
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

console.log('── 1. Lo puro: el grupo al fondo ──')
const { gruposDeEstanteria, TITULOS_DE_GRUPO } = await import(`${RAIZ}/js/mi-coleccion/estanteria.js`)
{
  const sets = [
    { id: 'sv1', serie_id: 'sv', name: 'Scarlet & Violet', release_date: '2023-03-31' },
    { id: 'base1', serie_id: 'base', name: 'Base Set', release_date: '1999-01-09' },
    { id: 'ecard1', serie_id: 'ecard', name: 'Expedition Base Set', release_date: '2002-09-15' },
    { id: 'pp9', serie_id: 'prize-pack', name: 'Play! Pokémon Prize Pack Series Nine', release_date: '2026-01-01' },
    { id: 'pp1', serie_id: 'prize-pack', name: 'Play! Pokémon Prize Pack Series One', release_date: '2022-01-01' },
    { id: 'tk1', serie_id: 'tk', name: 'Trainer Kit', release_date: '2010-01-01' },
  ]
  const eras = new Map([
    ['base', { nombre: 'Base', orden: 170 }],
    ['ecard', { nombre: 'e-Card', orden: 150 }],
    ['prize-pack', { nombre: 'Play! Pokémon Prize Pack', orden: 0, grupo: 'otros' }],
  ])
  const g = gruposDeEstanteria(sets, new Set(), eras)
  check('la era del grupo va detrás de TODAS las eras, aunque su orden sea 0 (más nueva y colocada)', g.map((x) => x.id).join() === 'ecard,base,sv,prize-pack,especiales', g.map((x) => x.id).join())
  check('  …con el rótulo «Otros sets» en ella, y solo en ella', g[3].grupoTitulo === 'Otros sets' && g.filter((x) => x.grupoTitulo).length === 1 && TITULOS_DE_GRUPO.otros === 'Otros sets')
  check('  …y los sets especiales caen en el mismo grupo, detrás', g[4].grupo === 'otros' && !g[4].grupoTitulo)
  check('  …dentro, lo más nuevo arriba, como en cualquier era', g[3].sets.map((s) => s.id).join() === 'pp9,pp1')
  const sin = gruposDeEstanteria(sets.filter((s) => s.serie_id !== 'tk'), new Set(), eras)
  check('sin especiales, el rótulo sigue en la era del grupo', sin.at(-1).id === 'prize-pack' && sin.at(-1).grupoTitulo === 'Otros sets')
  const solo = gruposDeEstanteria(sets.filter((s) => s.serie_id !== 'prize-pack'), new Set(), eras)
  check('sin eras del grupo, el rótulo lo lleva «Sets especiales»', solo.at(-1).id === 'especiales' && solo.at(-1).grupoTitulo === 'Otros sets')
  check('y sin nada que caiga ahí, no hay rótulo', !gruposDeEstanteria(sets.slice(0, 3), new Set(), eras).some((x) => x.grupoTitulo))
  const raro = gruposDeEstanteria(sets, new Set(), new Map([['sv', { nombre: 'SV', orden: 0, grupo: 'loquesea' }]]))
  check('un grupo que no existe no es un grupo: la era sigue entre las eras', raro[0].id === 'sv' && !raro[0].grupo, raro.map((x) => x.id).join())
  check('y sin `grupo` en el mapa (antes de la migración), todo como siempre', gruposDeEstanteria(sets, new Set(), new Map([['base', { nombre: 'Base', orden: 170 }]])).map((x) => x.id).join() === 'base,prize-pack,sv,ecard,especiales')
}

console.log('\n── 2. La migración, sentencia a sentencia, contra PostgreSQL ──')
{
  const PSQL = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-X', '-q', '-v', 'ON_ERROR_STOP=1']
  const hay = spawnSync('psql', [...PSQL, '-At', '-c', 'select 1'], { encoding: 'utf8' })
  check('hay un PostgreSQL en /var/tmp:5433 donde probar', hay.status === 0, (hay.stderr || '').slice(0, 120))
  if (hay.status === 0) {
    const sentencias = leer('supabase-migration-904-otros-sets.sql').replace(/--[^\n]*/g, '').split(/;\s*(?:\n|$)/).map((x) => x.trim()).filter(Boolean)
    check('la migración son sentencias sueltas: sin `do`, sin temporales, sin funciones', sentencias.length >= 10 && !sentencias.some((s) => /\bcreate\s+(temp|temporary)\b|\$\$/i.test(s)), String(sentencias.length))
    // Cada escenario en su base: el lío con fila de era (lo de verdad) y sin ella.
    const correr = (nombre, antes) => {
      execFileSync('psql', [...PSQL, '-c', `drop database if exists ${nombre}`], { encoding: 'utf8' })
      execFileSync('psql', [...PSQL, '-c', `create database ${nombre}`], { encoding: 'utf8' })
      const db = [...PSQL, '-d', nombre]
      execFileSync('psql', [...db, '-f', `${PRUEBAS}sql-tanda-904.sql`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
      if (antes) execFileSync('psql', [...db, '-c', antes], { encoding: 'utf8' })
      // Como el SQL Editor: cada sentencia en su propia conexión (631).
      const errores = []
      for (const s of sentencias) {
        const r = spawnSync('psql', [...db, '-c', s], { encoding: 'utf8' })
        if (r.status !== 0) errores.push(`${s.slice(0, 60)}… → ${r.stderr.slice(0, 160)}`)
      }
      const q = (sql) => execFileSync('psql', [...db, '-At', '-F', '|', '-c', sql], { encoding: 'utf8' }).trim()
      return { errores, q }
    }
    // A. El lío de verdad (está en el fixture): la era de e-Card rebautizada
    // «Play! Pokémon Prize Pack», con los 13 dentro.
    {
      const { errores, q } = correr('pd904a', null)
      check('A. las sentencias pasan todas', !errores.length, errores.join(' || '))
      check('  …y dos veces (es re-ejecutable)', !sentencias.some((s) => spawnSync('psql', [...PSQL, '-d', 'pd904a', '-c', s], { encoding: 'utf8' }).status !== 0))
      check('e-Card recupera su nombre y CONSERVA su orden', q(`select nombre || '|' || orden || '|' || coalesce(grupo, '-') from tcg_eras where market = 'WEST' and id = 'ecard'`) === 'e-Card|150|-')
      check('  …con sus cuatro sets', q(`select string_agg(id, ',' order by id) from tcg_sets where market = 'WEST' and serie_id = 'ecard'`) === 'ecard1,ecard2,ecard3,tcggo-77')
      check('Prize Pack es su propia era, en «Otros sets»', q(`select nombre || '|' || coalesce(grupo, '-') from tcg_eras where market = 'WEST' and id = 'prize-pack'`) === 'Play! Pokémon Prize Pack|otros')
      check('  …con las nueve series (también la escrita «Pokemon»)', q(`select count(*) from tcg_sets where market = 'WEST' and serie_id = 'prize-pack'`) === '9')
      check('cada set movido lleva su corrección (885), con lo de antes', q(`select count(*) from tcg_correcciones where tabla = 'tcg_sets' and columna = 'serie_id' and market = 'WEST' and anterior = '"ecard"'`) === '13' && q(`select count(*) from tcg_correcciones where valor = '"prize-pack"'`) === '9')
      check('ninguna otra era se llama Prize Pack', q(`select count(*) from tcg_eras where market = 'WEST' and nombre ilike '%prize pack%'`) === '1')
      check('el japonés no se toca', q(`select nombre || '|' || (select serie_id from tcg_sets where market = 'JP' and id = 'ecard1') from tcg_eras where market = 'JP' and id = 'ecard'`) === 'e-Card (JP)|ecard')
      check('y la columna lleva su cerrojo: solo NULL u «otros»', spawnSync('psql', [...PSQL, '-d', 'pd904a', '-c', `update tcg_eras set grupo = 'cualquiera' where id = 'base'`], { encoding: 'utf8' }).status !== 0)
    }
    // B. Otro lío posible: PINGU creó una era NUEVA desde el editor de un
    // set («play-prize», con su nombre) y movió los trece ahí. Esa es la que
    // tiene a Expedition, así que esa pasa a ser e-Card, con su orden.
    {
      const { errores, q } = correr('pd904b', `delete from public.tcg_eras where market = 'WEST' and id = 'ecard'; insert into public.tcg_eras (market, id, nombre, orden) values ('WEST', 'play-prize', 'Play! Pokémon Prize Pack', 160); update public.tcg_sets set serie_id = 'play-prize' where market = 'WEST' and serie_id = 'ecard'`)
      check('B. (los trece en una era nueva «play-prize») las sentencias pasan', !errores.length, errores.join(' || '))
      check('la era nueva es la que pasa a ser e-Card, con su orden', q(`select string_agg(id || ':' || nombre || ':' || orden, ',' order by id) from tcg_eras where market = 'WEST' and nombre = 'e-Card'`) === 'play-prize:e-Card:160', q(`select id, nombre, orden from tcg_eras where market = 'WEST' order by id`))
      check('  …con los cuatro, y los nueve en la suya', q(`select string_agg(id, ',' order by id) from tcg_sets where market = 'WEST' and serie_id = 'play-prize'`) === 'ecard1,ecard2,ecard3,tcggo-77' && q(`select count(*) from tcg_sets where market = 'WEST' and serie_id = 'prize-pack'`) === '9')
    }
    // C. Y el peor: la era nueva se llamó 'prize-pack' tal cual. Esa no
    // puede ser e-Card (es la de los Prize Pack): e-Card se crea como
    // 'ecard', justo encima de Base.
    {
      const { errores, q } = correr('pd904c', `delete from public.tcg_eras where market = 'WEST' and id = 'ecard'; insert into public.tcg_eras (market, id, nombre, orden) values ('WEST', 'prize-pack', 'Play! Pokémon Prize Pack', 160); update public.tcg_sets set serie_id = 'prize-pack' where market = 'WEST' and serie_id = 'ecard'`)
      check('C. (los trece en una era «prize-pack») las sentencias pasan', !errores.length, errores.join(' || '))
      check('e-Card se crea como «ecard» con el orden de Base menos uno', q(`select string_agg(id || ':' || nombre || ':' || orden || ':' || coalesce(grupo, '-'), ',' order by id) from tcg_eras where market = 'WEST' and id in ('ecard', 'prize-pack')`) === 'ecard:e-Card:169:-,prize-pack:Play! Pokémon Prize Pack:160:otros', q(`select id, nombre, orden, grupo from tcg_eras where market = 'WEST' order by id`))
      check('  …con los cuatro, y los nueve se quedan en la suya', q(`select string_agg(id, ',' order by id) from tcg_sets where market = 'WEST' and serie_id = 'ecard'`) === 'ecard1,ecard2,ecard3,tcggo-77' && q(`select count(*) from tcg_sets where market = 'WEST' and serie_id = 'prize-pack'`) === '9')
    }
    for (const n of ['pd904a', 'pd904b', 'pd904c']) execFileSync('psql', [...PSQL, '-c', `drop database if exists ${n}`], { encoding: 'utf8' })
  }
}

console.log('\n── 3. Lo estático ──')
{
  const mc = leer('js/mi-coleccion.js')
  check('Mi colección pide `grupo` y, si no está la migración, vuelve a pedir sin ella (624)', /select\('id,nombre,orden,grupo'\)/.test(mc) && /if \(error\) \(\{ data \} = await supabase\.from\('tcg_eras'\)\.select\('id,nombre,orden'\)/.test(mc))
  check('  …y pinta el rótulo del grupo como un título por encima de la era', /g\.grupoTitulo \? `<h2 class="mc-estanteria-grupo">/.test(mc))
  check('  …con su CSS en la hoja de Mi colección, no en las comunes', /\.mc-estanteria-grupo \{/.test(leer('css/mi-coleccion.css')) && !/mc-estanteria-grupo/.test(leer('css/components.css')) && !/mc-estanteria-grupo/.test(leer('css/style.css')))
  const ad = leer('admin/js/colecciones.js')
  check('/admin pide `grupo` con el mismo respaldo y se apunta si existe', /select\('id,nombre,orden,grupo'\)/.test(ad) && /hayGrupo = !eg/.test(ad))
  check('  …no escribe la columna si no existe (un upsert con una columna de menos falla ENTERO)', /if \(hayGrupo\) fila\.grupo =/.test(ad))
  check('  …y el editor de la era ofrece «Dónde va» solo si existe', /hayGrupo \? `<label>Dónde va/.test(ad) && /id="colEraGrupo"/.test(ad))
  check('  …con los títulos de grupo de la estantería, no una copia', /import \{ TITULOS_DE_GRUPO \} from '\.\.\/\.\.\/js\/mi-coleccion\/estanteria\.js'/.test(ad) && !/'Otros sets'/.test(ad))
  check('la migración existe y su comprobación cuenta los sets de las dos eras', /add column if not exists grupo text/.test(leer('supabase-migration-904-otros-sets.sql')) && /count\(s\.id\) as sets/.test(leer('supabase-migration-904-otros-sets.sql')))
}

console.log('\n── 4. En pantalla ──')
{
  const browser = await chromium.launch()
  const SETS = [
    { id: 'sv1', name: 'Escarlata y Púrpura', name_en: 'Scarlet & Violet', serie_id: 'sv', market: 'WEST', release_date: '2023-03-31', card_count_official: 198, card_count_total: 258 },
    { id: 'base1', name: 'Base Set', name_en: 'Base Set', serie_id: 'base', market: 'WEST', release_date: '1999-01-09', card_count_official: 102, card_count_total: 102 },
    { id: 'ecard1', name: 'Expedition Base Set', name_en: 'Expedition Base Set', serie_id: 'ecard', market: 'WEST', release_date: '2002-09-15', card_count_official: 165, card_count_total: 165 },
    { id: 'pp1', name: 'Play! Pokémon Prize Pack Series One', name_en: 'Play! Pokémon Prize Pack Series One', serie_id: 'prize-pack', market: 'WEST', release_date: '2022-01-01', card_count_official: 100, card_count_total: 100 },
    { id: 'tk1', name: 'Trainer Kit', name_en: 'Trainer Kit', serie_id: 'tk', market: 'WEST', release_date: '2010-01-01', card_count_official: 30, card_count_total: 30 },
  ]
  const ERAS = [
    { market: 'WEST', id: 'base', nombre: 'Base', orden: 170, grupo: null },
    { market: 'WEST', id: 'ecard', nombre: 'e-Card', orden: 150, grupo: null },
    { market: 'WEST', id: 'sv', nombre: 'Escarlata y Púrpura', orden: 10, grupo: null },
    { market: 'WEST', id: 'prize-pack', nombre: 'Play! Pokémon Prize Pack', orden: 0, grupo: 'otros' },
  ]
  async function abrir(ruta, { eras = ERAS } = {}) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES' })
    await ctx.addInitScript(([s, e]) => {
      window.__FAKE_SESSION__ = 'admin-1'
      window.__FAKE_SETS__ = s
      window.__FAKE_ERAS__ = e
      window.__FAKE_CARTAS__ = []
      window.__FAKE_COLECCION__ = []
    }, [SETS, eras])
    await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|tcggo\//, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"></svg>' }))
    await ctx.route(/r2\.limitlesstcg\.net|cdn\.jsdelivr\.net|raw\.githubusercontent\.com|api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
    const page = await ctx.newPage()
    const errores = []
    page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
    await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2400)
    return { page, ctx, errores }
  }
  // La estantería de Mi colección.
  {
    const { page, ctx, errores } = await abrir('/mi-coleccion.html?ver=album')
    const titulos = await page.$$eval('#mcEstanteriaRejilla h2, #mcEstanteriaRejilla h3', (hs) => hs.map((h) => `${h.tagName}:${h.className}:${h.textContent.trim()}`))
    check('la estantería: eras, luego «Otros sets» como título, y debajo Prize Pack y los especiales', titulos.join(' / ') === 'H3:mc-estanteria-titulo:Escarlata y Púrpura / H3:mc-estanteria-titulo:e-Card / H3:mc-estanteria-titulo:Base / H2:mc-estanteria-grupo:Otros sets / H3:mc-estanteria-titulo:Play! Pokémon Prize Pack / H3:mc-estanteria-titulo:Sets especiales', titulos.join(' / '))
    const linea = await page.$eval('.mc-estanteria-grupo', (h) => ({ borde: getComputedStyle(h).borderTopWidth, visible: h.getBoundingClientRect().height > 0 }))
    check('  …el rótulo se ve y lleva su línea de separación', linea.visible && linea.borde === '1px', JSON.stringify(linea))
    check('  …sin errores', errores.length === 0, errores.join(' | '))
    await ctx.close()
  }
  // Y sin la columna (antes de la migración): todo como siempre, sin rótulo.
  {
    const { page, ctx, errores } = await abrir('/mi-coleccion.html?ver=album', { eras: ERAS.map(({ grupo, ...e }) => e) })
    const titulos = await page.$$eval('#mcEstanteriaRejilla h2, #mcEstanteriaRejilla h3', (hs) => hs.map((h) => h.textContent.trim()))
    check('sin `grupo`, Prize Pack es una era más (la primera: orden 0) y el rótulo lo lleva «Sets especiales»', titulos.join(' / ') === 'Play! Pokémon Prize Pack / Escarlata y Púrpura / e-Card / Base / Otros sets / Sets especiales', titulos.join(' / '))
    check('  …sin errores', errores.length === 0, errores.join(' | '))
    await ctx.close()
  }
  // /admin → Colecciones.
  {
    const { page, ctx, errores } = await abrir('/admin/')
    await page.locator('[data-section="colecciones"]').click({ timeout: 3000 })
    await page.waitForTimeout(1200)
    const orden = await page.$$eval('#coleccionesLista > *', (xs) => xs.map((x) => x.tagName === 'H2' ? `[${x.textContent.trim()}]` : x.dataset.era))
    check('/admin: las eras, el rótulo «Otros sets» y debajo Prize Pack (los especiales ahí son una era más)', orden.join(',') === 'sv,ecard,base,[Otros sets],prize-pack,tk' || orden.join(',') === 'sv,ecard,base,tk,[Otros sets],prize-pack', orden.join(','))
    await page.locator('[data-era-editar="prize-pack"]').click()
    await page.waitForTimeout(400)
    check('  …el editor de la era ofrece «Dónde va» con «Otros sets» elegido', await page.locator('#colEraGrupo').isVisible() && (await page.locator('#colEraGrupo').inputValue()) === 'otros')
    await page.locator('#colEraGrupo').selectOption('')
    await page.locator('#colEraGuardar').click()
    await page.waitForTimeout(600)
    const guardado = await page.evaluate(() => (window.__TABLAS__.tcg_eras || []).find((e) => e.id === 'prize-pack'))
    check('  …y al sacarla del grupo se guarda `grupo: null` con su nombre y su orden', guardado && guardado.grupo === null && guardado.nombre === 'Play! Pokémon Prize Pack' && guardado.orden === 0, JSON.stringify(guardado))
    check('  …sin errores', errores.length === 0, errores.join(' | '))
    await ctx.close()
  }
  await browser.close()
}

console.log(`\n${fails === 0 ? '✅ TODO BIEN' : `❌ ${fails} FALLOS`}`)
process.exit(fails ? 1 : 0)
