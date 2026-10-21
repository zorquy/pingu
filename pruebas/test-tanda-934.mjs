// Tanda 934 — versiones a mano y borrar cartas desde /admin.
//
// PINGU: lo que ninguna API tiene (la metálica del Charizard de la UPC de
// Celebrations, el sello de Pokémon Day) «meterlo como reprint de la carta
// original, como una versión extra», con más campos («lanzamiento, primera
// aparición…»); y «al editar cartas también deberíamos poder eliminar una
// carta». Eligió lo recomendado de la propuesta:
//   · cuelga de la carta ORIGINAL, con nombre, icono, foto, «Salió en»,
//     lanzamiento, clase, número, Cardmarket y el id de TCGGO si lo tiene;
//   · la clase decide el maestro: un sello y una adicional no cuentan;
//   · borrar mueve antes las copias a otra carta, y la de una API deja
//     lápida para que ninguna pasada la vuelva a crear.
//
// Cuatro mitades: la BASE (PostgreSQL de verdad), lo PURO, la PANTALLA de
// Mi colección (la foto y los datos de la versión) y /admin.
import { spawnSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const AQUI = dirname(fileURLToPath(import.meta.url))
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const MIGRACION = join(RAIZ, 'supabase-migration-934-versiones-a-mano.sql')

console.log('── 1. La base ──')
{
  const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q']
  const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 60000 })
  const hay = psql(['-c', 'select 1'])
  check('hay un PostgreSQL en /var/tmp:5433 donde probar', hay.status === 0, (hay.stderr || '').slice(0, 120))
  if (hay.status === 0) {
    psql(['-c', 'drop database if exists prueba_934'])
    psql(['-c', 'create database prueba_934'])
    // Encima de la 885 (las correcciones y su disparador), que es lo que hay
    // en producción.
    for (const f of [join(AQUI, 'sql-tanda-885.sql'), join(RAIZ, 'supabase-migration-885-catalogo-correcciones.sql'), join(AQUI, 'sql-tanda-934.sql'), MIGRACION]) {
      const r = psql(['-d', 'prueba_934', '-f', f])
      check(`carga ${f.split('/').pop()}`, r.status === 0, (r.stderr || '').split('\n').find((l) => /ERROR/.test(l)) || '')
    }
    const otra = psql(['-d', 'prueba_934', '-f', MIGRACION])
    check('la migración se puede ejecutar dos veces', otra.status === 0, (otra.stderr || '').split('\n').find((l) => /ERROR/.test(l)) || '')
    const r = psql(['-t', '-A', '-d', 'prueba_934', '-f', join(AQUI, 'sql-tanda-934-casos.sql')])
    const lineas = (r.stdout || '').split('\n').filter((l) => /^(ok|MAL) /.test(l))
    check('los casos se ejecutan', r.status === 0 && lineas.length >= 20, (r.stderr || '').slice(0, 300))
    for (const l of lineas) check(l.replace(/^(ok|MAL) /, ''), l.startsWith('ok'))
    psql(['-c', 'drop database if exists prueba_934'])
  }
}

console.log('\n── 2. Lo puro ──')
{
  const iv = await import(`${RAIZ}/js/mi-coleccion/iconos-version.js`)
  const v = await import(`${RAIZ}/js/mi-coleccion/variantes.js`)
  const { progresoDeSet } = await import(`${RAIZ}/js/mi-coleccion/progreso-set.js`)
  const datos = await import(`${RAIZ}/js/mi-coleccion/datos.js`)

  const svg = (k) => iv.iconoDeVersion(k).replace(/data-dibujo="[^"]*"/, '')
  check('la metálica, el sello y la estrella son tres dibujos nuevos y distintos', new Set([svg('metalica'), svg('sello'), svg('estrella'), svg('normal'), svg('holo')]).size === 5)
  const malos = iv.ICONOS_A_ELEGIR.filter(([k]) => !/<svg|<img/.test(iv.iconoDeVersion(k)))
  check('cada icono que se ofrece en /admin pinta algo', iv.ICONOS_A_ELEGIR.length >= 8 && !malos.length, malos.map(([k]) => k).join())

  // Lo que se ELIGE manda sobre lo que se deduciría del nombre.
  const charizard = { id: 'base1-4', set_id: 'base1', variants: { holo: true } }
  const metal = { tcggo_id: -1, card_id: 'base1-4', set_id: 'base1', etiqueta: 'Metálica', icono: 'metalica', clase: 'adicional', origen: 'mano', imagen: 'https://x/metal.png', link_cm: 'https://www.cardmarket.com/es/Pokemon/Products/Singles/x' }
  const dia = { tcggo_id: -2, card_id: 'base1-4', set_id: 'base1', etiqueta: 'Pokémon Day', icono: 'sello', clase: 'sello', origen: 'mano' }
  v.pegarVersiones([charizard], [metal, dia])
  check('el icono elegido a mano es el que se pinta (no el genérico por el nombre)', iv.dibujoDeVersion('metalica').clave === 'metalica' && iv.dibujoDeVersion(v.varianteDeEtiqueta('Pokémon Day')).clave === 'sello', `${iv.dibujoDeVersion('metalica').clave} ${iv.dibujoDeVersion('pokemon-day').clave}`)
  const ids = v.variantesDeCarta(charizard).map((x) => `${x.nuestro}:${x.clase || '-'}`).join()
  check('la carta ofrece su holo y detrás las dos a mano, con su clase', ids === 'holo:-,metalica:adicional,pokemon-day:sello', ids)
  check('versionDeVariante da la fila entera (foto, «Salió en»…)', v.versionDeVariante(charizard, 'metalica')?.imagen === 'https://x/metal.png')

  // La regla de la 931 no la dispara una de a mano: un sello no dice nada
  // de si la carta tiene Reverse.
  const pika = { id: 'sv5-51', set_id: 'sv5', variants: { normal: true, reverse: true }, versiones: [{ etiqueta: 'Pokémon Day', clase: 'sello', origen: 'mano' }] }
  const idsPika = v.variantesDeCarta(pika).map((x) => x.nuestro).join()
  check('una versión a mano no le quita la Reverse a la carta (la regla de la 931 es de TCGGO)', idsPika === 'normal,reverse,pokemon-day', idsPika)
  const conTcggo = { ...pika, versiones: [{ etiqueta: 'Poké Ball' }, ...pika.versiones] }
  check('  …y una de TCGGO sí sigue mandando', v.variantesDeCarta(conTcggo).map((x) => x.nuestro).join() === 'normal,poke-ball,pokemon-day', v.variantesDeCarta(conTcggo).map((x) => x.nuestro).join())

  check('cuentaParaMaestro: impresión y lo de TCGGO sí; sello y adicional no', v.cuentaParaMaestro({ clase: 'impresion' }) && v.cuentaParaMaestro({}) && v.cuentaParaMaestro({ clase: null }) && !v.cuentaParaMaestro({ clase: 'sello' }) && !v.cuentaParaMaestro({ clase: 'adicional' }))
  const otra = { id: 'base1-5', set_id: 'base1', variants: { holo: true }, versiones: [{ etiqueta: 'Metal Cosmos', clase: 'impresion', origen: 'mano' }] }
  const p = progresoDeSet({ cartas: [charizard, otra], set: { card_count_official: 102 }, tengo: () => 0 })
  check('el maestro de Base Set no pide la metálica ni el sello, y sí una impresión a mano', p.maestro.total === 3, JSON.stringify(p))

  // El precio: una a mano sin cifras no toma prestado el de la carta.
  datos.registrarVersiones([metal, { tcggo_id: -3, card_id: 'base1-4', set_id: 'base1', etiqueta: 'Con precio', origen: 'mano', cm_low: 12.5 }])
  const guardados = new Map([['base1-4', { card_id: 'base1-4', cm_low: 300, cm_low_es: 300, checked_at: '2026-10-21T10:00:00Z' }]])
  const pm = datos.precioDeLinea({ card_id: 'base1-4', variante: 'metalica' }, guardados, new Map())
  check('la metálica sin precio NO vale lo que el Charizard de Base Set', !datos.tieneCifras(pm), JSON.stringify(pm))
  check('  …y lleva su enlace a Cardmarket', pm?.url === metal.link_cm, JSON.stringify(pm))
  const pc = datos.precioDeLinea({ card_id: 'base1-4', variante: 'con-precio' }, guardados, new Map())
  check('una a mano con cifra (de su id de TCGGO) da la suya', datos.tieneCifras(pc) && pc.desde === 12.5, JSON.stringify(pc))
  const ph = datos.precioDeLinea({ card_id: 'base1-4', variante: 'holo' }, guardados, new Map())
  check('  …y la holo de siempre sigue con la de la carta', ph?.desde === 300, JSON.stringify(ph))
}

// ── La pantalla ──
const METAL = 'https://ejemplo.supabase.co/storage/v1/object/public/guide-images/admin-1/metal.png'
const SETS = [{ id: 'base1', name: 'Base Set', name_en: 'Base Set', serie_id: 'base', market: 'WEST', release_date: '1999-01-09', card_count_official: 102, card_count_total: 102 }]
const CARTAS = [
  { id: 'base1-4', market: 'WEST', set_id: 'base1', local_id: '4', name: 'Charizard', name_es: 'Charizard', image_path: 'base/base1/4', rarity: 'Rare Holo', category: 'Pokemon', dex_ids: [6], variants: { holo: true }, origen: null, tcg_sets: { id: 'base1', name: 'Base Set', serie_id: 'base', release_date: '1999-01-09', card_count_official: 102 } },
  { id: 'base1-4b', market: 'WEST', set_id: 'base1', local_id: '4', name: 'Charizard', name_es: 'Charizard', image_path: null, rarity: 'Rare Holo', category: 'Pokemon', dex_ids: [6], variants: { holo: true }, origen: 'tcggo', tcg_sets: { id: 'base1', name: 'Base Set', serie_id: 'base', release_date: '1999-01-09', card_count_official: 102 } },
]
const PRECIOS = [{ card_id: 'base1-4', cm_low: 300, cm_low_es: 300, checked_at: '2026-10-21T10:00:00Z' }]
const VERSIONES = [
  { tcggo_id: -1, market: 'WEST', card_id: 'base1-4', set_id: 'base1', numero: null, etiqueta: 'Metálica', icono: 'metalica', imagen: METAL, salio_en: 'Celebrations Ultra-Premium Collection', lanzamiento: '2021-10-22', clase: 'adicional', origen: 'mano', link_cm: 'https://www.cardmarket.com/es/Pokemon/Products/Singles/x', cm_low: null },
]
const COLECCION = [
  { id: 'a', user_id: 'user-1', card_id: 'base1-4', market: 'WEST', idioma: 'en', estado: 'NM', variante: 'holo', cantidad: 1 },
  { id: 'b', user_id: 'user-1', card_id: 'base1-4', market: 'WEST', idioma: 'en', estado: 'NM', variante: 'metalica', cantidad: 1 },
  { id: 'c', user_id: 'user-2', card_id: 'base1-4b', market: 'WEST', idioma: 'en', estado: 'NM', variante: 'holo', cantidad: 2 },
]
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64')
const browser = await chromium.launch()
// /admin lee `navigator.serviceWorker`, que con el worker bloqueado da un
// SecurityError que no es de la web: allí se deja como en la 885.
const contexto = async (sesion, { sinWorker = true } = {}) => {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: 'es-ES', ...(sinWorker ? { serviceWorkers: 'block' } : {}) })
  await ctx.addInitScript((d) => {
    window.__FAKE_SESSION__ = d.sesion
    try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())) } catch {}
    Object.assign(window, { __FAKE_SETS__: d.SETS, __FAKE_CARTAS__: d.CARTAS, __FAKE_PRECIOS__: d.PRECIOS, __FAKE_COLECCION__: d.COLECCION, __FAKE_VERSIONES__: d.VERSIONES, __FAKE_ERAS__: [] })
  }, { sesion, SETS, CARTAS, PRECIOS, COLECCION, VERSIONES })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|raw\.githubusercontent|api\.tcgdex\.net|ejemplo\.supabase\.co/, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }))
  await ctx.route(/\/\.netlify\/functions\//, (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }))
  const p = await ctx.newPage()
  const errores = []
  p.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  return { ctx, p, errores }
}

console.log('\n── 3. Mi colección: la metálica se ve metálica ──')
{
  const { ctx, p, errores } = await contexto('user-1')
  await p.goto(`${BASE}/mi-coleccion.html?ver=album&set=base1`, { waitUntil: 'domcontentloaded' })
  await p.waitForFunction(() => document.querySelectorAll('#mcAlbum [data-carta]').length > 0, null, { timeout: 10000 }).catch(() => {})
  await p.waitForTimeout(1200)
  await p.click('#mcVistaVariantes')
  await p.waitForTimeout(600)
  const casillas = await p.evaluate(() => [...document.querySelectorAll('#mcAlbum .mc-bolsillo-enlace[data-carta="base1-4"]')].map((a) => ({
    v: a.dataset.variante, src: a.querySelector('img')?.getAttribute('src') || '', dibujo: a.querySelector('.mc-chapa-variante [data-dibujo]')?.dataset.dibujo || null,
  })))
  const deMetal = casillas.find((c) => c.v === 'metalica')
  check('separadas: el Charizard tiene su casilla holo y la metálica', casillas.map((c) => c.v).join() === 'holo,metalica', JSON.stringify(casillas))
  check('  …la metálica con SU foto', deMetal?.src === METAL, JSON.stringify(deMetal))
  check('  …y su dibujo, el elegido', deMetal?.dibujo === 'metalica', JSON.stringify(deMetal))
  check('  …y la holo con la de siempre', casillas.find((c) => c.v === 'holo')?.src !== METAL)

  await p.click('#mcAlbum .mc-bolsillo-enlace[data-carta="base1-4"][data-variante="metalica"]', { position: { x: 20, y: 60 } })
  await p.waitForFunction(() => document.getElementById('mcEditor')?.open, null, { timeout: 5000 }).catch(() => {})
  await p.waitForTimeout(1200)
  const ficha = await p.evaluate(() => ({
    foto: document.querySelector('#mcEdFoto img')?.getAttribute('src') || '',
    filas: [...document.querySelectorAll('#mcEdTabla .mc-fila')].map((f) => `${f.querySelector('small')?.textContent}=${f.querySelector('b')?.textContent}`),
  }))
  check('la ficha de la copia metálica enseña la foto de la metálica', ficha.foto === METAL, ficha.foto)
  check('  …con «Salió en: Celebrations Ultra-Premium Collection» la primera', ficha.filas[0] === 'Salió en=Celebrations Ultra-Premium Collection', ficha.filas.join(' | '))
  check('  …su clase', ficha.filas.includes('Versión=Adicional'), ficha.filas.join(' | '))
  check('  …y la fecha de SU lanzamiento, no la de Base Set', ficha.filas.some((f) => /^Salió=22 de octubre de 2021/.test(f)), ficha.filas.join(' | '))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('\n── 4. /admin: crear, editar y borrar versiones; borrar una carta con dueño ──')
{
  const { ctx, p, errores } = await contexto('admin-1', { sinWorker: false })
  const rpcs = (n) => p.evaluate((x) => (window.__RPCS__ || []).filter((r) => r.nombre === x), n)
  const tabla = (t) => p.evaluate((n) => window.__TABLAS__[n], t)
  await p.goto(`${BASE}/admin/`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(1800)
  await p.locator('[data-section="colecciones"]').click()
  await p.waitForTimeout(500)
  await p.locator('#coleccionesMercado').selectOption('WEST').catch(() => {})
  await p.waitForTimeout(500)
  await p.locator('[data-editar="base1"]').click()
  await p.waitForTimeout(300)
  await p.locator('#colCartas').click()
  await p.waitForTimeout(800)
  check('cada carta de la lista ofrece «Borrar»', (await p.locator('[data-borrar-carta]').count()) === 2)

  await p.locator('[data-editar-carta="base1-4"]').click()
  await p.waitForTimeout(800)
  const caja = await p.locator('#catVersiones').innerText()
  check('la ficha de la carta lista sus versiones: la metálica, «a mano»', /Metálica/.test(caja) && /a mano/.test(caja) && /Celebrations/.test(caja), caja)
  check('  …con su «Editar» y el botón de una nueva', (await p.locator('[data-editar-version="-1"]').count()) === 1 && (await p.locator('#catNuevaVersion').isVisible()))

  // Nueva: el sello de Pokémon Day.
  await p.locator('#catNuevaVersion').click()
  await p.waitForTimeout(300)
  await p.locator('#catVerGuardar').click()
  await p.waitForTimeout(300)
  check('sin nombre no se crea', (await rpcs('catalogo_version_mano')).length === 0)
  await p.locator('#catVer_etiqueta').fill('Pokémon Day')
  await p.locator('#catVer_icono').selectOption('sello')
  check('el icono elegido se ve al lado', (await p.locator('#catVerIconoVer [data-dibujo]').getAttribute('data-dibujo')) === 'sello')
  await p.locator('#catVer_clase').selectOption('sello')
  await p.locator('#catVer_salio_en').fill('Pokémon Day 2024')
  await p.locator('#catVer_lanzamiento').fill('2024-02-27')
  await p.locator('#catVerFotoFichero').setInputFiles({ name: 'sello.png', mimeType: 'image/png', buffer: PNG })
  await p.waitForTimeout(500)
  const foto = await p.locator('#catVer_imagen').inputValue()
  check('subir la foto rellena su dirección', /guide-images\/admin-1\//.test(foto), foto)
  await p.locator('#catVerGuardar').click()
  await p.waitForTimeout(800)
  let ll = await rpcs('catalogo_version_mano')
  check('crear llama a catalogo_version_mano sin id (nueva) y con los datos', ll.length === 1 && ll[0].args.p_tcggo_id === null && ll[0].args.p_card_id === 'base1-4' && ll[0].args.p_datos.clase === 'sello' && ll[0].args.p_datos.icono === 'sello' && ll[0].args.p_datos.imagen === foto && ll[0].args.p_datos.lanzamiento === '2024-02-27', JSON.stringify(ll))
  let versiones = await tabla('tcg_card_versions')
  const nueva = versiones.find((x) => x.etiqueta === 'Pokémon Day')
  check('  …y queda con id negativo, origen «mano»', nueva && nueva.tcggo_id < 0 && nueva.origen === 'mano', JSON.stringify(nueva))
  check('  …y vuelve a la ficha, ya en la lista', /Pokémon Day/.test(await p.locator('#catVersiones').innerText()))

  // Editar la metálica: cambia lo que se toque y conserva el id.
  await p.locator('[data-editar-version="-1"]').click()
  await p.waitForTimeout(300)
  check('el formulario trae lo que tenía', (await p.locator('#catVer_salio_en').inputValue()) === 'Celebrations Ultra-Premium Collection' && (await p.locator('#catVer_clase').inputValue()) === 'adicional' && (await p.locator('#catVer_icono').inputValue()) === 'metalica')
  await p.locator('#catVer_numero').fill('4/102')
  await p.locator('#catVerGuardar').click()
  await p.waitForTimeout(800)
  ll = await rpcs('catalogo_version_mano')
  check('guardar llama con SU id', ll.length === 2 && ll[1].args.p_tcggo_id === -1 && ll[1].args.p_datos.numero === '4/102', JSON.stringify(ll[1]))
  versiones = await tabla('tcg_card_versions')
  check('  …y la fila cambia', versiones.find((x) => x.tcggo_id === -1)?.numero === '4/102')

  // Borrar la metálica: alguien la tiene, así que la base dice que no.
  await p.locator('[data-editar-version="-1"]').click()
  await p.waitForTimeout(300)
  await p.locator('#catVerBorrar').click()
  await p.waitForTimeout(600)
  check('la que alguien tiene no se borra', (await tabla('tcg_card_versions')).some((x) => x.tcggo_id === -1))
  await p.locator('#catCancelar').click()
  await p.waitForTimeout(600)
  // La de Pokémon Day, sin dueño, sí.
  await p.locator(`[data-editar-version="${nueva.tcggo_id}"]`).click()
  await p.waitForTimeout(300)
  await p.locator('#catVerBorrar').click()
  await p.waitForTimeout(800)
  check('la de Pokémon Day, sin dueño, se borra', !(await tabla('tcg_card_versions')).some((x) => x.etiqueta === 'Pokémon Day') && (await rpcs('catalogo_borrar_version_mano')).length === 2)

  // Borrar la Charizard repetida (la de TCGGO), que tiene dos copias.
  await p.locator('#catAtras').click()
  await p.waitForTimeout(400)
  await p.locator('[data-borrar-carta="base1-4b"]').click()
  await p.waitForTimeout(600)
  const aviso = await p.locator('.cat-aviso-borrar').innerText().catch(() => '')
  check('antes de borrar dice quién la tiene', /1 persona/.test(aviso) && /2 copias/.test(aviso), aviso)
  const opciones = await p.locator('#catDestino optgroup').first().evaluate((g) => ({ rotulo: g.label, ids: [...g.querySelectorAll('option')].map((o) => o.value) }))
  check('  …y ofrece primero las del mismo número', opciones.rotulo === 'Con el mismo número' && opciones.ids.join() === 'base1-4', JSON.stringify(opciones))
  await p.locator('#catBorrarYa').click()
  await p.waitForTimeout(400)
  check('sin elegir a dónde van sus copias no se borra', (await rpcs('catalogo_borrar_carta')).length === 0)
  await p.locator('#catDestino').selectOption('base1-4')
  await p.locator('#catBorrarYa').click()
  await p.waitForTimeout(900)
  ll = await rpcs('catalogo_borrar_carta')
  check('borrar llama con el destino', ll.length === 1 && ll[0].args.p_id === 'base1-4b' && ll[0].args.p_destino === 'base1-4', JSON.stringify(ll))
  const lineas = await tabla('user_collection')
  check('  …las copias pasan a la otra carta', lineas.find((l) => l.id === 'c')?.card_id === 'base1-4', JSON.stringify(lineas.find((l) => l.id === 'c')))
  check('  …la carta ya no está y queda su lápida', !(await tabla('tcg_cards')).some((c) => c.id === 'base1-4b') && (await tabla('tcg_correcciones')).some((c) => c.id === 'base1-4b' && c.columna === '__borrada'))
  check('  …y la lista vuelve con una carta', (await p.locator('.cat-carta').count()) === 1)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n${fails} FALLAN` : '\nTodo en verde')
process.exit(fails ? 1 : 0)
