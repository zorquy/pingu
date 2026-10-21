// Tanda 935 — en la era de Wizards, cada carta UNA vez y sus ediciones como
// versiones.
//
// PINGU: «Arcanine en TCGGO tiene dos versiones, la First Edition y la
// Unlimited… el Charizard de Base Set tiene tres… yo no pondría las cartas
// repetidas, sino la carta una sola vez» (y Chansey ofrecía una «Normal» que
// no existe). Eligió lo recomendado de la propuesta: todos los sets de
// Wizards, las copias sin edición a Unlimited y sin el chip «Holo».
//
// Lo que se prueba:
//   1. La BASE (PostgreSQL de verdad): la migración crea las ediciones, funde
//      las «tcggo-…» repetidas (copias, deseos, álbumes, vitrina, foto) con
//      lápida, pasa «holo»/«normal» a Unlimited y deja poner la foto de
//      cualquier versión; y el id de versión de la base es el de la web.
//   2. Los DATOS: la lista que lleva la migración es la de
//      tcgdex/cards-database (los productos de Cardmarket de verdad).
//   3. Lo PURO: la lista de versiones de una carta con ediciones, la de por
//      defecto, el maestro, el precio y los iconos.
//   4. La PASADA de precios: la Shadowless (otro producto) se escribe en su
//      edición y la «1st Edition» de TCGGO se cuelga de la carta.
//   5. La PANTALLA: el álbum, la ficha y /admin.
import { spawnSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
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
const MIGRACION = join(RAIZ, 'supabase-migration-935-ediciones-wizards.sql')
const SQL = readFileSync(MIGRACION, 'utf8')
const DATOS = JSON.parse(SQL.match(/d jsonb := '(.*)'::jsonb;/)[1].replace(/''/g, "'"))
const v = await import(`${RAIZ}/js/mi-coleccion/variantes.js`)

console.log('── 1. La base ──')
{
  const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q']
  const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 120000 })
  const hay = psql(['-c', 'select 1'])
  check('hay un PostgreSQL en /var/tmp:5433 donde probar', hay.status === 0, (hay.stderr || '').slice(0, 120))
  if (hay.status === 0) {
    psql(['-c', 'drop database if exists prueba_935'])
    psql(['-c', 'create database prueba_935'])
    for (const f of [join(AQUI, 'sql-tanda-885.sql'), join(RAIZ, 'supabase-migration-885-catalogo-correcciones.sql'), join(AQUI, 'sql-tanda-934.sql'), join(RAIZ, 'supabase-migration-934-versiones-a-mano.sql'), join(AQUI, 'sql-tanda-935.sql'), MIGRACION]) {
      const r = psql(['-d', 'prueba_935', '-f', f])
      check(`carga ${f.split('/').pop()}`, r.status === 0, (r.stderr || '').split('\n').find((l) => /ERROR/.test(l)) || '')
    }
    const otra = psql(['-d', 'prueba_935', '-f', MIGRACION])
    check('la migración se puede ejecutar dos veces', otra.status === 0, (otra.stderr || '').split('\n').find((l) => /ERROR/.test(l)) || '')
    const r = psql(['-t', '-A', '-d', 'prueba_935', '-f', join(AQUI, 'sql-tanda-935-casos.sql')])
    const lineas = (r.stdout || '').split('\n').filter((l) => /^(ok|MAL) /.test(l))
    check('los casos se ejecutan', r.status === 0 && lineas.length >= 24, (r.stderr || '').slice(0, 300))
    for (const l of lineas) check(l.replace(/^(ok|MAL) /, ''), l.startsWith('ok'))
    // El id de cada edición que lleva la migración, en la base y en la web.
    const etiquetas = [...new Set(DATOS.flatMap((c) => c.e.map((e) => e[0])))]
    const q = psql(['-t', '-A', '-d', 'prueba_935', '-c', `select x || '|' || public.catalogo_id_de_version(x) from unnest(array[${etiquetas.map((e) => `'${e.replace(/'/g, "''")}'`).join(',')}]) x`])
    const distintas = (q.stdout || '').trim().split('\n').filter(Boolean).map((l) => l.split('|')).filter(([e, id]) => v.varianteDeEtiqueta(e) !== id)
    check(`las ${etiquetas.length} ediciones tienen el MISMO id en la base y en la web (es lo que guarda la colección)`, q.status === 0 && !distintas.length, distintas.map(([e, id]) => `${e}: base ${id}, web ${v.varianteDeEtiqueta(e)}`).join(' | '))
    psql(['-c', 'drop database if exists prueba_935'])
  }
  // La 631: en el SQL Editor cada sentencia va por su lado.
  check('la migración no usa tablas temporales entre sentencias (la 631)', !/create\s+temp/i.test(SQL))
  check('  …y pide la 934 antes de tocar nada', /Falta ejecutar antes supabase-migration-934/.test(SQL))
}

console.log('\n── 2. Los datos son los de tcgdex/cards-database ──')
{
  const de = (id) => DATOS.find((c) => `${c.s}-${c.n}` === id)?.e || []
  const txt = (id) => de(id).map((e) => `${e[0]}:${e[1]}:${e[2] ?? '-'}`).join(' | ')
  check('el Charizard de Base Set: 1.ª edición y Shadowless con el producto 660224, Unlimited el 273699, y la de 1999-2000', txt('base1-4') === '1st Edition:impresion:660224 | Shadowless:impresion:660224 | Unlimited:impresion:273699 | Unlimited (1999-2000):adicional:-', txt('base1-4'))
  check('el Chansey: sin «Normal» (es holo en todas)', txt('base1-3') === '1st Edition:impresion:660225 | Shadowless:impresion:660225 | Unlimited:impresion:273698 | Unlimited (1999-2000):adicional:-', txt('base1-3'))
  check('el Arcanine de Gym Challenge: 1.ª edición y Unlimited (sin producto: lo pone la nuestra)', txt('gym2-1') === '1st Edition:impresion:274269 | Unlimited:impresion:-', txt('gym2-1'))
  check('el Pikachu de Base Set con sus mejillas rojas y el sello de la PokéTour', /Shadowless Red Cheeks:adicional:660170/.test(txt('base1-58')) && /PokéTour '99:sello:275586/.test(txt('base1-58')))
  check('Jungle: la «sin símbolo» es una adicional, el prerelease un sello', /No Set Symbol:adicional/.test(txt('base2-1')) && /Prerelease:sello/.test(txt('base2-1')))
  check('Base Set 2 y Southern Islands no llevan ediciones (una sola impresión)', !DATOS.some((c) => (c.s === 'base4' && c.n === '10') || c.s === 'si1'))
  check('y están todos los sets de Wizards con 1.ª edición', ['base1', 'base2', 'base3', 'base5', 'gym1', 'gym2', 'neo1', 'neo2', 'neo3', 'neo4'].every((s) => DATOS.some((c) => c.s === s)), [...new Set(DATOS.map((c) => c.s))].join())
  // Si el clon de tcgdex/cards-database está, la lista se vuelve a generar
  // y tiene que salir la MISMA (que nadie la toque a mano).
  if (existsSync('/tmp/tcgdex-db/data/Base/Base Set/4.ts')) {
    const { todas } = await import(join(AQUI, '..', 'herramientas', 'ediciones-wizards', 'ediciones.mjs'))
    const otra = todas().map((c) => ({ s: c.s, n: c.n, e: c.e.map((e) => [e.etiqueta, e.clase, e.cm, e.tp]) }))
    check('generada otra vez desde el clon, la lista de la migración es la misma', JSON.stringify(otra) === JSON.stringify(DATOS))
  } else {
    console.log('  (sin /tmp/tcgdex-db no se vuelve a generar la lista)')
  }
}

console.log('\n── 3. Lo puro ──')
{
  const iv = await import(`${RAIZ}/js/mi-coleccion/iconos-version.js`)
  const { progresoDeSet } = await import(`${RAIZ}/js/mi-coleccion/progreso-set.js`)
  const datos = await import(`${RAIZ}/js/mi-coleccion/datos.js`)
  const ed = (tcggo_id, etiqueta, clase, cm, extra = {}) => ({ tcggo_id, card_id: 'base1-4', set_id: 'base1', etiqueta, clase, cm_id_product: cm, origen: 'edicion', ...extra })
  const filas = [
    ed(-1, '1st Edition', 'impresion', 660224), ed(-2, 'Shadowless', 'impresion', 660224, { imagen: 'https://tcggo/shadowless.png' }), ed(-3, 'Unlimited', 'impresion', 273699), ed(-4, 'Unlimited (1999-2000)', 'adicional', null),
    // Lo que TCGGO también cuelga de la carta: su «1st Edition» con precio y
    // una «Holofoil» que no es una edición; y una a mano.
    { tcggo_id: 50001, card_id: 'base1-4', set_id: 'base1', etiqueta: '1st Edition', cm_low: 9000 },
    { tcggo_id: 50002, card_id: 'base1-4', set_id: 'base1', etiqueta: 'Holofoil', cm_low: 700 },
    { tcggo_id: -9, card_id: 'base1-4', set_id: 'base1', etiqueta: 'Metálica', clase: 'adicional', origen: 'mano' },
  ]
  // Desordenadas a propósito: el orden lo pone la web, no la base.
  const charizard = { id: 'base1-4', set_id: 'base1', variants: { holo: true, firstEdition: true } }
  v.pegarVersiones([charizard], [...filas].reverse())
  const ids = v.variantesDeCarta(charizard).map((x) => x.nuestro).join()
  check('con ediciones, la carta ofrece SUS ediciones (1.ª edición, Shadowless, Unlimited…) y no «Holo»', ids === 'primera,shadowless,unlimited,unlimited-1999-2000,metalica', ids)
  check('  …cada una con su nombre', v.variantesDeCarta(charizard).map((x) => x.nombre).join() === '1.ª edición,Shadowless,Unlimited,Unlimited (1999-2000),Metálica', v.variantesDeCarta(charizard).map((x) => x.nombre).join())
  check('la que se pone sin preguntar es la Unlimited, no la primera de la lista', v.varianteDeCarta(charizard) === 'unlimited')
  check('el maestro no pide la de 1999-2000 ni la metálica', v.variantesDeCarta(charizard).filter(v.cuentaParaMaestro).map((x) => x.nuestro).join() === 'primera,shadowless,unlimited')
  const p = progresoDeSet({ cartas: [charizard], set: { card_count_official: 102 }, tengo: () => 0 })
  check('  …y la barra del maestro cuenta tres', p.maestro.total === 3, JSON.stringify(p.maestro))
  check('la foto de una versión es la de SU fila (la de edición con foto, no la de TCGGO)', v.versionDeVariante(charizard, 'shadowless')?.imagen === 'https://tcggo/shadowless.png')
  const sin = { id: 'x', set_id: 'sv1', variants: { normal: true, reverse: true }, versiones: [{ etiqueta: 'Normal', origen: 'foto', imagen: 'https://x/n.png' }] }
  check('una fila que solo lleva una foto no le quita la Reverse a la carta (la 931 es de TCGGO)', v.variantesDeCarta(sin).map((x) => x.nuestro).join() === 'normal,reverse', v.variantesDeCarta(sin).map((x) => x.nuestro).join())
  const svg = (k) => iv.iconoDeVersion(k).replace(/data-dibujo="[^"]*"/, '')
  check('la Unlimited y la Shadowless tienen su dibujo, distinto del de la 1.ª edición y del normal', new Set([svg('unlimited'), svg('shadowless'), svg('primera'), svg('normal')]).size === 4 && iv.dibujoDeVersion('unlimited-1999-2000').clave === 'unlimited' && iv.dibujoDeVersion('shadowless-red-cheeks').clave === 'shadowless' && iv.dibujoDeVersion('pokemon-day').clave !== 'unlimited' && iv.dibujoDeVersion('prerelease').clave === 'sello')

  // El precio de cada edición.
  datos.registrarVersiones(filas)
  const guardados = new Map([['base1-4', { card_id: 'base1-4', cm_id_product: 273699, cm_low: 600, checked_at: '2026-10-21T10:00:00Z' }]])
  const precio = (variante) => datos.precioDeLinea({ card_id: 'base1-4', variante }, guardados, new Map())
  check('la Unlimited es el mismo producto que la carta: su precio', precio('unlimited')?.desde === 600, JSON.stringify(precio('unlimited')))
  check('la Shadowless (otro producto, sin precio aún) NO toma el de la carta, y enlaza a SU producto', !datos.tieneCifras(precio('shadowless')) && precio('shadowless')?.idProduct === 660224, JSON.stringify(precio('shadowless')))
  check('la 1.ª edición toma el de la «1st Edition» de TCGGO (la fila que tiene precio)', precio('primera')?.desde === 9000, JSON.stringify(precio('primera')))
  check('la de 1999-2000, sin producto, sin precio (no el de la carta)', !datos.tieneCifras(precio('unlimited-1999-2000')), JSON.stringify(precio('unlimited-1999-2000')))
}

console.log('\n── 4. La pasada de precios ──')
{
  const lib = await import(`${RAIZ}/netlify/lib/tcggo.mjs`)
  const precios = await import(`${RAIZ}/netlify/functions/tcggo-precios.mjs`)
  const { CLAVE_ESTADO: CLAVE_PARES } = await import(`${RAIZ}/netlify/functions/tcggo-emparejar.mjs`)
  const AHORA = new Date('2026-10-21T12:00:00Z')
  // Las cartas con la forma de la respuesta real de la 929, cambiando lo que
  // importa: dos productos del Charizard y la «1st Edition» como versión.
  const molde = JSON.parse(readFileSync(join(AQUI, 'fixtures-929', 'episodio-cartas-con-variantes.json'), 'utf8')).data[0]
  const carta = (id, cm, minimo, variants = []) => ({ ...molde, id, name: 'Charizard', name_numbered: 'Charizard 4', card_number: 4, tcgid: 'base1-4', cardmarket_id: cm, prices: { ...molde.prices, cardmarket: { ...molde.prices.cardmarket, lowest_near_mint: minimo } }, variants })
  const DOC = { data: [carta(1001, 273699, 600), carta(1002, 660224, 2500, [{ type: 'first_edition', label: '1st Edition', id: 1003, prices: { cardmarket: { currency: 'EUR', lowest_near_mint: 9000 } } }])], paging: { current: 1, total: 1, per_page: 100 } }
  const EDICIONES = [
    { tcggo_id: -1, card_id: 'base1-4', set_id: 'base1', etiqueta: '1st Edition', clase: 'impresion', cm_id_product: 660224 },
    { tcggo_id: -2, card_id: 'base1-4', set_id: 'base1', etiqueta: 'Shadowless', clase: 'impresion', cm_id_product: 660224 },
    { tcggo_id: -3, card_id: 'base1-4', set_id: 'base1', etiqueta: 'Unlimited', clase: 'impresion', cm_id_product: 273699 },
  ]
  const pure = lib.preciosDeEdiciones(EDICIONES, new Map(DOC.data.map((c) => [c.cardmarket_id, c])), { ahora: AHORA })
  check('el precio de un producto compartido va a la edición sin sello (la Shadowless, no la 1.ª edición)', pure.filas.map((f) => `${f.etiqueta}:${f.cm_low}`).sort().join() === 'Shadowless:2500,Unlimited:600', JSON.stringify(pure.filas.map((f) => [f.etiqueta, f.cm_low])))
  check('  …con las columnas que forman la fila (la 526)', pure.filas.every((f) => f.tcggo_id < 0 && f.market === 'WEST' && f.card_id === 'base1-4' && f.etiqueta && f.cm_id_product))
  check('  …y la «1st Edition» de TCGGO de la Shadowless se cuelga de NUESTRA carta', pure.variantes.length === 1 && pure.variantes[0].tcggo_id === 1003 && pure.variantes[0].card_id === 'base1-4' && pure.variantes[0].cm_low === 9000, JSON.stringify(pure.variantes))

  const estados = { [CLAVE_PARES]: { episodios: { fecha: '2026-10-21T10:00:00Z', lista: [{ id: 51, nombre: 'Base Set', codigo: 'BS', cartas: 102, fecha: '1999-01-09', logo: 'https://images.tcggo.com/bs.png', valorCm: 10 }] }, hechos: { base1: { episodio: 51, pares: 1 } } }, tcggo_catalogo: {}, [precios.CLAVE_ESTADO]: {} }
  const escritas = []
  const vers = []
  const rutas = []
  const r = await precios.procesar({
    env: { SUPABASE_SERVICE_ROLE_KEY: 's', TCGGO_API_KEY: 'k', TCGGO_PAUSA_MS: '0', TCGGO_TOPE_DIARIO: '14000' },
    fetchImpl: async (url) => (/episode_id=51/.test(url) ? { ok: true, status: 200, text: async () => JSON.stringify(DOC) } : { ok: false, status: 404, text: async () => 'no' }),
    restImpl: async (ruta) => {
      rutas.push(ruta)
      if (/^tcg_sets\?select=id&market=eq\.WEST/.test(ruta)) return [{ id: 'base1' }]
      // Solo la nuestra: la Shadowless de TCGGO ya está fundida.
      if (/^tcg_cards\?select=id,set_id,cm_id_product_propio/.test(ruta)) return [{ id: 'base1-4', set_id: 'base1', cm_id_product_propio: 273699 }]
      if (/^tcg_card_versions\?select=tcggo_id,card_id,set_id,etiqueta,clase,cm_id_product&market=eq\.WEST&origen=eq\.edicion/.test(ruta)) return EDICIONES
      if (/^tcg_cards/.test(ruta)) return []
      throw new Error(`ruta inesperada ${ruta}`)
    },
    guardarImpl: async (f) => { escritas.push(...f) },
    guardarSetsImpl: async (f) => f.length,
    fotoImpl: async () => null,
    guardarVersionesImpl: async (f) => { vers.push(...f) },
    estadoImpl: async (clave) => estados[clave],
    guardarEstadoImpl: async (clave, valor) => { estados[clave] = JSON.parse(JSON.stringify(valor)) },
    pausa: async () => {}, ahora: AHORA,
  })
  check('la pasada pregunta por las ediciones de los productos de la página', rutas.some((x) => /origen=eq\.edicion&cm_id_product=in\.\(.*660224/.test(x)), rutas.filter((x) => /versions/.test(x)).join(' | '))
  check('la carta lleva su precio, como siempre', r.ok && escritas.length === 1 && escritas[0].card_id === 'base1-4' && escritas[0].cm_low === 600, JSON.stringify(escritas.map((f) => [f.card_id, f.cm_low])))
  const porEtiqueta = Object.fromEntries(vers.filter((f) => f.tcggo_id < 0).map((f) => [f.etiqueta, f.cm_low]))
  check('  …la Shadowless y la Unlimited, el suyo', porEtiqueta.Shadowless === 2500 && porEtiqueta.Unlimited === 600 && !('1st Edition' in porEtiqueta), JSON.stringify(porEtiqueta))
  check('  …y la «1st Edition» de TCGGO, colgada de la carta con su precio', vers.some((f) => f.tcggo_id === 1003 && f.card_id === 'base1-4' && f.cm_low === 9000), JSON.stringify(vers.filter((f) => f.tcggo_id > 0)))
  check('  …y el estado cuenta las ediciones', estados[precios.CLAVE_ESTADO].versiones?.ediciones === 2, JSON.stringify(estados[precios.CLAVE_ESTADO].versiones))
}

// ── La pantalla ──
const SHADOW = 'https://ejemplo.supabase.co/storage/v1/object/public/guide-images/admin-1/shadowless.png'
const SETS = [{ id: 'base1', name: 'Base Set', name_en: 'Base Set', serie_id: 'base', market: 'WEST', release_date: '1999-01-09', card_count_official: 102, card_count_total: 102 }]
const CARTAS = [
  { id: 'base1-4', market: 'WEST', set_id: 'base1', local_id: '4', name: 'Charizard', name_es: 'Charizard', image_path: 'base/base1/4', rarity: 'Rare Holo', category: 'Pokemon', dex_ids: [6], variants: { holo: true, firstEdition: true }, cm_id_product_propio: 273699, tcg_sets: { id: 'base1', name: 'Base Set', serie_id: 'base', release_date: '1999-01-09', card_count_official: 102 } },
  { id: 'base1-5', market: 'WEST', set_id: 'base1', local_id: '5', name: 'Clefairy', name_es: 'Clefairy', image_path: 'base/base1/5', rarity: 'Rare Holo', category: 'Pokemon', dex_ids: [35], variants: { holo: true, firstEdition: true }, tcg_sets: { id: 'base1', name: 'Base Set', serie_id: 'base', release_date: '1999-01-09', card_count_official: 102 } },
]
const PRECIOS = [{ card_id: 'base1-4', cm_id_product: 273699, cm_low: 600, cm_low_es: 600, checked_at: '2026-10-21T10:00:00Z' }]
const edicion = (tcggo_id, card_id, etiqueta, clase, cm, imagen = null) => ({ tcggo_id, market: 'WEST', card_id, set_id: 'base1', numero: null, etiqueta, clase, cm_id_product: cm, imagen, origen: 'edicion', icono: null, salio_en: null, lanzamiento: null, cm_low: null })
const VERSIONES = [
  edicion(-1, 'base1-4', '1st Edition', 'impresion', 660224, SHADOW), edicion(-2, 'base1-4', 'Shadowless', 'impresion', 660224, SHADOW), edicion(-3, 'base1-4', 'Unlimited', 'impresion', 273699), edicion(-4, 'base1-4', 'Unlimited (1999-2000)', 'adicional', null),
  edicion(-5, 'base1-5', '1st Edition', 'impresion', 660223), edicion(-6, 'base1-5', 'Shadowless', 'impresion', 660223), edicion(-7, 'base1-5', 'Unlimited', 'impresion', 273700),
]
const COLECCION = [
  { id: 'a', user_id: 'user-1', card_id: 'base1-4', market: 'WEST', idioma: 'en', estado: 'NM', variante: 'shadowless', cantidad: 1 },
  { id: 'b', user_id: 'user-1', card_id: 'base1-4', market: 'WEST', idioma: 'en', estado: 'NM', variante: 'unlimited', cantidad: 1 },
]
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64')
const browser = await chromium.launch()
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

console.log('\n── 5. La pantalla ──')
{
  const { ctx, p, errores } = await contexto('user-1')
  await p.goto(`${BASE}/mi-coleccion.html?ver=album&set=base1`, { waitUntil: 'domcontentloaded' })
  await p.waitForFunction(() => document.querySelectorAll('#mcAlbum [data-carta]').length > 0, null, { timeout: 10000 }).catch(() => {})
  await p.waitForTimeout(1200)
  const apiladas = await p.evaluate(() => ({
    cartas: [...document.querySelectorAll('#mcAlbum .mc-bolsillo-enlace')].map((a) => a.dataset.carta).join(),
    insignias: [...(document.querySelector('#mcAlbum .mc-bolsillo-enlace[data-carta="base1-4"]')?.querySelectorAll('.mc-insignia [data-dibujo]') || [])].map((d) => d.dataset.dibujo).join(),
  }))
  check('el álbum enseña cada carta UNA vez', apiladas.cartas === 'base1-4,base1-5', apiladas.cartas)
  // La de la carta (desde la 935, la Unlimited) es el ✓ y no lleva insignia (927).
  check('  …con la insignia de la otra edición que tienes (la Shadowless; la Unlimited es el ✓)', apiladas.insignias === 'shadowless', apiladas.insignias)
  await p.click('#mcVistaVariantes')
  await p.waitForTimeout(600)
  const sep = await p.evaluate(() => [...document.querySelectorAll('#mcAlbum .mc-bolsillo-enlace[data-carta="base1-4"]')].map((a) => ({ v: a.dataset.variante, src: a.querySelector('img')?.getAttribute('src') || '' })))
  check('separadas: el Charizard en sus cuatro ediciones, sin «Holo» ni «Normal»', sep.map((x) => x.v).join() === 'primera,shadowless,unlimited,unlimited-1999-2000', sep.map((x) => x.v).join())
  check('  …la Shadowless con su foto y la Unlimited con la de la carta', sep.find((x) => x.v === 'shadowless')?.src === SHADOW && sep.find((x) => x.v === 'unlimited')?.src !== SHADOW, JSON.stringify(sep))
  // El «+» de una carta sin copias: la que se elige sola es la Unlimited.
  await p.click('#mcVistaVariantes')
  await p.waitForTimeout(400)
  await p.evaluate(() => document.querySelector('#mcAlbum .mc-bolsillo-enlace[data-carta="base1-5"]')?.closest('.mc-bolsillo')?.querySelector('.mc-mas')?.click())
  await p.waitForTimeout(800)
  const anadir = await p.evaluate(() => ({
    abierta: Boolean(document.getElementById('mcAnadirDialogo')?.open),
    opciones: [...document.querySelectorAll('#mcAdVariante option')].map((o) => o.value).join(),
    puesta: document.getElementById('mcAdVariante')?.value,
  }))
  check('al añadir, las ediciones que existen', anadir.abierta && anadir.opciones === 'primera,shadowless,unlimited', JSON.stringify(anadir))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

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
  await p.locator('[data-editar-carta="base1-4"]').click()
  await p.waitForTimeout(800)
  const lista = await p.evaluate(() => [...document.querySelectorAll('#catVersiones .cat-version')].map((li) => `${li.querySelector('strong')?.textContent}${li.querySelector('[data-foto-version]') ? '+foto' : ''}${li.querySelector('.cat-version-foto img') ? '+img' : ''}`).join(' | '))
  check('/admin lista las ediciones de la carta, cada una con su «Foto»', lista === '1.ª edición+foto+img | Shadowless+foto+img | Unlimited+foto | Unlimited (1999-2000)+foto', lista)
  await p.locator('[data-foto-version="unlimited"]').click()
  await p.waitForTimeout(300)
  await p.locator('#catFotoVerFichero').setInputFiles({ name: 'unlimited.png', mimeType: 'image/png', buffer: PNG })
  await p.waitForTimeout(500)
  const url = await p.locator('#catFotoVer_imagen').inputValue()
  await p.locator('#catFotoVerGuardar').click()
  await p.waitForTimeout(800)
  const ll = await rpcs('catalogo_version_foto')
  check('guardar llama a catalogo_version_foto con la versión y la foto subida', ll.length === 1 && ll[0].args.p_card_id === 'base1-4' && ll[0].args.p_variante === 'unlimited' && ll[0].args.p_imagen === url && /guide-images\/admin-1\//.test(url), JSON.stringify(ll))
  check('  …y la Unlimited ya tiene SU foto (la de la 1.ª edición no se toca)', (await tabla('tcg_card_versions')).find((x) => x.tcggo_id === -3)?.imagen === url && (await tabla('tcg_card_versions')).find((x) => x.tcggo_id === -1)?.imagen === SHADOW)
  check('  …y la ficha vuelve con ella', /Unlimited\+foto\+img/.test(await p.evaluate(() => [...document.querySelectorAll('#catVersiones .cat-version')].map((li) => `${li.querySelector('strong')?.textContent}${li.querySelector('[data-foto-version]') ? '+foto' : ''}${li.querySelector('.cat-version-foto img') ? '+img' : ''}`).join(' | '))))
  // Quitarla.
  await p.locator('[data-foto-version="shadowless"]').click()
  await p.waitForTimeout(300)
  await p.locator('#catFotoVerQuitar').click()
  await p.waitForTimeout(800)
  check('«Quitar la foto» la deja sin foto propia', (await tabla('tcg_card_versions')).find((x) => x.tcggo_id === -2)?.imagen === null)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n${fails} FALLAN` : '\nTodo en verde')
process.exit(fails ? 1 : 0)
