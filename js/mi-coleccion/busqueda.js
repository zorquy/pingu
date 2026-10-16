import { normalizeSearch } from '../texto.js'

// QUÉ QUIERE DECIR LO QUE SE ESCRIBE EN «AÑADIR CARTA» (765, B1 de la
// ronda 3). Además del nombre y el número de siempre (la 450), dos formas
// que es como se lee una carta que tienes en la mano:
//
//   · «151/165»: el número y el TOTAL impreso abajo. El total dice de qué
//     expansión es —la que tiene 165 en su numeración oficial—, así que no
//     salen las 151 de todas.
//   · «MEW 151»: el código del set (el de TCG Live, `tcg_online_code`) y el
//     número. Solo cuenta como código si hay un número al lado: «mew» a
//     secas es el Pokémon, y quien llama vuelve a probar como nombre si con
//     el código no sale nada.
//
// Pura y sin base: los sets se los pasa quien llama.
export function entenderBusqueda(texto, sets = []) {
  let t = String(texto || '').trim()
  let total = null
  const fraccion = t.match(/(?:^|\s)#?(\d{1,4})\s*\/\s*(\d{1,4})(?=\s|$)/)
  if (fraccion) {
    total = Number(fraccion[2])
    t = `${t.slice(0, fraccion.index)} ${fraccion[1]} ${t.slice(fraccion.index + fraccion[0].length)}`
  }
  const palabras = t.split(/\s+/).filter(Boolean)
  const conNumero = palabras.some((p) => /^\d{1,4}$/.test(p))
  let codigo = null
  let porCodigo = null
  if (conNumero) {
    for (const p of palabras) {
      if (/^\d+$/.test(p)) continue
      const ids = sets.filter((s) => String(s.tcg_online_code || '').trim().toLowerCase() === p.toLowerCase()).map((s) => s.id)
      if (ids.length) {
        codigo = p
        porCodigo = ids
        break
      }
    }
  }
  const porTotal = total != null ? sets.filter((s) => Number(s.card_count_official) === total).map((s) => s.id) : null
  // Si los dos dicen algo, manda lo que digan JUNTOS; si no se cruzan, el
  // código (lo escribió alguien a propósito; el total puede ser de otra
  // forma de contar). Un total que no casa con ningún set no filtra nada:
  // mejor de más que una pantalla vacía.
  let setIds = null
  if (porCodigo && porTotal?.length) {
    const juntos = porCodigo.filter((id) => porTotal.includes(id))
    setIds = juntos.length ? juntos : porCodigo
  } else if (porCodigo) setIds = porCodigo
  else if (porTotal?.length) setIds = porTotal
  const resto = codigo ? palabras.filter((p) => p !== codigo) : palabras
  return { texto: resto.join(' '), setIds, codigo, total }
}

// UN NÚMERO SUELTO NO ES PARTE DEL NOMBRE (tanda 450), y esto era un fallo
// de verdad: PINGU escribió «Mewtwo 64» —el Mega-Mewtwo X de Breakthrough,
// que es la 64— y no salía NADA. El buscador exigía que «64» estuviera
// también en `name_search`, que son los dos nombres y nada más.
//
// Y un número que alguien escribe junto a un nombre puede querer decir dos
// cosas, así que vale cualquiera de las dos: el NÚMERO IMPRESO de la carta
// («la 64 del set») o el NÚMERO NACIONAL de Pokédex («el 25 es Pikachu»).
// Quedarse solo con uno dejaría media web sin encontrar a la primera.
//
// Se acepta como número una palabra de dígitos sola, y se compara también
// con ceros delante porque hay sets que imprimen «064». Y solo dígitos:
// esto se monta dentro de un `or=` de PostgREST, donde una coma o un
// paréntesis del usuario cambiaría la consulta.
//
// Y UNA PROMO LLEVA LETRAS DELANTE DEL NÚMERO (852): el Pikachu EX de las
// promos de XY es la «XY124», las de Espada y Escudo son «SWSH001», las
// Trainer Gallery «TG01». PINGU buscó «Pikachu 124» y «Pikachu XY124» y no
// salió nada: «124» se comparaba con `local_id` ENTERO (y el suyo es
// «XY124»), y «xy124» se tomaba por una palabra del nombre. Así que
// «xy124» es un número con prefijo, y un número a secas vale con cualquier
// prefijo delante (lo decide `filtroDeNumero`).
export function partirBusqueda(texto) {
  const palabras = String(texto || '').split(/\s+/).filter(Boolean)
  const esNumero = (p) => /^[a-z]{0,5}\d{1,4}$/i.test(p)
  const numeros = palabras.filter(esNumero)
  const nombre = palabras.filter((p) => !esNumero(p))
  const m = numeros.length ? numeros[0].match(/^([a-z]*)(\d+)$/i) : null
  // Si SOLO se escribe un número, ese número es la búsqueda entera y no
  // un afinado: «64» a secas quiere decir «enséñame las 64».
  return { nombre, numero: m ? m[2] : null, prefijo: m && m[1] ? m[1].toLowerCase() : null, soloNumero: numeros.length > 0 && nombre.length === 0 }
}

// «Pikachu XY 124», con el prefijo separado del número: la primera pasada
// lo toma por una palabra del nombre y no encuentra nada. Esto devuelve el
// texto con los dos pegados («pikachu xy124») para una SEGUNDA pasada, y
// null si no hay nada que pegar. Solo de respaldo, nunca de primeras: «Mew
// 151» u «Onix 62» son un nombre corto y un número, no un prefijo.
export function conPrefijoPegado(texto) {
  const t = String(texto || '')
  const pegado = t.replace(/(^|\s)([a-z]{1,5})\s+(\d{1,4})(?=\s|$)/i, '$1$2$3')
  return pegado !== t ? pegado : null
}

export function variantesDeNumero(n) {
  const limpio = String(n).replace(/^0+/, '') || '0'
  return [...new Set([limpio, limpio.padStart(2, '0'), limpio.padStart(3, '0'), String(n)])]
}

// El filtro de número para un `or=` de PostgREST (851, con prefijos desde
// la 852): la carta con ese número IMPRESO —con ceros delante o sin ellos,
// y con las letras de una promo delante («XY124», «SWSH001», «TG01») o sin
// ellas— o el Pokémon con ese número de Pokédex. Va como expresión regular
// (`imatch`, el `~*` de Postgres) porque las letras pueden ser cualquiera;
// y con un prefijo escrito a propósito no se mira la Pokédex: «xy124» no
// es ningún Pokémon. Solo letras y dígitos llegan aquí (`partirBusqueda`),
// así que no se cuela sintaxis del `or` ni de la expresión.
//
// Y CON PREFIJO SE BUSCA MIENTRAS SE ESCRIBE (853). PINGU: «Pikachu XY1 me
// saca otras tantas, pero el XY124 no está; XY12 tampoco; y con 124 ya
// sale». Un número a secas es exacto («Mewtwo 64» es la 64, no la 640);
// pero quien escribe «xy1» va camino de «xy124», así que con letras delante
// el número es el PRINCIPIO del impreso: «xy1» da XY1, XY10… y XY124.
export function filtroDeNumero(numero, prefijo = null) {
  const limpio = String(numero).replace(/^0+/, '') || '0'
  const letras = prefijo ? String(prefijo).replace(/[^a-z]/gi, '') : '[a-z]*'
  if (prefijo) return `local_id.imatch.^${letras}[ -]?0*${limpio}`
  return [`local_id.imatch.^${letras}[ -]?0*${limpio}$`, `dex_ids.cs.{${Number(numero)}}`].join(',')
}

// «Pikachu XY», las letras del prefijo sin ningún dígito todavía (853): la
// primera pasada las toma por una palabra del nombre y no da nada. Si la
// ÚLTIMA palabra son de una a cinco letras y hay otra delante, se devuelve
// el filtro de `local_id` que empieza por ellas y el texto sin esa palabra,
// para una segunda pasada. Solo de respaldo: «pikachu ex» o «mew ex» tienen
// que seguir buscando el nombre entero primero.
export function prefijoSuelto(texto) {
  const palabras = String(texto || '').trim().split(/\s+/).filter(Boolean)
  if (palabras.length < 2) return null
  const ultima = palabras[palabras.length - 1]
  if (!/^[a-z]{1,5}$/i.test(ultima)) return null
  return { texto: palabras.slice(0, -1).join(' '), filtro: `local_id.imatch.^${ultima.toLowerCase()}[a-z]*[ -]?\\d` }
}

// ¿Lleva esta carta ese número impreso? Para ordenar lo que vuelve: con
// «Pikachu 25» primero la 25 y luego los demás Pikachu (el 25 de la Pokédex).
export function llevaElNumero(localId, numero, prefijo = null) {
  const m = String(localId || '').match(/^([a-z]*)[ -]?0*(\d+)$/i)
  if (!m) return false
  const limpio = String(numero).replace(/^0+/, '') || '0'
  return m[2] === limpio && (!prefijo || m[1].toLowerCase() === String(prefijo).toLowerCase())
}

// «PIKACHU ASCENDED HEROES», «HYPNO ROCKET», «PIKACHU ASC» (874). PINGU:
// «mucha gente hace la búsqueda con pokemon + expansión […] si voy poniendo
// pikachu asc, que salga el pikachu (o los pikachus) de ascended heroes».
// Hasta ahora cada palabra tenía que estar en el NOMBRE de la carta, así
// que «ascended» no casaba con nada y la pantalla salía vacía.
//
// La cola de lo escrito —de una a cuatro palabras, la más larga primero— se
// prueba como expansión: cada palabra tiene que ser el PRINCIPIO de alguna
// palabra del nombre del set (en español o en inglés), o la cola entera su
// código de TCG Live. Lo de delante se queda como nombre, y siempre tiene
// que quedar algo delante: «ascended heroes» a secas no es una carta.
//
// Pura: los sets se los pasa quien llama. Devuelve `null` si ninguna cola
// casa con ningún set; y `corta` avisa de que alguna palabra de la cola
// tiene menos de tres letras («pikachu ex»): con esas solo se busca si por
// nombre no ha salido NADA, que si no «mewtwo ex» arrastraría detrás a los
// Mewtwo de los sets «EX» de 2003.
const palabrasDeSet = (s) => normalizeSearch(`${s.name || ''} ${s.name_en || ''}`).split(/\s+/).filter(Boolean)

export function expansionEnBusqueda(texto, sets = []) {
  const palabras = normalizeSearch(texto).split(/\s+/).filter(Boolean)
  if (palabras.length < 2 || !sets?.length) return null
  const indice = sets.map((s) => ({ id: s.id, palabras: palabrasDeSet(s), codigo: String(s.tcg_online_code || '').trim().toLowerCase() }))
  for (let k = Math.min(palabras.length - 1, 4); k >= 1; k--) {
    const cola = palabras.slice(-k)
    if (cola.some((p) => p.length < 2)) continue
    const setIds = indice
      .filter((s) => cola.every((p) => s.palabras.some((w) => w.startsWith(p))) || (k === 1 && s.codigo && s.codigo === cola[0]))
      .map((s) => s.id)
    if (setIds.length) return { texto: palabras.slice(0, -k).join(' '), setIds, expansion: cola.join(' '), corta: cola.some((p) => p.length < 3) }
  }
  return null
}

// ¿Toca probar la expansión? Sin nada por nombre, siempre; con algo pero
// menos de lo que cabe, solo si la cola es de palabras enteras (la nota de
// arriba). Con la pantalla llena, no: lo que hay ya es la respuesta.
export function tocaProbarExpansion(leida, cuantas, limite) {
  if (!leida) return false
  if (cuantas === 0) return true
  return cuantas < limite && !leida.corta
}
