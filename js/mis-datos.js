// «Descargar mis datos» (tanda 1314, S11): todo lo tuyo en un ZIP, hecho en
// tu navegador. Cada tabla se pide con tu sesión, así que la base solo da lo
// que ya puedes ver (lo tuyo); nada pasa por un servidor nuestro y no gasta
// funciones de Netlify. Un JSON por tabla, tu colección también en CSV y un
// LEEME.txt con lo que hay y lo que no se ha podido leer.
//
// El ZIP va «guardado» (sin comprimir): escribirlo son veinte líneas sin
// ninguna librería, y lo abre cualquier sistema.

// (tabla, columna con tu id). Lo que no exista o no deje leer se apunta en el
// LEEME y se sigue.
export const TABLAS_MIAS = [
  ['user_privado', 'user_id'], ['user_collection', 'user_id'], ['user_collection_value', 'user_id'],
  ['user_wants', 'user_id'], ['user_want_lists', 'user_id'], ['user_want_list_items', 'user_id'],
  ['user_products', 'user_id'], ['user_albums', 'user_id'], ['user_decks', 'user_id'],
  ['user_direcciones', 'user_id'], ['user_cobros', 'user_id'], ['user_cumple', 'user_id'],
  ['user_follows', 'follower_id'], ['user_price_alerts', 'user_id'], ['user_release_alerts', 'user_id'],
  ['user_showcase', 'user_id'], ['user_play_pokemon', 'user_id'],
  ['match_log', 'user_id'], ['match_log_torneos', 'user_id'], ['match_log_ajustes', 'user_id'],
  ['forum_threads', 'author_id'], ['forum_posts', 'author_id'], ['guide_comments', 'author_id'],
  ['guide_suggestions', 'author_id'], ['guide_requests', 'requester_id'], ['profile_comments', 'author_id'],
  ['private_messages', 'sender_id'], ['trade_offers', 'de'], ['trade_offers', 'para'],
  ['trade_confirmations', 'user_a'], ['trade_confirmations', 'user_b'],
  ['tournament_registrations', 'user_id'], ['tournament_decklists', 'user_id'],
  ['retos_partidas', 'user_id'], ['daily_challenge_results', 'user_id'], ['course_attempts', 'user_id'],
  ['evento_asistentes', 'user_id'], ['user_notifications', 'recipient_id'], ['content_reports', 'reporter_id'],
  ['account_deletion_requests', 'user_id'],
]

const POR_PAGINA = 1000

async function todasLasFilas(supabase, tabla, columna, uid) {
  const filas = []
  for (let desde = 0; ; desde += POR_PAGINA) {
    const { data, error } = await supabase.from(tabla).select('*').eq(columna, uid).range(desde, desde + POR_PAGINA - 1)
    if (error) return { error }
    filas.push(...(data || []))
    if (!data || data.length < POR_PAGINA) return { filas }
  }
}

// Una lista de objetos a CSV (con las columnas de todos).
export function aCsv(filas) {
  const cols = [...new Set(filas.flatMap((f) => Object.keys(f)))]
  const celda = (v) => {
    const t = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v)
    return /[",\n;]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t
  }
  return [cols.join(','), ...filas.map((f) => cols.map((c) => celda(f[c])).join(','))].join('\n')
}

// ── El ZIP (método «stored») ──
let tablaCrc = null
export function crc32(bytes) {
  if (!tablaCrc) {
    tablaCrc = new Uint32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      tablaCrc[n] = c >>> 0
    }
  }
  let c = 0xffffffff
  for (let i = 0; i < bytes.length; i++) c = tablaCrc[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

// [{ nombre, texto }] → Uint8Array con el ZIP.
export function zip(ficheros, fecha = new Date()) {
  const enc = new TextEncoder()
  const hora = ((fecha.getHours() << 11) | (fecha.getMinutes() << 5) | (fecha.getSeconds() >> 1)) & 0xffff
  const dia = (((fecha.getFullYear() - 1980) << 9) | ((fecha.getMonth() + 1) << 5) | fecha.getDate()) & 0xffff
  const partes = []
  const central = []
  let offset = 0
  for (const f of ficheros) {
    const nombre = enc.encode(f.nombre)
    const datos = enc.encode(f.texto)
    const crc = crc32(datos)
    const cab = new DataView(new ArrayBuffer(30))
    cab.setUint32(0, 0x04034b50, true); cab.setUint16(4, 20, true); cab.setUint16(6, 0x0800, true)
    cab.setUint16(8, 0, true); cab.setUint16(10, hora, true); cab.setUint16(12, dia, true)
    cab.setUint32(14, crc, true); cab.setUint32(18, datos.length, true); cab.setUint32(22, datos.length, true)
    cab.setUint16(26, nombre.length, true); cab.setUint16(28, 0, true)
    partes.push(new Uint8Array(cab.buffer), nombre, datos)
    const cen = new DataView(new ArrayBuffer(46))
    cen.setUint32(0, 0x02014b50, true); cen.setUint16(4, 20, true); cen.setUint16(6, 20, true); cen.setUint16(8, 0x0800, true)
    cen.setUint16(10, 0, true); cen.setUint16(12, hora, true); cen.setUint16(14, dia, true)
    cen.setUint32(16, crc, true); cen.setUint32(20, datos.length, true); cen.setUint32(24, datos.length, true)
    cen.setUint16(28, nombre.length, true); cen.setUint32(42, offset, true)
    central.push(new Uint8Array(cen.buffer), nombre)
    offset += 30 + nombre.length + datos.length
  }
  const tamCentral = central.reduce((s, p) => s + p.length, 0)
  const fin = new DataView(new ArrayBuffer(22))
  fin.setUint32(0, 0x06054b50, true); fin.setUint16(8, ficheros.length, true); fin.setUint16(10, ficheros.length, true)
  fin.setUint32(12, tamCentral, true); fin.setUint32(16, offset, true)
  const todo = [...partes, ...central, new Uint8Array(fin.buffer)]
  const salida = new Uint8Array(todo.reduce((s, p) => s + p.length, 0))
  let i = 0
  for (const p of todo) { salida.set(p, i); i += p.length }
  return salida
}

// Lo arma todo. `avance(texto)` dice por dónde va. Devuelve { bytes, resumen }.
export async function prepararMisDatos(supabase, uid, avance = () => {}) {
  const ficheros = []
  const leidas = []
  const sinLeer = []
  avance('Tu cuenta…')
  const { data: cuenta } = await supabase.auth.getUser()
  const u = cuenta?.user
  ficheros.push({ nombre: 'cuenta.json', texto: JSON.stringify({ id: u?.id, email: u?.email, creada: u?.created_at, ultima_entrada: u?.last_sign_in_at, proveedores: u?.app_metadata?.providers, datos: u?.user_metadata }, null, 2) })
  const { data: perfil } = await supabase.from('user_profiles').select('*').eq('id', uid).maybeSingle()
  ficheros.push({ nombre: 'perfil.json', texto: JSON.stringify(perfil || {}, null, 2) })
  for (const [tabla, columna] of TABLAS_MIAS) {
    avance(`Leyendo ${tabla}…`)
    const r = await todasLasFilas(supabase, tabla, columna, uid)
    const nombre = TABLAS_MIAS.filter(([t]) => t === tabla).length > 1 ? `${tabla}-${columna}` : tabla
    if (r.error) { sinLeer.push(`${nombre}: ${r.error.message || r.error.code || 'no se ha podido leer'}`); continue }
    if (!r.filas.length) continue
    leidas.push(`${nombre}: ${r.filas.length}`)
    ficheros.push({ nombre: `${nombre}.json`, texto: JSON.stringify(r.filas, null, 2) })
    if (tabla === 'user_collection') ficheros.push({ nombre: 'coleccion.csv', texto: aCsv(r.filas) })
  }
  const hoy = new Date().toISOString().slice(0, 10)
  ficheros.unshift({
    nombre: 'LEEME.txt',
    texto: [`Tus datos de PokeDoc, a ${hoy}.`, '', 'Un fichero JSON por cada cosa tuya que guarda la web, y tu colección también en CSV (se abre con Excel o con Hojas de cálculo).', '', 'Lo que hay:', ...leidas.map((l) => `  · ${l}`), '', sinLeer.length ? ['Lo que no se ha podido leer (puede que no exista todavía en la web):', ...sinLeer.map((l) => `  · ${l}`)].join('\n') : 'Se ha podido leer todo.', '', 'Tus mensajes privados son los que tú enviaste; las fotos de los mensajes no van dentro (son enlaces que caducan).', 'Dudas: info@pokedoc.es.'].join('\n'),
  })
  avance('Empaquetando…')
  return { bytes: zip(ficheros), resumen: { leidas, sinLeer } }
}
