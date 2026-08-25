// Trae los lanzamientos desde Bulbapedia: descarga la lista de
// expansiones del TCG y saca de cada fila el nombre, la fecha y el logo.
// El /admin la llama con el botón «Importar de Bulbapedia» y rellena la
// caja de Lanzamientos para que el admin revise y guarde — la función
// solo LEE la wiki, nunca escribe en la base.
//
// ¿Por qué una función y no fetch directo desde el navegador? Porque
// Bulbapedia no manda cabeceras CORS, así que el navegador no puede
// leerla; desde aquí sí.
//
// Sin variables de entorno: no toca Supabase para nada.

const PAGINA = 'https://bulbapedia.bulbagarden.net/wiki/List_of_Pok%C3%A9mon_Trading_Card_Game_expansions'

const MESES_EN = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
}

// «September 26, 2025» → «2025-09-26». Sin fecha completa (TBA, solo
// año…), null y la fila se descarta.
export function fechaDeIngles(texto) {
  const m = /([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})/.exec(texto || '')
  if (!m) return null
  const mes = MESES_EN[m[1].toLowerCase()]
  if (!mes) return null
  return `${m[3]}-${String(mes).padStart(2, '0')}-${String(m[2]).padStart(2, '0')}`
}

function sinEntidades(t) {
  return t
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&mdash;/g, '—')
    .replace(/&amp;/g, '&')
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .trim()
}

// El nombre de la fila: el enlace más largo que no sea un fichero ni el
// tipo de expansión («Main Series Expansion», «Special Expansion»).
function nombreDeFila(fila) {
  let mejor = ''
  for (const m of fila.matchAll(/<a [^>]*href="\/wiki\/(?!File:)[^"]*"[^>]*>([^<]+)<\/a>/g)) {
    const texto = sinEntidades(m[1])
    if (/expansion|series$/i.test(texto)) continue
    if (texto.length > mejor.length) mejor = texto
  }
  // «Mega Evolution—Fuegos Fantasmales» → lo de después de la raya: en
  // la portada el nombre corto respira mejor, y la serie ya se ve en el
  // propio logo. Sin raya (el set que abre la serie), se queda entero.
  const raya = mejor.lastIndexOf('—')
  return raya > 0 ? mejor.slice(raya + 1).trim() : mejor
}

// El logo de la fila. Cuidado: la columna del símbolo TAMBIÉN es una
// imagen de archives y va antes, así que «la primera imagen» sería el
// símbolo — se prefiere la que se llama logo y, si no, una lo bastante
// ancha (los símbolos rondan los 30 px; los logos, 150+). Si la fila
// solo tiene el símbolo, mejor sin logo que con un sello diminuto.
function logoDeFila(fila) {
  const imagenes = []
  for (const m of fila.matchAll(/<img [^>]*src="([^"]*archives\.bulbagarden\.net[^"]*)"[^>]*>/g)) {
    const ancho = Number((/width="(\d+)"/.exec(m[0]) || [])[1] || 0)
    if (/logo/i.test(m[1]) || ancho >= 80) imagenes.push({ src: m[1], ancho, esLogo: /logo/i.test(m[1]) })
  }
  if (!imagenes.length) return ''
  imagenes.sort((a, b) => (b.esLogo - a.esLogo) || (b.ancho - a.ancho))
  const src = imagenes[0].src
  return src.startsWith('//') ? `https:${src}` : src
}

// Todas las filas de todas las tablas de la página, quedándonos con las
// que tienen fecha completa y nombre, desde hace ~3 meses en adelante:
// lo que /lanzamientos enseña («próximos» + «ya en tiendas» recientes).
export function parsearBulbapedia(html, hoy = new Date().toISOString().slice(0, 10)) {
  const desde = new Date(Date.parse(`${hoy}T00:00:00Z`) - 90 * 86400_000).toISOString().slice(0, 10)
  const sets = []
  const vistos = new Set()
  for (const fila of String(html).split(/<tr[\s>]/).slice(1)) {
    const fecha = fechaDeIngles(fila)
    if (!fecha || fecha < desde) continue
    const nombre = nombreDeFila(fila)
    if (!nombre) continue
    const clave = `${fecha}|${nombre.toLowerCase()}`
    if (vistos.has(clave)) continue
    vistos.add(clave)
    const imagen = logoDeFila(fila)
    sets.push({ fecha, nombre, ...(imagen ? { imagen } : {}) })
  }
  sets.sort((a, b) => (a.fecha < b.fecha ? -1 : 1))
  return sets
}

export default async function handler() {
  try {
    const res = await fetch(PAGINA, {
      headers: { 'user-agent': 'PokeDoc/1.0 (https://pokedoc.es; importador de fechas de lanzamiento)' },
    })
    if (!res.ok) throw new Error(`Bulbapedia responde ${res.status}`)
    const sets = parsearBulbapedia(await res.text())
    if (!sets.length) throw new Error('la página ha llegado pero no se ha reconocido ningún set — habrá cambiado su estructura')
    return new Response(JSON.stringify({ sets }), {
      status: 200,
      // Una hora de caché: las fechas de lanzamiento no cambian por minutos.
      headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=3600' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e.message || e) }), {
      status: 502,
      headers: { 'content-type': 'application/json' },
    })
  }
}
