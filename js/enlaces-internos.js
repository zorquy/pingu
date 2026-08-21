import { supabase } from './supabase.js'
import { escapeHtml } from './app.js'
import { icons } from './icons.js'

// Los enlaces INTERNOS pegados "a pelo" en un mensaje o una guía se
// convierten al leerlos en una tarjetita con el título real de la página
// enlazada — el "unfurl" de Discord/Slack, casero y solo para lo nuestro:
// un enlace a un tema del foro o a una guía dice qué tema y qué guía es,
// en vez de una ristra de letras azules.
//
// Es DECORACIÓN de lectura, como pintar las listas de cartas: lo guardado
// no cambia (el saneador ni se entera), y solo se toca el enlace cuyo
// TEXTO es la propia dirección — si el autor escribió "míralo aquí", ese
// texto es suyo y se respeta.

const RUTA_TEMA = /^\/tema\/([^/?#]+)/
// Las guías viven en /guia?slug=… (y el slug limpio /guia/… que sirve la
// edge function).
const RUTA_GUIA = /^\/guia(?:\/([^/?#]+))?$/

function destinoInterno(href) {
  let url
  try {
    url = new URL(href, window.location.origin)
  } catch {
    return null
  }
  const propio = url.host === window.location.host || /(^|\.)pokedoc\.es$/.test(url.host)
  if (!propio) return null
  const tema = RUTA_TEMA.exec(url.pathname)
  if (tema) return { tipo: 'tema', clave: decodeURIComponent(tema[1]) }
  const guia = RUTA_GUIA.exec(url.pathname)
  if (guia) {
    const slug = guia[1] || url.searchParams.get('slug')
    if (slug) return { tipo: 'guia', clave: decodeURIComponent(slug) }
  }
  return null
}

// ¿El texto del enlace es la propia dirección? Un enlace con texto puesto
// por el autor no se toca.
function esEnlaceDesnudo(a) {
  const texto = a.textContent.trim()
  if (!texto) return false
  const href = (a.getAttribute('href') || '').trim()
  if (texto === href) return true
  if (!/^(https?:\/\/|\/tema\/|\/guia)/.test(texto)) return false
  // La misma dirección aunque una vaya relativa y la otra absoluta, con
  // o sin protocolo o barra final.
  const pelar = (s) => {
    try {
      return new URL(s, window.location.origin).href.replace(/^https?:\/\//, '').replace(/\/$/, '')
    } catch {
      return s
    }
  }
  return pelar(texto) === pelar(href)
}

// Primero: las direcciones internas pegadas como TEXTO plano (sin enlace
// siquiera) se convierten en <a>. Es lo que deja el editor al pegar una
// URL sin seleccionarla y darle al botón de enlace.
const URL_EN_TEXTO = /https?:\/\/[^\s<>"')]+/g

function enlazarTextoPlano(raiz) {
  const paseo = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      if (!n.nodeValue || !n.nodeValue.includes('http')) return NodeFilter.FILTER_REJECT
      if (n.parentElement?.closest('a, tcg-deck, yt-video, code, pre')) return NodeFilter.FILTER_REJECT
      return NodeFilter.FILTER_ACCEPT
    },
  })
  const nodos = []
  while (paseo.nextNode()) nodos.push(paseo.currentNode)
  for (const nodo of nodos) {
    const texto = nodo.nodeValue
    let hubo = false
    const caja = document.createDocumentFragment()
    let desde = 0
    for (const m of texto.matchAll(URL_EN_TEXTO)) {
      // Solo direcciones NUESTRAS: enlazar webs ajenas por su cuenta es
      // decisión del autor, no de este módulo.
      if (!destinoInterno(m[0])) continue
      hubo = true
      caja.appendChild(document.createTextNode(texto.slice(desde, m.index)))
      const a = document.createElement('a')
      a.href = m[0]
      a.textContent = m[0]
      caja.appendChild(a)
      desde = m.index + m[0].length
    }
    if (!hubo) continue
    caja.appendChild(document.createTextNode(texto.slice(desde)))
    nodo.replaceWith(caja)
  }
}

export async function enriquecerEnlacesInternos(raiz) {
  if (!raiz) return
  enlazarTextoPlano(raiz)

  const candidatos = []
  for (const a of raiz.querySelectorAll('a[href]')) {
    if (a.classList.contains('enlace-tarjeta') || !esEnlaceDesnudo(a)) continue
    const destino = destinoInterno(a.getAttribute('href'))
    if (destino) candidatos.push({ a, ...destino })
  }
  if (candidatos.length === 0) return

  const idsTemas = [...new Set(candidatos.filter((c) => c.tipo === 'tema').map((c) => c.clave))]
  const slugsGuias = [...new Set(candidatos.filter((c) => c.tipo === 'guia').map((c) => c.clave))]
  const [temas, guias] = await Promise.all([
    idsTemas.length
      ? supabase.from('forum_threads').select('id, title').in('id', idsTemas).then(({ data }) => data || [])
      : [],
    slugsGuias.length
      ? supabase.from('guides').select('slug, title').in('slug', slugsGuias).then(({ data }) => data || [])
      : [],
  ])
  const tituloDeTema = Object.fromEntries(temas.map((t) => [t.id, t.title]))
  const tituloDeGuia = Object.fromEntries(guias.map((g) => [g.slug, g.title]))

  for (const { a, tipo, clave } of candidatos) {
    const titulo = tipo === 'tema' ? tituloDeTema[clave] : tituloDeGuia[clave]
    // Sin título (borrado, o sin permiso de verlo) el enlace se queda
    // como estaba: una tarjetita que dice "no sé qué es" es peor que nada.
    if (!titulo) continue
    a.classList.add('enlace-tarjeta')
    a.innerHTML = `
      <span class="et-icono" aria-hidden="true">${tipo === 'tema' ? icons.messageSquare(16) : icons.bookOpen(16)}</span>
      <span class="et-textos">
        <span class="et-titulo">${escapeHtml(titulo)}</span>
        <span class="et-tipo">${tipo === 'tema' ? 'Tema del foro' : 'Guía'} · PokeDoc</span>
      </span>`
  }
}
