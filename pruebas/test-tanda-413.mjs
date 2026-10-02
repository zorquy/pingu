// Tanda 413 — lo que pidió PINGU el 2026-10-01, de una tacada:
//
//   1. «en el constructor muchas cartas no se ven»; y en las listas de los
//      jugadores, «que se muestren con su rareza más baja y de la misma
//      colección: que no salgan distintos reprints»;
//   2. «que tú siempre te puedas guardar el mazo que quieras»;
//   3. «que al mazo que te guardes le puedas poner la portada que quieras,
//      y mejorar un poquito los estilos de eso»;
//   4. «que la imagen que te exportas sea estilo Limitless, con el toque
//      de PokeDoc»;
//   5. «un apartado en cada torneo para ver el meta: los mazos que se han
//      jugado con sus porcentajes, y si entras en un arquetipo, los
//      jugadores que lo han usado con su lista y su resultado en orden».
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync, mkdtempSync } from 'node:fs'
import { deflateSync } from 'node:zlib'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 240) : ''}`)
}

const RAIZ = '/home/user/pingu'
const BASE = process.env.BASE || 'http://localhost:8892'
const leer = (f) => readFileSync(`${RAIZ}/${f}`, 'utf8')
const hace = (min) => new Date(Date.now() - min * 60000).toISOString()
const { imagenDeLimitless } = await import(`${RAIZ}/js/escaneo-carta.js`)

// ── El catálogo de la prueba ──
// Un Mega-Lucario en tres impresiones (la Rara Doble 077, la ilustración
// especial 179 —fuera de las 132 de la colección— y la promo MEP 10, que
// no tiene escaneo en el espejo); dos Riolu que se llaman igual y NO son
// la misma carta (otro ataque); las Órdenes de Jefe en dos sets; una
// Ultra Ball hiperrara; una carta sin imagen; y las energías.
const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
const carta = (set_id, local_id, name, category, extra = {}) => ({
  id: `${set_id}-${local_id}`, set_id, market: 'WEST', local_id, name, name_es: name, name_key: norm(name), name_search: norm(name),
  category, regulation_mark: 'I', image_path: `${set_id}/${local_id}`, ...extra,
})
const ATQ_LUCARIO = [{ name: 'Aura Jab' }, { name: 'Mega Brave' }]
const CARTAS = [
  carta('me01', '077', 'Mega Lucario ex', 'Pokemon', { attacks: ATQ_LUCARIO, stage: 'Stage 1' }),
  carta('me01', '179', 'Mega Lucario ex', 'Pokemon', { attacks: ATQ_LUCARIO, stage: 'Stage 1' }),
  carta('mep', '010', 'Mega Lucario ex', 'Pokemon', { attacks: ATQ_LUCARIO, stage: 'Stage 1', image_path: null }),
  carta('me01', '076', 'Riolu', 'Pokemon', { attacks: [{ name: 'Punch' }], stage: 'Basic' }),
  carta('sv01', '050', 'Riolu', 'Pokemon', { attacks: [{ name: 'Quick Attack' }], stage: 'Basic' }),
  carta('me01', '114', "Boss's Orders", 'Trainer', { trainer_type: 'Supporter' }),
  carta('sv01', '172', "Boss's Orders", 'Trainer', { trainer_type: 'Supporter' }),
  carta('me01', '119', "Lillie's Determination", 'Trainer', { trainer_type: 'Supporter', image_path: null }),
  carta('me01', '131', 'Ultra Ball', 'Trainer', { trainer_type: 'Item' }),
  carta('me01', '191', 'Ultra Ball', 'Trainer', { trainer_type: 'Item' }),
  carta('sve', '006', 'Basic Fighting Energy', 'Energy', { energy_type: 'Normal' }),
  carta('mee', '006', 'Fighting Energy', 'Energy', { energy_type: 'Normal', image_path: null, regulation_mark: null }),
]
const SETS = [
  { id: 'me01', name: 'Megaevolución', market: 'WEST', tcg_online_code: 'MEG', release_date: '2025-09-26', card_count_official: 132 },
  { id: 'mep', name: 'Promos Megaevolución', market: 'WEST', tcg_online_code: 'MEP', release_date: '2025-09-01', card_count_official: 0 },
  { id: 'sv01', name: 'Escarlata y Púrpura', market: 'WEST', tcg_online_code: 'SVI', release_date: '2023-03-31', card_count_official: 198 },
  { id: 'sve', name: 'Energías EP', market: 'WEST', tcg_online_code: 'SVE', release_date: '2023-03-31', card_count_official: 0 },
  { id: 'mee', name: 'Energías Megaevolución', market: 'WEST', tcg_online_code: 'MEE', release_date: '2025-09-26', card_count_official: 0 },
]

// La lista de Ash: lo que de verdad llega de TCG Live — la misma carta
// partida en impresiones distintas.
const L = (quantity, name, set, number) => ({ quantity, name, set, number })
const LISTA_ASH = {
  pokemon: [L(3, 'Mega Lucario ex', 'MEP', '10'), L(1, 'Mega Lucario ex', 'MEG', '179'), L(3, 'Riolu', 'MEG', '76'), L(1, 'Riolu', 'SVI', '50')],
  trainer: [L(1, "Boss's Orders", 'MEG', '114'), L(2, "Boss's Orders", 'SVI', '172'), L(2, "Lillie's Determination", 'MEG', '119'), L(4, 'Ultra Ball', 'MEG', '191')],
  energy: [L(5, 'Basic {F} Energy', 'SVE', '6'), L(3, 'Fighting Energy', 'MEE', '14')],
}
const MAZOS = {
  lucario: LISTA_ASH,
  charizard: { pokemon: [L(3, 'Charizard ex', 'OBF', '125'), L(2, 'Pidgeot ex', 'OBF', '164'), L(4, 'Charmander', 'MEW', '4')], trainer: [], energy: [L(6, 'Basic Fire Energy', 'SVE', '2')] },
  dragapult: { pokemon: [L(3, 'Dragapult ex', 'TWM', '130'), L(2, 'Dusknoir', 'SFA', '20')], trainer: [], energy: [L(3, 'Basic Psychic Energy', 'SVE', '5')] },
  gardevoir: { pokemon: [L(2, 'Gardevoir ex', 'SVI', '86'), L(4, 'Ralts', 'SVI', '84')], trainer: [], energy: [L(7, 'Basic Psychic Energy', 'SVE', '5')] },
  pikachu: { pokemon: [L(4, 'Pikachu ex', 'SSP', '57')], trainer: [], energy: [L(8, 'Basic Lightning Energy', 'SVE', '4')] },
}
const GENTE = [['p4', 'Gary'], ['p5', 'Brock2'], ['p6', 'Erika'], ['p7', 'Sabrina'], ['p8', 'Blaine'], ['p9', 'Giovanni']]
const JUGADORES = ['user-1', 'user-2', 'user-3', ...GENTE.map(([id]) => id)]
const DE = { 'user-1': 'lucario', 'user-2': 'dragapult', 'user-3': 'charizard', p4: 'gardevoir', p5: 'pikachu', p6: 'charizard', p7: 'dragapult', p8: 'gardevoir', p9: 'charizard' }
const textoDe = (p) => ['pokemon', 'trainer', 'energy'].map((s) => p[s].map((l) => `${l.quantity} ${l.name} ${l.set} ${l.number}`).join('\n')).join('\n\n')

// `corte`: top 4 después de las suizas. Entran Erika, Ash, Giovanni y
// Blaine (4.º por desempate); Blaine gana a Erika, Giovanni a Ash, y la
// final Blaine a Giovanni. Así el orden FINAL no es el de las suizas.
function semillas({ estado = 'finished', visibilidad = 'al_terminar', corte = false, extra = {} } = {}) {
  const fin = estado === 'finished'
  const cut = corte
    ? {
        rondas: [
          { id: 'ronda-3', round_number: 3, status: 'finished', phase: 'top_cut', started_at: hace(20) },
          { id: 'ronda-4', round_number: 4, status: 'finished', phase: 'top_cut', started_at: hace(10) },
        ],
        mesas: [['c3-1', 'ronda-3', 1, 'p6', 'p8', 'finished'], ['c3-2', 'ronda-3', 2, 'user-1', 'p9', 'finished'], ['c4-1', 'ronda-4', 1, 'p8', 'p9', 'finished']],
        resultados: [['c3-1', 'b_wins', 'p8'], ['c3-2', 'b_wins', 'p9'], ['c4-1', 'a_wins', 'p8']],
      }
    : { rondas: [], mesas: [], resultados: [] }
  return {
    // El doble devuelve solo las columnas pedidas de tcg_cards, como la
    // base de verdad: si no, los ataques llegarían aunque nadie los pida.
    __PROYECTAR__: ['tcg_cards'],
    __FAKE_SETS__: SETS,
    __FAKE_CARTAS__: CARTAS,
    __FAKE_PERFILES__: GENTE.map(([id, username]) => ({ id, username, display_name: username })),
    __FAKE_TORNEOS__: [{
      id: 'torneo-1', slug: 'copa', name: 'Copa del Gimnasio', status: estado, admin_id: 'admin-1',
      swiss_rounds: 2, top_cut_size: corte ? 4 : 0, checkin_minutes: 5, current_round_id: fin ? null : 'ronda-2', decklist_visibility: visibilidad,
    }],
    __FAKE_INSCRIPCIONES__: JUGADORES.map((u, i) => ({ id: `insc-${i + 1}`, tournament_id: 'torneo-1', user_id: u, tcg_live_username: `TCG_${u}` })),
    __FAKE_RONDAS__: [
      { id: 'ronda-1', round_number: 1, status: 'finished', phase: 'swiss', started_at: hace(60) },
      { id: 'ronda-2', round_number: 2, status: fin ? 'finished' : 'active', phase: 'swiss', started_at: hace(30), ends_at: new Date(Date.now() + 40 * 60000).toISOString() },
      ...cut.rondas,
    ],
    __FAKE_MESAS__: [
      ['r1-1', 'ronda-1', 1, 'user-1', 'p4', 'finished'], ['r1-2', 'ronda-1', 2, 'user-2', 'p5', 'finished'],
      ['r1-3', 'ronda-1', 3, 'user-3', 'p6', 'finished'], ['r1-4', 'ronda-1', 4, 'p7', 'p8', 'finished'], ['r1-5', 'ronda-1', 5, 'p9', null, 'bye'],
      ['mesa-1', 'ronda-2', 1, 'user-1', 'user-2', 'finished'], ['mesa-2', 'ronda-2', 2, 'user-3', 'p4', fin ? 'finished' : 'active'],
      ['mesa-3', 'ronda-2', 3, 'p5', 'p6', fin ? 'finished' : 'active'], ['mesa-4', 'ronda-2', 4, 'p7', 'p8', fin ? 'finished' : 'active'], ['mesa-5', 'ronda-2', 5, 'p9', null, 'bye'],
      ...cut.mesas,
    ].map(([id, round_id, table_number, a, b, status]) => ({ id, round_id, table_number, player_a_id: a, player_b_id: b, status, check_in_a_at: hace(59), check_in_b_at: b ? hace(59) : null })),
    __FAKE_RESULTADOS__: [
      ['r1-1', 'a_wins', 'user-1'], ['r1-2', 'a_wins', 'user-2'], ['r1-3', 'b_wins', 'p6'], ['r1-4', 'a_wins', 'p7'], ['r1-5', 'bye', 'p9'],
      ['mesa-1', 'a_wins', 'user-1'], ['mesa-5', 'bye', 'p9'],
      ...(fin ? [['mesa-2', 'a_wins', 'user-3'], ['mesa-3', 'b_wins', 'p6'], ['mesa-4', 'b_wins', 'p8']] : []),
      ...cut.resultados,
    ].map(([match_id, result, winner_id], i) => ({ id: `res-${i + 1}`, match_id, result, winner_id })),
    __FAKE_DECKLISTS__: JUGADORES.map((u, i) => {
      const p = { ...MAZOS[DE[u]] }
      p.total = ['pokemon', 'trainer', 'energy'].reduce((n, s) => n + p[s].reduce((m, l) => m + l.quantity, 0), 0)
      return { id: `deck-${i + 1}`, tournament_id: 'torneo-1', user_id: u, raw_text: textoDe(p), parsed_cards: p, locked_at: hace(90) }
    }),
    ...extra,
  }
}

// Las imágenes de fuera no llegan desde aquí: se sirven unas de mentira,
// CON permiso de CORS (como TCGdex y pokemontcg.io) salvo las que la
// prueba diga, y /escaneo (la función de Netlify, que el servidor de
// pruebas no corre) se sirve aparte y se apunta.
// Un PNG de 245×342 de un color, montado aquí mismo (sin ficheros aparte
// que se puedan perder): firma, cabecera, los píxeles comprimidos y fin.
function pngLiso(w, h, [r, g, b]) {
  const crc = (buf) => {
    let c = ~0
    for (const x of buf) {
      c ^= x
      for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
    }
    return ~c >>> 0
  }
  const trozo = (tipo, datos) => {
    const t = Buffer.concat([Buffer.from(tipo), datos])
    const largo = Buffer.alloc(4)
    largo.writeUInt32BE(datos.length)
    const suma = Buffer.alloc(4)
    suma.writeUInt32BE(crc(t))
    return Buffer.concat([largo, t, suma])
  }
  const cab = Buffer.alloc(13)
  cab.writeUInt32BE(w, 0)
  cab.writeUInt32BE(h, 4)
  cab.set([8, 2, 0, 0, 0], 8)
  const fila = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: w }, () => [r, g, b]).flat())])
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    trozo('IHDR', cab),
    trozo('IDAT', deflateSync(Buffer.concat(Array(h).fill(fila)))),
    trozo('IEND', Buffer.alloc(0)),
  ])
}
const PNG = pngLiso(245, 342, [214, 120, 60])
const browser = await chromium.launch()
async function abrir(ruta, sem, { sesion = 'user-2', ancho = 1280, alto = 900, oscuro = false, sinCors = [], escaneoRoto = [], antes = null } = {}) {
  const page = await browser.newPage({ viewport: { width: ancho, height: alto }, colorScheme: oscuro ? 'dark' : 'light', acceptDownloads: true })
  const errores = []
  const escaneos = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  page.on('dialog', (d) => d.accept())
  await page.route(/^https:\/\/[^/]+\/.*\.(png|webp|jpg)(\?.*)?$/i, (route) => {
    const u = route.request().url()
    const conPermiso = !sinCors.some((s) => u.includes(s))
    // «Sin permiso» es un permiso para OTRO sitio: sin la cabecera,
    // Playwright pone la suya y la petición pasaría igual.
    route.fulfill({ status: 200, contentType: 'image/png', body: PNG, headers: { 'access-control-allow-origin': conPermiso ? '*' : 'https://otro.example' } })
  })
  await page.route(/\/escaneo\/[^/]+\/[^/?]+$/, (route) => {
    const ruta = new URL(route.request().url()).pathname
    escaneos.push(ruta)
    if (escaneoRoto.includes(ruta)) return route.fulfill({ status: 404, body: 'Sin escaneo' })
    route.fulfill({ status: 200, contentType: 'image/png', body: PNG })
  })

  await page.addInitScript(([s, se, a]) => {
    window.__FAKE_SESSION__ = s
    for (const [k, v] of Object.entries(se)) window[k] = v
    if (a) Object.assign(window, a)
  }, [sesion, sem, antes])
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  return { page, errores, escaneos }
}
const pestana = async (page, id) => {
  await page.click(`[data-pestana="${id}"]`)
  await page.waitForTimeout(300)
}
const abrirListaDe = async (page, nombre) => {
  await pestana(page, 'clasificacion')
  const fila = page.locator('#clasificacionContenido tbody tr').filter({ has: page.locator('[data-historial]', { hasText: new RegExp(`^${nombre}$`) }) })
  await fila.locator('[data-ver-lista]').click()
  await page.waitForTimeout(1800)
}
// Lo que enseña la rejilla de una lista: por casilla, copias, nombre e imagen.
const casillas = (page, raiz) =>
  page.locator(`${raiz} .torneo-carta`).evaluateAll((fs) =>
    fs.map((f) => ({
      n: f.querySelector('.torneo-carta-cuantas')?.textContent.trim(),
      nombre: f.querySelector('figcaption')?.textContent.trim(),
      src: f.querySelector('img')?.getAttribute('src') || '',
      enlace: f.querySelector('figcaption a')?.getAttribute('href') || '',
    }))
  )

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. Qué impresión se enseña (impresion-canonica.js, en Node) ──')
{
  const IC = await import(`${RAIZ}/js/impresion-canonica.js`)
  const [l77, l179, lMep, r76, r50, b114, b172, , u131, u191] = CARTAS
  const orden = (xs) => [...xs].sort((a, b) => {
    const [ga, na, sa] = IC.ordenDeNumero(a)
    const [gb, nb, sb] = IC.ordenDeNumero(b)
    return ga - gb || na - nb || (sa < sb ? -1 : sa > sb ? 1 : 0)
  })
  check('los números se ordenan por valor, las letras al final', orden(['179', 'TG05', '077', '8']).join() === '8,077,179,TG05')
  check('la 179 está FUERA de las 132', IC.fueraDeLaColeccion(l179, 132) && !IC.fueraDeLaColeccion(l77, 132))
  check('  …un «TG05» también', IC.fueraDeLaColeccion({ local_id: 'TG05' }, 132))
  check('  …y sin cuenta oficial no hay «fuera» (promos)', !IC.fueraDeLaColeccion(l179, 0) && !IC.fueraDeLaColeccion({ local_id: 'TG05' }, null))
  check('mismo Pokémon con los mismos ataques = misma carta', IC.mismaCarta(l77, l179) && IC.mismaCarta(l77, lMep))
  check('  …con otro ataque, NO (los dos Riolu)', !IC.mismaCarta(r76, r50))
  check('  …y sin saber sus ataques, tampoco', !IC.mismaCarta({ ...l77, attacks: undefined }, l179))
  check('  …ni aunque no se sepan los de NINGUNA de las dos', !IC.mismaCarta({ ...l77, attacks: undefined }, { ...l179, attacks: [] }))
  check('un entrenador con el mismo nombre SÍ', IC.mismaCarta(b114, b172) && IC.mismaCarta(u131, u191))
  check('  …con otro nombre, no', !IC.mismaCarta(b114, u131))
  check('regla 1: la 179 se enseña como la 077', IC.impresionBase(l179, [l77, l179], 132) === l77)
  check('  …la ultra ball 191 como la 131', IC.impresionBase(u191, [u131, u191], 132) === u131)
  check('  …una de DENTRO no se toca', IC.impresionBase(l77, [l77, l179], 132) === l77)
  check('  …ni si la de dentro tiene otro ataque', IC.impresionBase(l179, [{ ...l77, attacks: [{ name: 'Otra' }] }, l179], 132) === l179)
  check('  …ni sin la cuenta oficial', IC.impresionBase(l179, [l77, l179], 0) === l179)
  check('  …y de varias, la de número más bajo', IC.impresionBase(l179, [{ ...l77, id: 'me01-080', local_id: '080' }, l77, l179], 132).id === 'me01-077')
  check('  …y solo dentro de SU set', IC.impresionBase(l179, [{ ...l77, set_id: 'sv01', id: 'sv01-077' }, l179], 132) === l179)
  check('las promos se reconocen', IC.esColeccionDePromos('mep', 'MEP') && IC.esColeccionDePromos('svp', 'PR-SV') && IC.esColeccionDePromos('swshp'))
  check('  …y una colección no es una promo', !IC.esColeccionDePromos('me01', 'MEG') && !IC.esColeccionDePromos('sv01', 'SVI') && !IC.esColeccionDePromos('sv04.5', 'PAF'))
  const codigo = (id) => SETS.find((s) => s.id === id)?.tcg_online_code || ''
  const j1 = IC.juntarReimpresiones([{ carta: lMep, n: 3 }, { carta: l77, n: 1 }], codigo)
  check('regla 2: la promo y la del set se juntan en UNA casilla', j1.length === 1 && j1[0].n === 4, JSON.stringify(j1.map((e) => [e.carta.id, e.n])))
  check('  …con la del SET aunque la promo traiga más copias', j1[0].carta.id === 'me01-077')
  const j2 = IC.juntarReimpresiones([{ carta: b114, n: 1 }, { carta: b172, n: 2 }], codigo)
  check('  …entre dos sets, la que más copias trae', j2.length === 1 && j2[0].carta.id === 'sv01-172' && j2[0].n === 3)
  const j3 = IC.juntarReimpresiones([{ carta: b172, n: 2 }, { carta: b114, n: 2 }], codigo)
  check('  …a igualdad, la que iba antes en la lista', j3[0].carta.id === 'sv01-172')
  check('  …los dos Riolu siguen siendo dos', IC.juntarReimpresiones([{ carta: r76, n: 3 }, { carta: r50, n: 1 }], codigo).length === 2)
  const j4 = IC.juntarReimpresiones([{ carta: { ...l77, attacks: undefined }, n: 2 }, { carta: { ...l77, attacks: undefined }, n: 2 }], codigo)
  check('  …y la MISMA impresión dos veces se suma aunque no se sepan sus ataques', j4.length === 1 && j4[0].n === 4)
  check('  …lo que viaja con cada entrada no se pierde', IC.juntarReimpresiones([{ carta: u131, n: 4, linea: 'x' }])[0].linea === 'x')
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. /escaneo: las cartas de Limitless, servidas desde casa ──')
{
  const { traerEscaneo, default: manejador } = await import(`${RAIZ}/netlify/functions/escaneo.mjs`)
  const pedidas = []
  const falso = (resp) => async (url) => {
    pedidas.push(url)
    if (resp instanceof Error) throw resp
    return resp
  }
  const imagen = () => new Response(new Uint8Array([137, 80, 78, 71]), { headers: { 'content-type': 'image/png' } })
  const r = await traerEscaneo('MEP', '10', { fetchImpl: falso(imagen()) })
  check('pide la carta a la CDN de Limitless, con la dirección de siempre', pedidas[0] === imagenDeLimitless('MEP', '10'), pedidas[0])
  check('  …y devuelve la imagen con su tipo', r?.tipo === 'image/png' && r.datos.byteLength === 4)
  pedidas.length = 0
  await traerEscaneo('PR-ME', '10', { fetchImpl: falso(imagen()) })
  check('«PR-ME» es MEP, como en el resto del sitio', pedidas[0] === imagenDeLimitless('MEP', '10'), pedidas[0])
  pedidas.length = 0
  for (const [set, n] of [['../../etc', '1'], ['https://evil.example', '1'], ['MEP', '1/../../x'], ['MEP', ''], ['', '10']]) {
    check(`no es un proxy abierto: «${set}» «${n}» ni se pide`, (await traerEscaneo(set, n, { fetchImpl: falso(imagen()) })) === null && pedidas.length === 0)
  }
  check('una página de error con un 200 no pasa por imagen',
    (await traerEscaneo('MEG', '1', { fetchImpl: falso(new Response('<html>', { headers: { 'content-type': 'text/html' } })) })) === null)
  check('un 404 de la CDN, tampoco', (await traerEscaneo('MEG', '1', { fetchImpl: falso(new Response('', { status: 404, headers: { 'content-type': 'image/png' } })) })) === null)
  check('si la CDN no contesta, null y sin reventar', (await traerEscaneo('MEG', '1', { fetchImpl: falso(new Error('caída')) })) === null)
  const res = await manejador(new Request('https://pokedoc.es/.netlify/functions/escaneo?set=..%2F..&n=1'))
  check('la función contesta 404 a lo que no es una carta', res.status === 404 && /max-age=3600/.test(res.headers.get('cache-control') || ''))
  const toml = leer('netlify.toml')
  check('netlify.toml la sirve en /escaneo/:set/:n', /from = "\/escaneo\/:set\/:n"\s*\n\s*to = "\/\.netlify\/functions\/escaneo\?set=:set&n=:n"\s*\n\s*status = 200/.test(toml))
  check('  …y la imagen buena se guarda un año', /max-age=31536000, immutable/.test(leer('netlify/functions/escaneo.mjs')))
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. Las piezas que viven en el navegador ──')
{
  const { page, errores } = await abrir('/torneo?slug=copa', semillas())
  const r = await page.evaluate(async () => {
    const datos = await import('/js/constructor/datos.js')
    const meta = await import('/js/torneos/meta-torneo.js')
    const guardar = await import('/js/guardar-lista.js')
    const img = await import('/js/torneos/decklist-imagen.js')
    const e = (s, n) => datos.letraDeEnergiaPorNumero(s, n)
    const arq = (nombre) => ({ id: null, nombre, iconos: [], curado: false })
    const A = arq('Alfa'), B = arq('Beta'), C = arq('Gamma')
    const fila = (playerId, w, l, d = 0, byes = 0) => ({ playerId, wins: w, losses: l, draws: d, byesReceived: byes, matchPoints: w * 3 + d })
    const m = meta.agruparMeta(
      new Map([['a', A], ['b', B], ['c', A], ['d', A], ['e', B], ['f', C]]),
      [fila('f', 3, 0), fila('b', 2, 1, 0, 1), fila('a', 2, 1), fila('c', 1, 1, 1), fila('e', 0, 3)]
    )
    const sw = ['s1', 's2', 's3', 's4', 's5', 's6'].map((p) => fila(p, 0, 0))
    const rondas = [{ id: 'r1', phase: 'swiss', round_number: 1 }, { id: 'r3', phase: 'top_cut', round_number: 3 }, { id: 'r4', phase: 'top_cut', round_number: 4 }]
    const partidas = [{ round_id: 'r1', player_a_id: 's5', player_b_id: 's6' }, { round_id: 'r3', player_a_id: 's1', player_b_id: 's4' }, { round_id: 'r3', player_a_id: 's2', player_b_id: 's3' }, { round_id: 'r4', player_a_id: 's3', player_b_id: 's4' }]
    return {
      energias: [e('MEE', '13'), e('MEE', '9'), e('MEE', '16'), e('MEE', '1'), e('SVE', '6'), e('sve', '006'), e('SVE', '9'), e('MEG', '5'), e('MEE', '0'), e('MEE', '17'), e('MEE', 'x')],
      meta: {
        total: m.total,
        orden: m.arquetipos.map((g) => g.arq.nombre),
        jugadoresA: m.arquetipos[0].jugadores.map((j) => `${j.userId}:${j.puesto}`),
        cuotaA: m.arquetipos[0].cuota,
        mejorB: m.arquetipos.find((g) => g.arq.nombre === 'Beta').mejorPuesto,
        pctA: m.arquetipos[0].porcentajeVictorias,
        pctB: m.arquetipos.find((g) => g.arq.nombre === 'Beta').porcentajeVictorias,
        vdeB: ['victorias', 'derrotas', 'empates'].map((k) => m.arquetipos.find((g) => g.arq.nombre === 'Beta')[k]).join('-'),
        vacio: meta.agruparMeta(new Map(), []).arquetipos.length,
      },
      corte: meta.ordenFinal(sw, { rondas, partidas, campeon: 's4' }).map((x) => x.playerId).join(','),
      corteSinCampeon: meta.ordenFinal(sw, { rondas, partidas }).map((x) => x.playerId).join(','),
      sinCorteMismaTabla: meta.ordenFinal(sw, { rondas: [rondas[0]], partidas }) === sw,
      lineasTorneo: guardar.lineasDeLista({ pokemon: [{ quantity: 2, name: 'Riolu', set: 'meg', number: '76' }, { quantity: 0, name: 'Nada', set: 'X', number: '1' }], trainer: [{ quantity: 1, name: '', set: '', number: '' }], energy: [] }),
      lineasMeta: guardar.lineasDeLista({ pokemon: [{ count: 3, name: 'Mega Lucario ex', set: 'MEG', number: 77 }] }),
      fuentes: {
        energia: img.fuentesDeCarta({ name: 'Basic {F} Energy', set: 'SVE', number: '6' }),
        conImagen: img.fuentesDeCarta({ name: 'Ultra Ball', set: 'MEG', number: '131', carta: { exacta: true, image_path: 'me01/131' } }),
        sinImagen: img.fuentesDeCarta({ name: "Lillie's Determination", set: 'MEG', number: '119', carta: { exacta: true, image_path: null } }),
        gemela: img.fuentesDeCarta({ name: 'Ultra Ball', set: 'XXX', number: '07', carta: { exacta: false, image_path: 'me01/131' } }),
      },
      alto: [img.medidas({ pokemon: Array(6).fill({}) }).alto, img.medidas({ pokemon: Array(10).fill({}), trainer: Array(8).fill({}) }).alto, img.medidas({ pokemon: Array(20).fill({}), trainer: Array(20).fill({}) }).alto],
    }
  })
  check('la energía por su número: MEE 13 Psíquica, 9 Planta, 16 Metálica, 1 Planta',
    r.energias.slice(0, 4).join('') === 'PGMG', r.energias.join(','))
  check('  …SVE 6 Lucha, con ceros y en minúsculas también', r.energias[4] === 'F' && r.energias[5] === 'F')
  check('  …y fuera de rango o de otro set, nada', r.energias.slice(6).every((x) => x === null), r.energias.join(','))
  check('meta: el más jugado primero', r.meta.orden.join() === 'Alfa,Beta,Gamma' && r.meta.total === 6, r.meta.orden.join())
  check('  …con sus jugadores en el orden de la clasificación (y sin jugar, al final)', r.meta.jugadoresA.join() === 'a:3,c:4,d:null', r.meta.jugadoresA.join())
  check('  …su parte del torneo', Math.abs(r.meta.cuotaA - 0.5) < 1e-9 && r.meta.mejorB === 2)
  check('  …el % de victorias, con el empate como partida jugada', Math.abs(r.meta.pctA - 3 / 6) < 1e-9, r.meta.pctA)
  check('  …y SIN los byes: Beta ganó 1 de verdad y perdió 4', r.meta.vdeB === '1-4-0' && Math.abs(r.meta.pctB - 1 / 5) < 1e-9, `${r.meta.vdeB} ${r.meta.pctB}`)
  check('  …y sin listas, vacío', r.meta.vacio === 0)
  // s4 entró CUARTO a las suizas y ganó el corte: va primero.
  check('el orden final con corte: campeón, finalista, semis y el resto por suizas', r.corte === 's4,s3,s1,s2,s5,s6', r.corte)
  check('  …sin campeón todavía, por hasta dónde llegó cada uno (y a igualdad, las suizas)', r.corteSinCampeon === 's3,s4,s1,s2,s5,s6', r.corteSinCampeon)
  check('  …y sin corte, la clasificación tal cual', r.sinCorteMismaTabla)
  check('las líneas de una lista de torneo: sin las vacías, con el set en mayúsculas',
    r.lineasTorneo.length === 1 && r.lineasTorneo[0].set === 'MEG' && r.lineasTorneo[0].n === 2 && r.lineasTorneo[0].numero === '76', JSON.stringify(r.lineasTorneo))
  check('  …y las de /meta (count, número como número)', r.lineasMeta[0].n === 3 && r.lineasMeta[0].numero === '77', JSON.stringify(r.lineasMeta))
  const deFuera = Object.values(r.fuentes).flat().filter((u) => !u.startsWith('/escaneo/') && !/^https:\/\/(assets\.tcgdex\.net|images\.pokemontcg\.io)\//.test(u))
  check('la imagen exportada SOLO pide a sitios con permiso (o a /escaneo)', deFuera.length === 0, deFuera.join(' '))
  // Desde la 420, Limitless (por /escaneo) va PRIMERO: son los escaneos de
  // los que salen las huellas del reconocimiento de imágenes.
  check('  …la energía, la del 30 aniversario y si no la de pokemontcg.io', r.fuentes.energia[0] === '/escaneo/MEE/14' && r.fuentes.energia[1] === 'https://images.pokemontcg.io/sve/6.png', r.fuentes.energia.join(' '))
  check('  …primero Limitless y el espejo de respaldo', r.fuentes.conImagen[0] === '/escaneo/MEG/131' && /tcgdex\.net\/.*me01\/131\/low\.webp$/.test(r.fuentes.conImagen[1]), r.fuentes.conImagen.join(' '))
  check('  …sin escaneo, /escaneo', r.fuentes.sinImagen.join() === '/escaneo/MEG/119')
  check('  …y una gemela por nombre va DESPUÉS de su set y número', r.fuentes.gemela[0] === '/escaneo/XXX/7' && /me01\/131/.test(r.fuentes.gemela[1]), r.fuentes.gemela.join(' '))
  check('la imagen crece con las filas de cartas (6, 18 y 40 cartas distintas)', r.alto[1] > r.alto[0] && r.alto[2] > r.alto[1], r.alto.join())
  check('sin errores de página', errores.length === 0, errores.join(' | '))
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 4. La lista de un jugador: UNA impresión por carta, la más baja ──')
{
  const { page, errores } = await abrir('/torneo?slug=copa', semillas())
  await abrirListaDe(page, 'Ash')
  const c = await casillas(page, '#listaRivalCartas')
  const de = (nombre) => c.filter((x) => x.nombre === nombre)
  check('siete casillas en vez de diez líneas', c.length === 7, c.map((x) => `${x.n} ${x.nombre}`).join(' · '))
  const luc = de('Mega Lucario ex')
  check('el Mega-Lucario es UNA casilla con las 4 copias', luc.length === 1 && luc[0].n === '×4', JSON.stringify(luc))
  check('  …con la Rara Doble de la colección (077), ni la promo ni la ilustración especial', /\/me01\/077\/low\.webp$/.test(luc[0]?.src || ''), luc[0]?.src)
  check('  …y su enlace lleva a esa misma carta', /me01-077/.test(luc[0]?.enlace || ''), luc[0]?.enlace)
  const riolu = de('Riolu')
  check('los dos Riolu NO se juntan (otro ataque, otra carta)', riolu.length === 2 && riolu.map((x) => x.n).join() === '×3,×1')
  const boss = de("Boss's Orders")
  check('las Órdenes de Jefe de dos sets, en una casilla de 3', boss.length === 1 && boss[0].n === '×3')
  check('  …con la del set que más copias trae (SVI 172)', /\/sv01\/172\/low\.webp$/.test(boss[0]?.src || ''), boss[0]?.src)
  const ultra = de('Ultra Ball')
  check('la Ultra Ball hiperrara se enseña como la normal (131)', ultra.length === 1 && /\/me01\/131\/low\.webp$/.test(ultra[0]?.src || ''), ultra[0]?.src)
  const lillie = de("Lillie's Determination")
  check('la carta sin escaneo en el espejo sale de Limitless', lillie[0]?.src === imagenDeLimitless('MEG', '119'), lillie[0]?.src)
  const energia = c.filter((x) => /Energy/.test(x.nombre))
  check('las energías Lucha, en UNA casilla de 8 (identificada y suelta juntas)', energia.length === 1 && energia[0].n === '×8', JSON.stringify(energia))
  check('  …y las sueltas no cuentan como «sin identificar»', !/identificar/.test(await page.locator('#listaRivalCartas [data-reglamento]').textContent()), await page.locator('#listaRivalCartas [data-reglamento]').textContent())
  const titulos = await page.locator('#listaRivalCartas .torneo-cartas-titulo').allInnerTexts()
  check('las secciones siguen sumando lo mismo (8, 9, 8)', titulos.map((t) => t.match(/\((\d+)\)/)?.[1]).join() === '8,9,8', titulos.join(' | '))

  // Y la de jesus, con cartas de sets que el catálogo no tiene: esas SÍ
  // se avisan, también las que no aparecen por ningún lado (la energía no).
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)
  await abrirListaDe(page, 'jesus')
  const aviso = await page.locator('#listaRivalCartas [data-reglamento]').textContent()
  check('las cartas que no están en el catálogo se avisan (9, sin la energía)', /No he podido identificar 9 cartas/.test(aviso), aviso)
  check('sin errores de página', errores.length === 0, errores.join(' | '))
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 5. Guardarse la lista de otro ──')
{
  const { page, errores } = await abrir('/torneo?slug=copa', semillas())
  await abrirListaDe(page, 'Ash')
  const guardar = page.locator('#btnGuardarListaRival')
  check('la ventana de la lista ofrece «Guardar en mis mazos»', await guardar.isVisible())
  const abrirEn = page.locator('#torneoListaModal a', { hasText: 'Abrir en el constructor' })
  check('  …y «Abrir en el constructor», con la lista en el enlace', /^\/constructor\?i=1/.test((await abrirEn.getAttribute('href')) || ''), await abrirEn.getAttribute('href'))
  await guardar.click()
  await page.waitForTimeout(1500)
  const fila = await page.evaluate(() => window.__TABLAS__.user_decks.at(-1))
  const cartas = Object.fromEntries((fila?.cards || []).map((x) => [x.id, x.n]))
  check('se guarda en user_decks', Boolean(fila), JSON.stringify(fila))
  check('  …como mazo PRIVADO', fila?.is_public === false)
  check('  …con el nombre del mazo y de quién es', /Ash$/.test(fila?.name || ''), fila?.name)
  check('  …con las cartas ya juntadas: 4 Mega-Lucario 077, 3 Órdenes SVI, 4 Ultra Ball 131',
    cartas['me01-077'] === 4 && cartas['sv01-172'] === 3 && cartas['me01-131'] === 4 && !cartas['me01-179'] && !cartas['mep-010'] && !cartas['me01-191'], JSON.stringify(cartas))
  check('  …las energías en una (MEE Lucha, 8)', cartas['mee-006'] === 8, JSON.stringify(cartas))
  check('  …las 25 cartas', Object.values(cartas).reduce((a, b) => a + b, 0) === 25)
  check('  …y de portada, el Pokémon con más copias', fila?.cover_card === 'me01-077', fila?.cover_card)
  const copia = page.locator('#torneoListaModal a', { hasText: 'Abrir mi copia' })
  check('el botón pasa a ser el enlace a la copia', (await copia.getAttribute('href')) === `/constructor?mazo=${fila?.id}`)
  check('sin errores de página', errores.length === 0, errores.join(' | '))
  await page.close()

  // Sin cuenta: se manda a entrar, y de vuelta aquí.
  const v = await abrir('/torneo?slug=copa', semillas(), { sesion: 'none' })
  await abrirListaDe(v.page, 'Ash')
  await Promise.all([v.page.waitForURL(/auth\.html/, { timeout: 5000 }).catch(() => null), v.page.click('#btnGuardarListaRival')])
  check('sin cuenta, «Guardar» lleva a entrar y vuelve al torneo', /auth\.html\?volver=%2Ftorneo/.test(v.page.url()), v.page.url())
  await v.page.close()

  // Y desde /meta, la misma pieza con la forma de sus listas.
  const m = await abrir('/torneo?slug=copa', semillas())
  const r = await m.page.evaluate(async () => {
    const { guardarListaEnMisMazos } = await import('/js/guardar-lista.js')
    return guardarListaEnMisMazos({ nombre: 'Lucario — Fulano', lista: { pokemon: [{ count: 2, name: 'Mega Lucario ex', set: 'MEG', number: 179 }], trainer: [{ count: 1, name: 'Nada', set: 'ZZZ', number: 1 }], energy: [] } })
  })
  check('una lista de /meta también se guarda, con la impresión baja', r?.mazo?.cards?.[0]?.id === 'me01-077' && r.mazo.cards[0].n === 2, JSON.stringify(r?.mazo?.cards))
  check('  …y avisa de la carta que no está en el catálogo, sin dejar de guardar', r?.faltan === 1)
  check('/meta lleva su botón', /data-guardar>Guardar en mis mazos</.test(leer('js/meta-mazo.js')) && /guardarListaEnMisMazos\(\{ lista: l\.lista/.test(leer('js/meta-mazo.js')))
  await m.page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 6. La imagen exportada (su forma se prueba en la 420) ──')
{
  // La Ultra Ball no está en Limitless (/escaneo da 404) y el espejo la
  // sirve SIN permiso de CORS: la imagen tiene que salir igual, con la
  // carta como caja con su nombre, sin manchar el lienzo.
  const { page, errores, escaneos } = await abrir('/torneo?slug=copa', semillas(), { sinCors: ['me01/131'], escaneoRoto: ['/escaneo/MEG/131'] })
  await abrirListaDe(page, 'Ash')
  const [bajada] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }).catch(() => null),
    page.click('#torneoListaModal [data-exportar-imagen]'),
  ])
  check('se descarga una imagen', Boolean(bajada))
  check('  …con nombre de fichero', /^mazo-ash\.png$/.test(bajada?.suggestedFilename() || ''), bajada?.suggestedFilename())
  const ruta = join(mkdtempSync(join(tmpdir(), 'imagen-')), 'mazo.png')
  if (bajada) await bajada.saveAs(ruta)
  const py = spawnSync('python3', ['-c', `
from PIL import Image
im = Image.open(${JSON.stringify(ruta)}).convert('RGBA')
print(im.size[0], im.size[1], im.getpixel((4, 4))[3])`], { encoding: 'utf8' })
  const [w, h, alfa] = (py.stdout || '').trim().split(/\s+/).map(Number)
  check('a 1368 × 1148: siete cartas en una rejilla de 4 + 3', w === 1368 && h === 1148, py.stdout || py.stderr)
  check('  …con el fondo transparente', alfa === 0, alfa)
  check('todas las cartas, primero de Limitless (por /escaneo)', ['/escaneo/MEG/77', '/escaneo/MEG/76', '/escaneo/SVI/50', '/escaneo/SVI/172', '/escaneo/MEG/119', '/escaneo/MEE/14'].every((e) => escaneos.includes(e)), escaneos.join(' '))
  check('  …la impresión que se enseña: la 077, no la 179', escaneos.includes('/escaneo/MEG/77') && !escaneos.includes('/escaneo/MEG/179'), escaneos.join(' '))
  check('  …y la que no llega por ningún lado no mancha el lienzo', escaneos.includes('/escaneo/MEG/131') && Boolean(bajada))
  check('sin errores de página', errores.length === 0, errores.join(' | '))
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 7. La pestaña «Meta» del torneo ──')
{
  const { page, errores } = await abrir('/torneo?slug=copa', semillas(), { sesion: 'none' })
  const pestanas = await page.locator('[data-pestana]').allInnerTexts()
  check('un torneo terminado tiene pestaña «Meta» (también sin cuenta)', pestanas.includes('Meta'), pestanas.join(' | '))
  await pestana(page, 'meta')
  const filas = page.locator('.torneo-meta-fila')
  const textos = (await filas.allInnerTexts()).map((t) => t.replace(/\s+/g, ' '))
  check('cinco mazos', textos.length === 5, textos.join(' || '))
  check('el resumen: 9 listas, 5 mazos', /9 listas · 5 mazos distintos/.test(await page.locator('#metaContenido .torneo-meta-resumen > .subtext').innerText()))
  check('el más jugado arriba: Charizard, 3 de 9 (33 %)', /Charizard/.test(textos[0]) && /3 jugadores/.test(textos[0]) && /33 %$/.test(textos[0]), textos[0])
  check('  …su % de victorias, sin los dos byes de Giovanni (3 de 4)', /75 % de victorias/.test(textos[0]), textos[0])
  const cuentas = textos.map((t) => Number(t.match(/(\d+) jugador/)?.[1]))
  const mejores = textos.map((t) => Number(t.match(/mejor puesto (\d+)\.º/)?.[1]))
  check('de más a menos jugado', cuentas.every((n, i) => i === 0 || cuentas[i - 1] >= n), cuentas.join())
  check('  …y a igualdad, el que quedó más arriba', cuentas.every((n, i) => i === 0 || cuentas[i - 1] !== n || mejores[i - 1] < mejores[i]), mejores.join())
  check('el nombre del mazo se lee UNA vez (la chapa no lo repite)', (await page.locator('.torneo-meta-fila').first().locator('.torneo-arquetipo-nombre').evaluate((n) => getComputedStyle(n).display)) === 'none')
  // …tampoco cuando la chapa se queda SIN iconos (un sprite que no
  // llega): entonces la chapa enseña el nombre, y aquí ya va al lado.
  const sinIconos = await page.evaluate(() => {
    const fila = document.querySelector('.torneo-meta-fila .torneo-meta-mazo')
    const chapa = document.createElement('span')
    chapa.className = 'torneo-arquetipo'
    chapa.innerHTML = '<span class="torneo-arquetipo-nombre">Sin iconos</span>'
    fila.appendChild(chapa)
    const d = getComputedStyle(chapa.firstChild).display
    chapa.remove()
    return d
  })
  check('  …ni cuando la chapa se queda sin iconos', sinIconos === 'none', sinIconos)
  const barras = await page.locator('.torneo-meta-barra').evaluateAll((bs) => bs.map((b) => ({ pista: b.getBoundingClientRect().width, parte: b.firstElementChild.getBoundingClientRect().width })))
  check('la barra mide su parte del torneo', Math.abs(barras[0].parte / barras[0].pista - 3 / 9) < 0.02, JSON.stringify(barras[0]))
  check('  …y todas las pistas miden lo mismo, para compararlas a ojo', barras.every((b) => Math.abs(b.pista - barras[0].pista) < 1), barras.map((b) => b.pista.toFixed(1)).join())
  // Aquí todas las cifras tienen dos dígitos y medirían lo mismo igual; con
  // un «5,9 %» al lado de un «33 %» no. Lo que lo garantiza es el ancho
  // mínimo de la cifra, y eso es lo que se mira.
  check('  …porque la cifra tiene un ancho mínimo', await page.locator('.torneo-meta-cuota').first().evaluate((n) => parseFloat(getComputedStyle(n).minWidth) >= 30))

  // Entrar en un mazo.
  await filas.first().click()
  await page.waitForTimeout(400)
  check('al entrar, el foco va a «Todo el meta»', await page.evaluate(() => document.activeElement?.hasAttribute('data-meta-volver')))
  const detalle = (await page.locator('.torneo-meta-jugador').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim())
  check('quién lo jugó, en el orden en que quedó: Erika 1.ª, Giovanni 3.º, jesus 5.º',
    detalle.length === 3 && /^Puesto 1 Erika 2-0-0/.test(detalle[0]) && /^Puesto 3 Giovanni 2-0-0 \(\+2 bye\)/.test(detalle[1]) && /^Puesto 5 jesus 1-1-0/.test(detalle[2]), detalle.join(' || '))
  check('  …con sus puntos', /· 6 puntos/.test(detalle[0]) && /· 3 puntos/.test(detalle[2]))
  check('  …y al lector de pantalla, que el número es el puesto', /Puesto/.test(await page.locator('.torneo-meta-jugador .torneo-pos').first().textContent()))
  check('  …y la cabecera, sin byes: 3-1-0 entre todos', /3 de 9 listas \(33 %\) · 3-1-0 entre todos/.test(await page.locator('.torneo-meta-cabecera').innerText()))

  // Su lista, en la ventana de siempre.
  const ver = page.locator('[data-meta-lista]').nth(1)
  check('«Ver lista» dice de quién', (await ver.getAttribute('aria-label')) === 'Ver lista de Giovanni')
  await ver.click()
  await page.waitForTimeout(1200)
  check('abre la lista de ese jugador', /Lista de Giovanni/.test(await page.locator('#torneoListaTitulo').innerText()))
  check('  …con su puesto final', /^3\.º/.test(await page.locator('.torneo-lista-quien .subtext').innerText()))
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  check('al cerrarla, el foco vuelve a su «Ver lista»', await page.evaluate(() => document.activeElement?.dataset?.metaLista === 'p9'))

  // El refresco de la ficha no la saca del mazo que miraba.
  await page.evaluate(() => window.__VIVO__.emitir('torneo-torneo-1'))
  await page.waitForTimeout(1200)
  check('un refresco no la echa del mazo que estaba mirando', (await page.locator('[data-meta-volver]').count()) === 1)

  await page.click('[data-meta-volver]')
  await page.waitForTimeout(300)
  check('«Todo el meta» vuelve a la lista', (await page.locator('.torneo-meta-fila').count()) === 5)
  check('  …con el foco en el mazo del que venía', await page.evaluate(() => document.activeElement?.closest('li') === document.querySelector('.torneo-meta-lista li')))
  check('sin errores de página', errores.length === 0, errores.join(' | '))
  await page.close()

  // Con corte, el puesto es el del CORTE: Giovanni entró tercero y quedó
  // finalista; Erika entró primera y cayó en semifinales.
  const conCorte = await abrir('/torneo?slug=copa', semillas({ corte: true }))
  await pestana(conCorte.page, 'meta')
  const filasCorte = (await conCorte.page.locator('.torneo-meta-fila').allInnerTexts()).map((t) => t.replace(/\s+/g, ' '))
  check('con corte, el mazo del campeón (Blaine) tiene el mejor puesto 1.º', filasCorte.some((t) => /Gardevoir/.test(t) && /mejor puesto 1\.º/.test(t)), filasCorte.join(' || '))
  await conCorte.page.locator('.torneo-meta-fila', { hasText: 'Charizard' }).click()
  await conCorte.page.waitForTimeout(400)
  const detCorte = (await conCorte.page.locator('.torneo-meta-jugador').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim())
  // Las partidas del corte cuentan en el V-D-E (como en la clasificación),
  // así que entre las dos semifinalistas manda el desempate: Erika queda
  // 4.ª detrás de Ash. Lo que importa es que va por DELANTE de quien no
  // llegó al corte y por DETRÁS de la finalista.
  check('  …y dentro, el orden final: Giovanni 2.º (finalista), Erika semifinalista, jesus después',
    /^Puesto 2 Giovanni/.test(detCorte[0] || '') && /^Puesto [34] Erika/.test(detCorte[1] || '') && /^Puesto ([5-9]) jesus/.test(detCorte[2] || ''), detCorte.join(' || '))
  await conCorte.page.locator('[data-meta-lista="p9"]').click()
  await conCorte.page.waitForTimeout(1200)
  check('  …y la ventana de su lista dice 2.º', /^2\.º/.test(await conCorte.page.locator('.torneo-lista-quien .subtext').innerText()), await conCorte.page.locator('.torneo-lista-quien .subtext').innerText())
  check('  …sin errores', conCorte.errores.length === 0, conCorte.errores.join(' | '))
  await conCorte.page.close()

  // De lista cerrada y en juego: no hay meta que enseñar.
  const cerrado = await abrir('/torneo?slug=copa', semillas({ estado: 'in_progress' }))
  check('en juego y de lista cerrada, NO hay pestaña «Meta»', !(await cerrado.page.locator('[data-pestana]').allInnerTexts()).includes('Meta'))
  await cerrado.page.close()
  const abierto = await abrir('/torneo?slug=copa', semillas({ estado: 'in_progress', visibilidad: 'en_juego' }))
  check('de lista abierta y en juego, sí', (await abierto.page.locator('[data-pestana]').allInnerTexts()).includes('Meta'))
  await pestana(abierto.page, 'meta')
  check('  …y avisa de que los puestos van cambiando', /sigue en juego/.test(await abierto.page.locator('#metaContenido').innerText()))
  await abierto.page.close()

  // En el móvil.
  const movil = await abrir('/torneo?slug=copa', semillas(), { ancho: 390, alto: 844 })
  await pestana(movil.page, 'meta')
  check('en el móvil no desborda', await movil.page.evaluate(() => document.documentElement.scrollWidth <= 390), await movil.page.evaluate(() => document.documentElement.scrollWidth))
  const alto = await movil.page.locator('.torneo-meta-fila').first().evaluate((b) => b.getBoundingClientRect().height)
  check('  …y cada mazo se puede pulsar con el dedo', alto >= 44, alto)
  await movil.page.locator('.torneo-meta-fila').first().click()
  await movil.page.waitForTimeout(300)
  check('  …ni dentro de un mazo', await movil.page.evaluate(() => document.documentElement.scrollWidth <= 390), await movil.page.evaluate(() => document.documentElement.scrollWidth))
  // El fallo que hubo: con una tabla, el «Ver lista» se iba de la pantalla.
  const verMovil = await movil.page.locator('[data-meta-lista]').first().evaluate((b) => b.getBoundingClientRect())
  check('  …y el «Ver lista» se ve entero sin arrastrar de lado', verMovil.right <= 390 - 8 && verMovil.left > 0, JSON.stringify(verMovil))
  await movil.page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 8. El constructor: todas las cartas, y todas con cara ──')
{
  const enlace = await (async () => {
    const { page } = await abrir('/torneo?slug=copa', semillas())
    await abrirListaDe(page, 'Ash')
    const h = await page.locator('#torneoListaModal a', { hasText: 'Abrir en el constructor' }).getAttribute('href')
    await page.close()
    return h
  })()
  const { page, errores } = await abrir(enlace, semillas())
  await page.waitForTimeout(1500)
  const mazo = await page.locator('#cmMazo [data-id]').evaluateAll((xs) => xs.map((x) => ({ id: x.dataset.id, n: x.querySelector('.cm-carta-n, .cm-fila-n')?.textContent.trim(), src: x.querySelector('img')?.getAttribute('src') || '' })))
  const n = Object.fromEntries(mazo.map((x) => [x.id, x.n]))
  check('llegan las 25 cartas (antes las energías MEE 9–16 no se encontraban)', (await page.locator('#cmTabCuenta').innerText()) === '25', await page.locator('#cmTabCuenta').innerText())
  check('  …sin «No he encontrado…»', !/No he encontrado/.test(await page.locator('#cmAviso').innerText()))
  check('el Mega-Lucario, uno de 4 con la impresión baja', n['me01-077'] === '4' && !n['me01-179'] && !n['mep-010'], JSON.stringify(n))
  check('las Órdenes, juntas (3) y la Ultra Ball normal (4)', n['sv01-172'] === '3' && !n['me01-114'] && n['me01-131'] === '4' && !n['me01-191'], JSON.stringify(n))
  check('las energías, una fila de 8 (antes la segunda pisaba a la primera)', n['mee-006'] === '8', JSON.stringify(n))
  const lillie = mazo.find((x) => x.id === 'me01-119')
  check('la carta sin escaneo en el espejo se ve, de Limitless', lillie?.src === imagenDeLimitless('MEG', '119'), lillie?.src)
  check('sin errores de página', errores.length === 0, errores.join(' | '))

  // «Usar de portada», y al guardar se queda.
  await page.locator('#cmMazo [data-id="me01-076"] [data-info]').click()
  await page.waitForTimeout(400)
  const boton = page.locator('#cmCartaPortada')
  check('la carta abierta ofrece «Usar de portada»', (await boton.isVisible()) && (await boton.innerText()) === 'Usar de portada')
  await boton.click()
  await page.waitForTimeout(300)
  check('  …y después dice que ya lo es', (await boton.innerText()) === 'Es la portada del mazo' && (await boton.isDisabled()))
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)
  await page.click('#cmGuardar')
  await page.waitForTimeout(1200)
  const guardado = await page.evaluate(() => window.__TABLAS__.user_decks.at(-1))
  check('al guardar, la portada es la elegida y no el Pokémon con más copias', guardado?.cover_card === 'me01-076', guardado?.cover_card)
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 9. La portada se respeta al volver a guardar ──')
{
  const mazos = {
    __FAKE_MAZOS__: [
      // La portada se buscó en «Mis mazos» y NO es del mazo.
      { id: 'mazo-1', user_id: 'user-2', name: 'Lucario', cards: [{ id: 'me01-077', n: 4 }, { id: 'me01-076', n: 3 }], cover_card: 'me01-131' },
      // La portada era del mazo… y se va a quitar.
      { id: 'mazo-2', user_id: 'user-2', name: 'Otro', cards: [{ id: 'me01-077', n: 4 }, { id: 'me01-076', n: 1 }], cover_card: 'me01-076' },
    ],
  }
  const a = await abrir('/constructor?mazo=mazo-1', semillas({ extra: mazos }))
  await a.page.locator('#cmMazo [data-id="me01-076"] [data-mas]').click()
  await a.page.click('#cmGuardar')
  await a.page.waitForTimeout(1200)
  check('una portada elegida de FUERA del mazo sobrevive a guardar', (await a.page.evaluate(() => window.__TABLAS__.user_decks.find((m) => m.id === 'mazo-1').cover_card)) === 'me01-131')
  check('  …y las cartas sí cambian', (await a.page.evaluate(() => window.__TABLAS__.user_decks.find((m) => m.id === 'mazo-1').cards.find((c) => c.id === 'me01-076').n)) === 4)
  await a.page.close()
  const b = await abrir('/constructor?mazo=mazo-2', semillas({ extra: mazos }))
  await b.page.locator('#cmMazo [data-id="me01-076"] [data-menos]').click()
  await b.page.click('#cmGuardar')
  await b.page.waitForTimeout(1200)
  check('una portada del mazo que se QUITA del mazo deja de valer', (await b.page.evaluate(() => window.__TABLAS__.user_decks.find((m) => m.id === 'mazo-2').cover_card)) === 'me01-077')
  await b.page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 10. «Mis mazos»: la portada que tú quieras ──')
{
  const sem = semillas({
    extra: {
      __FAKE_MAZOS__: [
        { id: 'mazo-1', user_id: 'user-2', name: 'Lucario', cards: [{ id: 'mee-006', n: 8 }, { id: 'me01-119', n: 2 }, { id: 'me01-076', n: 3 }, { id: 'me01-077', n: 4 }], cover_card: null },
        { id: 'mazo-2', user_id: 'user-2', name: 'Vacío', cards: [], cover_card: null, is_public: true },
        { id: 'mazo-3', user_id: 'user-1', name: 'De otro', cards: [] },
      ],
    },
  })
  const { page, errores } = await abrir('/mazos', sem)
  check('la cuenta de tus mazos (no los de otros)', (await page.locator('#mzCuenta').innerText()) === '2 mazos')
  const t1 = page.locator('.cm-mazo-tarjeta[data-id="mazo-1"]')
  const portadaAntes = await t1.locator('.cm-mazo-portada img').getAttribute('src')
  check('sin portada elegida, la tarjeta enseña la primera carta (la energía)', Boolean(portadaAntes) && !/me01/.test(portadaAntes), portadaAntes)
  check('  …en grande', (await t1.locator('.cm-mazo-portada').evaluate((n) => n.getBoundingClientRect().height)) > 150)
  check('  …sus chapas: 17/60, Estándar y Privado', /17\/60/.test(await t1.innerText()) && /Estándar/.test(await t1.innerText()) && /Privado/.test(await t1.innerText()))
  check('un mazo vacío no rompe nada', (await page.locator('.cm-mazo-tarjeta[data-id="mazo-2"]').count()) === 1)

  await t1.locator('[data-portada]').click()
  await page.waitForTimeout(800)
  check('«Portada» abre la ventana', await page.locator('#mzModalPortada').isVisible())
  check('  …con el foco en cerrar', await page.evaluate(() => document.activeElement?.id === 'mzPortadaCerrar'))
  const opciones = await page.locator('#mzPortadaDelMazo [data-elegir]').evaluateAll((xs) => xs.map((x) => ({ id: x.dataset.elegir, pulsada: x.getAttribute('aria-pressed'), src: x.querySelector('img')?.getAttribute('src') || '' })))
  check('las cartas del mazo, los Pokémon primero', opciones.map((o) => o.id).join() === 'me01-077,me01-076,me01-119,mee-006', opciones.map((o) => o.id).join())
  check('  …con la de ahora marcada', opciones.filter((o) => o.pulsada === 'true').map((o) => o.id).join() === 'mee-006', JSON.stringify(opciones.map((o) => o.pulsada)))
  check('  …y la que no tiene escaneo en el espejo, de Limitless', opciones.find((o) => o.id === 'me01-119')?.src === imagenDeLimitless('MEG', '119'))
  await page.click('#mzPortadaDelMazo [data-elegir="me01-076"]')
  await page.waitForTimeout(800)
  check('elegir una la guarda', (await page.evaluate(() => window.__TABLAS__.user_decks.find((m) => m.id === 'mazo-1').cover_card)) === 'me01-076')
  check('  …solo la portada (ni cartas ni nombre)', await page.evaluate(() => {
    const m = window.__TABLAS__.user_decks.find((x) => x.id === 'mazo-1')
    return m.name === 'Lucario' && m.cards.length === 4
  }))
  check('  …cierra la ventana', await page.locator('#mzModalPortada').isHidden())
  check('  …la tarjeta enseña la nueva', /me01\/076\//.test((await t1.locator('.cm-mazo-portada img').getAttribute('src')) || ''))
  check('  …y el foco vuelve a su botón «Portada»', await page.evaluate(() => document.activeElement?.matches('[data-id="mazo-1"] [data-portada]')))

  // Cualquier otra, buscándola.
  await t1.locator('[data-portada]').click()
  await page.waitForTimeout(600)
  await page.fill('#mzPortadaBuscar', 'ultra')
  await page.waitForTimeout(1200)
  const halladas = await page.locator('#mzPortadaResultados [data-elegir]').evaluateAll((xs) => xs.map((x) => x.dataset.elegir))
  check('se puede buscar cualquier carta', halladas.includes('me01-131'), halladas.join())
  await page.click('#mzPortadaResultados [data-elegir="me01-131"]')
  await page.waitForTimeout(800)
  check('  …y ponerla aunque no sea del mazo', (await page.evaluate(() => window.__TABLAS__.user_decks.find((m) => m.id === 'mazo-1').cover_card)) === 'me01-131')
  check('  …la tarjeta la enseña', /me01\/131\//.test((await t1.locator('.cm-mazo-portada img').getAttribute('src')) || ''))

  // Cerrar sin elegir.
  await t1.locator('[data-portada]').click()
  await page.waitForTimeout(500)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)
  check('Escape cierra sin cambiar nada', (await page.locator('#mzModalPortada').isHidden()) && (await page.evaluate(() => window.__TABLAS__.user_decks.find((m) => m.id === 'mazo-1').cover_card)) === 'me01-131')
  await t1.locator('[data-portada]').click()
  await page.waitForTimeout(500)
  await page.mouse.click(5, 5)
  await page.waitForTimeout(200)
  check('  …y pulsar fuera, también', await page.locator('#mzModalPortada').isHidden())
  check('sin errores de página', errores.length === 0, errores.join(' | '))
  await page.close()

  for (const [nombre, op] of [['móvil', { ancho: 390, alto: 844 }], ['móvil oscuro', { ancho: 390, alto: 844, oscuro: true }]]) {
    const m = await abrir('/mazos', sem, op)
    check(`${nombre}: no desborda`, await m.page.evaluate(() => document.documentElement.scrollWidth <= 390))
    await m.page.locator('.cm-mazo-tarjeta[data-id="mazo-1"] [data-portada]').click()
    await m.page.waitForTimeout(700)
    const opcion = await m.page.locator('#mzPortadaDelMazo [data-elegir]').first().evaluate((b) => b.getBoundingClientRect())
    check(`${nombre}: las cartas de la ventana se pueden pulsar (≥ 44 px) y caben`, opcion.width >= 44 && opcion.height >= 44 && opcion.right <= 390, JSON.stringify(opcion))
    const porFila = await m.page.locator('#mzPortadaDelMazo [data-elegir]').evaluateAll((xs) => xs.filter((x) => Math.round(x.getBoundingClientRect().top) === Math.round(xs[0].getBoundingClientRect().top)).length)
    check(`${nombre}: tres por fila, para que el buscador se vea`, porFila === 3, porFila)
    // El campo de buscar con el fondo de la casa: el del navegador se
    // quedaba blanco también en el tema oscuro.
    const fondo = await m.page.locator('#mzPortadaBuscar').evaluate((n) => getComputedStyle(n).backgroundColor)
    const fondoPagina = await m.page.evaluate(() => getComputedStyle(document.body).backgroundColor)
    check(`${nombre}: el buscador lleva el fondo de la página, no el del navegador`, fondo === fondoPagina, `${fondo} · ${fondoPagina}`)
    check(`${nombre}: sin errores`, m.errores.length === 0, m.errores.join(' | '))
    await m.page.close()
  }
}

await browser.close()
console.log(fails ? `\n${fails} FALLOS` : '\nTodo en verde')
process.exit(fails ? 1 : 0)
