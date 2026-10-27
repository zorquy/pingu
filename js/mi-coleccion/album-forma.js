// LA FORMA DE UN ÁLBUM, sin DOM y sin clases (tanda 1052): las rejillas de
// bolsillos y el color de la tapa. Vivían en archivador.js; se mudaron aquí
// porque «En tus álbumes» (js/en-tus-albumes.js) las necesita en /carta y en
// el pop-up de toda la web, y arrastrar el archivador entero era arrastrar
// sus clases a páginas sin mi-coleccion.css. archivador.js las reexporta.

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
