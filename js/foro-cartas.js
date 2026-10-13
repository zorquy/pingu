// Las cartas dentro del foro (tanda 819, FO4): escribir [[Arven]] en un
// mensaje la pinta al leerlo como una minicarta con su foto y su precio, que
// lleva a su ficha.
//
// Como los enlaces internos (js/enlaces-internos.js), es DECORACIÓN de
// lectura: lo guardado sigue siendo el texto «[[Arven]]», el saneador ni se
// entera, y si la carta no se encuentra se queda en un enlace a buscarla.
// Una carta se busca por su nombre inglés (`name_key`, la clave de cruce de
// la 335) o por el español exacto (`name_es`), y de las impresiones con ese
// nombre se enseña la más nueva: en el foro se habla de la que se juega.
import { supabase } from './supabase.js'
import { escapeHtml } from './html.js'
import { normalizeSearch } from './texto.js'
import { cadenaDeEscaneo, atributosDeEscaneo } from './escaneo-carta.js'
import { rutaDeCarta } from './carta-ruta.js'
import { nombreDeCarta } from './catalogo-series.js'
import { precioDeFila, valorDe, euros } from './cardmarket.js'

// Más de seis cartas en un mensaje ya es una lista: para eso está pegar el
// mazo, que se pinta entero.
const MAX_POR_MENSAJE = 6
const CORCHETES = /\[\[([^\[\]\n]{2,40})\]\]/g

export function nombresEnCorchetes(texto) {
  const vistos = new Set()
  for (const m of String(texto || '').matchAll(CORCHETES)) {
    const n = m[1].trim()
    if (n.length >= 2) vistos.add(n)
    if (vistos.size >= MAX_POR_MENSAJE) break
  }
  return [...vistos]
}

// De todas las impresiones con ese nombre, la más nueva (y a igualdad, la
// del id mayor, para que no baile entre dos cargas).
export function laMasNueva(cartas) {
  return [...cartas].sort((a, b) => String(b.tcg_sets?.release_date || '').localeCompare(String(a.tcg_sets?.release_date || '')) || String(b.id).localeCompare(String(a.id)))[0] || null
}

// Los [[…]] del texto pasan a ser un enlace a buscarlos. Así, aunque la
// consulta falle o no encuentre nada, lo escrito lleva a algún sitio.
export function marcarCartas(raiz) {
  const marcados = []
  for (const cuerpo of raiz.querySelectorAll('.foro-mensaje-texto')) {
    let enEste = 0
    const paseo = document.createTreeWalker(cuerpo, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.nodeValue?.includes('[[') && !n.parentElement?.closest('a, tcg-deck') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
    })
    const nodos = []
    while (paseo.nextNode()) nodos.push(paseo.currentNode)
    for (const nodo of nodos) {
      const texto = nodo.nodeValue
      const caja = document.createDocumentFragment()
      let desde = 0
      let hubo = false
      for (const m of texto.matchAll(CORCHETES)) {
        if (enEste >= MAX_POR_MENSAJE) break
        const nombre = m[1].trim()
        if (nombre.length < 2) continue
        hubo = true
        enEste++
        caja.appendChild(document.createTextNode(texto.slice(desde, m.index)))
        const a = document.createElement('a')
        a.className = 'foro-carta'
        a.href = `/buscar?en=cartas&q=${encodeURIComponent(nombre)}`
        a.dataset.cartaNombre = nombre
        a.textContent = nombre
        caja.appendChild(a)
        marcados.push(a)
        desde = m.index + m[0].length
      }
      if (!hubo) continue
      caja.appendChild(document.createTextNode(texto.slice(desde)))
      nodo.replaceWith(caja)
    }
  }
  return marcados
}

const COLUMNAS = 'id, market, set_id, local_id, name, name_es, name_en, name_key, image_path, image_tcggo, tcg_sets(name, name_en, release_date)'

export async function pintarCartasDelForo(raiz, opciones = {}) {
  if (!raiz) return
  return rellenarCartas(marcarCartas(raiz), opciones)
}

// La segunda mitad, con red: quien llama puede hacer otras cosas entre
// marcar y rellenar (el tema pasa el glosario en medio).
export async function rellenarCartas(marcados, { cliente = supabase } = {}) {
  if (!marcados?.length) return
  const nombres = [...new Set(marcados.map((a) => a.dataset.cartaNombre))]
  const claves = [...new Set(nombres.map((n) => normalizeSearch(n)))]
  const pedir = (columna, valores) => cliente.from('tcg_cards').select(COLUMNAS).eq('market', 'WEST').in(columna, valores).limit(400).then((r) => r.data || [], () => [])
  const [porClave, porEspanol] = await Promise.all([pedir('name_key', claves), pedir('name_es', nombres)])
  const elegida = new Map()
  for (const n of nombres) {
    const k = normalizeSearch(n)
    const candidatas = [...porClave.filter((c) => c.name_key === k), ...porEspanol.filter((c) => c.name_es && normalizeSearch(c.name_es) === k)]
    const c = laMasNueva(candidatas)
    if (c) elegida.set(n, c)
  }
  if (!elegida.size) return
  const ids = [...new Set([...elegida.values()].map((c) => c.id))]
  const precios = await cliente.from('tcg_card_prices').select('*').in('card_id', ids).then((r) => r.data || [], () => [])
  const precioDe = new Map(precios.map((p) => [p.card_id, p]))
  for (const a of marcados) {
    const c = elegida.get(a.dataset.cartaNombre)
    if (!c) continue
    const valor = valorDe(precioDeFila(precioDe.get(c.id)), 'es')
    const foto = atributosDeEscaneo(cadenaDeEscaneo(c), 'this.remove()')
    a.href = rutaDeCarta(c)
    a.classList.add('foro-carta-lista')
    a.innerHTML = `${foto ? `<img ${foto} alt="" width="20" height="28" loading="lazy" decoding="async">` : ''}<span class="foro-carta-nombre">${escapeHtml(nombreDeCarta(c))}</span>${typeof valor === 'number' ? `<span class="foro-carta-precio">${escapeHtml(euros(valor))}</span>` : ''}`
    a.title = `${nombreDeCarta(c)} · ${c.tcg_sets?.name_en || c.tcg_sets?.name || c.set_id} ${c.local_id}`
  }
}
