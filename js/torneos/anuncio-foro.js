// A qué foro va el anuncio de un torneo (tanda 247).
//
// El botón «Anunciar en el foro» de la ficha abre un hilo con los datos
// del torneo. Hasta ahora el desplegable de destino llegaba con el PRIMER
// foro de la lista marcado — que es «Anuncios», por puro orden de
// posición — y el hilo acababa donde no lo busca nadie. PINGU lo pidió el
// 2026-09-01: tiene que caer en «Juego → Torneos».
//
// Vive fuera de torneo.js porque torneo.js toca el DOM nada más cargarse
// y no se puede abrir en Node. Esto sí, y así se puede poner a prueba lo
// único que puede equivocarse: elegir mal el foro.

// El escapado va aquí y NO se importa de app.js por lo mismo: app.js
// también toca el DOM al cargarse.
function escapeHtml(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c])
}

// Sin tildes y en minúsculas, para comparar nombres escritos a mano.
function llano(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

// El foro donde tiene que caer un anuncio de torneo.
//
// Se busca por NOMBRE y no por un identificador escrito aquí: la
// estructura del foro vive en la base y se abre y se reordena desde
// /admin sin desplegar, así que un id fijo se rompería solo. Se prueban
// cuatro cosas, de la más precisa a la más resignada, y la última es la
// de siempre: el botón nunca se queda sin destino aunque el foro de
// torneos todavía no exista.
export function foroDeTorneos(foros) {
  const lista = foros || []
  const deJuego = (f) => llano(f.seccion) === 'juego'
  // `startsWith` y no igualdad: «Torneos», «Torneos y ligas» y «Torneo
  // semanal» son todos el sitio correcto.
  const deTorneos = (f) => llano(f.name).startsWith('torneo')
  return (
    lista.find((f) => deJuego(f) && deTorneos(f)) ||
    lista.find(deTorneos) ||
    lista.find(deJuego) ||
    lista[0] ||
    null
  )
}

// Los foros en el orden en que se leen: por secciones, y dentro de cada
// sección cada foro seguido de sus subforos.
//
// La consulta los devuelve ordenados por `position` a secas, y con eso un
// subforo de posición 1 se colaba DELANTE de su padre — con el guion
// puesto y colgando de nada. El orden de las secciones lo manda la lista
// de secciones, no el nombre: es el que se ve en /foro.
export function ordenarForos(foros, secciones) {
  const orden = new Map((secciones || []).map((s, i) => [s.id, i]))
  const lista = foros || []
  const hijos = (padre) => lista.filter((f) => f.parent_id === padre.id)
  const raices = lista.filter((f) => !f.parent_id || !lista.some((p) => p.id === f.parent_id))

  return raices
    .slice()
    .sort((a, b) => (orden.get(a.section_id) ?? 99) - (orden.get(b.section_id) ?? 99))
    .flatMap((f) => [f, ...hijos(f)])
}

// Las opciones del desplegable, agrupadas por sección. Un desplegable
// plano con todos los foros seguidos no dice a cuál pertenece cada uno, y
// hay nombres —«General»— que sin su sección no significan nada.
export function opcionesDeForos(foros, porDefecto) {
  const porSeccion = new Map()
  for (const f of foros || []) {
    if (!porSeccion.has(f.seccion)) porSeccion.set(f.seccion, [])
    porSeccion.get(f.seccion).push(f)
  }
  return [...porSeccion]
    .map(
      ([seccion, lista]) => `<optgroup label="${escapeHtml(seccion)}">${lista
        .map(
          (f) =>
            // El guion delante marca los subforos: en un desplegable no
            // hay sangrado que valga, y sin él «Web» cuelga de la nada.
            `<option value="${escapeHtml(f.id)}"${f.id === porDefecto?.id ? ' selected' : ''}>${
              f.parent_id ? '— ' : ''
            }${escapeHtml(f.name)}</option>`
        )
        .join('')}</optgroup>`
    )
    .join('')
}
