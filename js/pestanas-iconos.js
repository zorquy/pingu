// LOS ICONOS DE UNA FILA DE PESTAÑAS (tanda 1366, PINGU: «se pierden los
// iconos que tenía en la burbuja… ¿no sería mejor añadirlos para que sea
// más visual?»). Al juntar páginas en Jugar (Mazos: Meta · Los míos ·
// Probar; Partidas, con Repeticiones), lo que antes era un icono de la
// burbuja pasó a una fila de `.seg` con solo el nombre. Cada pestaña lleva
// ahora `<span class="seg-ico" data-seg-icono="…">` y esto le pone el dibujo
// de js/icons.js. El hueco (18 px) lo reserva components.css desde el primer
// pintado, así que llegar después no mueve nada.
//
// Entra por `import()` desde app.js solo si la página tiene alguna.
import { icons } from './icons.js'

export function pintarIconosDePestanas(raiz = document) {
  for (const el of raiz.querySelectorAll('[data-seg-icono]')) {
    if (el.firstElementChild) continue
    const dibujo = icons[el.dataset.segIcono]
    if (dibujo) el.innerHTML = dibujo(18)
  }
}

pintarIconosDePestanas()
