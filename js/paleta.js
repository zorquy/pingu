// LA PALETA (718, D3 de la lista). Ctrl+K —Cmd+K en el Mac—, «/» o la
// lupa de la barra abren una caja que busca cartas, guías, hilos y gente
// (con `js/buscador.js`, el motor de /buscar), lleva a cualquier página y
// lanza unas pocas acciones. Se usa sin tocar el ratón: flechas, Intro y
// Esc. Entra por `import()` desde `js/nav-search.js`, así que nadie la
// descarga hasta que la abre.
import { icons } from './icons.js'
import { escapeHtml } from './html.js'
import { hojaInyectada } from './hoja.js'
import { contienePlegado, plegarTexto } from './texto.js'
import { GRUPOS, buscarTodo, recordarBusqueda, leerRecientes } from './buscador.js'
import { destinoDe, interiorDe, engancharFotos } from './buscador-filas.js'

const NOMBRE = Object.fromEntries(GRUPOS)

// Las páginas salen de la barra de arriba, que ya las tiene: una segunda
// lista se quedaría vieja el día que alguien añada una sección (la 323).
export function paginasDeLaBarra(doc = document) {
  const vistas = new Set()
  const salida = [{ nombre: 'Inicio', detalle: 'Portada', icono: 'home', href: '/index.html' }]
  for (const a of doc.querySelectorAll('.nav-links > a[href], .nav-links .nav-sub a[href]')) {
    const href = a.getAttribute('href')
    if (vistas.has(href)) continue
    vistas.add(href)
    const seccion = a.closest('.nav-grupo')?.querySelector('.nav-grupo-btn')?.textContent.trim() || ''
    salida.push({ nombre: a.textContent.trim(), detalle: seccion, icono: 'compass', href })
  }
  return salida
}

// Las acciones. Solo las que la página puede cumplir: «Cambiar el tema»
// sin botón de tema sería una promesa que no hace nada (la 447).
export function accionesDisponibles(q = '', doc = document) {
  const conCuenta = !!doc.getElementById('navUserBtn')
  const tema = doc.getElementById('navThemeToggle')
  const oscuro = doc.documentElement.dataset.theme === 'dark'
  const lista = [
    { nombre: 'Escanear una carta', detalle: 'Con la cámara, a tu colección', icono: 'scan', href: '/mi-coleccion?ver=buscar&escanear=1', palabras: 'camara foto anadir coleccion' },
    { nombre: 'Añadir cartas a mi colección', detalle: 'Buscar y añadir', icono: 'cards', href: `/mi-coleccion?ver=buscar${q ? `&q=${encodeURIComponent(q)}` : ''}`, palabras: 'coleccion anadir' },
    { nombre: 'Crear un mazo', detalle: 'Constructor de mazos', icono: 'layers', href: '/constructor', palabras: 'constructor deck lista' },
  ]
  if (tema) lista.push({ nombre: oscuro ? 'Poner el tema claro' : 'Poner el tema oscuro', detalle: 'Tema', icono: oscuro ? 'sun' : 'moon', hacer: () => tema.click(), palabras: 'tema modo noche oscuro claro' })
  if (conCuenta) lista.push({ nombre: 'Mis mensajes', detalle: 'Mensajes privados', icono: 'mail', href: '/mensajes.html', palabras: 'privados chat' })
  return lista
}

// Lo que casa con lo escrito, sin acentos ni mayúsculas.
export function casan(lista, q) {
  const p = plegarTexto(q).trim()
  if (!p) return lista
  return lista.filter((x) => contienePlegado(`${x.nombre} ${x.detalle || ''} ${x.palabras || ''}`, p))
}

let caja = null

export function abrirPaleta({ texto = '' } = {}) {
  hojaInyectada('css/buscador.css')
  if (!caja) caja = montar()
  if (!caja.dialogo.open) caja.dialogo.showModal()
  caja.input.value = texto
  caja.pintar()
  caja.input.focus()
  return caja
}

function montar() {
  const dialogo = document.createElement('dialog')
  dialogo.className = 'paleta'
  dialogo.setAttribute('aria-label', 'Buscar en PokeDoc')
  dialogo.innerHTML = `
    <div class="paleta-caja">${icons.search(18)}
      <input type="search" enterkeyhint="search" class="bs-input" id="paletaInput" placeholder="Busca una carta, una guía, una página…" autocomplete="off"
        role="combobox" aria-expanded="true" aria-controls="paletaLista" aria-autocomplete="list" />
      <kbd>Esc</kbd>
    </div>
    <div class="paleta-lista" id="paletaLista" role="listbox" aria-label="Resultados"></div>
    <div class="paleta-pie"><span><kbd>↑</kbd> <kbd>↓</kbd> para moverte</span><span><kbd>Intro</kbd> para abrir</span><span id="paletaPista"></span><a id="paletaTodo" href="/buscar.html">Ver todo en Buscar</a></div>`
  document.body.appendChild(dialogo)
  const input = dialogo.querySelector('#paletaInput')
  const lista = dialogo.querySelector('#paletaLista')
  const pista = dialogo.querySelector('#paletaPista')
  const todo = dialogo.querySelector('#paletaTodo')
  engancharFotos(lista)

  let items = []
  let elegido = 0
  let secuencia = 0
  let temporizador = null
  let remotos = {}

  const conCuenta = () => !!document.getElementById('navUserBtn')

  const fila = (it, i) => {
    const id = `paleta-${i}`
    const sel = i === elegido
    const clase = `bs-fila${it.grupo ? ` bs-${it.grupo}` : ''}`
    const dentro = interiorDe(it.grupo || '', it.fila)
    return it.href
      ? `<a class="${clase}" id="${id}" role="option" aria-selected="${sel}" data-i="${i}" href="${escapeHtml(it.href)}" tabindex="-1">${dentro}</a>`
      : `<button type="button" class="${clase}" id="${id}" role="option" aria-selected="${sel}" data-i="${i}" tabindex="-1">${dentro}</button>`
  }

  function pintar() {
    const q = input.value.trim()
    todo.href = q ? `/buscar.html?q=${encodeURIComponent(q)}` : '/buscar.html'
    const bloques = []
    if (!q) {
      const recientes = leerRecientes().map((t) => ({ fila: { nombre: t, icono: 'clock' }, rellenar: t }))
      if (recientes.length) bloques.push(['Lo que buscaste', recientes])
    }
    // Se filtra por lo que la acción ES, no por lo que dice de ti: con
    // «Buscando «tema»» en el detalle, añadir casaría con cualquier cosa.
    const acciones = casan(accionesDisponibles(q), q).map((a) => ({ fila: a, href: a.href, hacer: a.hacer }))
    if (acciones.length) bloques.push(['Acciones', acciones])
    for (const [g] of GRUPOS) {
      const r = remotos[g]
      if (r?.error) bloques.push([NOMBRE[g], [{ fila: { nombre: `No se ha podido buscar en ${NOMBRE[g].toLowerCase()}`, detalle: 'Pulsa para reintentar', icono: 'refreshCw' }, hacer: () => buscar(true) }]])
      else if (r?.filas?.length) bloques.push([NOMBRE[g], r.filas.map((f) => ({ grupo: g, fila: f, href: destinoDe(g, f) }))])
    }
    const paginas = casan(paginasDeLaBarra(), q).map((p) => ({ fila: p, href: p.href }))
    if (paginas.length) bloques.push(['Ir a', q ? paginas : paginas.slice(0, 8)])
    items = bloques.flatMap(([, xs]) => xs)
    if (elegido >= items.length) elegido = 0
    let i = 0
    lista.innerHTML = items.length
      ? bloques.map(([titulo, xs]) => `<p class="bs-seccion" role="presentation">${escapeHtml(titulo)}</p>${xs.map((it) => fila(it, i++)).join('')}`).join('')
      : `<p class="paleta-nada">${q.length >= 2 && Object.keys(remotos).length ? `Nada con «${escapeHtml(q)}».` : 'Buscando…'}</p>`
    marcar()
  }

  function marcar() {
    for (const el of lista.querySelectorAll('[data-i]')) el.setAttribute('aria-selected', String(Number(el.dataset.i) === elegido))
    const el = lista.querySelector(`[data-i="${elegido}"]`)
    if (el) {
      input.setAttribute('aria-activedescendant', el.id)
      el.scrollIntoView({ block: 'nearest' })
    } else input.removeAttribute('aria-activedescendant')
    // Con una carta elegida y cuenta, Mayús+Intro la añade a la colección.
    const it = items[elegido]
    pista.innerHTML = it?.grupo === 'cartas' && conCuenta() ? '<kbd>Mayús</kbd> <kbd>Intro</kbd> la añade a tu colección' : ''
  }

  async function buscar(forzar = false) {
    const q = input.value.trim()
    const mia = ++secuencia
    if (q.length < 2) {
      remotos = {}
      pintar()
      return
    }
    if (forzar) remotos = {}
    const r = await buscarTodo(q, { limite: 3 })
    if (mia !== secuencia) return
    remotos = r
    pintar()
  }

  function ir(it, { anadir = false } = {}) {
    if (!it) return
    if (it.rellenar) {
      input.value = it.rellenar
      elegido = 0
      pintar()
      buscar()
      return
    }
    const q = input.value.trim()
    if (q) recordarBusqueda(q)
    if (it.hacer) {
      dialogo.close()
      it.hacer()
      return
    }
    location.href = anadir && it.grupo === 'cartas' ? `${it.href}#anadir` : it.href
  }

  input.addEventListener('input', () => {
    elegido = 0
    remotos = {}
    pintar()
    clearTimeout(temporizador)
    temporizador = setTimeout(buscar, 200)
  })
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!items.length) return
      elegido = (elegido + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
      marcar()
    } else if (e.key === 'Enter') {
      e.preventDefault()
      ir(items[elegido], { anadir: e.shiftKey && conCuenta() })
    }
  })
  // El ratón elige al MOVERSE, no al entrar: si la lista se desplaza bajo
  // un puntero quieto, la elección no puede saltar sola.
  lista.addEventListener('mousemove', (e) => {
    const el = e.target.closest('[data-i]')
    if (el && Number(el.dataset.i) !== elegido) {
      elegido = Number(el.dataset.i)
      marcar()
    }
  })
  lista.addEventListener('click', (e) => {
    const el = e.target.closest('[data-i]')
    if (!el) return
    const it = items[Number(el.dataset.i)]
    // Un enlace se abre él solo (y con Ctrl, en otra pestaña); lo demás
    // lo hace `ir`.
    if (it?.href && !it.rellenar) {
      if (input.value.trim()) recordarBusqueda(input.value)
      return
    }
    e.preventDefault()
    ir(it)
  })
  // Pulsar fuera de la caja (en el fondo) la cierra.
  dialogo.addEventListener('click', (e) => {
    if (e.target === dialogo) dialogo.close()
  })

  return { dialogo, input, pintar }
}
