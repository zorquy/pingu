// La banda de arriba de Deseos y cambios (1217, «La web como la portada»):
// Mercado, La quiero, Las que doy y Cruces llevan la misma, con su título,
// su línea, sus cifras y tres cartas en abanico. PINGU: en el móvil NO va
// («ya te lo dice arriba»): la esconde `mi-coleccion.css` bajo
// `html.con-barra-movil`, así que el PC la tiene y el teléfono empieza por
// las cartas. Puro, salvo las fotos, que salen de la cadena de escaneos.
import { bandaSeccionHtml, abanicoHtml } from '../banda-seccion.js'
import { cadenaDeEscaneo, atributosDeEscaneo } from '../escaneo-carta.js'

const VISTAS = { mercado: 'Mercado', quiero: 'La quiero', doy: 'Las que doy', cruces: 'Cruces' }

// Tres fotos de las primeras cartas que tengan una.
export function fotosDe(cartas = []) {
  const fotos = []
  for (const c of cartas) {
    const escaneo = c ? atributosDeEscaneo(cadenaDeEscaneo(c)) : ''
    if (escaneo) fotos.push(`<img ${escaneo} alt="" width="245" height="342" loading="lazy" />`)
    if (fotos.length >= 3) break
  }
  return fotos
}

export function bandaDeDeseosHtml({ vista, titulo, lema = '', cifras = [], cartas = [] }) {
  return bandaSeccionHtml({
    ceja: `Deseos y cambios · ${VISTAS[vista] || ''}`,
    titulo,
    lema,
    cifras,
    derecha: abanicoHtml(fotosDe(cartas)),
  }).replace('<section class="banda-s"', `<section class="banda-s mc-banda-deseos" data-banda="${vista}"`)
}

// «1.240» con su punto de miles.
export const miles = (n) => Number(n || 0).toLocaleString('es-ES', { useGrouping: 'always' })
