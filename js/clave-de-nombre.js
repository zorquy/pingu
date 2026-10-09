// Las dos funciones con las que se decide si dos filas del espejo son LA
// MISMA carta (tanda 800). Vivían en js/constructor/nucleo.js y se mudan a
// un fichero sin dependencias porque las necesita también la regla de la
// reimpresión (js/carta-legalidad.js), que bajan /carta y los torneos: no
// tienen por qué bajarse el núcleo entero del constructor.

// El espejo guarda campos en dos idiomas y con y sin acentos: nada se
// compara con un valor suelto, se normaliza primero.
export function plano(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

// Va por el nombre TRADUCIDO cuando lo hay, y no por `name_key`: mientras
// dura la reparación de la tanda 335 unas impresiones llevan el inglés en
// `name` (y en `name_key`) y otras todavía el español, así que la promo
// de «Boss's Orders» y la «Órdenes de Jefes» moderna no compartían clave.
// `name_es` lo llevan las dos. Sin él, la clave del espejo o el nombre plano.
export function claveDeNombre(carta) {
  if (carta?.name_es) return plano(carta.name_es)
  return String(carta?.name_key || plano(carta?.name))
}
