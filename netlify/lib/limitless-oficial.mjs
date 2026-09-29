// Leer los torneos OFICIALES de limitlesstcg.com (tanda 366).
//
// Limitless publica los oficiales de Play! Pokémon (regionales,
// internacionales, especiales y el Mundial) con la clasificación y las
// listas del día 2, pero NO tiene API para ellos: la API pública es solo
// la de play.limitlesstcg.com (torneos online). Así que se lee el HTML de
// tres páginas, y su robots.txt no lo prohíbe:
//   · /tournaments            — el listado: <tr data-date data-name
//                               data-format data-players> y el enlace
//                               /tournaments/<n>.
//   · /tournaments/<n>        — la clasificación: <tr data-rank data-name
//                               data-country data-deck>, los iconos del
//                               arquetipo y el enlace /decks/list/<n>.
//   · /decks/list/<n>         — la lista: columnas con su cabecera
//                               («Pokémon (19)») y cartas con data-set,
//                               data-number, .card-count y .card-name.
// Estructura comprobada el 2026-09-29 (Regional Frankfurt, 579).
//
// Todo PURO: entra HTML, salen objetos. Si Limitless cambia su HTML, esto
// devuelve listas vacías (y la función lo dice), no basura: cada campo se
// exige y lo que no casa se descarta.

export const WEB = 'https://limitlesstcg.com'

const desescapar = (s) =>
  String(s ?? '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .trim()

function atributos(etiqueta) {
  const fuera = {}
  for (const m of etiqueta.matchAll(/data-([a-z-]+)="([^"]*)"/g)) fuera[m[1]] = desescapar(m[2])
  return fuera
}

// ── Qué es un torneo oficial ──
//
// Formato Estándar internacional (Limitless marca aparte el japonés,
// «standard-jp») y un nombre de los de Play! Pokémon. Las ligas de Corea
// o Indonesia y la Champions League japonesa juegan otro calendario de
// sets: mezclarlas daría mazos que aquí no se pueden jugar.
const OFICIAL = /\b(regional|international|world championships?|special event|naic|euic|laic|ocic)\b/i

export function tipoDeOficial(nombre) {
  const n = String(nombre || '')
  if (/world championships?/i.test(n)) return 'Mundial'
  if (/\b(naic|euic|laic|ocic|international)\b/i.test(n)) return 'Internacional'
  if (/special event/i.test(n)) return 'Especial'
  if (/regional/i.test(n)) return 'Regional'
  return null
}

export function leerListado(html) {
  const fuera = []
  for (const m of String(html || '').matchAll(/<tr\s([^>]*data-date="[^"]*"[^>]*)>([\s\S]*?)<\/tr>/g)) {
    const a = atributos(m[1])
    const id = (m[2].match(/href="\/tournaments\/(\d+)/) || [])[1]
    if (!id || !a.date || !a.name) continue
    fuera.push({
      id,
      nombre: a.name,
      fecha: a.date,
      formato: a.format || '',
      jugadores: Number(a.players) || 0,
      pais: a.country || '',
    })
  }
  return fuera
}

export function esOficial(t) {
  return t && t.formato === 'standard' && OFICIAL.test(t.nombre) && Boolean(tipoDeOficial(t.nombre))
}

// El id de arquetipo de Limitless ONLINE se parece al nombre en guiones
// («Dragapult Dusknoir» → dragapult-dusknoir), pero no siempre
// («Dragapult» es dragapult-ex). Por eso quien llama pasa el mapa de
// nombres a ids que ya conocemos y esto solo cae al guion si no está.
export function slugDeArquetipo(nombre) {
  return String(nombre || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’.]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function leerClasificacion(html) {
  const fuera = []
  for (const m of String(html || '').matchAll(/<tr\s([^>]*data-rank="[^"]*"[^>]*)>([\s\S]*?)<\/tr>/g)) {
    const a = atributos(m[1])
    const puesto = Number(a.rank)
    if (!Number.isInteger(puesto) || puesto < 1 || !a.deck) continue
    const cuerpo = m[2]
    const iconos = [...cuerpo.matchAll(/pokemon\/gen9\/([a-z0-9-]+)\.png/g)].map((x) => x[1]).slice(0, 2)
    const lista = (cuerpo.match(/href="\/decks\/list\/(\d+)/) || [])[1] || null
    const jugador = (cuerpo.match(/href="\/players\/(\d+)/) || [])[1] || null
    fuera.push({ puesto, nombre: a.name || '', pais: a.country || '', arquetipo: a.deck, iconos, lista, jugador })
  }
  return fuera
}

const SECCION_DE_CABECERA = [
  [/^pok/i, 'pokemon'],
  [/^trainer|^entrenador/i, 'trainer'],
  [/^energ/i, 'energy'],
]

export function leerLista(html) {
  const lista = { pokemon: [], trainer: [], energy: [] }
  const trozos = String(html || '').split(/class="decklist-column-heading"/).slice(1)
  for (const trozo of trozos) {
    const cabecera = desescapar((trozo.match(/^>([^<]*)</) || [])[1] || '')
    const seccion = (SECCION_DE_CABECERA.find(([r]) => r.test(cabecera)) || [])[1]
    if (!seccion) continue
    for (const c of trozo.matchAll(/<div class="decklist-card"([^>]*)>([\s\S]*?)<\/div>/g)) {
      const a = atributos(c[1])
      const count = Number((c[2].match(/class="card-count">\s*(\d+)\s*</) || [])[1])
      const name = desescapar((c[2].match(/class="card-name">([^<]*)</) || [])[1] || '')
      if (!count || !name) continue
      lista[seccion].push({ count, name, set: a.set || '', number: a.number || '' })
    }
  }
  const total = Object.values(lista).reduce((s, l) => s + l.reduce((t, x) => t + x.count, 0), 0)
  return total ? lista : null
}

// Todo junto, en la forma de la API de play.limitlesstcg.com, que es la
// que entiende `meta_ingerir_torneo`.
export function clasificacionParaIngerir(filas, listas, idDeNombre = new Map()) {
  return filas.map((f) => ({
    player: f.lista ? `lista-${f.lista}` : `puesto-${f.puesto}`,
    name: f.nombre,
    country: f.pais,
    placing: f.puesto,
    record: { wins: 0, losses: 0, ties: 0 },
    decklist: (f.lista && listas.get(f.lista)) || null,
    deck: {
      id: idDeNombre.get(f.arquetipo.toLowerCase()) || slugDeArquetipo(f.arquetipo),
      name: f.arquetipo,
      icons: f.iconos,
    },
    enlace: f.lista ? `${WEB}/decks/list/${f.lista}` : null,
  }))
}
