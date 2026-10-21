// El dibujo de cada VERSIÓN de una carta (tanda 930, PINGU con Dex
// delante: «al menos hazme iconos para las variantes más míticas, y para
// las reverse de Poké Ball, Quick Ball…»).
//
// No va en `js/icons.js` por lo de la 452: ese lo baja la portada, y estos
// solo se pintan en una expansión, una ficha o al añadir.
//
// Las de siempre van dibujadas con el trazo de la casa, y la regla que las
// distingue es la de la carta: en la Holo brilla el DIBUJO (la ventana,
// rellena) y en la Reverse brilla TODO LO DEMÁS (el marco relleno y la
// ventana limpia). Con un relleno suave y un destello no se distinguían de
// la normal a 16 px —se probó—: el relleno va macizo. Las Ball son los sprites de objetos de
// PokeAPI copiados a `assets/versiones/` (no enlazados: la 321, el día que
// se cayó Limitless), y su nombre de fichero es el id que ya sale de
// TCGGO («Poké Ball» → `poke-ball`). Una Ball nueva es un fichero más y una
// línea en `BOLAS`.
import { icon } from '../icons.js'
import { dibujoElegido } from './variantes.js'

// Un destello de cuatro puntas, relleno: a 16 px una estrella de trazo se
// empasta.
const destello = (x, y, r) => {
  const a = (r * 0.35).toFixed(2)
  const b = (r * 0.65).toFixed(2)
  return `<path d="M${x} ${y - r}l${a} ${b} ${b} ${a}-${b} ${a}L${x} ${y + r}l-${a}-${b}-${b}-${a} ${b}-${a}z" fill="currentColor" stroke="none"></path>`
}
const CARTA = '<rect x="5.5" y="2.5" width="13" height="19" rx="2.2"></rect><rect x="8" y="5.5" width="8" height="7" rx="1"></rect>'
const VENTANA = '<rect x="8" y="5.5" width="8" height="7" rx="1" fill="currentColor"></rect>'
const MARCO = '<path d="M7.7 2.5h8.6a2.2 2.2 0 0 1 2.2 2.2v14.6a2.2 2.2 0 0 1-2.2 2.2H7.7a2.2 2.2 0 0 1-2.2-2.2V4.7a2.2 2.2 0 0 1 2.2-2.2zM8 5.5v7h8v-7z" fill-rule="evenodd" fill="currentColor"></path>'

const DIBUJOS = {
  normal: CARTA,
  holo: CARTA + VENTANA,
  reverse: MARCO + CARTA,
  primera: '<circle cx="12" cy="12" r="8.5"></circle><path d="M10.4 9.2 12.6 7.6v8.8M10.2 16.4h4.6"></path>',
  cosmos: CARTA + destello(10, 7.8, 1.4) + destello(14, 9.6, 1.6) + destello(10.6, 11.2, 1),
  energia: '<circle cx="12" cy="12" r="8.5"></circle><path d="M13.2 6.6 9.4 12.6h3.2l-1 4.8 3.8-6h-3.2z"></path>',
  // Las de las versiones a mano (934): la metálica (la carta rayada en
  // diagonal, el brillo del metal), un sello (Pokémon Day, prerelease,
  // staff: un tampón redondo) y una estrella (lo demás que merece una).
  // Las ediciones de Wizards (935): la Unlimited con su infinito y la
  // Shadowless con la sombra del recuadro que le falta, a rayas.
  unlimited: '<circle cx="12" cy="12" r="8.5"></circle><path d="M8 12c0-1 .8-1.8 1.8-1.8 1.7 0 2.7 3.6 4.4 3.6 1 0 1.8-.8 1.8-1.8s-.8-1.8-1.8-1.8c-1.7 0-2.7 3.6-4.4 3.6-1 0-1.8-.8-1.8-1.8z"></path>',
  shadowless: CARTA + '<path d="M16.8 7v6.8H9.6" stroke-dasharray="1.6 1.6"></path>',
  metalica: CARTA + '<path d="M7.5 8.5l9 9M7.5 13.5l5.5 5.5M11 6l6.5 6.5"></path>',
  sello: '<circle cx="12" cy="12" r="8.5"></circle><circle cx="12" cy="12" r="4.5" stroke-dasharray="2 2"></circle>',
  estrella: '<path d="M12 4.5l2.2 4.6 5 .6-3.7 3.4 1 5-4.5-2.5-4.5 2.5 1-5-3.7-3.4 5-.6z" fill="currentColor" stroke="none"></path>',
  // La que no tiene dibujo propio: un destello solo. Cuando una salga a
  // menudo, se le hace el suyo.
  otra: destello(12, 12, 6),
}

// Los que se eligen para una versión a mano en /admin (934), con su nombre.
export const ICONOS_A_ELEGIR = [
  ['metalica', 'Metálica'], ['sello', 'Sello'], ['estrella', 'Estrella'], ['holo', 'Holo'], ['reverse', 'Reverse'],
  ['primera', '1.ª edición'], ['unlimited', 'Unlimited'], ['shadowless', 'Shadowless'], ['cosmos', 'Cosmos'], ['energia', 'Energía'], ['normal', 'Normal'], ['otra', 'Destello'],
]

// El dibujo que eligió quien la hizo a mano manda sobre lo que se deduce del
// nombre: «Metal Card» no dice «metálica» a ninguna regla. Lo apunta
// `pegarVersiones` en variantes.js (935: allí y no aquí, para que quien
// pide la lista de versiones no arrastre los iconos y sus clases a páginas
// que no cargan su hoja, la 299).

export const BOLAS = ['poke-ball', 'great-ball', 'ultra-ball', 'master-ball', 'quick-ball', 'friend-ball', 'love-ball', 'dusk-ball', 'premier-ball', 'heal-ball', 'luxury-ball']

// Qué dibujo lleva un id de versión. Los de TCGGO llegan hechos id de su
// etiqueta (`varianteDeEtiqueta`), así que «Reverse Holo (Poké Ball)» o
// «Poké Ball Pattern» también tienen que caer en su Ball: se busca la Ball
// DENTRO del id, la más larga primero («master-ball» antes que nada que
// acabe en «ball»).
const BOLAS_POR_LARGO = [...BOLAS].sort((a, b) => b.length - a.length)
export function dibujoDeVersion(id) {
  const v = String(id || 'normal').toLowerCase()
  const elegido = dibujoElegido(v)
  if (elegido && (DIBUJOS[elegido] || BOLAS.includes(elegido))) return BOLAS.includes(elegido) ? { tipo: 'bola', clave: elegido } : { tipo: 'svg', clave: elegido }
  if (DIBUJOS[v] && v !== 'otra') return { tipo: 'svg', clave: v }
  const bola = BOLAS_POR_LARGO.find((b) => v.includes(b))
  if (bola) return { tipo: 'bola', clave: bola }
  if (/cosmos/.test(v)) return { tipo: 'svg', clave: 'cosmos' }
  if (/energy|energia/.test(v)) return { tipo: 'svg', clave: 'energia' }
  if (/(^|-)1st|first-edition|primera/.test(v)) return { tipo: 'svg', clave: 'primera' }
  if (/unlimited/.test(v)) return { tipo: 'svg', clave: 'unlimited' }
  if (/shadowless/.test(v)) return { tipo: 'svg', clave: 'shadowless' }
  if (/stamp|prerelease|winner|celebration|poketour/.test(v)) return { tipo: 'svg', clave: 'sello' }
  if (/reverse/.test(v)) return { tipo: 'svg', clave: 'reverse' }
  if (/holo/.test(v)) return { tipo: 'svg', clave: 'holo' }
  return { tipo: 'svg', clave: 'otra' }
}

// El HTML del icono. Va SIN nombre (aria-hidden): quien lo pinta pone el
// nombre al lado o en la etiqueta de su caja.
export function iconoDeVersion(id, size = 16) {
  const d = dibujoDeVersion(id)
  if (d.tipo === 'bola') {
    // El sprite mide 30 × 30 con aire alrededor de la bola: un poco más
    // grande que el SVG para que la bola se vea del mismo tamaño.
    // El tamaño va también en `style`: las fotos de carta de la expansión
    // (`.mc-bolsillo img`) llevan `width: 100%` y la estiraban.
    const px = Math.round(size * 1.25)
    return `<img class="icono-version icono-bola" src="/assets/versiones/${d.clave}.png" width="${px}" height="${px}" style="width:${px}px;height:${px}px" alt="" loading="lazy" aria-hidden="true" />`
  }
  return icon(DIBUJOS[d.clave], size).replace('<svg ', `<svg class="icono-version" data-dibujo="${d.clave}" `)
}
