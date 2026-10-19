// LA BARRA DE PROGRESO AL TOCAR UN ENLACE (tanda 892, R1).
//
// PINGU: «clicas en algo y la respuesta tiene que ser inmediata, porque si
// no la gente se cree que ha clicado y no ha hecho nada». Entre que tocas
// un enlace y llega la otra página pasan entre 150 ms y un segundo, y en
// ese rato la pantalla no cambiaba nada. Ahora, en el mismo instante del
// toque, una barra fina arriba empieza a avanzar y el contenido se atenúa
// un poco; cuando la página nueva llega, se va con ella.
//
// Solo para una NAVEGACIÓN de verdad: enlaces de esta web, sin tecla
// modificadora (Ctrl/Cmd abre pestaña), sin `target`, sin `download`, y
// que no sean la misma página con otra almohadilla. Y si algún script ya
// se ha quedado el clic (`preventDefault`), tampoco: eso no es navegar.
//
// Lo puro es `esNavegacion`; lo del DOM, `montarProgreso`. Sin imports,
// para probarlo en Node y para que la portada no pague nada más.

export function esNavegacion(a, ev, aqui = location.href, origen = location.origin) {
  if (!a || !a.href) return false
  if (ev?.defaultPrevented) return false
  if (ev && (ev.button > 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey)) return false
  if (a.target && a.target !== '_self') return false
  if (a.hasAttribute?.('download')) return false
  let u
  try {
    u = new URL(a.href, aqui)
  } catch {
    return false
  }
  if (u.origin !== origen || !/^https?:$/.test(u.protocol)) return false
  const actual = new URL(aqui)
  // La misma página con otra almohadilla no es otra página.
  if (u.pathname === actual.pathname && u.search === actual.search && u.hash) return false
  return true
}

// Cuánto se espera a que la página nueva llegue antes de dar por hecho que
// el clic no navegó (un script lo manejó sin `preventDefault`, un
// `beforeunload` lo frenó): la barra se retira sola.
export const MS_DE_RENDICION = 6000

export function montarProgreso({ doc = document, win = window } = {}) {
  if (doc.querySelector('.progreso-pagina')) return null
  const barra = doc.createElement('div')
  barra.className = 'progreso-pagina'
  barra.setAttribute('aria-hidden', 'true')
  barra.innerHTML = '<i></i>'
  barra.hidden = true
  doc.body.appendChild(barra)
  let rendicion = null

  const empezar = () => {
    clearTimeout(rendicion)
    barra.hidden = false
    barra.classList.remove('lista', 'andando')
    doc.documentElement.classList.add('navegando')
    // Dos cuadros: el primero pinta la barra a cero, el segundo arranca la
    // transición hasta el 80 %. Sin eso el navegador salta directo.
    win.requestAnimationFrame(() => win.requestAnimationFrame(() => barra.classList.add('andando')))
    rendicion = setTimeout(parar, MS_DE_RENDICION)
  }
  const parar = () => {
    clearTimeout(rendicion)
    barra.hidden = true
    barra.classList.remove('lista', 'andando')
    doc.documentElement.classList.remove('navegando')
  }

  // En burbuja y no en captura: así los manejadores de cada enlace ya han
  // corrido y `defaultPrevented` dice la verdad.
  doc.addEventListener('click', (ev) => {
    const a = ev.target instanceof Element ? ev.target.closest('a[href]') : null
    if (!esNavegacion(a, ev, win.location.href, win.location.origin)) return
    empezar()
  })
  // Un formulario que se envía también es una espera.
  doc.addEventListener('submit', (ev) => {
    if (!ev.defaultPrevented && ev.target?.method !== 'dialog') empezar()
  })
  // La página se va: la barra se completa en el último cuadro que se ve.
  win.addEventListener('pagehide', () => barra.classList.add('lista'))
  // Y si se VUELVE a esta página desde la caché de atrás (bfcache), lo que
  // hubiera quedado puesto se quita.
  win.addEventListener('pageshow', (e) => { if (e.persisted) parar() })
  return barra
}
