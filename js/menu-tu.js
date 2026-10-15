// LA HOJA «TÚ» DE SU MAQUETA (748, la N8; de catorce cosas a nueve en la
// 869). PINGU: «el menú desplegable del perfil… se ve horrible, demasiada
// información desestructurada», y después «quizá muestra demasiadas cosas
// y debería ser más sencillo». Cuatro bloques:
//   · QUIÉN: avatar, nombre y «@usuario · nivel · racha»; la cabecera
//     entera es el enlace al perfil («Ver perfil» aparte sobraba);
//   · LO QUE TE ESPERA: avisos y mensajes, con su número;
//   · LO TUYO: cuatro cosas CON SU CUENTA (guardados, la quiero, mazos,
//     partidas) y Ajustes. Lo que tiene sitio en una sección (Modo feria,
//     Escribir una guía) no se repite aquí;
//   · el PIE: el tema en un botón (claro ↔ oscuro; «el del sistema» está en
//     Ajustes), «Apoyar», «Novedades» con su punto, y «Salir».
// Es el mismo `#navUserDropdown` en el ordenador (colgado del avatar) y en
// el móvil (desde abajo, css/movil.css). Entra por `import()` al tocar el
// avatar, con su hoja: la portada no paga ni un byte.
import { icons } from './icons.js'
import { ICONOS_COLECCION } from './mi-coleccion/iconos.js'
import { escapeHtml } from './html.js'
import { hojaInyectada } from './hoja.js'
import { KOFI, DIBUJOS } from './barra-lateral.js'

const CLAVE_TEMA = 'pokedoc-theme'

// «Apoyar PokeDoc» (758, PINGU: «mi enlace a Ko-fi»). El enlace y la taza
// son los de la lateral (774), que en el PC ancho lo enseña siempre: ahí la
// hoja no lo repite (menu-tu.css). En el móvil y en un PC estrecho, sin
// lateral, sigue aquí.
const taza = (size) => DIBUJOS.taza(size)

async function pintarPuntoDeNovedades(dropdown, win) {
  try {
    const [{ hayNovedades, CLAVE_VISTO }, res] = await Promise.all([import('./novedades-datos.js'), win.fetch('/novedades.json')])
    if (!res.ok) return
    const { entradas } = await res.json()
    let visto = null
    try { visto = win.localStorage.getItem(CLAVE_VISTO) } catch { /* sin almacenamiento */ }
    const punto = dropdown.querySelector('.tu-punto')
    if (punto) punto.hidden = !hayNovedades(entradas, visto)
  } catch { /* sin punto */ }
}

// Lo que hay guardado: 'light', 'dark' o nada (el del sistema).
function temaGuardado() {
  try { return localStorage.getItem(CLAVE_TEMA) || 'auto' } catch { return 'auto' }
}

export function aplicarTema(eleccion, doc = document, win = window) {
  try {
    if (eleccion === 'auto') localStorage.removeItem(CLAVE_TEMA)
    else localStorage.setItem(CLAVE_TEMA, eleccion)
  } catch {}
  const oscuro = eleccion === 'auto' ? win.matchMedia?.('(prefers-color-scheme: dark)').matches : eleccion === 'dark'
  doc.documentElement.dataset.theme = oscuro ? 'dark' : 'light'
  // El botón de la barra (theme.js) enseña el icono del tema CONTRARIO.
  const btn = doc.getElementById('navThemeToggle')
  if (btn) btn.innerHTML = oscuro ? icons.sun(19) : icons.moon(19)
}

// «@usuario · Novato · 3 días de racha»: lo que dice quién eres en una
// línea. La racha solo si la hay; un «0 días» no cuenta nada.
export function lineaDeQuien({ usuario, nivel, racha }) {
  const partes = []
  if (usuario) partes.push(`@${usuario}`)
  if (nivel) partes.push(nivel)
  if (racha > 0) partes.push(`${racha} ${racha === 1 ? 'día' : 'días'} de racha`)
  return partes.join(' · ')
}

const cuentaDe = (doc, id) => {
  const b = doc.getElementById(id)
  return b && !b.classList.contains('hidden') && b.textContent.trim() !== '0' ? b.textContent.trim() : ''
}

// Lo tuyo con su cuenta (869): «Guardados 12» dice algo; «Guardados» a
// secas, no. Cuatro consultas de cabecera al abrir la hoja, que ya llega
// por `import()`: la portada no paga nada. Lo que no se puede contar no
// enseña nada (la 319: un cero que no es cero miente).
async function contarLoTuyo(profile) {
  const cuentas = { guardados: Array.isArray(profile?.saved_guides) ? profile.saved_guides.length : null }
  try {
    const { supabase } = await import('./supabase.js')
    const cuenta = async (tabla) => {
      try {
        const { count, error } = await supabase.from(tabla).select('id', { count: 'exact', head: true }).eq('user_id', profile.id)
        return error ? null : count ?? null
      } catch {
        return null
      }
    }
    const [quiero, mazos, partidas] = await Promise.all([cuenta('user_wants'), cuenta('user_decks'), cuenta('match_log')])
    Object.assign(cuentas, { quiero, mazos, partidas })
  } catch { /* sin base, sin cuentas */ }
  return cuentas
}

export function pintarMenuTu(dropdown, { profile, name, estiloAvatar, inicial, nivel, signOut, doc = document, win = window }) {
  // La primera vez, invisible hasta que llegue su hoja (748): si no, la
  // hoja se pinta un instante como una lista suelta a lo ancho.
  dropdown.style.visibility = 'hidden'
  hojaInyectada('css/menu-tu.css').then(() => dropdown.style.removeProperty('visibility'))
  const quien = lineaDeQuien({ usuario: profile?.username, nivel, racha: Number(profile?.current_streak) || 0 })
  const oscuro = doc.documentElement.dataset.theme === 'dark'
  // Lo tuyo (869): cuatro cosas con su cuenta, y Ajustes. Lo que tiene
  // sitio en una sección (Modo feria, Escribir una guía) no se repite aquí.
  const fila = (href, icono, texto, cuenta = '', detalle = '') => `<a href="${href}">${icono}<span>${texto}${detalle ? `<small>${detalle}</small>` : ''}</span>${cuenta ? `<b class="pest-cuenta tu-n" data-n="${cuenta}" hidden></b>` : ''}</a>`
  dropdown.innerHTML = `
    <span class="tu-tirador" aria-hidden="true"></span>
    <a class="tu-cabeza" href="/perfil.html" aria-label="Ver tu perfil">
      <span class="nav-user-avatar-lg tu-avatar" style="${estiloAvatar}">${escapeHtml(inicial || '')}</span>
      <span class="tu-quien">
        <strong>${escapeHtml(name || '')}</strong>
        ${quien ? `<span>${escapeHtml(quien)}</span>` : ''}
      </span>
    </a>
    <div class="tu-dos">
      <button type="button" data-tu="avisos">${icons.bell(20)}<span>Avisos</span><b class="tu-cuenta" data-cuenta="navBellBadge"></b></button>
      <a href="/mensajes.html" data-tu="mensajes">${icons.mail(20)}<span>Mensajes</span><b class="tu-cuenta" data-cuenta="navMsgBadge"></b></a>
    </div>
    <div class="tu-avisos-sitio"></div>
    <nav class="tu-lista" aria-label="Lo tuyo">
      ${fila('/guardados.html', icons.bookmark(20), 'Guardados', 'guardados')}
      ${fila('/mi-coleccion?ver=quiero', ICONOS_COLECCION.corazon(20), 'La quiero', 'quiero')}
      ${fila('/mazos', icons.layers(20), 'Mis mazos', 'mazos')}
      ${fila('/mis-partidas', icons.gamepad(20), 'Mis partidas', 'partidas')}
      ${fila('/ajustes', icons.settings(20), 'Ajustes', '', 'Avisos, cuenta, tema')}
    </nav>
    <div class="tu-pie">
      <button type="button" class="tu-tema-boton" data-tema-ciclo aria-label="${oscuro ? 'Cambiar al tema claro' : 'Cambiar al tema oscuro'}">${oscuro ? icons.sun(18) : icons.moon(18)}</button>
      <a class="tu-apoyar" href="${KOFI}" target="_blank" rel="noopener" title="Un café en Ko-fi">${taza(18)}<span>Apoyar</span></a>
      <a class="tu-novedades" href="/novedades" data-tu="novedades">${icons.sparkles(18)}<span>Novedades</span><i class="tu-punto" hidden aria-label="Hay novedades"></i></a>
      <button type="button" class="tu-salir" id="navUserSignOut">${icons.logOut(18)}<span>Salir</span></button>
    </div>`

  const pintarCuentas = () => {
    for (const b of dropdown.querySelectorAll('[data-cuenta]')) {
      const n = cuentaDe(doc, b.dataset.cuenta)
      if (b.textContent !== n) b.textContent = n
      b.hidden = !n
    }
  }
  pintarCuentas()
  contarLoTuyo(profile).then((cuentas) => {
    for (const b of dropdown.querySelectorAll('[data-n]')) {
      const n = cuentas[b.dataset.n]
      b.hidden = !(typeof n === 'number' && n > 0)
      if (!b.hidden) b.textContent = n > 99 ? '99+' : String(n)
    }
  })
  // El punto de NOVEDADES (829): si hay alguna después de la última vez que
  // abriste /novedades. Se pregunta al abrir el menú, que ya llega por
  // `import()`: la portada no paga nada. Sin red o sin almacenamiento, sin punto.
  pintarPuntoDeNovedades(dropdown, win)
  // Las chapas de la campana y del sobre llegan cuando llegan: se miran
  // mientras viva el menú.
  const derecha = doc.querySelector('.nav-right')
  if (derecha && win.MutationObserver) new win.MutationObserver(pintarCuentas).observe(derecha, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class'] })

  // Pulsar un botón de la barra SIN que el menú se cierre: su clic subiría
  // hasta el documento, y el menú cierra con cualquier clic fuera de él.
  const pulsarSinCerrar = (boton) => {
    if (!boton) return
    boton.addEventListener('click', (e) => e.stopPropagation(), { once: true })
    boton.click()
  }
  dropdown.addEventListener('click', (e) => {
    // El tema en UN botón (869): claro ↔ oscuro. «El del sistema» vive en
    // Ajustes › Apariencia.
    const t = e.target.closest('[data-tema-ciclo]')
    if (t) {
      const aOscuro = doc.documentElement.dataset.theme !== 'dark'
      const cambiar = () => aplicarTema(aOscuro ? 'dark' : 'light', doc, win)
      import('./theme.js').then(({ conOla }) => conOla({ currentTarget: t }, cambiar)).catch(cambiar)
      // El icono se cambia DESPUÉS de que el clic termine de subir: si se
      // cambia ahora, el svg pulsado deja de estar en la página y el cierre
      // «por clic fuera» de app.js lo toma por un clic fuera.
      win.setTimeout(() => {
        t.innerHTML = aOscuro ? icons.sun(18) : icons.moon(18)
        t.setAttribute('aria-label', aOscuro ? 'Cambiar al tema claro' : 'Cambiar al tema oscuro')
      }, 0)
      return
    }
    const a = e.target.closest('[data-tu="avisos"]')
    if (!a) return
    // En el móvil la campana no se ve: su lista se abre DENTRO de la hoja
    // (se mueve el nodo, con sus oyentes). En el ordenador está en la barra
    // y se abre ahí, cerrando este menú.
    if (doc.documentElement.classList.contains('con-barra-movil')) {
      const lista = doc.getElementById('navBellDropdown')
      const sitio = dropdown.querySelector('.tu-avisos-sitio')
      if (lista && sitio && lista.parentElement !== sitio) sitio.appendChild(lista)
      win.setTimeout(() => pulsarSinCerrar(doc.getElementById('navBellBtn')), 0)
    } else {
      dropdown.classList.add('hidden')
      win.setTimeout(() => pulsarSinCerrar(doc.getElementById('navBellBtn')), 0)
    }
  })
  doc.getElementById('navUserSignOut')?.addEventListener('click', signOut)
}
