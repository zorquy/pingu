// PARA CARDMARKET (tanda 1459): lo que buscas, como lista para pegar en tus
// Wants, y lo que das, como CSV con el id de producto de cada carta.
//
// Ibai: «exportar mi Cardmarket para que aparezcan las que cambio y las
// faltantes de mis colecciones… ponerlo como las que busco». TheHobbyClub lo
// hace y un usuario venía de allí.
//
// ── EL FORMATO DE LOS WANTS ──
//
// Cardmarket deja pegar una lista en una lista de deseos («Add Decklist»,
// help.cardmarket.com/en/how-to-add-a-pkmn-decklist-to-wants): una carta por
// línea, «2x Umbreon EX Moon Mirage Onyx» — el nombre EN INGLÉS seguido de
// sus habilidades y ataques. Un Pokémon con solo el nombre NO entra («2x
// Umbreon would not work»); un Entrenador o una Energía, sí («Scoop Up Net»
// da cualquier versión). Por eso aquí un Pokémon sin sus ataques en inglés no
// se escribe: se devuelve aparte para buscarlo a mano, en vez de pegar una
// línea que Cardmarket va a rechazar o, peor, casar con otra carta.
//
// Sin DOM y sin Supabase: se prueba en Node.

export const esPokemon = (category) => ['Pokemon', 'Pokémon'].includes(category)

// El nombre sin los ataques entre corchetes de Cardmarket («Arceus VSTAR
// [Trinity Nova | Starbirth]») ni espacios de más.
const limpio = (t) => String(t || '').replace(/\s*\[[^\]]*\]/g, '').replace(/\s+/g, ' ').trim()

// Una línea. `ataques` son los nombres en inglés, habilidades primero (como
// los escribe Cardmarket: «Zacian V [Intrepid Sword | Brave Blade]»).
export function lineaParaCardmarket({ cantidad = 1, nombre, ataques = [], pokemon = false } = {}) {
  const n = limpio(nombre)
  if (!n) return null
  const extra = (ataques || []).map(limpio).filter(Boolean)
  if (pokemon && !extra.length) return null
  return `${Math.max(1, Math.round(Number(cantidad) || 1))}x ${[n, ...extra].join(' ')}`
}

// La lista entera. `filas`: { card_id, cantidad, nombre (inglés), ataques,
// pokemon }. La misma carta dos veces (en dos idiomas, dos versiones) es una
// línea: en Cardmarket el idioma y la versión se eligen en la lista, no al
// pegar. Devuelve el texto, cuántas líneas y lo que no se ha podido escribir.
export function textoDeWants(filas) {
  const porCarta = new Map()
  for (const f of filas || []) {
    if (!f?.card_id) continue
    const ya = porCarta.get(f.card_id)
    if (ya) ya.cantidad = Math.max(ya.cantidad, Number(f.cantidad) || 1)
    else porCarta.set(f.card_id, { ...f, cantidad: Number(f.cantidad) || 1 })
  }
  // Y dos cartas que en Cardmarket se escriben igual (la Acerola normal y la
  // de arte completo: mismo nombre, mismo texto) son una línea con las copias
  // sumadas: al pegarla, Cardmarket deja elegir la versión.
  const porTexto = new Map()
  const sinDatos = []
  for (const f of porCarta.values()) {
    const l = lineaParaCardmarket({ ...f, cantidad: 1 })
    if (!l) {
      sinDatos.push(f)
      continue
    }
    const texto = l.replace(/^\d+x /, '')
    porTexto.set(texto, Math.min(99, (porTexto.get(texto) || 0) + Math.max(1, Math.round(Number(f.cantidad) || 1))))
  }
  const lineas = [...porTexto].map(([texto, n]) => `${n}x ${texto}`)
  return { texto: lineas.join('\n'), lineas: lineas.length, sinDatos }
}

// Los nombres en inglés de una carta del catálogo, o null si no se saben:
// lo guardado si la ficha está en inglés, y si no lo que diga TCGdex en
// inglés (`ingles`, { name, attacks, abilities }). Un Entrenador o una
// Energía solo necesitan el nombre.
export function datosEnIngles(carta, ingles = null) {
  if (!carta) return null
  const pokemon = esPokemon(carta.category)
  const nombres = (l) => (Array.isArray(l) ? l.map((x) => x?.name).filter(Boolean) : [])
  const guardadoEnIngles = carta.detalle_lang === 'en'
  const nombre = carta.name_en || (guardadoEnIngles ? carta.name : null) || ingles?.name || null
  if (!pokemon) return nombre ? { nombre, ataques: [], pokemon } : null
  const ataques = guardadoEnIngles && nombres(carta.attacks).length
    ? [...nombres(carta.abilities), ...nombres(carta.attacks)]
    : ingles
      ? [...nombres(ingles.abilities), ...nombres(ingles.attacks)]
      : []
  return nombre && ataques.length ? { nombre, ataques, pokemon } : null
}

// A quién hay que preguntar a TCGdex: lo que no tiene sus datos en inglés
// guardados y tiene un id que TCGdex conoce (no los de TCGGO ni los a mano).
export const idDeTcgdex = (id) => (id && !/^(tcggo|mano)-/.test(id) ? id : null)
export function faltaPreguntar(carta) {
  if (!carta || !idDeTcgdex(carta.id)) return false
  return !datosEnIngles(carta)
}

// La consulta a TCGdex (GraphQL) para un trozo de ids: un alias por carta.
export function consultaDeTcgdex(ids) {
  const campos = 'name attacks { name } abilities { name }'
  return `{ ${ids.map((id, i) => `c${i}: card(id: ${JSON.stringify(id)}) { ${campos} }`).join(' ')} }`
}

// ── LO QUE DAS ──
//
// Un CSV con el id de producto de Cardmarket de cada carta y lo que hace
// falta para ponerla a la venta (nombre en inglés, expansión, número, idioma,
// estado y si es foil). Lo vuelve a leer el importador de esta misma página
// («Adónde van → para cambio»), así que sirve también para llevar tus cambios
// de una cuenta a otra.
const IDIOMA_CM = { es: 'Spanish', en: 'English', fr: 'French', de: 'German', it: 'Italian', pt: 'Portuguese', ja: 'Japanese', ko: 'Korean', zh: 'Chinese' }
const CABECERA_DOY = ['idProduct', 'Count', 'Name', 'Expansion', 'Number', 'Language', 'Condition', 'isFoil', 'Comments']
const celda = (v) => {
  const s = v === null || v === undefined ? '' : String(v)
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
export function csvDeLoQueDoy(filas) {
  const out = [CABECERA_DOY]
  for (const { linea: l, carta: c } of filas || []) {
    if (!l || !c) continue
    out.push([
      c.cm_id_product_propio || '',
      Number(l.cambio) || Number(l.cantidad) || 1,
      c.name_en || c.name || '',
      c.tcg_sets?.name_en || c.tcg_sets?.name || c.set_id || '',
      c.local_id || '',
      IDIOMA_CM[l.idioma] || l.idioma || '',
      l.estado || 'NM',
      l.variante === 'reverse' ? 'true' : '',
      l.gradeo || '',
    ])
  }
  return out.map((f) => f.map(celda).join(',')).join('\r\n') + '\r\n'
}
