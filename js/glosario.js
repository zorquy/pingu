// El glosario en las guías y el foro (tanda 792, NU11): la primera vez que
// sale un término se subraya punteado y al tocarlo sale su definición. Entra
// por `import()` desde quien pinta el texto, y trae su hoja.
import { hojaInyectada } from './hoja.js'
import { escapeHtml } from './html.js'
import { GLOSARIO, formasDelGlosario, primerasApariciones } from './glosario-datos.js'

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

// La página /glosario: los términos por orden, cada uno con su ancla.
export function pintarGlosario(caja) {
  const lista = [...GLOSARIO].sort((a, b) => a.termino.localeCompare(b.termino, 'es'))
  caja.innerHTML = lista.map((g) => `
    <article class="glosario-termino" id="${escapeHtml(g.id)}">
      <h2>${escapeHtml(g.termino)}</h2>
      <p class="glosario-otros">${[g.en, ...g.alias.filter((a) => a.toLowerCase() !== g.termino.toLowerCase() && a !== g.en)].map((a) => `<span>${escapeHtml(a)}</span>`).join('')}</p>
      <p>${escapeHtml(g.def)}</p>
      ${g.ejemplo ? `<p class="glosa-ejemplo">${escapeHtml(g.ejemplo)}</p>` : ''}
    </article>`).join('')
}

if (typeof document !== 'undefined' && document.getElementById('glosarioLista')) pintarGlosario(document.getElementById('glosarioLista'))
