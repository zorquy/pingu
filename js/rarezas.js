// Las marcas de rareza: el DIBUJO, que es lo que arrastra CSS.
//
// Los nombres viven en `js/rarezas-nombres.js`, sin una sola etiqueta,
// porque quien solo quiere traducir no debe arrastrar las clases que este
// fichero pinta (ver la cabecera de allí). Se reexportan aquí para que
// nada de lo que ya los importaba de este sitio se entere.
import { rarezaEs, OTRAS_FORMAS, RAREZAS_ES, RAREZAS_SCRYDEX, rarezaDeCarta, rarezaCrudaDeCarta, formasDeRareza } from './rarezas-nombres.js'

export { rarezaEs, rarezaDeCarta, rarezaCrudaDeCarta, formasDeRareza, RAREZAS_ES, RAREZAS_SCRYDEX }

// ── LAS MARCAS ──
//
// Cuatro formas, que es lo que hay de verdad impreso en una carta:
// círculo, diamante, una estrella y dos. Y cuatro acabados: negro (las
// tres de sobre), tornasol (holo y ultra), oro (ilustración e híper) y
// rosa-y-verde (ataque mega y brillante).
//
// El COLOR va en el CSS y no aquí (`currentColor` y un `data-acabado`):
// la marca vive dentro de un chip que en el tema oscuro tiene la letra
// clara, y un negro a fuego desaparecería contra su propio fondo —la
// lección de la 315—. Las dos estrellas de «ataque mega» son de dos
// colores distintos, así que llevan clase cada una: es la única de las
// cuatro que no se puede pintar con un solo color.
const ESTRELLA = 'M12 3.2 14.2 8.9 20.3 9.3 15.6 13.2 17.1 19.2 12 15.9 6.9 19.2 8.4 13.2 3.7 9.3 9.8 8.9Z'
const ESTRELLA_IZQ = 'M7 4.5 8.6 8.6 13 8.9 9.6 11.7 10.7 16 7 13.6 3.3 16 4.4 11.7 1 8.9 5.4 8.6Z'
const ESTRELLA_DER = 'M17 4.5 18.6 8.6 23 8.9 19.6 11.7 20.7 16 17 13.6 13.3 16 14.4 11.7 11 8.9 15.4 8.6Z'
const CIRCULO = '<circle cx="12" cy="12" r="5.6" />'
const DIAMANTE = '<path d="M12 5.2 18.8 12 12 18.8 5.2 12Z" />'
const UNA = `<path d="${ESTRELLA}" />`
const DOS = `<path class="uno" d="${ESTRELLA_IZQ}" /><path class="dos" d="${ESTRELLA_DER}" />`

const MARCAS = {
  Común: { forma: CIRCULO, acabado: 'negro' },
  Infrecuente: { forma: DIAMANTE, acabado: 'negro' },
  Rara: { forma: UNA, acabado: 'negro' },
  'Rara Holo': { forma: UNA, acabado: 'holo' },
  'Rara Doble': { forma: DOS, acabado: 'negro' },
  'Rara Ultra': { forma: DOS, acabado: 'holo' },
  'Rara Ilustración': { forma: UNA, acabado: 'oro' },
  'Rara Ilustración Especial': { forma: DOS, acabado: 'oro' },
  'Rara Híper': { forma: DIAMANTE, acabado: 'oro' },
  // La arcoíris y la secreta llevan la MISMA marca impresa que la híper
  // —son secretas las tres—, así que comparten dibujo. Lo que cambia es
  // el nombre, que es justo lo que se estaba perdiendo.
  'Rara Arcoíris': { forma: DIAMANTE, acabado: 'oro' },
  'Rara Secreta': { forma: DIAMANTE, acabado: 'oro' },
  'Rara Híper Mega': { forma: DIAMANTE, acabado: 'oro' },
  'Rara Ataque Mega': { forma: DOS, acabado: 'mega' },
  'Rara Brillante': { forma: UNA, acabado: 'mega' },
  'Rara Brillante Ultra': { forma: DOS, acabado: 'mega' },
  'Rara Radiante': { forma: UNA, acabado: 'holo' },
  'Rara Asombrosa': { forma: UNA, acabado: 'holo' },
  'Rara ACE SPEC': { forma: UNA, acabado: 'oro' },
}

// La marca de una rareza, o cadena vacía si no le toca ninguna. El vacío
// es una RESPUESTA y no un olvido: una promo no lleva marca de rareza
// impresa, y dibujarle una estrella sería decir que es rara.
export function marcaDeRarezaHtml(valor, { clase = 'rareza-marca' } = {}) {
  const m = MARCAS[rarezaEs(valor)]
  if (!m) return ''
  return (
    `<span class="${clase}" data-acabado="${m.acabado}" aria-hidden="true">` +
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">${m.forma}</svg>` +
    '</span>'
  )
}

// Para pruebas y para quien quiera recorrerlas.
export { OTRAS_FORMAS, MARCAS }
