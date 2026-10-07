// LA FICHA DE UNA CARTA EN EL MÓVIL (716: F1, F2 y F4 de la lista de
// propuestas, elegidas por PINGU). En un iPhone la ficha eran 2.600 px
// seguidos: la carta, su ficha, los ataques, las otras versiones, el precio
// y el histórico, uno debajo de otro.
//
//  · F1 — LA CABECERA INMERSIVA: la carta sobre su propio arte, difuminado
//    detrás, y debajo del nombre el precio en una línea (el que dice el
//    bloque de precio, copiado de él: una sola fuente).
//  · F2 — PESTAÑAS: Resumen, Precio, Historial y Versiones, en una barra
//    que se pega arriba. No se mueve NI SE BORRA nada: las pestañas solo
//    esconden lo que no toca, así que la página entera sigue en el HTML
//    (es lo que lee Google) y en el escritorio no cambia nada.
//  · F4 — LAS VERSIONES, en carrusel (lo hace el CSS).
//
// Entra por `import()` y solo en el móvil, como la barra de abajo (704).
// El núcleo se repinta a veces entero (cuando llega la ficha de TCGdex,
// 332), así que lo que se mete dentro se vuelve a meter con un observador.
import { icons } from './icons.js'

const PESTANAS = [
  ['resumen', 'Resumen'],
  ['precio', 'Precio'],
  ['historial', 'Historial'],
  ['versiones', 'Versiones'],
]

// Qué pestañas tienen algo que enseñar. Una sin contenido no sale: un
// botón que lleva a una pantalla vacía es un silencio (510).
export function pestanasConContenido(doc = document) {
  const visible = (id) => { const e = doc.getElementById(id); return !!e && !e.classList.contains('hidden') }
  return {
    resumen: true,
    precio: visible('cartaMercado'),
    historial: visible('cmHistorial'),
    versiones: visible('cartaVersiones'),
  }
}

export function montarFichaMovil(doc = document, win = window) {
  const main = doc.getElementById('contenido')
  const nucleo = doc.getElementById('cartaNucleo')
  if (!main || !nucleo || main.dataset.fichaMovil) return null
  main.dataset.fichaMovil = '1'
  doc.documentElement.classList.add('ficha-movil')
  main.dataset.pestana = 'resumen'

  const barra = doc.createElement('nav')
  barra.className = 'carta-pestanas'
  barra.setAttribute('aria-label', 'Partes de la ficha')
  barra.innerHTML = PESTANAS.map(([id, nombre]) => `<button type="button" data-pestana="${id}" aria-pressed="${id === 'resumen'}">${nombre}</button>`).join('')
  barra.addEventListener('click', (e) => {
    const b = e.target.closest('[data-pestana]')
    if (!b) return
    elegir(b.dataset.pestana)
  })

  const elegir = (id) => {
    main.dataset.pestana = id
    for (const b of barra.querySelectorAll('[data-pestana]')) b.setAttribute('aria-pressed', String(b.dataset.pestana === id))
    // Si la barra ya está pegada arriba, el contenido nuevo empieza justo
    // debajo de ella: no se deja a nadie a mitad de lo que había antes.
    const r = barra.getBoundingClientRect()
    if (r.top <= 120) win.scrollTo({ top: win.scrollY + r.top - 80, behavior: 'instant' })
  }

  const pintarPestanas = () => {
    const hay = pestanasConContenido(doc)
    for (const b of barra.querySelectorAll('[data-pestana]')) b.hidden = !hay[b.dataset.pestana]
    if (!hay[main.dataset.pestana]) elegir('resumen')
  }

  // El precio en una línea, copiado del bloque de precio cuando llega.
  const precioCorto = () => {
    const cifra = doc.querySelector('#cmPrecios .pv-burbuja-principal .pv-cifra:not(.pv-sin)')
    const de = doc.querySelector('#cmPrecios .pv-burbuja-principal .pv-de')
    return cifra ? { cifra: cifra.textContent.trim(), de: de?.textContent.trim() || '' } : null
  }

  // VOLVER Y COMPARTIR, FLOTANDO SOBRE EL ARTE (748, la F1 de su maqueta):
  // la barra de arriba no está en la ficha del móvil, así que la vuelta
  // atrás va aquí. Volver es atrás si vienes de PokeDoc y el catálogo si no
  // (alguien que entra desde Google no tiene un «atrás» nuestro).
  if (!doc.querySelector('.carta-flotantes')) {
    const flot = doc.createElement('div')
    flot.className = 'carta-flotantes'
    flot.innerHTML = `<button type="button" data-flota="volver" aria-label="Volver"><span class="carta-flecha" aria-hidden="true"></span></button><button type="button" data-flota="compartir" aria-label="Compartir">${icons.share(20)}</button>`
    flot.addEventListener('click', (e) => {
      const b = e.target.closest('[data-flota]')
      if (!b) return
      if (b.dataset.flota === 'compartir') return doc.getElementById('cmCompartir')?.click()
      let mismo = false
      try { mismo = !!doc.referrer && new URL(doc.referrer).origin === win.location.origin } catch {}
      if (mismo && win.history.length > 1) win.history.back()
      else win.location.href = '/cartas'
    })
    doc.body.appendChild(flot)
  }

  // «TIENES 2» ES UNA CHAPA (748): lo que decía la loseta de Editar, debajo
  // del precio, y tocarla lleva a editarla. Se copia de la loseta, que es la
  // que sabe cuántas tienes (una sola fuente).
  const pintarTienes = () => {
    const editar = doc.getElementById('cmEditar')
    const n = (doc.getElementById('cmTienes')?.textContent || '').trim()
    let chapa = nucleo.querySelector('.carta-tienes')
    if (!editar || editar.classList.contains('hidden') || !n) { chapa?.remove(); return }
    const cabecera = nucleo.querySelector('.carta-cabecera')
    if (!cabecera) return
    if (!chapa) {
      chapa = doc.createElement('a')
      chapa.className = 'carta-tienes'
      cabecera.appendChild(chapa)
    }
    const html = `${icons.checkCircle(16)}<span>${n}</span>`
    if (chapa.dataset.html !== html) { chapa.dataset.html = html; chapa.innerHTML = html }
    chapa.href = editar.getAttribute('href') || '#'
  }

  // Lo que va DENTRO del núcleo: la línea de precio bajo el nombre y la
  // barra entre la carta y su ficha. Si el núcleo se repintó, se vuelve a
  // poner.
  const asegurar = () => {
    const cabecera = nucleo.querySelector('.carta-cabecera')
    let linea = nucleo.querySelector('.carta-precio-corto')
    const p = precioCorto()
    if (cabecera && p) {
      if (!linea) {
        linea = doc.createElement('a')
        linea.className = 'carta-precio-corto'
        linea.href = '#cartaMercado'
        linea.addEventListener('click', (e) => { e.preventDefault(); elegir('precio') })
        cabecera.appendChild(linea)
      }
      // La tarjeta de su maqueta (748): de dónde sale arriba, la cifra en
      // grande y, si el histórico lo dice, cómo va en 30 días.
      const mes = doc.querySelector('#cmHistorial .carta-historial-chip:last-child')
      const html = `<small>${p.de || 'Precio'}</small><b>${p.cifra}</b>${mes && /30 d/.test(mes.textContent) ? `<span class="carta-precio-mes ${mes.classList.contains('sube') ? 'sube' : mes.classList.contains('baja') ? 'baja' : ''}">${mes.querySelector('b')?.textContent || ''} <i>en 30 días</i></span>` : ''}`
      if (linea.dataset.html !== html) { linea.dataset.html = html; linea.innerHTML = html }
    }
    pintarTienes()
    const figura = nucleo.querySelector('.carta-scan')
    if (figura && barra.previousElementSibling !== figura) figura.insertAdjacentElement('afterend', barra)
    const img = nucleo.querySelector('.carta-scan img')
    const src = img?.currentSrc || img?.src
    if (src && nucleo.dataset.arte !== src) {
      nucleo.dataset.arte = src
      nucleo.style.setProperty('--arte', `url("${src.replace(/"/g, '%22')}")`)
    }
    pintarPestanas()
  }
  let pendiente = false
  const pronto = () => {
    if (pendiente) return
    pendiente = true
    win.requestAnimationFrame(() => { pendiente = false; asegurar() })
  }
  new win.MutationObserver(pronto).observe(main, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'src'] })
  nucleo.addEventListener('load', pronto, true)
  asegurar()
  return { elegir }
}
