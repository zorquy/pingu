// El glosario en las guías y el foro (tanda 792, NU11): la primera vez que
// sale un término se subraya punteado y al tocarlo sale su definición. Entra
// por `import()` desde quien pinta el texto, y trae su hoja.
import { hojaInyectada } from './hoja.js'
import { escapeHtml } from './html.js'
import { GLOSARIO, formasDelGlosario, primerasApariciones } from './glosario-datos.js'
import { normalizeSearch } from './texto.js'

const POR_ID = new Map(GLOSARIO.map((g) => [g.id, g]))
const NO_ENTRAR = 'a, button, code, pre, h1, h2, h3, h4, .glosa, .glosa-pop, textarea, input, select'
let formas = null

export function subrayarGlosario(raiz, vistos = new Set()) {
  if (!raiz) return 0
  hojaInyectada('css/glosario.css')
  formas ||= formasDelGlosario()
  const textos = []
  const andar = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.nodeValue.trim().length > 1 && !n.parentElement?.closest(NO_ENTRAR) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
  })
  while (andar.nextNode()) textos.push(andar.currentNode)
  let puestos = 0
  for (const nodo of textos) {
    const trozos = primerasApariciones(nodo.nodeValue, formas, vistos)
    if (!trozos.length) continue
    const texto = nodo.nodeValue
    const frag = document.createDocumentFragment()
    let desde = 0
    for (const t of trozos) {
      frag.append(texto.slice(desde, t.inicio))
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'glosa'
      b.dataset.glosa = t.id
      b.setAttribute('aria-expanded', 'false')
      b.textContent = texto.slice(t.inicio, t.fin)
      frag.append(b)
      desde = t.fin
      puestos++
    }
    frag.append(texto.slice(desde))
    nodo.replaceWith(frag)
  }
  if (puestos && !raiz.dataset.glosario) {
    raiz.dataset.glosario = '1'
    raiz.addEventListener('click', alTocar)
  }
  return puestos
}

function cerrar() {
  document.querySelector('.glosa-pop')?.remove()
  document.querySelector('.glosa[aria-expanded="true"]')?.setAttribute('aria-expanded', 'false')
}

function alTocar(e) {
  const b = e.target.closest('.glosa')
  if (!b) return
  const abierta = b.getAttribute('aria-expanded') === 'true'
  cerrar()
  if (abierta) return
  const g = POR_ID.get(b.dataset.glosa)
  if (!g) return
  const pop = document.createElement('div')
  pop.className = 'glosa-pop'
  pop.setAttribute('role', 'note')
  pop.innerHTML = `<strong>${escapeHtml(g.termino)}</strong>${g.en && g.en !== g.termino ? ` <span lang="en">(${escapeHtml(g.en)})</span>` : ''}<p>${escapeHtml(g.def)}</p>${g.ejemplo ? `<p class="glosa-ejemplo">${escapeHtml(g.ejemplo)}</p>` : ''}<a href="/glosario#${escapeHtml(g.id)}">Ver el glosario</a>`
  document.body.append(pop)
  const r = b.getBoundingClientRect()
  const ancho = Math.min(320, innerWidth - 32)
  pop.style.width = `${ancho}px`
  pop.style.left = `${Math.max(16, Math.min(r.left + scrollX, scrollX + innerWidth - ancho - 16))}px`
  pop.style.top = `${r.bottom + scrollY + 8}px`
  b.setAttribute('aria-expanded', 'true')
  setTimeout(() => document.addEventListener('click', (ev) => { if (!ev.target.closest('.glosa-pop, .glosa')) cerrar() }, { once: true }), 0)
}

// La letra por la que se ordena un término (sin acento: «Ñ» y «N» van juntas).
export const letraDe = (termino) => normalizeSearch(termino).charAt(0).toUpperCase()

// La página /glosario: los términos por orden, agrupados por letra, cada
// uno con su ancla. Desde la 1144 (V3 de «Lo que se ha quedado viejo») se lee
// como un diccionario: cada término ABIERTO —el nombre con su inglés, la
// definición, el ejemplo en una cita y los otros nombres en una línea—, sin
// tocar nada. Antes era un `<details>` plegado en el móvil: había que tocar
// cada uno para saber qué significaba.
export function pintarGlosario(caja) {
  const lista = [...GLOSARIO].sort((a, b) => a.termino.localeCompare(b.termino, 'es'))
  let letra = ''
  caja.innerHTML = lista.map((g) => {
    const l = letraDe(g.termino)
    const titulo = l !== letra ? `<h2 class="glosario-letra" id="letra-${l}">${l}</h2>` : ''
    letra = l
    const vistos = new Set([normalizeSearch(g.termino), normalizeSearch(g.en || '')])
    const otros = g.alias.filter((a) => { const k = normalizeSearch(a); if (vistos.has(k)) return false; vistos.add(k); return true })
    return `${titulo}
    <article class="glosario-termino" id="${escapeHtml(g.id)}" data-letra="${l}">
      <h3>${escapeHtml(g.termino)}${g.en && normalizeSearch(g.en) !== normalizeSearch(g.termino) ? ` <span class="glosario-en" lang="en">${escapeHtml(g.en)}</span>` : ''}</h3>
      <p class="glosario-def">${escapeHtml(g.def)}</p>
      ${g.ejemplo ? `<p class="glosa-ejemplo">${escapeHtml(g.ejemplo)}</p>` : ''}
      ${otros.length ? `<p class="glosario-otros">También: ${otros.map((a) => escapeHtml(a)).join(', ')}</p>` : ''}
    </article>`
  }).join('')
}

// El índice de letras y el buscador (896). Buscar filtra por nombre, inglés,
// alias y definición, y abre lo que casa; vaciar devuelve la lista entera.
export function pintarMandos(caja, lista, { letras, buscar }) {
  const presentes = [...new Set([...GLOSARIO].map((g) => letraDe(g.termino)))].sort()
  letras.innerHTML = presentes.map((l) => `<a href="#letra-${l}">${l}</a>`).join('')
  const filtrar = () => {
    const q = normalizeSearch(buscar.value.trim())
    for (const d of lista.querySelectorAll('.glosario-termino')) {
      const g = POR_ID.get(d.id)
      const casa = !q || normalizeSearch([g.termino, g.en, ...g.alias, g.def].join(' ')).includes(q)
      d.hidden = !casa
    }
    for (const h of lista.querySelectorAll('.glosario-letra')) h.hidden = !lista.querySelector(`.glosario-termino[data-letra="${h.id.slice(6)}"]:not([hidden])`)
    // Una letra sin términos es un control DESACTIVADO (la 311 pide el gris
    // apagado solo para eso): se marca como tal, no solo se atenúa.
    for (const a of letras.querySelectorAll('a')) {
      const vacia = !lista.querySelector(`.glosario-termino[data-letra="${a.textContent}"]:not([hidden])`)
      a.classList.toggle('glosario-letra-vacia', vacia)
      a.classList.toggle('disabled', vacia)
      if (vacia) a.setAttribute('aria-disabled', 'true')
      else a.removeAttribute('aria-disabled')
    }
  }
  buscar.addEventListener('input', filtrar)
  marcarLetraActual(lista, letras)
}

// La letra en la que estás, marcada en el índice (1144): la última cuyo
// título ya ha subido hasta los mandos pegados.
function marcarLetraActual(lista, letras) {
  if (typeof IntersectionObserver === 'undefined') return
  const titulos = [...lista.querySelectorAll('.glosario-letra')]
  const poner = (l) => {
    for (const a of letras.querySelectorAll('a')) {
      const es = a.textContent === l
      a.classList.toggle('glosario-letra-actual', es)
      if (es) a.setAttribute('aria-current', 'true')
      else a.removeAttribute('aria-current')
    }
  }
  // Al bajar, la última letra que ha pasado los mandos en la columna de la
  // IZQUIERDA (con dos columnas, a la altura de la E de una va la O de la
  // otra). Tocar una letra marca esa, sin esperar.
  let tocada = 0
  const marcar = () => {
    if (Date.now() - tocada < 800) return
    const tope = 180
    const izquierda = Math.min(...titulos.filter((h) => !h.hidden).map((h) => h.getBoundingClientRect().left))
    let actual = titulos[0]
    for (const h of titulos) {
      const r = h.getBoundingClientRect()
      if (!h.hidden && Math.abs(r.left - izquierda) < 8 && r.top <= tope) actual = h
    }
    poner(actual?.id.slice(6))
  }
  letras.addEventListener('click', (e) => {
    const a = e.target.closest('a')
    if (!a || a.classList.contains('disabled')) return
    tocada = Date.now()
    poner(a.textContent)
  })
  const obs = new IntersectionObserver(marcar, { rootMargin: '-120px 0px -40% 0px' })
  titulos.forEach((h) => obs.observe(h))
  window.addEventListener('scroll', () => requestAnimationFrame(marcar), { passive: true })
  marcar()
}

if (typeof document !== 'undefined' && document.getElementById('glosarioLista')) {
  const lista = document.getElementById('glosarioLista')
  pintarGlosario(lista)
  if (document.getElementById('glosarioLetras')) pintarMandos(document.getElementById('glosarioMandos'), lista, { letras: document.getElementById('glosarioLetras'), buscar: document.getElementById('glosarioBuscar') })
}
