// LA HOJA DE COMPARTIR (871; por redes desde la 988), una para toda la web.
//
// PINGU (988): «quitaría la opción de texto y pondría dos: Instagram o X; en
// Instagram, que sea una story o un post; y que puedas compartirlo o
// descargarlo». Así que dos pestañas —Instagram y X— y, en Instagram, dos
// formas: Historia (1080×1920, la pantalla entera) y Publicación (1080×1350,
// lo más alto que el muro enseña sin recortar). En X, la apaisada (1200×630)
// y «Publicar en X» con el texto. Debajo, «Compartir…» (la hoja del sistema;
// sin ella, se descarga) y «Descargar».
//
//   abrirHojaCompartir({ titulo, texto, imagen, nombre, x })
//     texto:  lo que acompaña a la imagen y lo que se escribe en X (con sus
//             emojis, la norma de la 568)
//     imagen: (formato) => canvas | Promise<canvas>, con formato 'historia'
//             (la vertical de 1080×1350) o 'apaisada'. La historia de
//             1080×1920 la monta ESTA hoja con la vertical encima de su
//             propio fondo, así ninguna pantalla tiene que dibujar tres
//             formas. Sin `imagen`, solo el texto (Compartir y Copiar).
//     nombre: el del fichero, sin extensión («mi-dia-77»)
//     x:      { texto, url } (880): lo que se escribe en X; sin él, `texto`
//
// Es un <dialog>: desde abajo en el móvil, centrado en el PC. Entra por
// `import()` y mete su hoja: la portada no paga nada.
import { escapeHtml } from './html.js'
import { hojaInyectada } from './hoja.js'
import { icon, icons } from './icons.js'
import { showToast } from './toast.js'

// Dos iconos que solo se ven aquí: dibujados aquí y no en icons.js, que lo
// baja la portada (la 452).
const iconoInstagram = (s) => icon('<rect x="2" y="2" width="20" height="20" rx="5"></rect><circle cx="12" cy="12" r="4"></circle><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>', s)
const iconoDescargar = (s) => icon('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line>', s)

// Las formas que se pueden mandar: de qué red son, qué dibujo piden a la
// pantalla y cómo se llama el fichero.
export const FORMAS = {
  historia: { red: 'instagram', nombre: 'Historia', pide: 'historia', sufijo: '-historia', medida: '1080 × 1920 · vertical, para una historia' },
  publicacion: { red: 'instagram', nombre: 'Publicación', pide: 'historia', sufijo: '', medida: '1080 × 1350 · para el muro, sin recortes' },
  apaisada: { red: 'x', nombre: 'Para X', pide: 'apaisada', sufijo: '-x', medida: '1200 × 630 · apaisada, como la tarjeta de X' },
}
export const ALTO_HISTORIA = 1920

// La historia de verdad: la vertical (1080×1350) en medio de un lienzo de
// 1080×1920 cuyo fondo es ella misma, ampliada y desenfocada. Así no hay
// bandas de color de otra cosa y vale para cualquier dibujo.
export function historiaDe(vertical, doc = document) {
  const W = vertical.width || 1080
  const H = Math.round((W * ALTO_HISTORIA) / 1080)
  const lienzo = doc.createElement('canvas')
  lienzo.width = W
  lienzo.height = H
  const ctx = lienzo.getContext('2d')
  const escala = Math.max(W / vertical.width, H / vertical.height)
  const fw = vertical.width * escala
  const fh = vertical.height * escala
  ctx.save()
  ctx.filter = 'blur(48px) brightness(0.7)'
  ctx.drawImage(vertical, (W - fw) / 2, (H - fh) / 2, fw, fh)
  ctx.restore()
  // La vertical, a lo ancho y con un margen pequeño, centrada.
  const m = Math.round(W * 0.04)
  const w = W - m * 2
  const h = Math.round((vertical.height * w) / vertical.width)
  const x = m
  const y = Math.round((H - h) / 2)
  ctx.save()
  ctx.shadowColor = 'rgba(0, 0, 0, 0.45)'
  ctx.shadowBlur = 40
  ctx.shadowOffsetY = 12
  ctx.beginPath()
  ctx.roundRect?.(x, y, w, h, 32)
  if (!ctx.roundRect) ctx.rect(x, y, w, h)
  ctx.fillStyle = '#000'
  ctx.fill()
  ctx.restore()
  ctx.save()
  ctx.beginPath()
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, 32)
  else ctx.rect(x, y, w, h)
  ctx.clip()
  ctx.drawImage(vertical, x, y, w, h)
  ctx.restore()
  return lienzo
}

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

// «Compartir…» con la imagen: la hoja del sistema si deja mandar ficheros
// (el móvil: Instagram, WhatsApp, X); si no (el PC), se descarga y se dice.
async function compartirImagen(lienzo, nombreFichero, texto) {
  const { comoBlob, descargarLienzo } = await import('./imagen-compartir.js')
  try {
    const fichero = new File([await comoBlob(lienzo)], nombreFichero, { type: 'image/png' })
    if (navigator.canShare?.({ files: [fichero] })) {
      await navigator.share({ files: [fichero], text: texto })
      return
    }
  } catch (err) {
    if (err?.name === 'AbortError') return
  }
  await descargarLienzo(lienzo, nombreFichero)
  showToast('Descargada. Súbela desde tu galería.', 'success')
}

export async function abrirHojaCompartir({ titulo = 'Compartir', texto = '', imagen = null, nombre = 'pokedoc', x = null } = {}) {
  await hojaInyectada('css/compartir-hoja.css')
  const d = asegurarDialogo()
  const conImagen = typeof imagen === 'function'
  let forma = 'historia'
  const lienzos = {}
  const { direccionDeX } = await import('./compartir-x.js')
  const direccionX = direccionDeX(x?.texto ? x : { texto })
  // Lo que se escribe en X, tal cual sale en su cuadro: se enseña debajo de
  // la imagen en esa pestaña (la de texto ya no existe: 988).
  const textoX = x?.texto ? `${x.texto}${x.url ? `\n\n${x.url}` : ''}` : texto
  const red = () => FORMAS[forma].red

  d.innerHTML = `
    <div class="ch-caja">
      <span class="ch-tirador" aria-hidden="true"></span>
      <div class="ch-cabeza">
        <h2 class="ch-titulo" id="chTitulo">${escapeHtml(titulo)}</h2>
        <button type="button" class="ch-cerrar" data-ch-cerrar aria-label="Cerrar">${icons.xCircle(20)}</button>
      </div>
      ${conImagen ? `
      <div class="seg ch-pestanas" role="tablist" aria-label="Dónde compartir">
        <button type="button" class="seg-btn" role="tab" data-ch-red="instagram">${iconoInstagram(16)} Instagram</button>
        <button type="button" class="seg-btn" role="tab" data-ch-red="x" aria-label="X">${icons.xLogo(16)}</button>
      </div>
      <div class="seg ch-formas" id="chFormas" role="group" aria-label="Qué forma">
        <button type="button" class="seg-btn" data-ch-forma="historia">Historia</button>
        <button type="button" class="seg-btn" data-ch-forma="publicacion">Publicación</button>
      </div>` : ''}
      <div class="ch-previa" id="chPrevia"></div>
      <p class="ch-nota" id="chNota"></p>
      ${conImagen ? `<pre class="ch-texto ch-texto-x" id="chTextoX" hidden>${escapeHtml(textoX)}</pre>` : ''}
      <div class="ch-acciones">
        <button type="button" class="btn-primary ch-compartir" data-ch-compartir>${icons.share(16)} Compartir…</button>
        ${conImagen
          ? `<button type="button" class="btn-secondary ch-descargar" data-ch-descargar>${iconoDescargar(16)} Descargar</button>
             <a class="btn-secondary ch-x" data-ch-x href="${escapeHtml(direccionX)}" target="_blank" rel="noopener" hidden>${icons.xLogo(16)} Publicar en X</a>`
          : `<button type="button" class="btn-secondary ch-copiar" data-ch-copiar>${icons.link(16)} Copiar</button>`}
      </div>
    </div>`

  const previa = d.querySelector('#chPrevia')
  const nota = d.querySelector('#chNota')

  async function lienzoDe(f) {
    if (lienzos[f]) return lienzos[f]
    const dibujo = await imagen(FORMAS[f].pide)
    lienzos[f] = f === 'historia' ? historiaDe(dibujo) : dibujo
    return lienzos[f]
  }
  const fichero = () => `${nombre}${FORMAS[forma].sufijo}.png`

  let turno = 0
  async function pintar() {
    if (!conImagen) {
      previa.innerHTML = `<pre class="ch-texto">${escapeHtml(texto)}</pre>`
      nota.textContent = 'El texto, tal cual se pega en WhatsApp o en X.'
      return
    }
    const mio = ++turno
    for (const b of d.querySelectorAll('[data-ch-red]')) b.setAttribute('aria-pressed', String(b.dataset.chRed === red()))
    for (const b of d.querySelectorAll('[data-ch-forma]')) b.setAttribute('aria-pressed', String(b.dataset.chForma === forma))
    d.querySelector('#chFormas').hidden = red() !== 'instagram'
    d.querySelector('[data-ch-x]').hidden = red() !== 'x'
    d.querySelector('#chTextoX').hidden = red() !== 'x'
    nota.textContent = FORMAS[forma].medida
    previa.innerHTML = `<p class="ch-cargando">Dibujando la imagen…</p>`
    try {
      const lienzo = await lienzoDe(forma)
      if (mio !== turno) return
      const img = document.createElement('img')
      img.alt = 'La imagen que se va a compartir'
      img.className = `ch-imagen ch-${forma}`
      img.src = lienzo.toDataURL('image/png')
      previa.replaceChildren(img)
    } catch {
      if (mio === turno) previa.innerHTML = `<p class="ch-cargando">No se ha podido dibujar la imagen.</p>`
    }
  }

  d.onclick = async (e) => {
    if (e.target === d) return
    const r = e.target.closest('[data-ch-red]')
    if (r) {
      forma = r.dataset.chRed === 'x' ? 'apaisada' : 'historia'
      return pintar()
    }
    const f = e.target.closest('[data-ch-forma]')
    if (f) {
      forma = f.dataset.chForma
      return pintar()
    }
    if (e.target.closest('[data-ch-cerrar]')) return d.close()
    if (e.target.closest('[data-ch-copiar]')) return copiar(texto)
    if (e.target.closest('[data-ch-descargar]')) {
      const { descargarLienzo } = await import('./imagen-compartir.js')
      return descargarLienzo(await lienzoDe(forma), fichero())
    }
    if (e.target.closest('[data-ch-compartir]')) {
      if (conImagen) return compartirImagen(await lienzoDe(forma), fichero(), texto)
      try {
        if (navigator.share) return await navigator.share({ text: texto })
      } catch (err) {
        if (err?.name === 'AbortError') return
      }
      return copiar(texto)
    }
  }

  pintar()
  if (!d.open) d.showModal()
  return d
}
