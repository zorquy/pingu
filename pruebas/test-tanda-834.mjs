// Tanda 834 — «Imprimir decklist oficial» en el constructor. Ibai: «que te
// dé el documento para imprimir la decklist directamente con la plantilla
// oficial de Play! Pokémon […] antes de generar el documento que te haga
// las preguntas básicas (año de nacimiento, nombre, Pokémon ID —un campo en
// el perfil para que se haga automáticamente—, categoría) y luego la lista
// con número y abreviatura de la colección; para objetos y entrenadores, con
// el nombre sirve».
//
// Tres partes: la hoja (js/decklist-oficial.js, en Node y con el PDF de
// verdad pasado por qpdf y poppler), el diálogo del constructor y el
// perfil, contra el doble.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 260) : ''}`)
}
const RAIZ = '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const TMP = mkdtempSync(join(tmpdir(), 'decklist-834-'))
const PLANTILLA = readFileSync(`${RAIZ}/assets/decklist/play-pokemon-decklist-a4.pdf`)
const sh = (cmd, args) => spawnSync(cmd, args, { encoding: 'utf8' })
const textoDelPdf = (bytes, nombre) => {
  const f = join(TMP, nombre)
  writeFileSync(f, bytes)
  return { fichero: f, texto: sh('pdftotext', ['-raw', f, '-']).stdout, qpdf: sh('qpdf', ['--check', f]) }
}

const H = await import(`${RAIZ}/js/decklist-oficial.js`)

console.log('── 1. Las reglas de la hoja ──')
{
  const d = H.divisionPorNacimiento
  check('categorías de la temporada 2026: 2014 o después Junior', d('2014-01-01') === 'junior' && d('2018-07-07') === 'junior')
  check('  …2010–2013 Senior', d('2013-12-31') === 'senior' && d('2010-01-01') === 'senior')
  check('  …2009 o antes Masters', d('2009-12-31') === 'masters' && d('1990-05-05') === 'masters')
  check('  …y sin fecha no se inventa ninguna', d('') === null && d(null) === null && d('abc') === null)
  check('las promos SV y ME son SVP y MEP; las de antes, PR', H.abreviaturaDeSet('PR-SV') === 'SVP' && H.abreviaturaDeSet('PR-ME') === 'MEP' && H.abreviaturaDeSet('PR-SW') === 'PR' && H.abreviaturaDeSet('pr-sm') === 'PR')
  check('  …y un código normal se queda', H.abreviaturaDeSet('TWM') === 'TWM' && H.abreviaturaDeSet('') === '')
  check('el Player ID son cifras, con espacios o guiones al escribirlo', H.limpiarPlayerId(' 12 345-67 ') === '1234567' && H.limpiarPlayerId('abc') === null && H.limpiarPlayerId('12345678901') === null)
  check('WinAnsi: acentos y ’ con su byte; ♀ como F; lo que no cabe, «?»',
    JSON.stringify(H.aWinAnsi('é’')) === JSON.stringify([233, 0x92]) && String.fromCharCode(...H.aWinAnsi('Nidoran♀')) === 'Nidoran F' && JSON.stringify(H.aWinAnsi('雪')) === '[63]')
}

// Un mazo de prueba con todo lo que la hoja tiene que saber escribir.
const carta = (id, name, set_id, local_id, category, extra = {}) => ({ id, name, set_id, local_id, category, market: 'WEST', ...extra })
const POKEMON = [
  ['Dreepy', '128', 4, 'Basic', null], ['Drakloak', '129', 4, 'Stage1', 'Dreepy'], ['Dragapult ex', '130', 3, 'Stage2', 'Drakloak'],
  ['Budew', '004', 1, 'Basic', null], ['Latias ex', '076', 1, 'Basic', null], ['Fezandipiti ex', '038', 1, 'Basic', null],
  ['Munkidori', '095', 1, 'Basic', null], ['Bloodmoon Ursaluna ex', '141', 1, 'Basic', null], ['Pecharunt ex', '039', 1, 'Basic', null],
  ['Squawkabilly ex', '169', 1, 'Basic', null], ['Klefki', '096', 1, 'Basic', null], ['Iron Crown ex', '081', 1, 'Basic', null],
].map(([name, n, copias, stage, evolve_from], i) => ({
  carta: carta(`p${i}`, name, i === 11 ? 'svp' : i === 10 ? 'xx9' : 'sv06', n, 'Pokemon', { stage, evolve_from, regulation_mark: i === 9 ? 'G' : 'H', name_es: name === 'Dreepy' ? 'Dreepy' : `${name} (es)` }),
  n: copias,
}))
const ENTRENADORES = [['Arven', 4, 'Supporter'], ["Boss's Orders", 2, 'Supporter'], ['Ultra Ball', 4, 'Item'], ['Rare Candy', 3, 'Item'], ['Area Zero Underdepths', 1, 'Stadium']].map(
  ([name, n, trainer_type], i) => ({ carta: carta(`t${i}`, name, 'sv01', String(100 + i), 'Trainer', { trainer_type, name_es: `${name} (es)` }), n })
)
const ENERGIAS = [
  { carta: carta('sve-2', 'Basic Fire Energy', 'sve', '2', 'Energy', { energy_type: 'Basic' }), n: 3 },
  { carta: carta('mee-002', 'Fire Energy', 'mee', '2', 'Energy', { energy_type: 'Basic', name_es: 'Energía Fuego' }), n: 2 },
  { carta: carta('sv05-162', 'Neo Upper Energy', 'sv05', '162', 'Energy', { energy_type: 'Special' }), n: 1 },
]
const CODIGOS = { sv06: 'TWM', svp: 'PR-SV', sv01: 'SVI', sv05: 'TEF', sve: 'SVE', mee: 'MEE' }
const MAZO = [...POKEMON, ...ENTRENADORES, ...ENERGIAS]

console.log('── 2. Las líneas de cada tabla ──')
{
  const l = H.lineasDeLaHoja(MAZO, { codigoDeSet: (s) => CODIGOS[s] || null })
  const dragapult = l.pokemon.find((x) => x.nombre === 'Dragapult ex')
  check('un Pokémon lleva colección, número sin ceros y marca', dragapult?.set === 'TWM' && dragapult?.numero === '130' && dragapult?.reg === 'H' && dragapult?.n === 3, JSON.stringify(dragapult))
  check('  …en el orden del export de TCG Live (la línea evolutiva junta)', l.pokemon.slice(0, 3).map((x) => x.nombre).join(',') === 'Dreepy,Drakloak,Dragapult ex', l.pokemon.slice(0, 3).map((x) => x.nombre).join(','))
  const crown = l.pokemon.find((x) => x.nombre === 'Iron Crown ex')
  check('una promo SV va como SVP y su número sin ceros', crown?.set === 'SVP' && crown?.numero === '81', JSON.stringify(crown))
  const sin = l.pokemon.find((x) => x.nombre === 'Klefki')
  check('sin código de TCG Live se marca para revisarlo a mano', sin?.sinCodigo === true && sin?.set === 'XX9', JSON.stringify(sin))
  check('los entrenadores solo con nombre (sin colección ni número)', l.entrenadores.every((x) => Object.keys(x).join(',') === 'n,nombre') && l.entrenadores.length === 5)
  const fuego = l.energias.filter((x) => /Fire/.test(x.nombre))
  check('las básicas del mismo tipo se juntan: «Basic Fire Energy» 5', fuego.length === 1 && fuego[0].nombre === 'Basic Fire Energy' && fuego[0].n === 5, JSON.stringify(l.energias))
  check('  …y la especial se queda con su nombre', l.energias.some((x) => x.nombre === 'Neo Upper Energy' && x.n === 1))
  const es = H.lineasDeLaHoja(MAZO, { codigoDeSet: (s) => CODIGOS[s] || null, idioma: 'es' })
  check('en español: el nombre español y «Energía Fuego Básica»', es.pokemon.some((x) => x.nombre === 'Dragapult ex (es)') && es.energias.some((x) => x.nombre === 'Energía Fuego Básica'), JSON.stringify(es.energias))
  const r = H.resumenDeLaHoja(l)
  check('12 Pokémon en 10 renglones: el resumen dice que van apretados', r.pokemon.lineas === 12 && r.pokemon.filas === 10 && r.pokemon.apretada === true && r.entrenadores.apretada === false, JSON.stringify(r))
}

console.log('── 3. El PDF: la plantilla de verdad, rellena ──')
{
  // La plantilla es la preparada: el hueco es el cuarto de /Contents.
  const crudo = PLANTILLA.toString('latin1')
  check('la plantilla tiene el HUECO donde la hoja lo busca (objeto 8)', /\/Contents \[ \d+ 0 R \d+ 0 R \d+ 0 R 8 0 R \]/.test(crudo))
  check('  …y Helvetica en sus fuentes (/PDH)', /\/PDH \d+ 0 R/.test(crudo))
  check('  …y pesa poco (sin el equipaje de InDesign)', PLANTILLA.length < 250000, `${PLANTILLA.length} bytes`)
  const lineas = H.lineasDeLaHoja(MAZO, { codigoDeSet: (s) => CODIGOS[s] || null })
  const contenido = H.contenidoDeLaHoja({ nombre: 'Íñigo (Pérez \\ López', playerId: '1234567', nacimiento: '2012-03-21', division: 'senior', formato: 'expanded', lineas })
  check('el flujo es ASCII puro (lo demás va en octal)', /^[\x0a\x20-\x7e]*$/.test(contenido))
  const pdf = H.rellenarPlantilla(new Uint8Array(PLANTILLA), contenido)
  const { texto, qpdf } = textoDelPdf(pdf, 'hoja.pdf')
  check('qpdf lo da por bueno, sin avisos', qpdf.status === 0 && /No syntax or stream encoding errors/.test(qpdf.stdout) && !/WARNING/.test(qpdf.stdout + qpdf.stderr), (qpdf.stdout + qpdf.stderr).slice(0, 300))
  // La xref nueva, al byte: qpdf y los lectores RECONSTRUYEN una tabla mal
  // apuntada sin decir nada, así que se mira a mano dónde apunta.
  const cola = Buffer.from(pdf.subarray(PLANTILLA.length)).toString('latin1')
  const sx = Number(cola.match(/startxref\s+(\d+)\s+%%EOF\s*$/)?.[1])
  const entrada = Number(cola.match(/xref\s+8 1\s+(\d{10}) 00000 n /)?.[1])
  const en = (o, n) => Buffer.from(pdf.subarray(o, o + n)).toString('latin1')
  check('la xref nueva apunta al objeto 8 al byte, y startxref a la xref', en(entrada, 7) === '8 0 obj' && en(sx, 4) === 'xref', `${entrada}:${JSON.stringify(en(entrada, 7))} ${sx}:${JSON.stringify(en(sx, 4))}`)
  check('  …y el trailer nuevo encadena con el viejo (/Prev = el startxref de la plantilla)', Number(cola.match(/\/Prev (\d+)/)?.[1]) === Number(PLANTILLA.toString('latin1').match(/startxref\s+(\d+)\s+%%EOF\s*$/)?.[1]))
  check('es una actualización INCREMENTAL: la plantilla va intacta delante', Buffer.from(pdf.subarray(0, PLANTILLA.length)).equals(PLANTILLA))
  // Un paréntesis SIN cerrar: los equilibrados son legales sin escapar en
  // una cadena de PDF, así que solo este prueba de verdad el escapado.
  check('el nombre sale con sus acentos, un paréntesis sin cerrar y la barra', texto.includes('Íñigo (Pérez \\ López'), texto.slice(0, 300))
  check('  …el Player ID y la fecha MM / DD / AAAA', /1234567/.test(texto) && /03\s*\/?\s*21\s*\/?\s*2012/.test(texto.replace(/\n/g, ' ')), texto.slice(0, 400))
  for (const nombre of ['Dreepy', 'Dragapult ex', 'Bloodmoon Ursaluna ex', 'Iron Crown ex', 'Arven', "Boss's Orders", 'Area Zero Underdepths', 'Basic Fire Energy', 'Neo Upper Energy']) {
    check(`  …«${nombre}» está en la hoja`, texto.includes(nombre))
  }
  check('  …con SVP y la marca G del Squawkabilly', /SVP/.test(texto) && /\bG\b/.test(texto))
  // Las casillas se DIBUJAN: dos trazos (m … l … l S) por casilla marcada.
  check('las casillas marcadas son dos: formato y categoría', (contenido.match(/ m [\d.]+ [\d.]+ l [\d.]+ [\d.]+ l S/g) || []).length === 2)
  // Pintarla de verdad: poppler no se queja y sale una página A4.
  const png = sh('pdftoppm', ['-r', '40', '-png', '-singlefile', join(TMP, 'hoja.pdf'), join(TMP, 'hoja')])
  check('poppler la pinta sin errores', png.status === 0 && !png.stderr, png.stderr)
  const info = sh('pdfinfo', [join(TMP, 'hoja.pdf')]).stdout
  check('  …en una página A4', /Pages:\s+1/.test(info) && /595\.\d+ x 841\.\d+/.test(info), info.slice(0, 200))
  check('una plantilla que no es la preparada se rechaza con un error que lo dice', (() => {
    try {
      H.rellenarPlantilla(new TextEncoder().encode('%PDF-1.4\nnada'), 'x')
      return false
    } catch (e) {
      return /preparada/.test(e.message)
    }
  })())
}

// ── El constructor y el perfil, contra el doble ──
const SETS = [
  { id: 'sv04.5', name: 'Destinos de Paldea', market: 'WEST', tcg_online_code: 'PAF', release_date: '2024-01-26', card_count_official: 91, serie_id: 'sv', serie_name: 'Escarlata y Púrpura' },
  { id: 'mee', name: 'Energías Mega Evolución', market: 'WEST', tcg_online_code: 'MEE', release_date: '2025-08-01', card_count_official: 16, serie_id: 'me', serie_name: 'Mega Evolución' },
]
const CARTAS = [
  { id: 'sv04.5-7', set_id: 'sv04.5', market: 'WEST', local_id: '7', name: 'Charmander', name_es: 'Charmander', name_key: 'charmander', category: 'Pokemon', stage: 'Basic', regulation_mark: 'H', image_path: 'sv/sv04.5/7', types: ['Fire'], hp: 70 },
  { id: 'mee-002', set_id: 'mee', market: 'WEST', local_id: '2', name: 'Fire Energy', name_es: 'Energía Fuego', name_key: 'fire energy', category: 'Energy', energy_type: 'Básico', regulation_mark: null, image_path: null },
]
const PERFILES = [{ id: 'user-1', username: 'ash', display_name: 'Ash' }]
const browser = await chromium.launch()
async function constructor({ sesion = 'user-1', play = null, sinTablas = [] } = {}) {
  const page = await browser.newPage({ viewport: { width: 1300, height: 900 }, acceptDownloads: true })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.route(/\.(png|webp|jpg|jpeg)(\?|$)/, (r) => r.abort())
  await page.addInitScript(([s, sets, cartas, perfiles, play, sinTablas]) => {
    window.__FAKE_SESSION__ = s
    window.__FAKE_SETS__ = sets
    window.__FAKE_CARTAS__ = cartas
    window.__FAKE_PERFILES__ = perfiles
    if (play) window.__FAKE_PLAY__ = [play]
    window.__SIN_TABLAS__ = sinTablas
  }, [sesion, SETS, CARTAS, PERFILES, play, sinTablas])
  await page.goto(`${BASE}/constructor.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  // Un mazo pequeño, importado como lo haría cualquiera.
  await page.click('#cmBtnHerramientas')
  await page.click('#cmMenuHerramientas [data-accion="importar"]')
  await page.waitForTimeout(300)
  await page.fill('#cmImportarTexto', 'Pokémon: 4\n4 Charmander PAF 7\n\nEnergy: 6\n6 Basic {R} Energy SVE 2\n\nTotal Cards: 10')
  await page.click('#cmImportarBoton')
  await page.waitForTimeout(1200)
  return { page, errores }
}
const abrirHoja = async (page) => {
  await page.click('#cmBtnCompartir')
  await page.click('#cmMenuCompartir [data-accion="decklist"]')
  await page.waitForTimeout(900)
}
const valor = (page, id) => page.locator(`#${id}`).inputValue()
const marcado = (page, nombre) => page.evaluate((n) => document.querySelector(`#cmHojaForm input[name="${n}"]:checked`)?.value || null, nombre)
const tablas = (page) => page.evaluate(() => window.__TABLAS__)
const toasts = (page) => page.evaluate(() => [...document.querySelectorAll('.toast, [class*="toast"]')].map((t) => t.textContent).join(' | '))
async function descargar(page) {
  const espera = page.waitForEvent('download', { timeout: 8000 }).catch(() => null)
  await page.click('#cmHojaGenerar')
  const d = await espera
  if (!d) return null
  const f = join(TMP, `descarga-${Date.now()}.pdf`)
  await d.saveAs(f)
  return { nombre: d.suggestedFilename(), bytes: readFileSync(f) }
}

console.log('── 4. El diálogo del constructor, con tus datos guardados ──')
{
  const { page, errores } = await constructor({ play: { user_id: 'user-1', player_id: '7654321', player_name: 'Ash Ketchum', birth_date: '2012-05-04' } })
  await abrirHoja(page)
  check('«Imprimir decklist oficial» abre el diálogo', await page.isVisible('#cmModalHoja'))
  check('  …con nombre, Player ID y fecha de tu perfil', (await valor(page, 'cmHojaNombre')) === 'Ash Ketchum' && (await valor(page, 'cmHojaPlayerId')) === '7654321' && (await valor(page, 'cmHojaNacimiento')) === '2012-05-04')
  check('  …la categoría por el año (2012 → Senior)', (await marcado(page, 'cmHojaDivision')) === 'senior')
  check('  …el formato del mazo (Estándar)', (await marcado(page, 'cmHojaFormato')) === 'standard')
  check('  …los nombres en inglés por defecto', (await marcado(page, 'cmHojaIdioma')) === 'en')
  check('  …y los años de cada categoría en su rótulo', /Junior \(nacidos en 2014 o después\)/.test(await page.locator('#cmHojaForm').innerText()))
  const resumen = await page.locator('#cmHojaResumen').innerText()
  check('el resumen cuenta las líneas y avisa de que no son 60', /Pokémon: 1 línea/.test(resumen) && /10 cartas, no 60/.test(resumen), resumen)
  // Cambiar la fecha cambia la categoría.
  await page.fill('#cmHojaNacimiento', '2015-01-01')
  await page.dispatchEvent('#cmHojaNacimiento', 'change')
  check('cambiar la fecha a 2015 la pasa a Junior', (await marcado(page, 'cmHojaDivision')) === 'junior')
  await page.fill('#cmHojaNacimiento', '2012-05-04')
  await page.dispatchEvent('#cmHojaNacimiento', 'change')

  const d = await descargar(page)
  check('«Descargar PDF» baja un PDF con el nombre del mazo', Boolean(d) && /^decklist-.*\.pdf$/.test(d?.nombre || ''), d?.nombre)
  if (d) {
    const { texto, qpdf } = textoDelPdf(d.bytes, 'descargada.pdf')
    check('  …válido', qpdf.status === 0, qpdf.stdout.slice(0, 200))
    check('  …con tus datos y el mazo', /Ash Ketchum/.test(texto) && /7654321/.test(texto) && /Charmander/.test(texto) && /PAF/.test(texto) && /Basic Fire Energy/.test(texto), texto.slice(0, 300))
  }
  check('sin cambios en tus datos, el perfil no se reescribe', !(await page.evaluate(() => (JSON.parse(sessionStorage.getItem('__escrituras__') || '[]')).some((e) => e.tabla === 'user_play_pokemon'))))
  check('el diálogo se cierra al acabar', !(await page.isVisible('#cmModalHoja')))
  check('sin errores', !errores.length, errores[0])
  await page.close()
}

console.log('── 5. Lo que escribes se guarda en tu perfil (privado) ──')
{
  const { page, errores } = await constructor({ play: null })
  await abrirHoja(page)
  check('sin nada guardado, los campos vacíos', (await valor(page, 'cmHojaNombre')) === '' && (await valor(page, 'cmHojaPlayerId')) === '')
  check('  …y la casilla de guardar a la vista', await page.isVisible('#cmHojaRecordar'))
  await page.fill('#cmHojaPlayerId', 'abc')
  // El aviso se lee en seguida: los avisos se van solos a los pocos segundos.
  const espera = page.waitForEvent('download', { timeout: 3000 }).catch(() => null)
  await page.click('#cmHojaGenerar')
  await page.waitForTimeout(400)
  const aviso = await toasts(page)
  check('un Player ID con letras NO genera la hoja', (await espera) === null && /solo cifras/.test(aviso), aviso)
  await page.fill('#cmHojaNombre', 'Misty Waterflower')
  await page.fill('#cmHojaPlayerId', '11 22 333')
  await page.fill('#cmHojaNacimiento', '2005-02-02')
  await page.dispatchEvent('#cmHojaNacimiento', 'change')
  await page.check('#cmHojaForm input[name="cmHojaIdioma"][value="es"]')
  const d = await descargar(page)
  check('con un Player ID con espacios, la hoja sale', Boolean(d))
  if (d) {
    const { texto } = textoDelPdf(d.bytes, 'misty.pdf')
    check('  …con el ID limpio y los nombres en español', /1122333/.test(texto) && /Energía Fuego Básica/.test(texto), texto.slice(0, 300))
  }
  await page.waitForTimeout(500)
  const fila = (await tablas(page)).user_play_pokemon.find((f) => f.user_id === 'user-1')
  check('…y tus datos quedan guardados en tu fila', fila?.player_id === '1122333' && fila?.player_name === 'Misty Waterflower' && fila?.birth_date === '2005-02-02', JSON.stringify(fila))
  check('el idioma elegido se recuerda en el navegador', (await page.evaluate(() => localStorage.getItem('pokedoc-decklist-idioma'))) === 'es')
  check('sin errores', !errores.length, errores[0])
  await page.close()
}

console.log('── 6. Sin cuenta, y sin la migración ──')
{
  const { page, errores } = await constructor({ sesion: 'none' })
  await abrirHoja(page)
  check('sin cuenta no se ofrece guardar en el perfil', !(await page.isVisible('#cmHojaRecordar')))
  await page.fill('#cmHojaNombre', 'Brock')
  check('  …y la hoja sale igual', Boolean(await descargar(page)))
  check('sin errores', !errores.length, errores[0])
  await page.close()
}
{
  const { page, errores } = await constructor({ sinTablas: ['user_play_pokemon'] })
  await abrirHoja(page)
  check('sin la migración, lo dice junto a la casilla', /falta ejecutar supabase-migration-play-pokemon\.sql/.test(await page.locator('#cmHojaRecordarAviso').innerText()))
  await page.fill('#cmHojaNombre', 'Gary Oak')
  check('  …y la hoja sale igual', Boolean(await descargar(page)))
  await page.waitForTimeout(300)
  check('  …sin intentar guardar (ni avisar de que no se ha podido)', !/no se han guardado|No se ha podido/.test(await toasts(page)), await toasts(page))
  check('  …y el diálogo se cierra como siempre', !(await page.isVisible('#cmModalHoja')))
  check('  …sin intentar escribir en una tabla que no existe', !(await page.evaluate(() => (JSON.parse(sessionStorage.getItem('__escrituras__') || '[]')).some((e) => e.tabla === 'user_play_pokemon'))))
  check('sin errores', !errores.length, errores[0])
  await page.close()
}

console.log('── 7. Ajustes › Cuenta: Play! Pokémon, privado (desde la 868 ahí) ──')
async function perfil({ play = null, sinTablas = [] } = {}) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.route(/\.(png|webp|jpg|jpeg)(\?|$)/, (r) => r.abort())
  await page.addInitScript(([perfiles, play, sinTablas]) => {
    window.__FAKE_SESSION__ = 'user-1'
    window.__FAKE_PERFILES__ = perfiles
    if (play) window.__FAKE_PLAY__ = [play]
    window.__SIN_TABLAS__ = sinTablas
  }, [PERFILES, play, sinTablas])
  await page.goto(`${BASE}/ajustes.html?ver=cuenta`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  return { page, errores }
}
{
  const { page, errores } = await perfil({ play: { user_id: 'user-1', player_id: '555', player_name: 'Ash Ketchum', birth_date: '2001-01-01' } })
  check('Ajustes › Cuenta trae tus datos de Play! Pokémon', (await page.locator('#ajPlayerId').inputValue()) === '555' && (await page.locator('#ajPlayNombre').inputValue()) === 'Ash Ketchum' && (await page.locator('#ajPlayNacimiento').inputValue()) === '2001-01-01')
  check('  …dice que son privados', /solo lo ves tú/.test(await page.locator('#ajPanel').innerText()))
  await page.fill('#ajPlayerId', '9988776')
  await page.click('#ajPlayGuardar')
  await page.waitForTimeout(1200)
  const fila = (await tablas(page)).user_play_pokemon.find((f) => f.user_id === 'user-1')
  check('Guardar escribe el Player ID nuevo', fila?.player_id === '9988776' && fila?.player_name === 'Ash Ketchum', JSON.stringify(fila))
  check('sin errores', !errores.length, errores[0])
  await page.close()
}
{
  const { page, errores } = await perfil({ play: { user_id: 'user-1', player_id: '555', player_name: 'Ash', birth_date: null } })
  await page.fill('#ajPlayerId', 'no-es-un-id')
  await page.click('#ajPlayGuardar')
  await page.waitForTimeout(1000)
  check('un Player ID con letras no se guarda y se dice', /solo cifras/.test(await toasts(page)) && (await tablas(page)).user_play_pokemon[0].player_id === '555', await toasts(page))
  check('  …y el campo sigue ahí para corregirlo', await page.isVisible('#ajPlayerId'))
  check('sin errores', !errores.length, errores[0])
  await page.close()
}
{
  const { page, errores } = await perfil({ sinTablas: ['user_play_pokemon'] })
  check('sin la migración, los campos quietos y el aviso', (await page.locator('#ajPlayerId').isDisabled()) && /falta ejecutar supabase-migration-play-pokemon\.sql/.test(await page.locator('#ajPlayAviso').innerText()))
  await page.fill('#ajCumple', '1999-05-20')
  await page.dispatchEvent('#ajCumple', 'change')
  await page.waitForTimeout(900)
  check('  …y el resto de la cuenta se guarda igual (el cumpleaños)', (await tablas(page)).user_profiles.find((p) => p.id === 'user-1')?.birthday === '1999-05-20', await toasts(page))
  check('sin errores', !errores.length, errores[0])
  await page.close()
}

console.log('── 8. La base: privada de verdad ──')
{
  const sql = readFileSync(`${RAIZ}/supabase-migration-play-pokemon.sql`, 'utf8')
  check('la tabla nace con RLS', /alter table public\.user_play_pokemon enable row level security/.test(sql))
  const politicas = sql.match(/create policy [\s\S]*?;/g) || []
  check('cuatro políticas, todas de la fila propia y para authenticated', politicas.length === 4 && politicas.every((p) => /to authenticated/.test(p) && /user_id = auth\.uid\(\)/.test(p)), politicas.length)
  check('  …ninguna abierta (sin «using (true)»)', !/using \(true\)/.test(sql))
  check('  …y anon sin permisos', /revoke all on public\.user_play_pokemon from anon/.test(sql))
  check('sin tablas temporales (tanda 631)', !/create (temp|temporary) table/i.test(sql))
  check('/admin la vigila', /user_play_pokemon/.test(readFileSync(`${RAIZ}/js/schema-check.js`, 'utf8')))
  // Contra PostgreSQL de verdad, si lo hay (como la 805).
  const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q']
  const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 60000 })
  if (psql(['-c', 'select 1']).status === 0) {
    psql(['-c', 'drop database if exists prueba_834'])
    psql(['-c', 'create database prueba_834'])
    const AQUI = new URL('.', import.meta.url).pathname
    // La migración DOS veces: tiene que poder volver a ejecutarse.
    for (const f of [join(AQUI, 'sql-tanda-834.sql'), `${RAIZ}/supabase-migration-play-pokemon.sql`, `${RAIZ}/supabase-migration-play-pokemon.sql`]) {
      const r = psql(['-d', 'prueba_834', '-f', f])
      check(`carga ${f.split('/').pop()}`, r.status === 0, (r.stderr || '').split('\n').find((l) => /ERROR/.test(l)) || '')
    }
    const r = psql(['-t', '-A', '-d', 'prueba_834', '-f', join(AQUI, 'sql-tanda-834-casos.sql')])
    const lineas = (r.stdout || '').split('\n').filter((l) => /^(ok|MAL) /.test(l))
    check('los casos de la base se ejecutan', r.status === 0 && lineas.length >= 8, (r.stderr || '').slice(0, 300))
    for (const l of lineas) check(l.slice(4), l.startsWith('ok'))
    psql(['-c', 'drop database if exists prueba_834'])
  } else {
    console.log('   (no hay PostgreSQL en /var/tmp:5433 — la prueba de la base NO se ha corrido aquí)')
  }
  check('el Player ID NO va en user_profiles (que es pública)', !/alter table public\.user_profiles/.test(sql) && !/player_id/.test(readFileSync(`${RAIZ}/js/perfil.js`, 'utf8').match(/const payload = \{[\s\S]*?\}/)?.[0] || ''))
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
