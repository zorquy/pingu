// Exportar una decklist (tanda 219): copiar el texto tal cual al
// portapapeles (para pegarlo directo en TCG Live) y bajarla como imagen
// PNG.
//
// El dibujado de la imagen vive en decklist-imagen.js desde la tanda
// 358: no pinta ni una clase y lo usa también el constructor de mazos,
// que no carga torneos.css. Aquí quedan el portapapeles y los BOTONES
// (`.torneo-exportar`, que sí es de torneos.css); la imagen se reexporta
// para que las páginas de torneos sigan importando de un solo sitio.
import { showToast } from '../toast.js'
import { descargarImagenDecklist } from './decklist-imagen.js'

export { descargarImagenDecklist }

export async function copiarDecklist(rawText) {
  try {
    await navigator.clipboard.writeText(rawText || '')
    showToast('Lista copiada: pégala donde quieras.', 'success')
  } catch {
    showToast('No se ha podido copiar (el navegador lo ha impedido).', 'error')
  }
}

// Los dos botones juntos, listos para insertar en cualquier caja. Quien
// los pinta llama después a engancharExportar con los datos.
export function botonesExportarHtml() {
  return `
    <span class="torneo-exportar">
      <button type="button" class="btn-secondary" data-exportar-copiar>Copiar lista</button>
      <button type="button" class="btn-secondary" data-exportar-imagen>Descargar imagen</button>
    </span>`
}

export function engancharExportar(raiz, { nombre, rawText, parsed }) {
  raiz.querySelector('[data-exportar-copiar]')?.addEventListener('click', () => copiarDecklist(rawText))
  raiz.querySelector('[data-exportar-imagen]')?.addEventListener('click', () => descargarImagenDecklist(nombre, parsed))
}
