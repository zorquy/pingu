// Qué mazo es este, en dos iconos (tanda 230, pedido por PINGU tras ver
// cómo lo hace Limitless): en la clasificación y en las mesas, al lado
// de cada jugador, dos cartas que dicen a qué juega sin tener que abrir
// su lista — «Dragapult Dusknoir», «Gardevoir», «Martillos».
//
// ── DÓNDE VIVE EL ARQUETIPO, Y POR QUÉ NO SE GUARDA ──
//
// No hay tabla de «arquetipo de fulano en tal torneo», a propósito. El
// arquetipo se DEDUCE de la decklist en el momento de pintarla, y eso
// hace que la regla de visibilidad sea gratis y no se pueda equivocar:
// ves el arquetipo exactamente cuando puedes ver la lista. Si la base no
// te deja leer la decklist, no hay nada de lo que deducir nada.
//
// Guardarlo en una columna habría sido más rápido de leer y mucho más
// fácil de filtrar sin querer.
//
// ── LAS DOS FORMAS DE ACERTAR ──
//
// 1. El CATÁLOGO (`tcg_archetypes`), que curan los admins: un arquetipo
//    dice cómo se llama, qué dos cartas lo representan y qué cartas
//    tiene que llevar un mazo para ser eso. Gana el más específico.
// 2. Si no casa ninguno, la DEDUCCIÓN automática: las dos líneas de
//    Pokémon más definitorias. Se equivoca a veces, pero nunca deja un
//    hueco, y marca el mazo como «sin catalogar» para que el organizador
//    sepa que ahí falta un arquetipo que añadir.
//
// El catálogo se llena así, con lo que la gente juega de verdad, en vez
// de tener que sentarse a rellenar el meta entero de una vez.

import { dexDeCarta } from './sprites-pokemon.js'

// Nombres sin tildes, sin mayúsculas y sin dobles espacios. Vive aquí y
// no se importa de tcgdex.js a propósito: este módulo NO toca la red ni
// el DOM, y así se puede probar entero en Node.
export function normalizarNombre(nombre) {
  return String(nombre ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

// Todas las líneas de un mazo en una sola lista. El arquetipo puede
// venir de un Pokémon o de un objeto (los «Martillos» son Trainer), así
// que las dos secciones cuentan. Las energías no: ninguna define un mazo.
function lineasDelMazo(parsed) {
  return [...(parsed?.pokemon || []), ...(parsed?.trainer || [])]
}

// ¿Lleva el mazo esta carta? Se acepta por número de carta o por nombre,
// y esto NO es un cinturón de más:
//
//   · El número (set + número impreso) es exacto y no depende del
//     idioma, pero se rompe con cada reimpresión.
//   · El nombre aguanta las reimpresiones, pero el export de TCG Live
//     viene en el idioma del jugador — «Boss's Orders» y «Órdenes del
//     jefe» son la misma carta. Por eso un requisito puede llevar VARIOS
//     nombres, y basta con que case uno.
export function llevaLaCarta(lineas, requisito) {
  const numero = String(requisito?.numero ?? '')
  const set = String(requisito?.set ?? '').toUpperCase()
  const nombres = (requisito?.nombres || []).map(normalizarNombre)

  return lineas.some((l) => {
    if (set && numero && String(l.set ?? '').toUpperCase() === set && String(l.number ?? '') === numero) return true
    return nombres.length > 0 && nombres.includes(normalizarNombre(l.name))
  })
}

// El arquetipo del catálogo que case, y de los que casen el MÁS
// ESPECÍFICO: «Dragapult Dusknoir» pide dos cartas y «Dragapult» solo
// una, así que un mazo con las dos tiene que salir como el primero. A
// igualdad de requisitos manda el orden alfabético del identificador,
// que no es mejor criterio pero sí uno estable: sin él, dos empates
// podrían pintarse distinto en dos refrescos seguidos.
export function arquetipoDelCatalogo(parsed, catalogo) {
  const lineas = lineasDelMazo(parsed)
  if (!lineas.length) return null

  const candidatos = (catalogo || [])
    .filter((a) => a?.activo !== false && Array.isArray(a?.requiere) && a.requiere.length > 0)
    .filter((a) => a.requiere.every((req) => llevaLaCarta(lineas, req)))

  if (!candidatos.length) return null
  candidatos.sort((a, b) => b.requiere.length - a.requiere.length || String(a.id).localeCompare(String(b.id)))
  return candidatos[0]
}

// ── La deducción automática, para lo que el catálogo no conoce ──
//
// Se puntúa cada línea de Pokémon y se cogen las dos mejores. Los pesos
// salen de mirar cómo se nombran los mazos de verdad, no de ninguna
// regla del juego:
//
//   · Un ex/V/VMAX/VSTAR es casi siempre el nombre del mazo.
//   · Cuantas más copias, más central (un 4-de manda sobre un 1-de).
//   · Las líneas de evolución básicas (Ralts, Kirlia) NO dan nombre al
//     mazo: se llama Gardevoir, no Ralts. Se penalizan por nombre,
//     porque el espejo de cartas no siempre sabe la fase.
const PENALIZADOS = /^(ralts|kirlia|dreepy|drakloak|duskull|dusclops|charmander|charmeleon|applin|dipplin|budew|fezandipiti|munkidori|squawkabilly|lumineon|bloodmoon)$/i

function puntuarLinea(l) {
  const nombre = String(l.name ?? '')
  let puntos = Number(l.quantity) || 0
  if (/\bex\b|\bV\b|\bVMAX\b|\bVSTAR\b|\bGX\b/i.test(nombre)) puntos += 10
  if (PENALIZADOS.test(normalizarNombre(nombre).split(' ')[0])) puntos -= 12
  return puntos
}

export function deducirIconos(parsed) {
  const pokemon = [...(parsed?.pokemon || [])]
  if (!pokemon.length) return []
  const puntuadas = pokemon
    .map((l) => ({ linea: l, puntos: puntuarLinea(l) }))
    // El desempate por nombre es lo que hace que dos refrescos pinten lo
    // mismo: sin él, el orden lo decidiría el del export.
    .sort((a, b) => b.puntos - a.puntos || String(a.linea.name).localeCompare(String(b.linea.name)))

  // Los básicos de una línea de evolución NO dan nombre a un mazo, así
  // que se descartan del todo en vez de conformarse con que queden los
  // últimos. Un mazo de Gardevoir se llama «Gardevoir», no «Gardevoir
  // Ralts» — y eso es lo que salía cuando la lista solo tenía dos
  // líneas de Pokémon y entraban las dos por narices.
  //
  // Si al filtrar no queda NADA (un mazo entero de básicos, que
  // existen), se vuelve a la lista sin filtrar: mejor un nombre regular
  // que ninguno.
  const buenas = puntuadas.filter((x) => x.puntos > 0)
  const candidatas = buenas.length ? buenas : puntuadas
  const primera = candidatas[0]
  if (!primera) return []

  // ── El segundo icono es el que se equivoca ──
  //
  // Con una lista de verdad (la de PINGU del 2026-09-01) salía
  // «Dragapult ex Meowth ex»: Meowth ex era UNA copia, una carta de
  // tecnología que nadie usa para nombrar un mazo. Y quitándola salía
  // «Dragapult ex Drakloak», que es peor: Drakloak es la evolución
  // intermedia del mismo Pokémon.
  //
  // Dos reglas, y la segunda es la interesante:
  //
  //   1. Una sola copia es una carta suelta, no el nombre del mazo.
  //   2. La PREEVOLUCIÓN de lo que ya hemos elegido tampoco: en la
  //      Pokédex, una preevolución está justo debajo de su evolución
  //      (Dreepy 885, Drakloak 886, Dragapult 887). Se descartan los
  //      tres números anteriores al del primer icono.
  //
  // Es una regla aproximada —hay líneas que no van seguidas, como
  // Dusclops y Dusknoir— pero se apoya en un dato de verdad en vez de
  // en una lista de nombres escrita a mano, que habría que ampliar cada
  // temporada.
  //
  // Si tras filtrar no queda ningún segundo digno, se enseña UN SOLO
  // icono. Un mazo de un solo Pokémon se llama por ese Pokémon.
  const dexPrimera = dexDeCarta(primera.linea.name)
  const segunda = candidatas.slice(1).find((x) => {
    if ((Number(x.linea.quantity) || 0) < 2) return false
    const dex = dexDeCarta(x.linea.name)
    if (dexPrimera && dex && dex < dexPrimera && dex >= dexPrimera - 3) return false
    return true
  })

  return [primera, segunda]
    .filter(Boolean)
    .map(({ linea }) => ({ set: linea.set, numero: linea.number, nombre: linea.name }))
}

// El nombre que se enseña cuando no hay arquetipo catalogado: los dos
// Pokémon deducidos, tal cual. «Dragapult ex Dusknoir» no es el nombre
// bonito, pero dice más que «Desconocido».
function nombreDeducido(iconos) {
  return iconos.map((i) => i.nombre).filter(Boolean).join(' ') || 'Sin identificar'
}

// LA función de este módulo. Devuelve siempre algo: un mazo sin
// arquetipo conocido sale deducido y marcado con `curado: false`, que es
// la señal de que al catálogo le falta una entrada.
export function arquetipoDeMazo(parsed, catalogo) {
  const delCatalogo = arquetipoDelCatalogo(parsed, catalogo)
  if (delCatalogo) {
    return {
      id: delCatalogo.id,
      nombre: delCatalogo.nombre,
      iconos: (delCatalogo.iconos || []).slice(0, 2),
      curado: true,
    }
  }
  const iconos = deducirIconos(parsed)
  return { id: null, nombre: nombreDeducido(iconos), iconos, curado: false }
}

// Para el registro de partidas y para agrupar: dos mazos son el mismo
// enfrentamiento si tienen la misma clave. Un arquetipo catalogado se
// agrupa por su id (aunque le cambien el nombre); uno deducido, por su
// nombre — que es lo único estable que tiene.
export function claveDeArquetipo(arq) {
  if (!arq) return 'sin-mazo'
  return arq.id ? `a:${arq.id}` : `d:${normalizarNombre(arq.nombre)}`
}
