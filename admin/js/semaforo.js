// El semáforo de las pasadas de TCGGO en /admin (tanda 817, QU2).
//
// El estado entero sigue en la caja de texto de debajo; esto es lo que se
// mira primero: una luz por pasada. Rojo = está PARADA (y no se quita sola o
// no hasta mañana); ámbar = ha fallado algo hace poco o lleva más de un día
// sin escribir; verde = nada que mirar; gris = no ha corrido nunca. Va en su
// fichero, sin importar nada, para que la regla se pueda probar sola.
export const PASADAS = [
  ['tcggo_catalogo', 'Catálogo'],
  ['tcggo_pares', 'Pares'],
  ['tcggo_precios', 'Precios'],
  ['tcggo_reemplazos', 'Reemplazos'],
  ['tcggo_calco_jp', 'Japonés'],
  ['tcggo_sueltas', 'Sueltas'],
  ['tcggo_versiones', 'Versiones'],
  // El precio por idioma de las versiones que alguien tiene (929).
  ['tcggo_versiones_idioma', 'Versiones por idioma'],
  ['tcggo_productos', 'Productos'],
  ['jp_lineas_viejas', 'Líneas JP viejas'],
  // Lo de Scrydex y a mano (883, 884, 886): sin estar aquí, /admin no lo
  // lee y su bloque dice «todavía no ha corrido» de algo que corre.
  ['scrydex_decks_jp', 'Decks JP (Scrydex)'],
  ['decks_jp_a_mano', 'Decks JP a mano'],
  ['scrydex_rellenar_set', 'Relleno (Scrydex)'],
  // Las redes (902): lo que falla al publicar en X se apunta aquí.
  ['x_noticias', 'X (noticias)'],
]

const DIA_MS = 24 * 60 * 60 * 1000
const motivoDe = (x) => (typeof x === 'string' ? x : x?.motivo || x?.error || JSON.stringify(x))
const diaDe = (fecha) => new Date(fecha).toISOString().slice(0, 10)

export function semaforoDe(fila, ahora = new Date()) {
  if (!fila) return { luz: 'gris', motivo: 'no ha corrido nunca' }
  const v = fila.valor || {}
  const hoy = diaDe(ahora)
  // Un `parado` con día solo cuenta ESE día (las sueltas, el plan); sin día,
  // para hasta que alguien lo quite.
  if (v.parado && (typeof v.parado !== 'object' || !v.parado.dia || v.parado.dia === hoy)) return { luz: 'rojo', motivo: `parada: ${motivoDe(v.parado)}` }
  if (v.planBloqueado?.dia === hoy) return { luz: 'rojo', motivo: `el plan no da: ${motivoDe(v.planBloqueado)}` }
  const error = v.ultimoError
  if (error?.fecha && ahora - new Date(error.fecha) < DIA_MS) return { luz: 'ambar', motivo: `último error: ${motivoDe(error).slice(0, 120)}` }
  if (fila.updated_at && ahora - new Date(fila.updated_at) > DIA_MS) return { luz: 'ambar', motivo: 'más de un día sin escribir su estado' }
  return { luz: 'verde', motivo: v.hecho ? 'al día' : 'en marcha' }
}
