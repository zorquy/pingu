// Lo de arriba de la ficha de un torneo (1346b): compartir, el calendario,
// el día del cartel de Info, «Inscribirme», buscar gente, lo pegado y los «⋯».
// Salió de torneo.js porque ese fichero tiene presupuesto (la 895: 31 KB
// gzip) y el rediseño de la 1341–1346 lo pasó. No guarda estado: lo que
// necesita del torneo se lo pide a `f` (torneo, inscripciones, activos,
// soloMirando, irAPestana) en el momento, que la ficha se recarga sola.
import { escapeHtml } from '../app.js'
import { showToast } from '../toast.js'
import { icons } from '../icons.js'
import { textoFormato } from './comun.js'
import { pintarSiCambia } from './pintar.js'

const $ = (id) => document.getElementById(id)

// ── Compartir el torneo (pedido de Ibai, 2026-09-02) ──
// La descripción, en dos líneas con «Más» en el móvil (1145, W1): entera,
// empujaba «Tu plaza» fuera de la pantalla. El recorte lo hace el CSS; aquí
// solo se pone el botón cuando de verdad hay más que leer.
export function ponerMasEnDescripcion(desc) {
  let mas = document.getElementById('torneoDescMas')
  if (!mas) {
    mas = document.createElement('button')
    mas.type = 'button'
    mas.id = 'torneoDescMas'
    mas.className = 'torneo-desc-mas'
    mas.textContent = 'Leer más'
    mas.addEventListener('click', () => {
      desc.classList.add('torneo-desc-abierta')
      mas.hidden = true
    })
    desc.after(mas)
  }
  requestAnimationFrame(() => {
    mas.hidden = desc.classList.contains('hidden') || desc.classList.contains('torneo-desc-abierta') || desc.scrollHeight <= desc.clientHeight + 2
  })
}

// El cartel de Info (1342): «NOV 22» en una caja y al lado el día y la hora.
export function cuandoHtml(iso) {
  const d = iso ? new Date(iso) : null
  if (!d || Number.isNaN(d.getTime())) return ''
  const mes = d.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '').toUpperCase()
  const dia = d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
  const hora = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  return `<span class="torneo-cuando-dia"><small>${escapeHtml(mes)}</small><b>${d.getDate()}</b></span>
    <span class="torneo-cuando-texto"><b>${escapeHtml(dia.charAt(0).toUpperCase() + dia.slice(1))}, ${escapeHtml(hora)}</b><span>Online · Pokémon TCG Live</span></span>`
}

// Se engancha UNA vez desde init(): la cabecera no se repinta, así que
// no hay listeners duplicados. En móvil sale la hoja de compartir del
// sistema; donde no la haya, el enlace va al portapapeles. La vista
// previa del enlace ya la pone meta-social.js al compartirse.
export function montarCompartir(f) {
  const boton = $('btnCompartirTorneo')
  if (!boton) return
  // La palabra va en su caja: en el móvil se queda el icono solo (1145).
  boton.innerHTML = `${icons.share(14)}<span class="torneo-cab-palabra">Compartir</span>`
  boton.addEventListener('click', async () => {
    // Con imagen (1336): el anuncio con las plazas que quedan o, terminado,
    // el podio; la misma pieza que saca el equipo en /admin → Redes. Un
    // torneo privado o en borrador no tiene pieza: va el enlace, como antes.
    try {
      const { piezasDeTorneo } = await import('../redes-textos.js')
      const nombres = Object.fromEntries(f.inscripciones().filter((i) => i.perfil?.username).map((i) => [i.user_id, i.perfil.username]))
      const piezas = piezasDeTorneo(f.torneo(), { inscritos: f.activos(), nombres })
      const pieza = piezas.find((p) => p.clave.endsWith(':resultados')) || piezas[0]
      if (pieza) {
        const { compartirPieza } = await import('../redes-compartir.js')
        await compartirPieza(pieza, { titulo: 'Compartir el torneo' })
        return
      }
    } catch (err) {
      console.warn('[torneo] compartir con imagen', err)
    }
    const url = new URL(`/torneo?slug=${encodeURIComponent(f.torneo().slug)}`, window.location.origin).href
    if (navigator.share) {
      // Cancelar la hoja del sistema llega como excepción: no es un
      // fallo y no hay nada que avisar.
      try {
        await navigator.share({ title: `${f.torneo().name} — PokeDoc`, url })
      } catch {}
      return
    }
    try {
      await navigator.clipboard.writeText(url)
      showToast('Enlace del torneo copiado. Pégalo donde quieras.', 'success')
    } catch {
      // Sin portapapeles (permiso denegado, http plano): al menos que
      // el enlace se vea para copiarlo a mano.
      window.prompt('Copia el enlace del torneo:', url)
    }
  })
}

// ── El anuncio en el foro (tanda 208) ──
// Si el hilo del torneo ya existe se enlaza; si no, el organizador elige
// foro y lo publica de un botón: título fijo «Torneo: nombre» (así se
// reencuentra), etiqueta Torneo y primer mensaje con los datos.
// «Añadir al calendario» (tanda 218): un .ics generado en el momento,
// sin servicio externo ni cuentas de nadie. Dos horas de duración por
// defecto — lo que dura un torneo pequeño — y el enlace a la ficha en
// la descripción, que es lo que uno busca cuando le salta el aviso.
export function ponerBotonCalendario(f, acciones) {
  if (['finished', 'cancelled'].includes(f.torneo().status) || !f.torneo().start_at) return
  // Desde la tanda 259 la caja de acciones ya no se vacía en cada
  // refresco (rehacerla movía la página), así que este botón tiene que
  // mirar si ya está puesto: si no, se añadía uno nuevo cada diez
  // segundos hasta tener cinco «Añadir al calendario» en fila.
  // Desde la 1145 iba en la cabecera, al lado de Compartir; desde la 1342, al
  // lado del día en el cartel de Info, que es donde se mira la fecha (la
  // cabecera de una línea no tenía sitio para un botón más en el móvil).
  const sitio = document.querySelector('.torneo-cuando-fila') || document.querySelector('.torneo-ficha-cabecera') || acciones
  if (document.getElementById('btnCalendario')) return
  const boton = document.createElement('button')
  boton.type = 'button'
  boton.className = 'torneo-compartir torneo-calendario'
  boton.id = 'btnCalendario'
  boton.setAttribute('aria-label', 'Añadir al calendario')
  boton.innerHTML = `${icons.calendar(14)}<span class="torneo-cab-palabra">Añadir al calendario</span>`
  boton.addEventListener('click', () => {
    const sello = (fecha) => new Date(fecha).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
    const inicio = new Date(f.torneo().start_at)
    const fin = new Date(inicio.getTime() + 2 * 3600 * 1000)
    // En un .ics las comas, los puntos y coma y las barras van
    // escapados, y las líneas se separan con CRLF: si no, el
    // calendario lo parte donde no debe.
    const limpio = (t) => String(t || '').replace(/([,;\\])/g, '\\$1').replace(/\r?\n/g, ' ')
    const enlace = `https://pokedoc.es/torneo?slug=${encodeURIComponent(f.torneo().slug)}`
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//PokeDoc//Torneos//ES',
      'BEGIN:VEVENT',
      `UID:torneo-${f.torneo().id}@pokedoc.es`,
      `DTSTAMP:${sello(Date.now())}`,
      `DTSTART:${sello(inicio)}`,
      `DTEND:${sello(fin)}`,
      `SUMMARY:${limpio(f.torneo().name)}`,
      `DESCRIPTION:${limpio(textoFormato(f.torneo()))} - ${enlace}`,
      `URL:${enlace}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n')
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `${f.torneo().slug || 'torneo'}.ics`
    a.click()
    URL.revokeObjectURL(url)
  })
  sitio.appendChild(boton)
}

export function pintarApuntarse(f) {
  const linea = $('torneoApuntarse')
  if (!linea) return
  const formulario = Boolean($('formInscripcion'))
  const sinCuenta = f.soloMirando() && f.torneo().status === 'registration_open'
  const hay = formulario || sinCuenta
  linea.classList.toggle('hidden', !hay)
  if (!hay) return
  const lleno = f.torneo().max_players != null && f.activos() >= f.torneo().max_players
  const plazas = f.torneo().max_players == null ? `${f.activos()} inscritos` : lleno ? 'Lleno · lista de espera' : `Quedan ${f.torneo().max_players - f.activos()} plazas`
  pintarSiCambia(
    linea,
    `<span class="torneo-apuntarse-texto"><b>Inscripciones abiertas</b><span>${escapeHtml(plazas)}</span></span>
     <button type="button" class="btn-primary" data-apuntarse>${sinCuenta ? 'Crear cuenta' : lleno ? 'Apuntarme a la espera' : 'Inscribirme'}</button>`
  )
}

// Tocar «Inscribirme» arriba lleva a Info y al formulario, con el cursor ya
// en tu usuario de TCG Live. Mientras «Tu plaza» se ve en pantalla, la línea
// sobra y se aparta.
export function engancharApuntarse(f) {
  const linea = $('torneoApuntarse')
  if (!linea) return
  linea.addEventListener('click', (e) => {
    if (!e.target.closest('[data-apuntarse]')) return
    if (f.soloMirando()) {
      $('miPlazaContenido')?.querySelector('a.btn-primary')?.click()
      return
    }
    f.irAPestana('torneo')
    const plaza = $('torneoMiPlaza')
    plaza?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setTimeout(() => $('inscripcionCodigo')?.focus() || $('inscripcionTcgLive')?.focus(), 350)
  })
  const plaza = $('torneoMiPlaza')
  if (plaza && 'IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => linea.classList.toggle('torneo-apuntarse-aparte', e.isIntersecting)).observe(plaza)
  }
}

// Buscar en la lista de inscritos (1342): en un torneo de 64 hace falta. Con
// pocos, la caja sobra y no sale.
export function engancharBuscarGente() {
  const caja = $('torneoBuscarGente')
  if (!caja) return
  caja.addEventListener('input', filtrarGente)
}

export function filtrarGente() {
  const caja = $('torneoBuscarGente')
  if (!caja) return
  const q = normalizarBusqueda(caja.value)
  for (const fila of document.querySelectorAll('#listaInscritos .torneo-inscrito')) {
    fila.hidden = Boolean(q) && !normalizarBusqueda(fila.textContent).includes(q)
  }
}

// Lo pegado arriba (1341). «Ir a tu mesa» de la pastilla es un enlace a
// #torneoMiPartida, que vive en la pestaña Mi mesa: con la pestaña cerrada
// el salto no iba a ningún sitio. Y el menú «⋯» se cierra al tocar fuera o
// al elegir algo, como cualquier menú.
export function engancharLoPegado(f) {
  document.getElementById('torneoPegado')?.addEventListener('click', (e) => {
    // «Ir a tu mesa» y, entre jornadas, «Tu lista» (1347): a su pestaña y a su caja.
    const enlace = e.target.closest('a[href="#torneoMiPartida"], a[data-ir-pestana]')
    if (!enlace) return
    e.preventDefault()
    f.irAPestana(enlace.dataset.irPestana || 'jugar')
    const destino = document.querySelector(enlace.getAttribute('href'))
    if (destino && enlace.dataset.irPestana) setTimeout(() => destino.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
    else window.scrollTo({ top: 0, behavior: 'smooth' })
  })
  // Vale para todos los «⋯» de la ficha (el de la cabecera y el del mando de
  // Rondas, 1344): se cierran al tocar fuera o al elegir algo de dentro.
  document.addEventListener('click', (e) => {
    for (const mas of document.querySelectorAll('details.torneo-mas[open]')) {
      if (!mas.contains(e.target)) mas.open = false
      else if (e.target.closest('.torneo-mas-menu button, .torneo-mas-menu a')) setTimeout(() => (mas.open = false), 0)
    }
  })
}

const normalizarBusqueda = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
