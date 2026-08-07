// La lista que sale al escribir @ en la caja de escribir.
//
// Sin esto las menciones existen pero son invisibles: hay que saberse el
// nombre de usuario exacto de memoria y escribirlo sin fallar una letra,
// y no hay ninguna señal de si has acertado hasta que le das a publicar.
//
// Lo que se inserta es TEXTO PLANO (`@nombre`), no un enlace: el enlace
// lo pone enlazarMenciones() al pintar el mensaje ya publicado. Así el
// cuerpo que se guarda es el mismo se haya escrito a mano o con la
// lista, y el saneador no tiene que dejar pasar nada nuevo.
import { supabase } from './supabase.js'
import { escapeHtml, getInitial, avatarStyle } from './app.js'
import { plegarTexto } from './texto.js'

const MAXIMO = 6
const ESPERA = 120

// Las que gobierna la lista mientras está abierta. Se manejan en keydown
// y su keyup hay que ignorarlo (ver alEscribir).
const TECLAS_DE_LA_LISTA = new Set(['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape'])

// El mismo comienzo que PATRON en js/menciones.js —el carácter de
// delante tiene que ser el principio o algo que no forme parte de una
// dirección—, pero con la cola abierta: aquí se está escribiendo, así
// que el nombre puede estar a medias o no haber empezado.
//
// Si esto ofreciera lo que PATRON luego no reconoce, la lista te dejaría
// elegir a alguien a quien no se va a avisar. Por eso el principio es
// idéntico: en "escribe a hola@" no sale nada, igual que "hola@pokedoc"
// no es una mención.
const ENCURSO = /(^|[^a-zA-Z0-9@._-])@([a-zA-Z0-9][a-zA-Z0-9_-]{0,29})?$/

const esTextarea = (el) => el?.tagName === 'TEXTAREA' || el?.tagName === 'INPUT'

// Qué se está escribiendo justo delante del cursor, si es una mención.
//
// Hay dos superficies distintas y no se parecen en nada: la caja del foro
// es un `contenteditable` (nodos de texto y rangos) y las de los
// comentarios, el muro y los mensajes son `<textarea>` (una cadena y un
// número). Lo que sí comparten es el patrón: si aquí se aceptara algo que
// PATRON luego no reconoce, la lista dejaría elegir a alguien a quien no
// se va a avisar.
function tokenEnElCursor(superficie) {
  if (esTextarea(superficie)) {
    const pos = superficie.selectionStart
    // Con texto seleccionado no se sugiere nada: no se está escribiendo.
    if (pos === null || pos !== superficie.selectionEnd) return null
    const m = superficie.value.slice(0, pos).match(ENCURSO)
    if (!m) return null
    const escrito = m[2] || ''
    return { nodo: superficie, desde: pos - escrito.length - 1, hasta: pos, escrito }
  }

  const sel = window.getSelection()
  if (!sel || !sel.isCollapsed || sel.rangeCount === 0) return null

  const nodo = sel.anchorNode
  if (!nodo || nodo.nodeType !== Node.TEXT_NODE || !superficie.contains(nodo)) return null
  // Dentro de un enlace, de código o de una cita no se sugiere nada: ahí
  // un @ no es una mención.
  if (nodo.parentElement?.closest('a, code, pre')) return null

  const antes = nodo.nodeValue.slice(0, sel.anchorOffset)
  const m = antes.match(ENCURSO)
  if (!m) return null

  const escrito = m[2] || ''
  return {
    nodo,
    desde: sel.anchorOffset - escrito.length - 1, // -1 por la arroba
    hasta: sel.anchorOffset,
    escrito,
  }
}

async function buscarPersonas(escrito) {
  const plegado = plegarTexto(escrito)
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, username, display_name, avatar_url')
      // Por el nombre de usuario y por el que se ve. `search_norm` va sin
      // acentos, así que escribir "@jesus" encuentra a "Jesús".
      .or(`username.ilike.${escrito}%,search_norm.ilike.${plegado}%`)
      .neq('is_banned', true)
      .order('username')
      .limit(MAXIMO)
    if (error) return []
    return data || []
  } catch {
    return []
  }
}

export function engancharAutocompletarMenciones(superficie) {
  if (!superficie || superficie.__mencionSoltar) superficie.__mencionSoltar?.()

  let lista = null
  let opciones = []
  let elegida = 0
  let token = null
  let temporizador = null
  // Cada búsqueda lleva número: si la de "@ash" tarda más que la de
  // "@ashk", la vieja no puede pintar encima de la nueva.
  let peticion = 0
  // Qué mención se cerró a mano con Escape, para no reabrirla.
  let silenciada = null

  const clave = (t) => `${t.desde}:${t.escrito}`

  const cerrar = () => {
    lista?.remove()
    lista = null
    opciones = []
    token = null
    superficie.removeAttribute('aria-expanded')
  }

  function pintar() {
    if (!opciones.length) return cerrar()
    if (!lista) {
      lista = document.createElement('div')
      lista.className = 'mencion-lista'
      lista.setAttribute('role', 'listbox')
      // mousedown y no click: sin esto, pulsar en la lista le quita el
      // foco a la caja de escribir, se pierde el cursor y ya no hay
      // dónde insertar el nombre.
      lista.addEventListener('mousedown', (e) => {
        e.preventDefault()
        const fila = e.target.closest('[data-i]')
        if (fila) elegir(opciones[Number(fila.dataset.i)])
      })
      document.body.appendChild(lista)
    }

    lista.innerHTML = opciones
      .map((p, i) => {
        const nombre = p.display_name || p.username
        const estilo = `width:24px;height:24px;font-size:11px;${avatarStyle(p)}`
        return `<div class="mencion-opcion ${i === elegida ? 'activa' : ''}" role="option" aria-selected="${i === elegida}" data-i="${i}">
            <span class="mini-avatar" style="${estilo}">${p.avatar_url ? '' : escapeHtml(getInitial(nombre))}</span>
            <span class="mencion-opcion-texto">
              <b>${escapeHtml(nombre)}</b>
              <span class="subtext">@${escapeHtml(p.username)}</span>
            </span>
          </div>`
      })
      .join('')

    colocar()
    superficie.setAttribute('aria-expanded', 'true')
  }

  // La lista va pegada a lo que se está escribiendo. Se mide el trozo
  // `@loquesea` y no el cursor a secas: un rango vacío devuelve una caja
  // de cero en algunos navegadores y la lista acabaría en la esquina.
  function colocar() {
    if (!lista || !token) return

    // En un textarea no hay forma barata de saber dónde está el cursor
    // en pantalla (habría que medir el texto con un div espejo). Se
    // ancla debajo de la caja entera: es predecible, se asocia sin duda
    // a lo que estás escribiendo, y en el móvil no se pelea con el
    // teclado.
    if (esTextarea(superficie)) {
      const caja = superficie.getBoundingClientRect()
      const alto = lista.offsetHeight || 0
      const debajo = caja.bottom + alto + 8 < window.innerHeight
      lista.style.left = `${caja.left + window.scrollX}px`
      lista.style.top = debajo
        ? `${caja.bottom + window.scrollY + 4}px`
        : `${caja.top + window.scrollY - alto - 4}px`
      return
    }

    const r = document.createRange()
    try {
      r.setStart(token.nodo, token.desde)
      r.setEnd(token.nodo, token.hasta)
    } catch {
      return cerrar()
    }
    const caja = r.getBoundingClientRect()
    const alto = lista.offsetHeight || 0
    // Si no cabe debajo, se pone encima. En el móvil, con el teclado
    // abierto, debajo casi nunca cabe.
    const debajo = caja.bottom + alto + 8 < window.innerHeight
    lista.style.left = `${Math.min(caja.left + window.scrollX, window.scrollX + window.innerWidth - 240)}px`
    lista.style.top = debajo
      ? `${caja.bottom + window.scrollY + 4}px`
      : `${caja.top + window.scrollY - alto - 4}px`
  }

  function elegir(perfil) {
    if (!perfil || !token) return

    if (esTextarea(superficie)) {
      // Aquí el espacio del final SÍ es uno normal: en un textarea el
      // valor es texto plano y no lo colapsa nadie. El espacio duro del
      // otro camino es por cómo pinta el navegador un contenteditable.
      const relleno = `@${perfil.username} `
      const v = superficie.value
      superficie.value = v.slice(0, token.desde) + relleno + v.slice(token.hasta)
      const fin = token.desde + relleno.length
      superficie.setSelectionRange(fin, fin)
      superficie.focus()
      cerrar()
      superficie.dispatchEvent(new Event('input', { bubbles: true }))
      return
    }

    const r = document.createRange()
    try {
      r.setStart(token.nodo, token.desde)
      r.setEnd(token.nodo, token.hasta)
    } catch {
      return cerrar()
    }
    r.deleteContents()
    // El espacio del final separa la mención de lo que se escriba
    // después: sin él, seguir escribiendo alarga el nombre y deja de
    // encontrarse a nadie.
    //
    // Y es un espacio DURO ( ) porque uno normal al final de un
    // párrafo se colapsa: el navegador lo borra al escribir la letra
    // siguiente, y salía "@misty mira" convertido en "@mistymira". Como
    // no es ninguno de los caracteres que forman un nombre, el patrón de
    // las menciones lo trata como separador igual que un espacio.
    const texto = document.createTextNode(`@${perfil.username} `)
    r.insertNode(texto)

    const sel = window.getSelection()
    const fin = document.createRange()
    fin.setStart(texto, texto.length)
    fin.collapse(true)
    sel.removeAllRanges()
    sel.addRange(fin)

    cerrar()
    // Para que se enteren el borrador y la vista previa.
    superficie.dispatchEvent(new Event('input', { bubbles: true }))
  }

  const alEscribir = (e) => {
    // Las teclas que MANEJA la lista no pueden pasar por aquí.
    //
    // Van en keydown, pero su keyup llega después y volvía a abrir y a
    // repintar: la flecha abajo movía la marca y 120 ms más tarde
    // volvía a la primera opción, y Escape cerraba la lista para que se
    // abriera sola acto seguido.
    if (e?.type === 'keyup' && TECLAS_DE_LA_LISTA.has(e.key)) return

    token = tokenEnElCursor(superficie)
    if (!token) {
      silenciada = null
      return cerrar()
    }
    // Cerrada con Escape: no se vuelve a abrir hasta que se escriba (o
    // se borre) algo, que es lo que hace cualquier editor.
    if (silenciada === clave(token)) return
    silenciada = null
    clearTimeout(temporizador)
    const mio = ++peticion
    const escrito = token.escrito
    temporizador = setTimeout(async () => {
      const encontrados = await buscarPersonas(escrito)
      if (mio !== peticion) return
      // Se vuelve a mirar el cursor: mientras se buscaba se ha podido
      // borrar la arroba entera.
      token = tokenEnElCursor(superficie)
      if (!token) return cerrar()
      opciones = encontrados
      elegida = 0
      pintar()
    }, ESPERA)
  }

  const alTeclear = (e) => {
    if (!lista || !opciones.length) return
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      elegida = (elegida + (e.key === 'ArrowDown' ? 1 : opciones.length - 1)) % opciones.length
      pintar()
      return
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
      // Enter aquí NO puede llegar al editor: crearía un párrafo nuevo
      // en vez de elegir.
      e.preventDefault()
      elegir(opciones[elegida])
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      // La clave se guarda ANTES de cerrar, que es quien borra el token.
      if (token) silenciada = clave(token)
      cerrar()
    }
  }

  superficie.addEventListener('input', alEscribir)
  superficie.addEventListener('keyup', alEscribir)
  // En captura, para adelantarse a lo que el editor hace con Enter.
  superficie.addEventListener('keydown', alTeclear, true)
  superficie.addEventListener('blur', cerrar)
  window.addEventListener('scroll', colocar, true)
  window.addEventListener('resize', colocar)

  superficie.__mencionSoltar = () => {
    clearTimeout(temporizador)
    cerrar()
    superficie.removeEventListener('input', alEscribir)
    superficie.removeEventListener('keyup', alEscribir)
    superficie.removeEventListener('keydown', alTeclear, true)
    superficie.removeEventListener('blur', cerrar)
    window.removeEventListener('scroll', colocar, true)
    window.removeEventListener('resize', colocar)
    delete superficie.__mencionSoltar
  }

  return superficie.__mencionSoltar
}
