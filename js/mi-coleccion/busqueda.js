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
