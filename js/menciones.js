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
import { COLUMNAS_RANGO, claseDeRango, estiloDeRango, nombreDeRango } from './rangos.js'

// El primer grupo es lo que va DELANTE de la arroba, y tiene que ser el
// principio del texto o algo que no sea parte de una dirección: sin eso,
// "escribe a hola@pokedoc.es" mencionaba a @pokedoc. No se usa un
// lookbehind (`(?<!...)`) a propósito: si un navegador viejo no lo
// entiende, el error es de sintaxis y se cae el módulo entero al
// cargarse, con lo que el tema no se vería.
// El nombre admite PUNTOS por dentro (1382, PINGU: «sergio.m no lo reconoce
// por el punto»): la gente escribe el nombre que ve, «@Sergio.M», aunque su
// usuario sea «sergio-m». El punto del final no es del nombre («gracias
// @ash.»): lo quita `limpio`.
const PATRON = /(^|[^a-z0-9@._-])@([a-z0-9][a-z0-9._-]{1,29})/gi
const limpio = (n) => n.toLowerCase().replace(/[._-]+$/, '')

// Lo que puede ser un nombre escrito con puntos, de más a menos probable: el
// usuario con guion (los usuarios son minúsculas, números y guiones), sin el
// punto, y lo de antes del punto. «@ash.» ya llega como «ash».
export function candidatosDe(nombre) {
  const n = limpio(nombre)
  if (!n.includes('.')) return [n]
  return [...new Set([n.replace(/\.+/g, '-'), n.replace(/\.+/g, ''), n.split('.')[0]])].filter((x) => x.length >= 2)
}

// Como mucho se AVISA a cinco personas por mensaje. No es por rendimiento
// sino por educación: un mensaje con veinte menciones no es una
// conversación, es una lista de correo. Pero ENLAZAR se enlazan todas
// (1382): el tope se aplicaba también al pintar, y como el tema junta los
// mensajes de la página en un texto, pasados cinco nombres en TODO el tema
// el resto se quedaba en texto plano (una lista de quince inscritos, con
// solo los cinco primeros enlazados).
const MAXIMO = 5

// Saca los nombres mencionados de un texto plano (`tope`: cuántos; por
// defecto los de un aviso).
export function nombresMencionados(texto, { tope = MAXIMO } = {}) {
  const vistos = new Set()
  for (const m of String(texto || '').matchAll(PATRON)) {
    const n = limpio(m[2])
    if (n.length < 2) continue
    vistos.add(n)
    if (vistos.size >= tope) break
  }
  return [...vistos]
}

// Las etiquetas que separan palabras. Las de dentro de una frase (b, i,
// a, code…) no separan nada: "<b>@ash</b>," es "@ash,".
const BLOQUES = 'p, div, br, li, ul, ol, h1, h2, h3, h4, h5, h6, blockquote, tr, td, pre, hr'

// El texto de un cuerpo HTML, sin etiquetas. Se usa para buscar las
// menciones sin tropezar con los atributos: sin esto, un enlace a
// `/usuario/@algo` contaría como mención.
//
// El espacio delante de cada bloque hace falta de verdad: `textContent`
// a secas pega los párrafos, así que "<p>hola</p><p>@ash</p>" salía como
// "hola@ash" — y eso, con la regla que descarta las direcciones de
// correo, deja de ser una mención. Empezar un párrafo con @alguien es lo
// más normal del mundo y no avisaba a nadie.
//
// La misma división de bloques está en menciones_de() dentro de
// supabase-migration-correo-foro.sql, que es quien manda el correo. Si
// aquí se separa distinto que allí, alguien recibe el correo pero no ve
// el enlace en el mensaje, o al revés.
export function textoPlano(html) {
  if (typeof DOMParser === 'undefined') return String(html || '').replace(/<[^>]*>/g, ' ')
  const doc = new DOMParser().parseFromString(String(html || ''), 'text/html')
  doc.body.querySelectorAll(BLOQUES).forEach((el) => el.before(' '))
  return doc.body.textContent || ''
}

// Los perfiles que existen de verdad entre los mencionados.
//
// Se compara SIN distinguir mayúsculas (`ilike` sin comodines es una
// igualdad insensible), y no con un `in` sobre el texto exacto. Los
// usernames del sitio se guardan en minúsculas desde la migración de
// usernames, así que hoy da lo mismo — pero el disparador del correo
// compara `lower(username)`, y con un `in` exacto aquí bastaba UN
// username con una mayúscula para que a esa persona le llegara el correo
// y en el mensaje no se le viera el enlace.
//
// Son cinco nombres como mucho (MAXIMO), así que el filtro es corto. Y
// solo pueden contener [a-z0-9_-] por el patrón, con lo que no hay nada
// que escapar al montarlo.
//
// `avisar: true` es para quien AVISA (cinco como mucho); al pintar, todas.
// Con muchas, la consulta va en trozos para no hacer una URL enorme.
export async function perfilesMencionados(html, { avisar = false } = {}) {
  const nombres = nombresMencionados(textoPlano(html), { tope: avisar ? MAXIMO : 400 })
  if (!nombres.length) return []
  const filtros = []
  for (const n of nombres) {
    for (const c of candidatosDe(n)) filtros.push(`username.ilike.${c}`)
    // Con un punto, también el nombre que se ve («Sergio.M»): entre comillas,
    // que el punto no lo parta PostgREST.
    if (n.includes('.')) filtros.push(`display_name.ilike."${n}"`)
  }
  const unicos = [...new Set(filtros)]
  try {
    const trozos = []
    for (let i = 0; i < unicos.length; i += 60) trozos.push(unicos.slice(i, i + 60))
    const respuestas = await Promise.all(
      trozos.map((t) => supabase.from('user_profiles').select(`id, username, display_name, ${COLUMNAS_RANGO}`).or(t.join(',')))
    )
    const vistos = new Map()
    for (const { data, error } of respuestas) {
      if (error) continue
      for (const p of data || []) vistos.set(p.id, p)
    }
    const todos = [...vistos.values()]
    if (!avisar) return todos
    // Al avisar, solo a quien de verdad se nombró: el primero que encaje con
    // cada nombre (no «sergio» Y «sergio-m» por un «@sergio.m»).
    const mapa = porNombre(todos)
    const elegidos = new Map()
    for (const n of nombres) {
      const p = perfilDe(n, mapa)
      if (p) elegidos.set(p.id, p)
    }
    return [...elegidos.values()]
  } catch {
    return []
  }
}

// A quién apunta un nombre escrito, y si lo nombra ENTERO: con un punto, el
// usuario con guion o sin el punto, o quien se llame así de cara a la gente;
// y solo si nada de eso existe, lo de antes del punto (`entero: false`, y
// entonces solo eso es enlace: «@ash.hola»).
export function encajeDe(nombre, perfilesPorNombre) {
  const n = limpio(nombre)
  const mapa = perfilesPorNombre || {}
  if (!n.includes('.')) return mapa[n] ? { perfil: mapa[n], entero: true } : null
  const [guion, junto, antes] = [n.replace(/\.+/g, '-'), n.replace(/\.+/g, ''), n.split('.')[0]]
  const lleno = mapa[guion] || mapa[junto] || mapa[`~${n}`]
  if (lleno) return { perfil: lleno, entero: true }
  return antes.length >= 2 && mapa[antes] ? { perfil: mapa[antes], entero: false } : null
}
export const perfilDe = (nombre, mapa) => encajeDe(nombre, mapa)?.perfil || null

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
      const encaje = encajeDe(m[2], perfilesPorNombre)
      if (!encaje) continue
      const { perfil } = encaje
      // La arroba empieza DESPUÉS del carácter de delante, que el patrón
      // también se come para poder mirarlo.
      const desde = m.index + m[1].length
      // Lo que se enlaza: el nombre entero, o solo lo de antes del punto si
      // es lo único que encajó. El punto de final de frase se queda fuera.
      const escrito = m[2].replace(/[._-]+$/, '')
      const largo = 1 + (encaje.entero ? escrito.length : escrito.split('.')[0].length)
      if (desde > ultimo) trozos.appendChild(doc.createTextNode(texto.slice(ultimo, desde)))
      const a = doc.createElement('a')
      // La mención se queda con su forma de mención y ADEMÁS coge el
      // color de su rango: es un enlace a un perfil como cualquier otro
      // (tanda 386). Se pone a mano porque esto es DOM, no una plantilla.
      a.className = `mencion${claseDeRango(perfil)}`
      const estilo = estiloDeRango(perfil)
      if (estilo) {
        a.setAttribute('style', estilo)
        a.title = nombreDeRango(perfil)
      }
      if (perfil.tipo === 'tienda') a.dataset.nombreTienda = ''
      a.href = profileUrl(perfil)
      a.textContent = `@${perfil.username}`
      trozos.appendChild(a)
      ultimo = desde + largo
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
    // El nombre que se ve, con su punto («~sergio.m»), para `perfilDe`.
    if (p?.display_name && p.display_name.includes('.')) mapa[`~${p.display_name.toLowerCase()}`] = p
  })
  return mapa
}
