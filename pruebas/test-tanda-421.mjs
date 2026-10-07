// Tanda 421 — lo que pidió PINGU el 2026-10-01 a las 15:52:
//
//   1. «que la imagen de la lista al exportarla salgan todas las cartas
//      juntas, con el toque de PokeDoc y con el fondo transparente, y así
//      podamos importar una lista mediante la imagen»;
//   2. «en el meta de los torneos hay arquetipos que se repiten y
//      aparecen por separado, no tiene sentido: que salgan los datos
//      juntos».
//
// La imagen se importa por DOS caminos y se prueban los dos: la lista
// que va escrita dentro del PNG (exacta), y el reconocimiento por cómo se
// ve para cuando la imagen se ha recomprimido (sin la lista dentro, sobre
// transparente, sobre negro y sobre blanco).
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
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
const BASE = process.env.PD_BASE || process.env.BASE || 'http://localhost:8892'
const hace = (min) => new Date(Date.now() - min * 60000).toISOString()
const DIR = mkdtempSync(join(tmpdir(), 'tanda-421-'))
const { meterLista, sacarLista, CLAVE_LISTA } = await import(`${RAIZ}/js/lista-en-png.js`)

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
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), trozo('IHDR', cab), trozo('IDAT', deflateSync(Buffer.concat(Array(h).fill(fila)))), trozo('IEND', Buffer.alloc(0))])
}
const PNG = pngLiso(245, 342, [214, 120, 60])
const py = (codigo) => spawnSync('python3', ['-c', codigo], { encoding: 'utf8' })

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. La lista dentro del PNG (js/lista-en-png.js) ──')
{
  const texto = "Pokémon: 4\n4 Mega Lucario ex MEG 077\n\nTrainer: 2\n2 Órdenes del jefe MEG 114"
  const con = meterLista(PNG, texto)
  check('sale de vuelta tal cual, con tildes', sacarLista(con) === texto, sacarLista(con))
  check('  …y la clave es la nuestra', CLAVE_LISTA === 'pokedoc:lista' && Buffer.from(con).includes(Buffer.from('iTXt' + CLAVE_LISTA)))
  writeFileSync(join(DIR, 'con.png'), con)
  const r = py(`from PIL import Image\nim = Image.open(${JSON.stringify(join(DIR, 'con.png'))}); im.load(); print(im.size, im.text.get('pokedoc:lista', '')[:16])`)
  check('el PNG sigue siendo un PNG válido (lo abre PIL, CRC incluido)', /\(245, 342\) Pokémon: 4/.test(r.stdout), r.stdout || r.stderr)
  check('un PNG sin lista no tiene lista', sacarLista(PNG) === null)
  check('un JPEG tampoco (y no se rompe)', sacarLista(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3])) === null && meterLista(new Uint8Array([0xff, 0xd8]), 'x').length === 2)
  check('un PNG cortado no revienta', sacarLista(con.subarray(0, 40)) === null)
}

// ═════════════════════════════════════════════════════════════════════
// El catálogo y la lista de Ash (los mismos de la 413).
const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
const carta = (set_id, local_id, name, category, extra = {}) => ({
  id: `${set_id}-${local_id}`, set_id, market: 'WEST', local_id, name, name_es: name, name_key: norm(name), name_search: norm(name),
  category, regulation_mark: 'I', image_path: `${set_id}/${local_id}`, ...extra,
})
const ATQ = [{ name: 'Aura Jab' }, { name: 'Mega Brave' }]
const CARTAS = [
  carta('me01', '077', 'Mega Lucario ex', 'Pokemon', { attacks: ATQ, stage: 'Stage 1' }),
  carta('me01', '179', 'Mega Lucario ex', 'Pokemon', { attacks: ATQ, stage: 'Stage 1' }),
  carta('mep', '010', 'Mega Lucario ex', 'Pokemon', { attacks: ATQ, stage: 'Stage 1', image_path: null }),
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
const L = (quantity, name, set, number) => ({ quantity, name, set, number })
const LISTA_ASH = {
  pokemon: [L(3, 'Mega Lucario ex', 'MEP', '10'), L(1, 'Mega Lucario ex', 'MEG', '179'), L(3, 'Riolu', 'MEG', '76'), L(1, 'Riolu', 'SVI', '50')],
  trainer: [L(1, "Boss's Orders", 'MEG', '114'), L(2, "Boss's Orders", 'SVI', '172'), L(2, "Lillie's Determination", 'MEG', '119'), L(4, 'Ultra Ball', 'MEG', '191')],
  energy: [L(5, 'Basic {F} Energy', 'SVE', '6'), L(3, 'Fighting Energy', 'MEE', '14')],
}
// Las copias que tiene que leer el reconocimiento, en el orden de la rejilla.
const COPIAS = [4, 3, 1, 3, 2, 4, 8]

// Los mazos del meta: cuatro Zoroark de N con tres parejas distintas (uno
// exportado en ESPAÑOL), dos Dragapult (con Dusknoir y con martillos), un
// Mega-Lucario y un Lucario a secas, que NO es el mismo mazo.
const MAZOS = {
  zDarm: { pokemon: [L(3, "N's Zoroark ex", 'JTG', '98'), L(3, "N's Zorua", 'JTG', '97'), L(2, "N's Darmanitan", 'JTG', '27'), L(2, "N's Darumaka", 'JTG', '26')], trainer: [], energy: [] },
  zEs: { pokemon: [L(3, 'Zoroark ex de N', 'JTG', '98'), L(3, 'Zorua de N', 'JTG', '97'), L(2, 'Darmanitan de N', 'JTG', '27'), L(2, 'Darumaka de N', 'JTG', '26')], trainer: [], energy: [] },
  zPech: { pokemon: [L(3, "N's Zoroark ex", 'JTG', '98'), L(3, "N's Zorua", 'JTG', '97'), L(2, 'Pecharunt ex', 'SFA', '39')], trainer: [], energy: [] },
  zSolo: { pokemon: [L(3, "N's Zoroark ex", 'JTG', '98'), L(3, "N's Zorua", 'JTG', '97'), L(1, 'Munkidori', 'TWM', '95')], trainer: [], energy: [] },
  dDusk: { pokemon: [L(3, 'Dragapult ex', 'TWM', '130'), L(3, 'Drakloak', 'TWM', '129'), L(4, 'Dreepy', 'TWM', '128'), L(2, 'Dusknoir', 'SFA', '20'), L(2, 'Dusclops', 'SFA', '19'), L(2, 'Duskull', 'SFA', '18')], trainer: [], energy: [] },
  dHammer: { pokemon: [L(3, 'Dragapult ex', 'TWM', '130'), L(3, 'Drakloak', 'TWM', '129'), L(4, 'Dreepy', 'TWM', '128')], trainer: [L(4, 'Crushing Hammer', 'SVI', '168')], energy: [] },
  luc: LISTA_ASH,
  lucNo: { pokemon: [L(3, 'Lucario', 'SVI', '114'), L(4, 'Riolu', 'SVI', '113'), L(2, 'Hariyama', 'MEG', '72')], trainer: [], energy: [] },
}
const GENTE = [['p4', 'Gary'], ['p5', 'Brock2'], ['p6', 'Erika'], ['p7', 'Sabrina'], ['p8', 'Blaine']]
const JUGADORES = ['user-1', 'user-2', 'user-3', ...GENTE.map(([id]) => id)]
const DE = { 'user-1': 'luc', 'user-2': 'zDarm', 'user-3': 'zEs', p4: 'zPech', p5: 'zSolo', p6: 'dDusk', p7: 'dHammer', p8: 'lucNo' }
const textoDe = (p) => ['pokemon', 'trainer', 'energy'].map((s) => p[s].map((l) => `${l.quantity} ${l.name} ${l.set} ${l.number}`).join('\n')).join('\n\n')

function semillas(extra = {}) {
  return {
    __PROYECTAR__: ['tcg_cards'],
    __FAKE_SETS__: SETS,
    __FAKE_CARTAS__: CARTAS,
    __FAKE_PERFILES__: GENTE.map(([id, username]) => ({ id, username, display_name: username })),
    __FAKE_TORNEOS__: [{ id: 'torneo-1', slug: 'copa', name: 'Copa del Gimnasio', status: 'finished', admin_id: 'admin-1', swiss_rounds: 1, top_cut_size: 0, current_round_id: null, decklist_visibility: 'al_terminar' }],
    __FAKE_INSCRIPCIONES__: JUGADORES.map((u, i) => ({ id: `insc-${i + 1}`, tournament_id: 'torneo-1', user_id: u })),
    __FAKE_RONDAS__: [{ id: 'ronda-1', round_number: 1, status: 'finished', phase: 'swiss', started_at: hace(60) }],
    __FAKE_MESAS__: [['m1', 'user-1', 'user-2'], ['m2', 'user-3', 'p4'], ['m3', 'p5', 'p6'], ['m4', 'p7', 'p8']].map(([id, a, b], i) => ({ id, round_id: 'ronda-1', table_number: i + 1, player_a_id: a, player_b_id: b, status: 'finished', check_in_a_at: hace(59), check_in_b_at: hace(59) })),
    __FAKE_RESULTADOS__: [['m1', 'b_wins', 'user-2'], ['m2', 'a_wins', 'user-3'], ['m3', 'a_wins', 'p5'], ['m4', 'b_wins', 'p8']].map(([match_id, result, winner_id], i) => ({ id: `r-${i}`, match_id, result, winner_id })),
    __FAKE_DECKLISTS__: JUGADORES.map((u, i) => {
      const p = { ...MAZOS[DE[u]] }
      p.total = ['pokemon', 'trainer', 'energy'].reduce((n, s) => n + p[s].reduce((m, l) => m + l.quantity, 0), 0)
      return { id: `deck-${i + 1}`, tournament_id: 'torneo-1', user_id: u, raw_text: textoDe(p), parsed_cards: p, locked_at: hace(90) }
    }),
    ...extra,
  }
}

const browser = await chromium.launch()
async function abrir(ruta, { sesion = 'user-2', extra = {} } = {}) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, acceptDownloads: true })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.route(/^https:\/\/[^/]+\/.*\.(png|webp|jpg)(\?.*)?$/i, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: PNG, headers: { 'access-control-allow-origin': '*' } }))
  await page.route(/\/escaneo\/[^/]+\/[^/?]+$/, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }))
  await page.addInitScript(([s, se]) => {
    window.__FAKE_SESSION__ = s
    for (const [k, v] of Object.entries(se)) window[k] = v
  }, [sesion, semillas(extra)])
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  return { page, errores }
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. El meta junta las variantes de un mismo mazo (agruparMeta) ──')
{
  const { page, errores } = await abrir('/torneo?slug=copa')
  const r = await page.evaluate(async (mazos) => {
    const { arquetipoDeMazo } = await import('/js/torneos/arquetipos.js')
    const { agruparMeta, claveDelMeta } = await import('/js/torneos/meta-torneo.js')
    const arqs = new Map(Object.entries(mazos).map(([k, p]) => [k, arquetipoDeMazo(p, [])]))
    // El español va PRIMERO a propósito: el grupo tiene que llamarse como
    // lo llaman los más, no como el primero de la clasificación.
    const tabla = ['zEs', 'luc', 'dHammer', 'zDarm', 'zSolo', 'dDusk', 'zPech', 'lucNo'].map((playerId, i) => ({ playerId, wins: 3 - Math.min(3, i), losses: Math.min(3, i), draws: 0, byesReceived: 0, matchPoints: 3 * (3 - Math.min(3, i)) }))
    const m = agruparMeta(arqs, tabla)
    const martillos = { id: null, nombre: 'Martillos', iconos: [{ nombre: 'Crushing Hammer' }], curado: false }
    return {
      grupos: m.arquetipos.map((g) => ({ nombre: g.arq.nombre, iconos: g.arq.iconos.length, cuantos: g.cuantos, jugadores: g.jugadores.map((j) => j.userId), variantes: g.variantes.map((v) => `${v.nombre}×${v.cuantos}`) })),
      martillos: claveDelMeta(martillos),
      mismoIdioma: claveDelMeta(arqs.get('zDarm')) === claveDelMeta(arqs.get('zEs')),
      mega: claveDelMeta(arqs.get('luc')) !== claveDelMeta(arqs.get('lucNo')),
      lucario: arqs.get('luc').nombre,
    }
  }, MAZOS)
  const de = (n) => r.grupos.find((g) => g.nombre === n)
  check('ocho listas, cuatro mazos (no siete)', r.grupos.length === 4, r.grupos.map((g) => g.nombre).join(' | '))
  const z = de("N's Zoroark ex")
  check("los cuatro Zoroark de N, juntos, con el nombre del principal que más se repite", z?.cuantos === 4, JSON.stringify(r.grupos.map((g) => g.nombre)))
  check('  …también el exportado en español', z?.jugadores.includes('zEs'))
  check('  …con un solo icono (el del principal)', z?.iconos === 1)
  check('  …y sus variantes, contadas: Darmanitan ×2 (inglés y español son la misma), Pecharunt y solo', z?.variantes.length === 3 && /Darmanitan.*×2/.test(z.variantes[0]), JSON.stringify(z?.variantes))
  check('  …sus jugadores, en el orden de la clasificación', z?.jugadores.join() === 'zEs,zDarm,zSolo,zPech', z?.jugadores.join())
  const d = de('Dragapult ex')
  check('Dragapult con Dusknoir y con martillos, juntos', d?.cuantos === 2 && d.variantes.length === 2, JSON.stringify(d))
  const luc = r.grupos.find((g) => /^Mega Lucario ex/.test(g.nombre))
  check('un mazo jugado igual por todos se queda con su arquetipo entero', luc?.cuantos === 1 && luc.variantes.length === 0 && luc.nombre === r.lucario, JSON.stringify(luc))
  check('Mega-Lucario y Lucario a secas NO son el mismo mazo', r.mega && Boolean(de('Lucario Hariyama')))
  check('el mismo mazo en inglés y en español, misma clave', r.mismoIdioma)
  check('un mazo cuyo principal no es un Pokémon se agrupa como antes', r.martillos === 'd:martillos', r.martillos)
  check('sin errores de página', errores.length === 0, errores.join(' | '))
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. Y en la pestaña Meta ──')
{
  const { page, errores } = await abrir('/torneo?slug=copa')
  await page.click('[data-pestana="meta"]')
  await page.waitForTimeout(500)
  const filas = (await page.locator('.torneo-meta-fila').allInnerTexts()).map((t) => t.replace(/\s+/g, ' '))
  check('cuatro filas para ocho listas', filas.length === 4, filas.join(' || '))
  check('  …el Zoroark de N arriba, 4 jugadores y 3 variantes (50 %)', /^N's Zoroark ex 4 jugadores · 3 variantes/.test(filas[0]) && /50 %$/.test(filas[0]), filas[0])
  check('  …y sin filas repetidas', new Set(filas.map((f) => f.split(' ')[0] + f.split(' ')[1])).size === filas.length)
  await page.locator('.torneo-meta-fila').first().click()
  await page.waitForTimeout(400)
  const variantes = await page.locator('.torneo-meta-variantes').innerText()
  // La variante lleva el nombre de quien quedó más arriba con ella: aquí,
  // jesus, que la exportó en español. Lo que importa es que va UNA vez y ×2.
  check('dentro, las variantes', /Variantes: (N's Zoroark ex N's Darmanitan|Zoroark ex de N Darmanitan de N) ×2 · /.test(variantes) && /Pecharunt ex/.test(variantes) && (variantes.match(/Darmanitan/g) || []).length === 1, variantes)
  const quien = (await page.locator('.torneo-meta-jugador').allInnerTexts()).map((t) => t.replace(/\s+/g, ' '))
  check('  …y cada jugador con lo que jugó', quien.length === 4 && quien.some((q) => /Blaine|jesus/.test(q) && /Zoroark ex de N Darmanitan de N/.test(q)) && quien.some((q) => /Pecharunt ex/.test(q)), quien.join(' || '))
  check('sin errores de página', errores.length === 0, errores.join(' | '))
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 4. La imagen exportada: todas juntas, transparente, con el toque de la casa ──')
let rutaImagen = null
{
  const { page, errores } = await abrir('/torneo?slug=copa')
  const rejillas = await page.evaluate(async () => {
    const { medidas } = await import('/js/torneos/decklist-imagen.js')
    return [24, 7, 13, 40, 1].map((n) => {
      const m = medidas({ pokemon: Array(n).fill({}) })
      return `${n}:${m.columnas}x${m.filas}`
    })
  })
  check('una lista normal en tres filas, como Limitless (24 → 8×3)', rejillas[0] === '24:8x3', rejillas.join(' '))
  check('  …y repartidas sin cartas sueltas (7 → 4×2, 13 → 5×3)', rejillas[1] === '7:4x2' && rejillas[2] === '13:5x3', rejillas.join(' '))
  check('  …con 10 por fila como mucho (40 → 10×4) y una sola si es una', rejillas[3] === '40:10x4' && rejillas[4] === '1:1x1', rejillas.join(' '))
  await page.click('[data-pestana="clasificacion"]')
  await page.waitForTimeout(300)
  await page.locator('#clasificacionContenido tbody tr').filter({ has: page.locator('[data-historial]', { hasText: /^Ash$/ }) }).locator('[data-ver-lista]').click()
  await page.waitForTimeout(1800)
  const [bajada] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }).catch(() => null), page.click('#torneoListaModal [data-exportar-imagen]')])
  check('se descarga', Boolean(bajada))
  rutaImagen = join(DIR, 'ash.png')
  if (bajada) await bajada.saveAs(rutaImagen)
  // Siete cartas distintas → dos filas, 4 + 3. Cada carta 150×209
  // con 12 de hueco y 24 de margen, todo al doble.
  const a = py(`
from PIL import Image
im = Image.open(${JSON.stringify(rutaImagen)}).convert('RGBA')
W, H = im.size
def px(x, y): return im.getpixel((int(x), int(y)))
# centro de la insignia de la primera carta y de la séptima (segunda fila)
# dentro del hexágono, a un lado del número
c1 = px(2 * (24 + 75 + 18), 2 * (24 + 0.84 * 209))
c7 = px(2 * (24 + 75 + 18), 2 * (24 + 209 + 12 + 0.84 * 209))
# la franja de la marca, abajo, y lo que hay entre la rejilla y la franja
franja = px(W / 2, H - 2 * (24 + 38))
hueco = px(W / 2, 2 * (24 + 2 * 209 + 12 + 10))
# entre dos cartas de la misma fila
entre = px(2 * (24 + 150 + 6), 2 * (24 + 100))
print(W, H, px(4, 4)[3], px(W - 4, H - 4)[3], *c1, *c7, *franja, hueco[3], entre[3])`)
  const v = (a.stdout || '').trim().split(/\s+/).map(Number)
  const [W, H, alfa1, alfa2] = v
  const c1 = v.slice(4, 8)
  const c7 = v.slice(8, 12)
  const franja = v.slice(12, 16)
  const [hueco, entre] = v.slice(16)
  check('una sola rejilla: 4 por fila y 2 filas (1368 × 1148)', W === 1368 && H === 1148, a.stdout || a.stderr)
  check('fondo TRANSPARENTE en las esquinas', alfa1 === 0 && alfa2 === 0, `${alfa1} ${alfa2}`)
  check('  …entre las cartas', entre === 0, entre)
  check('  …y entre la rejilla y la franja', hueco === 0, hueco)
  const azul = ([r, g, b, al]) => al === 255 && b > 70 && b - r > 40
  check('las copias en el hexágono AZUL de la casa (primera fila)', azul(c1), c1.join())
  check('  …y en la segunda (la energía)', azul(c7), c7.join())
  check('debajo, la franja de PokeDoc', azul(franja), franja.join())
  const lista = sacarLista(readFileSync(rutaImagen))
  check('el PNG lleva la lista DENTRO', Boolean(lista), lista)
  check('  …con la impresión que se enseña y sus copias', /^Pokémon: 8$/m.test(lista || '') && /^4 Mega Lucario ex MEG 077$/m.test(lista || '') && /^4 Ultra Ball MEG 131$/m.test(lista || ''), lista)
  check('  …y las tres secciones (25 cartas)', /^Trainer: 9$/m.test(lista || '') && /^Energy: 8$/m.test(lista || '') && /^8 Basic \{F\} Energy SVE 006$/m.test(lista || ''), lista)
  check('sin errores de página', errores.length === 0, errores.join(' | '))
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 5. Importar esa imagen en el constructor: EXACTA ──')
{
  const { page, errores } = await abrir('/constructor')
  await page.setInputFiles('#cmImagenFichero', rutaImagen)
  await page.waitForTimeout(1200)
  check('pasa al texto con la lista escrita', (await page.locator('#cmImportarPanelTexto').isVisible()) && /4 Mega Lucario ex MEG 077/.test(await page.locator('#cmImportarTexto').inputValue()))
  check('  …y dice de dónde sale', /trae la lista dentro/.test(await page.locator('#cmImportarResultado').innerText()))
  check('  …sin cargar el reconocimiento (3 MB)', !(await page.evaluate(() => performance.getEntriesByType('resource').some((r) => /huellas\.bin/.test(r.name)))))
  await page.click('#cmImportarBoton')
  await page.waitForTimeout(1500)
  const mazo = Object.fromEntries(await page.locator('#cmMazo [data-id]').evaluateAll((xs) => xs.map((x) => [x.dataset.id, x.querySelector('.cm-carta-n, .cm-fila-n')?.textContent.trim()])))
  check('las 25 cartas', (await page.locator('#cmTabCuenta').innerText()) === '25', await page.locator('#cmTabCuenta').innerText())
  check('  …cada una la que era', mazo['me01-077'] === '4' && mazo['me01-076'] === '3' && mazo['sv01-050'] === '1' && mazo['sv01-172'] === '3' && mazo['me01-119'] === '2' && mazo['me01-131'] === '4' && mazo['mee-006'] === '8', JSON.stringify(mazo))
  check('sin errores de página', errores.length === 0, errores.join(' | '))
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 6. Y recomprimida (sin la lista dentro): por cómo se ve ──')
{
  // Como la deja una red social: vuelta a guardar sin sus trozos de
  // texto, transparente, aplanada sobre negro y aplanada sobre blanco.
  const r = py(`
from PIL import Image
im = Image.open(${JSON.stringify(rutaImagen)}).convert('RGBA')
im.save(${JSON.stringify(join(DIR, 'transparente.png'))})
for nombre, color in (('negro', (0, 0, 0)), ('blanco', (255, 255, 255))):
    fondo = Image.new('RGB', im.size, color)
    fondo.paste(im, mask=im.split()[3])
    fondo.save(${JSON.stringify(DIR)} + '/' + nombre + '.jpg', quality=88)
print('ok')`)
  check('(se preparan las tres)', /ok/.test(r.stdout), r.stderr)
  check('la vuelta a guardar se ha llevado la lista', sacarLista(readFileSync(join(DIR, 'transparente.png'))) === null)
  for (const fichero of ['transparente.png', 'negro.jpg', 'blanco.jpg']) {
    const { page, errores } = await abrir('/constructor')
    await page.setInputFiles('#cmImagenFichero', join(DIR, fichero))
    await page.locator('.cm-imagen-fila').first().waitFor({ timeout: 30000 }).catch(() => {})
    await page.waitForTimeout(500)
    const copias = await page.locator('.cm-imagen-fila [data-copias]').evaluateAll((xs) => xs.map((x) => Number(x.value)))
    check(`${fichero}: encuentra las 7 cartas`, copias.length === 7, `${copias.length} — ${await page.locator('#cmImagenEstado').innerText()}`)
    check(`${fichero}: y lee sus copias en el hexágono azul (4 3 1 3 2 4 8)`, copias.join() === COPIAS.join(), copias.join())
    check(`${fichero}: sin errores de página`, errores.length === 0, errores.join(' | '))
    await page.close()
  }
}

await browser.close()
console.log(fails ? `\n${fails} FALLOS` : '\nTodo en verde')
process.exit(fails ? 1 : 0)
