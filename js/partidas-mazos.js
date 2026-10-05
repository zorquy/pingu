// Lo puro de enlazar una partida con un MAZO GUARDADO del constructor y de
// apuntar una partida desde una REPETICIÓN (tanda 627). Sin `supabase` ni
// DOM: lo usan /mis-partidas y /repeticiones, y las pruebas lo llaman en
// Node.
//
// PINGU: «que puedas añadir tus repeticiones a tus partidas vinculando las
// repeticiones a uno de los mazos que tienes guardados en el constructor».
import { arquetipoDeMazo, claveDeArquetipo } from './torneos/arquetipos.js'
import { normalizarNombre } from './normalizar.js'

// La sección de una carta por su categoría, que llega en inglés o en
// español según quién la escribió (TCGdex traduce el enum, tanda 334).
export function seccionDeCategoria(categoria) {
  const c = String(categoria || '').toLowerCase()
  if (/pok/.test(c)) return 'pokemon'
  if (/energ/.test(c)) return 'energy'
  return 'trainer'
}

// Un mazo guardado (`user_decks.cards`: `[{ id, n }]`) en la forma que
// leen los arquetipos (la de una decklist: `{ pokemon, trainer, energy }`
// con `{ quantity, name }`). Se cruza por el NOMBRE INGLÉS (`name`), que es
// la clave con la que se deducen los mazos (tanda 335). Las cartas que el
// catálogo ya no tiene se quedan fuera: sin nombre no dicen nada.
export function listaDeMazoGuardado(cartas, filaDe) {
  const lista = { pokemon: [], trainer: [], energy: [] }
  for (const e of Array.isArray(cartas) ? cartas : []) {
    const f = filaDe(e?.id)
    if (!f?.name) continue
    lista[seccionDeCategoria(f.category)].push({ quantity: Number(e.n) || 1, name: f.name })
  }
  return lista
}

// El arquetipo de un mazo guardado, o null si no lleva ningún Pokémon (sin
// Pokémon no hay de qué deducirlo, y uno inventado ensuciaría la matriz).
export function arquetipoDeMazoGuardado(cartas, filaDe, catalogo) {
  const lista = listaDeMazoGuardado(cartas, filaDe)
  if (!lista.pokemon.length) return null
  return arquetipoDeMazo(lista, catalogo)
}

// La clave de un mazo del que solo se sabe el NOMBRE (lo que guarda una
// repetición en `mazo_a`/`mazo_b`): el del catálogo si se llama así, y si
// no, la deducida, con la misma forma que `claveDeArquetipo`.
export function claveDeNombreDeMazo(nombre, catalogo) {
  const n = normalizarNombre(nombre || '')
  if (!n) return 'sin-mazo'
  const arq = (catalogo || []).find((a) => a?.activo !== false && normalizarNombre(a.nombre || '') === n)
  return arq ? `a:${arq.id}` : `d:${n}`
}

// El resultado DESDE quien eras: lo que diga el registro, o null (y se
// pregunta). Igual que en /repeticiones (tanda 553): un resultado
// inventado ensucia tus números.
export function resultadoDeRepeticion(rep, yo) {
  if (!yo || !rep?.ganador) return null
  return rep.ganador === yo ? 'win' : 'loss'
}

// El otro jugador de una repetición.
export function rivalDeRepeticion(rep, yo) {
  if (!rep || !yo) return null
  return rep.jugador_a === yo ? rep.jugador_b : rep.jugador_b === yo ? rep.jugador_a : null
}

// El mazo que se le vio a un jugador en la repetición.
export function mazoDeJugador(rep, jugador) {
  if (!rep || !jugador) return ''
  return (rep.jugador_a === jugador ? rep.mazo_a : rep.jugador_b === jugador ? rep.mazo_b : '') || ''
}

// La fila de `match_log` de una partida que viene de una repetición. Tu
// mazo sale del MAZO GUARDADO si se eligió uno y se puede deducir (es la
// lista entera, no lo que se llegó a ver), y si no, del que se te vio en
// la partida. `conVinculo` dice si la base ya tiene `user_deck_id`: antes
// de la migración, mandarla haría fallar el insert entero.
export function partidaDesdeRepeticion({ rep, yo, resultado, userId, catalogo = [], mazoGuardado = null, arqGuardado = null, fecha = null, donde = 'TCG Live', conVinculo = false }) {
  const rival = rivalDeRepeticion(rep, yo)
  const nombreVisto = mazoDeJugador(rep, yo)
  const nombreRival = mazoDeJugador(rep, rival)
  const mio = arqGuardado
    ? { clave: claveDeArquetipo(arqGuardado), nombre: arqGuardado.nombre }
    : { clave: claveDeNombreDeMazo(nombreVisto, catalogo), nombre: nombreVisto || 'Sin identificar' }
  const fila = {
    user_id: userId,
    mi_mazo: mio.clave,
    rival_mazo: claveDeNombreDeMazo(nombreRival, catalogo),
    mi_mazo_nombre: mio.nombre,
    rival_mazo_nombre: nombreRival || 'Sin identificar',
    resultado,
    tipo: 'normal',
    donde: donde || 'TCG Live',
    replay_id: rep.id,
  }
  if (fecha) fila.jugada_el = fecha
  if (conVinculo && mazoGuardado) fila.user_deck_id = mazoGuardado
  return fila
}

// Las repeticiones que aún no están apuntadas, la más nueva primero.
export function repeticionesSinApuntar(repeticiones, partidas) {
  const ya = new Set((partidas || []).map((p) => p.repeticion || p.replay_id).filter(Boolean))
  return (repeticiones || [])
    .filter((r) => r?.id && !ya.has(r.id))
    .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
}

// Las opciones de un desplegable de mazos guardados, con la que la fila
// YA tiene aunque no esté entre las tuyas (tanda 472: un `<select>` cuyo
// valor no está entre sus opciones se queda con la primera, y al guardar
// escribe esa).
export function opcionesDeMazosGuardados(mazos, actual = null) {
  const ops = (mazos || []).map((m) => ({ id: m.id, nombre: m.name || 'Mazo sin nombre' }))
  if (actual && !ops.some((o) => o.id === actual)) ops.push({ id: actual, nombre: 'Un mazo que ya no está en tu lista' })
  return ops
}
