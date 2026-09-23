// Tanda 335 — el nombre en español va en su propia columna, y la chapa
// de si la carta se puede jugar hoy.
//
// El fallo: al engordar en español (tanda 330) el nombre traducido se
// escribía ENCIMA de `tcg_cards.name`. Y ese nombre no es una etiqueta,
// es la CLAVE con la que se cruzan tres cosas que vienen en inglés —
// `tcg_card_play` (que se construye con decklists de TCG Live), el
// respaldo del resolutor de decklists y la huella de las reimpresiones.
//
// Es la misma lección de la 334, un piso más abajo: **lo que se GUARDA
// como clave es canónico; lo que se ENSEÑA va traducido.** Y el síntoma
// era el de siempre — el bloque «En los torneos de PokeDoc» no podía
// casar NUNCA para una carta traducida, y desaparecía sin dar error.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync } from 'node:fs'
import {
  nombreDeCarta, claveDeJuego, rutaDeCarta, esLaMismaCarta,
  legalidadEstandar, nucleoDeCarta,
} from '/home/user/pingu/js/carta-nucleo.js'
import { esEnergiaBasica, canonizarCarta } from '/home/user/pingu/js/carta-detalle.js'
import { nombresPorArreglar } from '/home/user/pingu/netlify/lib/carta-detalle.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 220) : ''}`)
}
const BASE = 'http://localhost:8892'
const limpio = (t) => String(t || '').replace(/\s+/g, ' ').trim()
const leer = (f) => readFileSync(`/home/user/pingu/${f}`, 'utf8')
const browser = await chromium.launch()

// La carta del fallo, tal y como queda DESPUÉS de esta tanda.
const JEFE = {
  id: 'sv3-172', set_id: 'sv3', market: 'WEST', local_id: '172',
  name: "Boss's Orders", name_es: 'Órdenes del jefe',
  image_path: 'sv/sv3/172', category: 'Entrenador', trainer_type: 'Partidario',
  rarity: 'Rara', regulation_mark: 'G', detalle_at: 'x', detalle_lang: 'es',
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. Se ENSEÑA el español, se CRUZA el inglés ──')
{
  check('el nombre que se pinta es el español', nombreDeCarta(JEFE) === 'Órdenes del jefe', nombreDeCarta(JEFE))
  check('la clave de cruce sigue siendo la inglesa',
    claveDeJuego(JEFE) === "boss's orders", claveDeJuego(JEFE))
  check('la dirección se hace con el español',
    rutaDeCarta(JEFE) === '/carta/ordenes-del-jefe-sv3-172', rutaDeCarta(JEFE))

  // Y sin traducir, todo sigue igual que antes: son 3.596 fichas así.
  const sinTraducir = { ...JEFE, name_es: null }
  check('sin traducción se pinta el inglés', nombreDeCarta(sinTraducir) === "Boss's Orders")
  check('…y la dirección sale del inglés',
    rutaDeCarta(sinTraducir) === '/carta/boss-s-orders-sv3-172', rutaDeCarta(sinTraducir))
  // Una cadena vacía es «no traducida», no «se llama así».
  check('un name_es vacío no deja la ficha sin nombre',
    nombreDeCarta({ ...JEFE, name_es: '   ' }) === "Boss's Orders")

  // Lo que el fallo rompía: que la clave NO dependa del idioma.
  check('la clave no cambia al traducir',
    claveDeJuego(JEFE) === claveDeJuego({ ...JEFE, name_es: null }))
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. La huella tampoco se entera del idioma ──')
{
  const es = { name: 'Mew ex', name_es: 'Mew ex', hp: 160, category: 'Pokémon', stage: 'Básico',
    types: ['Psíquico'], detalle_lang: 'es',
    attacks: [{ name: 'Explosión Teleportadora', cost: ['Psíquico'], damage: '30' }] }
  const en = { name: 'Mew ex', hp: 160, category: 'Pokemon', stage: 'Basic', types: ['Psychic'],
    detalle_lang: 'en', attacks: [{ name: 'Teleportation Burst', cost: ['Psychic'], damage: '30' }] }
  check('la misma carta en dos idiomas sigue siendo la misma', esLaMismaCarta(es, en))
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. Nadie escribe el nombre traducido encima de `name` ──')
{
  // El origen del fallo, vigilado en el sitio donde estaba: la tarea
  // programada. Se mira el TEXTO porque el fichero es una función de
  // Netlify y no se puede importar aquí sin su entorno.
  const tarea = leer('netlify/functions/cartas-detalle.mjs')
  check('la tarea guarda el traducido en `name_es`', /detalle\.name_es\s*=/.test(tarea))
  check('…y no lo guarda en `name`', !/\bdetalle\.name\s*=[^=]/.test(tarea),
    tarea.match(/.*detalle\.name\s*=[^=].*/)?.[0])

  // ── Y la reparación de lo que ya se guardó mal ──
  //
  // El español está a salvo (lo copia la migración a `name_es`), pero el
  // inglés se perdió y solo lo tiene TCGdex. Se recupera del LISTADO de
  // un set, que trae el nombre de todas sus cartas: ~220 peticiones en
  // vez de 2.811.
  check('la tarea tiene fase de reparar nombres', /await repararNombresDeUnSet\(/.test(tarea))
  check('…y la saca del listado del set, no carta a carta', /urlDeSet\(setId, MERCADO\)/.test(tarea))
  check('…escribiendo el set entero de una vez', /resolution=merge-duplicates/.test(tarea))
  check('…y pidiendo solo las engordadas en español', /name_es=not\.is\.null/.test(tarea))
  // Y el set solo se marca como visto si de verdad se ha podido: si se
  // marcara igual, esas cartas se quedarían rotas para siempre; y si no
  // se marcara nunca, la fase se comería todas las pasadas.
  check('un set se marca como visto solo si se ha podido',
    /if \(cuantos !== null\) \{/.test(tarea),
    tarea.match(/.*if \((cuantos[^)]*|true|false)\) \{.*/)?.[0])

  // Y la decisión de QUÉ escribir se ejecuta de verdad, no se mira por
  // encima: es pura justo para eso.
  const listado = { cards: [
    { id: 'sv3-172', name: "Boss's Orders" },
    { id: 'sv3-186', name: 'Iono' },
    { id: 'sv3-999', name: 'Una que no tenemos' },
    { id: 'sv3-1', name: '   ' },
  ] }
  const arreglos = nombresPorArreglar(
    [{ id: 'sv3-172', name: 'Órdenes del jefe' }, { id: 'sv3-186', name: 'Iono' },
     { id: 'sv3-1', name: 'Pidgey' }],
    listado
  )
  check('se arregla la que tiene el nombre pisado',
    arreglos.length === 1 && arreglos[0].id === 'sv3-172' && arreglos[0].name === "Boss's Orders",
    JSON.stringify(arreglos))
  check('…y lleva el mercado, que es parte de la clave', arreglos[0]?.market === 'WEST')
  // Las tres que NO se tocan, y cada una por un motivo distinto.
  check('no se reescribe la que ya se llama igual', !arreglos.some((a) => a.id === 'sv3-186'))
  check('no se manda un id que no está en nuestra tabla', !arreglos.some((a) => a.id === 'sv3-999'))
  check('un nombre en blanco del listado no borra el nuestro', !arreglos.some((a) => a.id === 'sv3-1'))
  check('un listado vacío no propone nada', nombresPorArreglar([{ id: 'x', name: 'y' }], {}).length === 0)
  // Y lo que no puede pasar: que subir esto ANTES de ejecutar la
  // migración pare el engorde. PostgREST devuelve 400 —no null— si le
  // pides una columna que no existe.
  // Se comprueba la FORMA, no la distancia: la primera versión medía una
  // ventana de 200 caracteres y un comentario en medio la rompió sin que
  // el código cambiara. Lo que importa es que la consulta que pide la
  // columna nueva tenga detrás otra que no la pide.
  check('la columna nueva se pide…', /select=\$\{columnas\},names_fixed_at/.test(tarea))
  check('…y con vuelta atrás a una consulta sin ella',
    /\.catch\(\(\) =>[\s\S]*?select=\$\{columnas\}&market/.test(tarea))
  check('…y sin ella la fase se queda apagada',
    /s\.names_fixed_at === null/.test(tarea))

  const sqlRep = leer('supabase-migration-cartas-nombre-es.sql')
  check('la migración salva el español que ya está escrito',
    /set name_es = name[\s\S]{0,120}detalle_lang = 'es'/.test(sqlRep))
  check('…y NO borra detalle_lang, que es lo que marca cuáles son',
    !/detalle_lang\s*=\s*null/.test(sqlRep))
  check('…y marca ya los sets que no hay que repasar',
    /names_fixed_at = now\(\)[\s\S]{0,300}not exists/.test(sqlRep))

  // Y las dos columnas nuevas viajan en TODAS las consultas que pintan
  // un nombre: si a una se le olvida `name_es`, esa pantalla se queda en
  // inglés sin dar error.
  for (const f of ['js/carta.js', 'js/cartas.js', 'js/coleccion.js', 'netlify/edge-functions/meta-social.js']) {
    check(`${f} pide name_es`, /name_es/.test(leer(f)))
  }
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 4. El buscador busca por los dos, el cruce por uno ──')
{
  // `name_search` pasa a llevar los DOS idiomas pegados, para que se
  // encuentre escribiendo «órdenes» o escribiendo «boss». Pero entonces
  // deja de servir para CRUZAR exacto contra `tcg_card_play`, y el
  // sitemap —el único que cruzaba exacto— se habría quedado sin las
  // fichas traducidas sin dar error. Por eso el cruce se lleva su propia
  // columna.
  const sql = leer('supabase-migration-cartas-nombre-es.sql')
  check('la migración añade name_es', /add column if not exists name_es/.test(sql))
  check('name_search mira los dos idiomas',
    /name_search[\s\S]{0,400}coalesce\(name, ''\)[\s\S]{0,80}coalesce\(name_es, ''\)/.test(sql))
  // Se mira la EXPRESIÓN generada, no el texto de alrededor: los
  // comentarios de la migración hablan de las dos columnas y casarían
  // con cualquier cosa.
  const expr = (col) => sql.match(new RegExp(`add column ${col}[\\s\\S]*?generated always as \\(([\\s\\S]*?)\\) stored`))?.[1] || ''
  check('name_key mira SOLO el inglés',
    /immutable_unaccent\(lower\(coalesce\(name, ''\)\)\)/.test(expr('name_key')), expr('name_key'))
  check('…y no le cuela el español', expr('name_key') !== '' && !/name_es/.test(expr('name_key')), expr('name_key'))
  check('…y name_search sí lo lleva', /name_es/.test(expr('name_search')), expr('name_search'))

  const sitemap = leer('netlify/functions/sitemap.mjs')
  check('el sitemap cruza contra name_key', /name_key=in\./.test(sitemap))
  check('…y ya no contra name_search', !/name_search=in\./.test(sitemap))
  check('…y se lleva name_es para construir la dirección', /select=id,name,name_es,name_key/.test(sitemap))

  // Y que la columna esté vigilada: una migración sin ejecutar deja la
  // ficha en inglés y el buscador sin el español, y eso tiene que
  // cantarlo el barredor de esquema en vez de pasar en silencio.
  check('name_es está en la comprobación de esquema',
    /tcg_cards[^\n]*name_es[^\n]*cartas-nombre-es/.test(leer('js/schema-check.js')))
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 5. La chapa de si se puede jugar hoy ──')
{
  const L = { marcas: ['H', 'I', 'J'], reimpresion: false }
  check('con marca legal, dentro', legalidadEstandar({ regulation_mark: 'I' }, L)?.estado === 'legal')
  check('con marca vieja y sin reimpresión, fuera',
    legalidadEstandar({ regulation_mark: 'D' }, L)?.estado === 'fuera')
  check('con marca vieja pero con reimpresión, es ESTA impresión la que no vale',
    legalidadEstandar({ regulation_mark: 'D' }, { ...L, reimpresion: true })?.estado === 'reimpresion')
  // Desde 2022 el Estándar exige marca, así que no tenerla también deja
  // fuera — pero solo si SABEMOS que no la lleva, y eso es haberla
  // pedido (`detalle_at`).
  check('sin marca y con la ficha traída, fuera',
    legalidadEstandar({ detalle_at: 'x' }, L)?.estado === 'fuera')
  check('…salvo que haya reimpresión',
    legalidadEstandar({ detalle_at: 'x' }, { ...L, reimpresion: true })?.estado === 'reimpresion')

  // ── Y lo que costó un Mew ex recién salido (tanda 338) ──
  //
  // `regulation_mark` a null son DOS cosas que en la base se ven igual:
  // la carta no lleva marca, o no la hemos engordado todavía. Tratar la
  // segunda como la primera le ponía «No es legal en Estándar» a una
  // carta del set más nuevo que hay.
  check('sin marca y SIN engordar, no se afirma nada',
    legalidadEstandar({}, L) === null, JSON.stringify(legalidadEstandar({}, L)))
  check('…ni aunque haya una reimpresión legal',
    legalidadEstandar({}, { ...L, reimpresion: true }) === null)
  check('…y tampoco se pinta la chapa',
    !/carta-legal/.test(nucleoDeCarta({ id: 'x', name: 'Mew ex' }, null, null, L)))
  // Pero con marca sí se decide, esté engordada o no: la marca la puede
  // haber puesto el volcado de la tanda 215 sin que la ficha esté.
  check('con marca y sin engordar, sí se decide',
    legalidadEstandar({ regulation_mark: 'I' }, L)?.estado === 'legal')
  check('…y una marca vieja sin engordar también',
    legalidadEstandar({ regulation_mark: 'D' }, L)?.estado === 'fuera')

  // Y lo que NO se puede afirmar: si no se sabe, no se pinta. La lección
  // de la 319 — un defecto que convierte «no me lo han dado» en «no es
  // legal» le diría a alguien que no puede jugar una carta que sí.
  check('sin saber las marcas, no se afirma nada', legalidadEstandar({ regulation_mark: 'D' }, null) === null)
  check('…ni con una lista vacía', legalidadEstandar({ regulation_mark: 'D' }, { marcas: [] }) === null)
  check('y no se pinta ninguna chapa', !/carta-legal/.test(nucleoDeCarta({ id: 'x', name: 'X' }, null, null, null)))

  // Una energía básica se puede jugar SIEMPRE: es regla del juego, no
  // del formato. Y se reconoce también con la ficha en español.
  check('una energía básica está dentro lleve lo que lleve',
    legalidadEstandar({ category: 'Energía', energy_type: 'Normal', regulation_mark: 'A' }, L)?.estado === 'legal')
  check('…y una energía ESPECIAL no se cuela',
    legalidadEstandar({ category: 'Energía', energy_type: 'Especial', regulation_mark: 'A' }, L)?.estado === 'fuera')
  check('el tipo de energía también se canoniza',
    canonizarCarta({ energy_type: 'Especial' }).energy_type === 'Special')
  check('una carta sin engordar se reconoce por el nombre',
    esEnergiaBasica({ category: null, name: 'Basic Fire Energy' }))
  check('…y un Entrenador nunca es una energía', !esEnergiaBasica({ category: 'Entrenador', name: 'Basic Whatever' }))

  // La regla no está escrita dos veces: la ficha y el revisor de
  // decklists preguntan al mismo módulo. Si se separaran, una pantalla
  // diría que la carta vale y la otra que no.
  const revisor = leer('js/torneos/cartas-decklist.js')
  // Se comprueba que las DOS piezas vienen de ese import, no que el
  // fichero lo nombre en alguna parte: una copia local con el mismo
  // nombre pasaría lo segundo y no lo primero.
  const importa = revisor.match(/import \{([^}]*)\} from '\.\.\/carta-legalidad\.js'/)?.[1] || ''
  check('el revisor importa las marcas de la temporada', /\bmarcasLegales\b/.test(importa), importa)
  check('…y la regla de la reimpresión', /\bhayReimpresionLegal\b/.test(importa), importa)
  check('…y no se declara ninguna de las dos por su cuenta',
    !/(const|function|let)\s+(marcasLegales|hayReimpresionLegal)\b/.test(revisor),
    revisor.match(/.*(const|function|let)\s+(marcasLegales|hayReimpresionLegal)\b.*/)?.[0])
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 6. En la página: nombre español, datos de juego ingleses ──')
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 1200 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await page.addInitScript((d) => {
    window.__FAKE_SETS__ = [{ id: 'sv3', name: 'Obsidian Flames', market: 'WEST', card_count_official: 197 }]
    window.__FAKE_CARTAS__ = [d.carta]
    // La fila del agregado está en INGLÉS, porque se construye con
    // decklists de TCG Live. Este es el cruce que el fallo rompía.
    window.__FAKE_JUEGO__ = [{ name_key: "boss's orders", name: "Boss's Orders",
      decks: 18, total_copies: 34, tournaments: 6, archetypes: [{ nombre: 'Ceruledge', mazos: 7 }] }]
    window.__FAKE_AJUSTES__ = [{ key: 'torneos_reglas', value: { marcas_legales: ['H', 'I', 'J'] } }]
  }, { carta: JEFE })
  await page.goto(`${BASE}/carta/ordenes-del-jefe-sv3-172`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2400)

  check('sin errores', errores.length === 0, errores.join(' | '))
  check('el título de la ficha va en español',
    limpio(await page.locator('h1').first().textContent()) === 'Órdenes del jefe',
    await page.locator('h1').first().textContent().catch(() => '(no sale)'))
  check('…y la pestaña también', /Órdenes del jefe/.test(await page.title()), await page.title())

  // EL FALLO. Con el nombre traducido pisando `name`, este bloque
  // preguntaba por «órdenes del jefe» y el agregado tenía «boss s
  // orders»: no casaba nunca y desaparecía sin dar error.
  const juego = limpio(await page.locator('.carta-juego').textContent().catch(() => ''))
  check('sale el bloque de torneos', /18/.test(juego), juego || '(no sale)')

  // La chapa: marca G con las legales H/I/J y sin reimpresión → fuera.
  const chapa = await page.locator('.carta-legal').first()
  check('sale la chapa de legalidad', (await page.locator('.carta-legal').count()) === 1)
  check('…y dice que no es legal',
    /No es legal en Estándar/.test(limpio(await chapa.textContent().catch(() => ''))),
    limpio(await chapa.textContent().catch(() => '(no sale)')))
  check('…con su color de peligro',
    await chapa.evaluate((n) => n.classList.contains('carta-legal-fuera')).catch(() => false))
  // Y con estilo de verdad: si `css/carta.css` no llegara, la chapa
  // saldría como un párrafo suelto y nadie se enteraría.
  check('la hoja de la ficha llega',
    (await chapa.evaluate((n) => getComputedStyle(n).borderStyle).catch(() => '')) === 'solid')
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 6b. Y en la rejilla de una colección, también ──')
{
  // Aquí es donde se vio: en /coleccion la baldosa ponía «Boss's
  // Orders» mientras la ficha ponía «Órdenes del jefe». La rejilla la
  // pintan /cartas Y /coleccion con el mismo molde, así que estaban las
  // dos en inglés.
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  await page.addInitScript((d) => {
    window.__FAKE_SETS__ = [{ id: 'sv3', name: 'Llamas Obsidiana', market: 'WEST', card_count_official: 197 }]
    window.__FAKE_CARTAS__ = [d.carta]
  }, { carta: JEFE })
  await page.goto(`${BASE}/coleccion/sv3`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  const baldosa = limpio(await page.locator('.coleccion-carta-nombre').first().textContent().catch(() => ''))
  check('la baldosa de la rejilla va en español', baldosa === 'Órdenes del jefe', baldosa || '(no sale)')
  check('…y el enlace lleva al slug español',
    (await page.locator('.coleccion-carta').first().getAttribute('href')) === '/carta/ordenes-del-jefe-sv3-172')
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 7. …y con reimpresión legal, lo dice ──')
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 1200 } })
  await page.addInitScript((d) => {
    window.__FAKE_SETS__ = [{ id: 'sv3', name: 'Obsidian Flames', market: 'WEST', card_count_official: 197 }]
    // La misma carta con marca vieja, Y su reimpresión moderna.
    window.__FAKE_CARTAS__ = [d.carta, { ...d.carta, id: 'sv9-99', local_id: '099', regulation_mark: 'I' }]
    window.__FAKE_AJUSTES__ = [{ key: 'torneos_reglas', value: { marcas_legales: ['H', 'I', 'J'] } }]
  }, { carta: JEFE })
  await page.goto(`${BASE}/carta/ordenes-del-jefe-sv3-172`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2400)
  const chapa = limpio(await page.locator('.carta-legal').first().textContent().catch(() => ''))
  check('no la da por prohibida: hay otra impresión que sí vale',
    /Esta impresión no, pero sí una reimpresión/.test(chapa), chapa || '(no sale)')
  check('…y lo dice en ámbar, no en rojo',
    await page.locator('.carta-legal').first().evaluate((n) => n.classList.contains('carta-legal-reimpresion')).catch(() => false))
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 8. Y la chapa se LEE, en los dos temas ──')
{
  // La primera versión pintaba el texto del color del estado sobre su
  // fondo suave, y en claro se quedaba en 3,95 (`--danger` sobre
  // `--danger-bg`): por debajo del 4,5 que pide la WCAG a 14 px. No lo
  // habría cazado nadie — el medidor de la casa salta los fondos
  // translúcidos y el tema oscuro sí pasaba.
  //
  // Se mide COMPONIENDO el alfa sobre lo que hay detrás, que es lo que
  // ve el ojo. Un medidor que se salte los fondos translúcidos da por
  // bueno cualquier color.
  for (const tema of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
    await page.addInitScript((d) => {
      window.__FAKE_SETS__ = [{ id: 'sv3', name: 'Llamas Obsidiana', market: 'WEST', card_count_official: 197 }]
      window.__FAKE_CARTAS__ = [d.carta]
      window.__FAKE_AJUSTES__ = [{ key: 'torneos_reglas', value: { marcas_legales: ['H', 'I', 'J'] } }]
    }, { carta: JEFE })
    await page.goto(`${BASE}/carta/ordenes-del-jefe-sv3-172`, { waitUntil: 'domcontentloaded' })
    // El tema, DESPUÉS de cargar: en un `addInitScript` todavía no
    // existe `document.documentElement` y la excepción se llevaría por
    // delante los datos falsos.
    if (tema === 'dark') await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
    await page.waitForTimeout(2400)

    const medidas = await page.evaluate(() => {
      const partes = (c) => (c.match(/[\d.]+/g) || []).map(Number)
      const sobre = (frente, detras) => {
        const [r, g, b, a = 1] = frente
        if (a >= 1) return [r, g, b]
        return [0, 1, 2].map((i) => frente[i] * a + detras[i] * (1 - a))
      }
      // El fondo REAL: se recorre hacia arriba componiendo cada capa
      // translúcida sobre la siguiente, en vez de saltárselas.
      const fondoDe = (n) => {
        const capas = []
        for (let e = n; e; e = e.parentElement) {
          const c = partes(getComputedStyle(e).backgroundColor)
          if (c.length >= 3 && (c[3] === undefined || c[3] > 0)) capas.push(c)
          if (c.length >= 3 && (c[3] === undefined || c[3] >= 1)) break
        }
        let base = [255, 255, 255]
        for (let i = capas.length - 1; i >= 0; i--) base = sobre(capas[i], base)
        return base
      }
      const lum = ([r, g, b]) => {
        const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
      }
      const out = {}
      for (const sel of ['.carta-legal-titulo', '.carta-legal-porque']) {
        const el = document.querySelector(sel)
        if (!el) { out[sel] = null; continue }
        const fondo = fondoDe(el)
        const texto = sobre(partes(getComputedStyle(el).color), fondo)
        const a = lum(texto), b = lum(fondo)
        out[sel] = Number(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toFixed(2))
      }
      return out
    })
    for (const [sel, ratio] of Object.entries(medidas)) {
      check(`${tema}: ${sel} llega a 4,5`, ratio !== null && ratio >= 4.5, String(ratio))
    }
    // Y que el color del estado siga estando: en el borde y en el punto,
    // que es donde no tiene que pelearse con ninguna letra.
    const borde = await page.locator('.carta-legal').evaluate((n) => getComputedStyle(n).borderTopColor)
    const texto = await page.locator('.carta-legal-titulo').evaluate((n) => getComputedStyle(n).color)
    check(`${tema}: el color del estado va al borde`, borde !== texto, `${borde} / ${texto}`)
    await page.close()
  }
}

console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
await browser.close()
process.exit(fails === 0 ? 0 : 1)
