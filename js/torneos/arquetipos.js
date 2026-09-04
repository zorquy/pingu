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

import { dexDeCarta, dexExacto, BASE_DE_FORMA } from './sprites-pokemon.js'
import { esAntepasadoDe } from './evoluciones.js'

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
// ── Deducir el mazo cuando no hay arquetipo catalogado ──
//
// Reescrito en la tanda 261, después de que PINGU viera en el torneo
// inaugural dos nombres que no se sostenían: un mazo de Mega Lucario y
// Mega Zygarde salió como «Mega Zygarde Riolu», y un Latias/Slowking
// como «Latias ex Slowpoke». Los dos por lo mismo — la preevolución
// llevaba más copias que la carta que da nombre al mazo.
//
// Lo que había eran dos adivinanzas: una lista de nombres penalizados
// escrita a mano (que no tenía «riolu» ni «slowpoke», ni podía tenerlos
// todos) y una regla que suponía que una preevolución cae en los tres
// números anteriores de la Pokédex (Slowpoke es el 79 y Slowking el
// 199). Ahora se usa el dato de verdad, en js/torneos/evoluciones.js.
//
// ── El criterio, que es el de Limitless ──
//
// Un mazo NO se nombra por cartas sueltas sino por LÍNEAS: la línea
// Riolu → Lucario → Mega Lucario ex es una sola cosa, pesa lo que suman
// sus tres cartas y se llama por la de arriba. Así:
//
//   1. Las cartas se agrupan por línea evolutiva.
//   2. Cada línea pesa la suma de copias de sus cartas. Es lo que
//      distingue el mazo de su carta de tecnología: un Meowth ex suelto
//      pesa 1, la línea de Dragapult pesa nueve.
//   3. Cada línea se nombra por su carta MÁS EVOLUCIONADA (y, entre
//      iguales, por la que lleva ex/Mega y por la de más copias).
//   4. Se enseñan las dos líneas más pesadas. La segunda solo si llega a
//      dos cartas: por debajo de eso es tecnología, no el mazo.
function pesoDeNombre(nombre) {
  const n = String(nombre ?? '')
  if (/\bmega\b/i.test(n)) return 3
  if (/\bex\b|\bV\b|\bVMAX\b|\bVSTAR\b|\bGX\b/i.test(n)) return 2
  return 1
}

// Las líneas de Pokémon del mazo, agrupadas por familia evolutiva.
// Se agrupan por PARENTESCO y no por nombre: «Riolu», «Lucario» y «Mega
// Lucario ex» son tres nombres distintos y una sola línea.
export function agruparPorLinea(pokemon) {
  // La ESPECIE, no la forma: «Mega Lucario ex» es el 20448 en la tabla de
  // sprites (las formas viven en números altos) y Lucario es el 448. Sin
  // esto no se reconocían como la misma línea y el mazo salía como
  // «Lucario Mega Lucario ex», que es el mismo Pokémon dos veces.
  const especie = (nombre) => {
    const dex = dexDeCarta(nombre) || null
    return dex && BASE_DE_FORMA.has(dex) ? BASE_DE_FORMA.get(dex) : dex
  }
  const conDex = (pokemon || []).map((l) => ({ linea: l, dex: especie(l.name) }))
  const grupos = []
  for (const carta of conDex) {
    const suyo = grupos.find((g) =>
      g.cartas.some(
        (c) =>
          (c.dex && carta.dex && c.dex === carta.dex) ||
          esAntepasadoDe(c.dex, carta.dex) ||
          esAntepasadoDe(carta.dex, c.dex)
      )
    )
    if (suyo) suyo.cartas.push(carta)
    else grupos.push({ cartas: [carta] })
  }
  for (const g of grupos) {
    g.copias = g.cartas.reduce((n, c) => n + (Number(c.linea.quantity) || 0), 0)
    // La cabeza de la línea: la que no es antepasada de ninguna otra del
    // grupo. Entre varias (Gardevoir y Gallade salen de Kirlia), la de
    // más peso de nombre y más copias.
    const cabezas = g.cartas.filter((c) => !g.cartas.some((o) => esAntepasadoDe(c.dex, o.dex)))
    g.cabeza = (cabezas.length ? cabezas : g.cartas).sort(
      (a, b) =>
        pesoDeNombre(b.linea.name) - pesoDeNombre(a.linea.name) ||
        (Number(b.linea.quantity) || 0) - (Number(a.linea.quantity) || 0) ||
        String(a.linea.name).localeCompare(String(b.linea.name))
    )[0]
    g.peso = pesoDeNombre(g.cabeza.linea.name)
  }
  return grupos
}

// Lo que vale una línea para dar nombre al mazo: sus copias más un
// suplemento por ser una carta de las que nombran mazos. Los números
// están elegidos para que un ex de dos copias (2 + 5 = 7) aguante a un
// motor de seis cartas, y para que una línea de ocho no la adelante
// ningún ex suelto.
// ── Las cartas que NUNCA dan nombre a un mazo ──
//
// No son preevoluciones —eso ya lo resuelve el dato de evoluciones— sino
// MOTORES y utilidad: cartas de robo y de búsqueda que están en medio
// meta y no dicen a qué juega nadie. Un mazo con cuatro Bibarel no es
// «un mazo de Bibarel».
//
// Aquí sí hay una lista a mano, y a diferencia de la que había antes
// está acotada: son las cartas de UTILIDAD del formato, una docena, y no
// «todas las preevoluciones del juego», que era imposible de mantener.
// Se comparan por nombre normalizado y sin el sufijo ex/V, para que
// valga igual «Squawkabilly ex» que «Squawkabilly».
//
// Si un mazo fuera SOLO motores (no existe, pero podría llegar una lista
// a medias), se usan igualmente: mejor un nombre regular que ninguno.
// Corta a propósito: solo lo que NADIE usa para nombrar un mazo. Se
// probó con una lista más larga y se coló Pidgeot, que da nombre a
// «Charizard Pidgeot», y Munkidori, que se lo da a «Gardevoir
// Munkidori». Ante la duda, fuera de aquí: dejar un nombre regular es
// mucho menos malo que borrar del mapa un arquetipo de verdad.
const MOTORES = new Set([
  'bidoof', 'bibarel', 'lumineon', 'radiant greninja', 'squawkabilly',
  'fezandipiti', 'rotom', 'jirachi', 'lillie s clefairy',
])

function esMotor(nombre) {
  const n = normalizarNombre(nombre)
    .replace(/\b(ex|v|vmax|vstar|gx)\b/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return MOTORES.has(n)
}

function puntosDeLinea(g) {
  return g.copias + [0, 0, 5, 8][g.peso]
}

export function deducirIconos(parsed) {
  const grupos = agruparPorLinea(parsed?.pokemon || [])
  if (!grupos.length) return []

  // Las copias de la línea SUMADAS a lo que pesa su nombre, en vez de
  // uno u otro por separado. Los dos criterios solos se equivocan:
  //
  //   · Solo copias: cuatro Bibarel —un motor de robo que está en medio
  //     meta— le ganaban a dos Charizard ex.
  //   · Solo el «ex»: un Meowth ex de tecnología le ganaba a la línea
  //     entera de Dusknoir, que es media mitad del mazo.
  //
  // Sumando, una línea de ocho cartas aguanta a cualquier ex suelto y un
  // ex aguanta a cualquier motor. El desempate por nombre es lo que hace
  // que dos refrescos seguidos pinten lo mismo.
  const orden = [...grupos].sort(
    (a, b) =>
      puntosDeLinea(b) - puntosDeLinea(a) ||
      String(a.cabeza.linea.name).localeCompare(String(b.cabeza.linea.name))
  )

  // Los motores se apartan, pero no se tiran: si un mazo no tuviera otra
  // cosa, se vuelve a la lista entera.
  const sinMotores = orden.filter((g) => !esMotor(g.cabeza.linea.name))
  const buenas = sinMotores.length ? sinMotores : orden

  const primera = buenas[0]
  // Dos cartas mínimo para el segundo icono: una sola copia de algo es
  // una carta suelta, y nombrar el mazo por ella es justo el error de
  // «Dragapult ex Meowth ex».
  const segunda = buenas.slice(1).find((g) => g.copias >= 2)

  return [primera, segunda]
    .filter(Boolean)
    .map((g) => ({ set: g.cabeza.linea.set, numero: g.cabeza.linea.number, nombre: g.cabeza.linea.name }))
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

// ── La clave CANÓNICA, para que el histórico caiga junto ──
//
// El mismo enfrentamiento llegaba partido en varias casillas y ninguna
// juntaba las 3 partidas que piden «Mejor/Peor enfrentamiento»:
//
//   · Un mazo de torneo se deduce como «Dragapult ex Dusknoir» y uno
//     apuntado a mano se elige como «Dragapult» + «Dusknoir» — mismas
//     especies, claves distintas por culpa del «ex».
//   · Y si además el catálogo tiene un arquetipo con esos dos Pokémon,
//     las partidas curadas iban por su id y las demás por el nombre.
//
// La cura: del NOMBRE del mazo se sacan TODOS sus Pokémon (con
// dexExacto, trozo a trozo) y esa lista de especies —ordenada, para que
// «Dusknoir Dragapult» sea lo mismo— es la firma del mazo. Con la firma
// se busca en el catálogo ENTERO: si algún arquetipo tiene exactamente
// esos Pokémon, manda su id; si no, la firma misma es la clave.
//
// Se aplica AL AGRUPAR, no al guardar: las claves ya escritas en
// match_log se quedan como están y aquí se traducen todas al mismo
// idioma, las viejas incluidas.
export function dexesDeNombre(nombre) {
  const palabras = String(nombre ?? '').split(/\s+/).filter(Boolean)
  const dexes = []
  let i = 0
  while (i < palabras.length) {
    let casado = 0
    // Del trozo más largo al más corto, como dexDeCarta: «Teal Mask
    // Ogerpon» tiene que caer entero en su forma antes de que «Ogerpon»
    // a secas se lleve el trozo.
    for (let largo = Math.min(4, palabras.length - i); largo >= 1; largo--) {
      const dex = dexExacto(palabras.slice(i, i + largo).join(' '))
      if (dex) {
        dexes.push(dex)
        casado = largo
        break
      }
    }
    i += casado || 1
  }
  // «Ogerpon Máscara Fuente» son dos trozos —la especie y la forma— del
  // MISMO Pokémon: cuando hay una forma, su especie base sobra. Así el
  // export en español da la misma firma que el nombre en inglés.
  const basesConForma = new Set(
    dexes.filter((d) => BASE_DE_FORMA.has(d) && BASE_DE_FORMA.get(d) !== d).map((d) => BASE_DE_FORMA.get(d))
  )
  return [...new Set(dexes)].filter((d) => !basesConForma.has(d) || BASE_DE_FORMA.get(d) !== d)
}

// La firma de un arquetipo del catálogo: los Pokémon de sus iconos. Un
// arquetipo que se nombra por objetos («Martillos») no tiene firma y no
// entra en este juego — a ese solo se llega eligiéndolo por nombre.
function firmaDeIconos(iconos) {
  const dexes = (iconos || []).flatMap((i) => dexesDeNombre(i?.nombre ?? i?.name))
  return dexes.length ? [...new Set(dexes)].sort((a, b) => a - b).join('-') : null
}

export function claveCanonicaDeMazo(clave, nombre, catalogo) {
  const c = String(clave ?? '')
  if (c.startsWith('a:')) return c
  const dexes = dexesDeNombre(nombre)
  if (!dexes.length) return c || `d:${normalizarNombre(nombre)}`
  const firma = [...dexes].sort((a, b) => a - b).join('-')
  const candidatos = (catalogo || [])
    .filter((a) => a?.activo !== false && firmaDeIconos(a.iconos) === firma)
    // El mismo desempate estable que en arquetipoDelCatalogo: sin él,
    // dos arquetipos con los mismos iconos agruparían al azar.
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))
  return candidatos.length ? `a:${candidatos[0].id}` : `e:${firma}`
}
