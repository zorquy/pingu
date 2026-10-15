// LA HOJA DE COMPARTIR (871), una para toda la web.
//
// Hasta ahora cada pantalla tenía sus botones («Presumir de resultado»,
// «Compartir como imagen», «Compartir lista», «Imagen»…) y ninguna enseñaba
// antes lo que iba a mandar. Aquí hay UNA pieza: tres pestañas —Texto,
// Historia (1080×1350, para Instagram) y Para X (1200×630, apaisada)—, la
// vista previa de lo que va a salir, y dos botones: «Compartir…» (la hoja
// del sistema: WhatsApp, Instagram, X; sin ella, al portapapeles o se
// descarga y se abre X) y «Copiar» / «Descargar».
//
//   abrirHojaCompartir({ titulo, texto, imagen, nombre })
//     texto:  lo que se pega (con sus emojis, la norma de la 568)
//     imagen: (formato) => canvas | Promise<canvas>, con formato 'historia'
//             o 'apaisada'; sin `imagen`, solo la pestaña de texto
//     nombre: el del fichero, sin extensión («mi-dia-77»)
//
// Es un <dialog>: desde abajo en el móvil, centrado en el PC. Entra por
// `import()` y mete su hoja: la portada no paga nada.
import { escapeHtml } from './html.js'
import { hojaInyectada } from './hoja.js'
import { icons } from './icons.js'
import { showToast } from './toast.js'

const PESTANAS = [
  ['texto', 'Texto'],
  ['historia', 'Historia'],
  ['apaisada', 'Para X'],
]

let dialogo = null

function asegurarDialogo() {
  if (dialogo) return dialogo
  dialogo = document.createElement('dialog')
  dialogo.className = 'ch-hoja'
  dialogo.setAttribute('aria-labelledby', 'chTitulo')
  document.body.appendChild(dialogo)
  dialogo.addEventListener('click', (e) => {
    // Tocar el velo (el propio <dialog>, fuera de su caja) cierra.
    if (e.target === dialogo) dialogo.close()
  })
  return dialogo
}

async function copiar(texto) {
  try {
    await navigator.clipboard.writeText(texto)
    showToast('Copiado. ¡Pégalo donde quieras presumir!', 'success')
    return true
  } catch {
    showToast('No se ha podido copiar.')
    return false
  }
}

export async function abrirHojaCompartir({ titulo = 'Compartir', texto = '', imagen = null, nombre = 'pokedoc' } = {}) {
  await hojaInyectada('css/compartir-hoja.css')
  const d = asegurarDialogo()
  const conImagen = typeof imagen === 'function'
  const pestanas = conImagen ? PESTANAS : PESTANAS.slice(0, 1)
  let activa = 'texto'
  const lienzos = {}

  d.innerHTML = `
    <div class="ch-caja">
      <span class="ch-tirador" aria-hidden="true"></span>
      <div class="ch-cabeza">
        <h2 class="ch-titulo" id="chTitulo">${escapeHtml(titulo)}</h2>
        <button type="button" class="ch-cerrar" data-ch-cerrar aria-label="Cerrar">${icons.xCircle(20)}</button>
      </div>
      ${
        pestanas.length > 1
          ? `<div class="seg ch-pestanas" role="tablist" aria-label="Qué compartir">${pestanas
              .map(([id, nombreP]) => `<button type="button" class="seg-btn" role="tab" data-ch-pestana="${id}" aria-pressed="${id === activa}">${escapeHtml(nombreP)}</button>`)
              .join('')}</div>`
          : ''
      }
      <div class="ch-previa" id="chPrevia"></div>
      <div class="ch-acciones">
        <button type="button" class="btn-primary ch-compartir" data-ch-compartir>${icons.share(16)} Compartir…</button>
        <button type="button" class="btn-secondary ch-copiar" data-ch-copiar>${icons.link(16)} Copiar</button>
      </div>
      <p class="ch-nota" id="chNota"></p>
    </div>`

  const previa = d.querySelector('#chPrevia')
  const nota = d.querySelector('#chNota')
  const btnCopiar = d.querySelector('[data-ch-copiar]')

  async function lienzoDe(formato) {
    if (!lienzos[formato]) lienzos[formato] = await imagen(formato)
    return lienzos[formato]
  }

  async function pintar() {
    for (const b of d.querySelectorAll('[data-ch-pestana]')) b.setAttribute('aria-pressed', String(b.dataset.chPestana === activa))
    if (activa === 'texto') {
      previa.innerHTML = `<pre class="ch-texto">${escapeHtml(texto)}</pre>`
      btnCopiar.innerHTML = `${icons.link(16)} Copiar`
      nota.textContent = 'El texto, tal cual se pega en WhatsApp o en X.'
      return
    }
    previa.innerHTML = `<p class="ch-cargando">Dibujando la imagen…</p>`
    btnCopiar.innerHTML = `${icons.upload(16)} Descargar`
    nota.textContent = activa === 'historia' ? 'Vertical, para una historia de Instagram o TikTok.' : 'Apaisada, para X y para donde la vertical se recorta.'
    try {
      const lienzo = await lienzoDe(activa)
      if (activa === 'texto') return
      const img = document.createElement('img')
      img.alt = 'La imagen que se va a compartir'
      img.className = `ch-imagen ch-${activa}`
      img.src = lienzo.toDataURL('image/png')
      previa.replaceChildren(img)
    } catch {
      previa.innerHTML = `<p class="ch-cargando">No se ha podido dibujar la imagen.</p>`
    }
  }

  d.addEventListener('click', async (e) => {
    const p = e.target.closest('[data-ch-pestana]')
    if (p) {
      activa = p.dataset.chPestana
      pintar()
      return
    }
    if (e.target.closest('[data-ch-cerrar]')) return d.close()
    if (e.target.closest('[data-ch-copiar]')) {
      if (activa === 'texto') return copiar(texto)
      const { descargarLienzo } = await import('./imagen-compartir.js')
      return descargarLienzo(await lienzoDe(activa), `${nombre}${activa === 'apaisada' ? '-x' : ''}.png`)
    }
    if (e.target.closest('[data-ch-compartir]')) {
      if (activa === 'texto') {
        try {
          if (navigator.share) {
            await navigator.share({ text: texto })
            return
          }
        } catch (err) {
          if (err?.name === 'AbortError') return
        }
        return copiar(texto)
      }
      const { compartirLienzo } = await import('./imagen-compartir.js')
      return compartirLienzo(await lienzoDe(activa), { nombreFichero: `${nombre}${activa === 'apaisada' ? '-x' : ''}.png`, texto })
    }
  }, { once: false })

  pintar()
  if (!d.open) d.showModal()
  return d
}
