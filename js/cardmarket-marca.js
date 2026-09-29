// La marca de Cardmarket, dibujada (tanda 368).
//
// Lo pidió PINGU: «en vez de un link a Cardmarket, en cada carta, que
// haya un logo de Cardmarket que cliques y te lleve a Cardmarket».
//
// ── Por qué va dibujada y no traída de cardmarket.com ──
//
//   1. Colgar la imagen de su servidor es pedirle a cada visitante una
//      petición a un tercero para pintar un botón. El día que ese
//      tercero no conteste —pasó con la CDN de los sprites el
//      2026-09-20, tanda 321— el botón se queda mudo.
//   2. Es un SVG: escala, pesa nada y se lee igual en el tema oscuro,
//      donde un PNG con fondo blanco cantaría.
//
// ── Y por qué está en SU PROPIO fichero ──
//
// Porque esto es lo ÚNICO de Cardmarket que necesita CSS, y ese CSS vive
// en `css/carta.css`. Estaba dentro de `js/cardmarket.js`, que importa
// también /mi-coleccion para los idiomas y los estados… y /mi-coleccion
// no carga `carta.css`. El barrido de la tanda 299 sigue los imports, no
// las llamadas: una página «usa» una clase por importar el módulo que la
// pinta, aunque no la pinte nunca. Separado, el que no lo dibuja tampoco
// lo arrastra.
//
// El color es el suyo, que es media marca. `currentColor` NO vale aquí:
// un logo ajeno no se repinta con el tema de nuestra web.
export const CM_AZUL = '#00256a'

// Solo la marca (las dos cartas y las dos flechas), para un botón donde
// el nombre ya va escrito al lado.
export function marcaCardmarket(alto = 20) {
  return (
    `<svg class="cm-marca" width="${alto}" height="${alto}" viewBox="0 0 64 64" fill="none" aria-hidden="true" focusable="false">` +
    `<g fill="${CM_AZUL}">` +
    // Las dos cartas del mazo, en abanico hacia la izquierda. Anchas a
    // propósito: a 20 px, unas más finas se convierten en dos rayas.
    '<path d="M6.4 16.4 12 14.4l7.8 31.4-5.6 2z"/>' +
    '<path d="M16 13.2 21.6 11.2l7.8 31.4-5.6 2z"/>' +
    // La flecha que SALE (vender), maciza y arriba a la derecha.
    '<path d="M35 11h19a3 3 0 0 1 3 3v19a3 3 0 0 1-5.1 2.1L45 27.2l-8.9 8.9a3 3 0 0 1-4.2-4.2l8.9-8.9-7.9-7.9A3 3 0 0 1 35 11z"/>' +
    '</g>' +
    // La que ENTRA (comprar), de trazo. En la marca original esta va
    // hueca y la de arriba maciza: es lo que distingue una dirección de
    // la otra de un vistazo, y si se pintan las dos iguales el dibujo se
    // queda en «dos flechas» sin decir nada.
    `<path d="M29 39.5v11.9h11.9M30.6 49.8 46.4 34" stroke="${CM_AZUL}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>` +
    '</svg>'
  )
}

// La marca CON el nombre, para encabezar un bloque. El nombre va en
// texto y no dibujado letra a letra: así se lee, se puede seleccionar y
// no se deforma si alguien tiene el navegador con otra escala.
export function logoCardmarket(alto = 22) {
  return (
    `<span class="cm-logo" style="--cm-azul:${CM_AZUL}">` +
    marcaCardmarket(alto) +
    '<span class="cm-logo-texto">cardmarket</span>' +
    '</span>'
  )
}
