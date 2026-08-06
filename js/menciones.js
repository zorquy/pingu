// Menciones: escribir @nombre en un mensaje del foro.
//
// Dos mitades:
//
//   · Al PUBLICAR: se sacan los nombres mencionados y se avisa a esas
//     personas.
//   · Al LEER: los @nombre que corresponden a alguien de verdad se
//     convierten en un enlace a su perfil.
//
// Los nombres de usuario del sitio son minúsculas, números y guiones
// (ver slugify en js/texto.js), así que eso es lo que se busca.
import { supabase } from './supabase.js'
import { profileUrl } from './app.js'

// El primer grupo es lo que va DELANTE de la arroba, y tiene que ser el
// principio del texto o algo que no sea parte de una dirección: sin eso,
// "escribe a hola@pokedoc.es" mencionaba a @pokedoc. No se usa un
// lookbehind (`(?<!...)`) a propósito: si un navegador viejo no lo
// entiende, el error es de sintaxis y se cae el módulo entero al
// cargarse, con lo que el tema no se vería.
const PATRON = /(^|[^a-z0-9@._-])@([a-z0-9][a-z0-9_-]{1,29})/gi

// Como mucho se avisa a cinco personas por mensaje. No es por rendimiento
// sino por educación: un mensaje con veinte menciones no es una
// conversación, es una lista de correo.
const MAXIMO = 5

// Saca los nombres mencionados de un texto plano.
export function nombresMencionados(texto) {
  const vistos = new Set()
  for (const m of String(texto || '').matchAll(PATRON)) {
    vistos.add(m[2].toLowerCase())
    if (vistos.size >= MAXIMO) break
  }
  return [...vistos]
}

// El texto de un cuerpo HTML, sin etiquetas. Se usa para buscar las
// menciones sin tropezar con los atributos: sin esto, un enlace a
// `/usuario/@algo` contaría como mención.
export function textoPlano(html) {
  if (typeof DOMParser === 'undefined') return String(html || '').replace(/<[^>]*>/g, ' ')
  return new DOMParser().parseFromString(String(html || ''), 'text/html').body.textContent || ''
}

// Los perfiles que existen de verdad entre los mencionados.
//
// `in` con los nombres en minúsculas: los usernames del sitio ya se
// guardan así (migración de usernames), así que no hace falta nada raro.
export async function perfilesMencionados(html) {
  const nombres = nombresMencionados(textoPlano(html))
  if (!nombres.length) return []
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, username, display_name')
      .in('username', nombres)
    if (error) return []
    return data || []
  } catch {
    return []
  }
}

// Convierte los @nombre en enlaces, sobre el HTML ya saneado.
//
// Se trabaja sobre el DOM y solo en NODOS DE TEXTO, no con un replace
// sobre la cadena. Un replace tocaría también lo que hay dentro de los
// atributos (un href, un alt) y podría partir el HTML por la mitad.
//
// Tampoco se entra en los enlaces que ya existen: un @nombre dentro de
// un <a> se quedaría como un enlace dentro de otro, que no existe en
// HTML (el navegador cierra el de fuera y el resultado es un desastre).
export function enlazarMenciones(html, perfilesPorNombre) {
  if (!html || typeof DOMParser === 'undefined') return html
  const nombres = Object.keys(perfilesPorNombre || {})
  if (!nombres.length) return html

  const doc = new DOMParser().parseFromString(html, 'text/html')
  const paseador = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT)
  const pendientes = []
  while (paseador.nextNode()) {
    const nodo = paseador.currentNode
    if (nodo.parentElement?.closest('a, code, pre')) continue
    if (PATRON.test(nodo.nodeValue)) pendientes.push(nodo)
    PATRON.lastIndex = 0
  }

  pendientes.forEach((nodo) => {
    const trozos = doc.createDocumentFragment()
    let ultimo = 0
    const texto = nodo.nodeValue
    for (const m of texto.matchAll(PATRON)) {
      const perfil = perfilesPorNombre[m[2].toLowerCase()]
      if (!perfil) continue
      // La arroba empieza DESPUÉS del carácter de delante, que el patrón
      // también se come para poder mirarlo.
      const desde = m.index + m[1].length
      if (desde > ultimo) trozos.appendChild(doc.createTextNode(texto.slice(ultimo, desde)))
      const a = doc.createElement('a')
      a.className = 'mencion'
      a.href = profileUrl(perfil)
      a.textContent = `@${perfil.username}`
      trozos.appendChild(a)
      ultimo = m.index + m[0].length
    }
    if (ultimo === 0) return
    if (ultimo < texto.length) trozos.appendChild(doc.createTextNode(texto.slice(ultimo)))
    nodo.parentNode.replaceChild(trozos, nodo)
  })

  return doc.body.innerHTML
}

// Un diccionario nombre → perfil, listo para enlazarMenciones().
export function porNombre(perfiles) {
  const mapa = {}
  ;(perfiles || []).forEach((p) => {
    if (p?.username) mapa[p.username.toLowerCase()] = p
  })
  return mapa
}
