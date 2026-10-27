// LA HOJA DE FILTROS, LA MISMA EN TODAS PARTES (1055). PINGU: «que sea todo
// consistente durante todos los sitios donde salgan cartas». Cartas, una
// expansión, la Pokédex y Buscar tenían cuatro hojas con los grupos en
// cuatro órdenes y con cuatro nombres para lo mismo («Tipo de energía»,
// «Tipo», «Categoría», «Tipo de carta»). Aquí viven el orden y el nombre;
// cada pantalla marca sus grupos con `data-hoja` y los mete con
// `meterEnLaHoja`, y lo que solo tiene una pantalla va detrás de la raya.
// Sin dependencias: lo importan mi-coleccion.js y la Pokédex.

export const ORDEN_DE_LA_HOJA = [
  'energia', 'rareza', 'tipo', 'entrenador', 'version', 'precio', 'idioma',
  'raya',
  'que', 'expansion', 'serie', 'set', 'estado', 'ilustrador', 'gradeo', 'notas',
]

export const TITULO_DE_LA_HOJA = {
  energia: 'Tipo',
  rareza: 'Rareza',
  tipo: 'Tipo de carta',
  entrenador: 'Tipo de entrenador',
  version: 'Versión',
  precio: 'Precio',
  idioma: 'Idioma de tus copias',
  expansion: 'Expansión',
  serie: 'Serie',
  set: 'Expansión',
  estado: 'Estado',
  ilustrador: 'Ilustrador',
  gradeo: 'Gradeo',
  notas: 'Notas',
}

// Los ids de cada pantalla, en la clave común: los de tu colección
// (`GRUPOS_FILTRO`) y los del catálogo (`FILTROS_CATALOGO`, que son
// columnas de la base).
const CLAVE = { variante: 'version', category: 'tipo', types: 'energia', trainer_type: 'entrenador', rarity: 'rareza' }
export const claveEnLaHoja = (id) => CLAVE[id] || id
export const tituloEnLaHoja = (id, otro = '') => TITULO_DE_LA_HOJA[claveEnLaHoja(id)] || otro

const sitio = (e) => {
  const i = ORDEN_DE_LA_HOJA.indexOf(e?.dataset?.hoja)
  return i < 0 ? ORDEN_DE_LA_HOJA.length : i
}

// Mete los grupos de `html` en su sitio SIN mover lo que ya está: el campo
// del precio vive en la hoja y moverlo mientras se escribe le quitaría el
// foco. Lo que pinta una pantalla lleva `data-hoja-pintado` y se cambia
// entero en cada pintada; lo escrito en el HTML se queda.
export function meterEnLaHoja(cuerpo, html, { marca = '1' } = {}) {
  if (!cuerpo) return
  for (const viejo of cuerpo.querySelectorAll(`:scope > [data-hoja-pintado="${marca}"]`)) viejo.remove()
  const t = cuerpo.ownerDocument.createElement('template')
  t.innerHTML = html
  for (const nuevo of [...t.content.children]) {
    nuevo.dataset.hojaPintado = marca
    const p = sitio(nuevo)
    const antes = [...cuerpo.children].find((c) => sitio(c) > p)
    cuerpo.insertBefore(nuevo, antes || null)
  }
}
