// LA MESA Y EL ÁRBITRO de cada reto (tanda 1268). Lo que eligen las
// funciones del día (carta-del-dia, mas-caro, ordena-precio, que-expansion,
// quien-es) se parte en dos:
//
//   · la MESA, que va al navegador y la guarda la CDN para todo el mundo: lo
//     que se ve antes de jugar, sin una sola respuesta (ni ids con los que
//     sacarla, ni la foto nítida, ni precios);
//   · lo del ÁRBITRO, que se guarda en `retos_arbitro` (que no lee nadie) y
//     con lo que `retos_jugar` corrige cada jugada (la migración 1268).
//
// Puro salvo `guardarArbitro`: `foto(spec)` da la dirección cifrada de una
// foto (urlDeFoto con la clave), y en las pruebas es un doble que se puede
// leer.
import { cadenaDeEscaneo } from '../../js/escaneo-carta.js'
import { nombreDeCarta } from '../../js/catalogo-series.js'
import { DESENFOQUES } from '../../js/carta-del-dia.js'
import { CADENA_POR_DEX, cadenaDe } from '../../js/familias-pokemon.js'
import { urlsDelDibujo } from '../../js/quien-es.js'

const cadena = (c, calidad) => cadenaDeEscaneo(c, c?.tcg_sets?.tcg_online_code || null, calidad)
const nombres = (c) => ({ name: c?.name ?? null, name_es: c?.name_es ?? null, name_en: c?.name_en ?? null })
const setVisible = (c) => ({ name: c?.tcg_sets?.name ?? null, name_en: c?.tcg_sets?.name_en ?? null })

// Las especies de la familia de una carta (para el «casi» de la carta del
// día): las que comparten cadena evolutiva con alguna de las suyas, que es
// exactamente lo que mira `mismaFamilia`.
export function familiaDe(dexIds) {
  const cadenas = new Set((dexIds || []).map(cadenaDe).filter(Boolean))
  const fuera = []
  for (let i = 0; i < CADENA_POR_DEX.length; i++) if (cadenas.has(CADENA_POR_DEX[i])) fuera.push(i + 1)
  return fuera
}

// «¿Qué carta es?»
export function partirCarta(r, foto) {
  const c = r.carta
  const fotos = DESENFOQUES.map((px) => foto({ u: cadena(c, 'high'), e: { d: px } }))
  return {
    datos: {
      respuesta: {
        id: c.id, set_id: c.set_id ?? null, local_id: c.local_id ?? null, name: c.name ?? null,
        familia: familiaDe(c.dex_ids), serie_id: c.tcg_sets?.serie_id ?? null, release_date: c.tcg_sets?.release_date ?? null,
        types: c.types ?? null, rarity: c.rarity ?? null, rarity_en: c.rarity_en ?? null,
      },
      pistas: {
        era: c.tcg_sets?.serie_id ?? null,
        tipo: Array.isArray(c.types) ? c.types[0] ?? null : c.types ?? null,
        rareza: { rarity: c.rarity ?? null, rarity_en: c.rarity_en ?? null },
        ilustrador: c.illustrator ?? null,
        inicial: String(nombreDeCarta(c) || '?').charAt(0),
      },
      fotos,
    },
    mesa: { dia: r.dia, numero: r.numero ?? null, libre: r.libre ?? null, ayer: r.ayer ?? null, foto: fotos[0] },
  }
}

// «¿Más caro o más barato?»: las seis, sin precio; los precios, al árbitro.
export function partirCaro(r, foto) {
  return {
    datos: { precios: r.cartas.map((c) => Number(c.precio)) },
    mesa: {
      dia: r.dia, numero: r.numero ?? null, libre: r.libre ?? null,
      cartas: r.cartas.map((c) => ({ ...nombres(c), local_id: c.local_id ?? null, tcg_sets: setVisible(c), foto: foto({ u: cadena(c, 'low') }) })),
    },
  }
}

// «Ordena por precio»: cada carta con una llave que no dice nada (a, b, c,
// d en el orden en que se eligieron, que no es el del precio).
export const LLAVES = ['a', 'b', 'c', 'd']
export function partirOrdena(r, foto) {
  const cartas = r.cartas.slice(0, LLAVES.length)
  return {
    datos: { precios: Object.fromEntries(cartas.map((c, i) => [LLAVES[i], Number(c.precio)])) },
    mesa: {
      dia: r.dia, numero: r.numero ?? null, libre: r.libre ?? null,
      cartas: cartas.map((c, i) => ({ id: LLAVES[i], ...nombres(c), foto: foto({ u: cadena(c, 'low') }) })),
    },
  }
}

// «¿De qué expansión es?»: la foto (sin dirección que diga el set) y las
// cuatro opciones; la buena, al árbitro.
const opcionVisible = (s) => ({ id: s.id, name: s.name ?? null, name_en: s.name_en ?? null, release_date: s.release_date ?? null, logo_path: s.logo_path ?? null, logo_scrydex: s.logo_scrydex ?? null, logo_tcggo: s.logo_tcggo ?? null, market: s.market ?? 'WEST' })
export function partirExpansion(r, foto) {
  return {
    datos: { buenas: r.rondas.map((x) => x.set_id), opciones: r.rondas.map((x) => x.opciones.map((s) => s.id)) },
    mesa: {
      dia: r.dia, numero: r.numero ?? null, libre: r.libre ?? null,
      rondas: r.rondas.map((x) => ({ foto: foto({ u: cadena(x.carta, 'high') }), opciones: x.opciones.map(opcionVisible) })),
    },
  }
}

// «¿Quién es ese Pokémon?»: las cuatro opciones a la vista; la buena y las
// tres siluetas (borrosa, menos, nítida), al árbitro.
export function partirSilueta({ dia, numero = null, libre = null, buena, opciones }, foto) {
  const fotos = [1, 2, 3].map((s) => foto({ u: urlsDelDibujo(buena), e: { s } }))
  return { datos: { buena, opciones, fotos }, mesa: { dia, numero, libre, opciones, foto: fotos[0] } }
}

// Lo del árbitro a la base. Con la clave de servicio: `retos_arbitro` no la
// lee ni la escribe nadie más.
export async function guardarArbitro(juego, dia, datos, escribir) {
  await escribir('retos_arbitro?on_conflict=juego,day', [{ juego, day: dia, datos, updated_at: new Date().toISOString() }])
}

// La mesa de un reto y día: la guardada si ya se eligió (también las de las
// partidas libres, que así se eligen UNA vez y no cambian aunque crezca el
// catálogo: una partida a medias se corrige siempre con lo mismo), y si no,
// se elige, se parte y se guarda. `revisar` (1111) vuelve a elegir siempre.
export async function mesaDelReto({ juego, dia, revisar = false, pedir, escribir, elegir, partir }) {
  if (!revisar) {
    const g = (await pedir(`retos_arbitro?select=datos&juego=eq.${encodeURIComponent(juego)}&day=eq.${dia}&limit=1`)).datos?.[0]?.datos
    if (g?.mesa) return g.mesa
  }
  const r = await elegir()
  if (r?.error) return r
  const { datos, mesa } = partir(r)
  await guardarArbitro(juego, r.dia || dia, { ...datos, mesa }, escribir)
  return revisar ? { ...mesa, sinFoto: r.sinFoto || [] } : mesa
}
