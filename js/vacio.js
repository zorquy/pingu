// Ninguna página vacía sin salida (tanda 1325, D2 del plan): el molde común
// de un vacío. La mascota, qué irá aquí y dos salidas que hacen algo. Quien
// llega a una pantalla vacía y no ve un botón, se va.
import { escapeHtml } from './html.js'

// salidas: [{ texto, href, principal }] (la primera es la principal si nadie dice).
export function vacioHtml({ titulo, texto = '', salidas = [], mascota = true } = {}) {
  const botones = salidas.filter((s) => s?.texto && s?.href).slice(0, 2)
    .map((s, i) => `<a class="${(s.principal ?? i === 0) ? 'btn-primary' : 'btn-secondary'}" href="${escapeHtml(s.href)}">${escapeHtml(s.texto)}</a>`).join('')
  return `<div class="vacio" role="status">
      ${mascota ? '<span class="vacio-mascota mascota-3d" data-mascota="triste" data-vacio data-giro="-0.15"></span>' : ''}
      <h2 class="vacio-titulo">${escapeHtml(titulo)}</h2>
      ${texto ? `<p class="vacio-texto">${escapeHtml(texto)}</p>` : ''}
      ${botones ? `<div class="vacio-salidas">${botones}</div>` : ''}
    </div>`
}
