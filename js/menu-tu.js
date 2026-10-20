// LA HOJA «TÚ» (748, la N8; de catorce cosas a nueve en la 869, y en
// baldosas desde la 918, la propuesta «PokeDoc más sencillo»). Tres bloques:
//   · QUIÉN: avatar, nombre y «@usuario · nivel · racha» —la cabecera es el
//     enlace al perfil— y, a su lado, el tema en un botón redondo (claro ↔
//     oscuro; «el del sistema» está en Ajustes);
//   · SEIS BALDOSAS IGUALES, cada una con su icono y su número: avisos y
//     mensajes (sin leer, en rosa) y guardados, la quiero, mazos y partidas;
//   · TRES RENGLONES: Ajustes, Apoyar PokeDoc y Salir.
// Novedades salió de la hoja en la 918: está en Inicio y en el pie.
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
  // Las seis baldosas (918): avisos y mensajes con lo que tienes sin leer
  // (`data-cuenta`, la chapa de la barra), y lo tuyo con su cuenta (`data-n`).
  const baldosa = (href, icono, texto, n) => `<a href="${href}">${icono}<span>${texto}</span><b class="tu-n" data-n="${n}" hidden></b></a>`
  dropdown.innerHTML = `
    <span class="tu-tirador" aria-hidden="true"></span>
    <div class="tu-arriba">
      <a class="tu-cabeza" href="/perfil.html" aria-label="Ver tu perfil">
        <span class="nav-user-avatar-lg tu-avatar" style="${estiloAvatar}">${escapeHtml(inicial || '')}</span>
        <span class="tu-quien">
          <strong>${escapeHtml(name || '')}</strong>
          ${quien ? `<span>${escapeHtml(quien)}</span>` : ''}
        </span>
      </a>
      <button type="button" class="tu-tema-boton" data-tema-ciclo aria-label="${oscuro ? 'Cambiar al tema claro' : 'Cambiar al tema oscuro'}">${oscuro ? icons.sun(18) : icons.moon(18)}</button>
    </div>
    <nav class="tu-baldosas" aria-label="Lo tuyo">
      <button type="button" data-tu="avisos">${icons.bell(20)}<span>Avisos</span><b class="tu-cuenta" data-cuenta="navBellBadge"></b></button>
      <a href="/mensajes.html" data-tu="mensajes">${icons.mail(20)}<span>Mensajes</span><b class="tu-cuenta" data-cuenta="navMsgBadge"></b></a>
      ${baldosa('/guardados.html', icons.bookmark(20), 'Guardados', 'guardados')}
      ${baldosa('/mi-coleccion?ver=quiero', ICONOS_COLECCION.corazon(20), 'La quiero', 'quiero')}
      ${baldosa('/mazos', icons.layers(20), 'Mis mazos', 'mazos')}
      ${baldosa('/mis-partidas', icons.gamepad(20), 'Partidas', 'partidas')}
    </nav>
    <div class="tu-avisos-sitio"></div>
    <nav class="tu-lista" aria-label="Más">
      <a href="/ajustes">${icons.settings(20)}<span>Ajustes</span></a>
      <a class="tu-apoyar" href="${KOFI}" target="_blank" rel="noopener" title="Un café en Ko-fi">${taza(20)}<span>Apoyar PokeDoc</span></a>
      <button type="button" class="tu-salir" id="navUserSignOut">${icons.logOut(20)}<span>Salir</span></button>
    </nav>`

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
