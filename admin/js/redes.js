// /admin → Redes (tanda 903): el carrusel de presentación, generado con las
// cartas y los logos del catálogo, para descargarlo y subirlo a mano.
//
// Entra por `import()` al abrir la sección: lo que dibuja son diez lienzos
// de 1080 × 1350 y nadie más los necesita. El dibujo vive en
// js/redes-carrusel.js; aquí solo la pantalla: el botón, las vistas previas
// y las descargas.
import { supabase } from '../../js/supabase.js'
import { showToast } from '../../js/toast.js'
import { descargarLienzo } from '../../js/imagen-compartir.js'
import { cargarDatosDelCarrusel, dibujarCarrusel, DIAPOSITIVAS } from '../../js/redes-carrusel.js'

let montado = false

export function montarRedes() {
  if (montado) return
  montado = true
  const boton = document.getElementById('btnRedesCarrusel')
  const todas = document.getElementById('btnRedesDescargarTodas')
  const rejilla = document.getElementById('redesLienzos')
  const aviso = document.getElementById('redesAviso')
  if (!boton || !rejilla) return

  let lienzos = []

  boton.addEventListener('click', async () => {
    boton.disabled = true
    boton.textContent = 'Dibujando…'
    aviso.hidden = true
    rejilla.innerHTML = ''
    try {
      // Las fuentes tienen que estar ANTES de dibujar: un lienzo no espera a
      // que lleguen, y sin ellas la «P» y los títulos salen con la del sistema.
      await Promise.all([document.fonts.load('600 80px Fredoka'), document.fonts.load('700 70px Inter'), document.fonts.load('400 27px Inter')]).catch(() => {})
      const { datos, avisos } = await cargarDatosDelCarrusel(supabase)
      lienzos = await dibujarCarrusel(datos)
      lienzos.forEach((lienzo, i) => {
        const caja = document.createElement('figure')
        caja.className = 'redes-diapo'
        lienzo.className = 'redes-lienzo'
        lienzo.setAttribute('aria-label', `Diapositiva ${i + 1}: ${DIAPOSITIVAS[i].titulo}`)
        caja.appendChild(lienzo)
        const pie = document.createElement('figcaption')
        pie.innerHTML = `<span>${i + 1} · ${DIAPOSITIVAS[i].titulo}</span>`
        const bajar = document.createElement('button')
        bajar.className = 'btn-secondary'
        bajar.type = 'button'
        bajar.textContent = 'Descargar'
        bajar.addEventListener('click', () => descargarLienzo(lienzo, nombreDe(i)))
        pie.appendChild(bajar)
        caja.appendChild(pie)
        rejilla.appendChild(caja)
      })
      todas.hidden = false
      if (avisos.length) {
        aviso.hidden = false
        aviso.textContent = `Con lo que hay: ${avisos.join(' · ')}.`
      }
      showToast('Carrusel listo: descárgalo y súbelo en ese orden.', 'success')
    } catch (e) {
      showToast(`No se ha podido dibujar: ${e?.message || e}`, 'error')
    } finally {
      boton.disabled = false
      boton.textContent = 'Generar el carrusel'
    }
  })

  // Diez descargas seguidas: el navegador pregunta una vez si deja varias.
  todas.addEventListener('click', async () => {
    for (let i = 0; i < lienzos.length; i++) {
      await descargarLienzo(lienzos[i], nombreDe(i))
      await new Promise((r) => setTimeout(r, 350))
    }
  })
}

const nombreDe = (i) => `pokedoc-carrusel-${String(i + 1).padStart(2, '0')}.png`
