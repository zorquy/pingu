// Los iconos que solo usa /mi-coleccion (tanda 452).
//
// POR QUÉ NO ESTÁN EN `js/icons.js`: ese fichero lo baja TODO el mundo,
// la portada incluida, y pesa 5,5 KB gzip de los 170 que tiene de
// presupuesto la portada entera. Meter aquí un icono que solo se pinta en
// una pantalla la pasó de 169,9 a 170,4 — o sea, lo rompió. Es la misma
// regla que la del CSS: lo que usa una sola pantalla va en su fichero.
import { icon } from '../icons.js'

export const ICONOS_COLECCION = {
  // LA POKÉDEX. Hasta ahora esa pestaña usaba `target`, que es una diana:
  // dice «objetivo», no «enciclopedia de Pokémon». PINGU, con el menú de
  // Dex delante: «el icono de Pokédex puedes hacerte tú uno».
  //
  // Es el aparato visto de frente, y con lo JUSTO para que se reconozca a
  // 24 px: la caja, la LENTE grande arriba a la izquierda —que es lo que
  // hace que una caja sea una Pokédex y no una carpeta—, un piloto al lado
  // y la pantalla abajo. Mismo trazo de 2 que el resto de la familia.
  //
  // Empezó con DOS pilotos y una pantalla de dos renglones, y a 24 px —el
  // tamaño al que se ve de verdad— los pilotos se empastaban en un churro
  // y los dos renglones en una mancha. Un icono se dibuja al tamaño al que
  // se mira, no al que se dibuja cómodo: lo que sobra a 96 px tapa a 24.
  // El piloto es un `path` de longitud cero con el remate redondo, que es
  // cómo se hace un punto sin que el trazo lo engorde.
  pokedex: (size) =>
    icon(
      '<rect x="3" y="3" width="18" height="18" rx="4"></rect>' +
        '<circle cx="8.5" cy="8.5" r="2.3"></circle>' +
        '<path d="M14 8.5h.01"></path>' +
        '<path d="M7.5 15.5h9"></path>',
      size
    ),
  // «ORDEN» (748, la C2): tres raíles con su tirador, el dibujo de «cómo se
  // reparte esto» en cualquier app; el engranaje dice «ajustes».
  sliders: (size) =>
    icon(
      '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"></path>' +
        '<circle cx="16" cy="6" r="2"></circle>' +
        '<circle cx="10" cy="12" r="2"></circle>' +
        '<circle cx="18" cy="18" r="2"></circle>',
      size
    ),
  // «La quiero» (751). Lo usan también /carta y la hoja «Tú».
  corazon: (size) =>
    icon('<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21.2l7.8-7.8 1-1.1a5.5 5.5 0 0 0 0-7.8z"></path>', size),
}
