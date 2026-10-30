// QUERER UNA CARTA EN VARIOS IDIOMAS (tanda 1128, Sergio.M en el foro: «si
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

// De lo que ya pediste (las filas de una carta y versión) a lo que marcas:
// qué filas se quedan (y si cambian de versión), cuáles se borran y qué
// idiomas se añaden. `ocupados`: los idiomas que esa carta ya tiene apuntados
// en `variante` en OTRA fila (el índice único de la 1047): no se repiten.
export function planDeDeseos(filas, idiomas, variante = null, ocupados = []) {
  const quiero = idiomasPara(idiomas)
  const vistos = new Set()
  const cambiar = []
  const borrar = []
  for (const f of filas) {
    const i = f.idioma || null
    if (quiero.includes(i) && !vistos.has(i)) {
      vistos.add(i)
      if ((f.variante || null) !== (variante || null)) cambiar.push({ id: f.id, cambios: { variante: variante || null } })
    } else {
      borrar.push(f.id)
    }
  }
  const yaEstan = new Set(ocupados.map((i) => i || null))
  // Una fila que cambia de versión a una que ya existe en ese idioma chocaría
  // con el índice: se borra en vez de cambiarla.
  const choca = cambiar.filter((c) => yaEstan.has(filas.find((f) => f.id === c.id).idioma || null))
  return {
    cambiar: cambiar.filter((c) => !choca.includes(c)),
    borrar: [...borrar, ...choca.map((c) => c.id)],
    anadir: quiero.filter((i) => !vistos.has(i) && !yaEstan.has(i)),
  }
}

// «en portugués y francés», para los avisos. `nombreDe(id)` da el nombre.
export function textoDeIdiomas(idiomas, nombreDe) {
  const lista = idiomasPara(idiomas)
  if (lista[0] === null) return ''
  const n = lista.map((i) => String(nombreDe(i) || i).toLowerCase())
  return `en ${n.length > 1 ? `${n.slice(0, -1).join(', ')} y ${n.at(-1)}` : n[0]}`
}
