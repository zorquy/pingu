// QUERER UNA CARTA EN VARIOS IDIOMAS Y VERSIONES (tandas 1128 y 1129, Sergio.M en el foro: «si
// digo que me falta en portugués, no puedo añadir que me falta también en
// francés»). La base ya lo admitía —un deseo por carta, idioma y versión
// (1047)— y la baldosa ya pintaba varias banderas; lo que faltaba era poder
// marcarlos. Puro y sin dependencias: lo usan la ventana, Mi colección y
// /carta, y lo prueba Node.

export const ASIATICOS = ['ja', 'ko', 'zh', 'zh-tw', 'zh-cn']

// Los idiomas que de verdad se apuntan para una carta de `market`. `null` es
// «cualquiera» y va SOLO: si está, no hay otros. Una japonesa no existe en
// español: un idioma occidental elegido para varias a la vez es «cualquiera»
// en su catálogo (como hacía la 1064 con uno).
export function idiomasPara(idiomas, market = 'WEST') {
  const lista = (Array.isArray(idiomas) && idiomas.length ? idiomas : [null]).map((i) => i || null)
  const suyos = market === 'JP' ? lista.map((i) => (i && !ASIATICOS.includes(i) ? null : i)) : lista
  return suyos.includes(null) ? [null] : [...new Set(suyos)]
}

// Y VARIAS VERSIONES (1129, PINGU: «¿se pueden apuntar varios idiomas en
// varias versiones?»): cada pareja idioma × versión es un deseo. `null` en
// la versión es «cualquiera» y también va sola. `vale(idioma, variante)`
// quita las parejas que no existen (Stormfront no tuvo Reverse en español,
// 956); «cualquier idioma» vale siempre.
export function variantesPara(variantes) {
  const lista = (Array.isArray(variantes) && variantes.length ? variantes : [null]).map((v) => v || null)
  return lista.includes(null) ? [null] : [...new Set(lista)]
}
export function combosDe({ idiomas, variantes } = {}, market = 'WEST', vale = () => true) {
  const out = []
  for (const variante of variantesPara(variantes)) {
    for (const idioma of idiomasPara(idiomas, market)) {
      if (idioma === null || vale(idioma, variante)) out.push({ idioma, variante })
    }
  }
  return out
}
const clave = (x) => `${x.idioma || ''}|${x.variante || ''}`

// De lo que ya pediste (las filas de una carta y versión) a lo que marcas
// (`combos`): las filas que siguen se quedan; una que solo cambia de versión
// se CAMBIA (conserva su id, y con él lo que cuelgue de ella); las demás se
// borran, y lo nuevo se añade. `ocupados`: lo que esa carta ya tiene en OTRAS
// filas (el índice único de la 1047): no se repite.
export function planDeCombos(filas, combos, ocupados = []) {
  const quiero = []
  for (const c of combos) if (!quiero.some((q) => clave(q) === clave(c))) quiero.push({ idioma: c.idioma || null, variante: c.variante || null })
  const yaEstan = new Set(ocupados.map(clave))
  const vistos = new Set()
  const sobran = []
  for (const f of filas) {
    const k = clave(f)
    if (quiero.some((q) => clave(q) === k) && !vistos.has(k)) vistos.add(k)
    else sobran.push(f)
  }
  let nuevos = quiero.filter((q) => !vistos.has(clave(q)) && !yaEstan.has(clave(q)))
  const cambiar = []
  const borrar = []
  for (const f of sobran) {
    const igual = nuevos.find((q) => q.idioma === (f.idioma || null))
    if (igual) {
      cambiar.push({ id: f.id, cambios: { variante: igual.variante } })
      nuevos = nuevos.filter((q) => q !== igual)
    } else {
      borrar.push(f.id)
    }
  }
  return { cambiar, borrar, anadir: nuevos }
}

// Lo de la 1128, con una sola versión: `anadir` son idiomas.
export function planDeDeseos(filas, idiomas, variante = null, ocupados = []) {
  const v = variante || null
  const p = planDeCombos(filas, idiomasPara(idiomas).map((idioma) => ({ idioma, variante: v })), ocupados.map((idioma) => ({ idioma: idioma || null, variante: v })))
  return { ...p, anadir: p.anadir.map((c) => c.idioma) }
}

// «en portugués y francés», para los avisos. `nombreDe(id)` da el nombre.
export function textoDeIdiomas(idiomas, nombreDe) {
  const lista = idiomasPara(idiomas)
  if (lista[0] === null) return ''
  const n = lista.map((i) => String(nombreDe(i) || i).toLowerCase())
  return `en ${n.length > 1 ? `${n.slice(0, -1).join(', ')} y ${n.at(-1)}` : n[0]}`
}
