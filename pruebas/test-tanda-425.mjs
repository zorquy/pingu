// Tanda 425 — la imagen del meta de un torneo, para quien lo lleva.
//
// PINGU, con la infografía del meta de un regional delante: «usa los
// [sprites] que hay en pokedoc o añade una opción para que los admin
// puedan generar esa imagen al acabar todos los torneos».
//
// Lo que se prueba:
//   1. /sprite (netlify/functions/sprite.mjs): trae el sprite de la CDN de
//      Limitless desde NUESTRO dominio, porque Limitless no da permiso de
//      CORS y un canvas que pinta una imagen sin permiso ya no se puede
//      guardar. No es un proxy abierto: solo un nombre de sprite.
//   2. Las cuentas de la imagen, sin pintar: qué trozos lleva el anillo,
//      cómo se llaman, y que los porcentajes no se pisen.
//   3. El botón: solo para quien lleva el torneo, y solo terminado.
//   4. La imagen que baja: su tamaño, lo que dice (se apunta cada
//      `fillText`) y que los sprites salen DE /sprite.
//   5. Cuando /sprite no da el sprite, el respaldo; y sin ninguno, la
//      imagen sale igual, con la cifra en el trozo.
//   6. En el móvil.
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
const BASE = process.env.PD_BASE || process.env.BASE || 'http://localhost:8892'
const hace = (min) => new Date(Date.now() - min * 60000).toISOString()
const DIR = mkdtempSync(join(tmpdir(), 'tanda-425-'))
const py = (codigo) => spawnSync('python3', ['-c', codigo], { encoding: 'utf8' })

// Un PNG liso de un color, opaco: el sprite de mentira. Un color que no
// sale en ningún otro sitio de la imagen (magenta, verde puro) dice de
// dónde vino lo que se ha pintado.
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
const MAGENTA = pngLiso(40, 40, [255, 0, 255])
const VERDE = pngLiso(40, 40, [0, 255, 0])

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. /sprite: el sprite desde nuestro dominio, y solo un sprite ──')
{
  const { traerSprite, NOMBRE_VALIDO, default: manejador } = await import(`${RAIZ}/netlify/functions/sprite.mjs`)
  const { CDN_SPRITES, POKEMON_POR_DEX, spriteDeCarta } = await import(`${RAIZ}/js/torneos/sprites-pokemon.js`)
  const pedidas = []
  const falso = (estado, tipo) => async (url) => {
    pedidas.push(url)
    return new Response(estado === 200 ? MAGENTA : 'x', { status: estado, headers: { 'content-type': tipo } })
  }
  const bien = await traerSprite('zoroark', { fetchImpl: falso(200, 'image/png') })
  check('un nombre válido se pide a la CDN de siempre', pedidas[0] === `${CDN_SPRITES}/zoroark.png`, pedidas[0])
  check('  …y vuelve la imagen con su tipo', bien?.tipo === 'image/png' && bien.datos.byteLength === MAGENTA.length)
  check('  …también una forma con guiones', Boolean(await traerSprite('ogerpon-wellspring', { fetchImpl: falso(200, 'image/png') })))

  pedidas.length = 0
  const raros = ['../secreto', 'a/b', 'ZOROARK', '', 'x'.repeat(41), 'https://otro.example/x', 'zoroark.png', '-zoroark', 'zoroark--x', 'zoroark?n=1', null]
  const res = await Promise.all(raros.map((n) => traerSprite(n, { fetchImpl: falso(200, 'image/png') })))
  check('NO es un proxy abierto: con cualquier otra cosa no se pide nada', res.every((x) => x === null) && pedidas.length === 0, pedidas.join(' | '))
  check('  …ni una página de error que venga con un 200', (await traerSprite('zoroark', { fetchImpl: falso(200, 'text/html') })) === null)
  check('  …ni un 404', (await traerSprite('zoroark', { fetchImpl: falso(404, 'image/png') })) === null)
  check('  …y si la CDN no contesta, nada (sin reventar)', (await traerSprite('zoroark', { fetchImpl: async () => { throw new Error('caída') } })) === null)

  // Contra la FORMA del fallo: cualquier sprite que la web sepa pintar
  // tiene que pasar el filtro, o su mazo se quedaría sin dibujo en la
  // imagen sin dar error. Todas las especies y sus megas.
  const malas = []
  for (const n of POKEMON_POR_DEX) {
    for (const u of [spriteDeCarta(n), spriteDeCarta(`Mega ${n} ex`)]) {
      if (!u?.startsWith(`${CDN_SPRITES}/`)) continue
      const s = u.slice(CDN_SPRITES.length + 1).replace(/\.png$/, '')
      if (s.length > 40 || !NOMBRE_VALIDO.test(s)) malas.push(s)
    }
  }
  check('todos los sprites de la web caben en el filtro', malas.length === 0, malas.slice(0, 8).join(' '))

  // El manejador entero, con el fetch de verdad cambiado por uno falso.
  const original = globalThis.fetch
  globalThis.fetch = falso(200, 'image/png')
  const ok = await manejador(new Request('https://pokedoc.es/.netlify/functions/sprite?n=dragapult'))
  const mal = await manejador(new Request('https://pokedoc.es/.netlify/functions/sprite?n=..%2Fx'))
  globalThis.fetch = original
  check('el manejador sirve la imagen, cacheada un año', ok.status === 200 && ok.headers.get('content-type') === 'image/png' && /max-age=31536000/.test(ok.headers.get('cache-control')), `${ok.status} ${ok.headers.get('cache-control')}`)
  check('  …y lo que no es un sprite, 404', mal.status === 404, String(mal.status))

  // La regla de netlify.toml que lleva /sprite/<nombre> a la función, y
  // ANTES del comodín del final: después no la alcanzaría nadie.
  const toml = readFileSync(`${RAIZ}/netlify.toml`, 'utf8')
  const bloques = toml.split('[[redirects]]').slice(1)
  const i = bloques.findIndex((b) => /from\s*=\s*"\/sprite\/:n"/.test(b))
  const comodin = bloques.findIndex((b) => /from\s*=\s*"\/\*"/.test(b))
  check('netlify.toml lleva /sprite/:n a la función', i >= 0 && /to\s*=\s*"\/\.netlify\/functions\/sprite\?n=:n"/.test(bloques[i]) && /status\s*=\s*200\b/.test(bloques[i]), bloques[i])
  check('  …antes del comodín', i >= 0 && (comodin < 0 || i < comodin), `${i} ${comodin}`)
}

// ═════════════════════════════════════════════════════════════════════
// El torneo: ocho jugadores, una ronda y siete listas —Blaine (p8) no
// entregó la suya, y gana su mesa—: tres mazos (4 Zoroark de N con sus
// variantes, 2 Dragapult y 1 Lucario).
const L = (quantity, name, set, number) => ({ quantity, name, set, number })
const MAZOS = {
  zDarm: { pokemon: [L(3, "N's Zoroark ex", 'JTG', '98'), L(3, "N's Zorua", 'JTG', '97'), L(2, "N's Darmanitan", 'JTG', '27'), L(2, "N's Darumaka", 'JTG', '26')], trainer: [], energy: [] },
  zEs: { pokemon: [L(3, 'Zoroark ex de N', 'JTG', '98'), L(3, 'Zorua de N', 'JTG', '97'), L(2, 'Darmanitan de N', 'JTG', '27'), L(2, 'Darumaka de N', 'JTG', '26')], trainer: [], energy: [] },
  zPech: { pokemon: [L(3, "N's Zoroark ex", 'JTG', '98'), L(3, "N's Zorua", 'JTG', '97'), L(2, 'Pecharunt ex', 'SFA', '39')], trainer: [], energy: [] },
  zSolo: { pokemon: [L(3, "N's Zoroark ex", 'JTG', '98'), L(3, "N's Zorua", 'JTG', '97'), L(1, 'Munkidori', 'TWM', '95')], trainer: [], energy: [] },
  dDusk: { pokemon: [L(3, 'Dragapult ex', 'TWM', '130'), L(3, 'Drakloak', 'TWM', '129'), L(4, 'Dreepy', 'TWM', '128'), L(2, 'Dusknoir', 'SFA', '20'), L(2, 'Dusclops', 'SFA', '19'), L(2, 'Duskull', 'SFA', '18')], trainer: [], energy: [] },
  dSolo: { pokemon: [L(3, 'Dragapult ex', 'TWM', '130'), L(3, 'Drakloak', 'TWM', '129'), L(4, 'Dreepy', 'TWM', '128')], trainer: [], energy: [] },
  luc: { pokemon: [L(3, 'Lucario', 'SVI', '114'), L(4, 'Riolu', 'SVI', '113'), L(2, 'Hariyama', 'MEG', '72')], trainer: [], energy: [] },
}
const GENTE = [['p4', 'Gary'], ['p5', 'Brock2'], ['p6', 'Erika'], ['p7', 'Sabrina'], ['p8', 'Blaine']]
const JUGADORES = ['user-1', 'user-2', 'user-3', ...GENTE.map(([id]) => id)]
const DE = { 'user-1': 'luc', 'user-2': 'zDarm', 'user-3': 'zEs', p4: 'zPech', p5: 'zSolo', p6: 'dDusk', p7: 'dSolo' }
const textoDe = (p) => ['pokemon', 'trainer', 'energy'].map((s) => p[s].map((l) => `${l.quantity} ${l.name} ${l.set} ${l.number}`).join('\n')).join('\n\n')
const TORNEO = { id: 'torneo-1', slug: 'copa', name: 'Copa del Gimnasio', status: 'finished', admin_id: 'admin-1', swiss_rounds: 1, top_cut_size: 0, current_round_id: null, decklist_visibility: 'al_terminar', start_at: '2026-09-30T16:00:00Z', format: 'standard' }

function semillas(torneo = {}) {
  return {
    __FAKE_PERFILES__: GENTE.map(([id, username]) => ({ id, username, display_name: username })),
    __FAKE_TORNEOS__: [{ ...TORNEO, ...torneo }],
    __FAKE_INSCRIPCIONES__: JUGADORES.map((u, i) => ({ id: `insc-${i + 1}`, tournament_id: 'torneo-1', user_id: u })),
    __FAKE_RONDAS__: [{ id: 'ronda-1', round_number: 1, status: 'finished', phase: 'swiss', started_at: hace(60) }],
    __FAKE_MESAS__: [['m1', 'user-1', 'user-2'], ['m2', 'user-3', 'p4'], ['m3', 'p5', 'p6'], ['m4', 'p7', 'p8']].map(([id, a, b], i) => ({ id, round_id: 'ronda-1', table_number: i + 1, player_a_id: a, player_b_id: b, status: 'finished', check_in_a_at: hace(59), check_in_b_at: hace(59) })),
    __FAKE_RESULTADOS__: [['m1', 'b_wins', 'user-2'], ['m2', 'a_wins', 'user-3'], ['m3', 'a_wins', 'p5'], ['m4', 'b_wins', 'p8']].map(([match_id, result, winner_id], i) => ({ id: `r-${i}`, match_id, result, winner_id })),
    __FAKE_DECKLISTS__: JUGADORES.filter((u) => DE[u]).map((u, i) => {
      const p = { ...MAZOS[DE[u]] }
      p.total = ['pokemon', 'trainer', 'energy'].reduce((n, s) => n + p[s].reduce((m, l) => m + l.quantity, 0), 0)
      return { id: `deck-${i + 1}`, tournament_id: 'torneo-1', user_id: u, raw_text: textoDe(p), parsed_cards: p, locked_at: hace(90) }
    }),
  }
}

const browser = await chromium.launch()
// `sprite`: qué contesta /sprite ('magenta', 'no' o un retraso en ms).
async function abrir({ sesion = 'admin-1', torneo = {}, sprite = 'magenta', respaldo = 'no', movil = false } = {}) {
  const page = await browser.newPage(
    movil
      ? { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, acceptDownloads: true }
      : { viewport: { width: 1280, height: 900 }, acceptDownloads: true }
  )
  const errores = []
  const pedidas = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  page.on('request', (r) => pedidas.push(r.url()))
  // Limitless SIN permiso de CORS, como en producción: si la imagen
  // pintara el sprite directo de ahí, no saldría.
  await page.route(/^https:\/\/r2\.limitlesstcg\.net\//, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: MAGENTA, headers: { 'access-control-allow-origin': 'https://otro.example' } }))
  await page.route(/^https:\/\/(cdn\.jsdelivr\.net|raw\.githubusercontent\.com)\//, (r) =>
    respaldo === 'verde' ? r.fulfill({ status: 200, contentType: 'image/png', body: VERDE, headers: { 'access-control-allow-origin': '*' } }) : r.fulfill({ status: 404, body: '' })
  )
  await page.route(/\/sprite\/[^/?]+$/, async (r) => {
    if (sprite === 'no') return r.fulfill({ status: 404, body: 'Sin sprite' })
    if (typeof sprite === 'number') await new Promise((ok) => setTimeout(ok, sprite))
    return r.fulfill({ status: 200, contentType: 'image/png', body: MAGENTA })
  })
  await page.addInitScript(([s, se]) => {
    window.__FAKE_SESSION__ = s
    for (const [k, v] of Object.entries(se)) window[k] = v
    // Lo que se ESCRIBE en cualquier canvas, con su letra: así se puede
    // leer la imagen sin leer píxeles.
    window.__textos = []
    const original = CanvasRenderingContext2D.prototype.fillText
    CanvasRenderingContext2D.prototype.fillText = function (t, ...resto) {
      window.__textos.push({ t: String(t), letra: this.font })
      return original.call(this, t, ...resto)
    }
    // Y cada imagen que se pinta: de dónde salió y dónde, a qué tamaño.
    window.__dibujos = []
    const dibujar = CanvasRenderingContext2D.prototype.drawImage
    CanvasRenderingContext2D.prototype.drawImage = function (img, ...a) {
      if (a.length === 4) window.__dibujos.push({ src: img.src || '', x: a[0], y: a[1], w: a[2], h: a[3] })
      // Desde la tanda 511 un sprite se pinta recortado a lo que ocupa
      // (drawImage de nueve): el destino son los cuatro últimos.
      if (a.length === 8) window.__dibujos.push({ src: img.src || '', x: a[4], y: a[5], w: a[6], h: a[7] })
      return dibujar.call(this, img, ...a)
    }
  }, [sesion, semillas(torneo)])
  await page.goto(`${BASE}/torneo?slug=copa`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  await page.click('[data-pestana="meta"]')
  await page.waitForTimeout(500)
  return { page, errores, pedidas }
}

async function bajar(page) {
  const [descarga] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), page.click('[data-meta-imagen]')])
  const ruta = join(DIR, descarga.suggestedFilename())
  await descarga.saveAs(ruta)
  return { nombre: descarga.suggestedFilename(), ruta, textos: await page.evaluate(() => window.__textos) }
}

// Un píxel de la imagen bajada, en coordenadas de la imagen a 1x.
const pixeles = (ruta, puntos) => {
  const r = py(`from PIL import Image\nim = Image.open(${JSON.stringify(ruta)}).convert('RGB')\nprint(';'.join(','.join(map(str, im.getpixel((int(x*2), int(y*2))))) for x, y in ${JSON.stringify(puntos)}))`)
  return (r.stdout.trim() || r.stderr).split(';').map((p) => p.split(',').map(Number))
}
const cerca = ([r, g, b], [r2, g2, b2], tol = 14) => Math.abs(r - r2) <= tol && Math.abs(g - g2) <= tol && Math.abs(b - b2) <= tol
// Cuántos píxeles de un color hay en un rectángulo (a 1x).
const cuantos = (ruta, [x0, y0, x1, y1], [r, g, b]) =>
  Number(py(`from PIL import Image\nim = Image.open(${JSON.stringify(ruta)}).convert('RGB').crop((${x0 * 2}, ${y0 * 2}, ${x1 * 2}, ${y1 * 2}))\nprint(sum(1 for p in im.getdata() if abs(p[0]-${r})<10 and abs(p[1]-${g})<10 and abs(p[2]-${b})<10))`).stdout.trim())

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. Las cuentas de la imagen, sin pintar ──')
{
  const { page, errores } = await abrir({ sesion: 'none' })
  const r = await page.evaluate(async () => {
    const m = await import('/js/torneos/meta-imagen.js')
    const { CDN_SPRITES } = await import('/js/torneos/sprites-pokemon.js')
    const g = (nombre, cuantos) => ({ clave: nombre, cuantos, arq: { nombre, iconos: [{ nombre }] } })
    // Como la Copa RyuCards: seis mazos de más de uno y once de uno.
    const grande = { total: 32, arquetipos: [g("N's Zoroark ex", 6), g('Mega Lucario ex Hariyama', 4), g('Dragapult ex', 4), g('Mega Kangaskhan ex', 3), g('Arboliva ex', 2), g('Hydrapple ex', 2), ...Array.from({ length: 11 }, (_, i) => g(`Solo ${i}`, 1))] }
    // Ocho mazos de dos y uno suelto: el suelto no es «otros».
    const nueve = { total: 17, arquetipos: [...Array.from({ length: 8 }, (_, i) => g(`Par ${i}`, 2)), g('Suelto ex', 1)] }
    const pocos = { total: 4, arquetipos: [g('A', 2), g('B', 1), g('C', 1)] }
    const sep = (ys) => ys.slice().sort((a, b) => a - b).every((y, i, a) => !i || y - a[i - 1] >= 29.99)
    const racimo = m.colocarEtiquetas([400, 401, 402])
    // Cada cifra, en cualquier ángulo y subida o bajada lo que sea: ni
    // encima del anillo ni fuera de la imagen o encima de la leyenda.
    const A = m.ANILLO
    const pisan = []
    for (let g = -90; g < 270; g += 5) {
      const medio = (g * Math.PI) / 180
      const gy = A.CY + (A.R + 20) * Math.sin(medio)
      for (const d of [-90, -60, -30, 0, 30, 60, 90]) {
        const y = Math.min(A.ABAJO, Math.max(A.ARRIBA, gy + d))
        const w = 80
        const c = m.sitioDeCifra(medio, y, w)
        const [x0, x1] = c.derecha ? [c.x, c.x + w] : [c.x - w, c.x]
        // El punto de la caja de la cifra más cercano al centro del anillo.
        const px = Math.max(x0, Math.min(A.CX, x1))
        const pyy = Math.max(y - 12, Math.min(A.CY, y + 12))
        const dist = Math.hypot(px - A.CX, pyy - A.CY)
        if (dist < A.R + 2 || x0 < A.BORDE_IZQ - 0.5 || x1 > A.BORDE_DER + 0.5) pisan.push(`${g}°/${d}: ${Math.round(x0)}-${Math.round(x1)} a ${Math.round(dist)}`)
      }
    }
    return {
      grande: m.trozosDelMeta(grande),
      nueve: m.trozosDelMeta(nueve),
      pocos: m.trozosDelMeta(pocos),
      colores: m.COLORES,
      cortos: ["N's Zoroark ex", 'Mega Lucario ex Hariyama', 'Exeggutor', 'Alolan Exeggutor ex'].map(m.nombreCorto),
      pct: [m.porcentaje(6, 32), m.porcentaje(1, 3)],
      fuentes: [m.fuenteDeSprite(`${CDN_SPRITES}/zoroark.png`), m.fuenteDeSprite('https://cdn.jsdelivr.net/gh/x/1.png'), m.fuenteDeSprite('/assets/sprites/crushing-hammer.png')],
      racimo,
      racimoSep: sep(racimo),
      solo: m.colocarEtiquetas([500]),
      bordes: m.colocarEtiquetas([0, 5000], { min: 300, max: 900 }),
      muchos: m.colocarEtiquetas([880, 885, 890, 895, 899], { min: 300, max: 900 }),
      pisan,
    }
  })
  const n = (t) => t.trozos.map((x) => `${x.nombre}:${x.n}`).join(' | ')
  check('17 mazos: los seis de más de uno con su color, y «Otros» con los once', r.grande.trozos.length === 7 && r.grande.trozos[6].nombre === 'Otros' && r.grande.trozos[6].n === 11 && r.grande.trozos[6].otros.length === 11, n(r.grande))
  check('  …cada uno con el color de su sitio, y «Otros» en gris', r.grande.trozos.slice(0, 6).every((t, i) => t.color === r.colores[i]) && !r.colores.includes(r.grande.trozos[6].color), r.grande.trozos.map((t) => t.color).join())
  check('  …y suman las 32 listas', r.grande.total === 32 && r.grande.trozos.reduce((s, t) => s + t.n, 0) === 32)
  check('ocho de dos y uno suelto: el suelto va con SU nombre, no como «Otros»', r.nueve.trozos.length === 9 && r.nueve.trozos[8].nombre === 'Suelto' && !r.nueve.trozos[8].otros && Boolean(r.nueve.trozos[8].arq), n(r.nueve))
  check('si caben todos, van todos (aunque sean de uno)', r.pocos.trozos.length === 3 && !r.pocos.trozos.some((t) => t.otros), n(r.pocos))
  check('los nombres, sin el «ex» (pero sin tocar a Exeggutor)', r.cortos.join(' | ') === "N's Zoroark | Mega Lucario Hariyama | Exeggutor | Alolan Exeggutor", r.cortos.join(' | '))
  check('los porcentajes, con coma', r.pct.join(' ') === '18,8 % 33,3 %', r.pct.join(' '))
  check('un sprite de Limitless se pide a /sprite; los demás, tal cual', r.fuentes.join(' ') === '/sprite/zoroark https://cdn.jsdelivr.net/gh/x/1.png /assets/sprites/crushing-hammer.png', r.fuentes.join(' '))
  check('tres porcentajes a la misma altura se separan', r.racimoSep, r.racimo.join())
  check('  …alrededor de donde estaban, no todos hacia abajo', Math.abs(r.racimo.reduce((s, y) => s + y, 0) / 3 - 401) < 1 && r.racimo[0] === Math.min(...r.racimo), r.racimo.join())
  check('uno solo se queda donde está', r.solo[0] === 500)
  check('nada se sale por arriba ni por abajo', r.bordes[0] === 300 && r.bordes[1] === 900, r.bordes.join())
  check('  …ni siquiera un racimo pegado al fondo', r.muchos.every((y) => y <= 900 && y >= 300) && r.muchos.slice(1).every((y, i) => y - r.muchos[i] >= 29.99), r.muchos.join())
  check('ninguna cifra cae encima del anillo, fuera de la imagen o sobre la leyenda', r.pisan.length === 0, r.pisan.slice(0, 6).join(' | '))
  check('sin errores de página', errores.length === 0, errores.join(' | '))
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. El botón: quien lleva el torneo, y terminado ──')
{
  const casos = [
    ['el admin del sitio, torneo terminado', { sesion: 'admin-1' }, true],
    ['quien lo creó (sin ser admin del sitio)', { sesion: 'user-3', torneo: { admin_id: 'user-3' } }, true],
    ['un jugador', { sesion: 'user-2' }, false],
    ['alguien sin cuenta', { sesion: 'none' }, false],
    ['el admin, con el torneo aún en juego (las listas abiertas)', { sesion: 'admin-1', torneo: { status: 'in_progress', decklist_visibility: 'en_juego', current_round_id: 'ronda-1' } }, false],
  ]
  for (const [quien, op, sale] of casos) {
    const { page, errores } = await abrir(op)
    const filas = await page.locator('.torneo-meta-fila').count()
    const boton = await page.locator('[data-meta-imagen]').count()
    check(`${quien}: ${sale ? 'SÍ' : 'no'} tiene el botón`, filas > 0 && boton === (sale ? 1 : 0), `filas ${filas}, botón ${boton}`)
    if (errores.length) check(`  …sin errores (${quien})`, false, errores.join(' | '))
    await page.close()
  }
  // Dentro de un mazo no: la imagen es del meta entero.
  const { page } = await abrir()
  await page.locator('.torneo-meta-fila').first().click()
  await page.waitForTimeout(300)
  check('dentro de un mazo no sale (la imagen es del meta entero)', (await page.locator('[data-meta-imagen]').count()) === 0)
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 4. La imagen que baja ──')
{
  const { page, errores, pedidas } = await abrir({ sprite: 1200 })
  // CAPTURA=<carpeta> deja una foto de la pestaña para mirarla a ojo.
  if (process.env.CAPTURA) await page.locator('#torneoMetaCaja').screenshot({ path: join(process.env.CAPTURA, 'meta-425-escritorio.png') })
  const tabla = await page.evaluate(() => [...document.querySelectorAll('#clasificacionContenido [data-historial]')].slice(0, 4).map((b) => b.textContent.trim()))
  const boton = page.locator('[data-meta-imagen]')
  const espera = page.waitForEvent('download', { timeout: 15000 })
  await boton.click()
  await page.waitForTimeout(150)
  check('mientras se monta, el botón se apaga (no baja dos)', await boton.isDisabled())
  const descarga = await espera
  const ruta = join(DIR, descarga.suggestedFilename())
  await descarga.saveAs(ruta)
  await page.waitForTimeout(200)
  check('  …y al acabar se enciende', !(await boton.isDisabled()))
  check('se llama como el torneo', descarga.suggestedFilename() === 'meta-copa-del-gimnasio.png', descarga.suggestedFilename())
  const png = readFileSync(ruta)
  check('es un PNG de 2160×2700 (4:5, a doble resolución)', png.subarray(1, 4).toString() === 'PNG' && png.readUInt32BE(16) === 2160 && png.readUInt32BE(20) === 2700, `${png.readUInt32BE(16)}×${png.readUInt32BE(20)}`)

  const textos = await page.evaluate(() => window.__textos)
  const t = textos.map((x) => x.t)
  const tiene = (s) => t.includes(s)
  check('la cabecera: el torneo, «El meta del torneo» y fecha · rondas', tiene('Copa del Gimnasio') && tiene('El meta del torneo') && tiene('30 de septiembre de 2026 · 1 ronda'), t.slice(0, 6).join(' | '))
  // (El navegador devuelve «bold» por «700»: se mira el tamaño, que es único.)
  const letra = (re) => textos.filter((x) => re.test(x.letra)).map((x) => x.t)
  check('en el centro, las 7 listas', letra(/ 92px /).join() === '7' && tiene('listas'), letra(/ 92px /).join())
  check('los porcentajes, sobre las 7 listas: 57,1 % · 28,6 % · 14,3 %', t.filter((x) => /%$/.test(x)).join(' ') === '57,1 % 28,6 % 14,3 %', t.filter((x) => /%$/.test(x)).join(' '))
  check('la leyenda, con los nombres cortos', tiene('MAZOS') && tiene("N's Zoroark") && tiene('Dragapult') && t.some((x) => /^Lucario/.test(x)), t.join(' | '))
  check('  …y sin «Otros» (caben los tres)', !tiene('Otros'))
  const i = t.indexOf('TOP 4')
  // Cada fila del top escribe: su número, quién y su mazo.
  const quien = tabla.map((n) => t.indexOf(n, i))
  check('el top 4 es la clasificación de la ficha, en su orden', i >= 0 && quien.every((x) => x > i) && quien.every((x, k) => !k || x > quien[k - 1]), `${tabla.join(', ')} → ${quien.join(',')}`)
  check('cuántos jugaron: 8 jugadores, de los que 7 entregaron lista', letra(/ 96px /).join() === '8' && tiene('Jugadores') && tiene('7 listas entregadas'), letra(/ 96px /).join())
  check('quien está en el top sin lista sale como tal', tiene('Sin lista'))
  check('el pie: PokeDoc.es y cómo se cuenta', tiene('Poke') && tiene('Doc') && tiene('.es') && tiene('porcentajes sobre las 7 listas'))
  check('con sprite en cada trozo, no se escribe ninguna cifra dentro', !textos.some((x) => /^800 30px/.test(x.letra)), textos.filter((x) => /^800 30px/.test(x.letra)).map((x) => x.t).join())

  check('los sprites se piden a /sprite', pedidas.some((u) => /\/sprite\/zoroark/.test(u)) && pedidas.some((u) => /\/sprite\/dragapult/.test(u)), pedidas.filter((u) => /sprite/.test(u)).join(' ').slice(0, 200))
  // Los píxeles: el fondo, la cabecera, el primer trozo (Zoroark, azul
  // de la paleta, empieza arriba) y su sprite en el centro del trozo (4/7
  // de vuelta: el centro, a 13° de la horizontal); y los de los otros dos.
  const [fondo, cabecera, trozo, sprite, segundo] = pixeles(ruta, [[40, 330], [600, 20], [375, 438], [534, 655], [187, 655]])
  // En el anillo los sprites miden más de 40 (los del top, 40 justos).
  const enAnillo = (await page.evaluate(() => window.__dibujos)).filter((d) => d.w > 45).map((d) => d.src.replace(/^.*\/sprite\//, ''))
  check('fondo azul noche', fondo[2] < 70 && fondo[0] < 40 && fondo[2] > fondo[0], fondo.join())
  check('cabecera azul de la casa', cabecera[2] > 100 && cabecera[2] > cabecera[0] + 40, cabecera.join())
  check('el trozo del Zoroark, del primer color', cerca(trozo, [0x39, 0x87, 0xe5]), trozo.join())
  check('  …con su sprite (el de /sprite) dentro', cerca(sprite, [255, 0, 255], 6), sprite.join())
  check('  …el de Dragapult en el suyo', cerca(segundo, [255, 0, 255], 6), segundo.join())
  // El Lucario lleva DOS (Lucario y Hariyama), uno a cada lado del centro
  // de su trozo, a lo largo del arco.
  check('  …y el Lucario, sus dos: Lucario y Hariyama', enAnillo.includes('lucario') && enAnillo.includes('hariyama') && enAnillo.length === 4, enAnillo.join(' '))
  check('sin errores de página', errores.length === 0, errores.join(' | '))
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 5. Cuando /sprite no lo tiene ──')
{
  const { page, errores } = await abrir({ sprite: 'no', respaldo: 'verde' })
  const { ruta } = await bajar(page)
  const [sprite] = pixeles(ruta, [[534, 655]])
  check('sale el del respaldo (PokeAPI por jsDelivr)', cerca(sprite, [0, 255, 0], 6), sprite.join())
  check('sin errores', errores.length === 0, errores.join(' | '))
  await page.close()
}
{
  const { page, errores } = await abrir({ sprite: 'no', respaldo: 'no' })
  const { ruta, textos } = await bajar(page)
  const cifras = textos.filter((x) => /^800 30px/.test(x.letra)).map((x) => x.t)
  check('sin ningún sprite la imagen sale igual, con la cifra en cada trozo', readFileSync(ruta).length > 10000 && cifras.join() === '4,2,1', cifras.join())
  check('  …y ni un magenta de Limitless: no se pinta lo que no da permiso', cuantos(ruta, [130, 385, 590, 845], [255, 0, 255]) === 0)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 6. En el móvil ──')
{
  const { page, errores } = await abrir({ movil: true })
  if (process.env.CAPTURA) await page.locator('#torneoMetaCaja').screenshot({ path: join(process.env.CAPTURA, 'meta-425-movil.png') })
  const m = await page.evaluate(() => {
    const b = document.querySelector('[data-meta-imagen]').getBoundingClientRect()
    return { alto: b.height, der: b.right, ancho: document.documentElement.scrollWidth }
  })
  check('el botón mide 44 px de alto con el dedo', m.alto >= 44, String(m.alto))
  check('  …y no se sale de la pantalla', m.der <= 390 && m.ancho <= 390, JSON.stringify(m))
  const { nombre } = await bajar(page)
  check('  …y baja la imagen también desde ahí', nombre === 'meta-copa-del-gimnasio.png', nombre)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await page.close()
}

await browser.close()
console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
