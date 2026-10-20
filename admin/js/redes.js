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
  montarRetoDeHoy()
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

// ── El reto de hoy, para la cuenta (907) ──
//
// Dos al día y sin el resultado de nadie: por la mañana «Ya está el reto de
// hoy» (la carta del día desenfocada y los temas) y por la noche «Así fue
// el reto» (los números de todos). Cada una en historia y en el formato de
// X, y con el texto del tuit para copiar. Lo puro vive en
// js/reto-portada.js y el dibujo en js/reto-imagen.js, igual que la imagen
// de quien juega.
export function montarRetoDeHoy() {
  const dia = document.getElementById('redesRetoDia')
  const manana = document.getElementById('btnRedesRetoManana')
  const noche = document.getElementById('btnRedesRetoNoche')
  if (!dia || !manana || !noche || manana.dataset.montado) return
  manana.dataset.montado = '1'
  dia.value = new Date().toISOString().slice(0, 10)
  const rejilla = document.getElementById('redesRetoLienzos')
  const aviso = document.getElementById('redesRetoAviso')
  const tuit = document.getElementById('redesRetoTuit')
  const texto = document.getElementById('redesRetoTexto')
  document.getElementById('btnRedesRetoCopiar')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(texto.value)
      showToast('Texto copiado', 'success')
    } catch {
      texto.select()
    }
  })

  const ocupado = (boton, si, rotulo) => {
    boton.disabled = si
    boton.textContent = si ? 'Dibujando…' : rotulo
  }
  const pintar = (lienzos, nombre) => {
    rejilla.innerHTML = ''
    for (const [formato, lienzo] of lienzos) {
      const caja = document.createElement('figure')
      caja.className = 'redes-diapo'
      lienzo.className = 'redes-lienzo'
      lienzo.dataset.formato = formato
      lienzo.setAttribute('aria-label', `${nombre}, ${formato === 'apaisada' ? 'para X' : 'para historias'}`)
      caja.appendChild(lienzo)
      const pie = document.createElement('figcaption')
      pie.innerHTML = `<span>${formato === 'apaisada' ? 'X · 1200 × 630' : 'Historia · 1080 × 1350'}</span>`
      const bajar = document.createElement('button')
      bajar.className = 'btn-secondary'
      bajar.type = 'button'
      bajar.textContent = 'Descargar'
      bajar.addEventListener('click', () => descargarLienzo(lienzo, `${nombre}-${formato}.png`))
      pie.appendChild(bajar)
      caja.appendChild(pie)
      rejilla.appendChild(caja)
    }
  }

  manana.addEventListener('click', async () => {
    ocupado(manana, true, 'La de la mañana')
    aviso.hidden = true
    try {
      const [{ preguntasDelDia }, portadaMod, { pintarAnuncioReto }, { numeroDelDia }] = await Promise.all([
        import('../../js/reto-diario.js'), import('../../js/reto-portada.js'), import('../../js/reto-imagen.js'), import('../../js/reto-compartir.js'),
      ])
      const preguntas = await preguntasDelDia(dia.value)
      if (!preguntas.length) throw new Error('ese día no hay reto: hacen falta cursos publicados con preguntas')
      const numero = numeroDelDia(dia.value)
      const temas = portadaMod.temasDelReto(preguntas)
      const { foto, tono } = await fotoDeLaPortada(portadaMod, preguntas)
      if (!foto) avisar('Ninguna pregunta de ese día trae carta ni imagen, o no se ha podido cargar: sale con un «?» sobre fondo liso.')
      pintar(['historia', 'apaisada'].map((formato) => [formato, pintarAnuncioReto(document.createElement('canvas'), { numero, temas, foto, tono, formato })]), `reto-${numero}-manana`)
      texto.value = portadaMod.textoDelAnuncio({ numero, temas })
      tuit.hidden = false
    } catch (e) {
      showToast(`No se ha podido dibujar: ${e?.message || e}`, 'error')
    } finally {
      ocupado(manana, false, 'La de la mañana')
    }
  })

  noche.addEventListener('click', async () => {
    ocupado(noche, true, 'La de la noche')
    aviso.hidden = true
    try {
      const [{ preguntasDelDia }, portadaMod, { pintarResumenReto }, { numeroDelDia }, { claveDePregunta }, { estadisticasDelCurso }] = await Promise.all([
        import('../../js/reto-diario.js'), import('../../js/reto-portada.js'), import('../../js/reto-imagen.js'), import('../../js/reto-compartir.js'),
        import('../../js/curso-juego.js'), import('../../js/curso-datos.js'),
      ])
      const numero = numeroDelDia(dia.value)
      // A trozos: Supabase corta cada respuesta a 1.000 filas sin avisar (808).
      const filas = []
      for (let desde = 0; desde < 20000; desde += 1000) {
        const { data, error } = await supabase.from('daily_challenge_results').select('correct,total').eq('day', dia.value).range(desde, desde + 999)
        if (error) throw new Error(error.message)
        filas.push(...(data || []))
        if (!data || data.length < 1000) break
      }
      const resumen = portadaMod.resumenDeResultados(filas)
      if (!resumen.jugadores) avisar('Ese día todavía no ha jugado nadie (o nadie con la actividad visible).')
      const preguntas = await preguntasDelDia(dia.value)
      const stats = {}
      for (const id of [...new Set(preguntas.map((p) => p.__guideId))]) {
        const deGuia = await estadisticasDelCurso(id)
        for (const [clave, v] of Object.entries(deGuia)) stats[`${id}|${clave}`] = v
      }
      const dificil = portadaMod.laMasDificil(preguntas, stats, claveDePregunta)
      pintar(['historia', 'apaisada'].map((formato) => [formato, pintarResumenReto(document.createElement('canvas'), { numero, resumen, dificil, formato })]), `reto-${numero}-noche`)
      texto.value = portadaMod.textoDelResumen({ numero, resumen, dificil })
      tuit.hidden = false
    } catch (e) {
      showToast(`No se ha podido dibujar: ${e?.message || e}`, 'error')
    } finally {
      ocupado(noche, false, 'La de la noche')
    }
  })

  function avisar(t) {
    aviso.hidden = false
    aviso.textContent = t
  }
}

// La foto de la portada de un día: la carta (por su cadena de escaneos) o
// la imagen de la pregunta. Sin red o sin carta, nada.
async function fotoDeLaPortada({ portadaDelReto, tonoDeCarta }, preguntas) {
  const portada = portadaDelReto(preguntas)
  if (!portada) return { foto: null, tono: null }
  const { fotoParaElLienzo } = await import('../../js/imagen-compartir.js')
  if (portada.tipo === 'imagen') return { foto: await fotoParaElLienzo([portada.url]), tono: null }
  const [{ cardsByIds }, { cadenaDeEscaneo }] = await Promise.all([import('../../js/tcgdex.js'), import('../../js/escaneo-carta.js')])
  const [carta] = await cardsByIds([portada.id]).catch(() => [])
  if (!carta) return { foto: null, tono: null }
  return { foto: await fotoParaElLienzo(cadenaDeEscaneo(carta, carta.tcg_sets?.tcg_online_code || null, 'high')), tono: tonoDeCarta(carta) }
}
