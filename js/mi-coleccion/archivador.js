// El archivador: la carpeta abierta con sus dos hojas (tanda 371).
//
// POR QUÉ ESTÁ AQUÍ Y NO EN LOS DOS SITIOS QUE LO PINTAN. Lo montaban
// `js/mi-coleccion.js` (el álbum de una colección) y
// `js/mi-coleccion/albumes.js` (los álbumes soñados), cada uno por su
// cuenta y con su copia del 9 por página. Ya habían empezado a
// separarse, y este es el trozo que más va a cambiar: en cuanto una
// hoja lleve cabecera, lomo y color de tapa, mantenerlo dos veces es
// garantizar que un día el soñado se vea distinto del de set — que es
// justo de lo que se quejó PINGU.
//
// Lo que NO entra aquí: cómo se pinta un bolsillo. Eso sí es distinto en
// cada uno (uno lleva el mando de −/+, el otro las flechas de ordenar),
// así que se recibe como función.
//
// Sin DOM: devuelve texto. Se prueba en Node.
import { escapeHtml } from '../html.js'

// Nueve por hoja, que es el archivador de toda la vida. Vivía por
// duplicado en los dos ficheros.
export const POR_PAGINA = 9

// LOS BOLSILLOS DE UN BINDER (759, AL3). PINGU, viendo Holonook: el binder
// se elige como el de verdad, de 4, 9, 12 o 16 por hoja. «3×4» son tres
// columnas y cuatro filas, que es como se venden. Lo que no se reconoce cae
// en el de nueve, que es lo que eran todos los álbumes antes de la 759.
export const REJILLAS = [
  { id: '2x2', columnas: 2, filas: 2 },
  { id: '3x3', columnas: 3, filas: 3 },
  { id: '3x4', columnas: 3, filas: 4 },
  { id: '4x4', columnas: 4, filas: 4 },
]
export function rejillaDe(id) {
  const r = REJILLAS.find((x) => x.id === id) || REJILLAS[1]
  return { ...r, porPagina: r.columnas * r.filas }
}

// ── El color de la tapa ──
//
// Ocho, y ninguno inventado: son los que ya existen en la escala de la
// web (`--navy`, `--success`…) más los dos neutros. Un color de tapa que
// no esté en la escala es un color suelto, y aquí se acaban colando
// veinte (norma de la casa).
//
// Se guarda en `localStorage` a propósito y no en la base: es una
// preferencia de quien MIRA, no un dato de la colección — y así no hace
// falta migración para una cosa que es puro gusto. La contrapartida está
// dicha en CLAUDE.md: no viaja entre dispositivos. Si algún día se
// quiere que viaje, se sube a `user_profiles` y este módulo no cambia.
export const TAPAS = [
  { id: 'azul', nombre: 'Azul' },
  { id: 'rojo', nombre: 'Rojo' },
  { id: 'verde', nombre: 'Verde' },
  { id: 'amarillo', nombre: 'Amarillo' },
  { id: 'morado', nombre: 'Morado' },
  { id: 'rosa', nombre: 'Rosa' },
  { id: 'negro', nombre: 'Negro' },
  { id: 'crema', nombre: 'Crema' },
]

export const TAPA_POR_DEFECTO = 'azul'
const CLAVE_TAPA = 'pokedoc-tapa-album'

export function tapaGuardada() {
  try {
    const v = localStorage.getItem(CLAVE_TAPA)
    return TAPAS.some((t) => t.id === v) ? v : TAPA_POR_DEFECTO
  } catch {
    // En una ventana privada o con el almacenamiento cortado, el color
    // por defecto. Que no se pueda recordar no puede dejar sin álbum.
    return TAPA_POR_DEFECTO
  }
}

export function guardarTapa(id) {
  if (!TAPAS.some((t) => t.id === id)) return
  try {
    localStorage.setItem(CLAVE_TAPA, id)
  } catch {
    // Igual: se usa en esta visita y ya está.
  }
}

// ── La cabecera de una hoja ──
//
// «PÁGINA 5» a la izquierda y «037 – 045» a la derecha: el número de
// hoja sirve para decirle a alguien dónde mirar, y el rango para saber
// si esta es la hoja que buscas sin leer los nueve bolsillos.
//
// El rango sale de las cartas DE ESA HOJA, no de una cuenta: con el
// filtro de «solo las que me faltan» puesto, los números no son
// seguidos, y un `037 – 045` calculado mentiría.
function cabeceraHtml(pagina, trozo, numeroDe) {
  const numeros = trozo.map((c) => numeroDe(c)).filter((n) => n !== '' && n != null)
  const rango = numeros.length
    ? numeros.length === 1
      ? String(numeros[0])
      : `${numeros[0]} – ${numeros[numeros.length - 1]}`
    : ''
  return (
    '<span class="mc-hoja-cabecera" aria-hidden="true">' +
    `<span>Página ${pagina}</span>` +
    (rango ? `<span>${escapeHtml(rango)}</span>` : '') +
    '</span>'
  )
}

// ── El archivador entero ──
//
// `lista` son las cartas ya filtradas y ordenadas; `pintarBolsillo(item,
// indiceGlobal)` devuelve el HTML de uno. `numeroDe(item)` saca el
// número impreso, que solo se usa para la cabecera.
//
// Devuelve { html, paginas, pagina } — la página puede venir corregida:
// al pasar del móvil a la pantalla ancha, la que estabas viendo cae en
// su pliego (se abre por pares, como un archivador de verdad).
export function archivadorHtml({
  lista,
  pagina = 0,
  deUnaVez = 1,
  pintarBolsillo,
  numeroDe = (c) => c?.local_id ?? '',
  tapa = TAPA_POR_DEFECTO,
  // 759: un binder lleva sus bolsillos y sus páginas. `paginasMin` son las
  // que tiene aunque estén vacías (un binder de 20 páginas tiene 20 desde
  // el primer día); con más cartas que sitio, crece, no se corta.
  porPagina = POR_PAGINA,
  columnas = 3,
  paginasMin = 1,
}) {
  const POR_PAGINA = porPagina
  const paginas = Math.max(1, paginasMin, Math.ceil(lista.length / POR_PAGINA))
  let p0 = Math.min(Math.max(0, pagina), paginas - 1)
  p0 -= p0 % deUnaVez
  const hojas = []
  for (let p = p0; p < Math.min(paginas, p0 + deUnaVez); p++) {
    const desde = p * POR_PAGINA
    const trozo = lista.slice(desde, desde + POR_PAGINA)
    hojas.push(
      `<div class="mc-hoja" aria-label="Página ${p + 1}">` +
        cabeceraHtml(p + 1, trozo, numeroDe) +
        trozo.map((item, i) => pintarBolsillo(item, desde + i)).join('') +
        '<span class="mc-bolsillo mc-bolsillo-vacio" aria-hidden="true"></span>'.repeat(POR_PAGINA - trozo.length) +
        '</div>'
    )
  }
  // Si solo hay una hoja, la otra cara no se queda en blanco: va una
  // vacía. Un archivador abierto tiene dos caras, y sin ella la página
  // parecía cortada por la mitad (tanda 369).
  if (hojas.length === 1 && deUnaVez > 1) {
    hojas.push('<div class="mc-hoja mc-hoja-fantasma" aria-hidden="true"></div>')
  }
  // Las anillas van en su propia capa y no entre las hojas: son un
  // adorno, y metidas en la rejilla contarían como una columna más — el
  // mismo fallo que la tanda 316 (lo que cruza una rejilla ocupa pista).
  // Tres anillas, como un archivador de tres. Van como hijos y no como
  // `::before`/`::after` porque con dos pseudoelementos solo salen dos, y
  // dos anillas no son un archivador: son dos agujeros.
  const anillas = deUnaVez > 1 ? '<span class="mc-anillas" aria-hidden="true"><i></i><i></i><i></i></span>' : ''
  return {
    html:
      `<div class="mc-binder" data-tapa="${escapeHtml(tapa)}"${columnas !== 3 ? ` style="--cols:${Number(columnas)}"` : ''}>` +
      `<div class="mc-archivador">${hojas.join('')}${anillas}</div>` +
      '</div>',
    paginas,
    pagina: p0,
  }
}

// El texto de «Página 5-6 de 21», que también estaba escrito dos veces.
export function textoDePaginas(pagina, paginas, deUnaVez) {
  if (!paginas) return ''
  const hasta = Math.min(paginas, pagina + deUnaVez)
  return `Página ${pagina + 1}${hasta > pagina + 1 ? `-${hasta}` : ''} de ${paginas}`
}

// Las opciones del «Ir a…», para no pasar hoja a hoja en un set de 200
// cartas (22 pliegos). Va de pliego en pliego, que es como se abre.
export function opcionesDeSalto(paginas, deUnaVez, actual) {
  const opciones = []
  for (let p = 0; p < paginas; p += deUnaVez) {
    const hasta = Math.min(paginas, p + deUnaVez)
    opciones.push(
      `<option value="${p}"${p === actual ? ' selected' : ''}>` +
        `Página ${p + 1}${hasta > p + 1 ? `-${hasta}` : ''}` +
        '</option>'
    )
  }
  return opciones.join('')
}
