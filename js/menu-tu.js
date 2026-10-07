// LA HOJA «TÚ» DE SU MAQUETA (748, la N8). PINGU: «el menú desplegable del
// perfil… se ve horrible, demasiada información desestructurada». Eran
// cinco cosas apiladas sin jerarquía: dos cifras sueltas (XP y nivel) en
// una rejilla, la racha debajo, el tema como una fila más y seis enlaces
// con el mismo peso que «Cerrar sesión». Queda en cuatro bloques:
//   · QUIÉN: avatar, nombre, «@usuario · nivel · racha» y «Ver perfil»;
//   · LO QUE TE ESPERA: avisos y mensajes, con su número;
//   · LO TUYO: una lista con su flecha (guardados, mazos, partidas, escribir
//     una guía y ajustes);
//   · el TEMA (claro, oscuro o el del sistema) y «Salir», abajo y aparte.
// Es el mismo `#navUserDropdown` en el ordenador (colgado del avatar) y en
// el móvil (desde abajo, css/movil.css). Entra por `import()` al tocar el
// avatar, con su hoja: la portada no paga ni un byte.
import { icons } from './icons.js'
import { escapeHtml } from './html.js'
import { hojaInyectada } from './hoja.js'

const CLAVE_TEMA = 'pokedoc-theme'

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

export function pintarMenuTu(dropdown, { profile, name, estiloAvatar, inicial, nivel, signOut, doc = document, win = window }) {
  hojaInyectada('css/menu-tu.css')
  const quien = lineaDeQuien({ usuario: profile?.username, nivel, racha: Number(profile?.current_streak) || 0 })
  const tema = temaGuardado()
  const fila = (href, icono, texto) => `<a href="${href}">${icono}<span>${texto}</span></a>`
  dropdown.innerHTML = `
    <span class="tu-tirador" aria-hidden="true"></span>
    <div class="tu-cabeza">
      <span class="nav-user-avatar-lg tu-avatar" style="${estiloAvatar}">${escapeHtml(inicial || '')}</span>
      <div class="tu-quien">
        <strong>${escapeHtml(name || '')}</strong>
        ${quien ? `<span>${escapeHtml(quien)}</span>` : ''}
      </div>
      <a class="tu-perfil" href="/perfil.html">Ver perfil</a>
    </div>
    <div class="tu-dos">
      <button type="button" data-tu="avisos">${icons.bell(20)}<span>Avisos</span><b class="tu-cuenta" data-cuenta="navBellBadge"></b></button>
      <a href="/mensajes.html" data-tu="mensajes">${icons.mail(20)}<span>Mensajes</span><b class="tu-cuenta" data-cuenta="navMsgBadge"></b></a>
    </div>
    <div class="tu-avisos-sitio"></div>
    <nav class="tu-lista" aria-label="Lo tuyo">
      ${fila('/guardados.html', icons.bookmark(20), 'Guardados')}
      ${fila('/mazos', icons.layers(20), 'Mis mazos')}
      ${fila('/mis-partidas', icons.gamepad(20), 'Mis partidas')}
      ${fila('/editor-guia.html', icons.edit(20), 'Escribir una guía')}
      ${fila('/perfil.html?editar=1', icons.settings(20), 'Ajustes')}
    </nav>
    <div class="tu-pie">
      <div class="tu-tema" role="group" aria-label="Tema">
        ${[['light', icons.sun(16), 'Claro'], ['dark', icons.moon(16), 'Oscuro'], ['auto', icons.settings(16), 'Auto']]
          .map(([v, ic, t]) => `<button type="button" data-tema="${v}" aria-pressed="${tema === v}">${ic}<span>${t}</span></button>`).join('')}
      </div>
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
    const t = e.target.closest('[data-tema]')
    if (t) {
      aplicarTema(t.dataset.tema, doc, win)
      for (const b of dropdown.querySelectorAll('[data-tema]')) b.setAttribute('aria-pressed', String(b === t))
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
