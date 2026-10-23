// Tanda 987 — las cartas repetidas de TCGGO, convertidas en versiones.
//
// PINGU, con el N's Darmanitan SVP 181 dos veces en las promos (la normal y
// la Staff): «¿no es mejor traernos solamente una y meterle dos variantes?»,
// y que el panel avise de cada repetida y él elija. Eligió lo recomendado:
// la lista propone y él decide; la Staff es un sello; la principal es la que
// ya teníamos.
//
// Cuatro mitades: la BASE (PostgreSQL de verdad: la lista, convertir, la
// misma carta, distintas y deshacer), lo PURO (las señales y los nombres que
// valen), lo que la WEB y la pasada de precios hacen con una versión
// «fundida», y la caja de /admin.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
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
const leer = (f) => readFileSync(join(RAIZ, f), 'utf8')
const MIGRACION = join(RAIZ, 'supabase-migration-987-repetidas-en-versiones.sql')

console.log('── 1. La base ──')
{
  const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q']
  const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 60000 })
  const hay = psql(['-c', 'select 1'])
  check('hay un PostgreSQL en /var/tmp:5433 donde probar', hay.status === 0, (hay.stderr || '').slice(0, 120))
  if (hay.status === 0) {
    psql(['-c', 'drop database if exists prueba_987'])
    psql(['-c', 'create database prueba_987'])
    // Encima de la 885 (las correcciones y su disparador) y la 934 (la
    // lápida y la secuencia de ids negativos), que es lo que hay en producción.
    for (const f of [join(AQUI, 'sql-tanda-885.sql'), join(RAIZ, 'supabase-migration-885-catalogo-correcciones.sql'), join(AQUI, 'sql-tanda-934.sql'), join(RAIZ, 'supabase-migration-934-versiones-a-mano.sql'), join(AQUI, 'sql-tanda-987.sql'), MIGRACION]) {
      const r = psql(['-d', 'prueba_987', '-f', f])
      check(`carga ${f.split('/').pop()}`, r.status === 0, (r.stderr || '').split('\n').find((l) => /ERROR/.test(l)) || '')
    }
    const otra = psql(['-d', 'prueba_987', '-f', MIGRACION])
    check('la migración se puede ejecutar dos veces', otra.status === 0, (otra.stderr || '').split('\n').find((l) => /ERROR/.test(l)) || '')
    // En el SQL Editor cada sentencia va por su lado (631): nada de tablas
    // temporales en la migración.
    check('la migración no usa tablas temporales', !/create\s+temp(orary)?\s+table/i.test(readFileSync(MIGRACION, 'utf8')))
    const r = psql(['-t', '-A', '-d', 'prueba_987', '-f', join(AQUI, 'sql-tanda-987-casos.sql')])
    const lineas = (r.stdout || '').split('\n').filter((l) => /^(ok|MAL) /.test(l))
    check('los casos se ejecutan', r.status === 0 && lineas.length >= 30, (r.stderr || '').slice(0, 300))
    for (const l of lineas) check(l.replace(/^(ok|MAL) /, ''), l.startsWith('ok'))
    psql(['-c', 'drop database if exists prueba_987'])
  }
}

console.log('\n── 2. Lo puro ──')
{
  const r = await import(`${RAIZ}/admin/js/repetidas-puro.js`)
  const ataques = [{ name: 'Back Draft', damage: '30x', cost: ['Colorless', 'Colorless'] }]
  const normal = { id: 'svp-181', name: "N's Darmanitan", hp: 140, illustrator: 'Tetsu Kayama', attacks: ataques, cm_id_product_propio: 790001, precio: { cm_low_es: 6.5 }, personas: 3 }
  const staff = { id: 'tcggo-48211', name: "N's Darmanitan", hp: 140, illustrator: 'tetsu kayama', attacks: ataques, cm_id_product_propio: null, precio: { cm_id_product: 790002, cm_low: 7 }, personas: 1 }
  const s = r.senalesDelPar(normal, staff)
  const ver = (k) => s.find((x) => x.clave === k)
  check('las señales: número, nombre, PS, ataques, ilustrador (sin distinguir caja) y producto', s.map((x) => x.clave).join() === 'numero,nombre,ps,ataques,ilustrador,producto'
    && ver('ps').coincide === true && /140/.test(ver('ps').texto) && ver('ataques').coincide === true && ver('ilustrador').coincide === true, JSON.stringify(s))
  check('  …el producto sale del precio cuando la carta no lo lleva, y «otro producto» no es un fallo (es lo que tiene una versión)',
    ver('producto').coincide === false && ver('producto').aviso === true && /Otro producto/.test(ver('producto').texto))
  const sinDatos = r.senalesDelPar({ name: 'X' }, { name: 'X' })
  check('sin PS, ataques ni ilustrador se dice «no se sabe» (null), no «distintos»', sinDatos.filter((x) => x.coincide === null).length === 4, JSON.stringify(sinDatos))
  const otraHp = r.senalesDelPar(normal, { ...staff, hp: 120 })
  check('  …y unos PS distintos sí lo dicen', otraHp.find((x) => x.clave === 'ps').coincide === false && /140 y 120/.test(otraHp.find((x) => x.clave === 'ps').texto))
  check('sugerencia: otro producto → versión; el mismo → la misma carta',
    r.sugerencia(normal, staff) === 'version' && r.sugerencia(normal, { ...staff, cm_id_product_propio: 790001 }) === 'misma' && r.sugerencia({}, {}) === 'version')
  check('un nombre de versión vale si no es de las de siempre', r.etiquetaValida('Staff') && r.etiquetaValida('Sello de evento') && !r.etiquetaValida('Reverse Holo')
    && !r.etiquetaValida('normal') && !r.etiquetaValida('Holo') && !r.etiquetaValida('  ') && !r.etiquetaValida('1st Edition') && !r.etiquetaValida('x'.repeat(41)))
  const g = { market: 'WEST', set_id: 'svp', numero: '181', nombre: "n's darmanitan", set: { name: 'SVP Black Star Promos' }, cartas: [normal, staff] }
  check('la principal: la elegida si es del grupo; si no, la primera', r.principalDe(g) === 'svp-181' && r.principalDe(g, 'tcggo-48211') === 'tcggo-48211' && r.principalDe(g, 'otra') === 'svp-181')
  check('la clase: no cuenta → sello; cuenta → impresión', r.claseDe(false) === 'sello' && r.claseDe(true) === 'impresion')
  check('precio y quién la tiene, en una frase', r.precioCorto(normal).replace(/\s/g, ' ') === '6,50 €' && r.precioCorto({}) === 'sin precio' && r.quienLaTiene(normal) === '3 personas la tienen' && r.quienLaTiene(staff) === '1 persona la tiene' && r.quienLaTiene({}) === 'nadie la tiene')
  check('el filtro busca por colección y por carta', r.filtrarGrupos([g], 'black star').length === 1 && r.filtrarGrupos([g], 'darman').length === 1 && r.filtrarGrupos([g], 'pikachu').length === 0 && r.filtrarGrupos([g], '').length === 1)
  check('la clave de un grupo es la de la base (catálogo, colección, número, nombre)', r.claveDeGrupo(g) === "WEST|svp|181|n's darmanitan")
  check('las etiquetas de un toque, y la Staff la primera', r.ETIQUETAS[0] === 'Staff' && r.ETIQUETAS.every((t) => r.etiquetaValida(t)))
}

console.log('\n── 3. La web y la pasada de precios con una versión «fundida» ──')
{
  const v = await import(`${RAIZ}/js/mi-coleccion/variantes.js`)
  const carta = { id: 'svp-181', set_id: 'svp', rarity: 'Promo', variants: { holo: true } }
  v.pegarVersiones([carta], [{ tcggo_id: -9, card_id: 'svp-181', set_id: 'svp', etiqueta: 'Staff', clase: 'sello', origen: 'fundida', imagen: 'https://tcggo/staff.png', cm_low: 7 }])
  const ids = v.variantesDeCarta(carta).map((x) => `${x.nuestro}:${x.clase || '-'}`).join()
  check('la carta ofrece su versión de siempre y detrás la Staff, como sello', /^holo:-,staff:sello$/.test(ids) || /^normal:-,staff:sello$/.test(ids), ids)
  check('  …la Staff no cuenta para completar la colección', !v.cuentaParaMaestro(v.variantesDeCarta(carta).find((x) => x.nuestro === 'staff')))
  check('  …y su fila trae la foto de la que era', v.versionDeVariante(carta, 'staff')?.imagen === 'https://tcggo/staff.png')
  const datos = await import(`${RAIZ}/js/mi-coleccion/datos.js`)
  datos.registrarVersiones([{ tcggo_id: -9, card_id: 'svp-181', set_id: 'svp', etiqueta: 'Staff', origen: 'fundida', cm_low: 7, cm_low_es: 7 }])
  const p = datos.precioDeLinea({ card_id: 'svp-181', variante: 'staff' }, new Map([['svp-181', { card_id: 'svp-181', cm_low: 6.5, cm_low_es: 6.5, checked_at: '2026-10-23T10:00:00Z' }]]), new Map())
  check('la copia Staff vale lo de la Staff (7 €), no lo de la normal', datos.tieneCifras(p) && p.desde === 7, JSON.stringify(p))
  const precios = leer('netlify/functions/tcggo-precios.mjs')
  check('la pasada de precios pregunta también por las «fundida», por su producto', /origen=in\.\(edicion,tcgdex,fundida\)&cm_id_product=in\./.test(precios))
  const mc = leer('js/mi-coleccion.js')
  check('la ficha repinta la foto de una versión fundida al llegar sus versiones', /\['mano', 'fundida'\]\.includes\(versionDeVariante\(c, l\.variante\)\?\.origen\)/.test(mc))
  check('/admin rotula el origen de una versión fundida', /fundida: '/.test(leer('admin/js/catalogo-cartas.js')))
  check('la caja entra por import() al abrir Colecciones', /import\('\.\/repetidas\.js'\)\.then\(\(m\) => m\.iniciarRepetidas\(\)\)/.test(leer('admin/js/colecciones.js')))
  check('lo que cambia avisa a la web (la CDN de las cartas de un set)', (leer('admin/js/repetidas.js').match(/avisarALaWeb\(\)/g) || []).length >= 3)
}

// ── La pantalla ──
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64')
const SETS = [{ id: 'svp', name: 'SVP Black Star Promos', name_en: 'SVP Black Star Promos', serie_id: 'sv', market: 'WEST', release_date: '2023-03-31', card_count_official: 322, card_count_total: 322, tcg_online_code: 'SVP' }]
const ATAQUES = [{ name: 'Back Draft', damage: '30x', cost: ['Colorless', 'Colorless'] }]
const ts = { serie_id: 'sv', tcg_online_code: 'SVP', release_date: '2023-03-31' }
const REPETIDAS = () => ({
  grupos: [
    { market: 'WEST', set_id: 'svp', numero: '181', nombre: "n's darmanitan", set: { id: 'svp', name: 'SVP Black Star Promos' }, cartas: [
      { id: 'svp-181', market: 'WEST', set_id: 'svp', local_id: '181', name: "N's Darmanitan", hp: 140, illustrator: 'Tetsu Kayama', attacks: ATAQUES, image_path: 'sv/svp/181', cm_id_product_propio: 790001, precio: { cm_low_es: 6.5 }, personas: 3, tcg_sets: ts },
      { id: 'tcggo-48211', market: 'WEST', set_id: 'svp', local_id: '181', name: "N's Darmanitan", hp: 140, illustrator: 'Tetsu Kayama', attacks: ATAQUES, origen: 'tcggo', image_tcggo: 'https://images.tcggo.com/staff.png', cm_id_product_propio: 790002, precio: { cm_low_es: 7 }, personas: 1, tcg_sets: ts },
    ] },
    { market: 'WEST', set_id: 'svp', numero: '60', nombre: 'pikachu', set: { id: 'svp', name: 'SVP Black Star Promos' }, cartas: [
      { id: 'svp-060', market: 'WEST', set_id: 'svp', local_id: '060', name: 'Pikachu', hp: 60, image_path: 'sv/svp/060', cm_id_product_propio: 780001, precio: null, personas: 0, tcg_sets: ts },
      { id: 'tcggo-47701', market: 'WEST', set_id: 'svp', local_id: '60', name: 'Pikachu', hp: 60, origen: 'tcggo', image_tcggo: 'https://images.tcggo.com/pika.png', cm_id_product_propio: 780001, precio: null, personas: 0, tcg_sets: ts },
    ] },
    { market: 'WEST', set_id: 'svp', numero: '200', nombre: 'snorlax', set: { id: 'svp', name: 'SVP Black Star Promos' }, cartas: [
      { id: 'svp-200', market: 'WEST', set_id: 'svp', local_id: '200', name: 'Snorlax', hp: 150, image_path: 'sv/svp/200', personas: 0, tcg_sets: ts },
      { id: 'tcggo-200', market: 'WEST', set_id: 'svp', local_id: '200', name: 'Snorlax', hp: 150, origen: 'tcggo', image_tcggo: 'https://images.tcggo.com/snorlax.png', personas: 0, tcg_sets: ts },
    ] },
  ],
})

const browser = await chromium.launch()
const contexto = async ({ repetidas = true, ancho = 1366 } = {}) => {
  const ctx = await browser.newContext({ viewport: { width: ancho, height: 900 }, locale: 'es-ES' })
  await ctx.addInitScript((d) => {
    window.__FAKE_SESSION__ = 'admin-1'
    try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())) } catch {}
    Object.assign(window, { __FAKE_SETS__: d.SETS, __FAKE_CARTAS__: [], __FAKE_ERAS__: [] })
    if (d.R) window.__FAKE_REPETIDAS__ = d.R
  }, { SETS, R: repetidas ? REPETIDAS() : null })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|raw\.githubusercontent|api\.tcgdex\.net/, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }))
  await ctx.route(/\/\.netlify\/functions\//, (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }))
  const p = await ctx.newPage()
  const errores = []
  p.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await p.goto(`${BASE}/admin/`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(1800)
  await p.locator('[data-section="colecciones"]').click()
  await p.waitForTimeout(1200)
  return { ctx, p, errores }
}
const rpcs = (p, n) => p.evaluate((x) => (window.__RPCS__ || []).filter((r) => r.nombre === x), n)

console.log('\n── 4. /admin: la caja de las posibles repetidas ──')
{
  const { ctx, p, errores } = await contexto()
  const resumen = await p.locator('#repetidasResumen').innerText()
  check('la caja dice cuántas hay sin abrirla', /3 por revisar · 0 hechas · 0 distintas/.test(resumen), resumen)
  const pedida = await rpcs(p, 'catalogo_posibles_repetidas')
  check('  …y las pide del catálogo elegido', pedida.length >= 1 && pedida[0].args.p_market === 'WEST', JSON.stringify(pedida))
  await p.locator('#repetidasCaja > summary').click()
  await p.waitForTimeout(300)
  check('al abrirla, un grupo por repetida', (await p.locator('.rep-grupo').count()) === 3)
  const g1 = p.locator('.rep-grupo').first()
  const cab = await g1.locator('h3').innerText()
  check('  …con el nombre, la colección y el número', /N's Darmanitan/.test(cab) && /SVP Black Star Promos · 181/.test(cab), cab)
  check('  …la principal (la que ya teníamos) con su chapa, y las fotos de las dos', (await g1.locator('.rep-cuerpo > .rep-fig .rep-chapa').innerText()) === 'Principal'
    && (await g1.locator('img').count()) === 2 && /images\.tcggo\.com\/staff\.png/.test(await g1.locator('.rep-par img').getAttribute('src')))
  const senales = await g1.locator('.rep-senal').allInnerTexts()
  check('  …y las señales de verdad', senales.join('|') === 'Mismo número|Mismo nombre|Mismos PS (140)|Mismos ataques|Mismo ilustrador|Otro producto de Cardmarket', senales.join('|'))
  check('  …con el precio y quién la tiene', /7,00\s€ · 1 persona la tiene/.test(await g1.locator('.rep-par figcaption').innerText()), await g1.locator('.rep-par figcaption').innerText())
  const version = g1.locator('[data-rep-hacer="version"]')
  check('«Es una versión» espera a que se elija el nombre', await version.isDisabled())
  check('  …y es el botón principal (otro producto), mientras que en el Pikachu (mismo producto) lo es «la misma carta»',
    /btn-primary/.test(await version.getAttribute('class')) && /btn-primary/.test(await p.locator('.rep-grupo').nth(1).locator('[data-rep-hacer="misma"]').getAttribute('class'))
    && /mismo producto de Cardmarket/.test(await p.locator('.rep-grupo').nth(1).innerText()))
  await g1.locator('[data-rep-etiqueta="Staff"]').click()
  check('elegir «Staff» lo marca y deja convertir', (await p.locator('.rep-grupo').first().locator('[data-rep-etiqueta="Staff"]').getAttribute('aria-pressed')) === 'true'
    && !(await p.locator('.rep-grupo').first().locator('[data-rep-hacer="version"]').isDisabled()))
  check('  …y la barra ofrece convertir las marcadas (1)', (await p.locator('#repetidasLote').innerText()) === 'Convertir las marcadas (1)')
  await p.locator('.rep-grupo').first().locator('[data-rep-hacer="version"]').click()
  await p.waitForTimeout(600)
  const ll = await rpcs(p, 'catalogo_repetida_resolver')
  check('convertir llama con la repetida, la principal, «Staff», sello y la foto de la repetida',
    ll.length === 1 && ll[0].args.p_carta === 'tcggo-48211' && ll[0].args.p_destino === 'svp-181' && ll[0].args.p_market === 'WEST' && ll[0].args.p_decision === 'version'
    && ll[0].args.p_etiqueta === 'Staff' && ll[0].args.p_clase === 'sello' && ll[0].args.p_imagen === 'https://images.tcggo.com/staff.png', JSON.stringify(ll))
  check('  …el grupo se va y la cuenta lo dice', (await p.locator('.rep-grupo').count()) === 2 && /2 por revisar · 1 hechas/.test(await p.locator('#repetidasResumen').innerText()))
  check('  …con un aviso que deja deshacer', /versión «Staff» de svp-181\s*Deshacer/.test((await p.locator('.toast').allInnerTexts()).join(' ')))

  // «Hechas» → Deshacer.
  await p.locator('[data-rep-vista="hechas"]').click()
  const fila = await p.locator('.rep-fila').first().innerText()
  check('«Hechas» la enseña con lo que se hizo', /N's Darmanitan/.test(fila) && /tcggo-48211/.test(fila) && /versión «Staff» de svp-181/.test(fila), fila)
  await p.locator('[data-rep-deshacer]').first().click()
  await p.waitForTimeout(600)
  const dd = await rpcs(p, 'catalogo_repetida_deshacer')
  check('deshacer llama con su número y el grupo vuelve', dd.length === 1 && dd[0].args.p_hecha === 1 && /3 por revisar · 0 hechas/.test(await p.locator('#repetidasResumen').innerText()), JSON.stringify(dd))

  // «Hacer principal», «Otra…» y «cuenta para completar».
  await p.locator('[data-rep-vista="revisar"]').click()
  const darm = p.locator('.rep-grupo', { hasText: "N's Darmanitan" })
  await darm.locator('[data-rep-principal="tcggo-48211"]').click()
  check('«Hacer principal» cambia la principal', (await darm.locator('.rep-cuerpo > .rep-fig code').innerText()) === 'tcggo-48211' && (await darm.locator('.rep-par code').innerText()) === 'svp-181')
  await darm.locator('[data-rep-otra]').click()
  const campo = darm.locator('.rep-otra')
  check('«Otra…» abre el campo con el foco', await campo.evaluate((e) => e === document.activeElement))
  await campo.pressSequentially('Reverse')
  check('  …un nombre de siempre no deja convertir', await darm.locator('[data-rep-hacer="version"]').isDisabled())
  await campo.fill('')
  await campo.pressSequentially('Pokémon Day 2024')
  check('  …uno nuevo sí, sin perder el foco mientras se escribe', !(await darm.locator('[data-rep-hacer="version"]').isDisabled()) && (await campo.evaluate((e) => e === document.activeElement)))
  await darm.locator('[data-rep-cuenta]').check()
  await darm.locator('[data-rep-hacer="version"]').click()
  await p.waitForTimeout(600)
  const l2 = (await rpcs(p, 'catalogo_repetida_resolver'))[1]
  check('  …y se convierte al revés, con ese nombre y como impresión (cuenta)', l2?.args.p_carta === 'svp-181' && l2.args.p_destino === 'tcggo-48211' && l2.args.p_etiqueta === 'Pokémon Day 2024' && l2.args.p_clase === 'impresion', JSON.stringify(l2))

  // «Es la misma carta» en el Pikachu.
  await p.locator('.rep-grupo', { hasText: 'Pikachu' }).locator('[data-rep-hacer="misma"]').click()
  await p.waitForTimeout(600)
  const l3 = (await rpcs(p, 'catalogo_repetida_resolver'))[2]
  check('«Es la misma carta» llama sin nombre ni foto', l3?.args.p_decision === 'misma' && l3.args.p_carta === 'tcggo-47701' && l3.args.p_destino === 'svp-060' && l3.args.p_etiqueta === null && l3.args.p_imagen === null, JSON.stringify(l3))

  // «Son distintas» y volver a revisarlas.
  await p.locator('.rep-grupo', { hasText: 'Snorlax' }).locator('[data-rep-distintas]').click()
  await p.waitForTimeout(600)
  const di = await rpcs(p, 'catalogo_repetidas_distintas')
  check('«Son cartas distintas» manda el grupo entero', di.length === 1 && di[0].args.p_set === 'svp' && di[0].args.p_numero === '200' && di[0].args.p_nombre === 'snorlax' && di[0].args.p_ids.join() === 'svp-200,tcggo-200', JSON.stringify(di))
  check('  …y deja de salir', (await p.locator('.rep-grupo').count()) === 0 && /0 por revisar · 2 hechas · 1 distintas/.test(await p.locator('#repetidasResumen').innerText()), await p.locator('#repetidasResumen').innerText())
  check('  …y sin nada por revisar lo dice', /No hay repetidas en este catálogo/.test(await p.locator('#repetidasLista').innerText()))
  await p.locator('[data-rep-vista="distintas"]').click()
  await p.locator('[data-rep-quitar]').click()
  await p.waitForTimeout(600)
  check('«Volver a revisarlas» las devuelve', /1 por revisar · 2 hechas · 0 distintas/.test(await p.locator('#repetidasResumen').innerText()), await p.locator('#repetidasResumen').innerText())
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('\n── 5. /admin: convertir varias de una vez, y en el móvil ──')
{
  const { ctx, p, errores } = await contexto({ ancho: 390 })
  await p.locator('#repetidasCaja > summary').click()
  await p.waitForTimeout(300)
  await p.locator('.rep-grupo', { hasText: "N's Darmanitan" }).locator('[data-rep-etiqueta="Staff"]').click()
  await p.locator('.rep-grupo', { hasText: 'Snorlax' }).locator('[data-rep-etiqueta="Prerelease"]').click()
  check('la barra cuenta las que tienen nombre elegido', (await p.locator('#repetidasLote').innerText()) === 'Convertir las marcadas (2)')
  const ancho = await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)
  check('en el móvil no se sale de la pantalla', ancho)
  await p.locator('#repetidasLote').click()
  await p.waitForTimeout(1200)
  const ll = await rpcs(p, 'catalogo_repetida_resolver')
  check('convierte las dos, cada una con su nombre', ll.length === 2 && ll.map((x) => `${x.args.p_carta}:${x.args.p_etiqueta}`).sort().join() === 'tcggo-200:Prerelease,tcggo-48211:Staff', JSON.stringify(ll.map((x) => x.args)))
  check('  …y queda solo el Pikachu', (await p.locator('.rep-grupo').count()) === 1 && /2 de 2 convertidas/.test((await p.locator('.toast').allInnerTexts()).join(' ')), `${await p.locator('.rep-grupo').count()} ${await p.locator('.toast').allInnerTexts()}`)
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('\n── 6. /admin sin la migración ──')
{
  const { ctx, p, errores } = await contexto({ repetidas: false })
  check('la caja lo dice en el resumen', /sin la migración/.test(await p.locator('#repetidasResumen').innerText()))
  await p.locator('#repetidasCaja > summary').click()
  check('  …y dentro, qué fichero hay que ejecutar', /supabase-migration-987-repetidas-en-versiones\.sql/.test(await p.locator('#repetidasLista').innerText()))
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} fallos` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
