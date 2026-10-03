// De la respuesta de TCGdex a las filas de `tcg_sets` y `tcg_cards`
// (tanda 471). Sin una sola dependencia del navegador a propósito.
//
// ── Por qué este fichero existe ──
//
// Todo esto vivía en `js/tcgdex.js`, que importa `./supabase.js` y por
// tanto no se puede arrastrar a una función de Netlify. El resultado
// fueron COPIAS A MANO en `netlify/lib/carta-detalle.mjs`: el mapa de
// idiomas, `fechaDeSet` y `codigoLiveDeSet`, las tres vigiladas por una
// prueba que compara los dos textos. Y esa prueba se separó ella sola —
// llevaba desde la tanda 438 leyendo `js/tcgdex.js` en busca de un mapa
// que se había mudado a `js/mercados.js`, encontrando CERO claves y
// comparando contra un objeto vacío (se vio en la 447).
//
// La lección es la de siempre, una vuelta más: una copia vigilada es
// mejor que una copia a secas, pero **no copiar es mejor que las dos**.
// Estas seis funciones son puras, no tocan red ni base, y ahora las
// importan los dos lados: el navegador por `js/tcgdex.js`, que las
// reexporta, y el servidor por `netlify/lib/carta-detalle.mjs`.

import { MERCADO_POR_DEFECTO } from './mercados.js'
import { imagePathFromUrl } from './carta-detalle.js'

// Vale como fecha de Postgres, o null. TCGdex las da como "2020-08-14";
// algunas antiguas vienen vacías o a medias, y una cadena rara tumbaría
// la fila entera (no la columna: la FILA).
function fecha(valor) {
  return /^\d{4}-\d{2}-\d{2}$/.test(valor || '') ? valor : null
}

// La fecha de salida de un set, validada.
//
// OJO: solo viene en el set COMPLETO (`sets/<id>`), no en el LISTADO —
// el listado devuelve un «SetResume» y ese campo no está. Se descubrió
// en la tanda 322 con `release_date` a null en los 220 sets: no daba
// error, simplemente la columna existía vacía, y sin ella no se puede
// ordenar el catálogo por lo más reciente.
export function fechaDeSet(set) {
  return fecha(set?.releaseDate)
}

// El código de TCG Live de un set, normalizado.
//
// Comprobado contra los tipos del SDK oficial (@tcgdex/sdk):
// `Set.tcgOnline?: string`. Está en el Set completo, no en SetResume.
// OJO CON EL NOMBRE DEL CAMPO (tanda 345): `tcgOnline` es el código de
// Pokémon TCG **Online**, la plataforma vieja, que cerró en 2023 — y
// TCGdex dejó de rellenarlo entonces. Para todo lo posterior viene
// vacío, así que esta función devuelve null y NO es un fallo suyo: el
// dato no existe arriba. Los códigos de TCG **Live** (PBL, SSP, TWM…)
// salen de una lista curada a mano.
export function codigoLiveDeSet(set) {
  const bruto = set?.tcgOnline
  if (typeof bruto !== 'string') return null
  const limpio = bruto.trim().toUpperCase()
  // De dos a seis letras o números. Cualquier otra cosa no es un código
  // y no se guarda: un valor raro aquí traduce una decklist a la carta
  // equivocada.
  return /^[A-Z0-9]{2,6}$/.test(limpio) ? limpio : null
}

export function setToRow(set, market = MERCADO_POR_DEFECTO) {
  const fila = {
    id: set.id,
    market,
    name: set.name || set.id,
    // La SERIE no va aquí tal cual: `setToRow` corre normalmente sobre
    // el LISTADO y allí no está (es un «SetResume»). Escribirla desde
    // ahí ponía null en los 210 sets y, al reimportar, BORRARÍA la que
    // la tarea programada acaba de curar. Se pone abajo, y solo si llega.
    logo_path: imagePathFromUrl(set.logo),
    symbol_url: set.symbol || null,
    release_date: fecha(set.releaseDate),
    card_count_total: set.cardCount?.total ?? null,
    card_count_official: set.cardCount?.official ?? null,
  }
  // Lo mismo con el código y la fecha: solo si vienen. Los tres son del
  // set COMPLETO, y los tres se escriben cuando se importan las cartas
  // de un set (que es cuando se tiene el completo en la mano) o cuando
  // los cura la función programada.
  const codigo = codigoLiveDeSet(set)
  if (codigo) fila.tcg_online_code = codigo
  if (set.serie?.id) fila.serie_id = set.serie.id
  if (set.serie?.name) fila.serie_name = set.serie.name
  return fila
}

// El listado de cartas de un set trae poco: id, localId, name e image.
// Basta para el buscador y para llenar el álbum. Los campos de
// tipo/rareza se quedan a null A PROPÓSITO — traerlos exige UNA
// PETICIÓN POR CARTA (~23.000 contra un catálogo comunitario y gratuito,
// frente a las ~220 de importar el catálogo entero). No es un olvido, es
// un coste, y se reparte en la función programada `cartas-detalle`.
export function cardToRow(card, setId, market = MERCADO_POR_DEFECTO) {
  return {
    id: card.id,
    set_id: setId,
    market,
    local_id: String(card.localId ?? ''),
    name: card.name || card.id,
    image_path: imagePathFromUrl(card.image),
  }
}

// Quita filas repetidas por su clave, dejando la PRIMERA.
//
// Hace falta porque el catálogo de TCGdex trae repetidos. El chino
// simplificado devuelve 57 sets con 56 identificadores distintos: uno
// viene dos veces. Con los dos en la misma sentencia, Postgres corta con
// «ON CONFLICT DO UPDATE command cannot affect row a second time», que
// es su forma de decir que no sabe cuál de los dos debe ganar.
//
// No se puede dar por hecho que sea sólo ese: el catálogo lo mantiene
// gente y cambia. Así que se limpia siempre, y se dice cuántos se han
// caído para que no pase desapercibido.
export function sinDuplicados(filas, claves) {
  const vistas = new Set()
  const limpias = []
  let repetidas = 0
  for (const f of filas) {
    const clave = claves.map((c) => f[c]).join('\u0000')
    if (vistas.has(clave)) {
      repetidas++
      continue
    }
    vistas.add(clave)
    limpias.push(f)
  }
  return { filas: limpias, repetidas }
}

// ── Las filas que traen foto y las que no, por separado (tanda 487) ──
//
// `cardToRow` pone `image_path: null` cuando la API se calla el campo. Y
// se lo calla en MILES de cartas asiáticas cuyo fichero SÍ está publicado
// en su servidor de imágenes: medido el 2026-10-03, en japonés la API dice
// 3.882 con imagen y existen 7.365.
//
// Esos null son inofensivos al INSERTAR —la columna nace vacía igual— y
// destructivos al REIMPORTAR: las dos importaciones escriben con
// `merge-duplicates`, así que un null PISA una foto que ya estuviera
// guardada. O sea que «importar los que faltan» o «reimportar un set»
// borraría todo lo que se haya encontrado buscando el fichero a mano, y
// **no daría ningún error**: la carta se queda sin foto y además marcada
// como ya mirada.
//
// Y no vale con omitir la clave y ya: PostgREST exige que todos los
// objetos de UNA sentencia tengan LAS MISMAS claves, así que son dos
// sentencias — las que traen foto la escriben, y las que no, no la
// mencionan. Una columna que no se menciona no se toca.
//
// Lo mismo valdría para cualquier otra columna que rellene alguien de
// fuera de la importación: si la API la deja a null y otro la cura, la
// importación no puede mandarla.
export function porImagen(filas) {
  const con = []
  const sin = []
  for (const f of filas || []) {
    if (!f) continue
    if (f.image_path) {
      con.push(f)
      continue
    }
    const { image_path: _fuera, ...resto } = f
    void _fuera
    sin.push(resto)
  }
  return { con, sin }
}
