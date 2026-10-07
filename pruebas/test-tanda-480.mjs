// Tanda 480 — compartir, guardar y descargar en vídeo una repetición.
//
// PINGU: «me gustaría poder compartir el link de una repetición para que
// quien la abra lo pueda ver», y después «un apartado para ver tus
// repeticiones guardadas (así que necesitamos un botón para guardar) y que
// te dé la opción de descargar la repetición en mp4 o guardarla en la web
// como lo de los mazos».
//
// Lo que se prueba:
//   1. El enlace que LLEVA la partida (sin cuenta): ida y vuelta exacta,
//      con acentos y con un registro largo, y un enlace roto no se abre a
//      medias.
//   2. El MP4 hecho a mano (mp4.js): con H.264 y con VP9 de verdad
//      (codificados por ffmpeg), se decodifica entero y mide lo que debe.
//   3. La base, contra PostgreSQL (sql-repeticiones.sql): quién guarda,
//      quién abre, que nadie liste las de otros, los topes.
//   4. La vista previa del enlace corto (el borde): quién contra quién, y
//      en `noindex`.
//   5. La página: compartir sin cuenta y con ella, abrir los dos enlaces,
//      guardar (y volver a guardar sin duplicar), cambiar el título, la
//      lista de «Tus repeticiones» con dejar de compartir y borrar, entrar
//      a mitad de guardar, y sin la migración puesta.
//   6. El vídeo: se hace, se descarga, ffprobe lo da por bueno, dura lo
//      que dice la ventana, las cartas salen de sitios que no manchan el
//      lienzo, y se puede cancelar.
//   7. Lo que la página promete: no manda nada hasta que tú lo pides.
import { readFileSync, writeFileSync, existsSync, mkdtempSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const RAIZ = '/home/user/pingu'
const AQUI = dirname(fileURLToPath(import.meta.url))
const leer = (f) => readFileSync(`${RAIZ}/${f}`, 'utf8')
const BASE = process.env.PD_BASE || process.env.BASE || 'http://localhost:8892'
const TMP = mkdtempSync(join(tmpdir(), 'repeticiones-'))
const { empaquetar, desempaquetar, esEnlaceDeRepeticion } = await import(`${RAIZ}/js/repeticiones/enlace.js`)
const { empaquetarMp4 } = await import(`${RAIZ}/js/repeticiones/mp4.js`)
const { EJEMPLO } = await import(`${RAIZ}/js/repeticiones/ejemplo.js`)
const { leerRegistro } = await import(`${RAIZ}/js/repeticiones/registro.js`)
const ffprobe = (f) => {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name,width,height,nb_frames', '-show_entries', 'format=duration', '-of', 'json', f], { encoding: 'utf8' })
  try {
    const j = JSON.parse(r.stdout)
    return { ...j.streams?.[0], duracion: Number(j.format?.duration) }
  } catch {
    return null
  }
}
const decodifica = (f) => {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', f, '-f', 'null', '-'], { encoding: 'utf8' })
  return r.status === 0 && !r.stderr.trim()
}
const hayFfmpeg = spawnSync('ffprobe', ['-version']).status === 0

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. El enlace que lleva la partida dentro ──')
{
  const h = await empaquetar(EJEMPLO)
  check('el ejemplo va y vuelve EXACTO (acentos incluidos)', (await desempaquetar(`#${h}`)) === EJEMPLO)
  check('  …y comprimido: un registro de 8 KB cabe en un mensaje de Discord (2.000)', `https://pokedoc.es/repeticiones#${h}`.length < 2000, h.length)
  check('el enlace solo lleva letras, números, - y _ (nada que un chat parta)', /^p=[A-Za-z0-9_-]+$/.test(h))
  const largo = Array.from({ length: 2000 }, (_, i) => `Rojo ha jugado Pokétableta ${i}.`).join('\n')
  check('uno de 60 KB también va y vuelve', (await desempaquetar(await empaquetar(largo))) === largo)
  check('un enlace cortado a medias NO se abre a medias (null)', (await desempaquetar(`#${h.slice(0, h.length / 2)}`)) === null)
  check('  …ni uno que no es de repetición', (await desempaquetar('#arriba')) === null && !esEnlaceDeRepeticion('#arriba') && esEnlaceDeRepeticion(`#${h}`))
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. El MP4 hecho a mano ──')
if (!hayFfmpeg) console.log('   (no hay ffmpeg aquí — el MP4 NO se ha comprobado)')
else {
  // H.264 de verdad, de ffmpeg, en Annex B: se parte en NAL, se monta el
  // avcC con su SPS y su PPS, y cada fotograma es una muestra.
  const h264 = join(TMP, 'p.h264')
  spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=size=640x360:rate=24', '-frames:v', '48', '-c:v', 'libx264', '-bf', '0', '-g', '24', '-pix_fmt', 'yuv420p', '-f', 'h264', h264])
  const b = readFileSync(h264)
  const nals = []
  let i = 0
  let ini = -1
  while (i < b.length - 3) {
    const tres = b[i] === 0 && b[i + 1] === 0 && b[i + 2] === 1
    const cuatro = b[i] === 0 && b[i + 1] === 0 && b[i + 2] === 0 && b[i + 3] === 1
    if (tres || cuatro) {
      if (ini >= 0) nals.push(b.subarray(ini, i))
      i += tres ? 3 : 4
      ini = i
      continue
    }
    i++
  }
  nals.push(b.subarray(ini))
  const tipo = (n) => n[0] & 31
  const sps = nals.find((n) => tipo(n) === 7)
  const pps = nals.find((n) => tipo(n) === 8)
  const avcC = new Uint8Array([1, sps[1], sps[2], sps[3], 0xff, 0xe1, sps.length >> 8, sps.length & 255, ...sps, 1, pps.length >> 8, pps.length & 255, ...pps])
  const muestras = []
  let actual = []
  for (const n of nals) {
    if ([7, 8, 9].includes(tipo(n))) continue
    actual.push(n)
    if (tipo(n) === 1 || tipo(n) === 5) {
      const datos = new Uint8Array(actual.reduce((s, x) => s + 4 + x.length, 0))
      let k = 0
      for (const x of actual) {
        new DataView(datos.buffer).setUint32(k, x.length)
        datos.set(x, k + 4)
        k += 4 + x.length
      }
      muestras.push({ datos, duracion: 3750, clave: tipo(n) === 5 })
      actual = []
    }
  }
  const mp4 = join(TMP, 'h264.mp4')
  writeFileSync(mp4, empaquetarMp4({ codec: 'avc1', ancho: 640, alto: 360, escala: 90000, descripcion: avcC }, muestras))
  const p = ffprobe(mp4)
  check('H.264: ffprobe lo lee — h264, 640×360, 48 fotogramas, 2 s', p?.codec_name === 'h264' && p.width === 640 && p.height === 360 && Number(p.nb_frames) === 48 && Math.abs(p.duracion - 2) < 0.01, JSON.stringify(p))
  check('  …y se decodifica entero sin un error', decodifica(mp4))

  // VP9 de verdad, en IVF: cabecera de 32 bytes y cada fotograma con la
  // suya de 12 (tamaño y tiempo).
  const ivf = join(TMP, 'p.ivf')
  spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=size=640x360:rate=24', '-frames:v', '36', '-c:v', 'libvpx-vp9', '-g', '12', '-deadline', 'realtime', '-cpu-used', '8', '-f', 'ivf', ivf])
  const v = readFileSync(ivf)
  const vm = []
  for (let k = 32; k + 12 <= v.length; ) {
    const tam = v.readUInt32LE(k)
    const datos = new Uint8Array(v.subarray(k + 12, k + 12 + tam))
    // Fotograma clave en VP9: el bit de «show_existing» y el de tipo.
    vm.push({ datos, duracion: 3750, clave: (datos[0] & 0x04) === 0 && vm.length % 12 === 0 })
    k += 12 + tam
  }
  vm[0].clave = true
  const mp4v = join(TMP, 'vp9.mp4')
  writeFileSync(mp4v, empaquetarMp4({ codec: 'vp09', codecCompleto: 'vp09.00.31.08', ancho: 640, alto: 360, escala: 90000 }, vm))
  const q = ffprobe(mp4v)
  check('VP9: ffprobe lo lee — vp9, 36 fotogramas, 1,5 s', q?.codec_name === 'vp9' && Number(q.nb_frames) === 36 && Math.abs(q.duracion - 1.5) < 0.01, JSON.stringify(q))
  check('  …y se decodifica entero', decodifica(mp4v))

  // Duraciones distintas: un fotograma largo dura lo que dice.
  const desiguales = muestras.slice(0, 24).map((m, k) => ({ ...m, duracion: k === 23 ? 90000 * 3 : 3750 }))
  const mp4d = join(TMP, 'desigual.mp4')
  writeFileSync(mp4d, empaquetarMp4({ codec: 'avc1', ancho: 640, alto: 360, escala: 90000, descripcion: avcC }, desiguales))
  const d = ffprobe(mp4d)
  check('un fotograma de 3 s dura 3 s (el vídeo, 23/24 + 3)', d && Math.abs(d.duracion - (23 / 24 + 3)) < 0.01, d?.duracion)
  // Si el codificador reordena (fotogramas B), cada muestra lleva su
  // desfase en una caja ctts; sin desfases, no hay caja.
  const conDesfase = empaquetarMp4({ codec: 'avc1', ancho: 640, alto: 360, escala: 90000, descripcion: avcC }, muestras.map((m, k) => ({ ...m, desfase: k % 2 ? 3750 : 0 })))
  const contiene = (u8, s) => Buffer.from(u8).includes(Buffer.from(s))
  check('con desfases, el índice lleva su ctts; sin ellos, no', contiene(conDesfase, 'ctts') && !contiene(readFileSync(mp4), 'ctts'))
  check('el índice va DELANTE de los datos (el vídeo empieza a verse antes de bajarse entero)', Buffer.from(readFileSync(mp4)).indexOf('moov') < Buffer.from(readFileSync(mp4)).indexOf('mdat'))
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. La base, contra PostgreSQL ──')
{
  const ruta = join(AQUI, 'sql-repeticiones.sql')
  check('existe sql-repeticiones.sql junto a esta prueba', existsSync(ruta))
  const SQL = leer('supabase-migration-repeticiones.sql')
  check('la migración NO tiene política de insert (se guarda por la función)', !/for insert/i.test(SQL) && /create or replace function public\.repeticiones_guardar/.test(SQL))
  check('  …ni deja leer las compartidas a todo el mundo (no se pueden listar)', !/for select using \([^)]*compartida/i.test(SQL) && /for select using \(auth\.uid\(\) = user_id\)/.test(SQL))
  // Desde la tanda 494 también las notas (las escribe su dueño); los mazos,
  // no: los pone la función al guardar.
  check('  …y el permiso de cambiar va por columnas (título, compartir y, desde la 494, las notas)', /grant update \(titulo, compartida(, notas)?\) on table public\.replays to authenticated/.test(SQL))
  const r = spawnSync('psql', ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-f', ruta], { encoding: 'utf8', timeout: 60000 })
  const salida = r.error ? null : `${r.stdout || ''}${r.stderr || ''}`
  if (salida === null || /could not connect|No such file|connection to server/.test(salida)) {
    console.log('   (no hay PostgreSQL en /var/tmp:5433 — la prueba de la base NO se ha corrido aquí)')
  } else {
    const oks = (salida.match(/ {2}ok {2}/g) || []).length
    const fallos = salida.split('\n').filter((l) => /FALLA|ERROR/.test(l))
    check(`PostgreSQL: ${oks} comprobaciones, ninguna falla`, oks >= 30 && !fallos.length, fallos.slice(0, 2).join(' | '))
  }
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 4. La vista previa del enlace corto ──')
{
  const meta = (await import(`${RAIZ}/netlify/edge-functions/meta-social.js`)).default
  const HTML = '<!DOCTYPE html><html><head><title>Repeticiones — PokeDoc</title>\n<meta name="description" content="generica" />\n<!-- meta-social:inicio -->\n<meta property="og:title" content="viejo" />\n<!-- meta-social:fin -->\n</head><body></body></html>'
  const pedidas = []
  const correr = async (url, resumen) => {
    globalThis.fetch = async (u) => {
      pedidas.push(String(u))
      return new Response(JSON.stringify(resumen ? [resumen] : []), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    const res = await meta(new Request(url), { next: async () => new Response(HTML, { status: 200, headers: { 'content-type': 'text/html' } }) })
    return res.text()
  }
  const html = await correr('https://pokedoc.es/repeticiones?r=1a2b3c4d5e', { titulo: 'La final', jugador_a: 'Rojo', jugador_b: 'Azul', turnos: 13 })
  check('la vista previa dice el título y quién contra quién', html.includes('<title>La final (Rojo contra Azul) — Repetición en PokeDoc</title>'), html.match(/<title>.*<\/title>/)?.[0])
  check('  …y los turnos en la descripción', /og:description" content="13 turnos de JCC Pokémon Live/.test(html))
  check('  …con la canónica en su enlace corto', html.includes('og:url" content="https://pokedoc.es/repeticiones?r=1a2b3c4d5e"'))
  check('  …y en noindex (una partida suelta no es para Google)', html.includes('<meta name="robots" content="noindex,follow" />'))
  check('pide el RESUMEN, no el registro', pedidas.at(-1).includes('/rest/v1/rpc/repeticiones_resumen?p_id=1a2b3c4d5e'))
  const n = pedidas.length
  const sinR = await correr('https://pokedoc.es/repeticiones', null)
  check('sin ?r= la página sale intacta y sin preguntar a la base', sinR === HTML && pedidas.length === n)
  const rara = await correr('https://pokedoc.es/repeticiones?r=%27%20or%201%3D1', null)
  check('  …y con un ?r= que no es un enlace, tampoco', rara === HTML && pedidas.length === n)
  const noEsta = await correr('https://pokedoc.es/repeticiones?r=ffffffffff', null)
  check('una que ya no se comparte deja la vista previa genérica', noEsta === HTML)
}

// ═════════════════════════════════════════════════════════════════════
const PS = { Dunsparce: 60, Dudunsparce: 140, Abra: 50, Kadabra: 80, Alakazam: 140, Elgyem: 60, 'Fezandipiti ex': 210, Budew: 30, Dreepy: 70, Drakloak: 90, 'Dragapult ex': 320, Duskull: 60, Dusclops: 90, Dusknoir: 160, 'Meowth ex': 170 }
const OTRAS = ['Erin', 'Ceniza Sagrada', 'Mina Nocturna', 'Pokétableta', 'Ultra Ball', 'Órdenes de Jefes', 'Determinación de Lylia', 'Pokochos Gemelos', 'Energía Enriquecedora', 'Caramelo Raro', 'Energía Psíquica Telepática', 'Martillo Demoledor', 'Camilla Nocturna', 'Globo Helio', 'Jaula de Combate', 'Ventilador de Mano', 'Maya', 'Liza']
const cartasRep = [...Object.entries(PS).map(([n, hp]) => ({ name: n, name_es: n, hp, category: 'Pokemon' })), ...OTRAS.map((n) => ({ name: n, name_es: n, category: /^Energ/.test(n) ? 'Energy' : 'Trainer' }))].map((c, i) => ({ id: `fk-${i + 1}`, set_id: 'fk', local_id: String(i + 1), market: 'WEST', image_path: null, regulation_mark: 'H', ...c }))
const setsRep = [{ id: 'fk', name: 'FK', market: 'WEST', tcg_online_code: 'FK', release_date: '2025-01-01', card_count_official: 99 }]
const cartaFalsa = '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342" viewBox="0 0 245 342"><rect width="245" height="342" rx="12" fill="#e9c94a"/><rect x="10" y="10" width="225" height="322" rx="8" fill="#9cc3e0"/></svg>'

const browser = await chromium.launch()
async function pagina({ quien = 'none', url = '/repeticiones.html?ejemplo', ancho = 1280, alto = 800, antes = {}, contexto = null, tacto = false } = {}) {
  const ctx = contexto || (await browser.newContext({ viewport: { width: ancho, height: alto }, permissions: ['clipboard-read', 'clipboard-write'], acceptDownloads: true, hasTouch: tacto }))
  const page = await ctx.newPage()
  const errores = []
  const imagenes = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.route(/\/escaneo\/|\.(png|webp|jpg|jpeg)(\?|$)/, (r) => {
    imagenes.push(r.request().url())
    return r.fulfill({ status: 200, contentType: 'image/svg+xml', headers: { 'access-control-allow-origin': '*' }, body: cartaFalsa })
  })
  await page.route(/api\.tcgdex\.net/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  await page.addInitScript(({ cartas, sets, quien, antes }) => {
    window.__FAKE_SESSION__ = quien
    window.__FAKE_SETS__ = sets
    window.__FAKE_CARTAS__ = cartas
    Object.assign(window, antes)
  }, { cartas: cartasRep, sets: setsRep, quien, antes })
  await page.goto(`${BASE}${url}`, { waitUntil: 'domcontentloaded' })
  return { page, ctx, errores, imagenes }
}
const sala = (page) => page.waitForSelector('#repSala:not(.hidden)', { timeout: 8000 }).then(() => true).catch(() => false)
const enlaceDelDialogo = async (page) => {
  await page.waitForFunction(() => document.getElementById('repEnlace')?.value, null, { timeout: 8000 })
  return page.inputValue('#repEnlace')
}
const cerrado = (page) => page.waitForFunction(() => !document.getElementById('repDialogo').open, null, { timeout: 8000 })
const rpcs = (page, nombre) => page.evaluate((n) => (window.__RPCS__ || []).filter((r) => r.nombre === n).length, nombre)
const lectura = leerRegistro(EJEMPLO)

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 5. La página: compartir, guardar, tus repeticiones ──')
let enlaceLargo = null
{
  // Sin cuenta.
  const { page, ctx, errores } = await pagina()
  check('el ejemplo se abre', await sala(page))
  await page.waitForTimeout(1200)
  const escritas = await page.evaluate(() => JSON.parse(sessionStorage.getItem('__escrituras__') || '[]').filter((e) => e.tabla === 'replays').length)
  check('mirar NO manda la partida a ninguna parte (ni guarda, ni escribe)', (await rpcs(page, 'repeticiones_guardar')) === 0 && escritas === 0)
  check('«Tus repeticiones» invita a entrar', /Entra en tu cuenta para guardar/.test(await page.textContent('#repGuardadasCuerpo')))
  await page.click('[data-accion="compartir"]')
  // Desde la 591, sin cuenta sale CORTO (la partida comprimida se guarda
  // en enlaces_cortos), y el largo de siempre queda a un botón.
  const cortoSinCuenta = await enlaceDelDialogo(page)
  check('sin cuenta, compartir da un enlace CORTO (/rep/ y ocho letras)', /\/rep\/[a-z2-9]{8}$/.test(cortoSinCuenta), cortoSinCuenta)
  check('  …y lo dice, y ofrece entrar', /se guarda en PokeDoc \(sin ningún dato tuyo\)/.test(await page.textContent('#repCompartirNota')) && (await page.locator('#repDialogo a[href^="/auth.html"]').count()) === 2)
  await page.click('[data-dlg="largo"]')
  enlaceLargo = await page.inputValue('#repEnlace')
  check('«Usar el enlace largo» da el que LLEVA la partida', /\/repeticiones#p=[A-Za-z0-9_-]+$/.test(enlaceLargo) && /lleva la partida DENTRO/.test(await page.textContent('#repCompartirNota')), enlaceLargo.slice(0, 60))
  check('  …sin guardar nada en las repeticiones', (await rpcs(page, 'repeticiones_guardar')) === 0)
  await page.click('[data-dlg="copiar"]')
  await page.waitForTimeout(200)
  check('«Copiar» lo deja en el portapapeles', (await page.evaluate(() => navigator.clipboard.readText())) === enlaceLargo)
  await page.keyboard.press('Escape')

  // Guardar sin cuenta: a entrar, y la partida se queda esperando.
  await page.click('[data-accion="guardar"]')
  check('guardar sin cuenta pide entrar', /hace falta una cuenta/.test(await page.textContent('#repDialogoCuerpo')))
  await page.evaluate(() => document.querySelector('#repDialogo [data-pendiente]').addEventListener('click', (e) => e.preventDefault()))
  await page.click('#repDialogo [data-pendiente]')
  check('  …y antes de irse deja la partida en la pestaña', (await page.evaluate(() => sessionStorage.getItem('pokedoc-repeticion-pendiente'))) === EJEMPLO)
  check('sin errores en la página', !errores.length, errores.join(' | '))
  await page.close()

  // Volver de entrar: misma pestaña (mismo contexto y su sessionStorage).
  const vuelta = await pagina({ quien: 'user-1', url: '/repeticiones.html', contexto: ctx })
  await vuelta.page.evaluate((t) => sessionStorage.setItem('pokedoc-repeticion-pendiente', t), EJEMPLO)
  await vuelta.page.reload()
  check('al volver de entrar, la partida se abre sola', await sala(vuelta.page))
  check('  …con la ventana de guardar delante', await vuelta.page.waitForSelector('#repFormGuardar', { timeout: 4000 }).then(() => true).catch(() => false))
  check('  …y ya no queda pendiente', (await vuelta.page.evaluate(() => sessionStorage.getItem('pokedoc-repeticion-pendiente'))) === null)
  await ctx.close()

  // El enlace largo, en otra parte.
  const otra = await pagina({ url: `/repeticiones.html#${enlaceLargo.split('#')[1]}` })
  check('el enlace largo abre la misma partida', (await sala(otra.page)) && (await otra.page.textContent('#repResumen')) === `${lectura.eventos.filter((e) => e.tipo === 'turno').length} turnos · ${lectura.eventos.length} jugadas`)
  check('  …y conserva su dirección (para poder pasarlo otra vez)', esEnlaceDeRepeticion(new URL(otra.page.url()).hash))
  await otra.ctx.close()
  const rota = await pagina({ url: `/repeticiones.html#${enlaceLargo.split('#')[1].slice(0, 300)}` })
  await rota.page.waitForTimeout(800)
  check('un enlace largo cortado lo dice, en vez de abrir medio partido', /roto o incompleto/.test(await rota.page.textContent('#repError')) && (await rota.page.isHidden('#repSala')))
  await rota.ctx.close()
}
let idGuardada = null
{
  // Con cuenta: guardar, volver a guardar, cambiar el título.
  const { page, ctx, errores } = await pagina({ quien: 'user-1' })
  await sala(page)
  check('con cuenta, «Tus repeticiones» está vacía y lo dice', await page.waitForFunction(() => /Aún no has guardado ninguna/.test(document.getElementById('repGuardadasCuerpo').textContent), null, { timeout: 4000 }).then(() => true).catch(() => false))
  await page.click('[data-accion="guardar"]')
  check('el título propuesto es quién contra quién', (await page.inputValue('#repTitulo')) === 'Rojo contra Azul')
  await page.fill('#repTitulo', 'La final del barrio')
  await page.click('#repFormGuardar [type=submit]')
  await cerrado(page)
  const llamada = await page.evaluate(() => window.__RPCS__.find((r) => r.nombre === 'repeticiones_guardar')?.args)
  check('guarda la partida con sus jugadores, quién gana y los turnos', llamada?.p_registro === EJEMPLO && llamada.p_jugadores?.join() === 'Rojo,Azul' && llamada.p_ganador === 'Rojo' && llamada.p_turnos === 13 && llamada.p_titulo === 'La final del barrio', JSON.stringify({ ...llamada, p_registro: '…' }))
  idGuardada = new URL(page.url()).searchParams.get('r')
  check('la dirección pasa a ser su enlace corto', /^[0-9a-f]{10}$/.test(idGuardada || ''), page.url())
  check('el botón dice el ESTADO: «Guardada»', (await page.textContent('[data-accion="guardar"]')).trim() === 'Guardada')
  check('  …y el título sale en la cabecera', (await page.textContent('#repNombre')).includes('La final del barrio'))
  await page.waitForFunction(() => document.querySelectorAll('.rep-item').length === 1)
  check('sale en «Tus repeticiones», con quién, turnos y ganador', /La final del barrio/.test(await page.textContent('.rep-item')) && /Rojo contra Azul · 13 turnos · gana Rojo/.test(await page.textContent('.rep-item-sub')))
  // Otra vez la misma partida, pegada a mano: no se duplica.
  await page.click('[data-accion="otra"]')
  await page.fill('#repTexto', EJEMPLO)
  await page.click('#repFormulario button[type=submit]')
  await sala(page)
  check('pegarla otra vez la abre como NUEVA (no sabe que ya está)', (await page.textContent('[data-accion="guardar"]')).trim() === 'Guardar' && new URL(page.url()).search === '')
  await page.click('[data-accion="guardar"]')
  await page.click('#repFormGuardar [type=submit]')
  await cerrado(page)
  await page.waitForTimeout(300)
  check('  …y guardarla otra vez NO la duplica: la misma, con el mismo enlace', (await page.locator('.rep-item').count()) === 1 && new URL(page.url()).searchParams.get('r') === idGuardada)
  // Cambiar el título desde «Guardada».
  await page.click('[data-accion="guardar"]')
  check('«Guardada» abre la misma ventana para cambiar el título', (await page.textContent('#repDialogoTitulo')) === 'Tu repetición guardada')
  await page.fill('#repTitulo', 'Revancha')
  await page.click('#repFormGuardar [type=submit]')
  await cerrado(page)
  await page.waitForTimeout(300)
  check('  …y lo cambia en la cabecera y en la lista', (await page.textContent('#repNombre')).includes('Revancha') && /Revancha/.test(await page.textContent('.rep-item-titulo')))

  // Compartir con cuenta: el enlace corto.
  await page.click('[data-accion="compartir"]')
  const corto = await enlaceDelDialogo(page)
  check('con cuenta, compartir da el enlace CORTO (/rep/, tanda 591)', corto.endsWith(`/rep/${idGuardada}`), corto)
  check('  …y la marca como compartida (cabecera y lista)', (await page.textContent('#repNombre')).includes('Compartida') && /Compartida/.test(await page.textContent('.rep-item')))
  await page.click('[data-dlg="dejar"]')
  await cerrado(page)
  await page.waitForTimeout(300)
  check('«Dejar de compartirla» la quita (cabecera y lista)', !(await page.textContent('#repNombre')).includes('Compartida') && !/Compartida/.test(await page.textContent('.rep-item')))
  // Desde la lista: «Compartir» la comparte y copia el enlace.
  await page.click('.rep-item [data-copiar]')
  await page.waitForTimeout(400)
  check('«Compartir» en la lista la comparte y copia su enlace', (await page.evaluate(() => navigator.clipboard.readText())).endsWith(`/rep/${idGuardada}`) && /Compartida/.test(await page.textContent('.rep-item')))
  // Borrar: dos toques.
  await page.click('.rep-item [data-borrar]')
  check('borrar pide un segundo toque', /Seguro/.test(await page.textContent('.rep-item [data-borrar]')) && (await page.locator('.rep-item').count()) === 1)
  await page.click('.rep-item [data-borrar]')
  await page.waitForFunction(() => !document.querySelector('.rep-item'))
  check('  …y al segundo la borra, y la página deja de ser «suya»', /Aún no has guardado ninguna/.test(await page.textContent('#repGuardadasCuerpo')) && (await page.textContent('[data-accion="guardar"]')).trim() === 'Guardar' && new URL(page.url()).search === '')
  check('sin errores en la página', !errores.length, errores.join(' | '))
  await ctx.close()
}
{
  // El enlace corto, abierto por otra persona (sin cuenta).
  const fila = { id: '1a2b3c4d5e', user_id: 'user-1', titulo: 'La final del barrio', registro: EJEMPLO, compartida: true }
  const { page, ctx } = await pagina({ url: '/repeticiones.html?r=1a2b3c4d5e', antes: { __FAKE_REPETICIONES__: [fila] } })
  check('el enlace corto abre la partida a quien no es su dueño', await sala(page))
  check('  …con su título, y «Guardar» (para quedarse una copia)', (await page.textContent('#repNombre')).includes('La final del barrio') && (await page.textContent('[data-accion="guardar"]')).trim() === 'Guardar')
  await page.click('[data-accion="compartir"]')
  check('compartirla otra vez da EL MISMO enlace, sin guardar nada', (await enlaceDelDialogo(page)).endsWith('/rep/1a2b3c4d5e') && (await rpcs(page, 'repeticiones_guardar')) === 0)
  await ctx.close()
  const privada = await pagina({ url: '/repeticiones.html?r=1a2b3c4d5e', antes: { __FAKE_REPETICIONES__: [{ ...fila, compartida: false }] } })
  await privada.page.waitForTimeout(800)
  check('una que ya no se comparte NO se abre, y lo dice', /no existe o ya no se comparte/.test(await privada.page.textContent('#repError')) && (await privada.page.isHidden('#repSala')))
  await privada.ctx.close()
  const suya = await pagina({ quien: 'user-1', url: '/repeticiones.html?r=1a2b3c4d5e', antes: { __FAKE_REPETICIONES__: [{ ...fila, compartida: false }] } })
  check('  …pero su dueño sí la abre, compartida o no', await sala(suya.page))
  await suya.ctx.close()
}
{
  // Sin la migración puesta: guardar lo dice; compartir da el largo.
  const { page, ctx } = await pagina({ quien: 'user-1', antes: { __SIN_RPC__: ['repeticiones_guardar', 'repeticiones_leer', 'enlace_corto_crear'], __SIN_TABLAS__: ['replays'] } })
  await sala(page)
  await page.click('[data-accion="guardar"]')
  await page.click('#repFormGuardar [type=submit]')
  await page.waitForFunction(() => document.querySelector('#repDialogo .rep-dialogo-estado')?.textContent)
  check('sin la migración, guardar dice qué fichero falta', /supabase-migration-repeticiones\.sql/.test(await page.textContent('#repDialogo .rep-dialogo-estado')))
  await page.keyboard.press('Escape')
  await page.click('[data-accion="compartir"]')
  const enlace = await enlaceDelDialogo(page)
  check('  …y compartir da el enlace largo, sin asustar a nadie', /#p=/.test(enlace) && !/supabase|migraci/i.test(await page.textContent('#repCompartirNota')))
  check('  …y la lista lo dice en vez de quedarse cargando', /supabase-migration-repeticiones\.sql/.test(await page.textContent('#repGuardadasCuerpo')))
  await ctx.close()
}
{
  // El móvil: las tres acciones en una fila; girar y pegar, debajo.
  const { page, ctx } = await pagina({ ancho: 390, alto: 844, tacto: true })
  await sala(page)
  const m = await page.evaluate(() => {
    const tops = [...document.querySelectorAll('.rep-cab-acciones > button')].map((b) => Math.round(b.getBoundingClientRect().top))
    const altos = [...document.querySelectorAll('.rep-cab-acciones > button, .rep-cab-extra > button')].map((b) => b.getBoundingClientRect().height)
    return { tops, altos, desborda: document.documentElement.scrollWidth > document.documentElement.clientWidth }
  })
  check('[390] Guardar, Compartir y Vídeo en UNA fila', new Set(m.tops).size === 1 && m.tops.length === 3, m.tops.join(','))
  check('[390] todo lo que se pulsa mide 44 px de alto', m.altos.every((h) => h >= 44), m.altos.join(','))
  check('[390] sin desbordar a lo ancho', !m.desborda)
  await ctx.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 6. El vídeo ──')
{
  const { page, ctx, errores, imagenes } = await pagina()
  await sala(page)
  await page.waitForTimeout(1500)
  await page.click('[data-accion="video"]')
  await page.waitForSelector('[data-dlg="hacer-video"]')
  const texto = await page.textContent('#repDialogoCuerpo .rep-dialogo-texto')
  check('la ventana dice que se hace en el navegador y no se sube', /no se sube a ninguna parte/.test(texto))
  check('  …y en qué formato sale (aquí, VP9: este Chromium no trae H.264)', /Sale en MP4 \((H\.264|VP9)/.test(texto), texto)
  const duracionDicha = await page.textContent('label:has(input[name="repRitmo"][value="4"])')
  await page.check('input[name="repRitmo"][value="4"]')
  const [descarga] = await Promise.all([page.waitForEvent('download', { timeout: 180000 }), page.click('[data-dlg="hacer-video"]')])
  const fichero = join(TMP, descarga.suggestedFilename())
  await descarga.saveAs(fichero)
  check('se descarga un .mp4 con el nombre de la partida', descarga.suggestedFilename() === 'repeticion-rojo-contra-azul.mp4', descarga.suggestedFilename())
  if (hayFfmpeg) {
    const p = ffprobe(fichero)
    const [m, s] = (duracionDicha.match(/(\d+):(\d\d)/) || []).slice(1).map(Number)
    check('ffprobe lo lee: 1280×720, VP9 o H.264', p && p.width === 1280 && p.height === 720 && ['vp9', 'h264'].includes(p.codec_name), JSON.stringify(p))
    check('  …y dura lo que dijo la ventana', p && Math.abs(p.duracion - (m * 60 + s)) <= 1, `${p?.duracion} s, dijo ${duracionDicha.trim()}`)
    check('  …y se decodifica entero sin un error', decodifica(fichero))
    // El último fotograma: el cartel de quién gana, con su borde DORADO en
    // el centro del tapete. Se mira una fila de píxeles que lo cruza: el
    // fondo del centro es oscuro también, así que lo que distingue al
    // cartel es el oro del borde. Dos filas y no una: el vídeo va en 4:2:0,
    // el croma va a media altura y una fila sola se queda en CERO de alto
    // — ffmpeg no escribe nada y el «no hay oro» parecería un fallo de la web.
    const crudo = join(TMP, 'final.rgb')
    spawnSync('ffmpeg', ['-v', 'error', '-y', '-sseof', '-0.5', '-i', fichero, '-frames:v', '1', '-vf', 'crop=80:2:470:294', '-f', 'rawvideo', '-pix_fmt', 'rgb24', crudo])
    const px = existsSync(crudo) ? [...readFileSync(crudo)] : []
    const oro = Array.from({ length: px.length / 3 }, (_, i) => px.slice(i * 3, i * 3 + 3)).some(([r, g, b]) => r > 200 && g > 160 && b < 150)
    check('el final es el cartel de quién gana (su borde dorado, en el centro del tapete)', oro, px.length)
  }
  check('las cartas salen de sitios que NO manchan el lienzo (/escaneo, con permiso)', imagenes.some((u) => u.includes('/escaneo/FK/')))
  check('  …y el estado dice que está listo, con su tamaño', /Listo/.test(await page.textContent('#repDialogoCuerpo .rep-dialogo-estado')) && /MB\)/.test(await page.textContent('#repDialogoCuerpo .rep-dialogo-botones')))
  check('sin errores en la página', !errores.length, errores.join(' | '))
  await ctx.close()
}
{
  // Una carta de OTRO dominio (TCGdex) en el lienzo: con permiso se pinta
  // y el lienzo se puede seguir grabando; sin él, quedaría manchado y el
  // vídeo no saldría (`new VideoFrame` lanza un error de seguridad).
  const { page, ctx } = await pagina({ url: '/repeticiones.html' })
  await page.route('https://assets.tcgdex.net/**', (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', headers: { 'access-control-allow-origin': '*' }, body: cartaFalsa }))
  const r = await page.evaluate(async () => {
    const V = await import('/js/repeticiones/video.js')
    const { leerRegistro } = await import('/js/repeticiones/registro.js')
    const { fotos } = await import('/js/repeticiones/estado.js')
    const { EJEMPLO } = await import('/js/repeticiones/ejemplo.js')
    const fs = fotos(leerRegistro(EJEMPLO))
    const lienzo = await V.dibujarUna({
      foto: fs[40],
      M: { abajo: 'Rojo', psDe: () => 60, letraDe: () => 'C', colorDe: () => 0, fuentesDe: () => ['https://assets.tcgdex.net/en/sv/sv01/1/low.webp'] },
    })
    let limpio = true
    try {
      new VideoFrame(lienzo, { timestamp: 0 }).close()
    } catch {
      limpio = false
    }
    // El activo de abajo: ¿se ha pintado la imagen (el azul de la carta
    // de mentira) o el hueco con el nombre?
    let pintada = null
    try {
      const [r, g, b] = lienzo.getContext('2d').getImageData(640, 420, 1, 1).data
      pintada = Math.abs(r - 0x9c) < 12 && Math.abs(g - 0xc3) < 12 && Math.abs(b - 0xe0) < 12
    } catch {
      pintada = 'manchado'
    }
    return { limpio, pintada }
  })
  check('una carta de otro dominio se pinta en el lienzo (con su permiso)', r.pintada === true, JSON.stringify(r))
  check('  …y el lienzo se sigue pudiendo grabar', r.limpio, JSON.stringify(r))
  await ctx.close()
}
{
  // Cancelar a mitad.
  const { page, ctx } = await pagina()
  await sala(page)
  await page.click('[data-accion="video"]')
  await page.waitForSelector('[data-dlg="hacer-video"]')
  await page.check('input[name="repRitmo"][value="1"]')
  let descargado = false
  page.on('download', () => (descargado = true))
  await page.click('[data-dlg="hacer-video"]')
  await page.waitForFunction(() => /Haciendo el vídeo/.test(document.querySelector('#repDialogoCuerpo .rep-dialogo-estado')?.textContent || ''), null, { timeout: 20000 })
  await page.click('[data-dlg="cancelar-video"]')
  await page.waitForFunction(() => /Cancelado/.test(document.querySelector('#repDialogoCuerpo .rep-dialogo-estado')?.textContent || ''), null, { timeout: 10000 }).catch(() => {})
  check('se puede cancelar a mitad, y no descarga nada', /Cancelado/.test(await page.textContent('#repDialogoCuerpo .rep-dialogo-estado')) && !descargado)
  check('  …y se puede volver a empezar', !(await page.isDisabled('[data-dlg="hacer-video"]')))
  await ctx.close()
}
{
  // Sin WebCodecs: el respaldo graba en tiempo real, y la ventana lo avisa.
  const { page, ctx } = await pagina({ antes: { VideoEncoder: null } })
  await sala(page)
  await page.click('[data-accion="video"]')
  await page.waitForSelector('[data-dlg="hacer-video"]')
  check('sin WebCodecs, la ventana avisa de que se graba en TIEMPO REAL', /TIEMPO REAL/.test(await page.textContent('#repDialogoCuerpo .rep-dialogo-texto')))
  await ctx.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 7. Lo demás ──')
{
  check('schema-check vigila la tabla nueva', /tabla: 'replays', columna: 'compartida', fichero: 'supabase-migration-repeticiones\.sql'/.test(leer('js/schema-check.js')))
  const datos = leer('js/repeticiones/datos.js')
  // Desde la 494 la consulta va en una función (`pedir`), porque se repite
  // sin los mazos si la base tiene la migración de antes: lo que importa
  // es que el filtro por TI siga ahí.
  check('tus repeticiones se piden filtrando por TI (la política no basta en el doble)', /\.from\('replays'\)\s*\.select\((COLUMNAS_LISTA|columnas)\)\s*\.eq\('user_id', userId\)/.test(datos))
  check('  …y sin el registro (10 o 20 KB por fila)', !/COLUMNAS_LISTA = '[^']*registro/.test(datos))
  check('un cambio que la política rechaza no pasa por bueno (se pide la fila de vuelta)', /\.update\(cambios\)\.eq\('id', id\)\.select\(/.test(datos) && /\.delete\(\)\.eq\('id', id\)\.select\(/.test(datos))
  check('el vídeo se carga solo al pedirlo (no lo baja quien solo mira)', /await import\('\.\/repeticiones\/video\.js'\)/.test(leer('js/repeticiones.js')) && !/from '\.\/repeticiones\/video\.js'/.test(leer('js/repeticiones.js')))
  check('el icono de descargar NO va en js/icons.js (lo baja la portada)', !/descargar/.test(leer('js/icons.js')))
  check('la frase de la página dice cuándo se guarda (tanda 447)', /no se guarda en ningún sitio hasta que tú le das a «Guardar» o a «Compartir»/.test(leer('repeticiones.html')))
}

await browser.close()
console.log(fails ? `\n${fails} FALLOS` : '\nTodo en verde')
process.exit(fails ? 1 : 0)
