// Plegar texto para buscar: sin acentos y en minúsculas.
//
// Nadie escribe los acentos en un buscador. "falsificacion" tiene que
// encontrar "falsificación", y "jesus" a "Jesús".
//
// El equivalente en la base de datos es `public.plegar_texto()`, de
// supabase-migration-busqueda-acentos.sql. LOS DOS TIENEN QUE PLEGAR
// IGUAL: si aquí se quitan los acentos y allí no (o al revés), el
// buscador deja de encontrar cosas y no da ningún error que lo delate.
//
// Cómo funciona: normalize('NFD') separa cada letra acentuada en dos
// caracteres, la letra y la tilde suelta; después se tiran las tildes.
// Así se cubren todas de golpe, sin listas de letras. La ñ se pliega a n,
// igual que hace `unaccent` en Postgres.
//
// El rango U+0300–U+036F es el bloque Unicode de las marcas diacríticas
// que la descomposición deja sueltas.
const TILDES = /[\u0300-\u036f]/g

export function plegarTexto(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(TILDES, '')
    .toLowerCase()
}

// Igual que plegarTexto, pero además devuelve un mapa para volver del
// texto plegado al original.
//
// Hace falta para resaltar el trozo encontrado: la búsqueda pasa por el
// texto plegado, pero lo que se le enseña a la persona es el original,
// con sus acentos. Y las posiciones NO coinciden por las bravas: la
// normalización puede cambiar la longitud (una é son dos caracteres en
// NFD) y hay caracteres que ocupan dos posiciones en JavaScript (los
// emojis). Con el mapa, `mapa[i]` es la posición en el original del
// carácter i del plegado.
export function plegarConMapa(texto) {
  const original = String(texto ?? '')
  let plegado = ''
  const mapa = []
  for (let i = 0; i < original.length; i++) {
    const pieza = original[i].normalize('NFD').replace(TILDES, '').toLowerCase()
    for (const c of pieza) {
      plegado += c
      mapa.push(i)
    }
  }
  // Una posición más al final, para poder pedir dónde termina una
  // coincidencia que llega hasta el borde.
  mapa.push(original.length)
  return { plegado, mapa }
}

// Atajo para los filtros que se hacen en el navegador sobre una lista ya
// cargada (el directorio de la comunidad, por ejemplo).
export function contienePlegado(texto, consultaPlegada) {
  if (!consultaPlegada) return true
  return plegarTexto(texto).includes(consultaPlegada)
}

// ── Lo que Postgres guarda en `name_search` y `name_key` ──
//
// Las dos son columnas GENERADAS de `tcg_cards`
// (supabase-migration-cartas-nombre-es.sql) y las dos se calculan con
// `immutable_unaccent(lower(...))`. Vive aquí, y no en `js/tcgdex.js`,
// porque este fichero no importa nada: así lo puede usar también el doble
// de Supabase de las pruebas, que ES `js/supabase.js` y no puede
// depender de quien depende de él.
//
// Y la misma función se le aplica a lo que SE TECLEA, que es el punto: si
// no, quien escriba "pomez" no encontraría "Piedra Pómez" — y con 1.159
// cartas acentuadas en el catálogo, eso pasa constantemente.
export function normalizeSearch(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // unaccent() de Postgres tambien convierte la puntuacion tipografica
    // a su equivalente ASCII, y JS no. Sin esto, 31 cartas con apostrofo
    // curvo ("Farfetch\u2019d", "Rocket\u2019s Mewtwo") quedaban guardadas con
    // apostrofo recto e imposibles de encontrar. Se comprobo comparando
    // las 23.505 cartas reales contra un Postgres de verdad.
    .replace(/[\u2018\u2019\u02bc]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    // Y las letras y signos que no son "letra + tilde" y por tanto NFD no
    // descompone: la ligadura de "Fundacion \u00c6ther" y la apertura de
    // interrogacion y exclamacion, que en espanol salen constantemente.
    .replace(/\u00e6/g, 'ae').replace(/\u00c6/g, 'AE')
    .replace(/\u0153/g, 'oe').replace(/\u0152/g, 'OE')
    .replace(/\u00df/g, 'ss')
    .replace(/\u00bf/g, '?').replace(/\u00a1/g, '!')
    .replace(/[\u00f8\u00d8]/g, 'o')
    // ── Y SE VUELVE A COMPONER (tanda 557) ──
    //
    // El `NFD` de arriba está para separar «letra + tilde» y poder tirar la
    // tilde. Pero NFD **también descompone el kana**: ギ se parte en キ +
    // ゙ (U+3099) y ダ en タ + ゙ — y ese signo NO está en el rango
    // \u0300-\u036f, así que no se tira: se queda. O sea que una búsqueda
    // japonesa salía con DOS puntos de código donde la base tiene UNO.
    //
    // Y la base no descompone nada: `unaccent()` no toca el kana, así que
    // `name_search` guarda la forma compuesta tal como la manda el
    // catálogo. Un `like '%フシギダネ%'` contra «フシギダネ» no casa JAMÁS
    // — y no da error, da cero resultados. Como casi todos los nombres
    // japoneses llevan alguna sonora (ギ, ダ, ピ, ベ…), **la búsqueda
    // japonesa entera no encontraba nada**, ni tecleada ni por el escáner.
    //
    // NFC y no NFKC a propósito: esto tiene que hacer LO MISMO que Postgres
    // y nada más. NFKC cambiaría además la anchura media, los números en
    // círculo y las ligaduras, que la base no cambia — y entonces la
    // consulta dejaría de casar por el otro lado.
    .normalize('NFC')
    .toLowerCase()
    .trim()
}

// ── ¿Está escrito en japonés, chino o coreano? (tanda 532) ──
//
// Vive AQUÍ y no en cada sitio que la necesita porque la necesitan dos
// lados que no se pueden importar entre sí: el navegador —para saber si el
// nombre de un set hay que enseñarlo traducido— y `netlify/lib/scrydex.mjs`,
// que la usa para no comparar nombres de alfabetos distintos (tanda 505).
// Dos copias de una misma regla se separan sin que nadie se entere, y la
// 471 ya costó una guarda que llevaba tres tandas mirando a un fichero
// vacío.
//
// El rango incluye kana, kanji, hangul y la puntuación de ancho completo:
// no hace falta afinar más, porque la pregunta es «¿puede leer esto quien
// lee español?» y la respuesta es la misma para los tres.
const CJK = /[\u3000-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff00-\uffef\uac00-\ud7af]/

export function tieneCJK(texto) {
  return CJK.test(String(texto || ''))
}
