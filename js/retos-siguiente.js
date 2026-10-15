// A dónde ir al acabar un reto (tanda 860). Módulo aparte de retos-ui.js a
// propósito: lo importa también el cuestionario (/reto, en curso.js), que
// no carga css/retos-juego.css, y arrastrar retos-ui.js le llevaría las
// clases de los premios sin su hoja (la guarda de la 299). Aquí no hay CSS
// propio: los dos botones son los de siempre.
import { escapeHtml } from './html.js'
import { icons } from './icons.js'
import { RETOS, resumenLocal, resumenDeBase } from './retos-xp.js'

// Antes la pantalla del resultado se
// quedaba ahí: para jugar otro había que volver al menú. Ahora el final
// ofrece el SIGUIENTE que te quede hoy —el primero de la lista del menú
// después del actual, dando la vuelta— y, debajo, «Volver a los retos».
// `hecho(juego)` dice si ese ya está hecho; puro, para probarlo.
export function siguienteReto(actual, hecho, retos = RETOS) {
  const i = retos.findIndex((r) => r.juego === actual)
  const orden = i < 0 ? retos : [...retos.slice(i + 1), ...retos.slice(0, i)]
  return orden.find((r) => r.juego !== actual && !hecho(r.juego)) || null
}

// Lo que sabe el navegador de hoy (lo mismo que lee el menú de /retos) y,
// si se tienen, los números de la base (`misNumeros(1).hoy`).
export function hechoHoy(dia, numerosHoy = null) {
  const leer = (clave) => { try { return JSON.parse(localStorage.getItem(clave) || 'null') } catch { return null } }
  return (juego) => {
    const reto = RETOS.find((r) => r.juego === juego)
    return Boolean(resumenDeBase(juego, numerosHoy?.[juego])?.hecho || resumenLocal(juego, reto?.local ? leer(reto.local) : null, dia)?.hecho)
  }
}

// Los botones: el siguiente (grande), «Compartir mi día» (870: los seis de
// hoy en un texto o una imagen; con `dia`) y la vuelta al menú. Sin
// siguiente —todos hechos—, solo la vuelta, y lo dice.
export function siguienteRetoHtml(siguiente, { dia = null } = {}) {
  const miDia = dia ? `<button type="button" class="btn-secondary rj-mi-dia" data-mi-dia="${escapeHtml(dia)}">${icons.share(16)} Compartir mi día</button>` : ''
  return `${siguiente ? `<a class="btn-primary rj-siguiente" href="${escapeHtml(siguiente.ruta)}">Siguiente: ${escapeHtml(siguiente.titulo)} →</a>` : ''}${miDia}<a class="btn-secondary rj-volver-retos" href="/retos">${siguiente ? 'Volver a los retos' : 'Todos hechos por hoy · Volver a los retos'}</a>`
}

// El botón de arriba, en cualquier pantalla que lo pinte: abre la hoja con
// lo de hoy. Lo que la pantalla acaba de jugar ya está en localStorage
// cuando se pinta el final, así que no hay que pasarle nada.
if (typeof document !== 'undefined') {
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-mi-dia]')
    if (!b) return
    import('./mi-dia-compartir.js').then(({ compartirMiDia }) => compartirMiDia({ dia: b.dataset.miDia })).catch(() => {})
  })
}
