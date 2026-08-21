import { supabase } from './supabase.js'
import { icons } from './icons.js'
import { contentIconHtml } from './content-icon.js'

// Vive en html.js para romper el ciclo con content-icon.js. Se reexporta
// para que los ficheros que ya lo importaban de aquí sigan igual.
export { escapeHtml } from './html.js'
import { escapeHtml } from './html.js'

export function getInitial(name) {
  if (!name) return '?'
  return name.trim().charAt(0).toUpperCase()
}

const TINT_COUNT = 5

function tintIndexForKey(key) {
  const str = String(key ?? '')
  let hash = 0
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) >>> 0
  return hash % TINT_COUNT
}

export function tintClassForKey(key) {
  return `icon-tint-${tintIndexForKey(key)}`
}

export function borderTintClassForKey(key) {
  return `border-tint-${tintIndexForKey(key)}`
}

export function borderRarityClass(rarity) {
  return `border-rarity-${rarity || 'bronze'}`
}

// Una guía puede tener solo documentación (para leer) o además un curso
// (los bloques interactivos de curso.html). Solo las que tienen curso
// cuentan para las barras de progreso: si no, una categoría con 1 curso
// y 2 guías de lectura decía "1 de 3 cursos completados" y la barra no
// llegaba nunca al final.
// Estilo del avatar de una persona, en un solo sitio.
//
// El patrón estaba copiado en seis ficheros y en todos tenía el mismo
// fallo: cuando HAY foto solo se ponía `background-image`, pero varias
// clases traen un `background-color` de fábrica en el CSS. Resultado: el
// color asomaba por detrás de la foto (por los bordes redondeados, o si
// la imagen no cubre del todo). Se ve raro y no hay forma de quitarlo
// desde el CSS sin romper el caso sin foto.
//
// Con foto: color transparente. Sin foto: el círculo de color, del mismo
// tamaño, con la inicial.
// Colores para el avatar de quien no tiene foto.
//
// El color se DEDUCE del identificador: es estable (a cada persona le
// toca siempre el mismo), no hace falta escribir nada en la base, y
// funciona desde ya para las cuentas que ya existen.
//
// La columna `user_profiles.avatar_color` NO se mira. Tiene valor por
// defecto en la base y ni la web ni el admin la escriben nunca: nadie
// puede elegir color de avatar. O sea que lo único que puede traer es el
// mismo azul para todo el mundo. Respetarla "por si alguien lo ha
// elegido a mano" protegía un caso que no existe y rompía el que sí:
// ganaba siempre y anulaba el reparto entero.
const COLORES_AVATAR = [
  '#1e5175', // azul PokeDoc
  '#8b5cf6', // violeta
  '#0e9488', // verde azulado
  '#d97706', // ámbar
  '#db2777', // rosa
  '#0284c7', // celeste
  '#65a30d', // verde
  '#dc2626', // rojo
  '#7c3aed', // púrpura
  '#0891b2', // cian
]

export function avatarColorForKey(key) {
  // No se reutiliza tintIndexForKey: ese hash es polinómico (h*31+c) y al
  // hacerle un módulo pequeño el resultado depende sobre todo de los
  // últimos caracteres. Con identificadores largos y parecidos entre sí
  // —como los UUID de Supabase— eso agrupaba a la gente en unos pocos
  // colores. Medido: 4 de 10 colores para 20 personas.
  //
  // Esta mezcla final (un finalizador tipo xorshift) reparte los bits
  // altos hacia los bajos antes del módulo.
  const s = String(key ?? '')
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  h ^= h >>> 16
  h = Math.imul(h, 2246822507) >>> 0
  h ^= h >>> 13
  h = Math.imul(h, 3266489909) >>> 0
  h ^= h >>> 16
  // El `>>> 0` de aquí NO es decorativo. En JavaScript el XOR devuelve un
  // entero con SIGNO: la línea de arriba deja `h` negativo casi la mitad
  // de las veces, `h % 10` sale negativo, y `COLORES_AVATAR[-3]` es
  // `undefined`. Eso acababa en `background-color: undefined`, que el
  // navegador descarta sin dar error, dejando el azul de la hoja de
  // estilos. Medido con UUID reales: el 45% de la gente.
  return COLORES_AVATAR[(h >>> 0) % COLORES_AVATAR.length]
}

export function avatarStyle(profile) {
  if (profile?.avatar_url) {
    return `background-image:url('${String(profile.avatar_url).replace(/'/g, '%27')}'); background-color:transparent;`
  }
  return `background-color:${avatarColorForKey(profile?.id || profile?.username || '')};`
}

// La misma decisión que avatarStyle, pero aplicada sobre un elemento que
// ya está en el DOM (los avatares grandes del perfil se pintan así, no
// con una plantilla). Existe para que no haya dos sitios decidiendo
// "¿foto o color?": ese reparto a mano fue justo lo que dejó tres
// ficheros pintando el azul por defecto.
export function applyAvatarTo(el, profile, inicial = '') {
  if (!el) return
  if (profile?.avatar_url) {
    el.style.backgroundImage = `url('${String(profile.avatar_url).replace(/'/g, '%27')}')`
    el.style.backgroundColor = 'transparent'
    el.textContent = ''
    return
  }
  el.style.backgroundImage = 'none'
  el.style.backgroundColor = avatarColorForKey(profile?.id || profile?.username || '')
  el.textContent = inicial
}

export function guideHasCourse(guide) {
  return Array.isArray(guide?.blocks) && guide.blocks.length > 0
}

// Simétrica de la de arriba, para la parte de Documentación.
//
// Antes las tarjetas miraban `guide.has_reference_blocks`, un campo que
// NO calcula nadie en la web: solo existía en el stub de pruebas. Si la
// base no lo trae, sale undefined y la tarjeta cree que la guía no tiene
// documentación. Ahora se deduce del propio contenido, y el campo, si
// viene, se respeta.
export function guideHasReference(guide) {
  if (typeof guide?.has_reference_blocks === 'boolean') return guide.has_reference_blocks
  return Array.isArray(guide?.reference_blocks) && guide.reference_blocks.length > 0
}

export function cardMediaHtml(imageUrl, emoji) {
  if (!imageUrl) return ''
  return `<div class="card-media" style="background-image:url('${imageUrl.replace(/'/g, '%27')}')"><span class="card-media-badge">${contentIconHtml(emoji, 16, 'bookOpen')}</span></div>`
}

// Contenido para el cuadradito de icono de una categoría (.category-icon,
// .emoji-big...): si tiene un dibujo propio (icon_image, subido a mano
// desde el admin) se muestra ese en vez del emoji — el emoji se queda
// como alternativa automática para las categorías que todavía no tengan
// icono personalizado. `size` controla tanto el tamaño de fuente del
// emoji como el ancho/alto del dibujo, para que el peso visual sea
// parecido elijas lo que elijas.
export function categoryIconHtml(category, size = 24) {
  if (category?.icon_image) {
    return `<img src="${category.icon_image.replace(/'/g, '%27')}" alt="" class="category-icon-img" style="width:${size}px; height:${size}px;" />`
  }
  return contentIconHtml(category?.emoji, size, 'bookOpen')
}

// Igual que categoryIconHtml pero para logros: achievement_definitions ya
// tenía la columna icon_url desde hace tiempo (y el admin ya dejaba
// rellenarla), pero nada en el sitio la usaba todavía — solo se pintaba
// el emoji siempre. El dibujo tiene prioridad si existe; si no, el emoji.
export function achievementIconHtml(achievement, size = 24) {
  if (achievement?.icon_url) {
    return `<img src="${achievement.icon_url.replace(/'/g, '%27')}" alt="" class="category-icon-img" style="width:${size}px; height:${size}px;" />`
  }
  return contentIconHtml(achievement?.emoji, size, 'trophy')
}

const CONFETTI_COLORS = ['var(--navy)', 'var(--indigo)', 'var(--warning)', 'var(--success)', 'var(--pink)', 'var(--ice-dark)']
let confettiStyleInjected = false

export function burstConfetti(count = 28) {
  if (!confettiStyleInjected) {
    const style = document.createElement('style')
    style.textContent = `
      .confetti-piece {
        position: fixed;
        top: -12px;
        width: 8px;
        height: 14px;
        border-radius: 2px;
        pointer-events: none;
        z-index: 400;
        animation-name: confettiFall;
        animation-timing-function: linear;
        animation-fill-mode: forwards;
      }
      @keyframes confettiFall {
        to { transform: translateY(105vh) rotate(600deg); opacity: 0.3; }
      }
    `
    document.head.appendChild(style)
    confettiStyleInjected = true
  }

  for (let i = 0; i < count; i++) {
    const piece = document.createElement('div')
    piece.className = 'confetti-piece'
    piece.style.left = `${Math.random() * 100}vw`
    piece.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length]
    const duration = 2.2 + Math.random() * 1.2
    const delay = Math.random() * 0.3
    piece.style.animationDuration = `${duration}s`
    piece.style.animationDelay = `${delay}s`
    document.body.appendChild(piece)
    setTimeout(() => piece.remove(), (duration + delay) * 1000 + 150)
  }
}

export function slugify(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80)
}

export function profileUrl(p) {
  return p?.username ? `/usuario/${encodeURIComponent(p.username)}` : `/usuario.html?id=${p?.id}`
}

// El redirect de netlify.toml reescribe /usuario/<nombre> a
// /usuario.html?u=<nombre> en el servidor sin tocar la URL del navegador,
// así que el username no aparece en window.location.search — hay que
// sacarlo de la ruta. Se mantiene ?u=/?id= como alternativa por si se
// entra directo a usuario.html (o en local, donde no hay redirects).
export function profileParamsFromLocation() {
  const params = new URLSearchParams(window.location.search)
  const pathMatch = window.location.pathname.match(/\/usuario\/([^/?#]+)/)
  return {
    username: pathMatch ? decodeURIComponent(pathMatch[1]) : params.get('u'),
    id: params.get('id'),
  }
}

export async function uniqueUsername(base, excludeUserId) {
  const clean = slugify(base) || 'user'
  let query = supabase.from('user_profiles').select('username').ilike('username', `${clean}%`)
  if (excludeUserId) query = query.neq('id', excludeUserId)
  const { data } = await query
  const taken = new Set((data || []).map((r) => (r.username || '').toLowerCase()))
  if (!taken.has(clean)) return clean
  let i = 2
  while (taken.has(`${clean}-${i}`)) i++
  return `${clean}-${i}`
}

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

export async function getProfile(userId) {
  const { data } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .single()
  return data
}

const MAX_IMAGE_MB = 5

export function validateImageFile(file, maxMB = MAX_IMAGE_MB) {
  if (!file.type.startsWith('image/')) {
    throw new Error('Ese archivo no es una imagen.')
  }
  if (file.size > maxMB * 1024 * 1024) {
    throw new Error(`La imagen pesa demasiado (máximo ${maxMB} MB).`)
  }
}

// Debe coincidir con la política de contraseñas configurada en Supabase
// (Authentication → Providers → Email → Password requirements): mínimo 8
// caracteres, con mayúsculas, minúsculas, números y símbolos. Comprobarlo
// aquí antes de llamar a Supabase evita un viaje de ida y vuelta solo para
// que lo rechace, y deja mostrar un único mensaje claro en español en vez
// del mensaje en inglés que devuelve la API.
export function passwordStrengthError(password) {
  if (password.length < 8) return 'La contraseña debe tener al menos 8 caracteres, con mayúsculas, minúsculas, números y símbolos.'
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    return 'La contraseña debe tener mayúsculas, minúsculas, números y símbolos.'
  }
  return null
}

export async function uploadProfileImage(userId, file, kind) {
  validateImageFile(file)
  const ext = (file.name.split('.').pop() || 'png').toLowerCase()
  const path = `${userId}/${kind}-${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
  if (error) throw error
  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  return data.publicUrl
}

export async function uploadGuideImage(userId, file) {
  validateImageFile(file)
  const ext = (file.name.split('.').pop() || 'png').toLowerCase()
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const { error } = await supabase.storage.from('guide-images').upload(path, file)
  if (error) throw error
  const { data } = supabase.storage.from('guide-images').getPublicUrl(path)
  return data.publicUrl
}

// Google manda el nombre de la cuenta en user_metadata al iniciar sesión,
// pero nada lo estaba leyendo: por eso quien entraba con Google se quedaba
// sin display_name y salía como "Usuario" por toda la web. Esto solo se
// usa como sugerencia para rellenar el onboarding — el nombre definitivo
// lo elige la persona.
// Foto de perfil que trae el proveedor al entrar con Google. Viene en
// `user_metadata` con dos nombres distintos según el proveedor, así que
// se miran los dos.
//
// Solo se usa si la persona NO tiene ya una foto propia: quien se haya
// subido la suya no debe verla sustituida por la de Google al volver a
// entrar.
export function avatarFromSession(session) {
  const meta = session?.user?.user_metadata || {}
  const url = meta.avatar_url || meta.picture
  return typeof url === 'string' && /^https:\/\//.test(url) ? url : null
}

export function suggestedNameFromSession(session) {
  const meta = session?.user?.user_metadata || {}
  const fromProvider = meta.full_name || meta.name || meta.preferred_username || meta.given_name
  if (fromProvider) return String(fromProvider).trim()
  const email = session?.user?.email || ''
  return email ? email.split('@')[0] : ''
}

export async function requireAuth() {
  const session = await getSession()
  if (!session) {
    window.location.href = '/auth.html'
    return null
  }
  return session
}

export async function signOut() {
  await supabase.auth.signOut()
  window.location.href = '/index.html'
}

async function renderNavUser(session) {
  const el = document.getElementById('nav-user')
  if (!el) return

  if (!session) {
    el.innerHTML = `<a href="/auth.html" class="btn-primary">Entrar</a>`
    return
  }

  let profile = await getProfile(session.user.id)

  // Quien entra con Google trae su foto en la sesión. Se guarda la
  // primera vez que se ve, y solo si no tiene ya una propia — así las
  // cuentas de Google que se registraron ANTES de esto también la cogen,
  // no solo las nuevas. Si falla, no pasa nada: la navbar sigue.
  const fotoProveedor = avatarFromSession(session)
  if (fotoProveedor && profile && !profile.avatar_url) {
    const { error } = await supabase.from('user_profiles').update({ avatar_url: fotoProveedor }).eq('id', session.user.id)
    if (!error) profile = { ...profile, avatar_url: fotoProveedor }
  }

  const name = profile?.display_name || profile?.username || session.user.email
  const estiloAvatar = avatarStyle(profile)

  el.innerHTML = `
    <div class="nav-user-wrap" id="navUserWrap">
      <button type="button" class="nav-user-avatar" id="navUserBtn" style="${estiloAvatar}" aria-label="Tu cuenta" title="${escapeHtml(name)}">${profile?.avatar_url ? '' : getInitial(name)}</button>
      <div class="nav-user-dropdown hidden" id="navUserDropdown"></div>
    </div>`

  const wrap = document.getElementById('navUserWrap')
  const dropdown = document.getElementById('navUserDropdown')
  let loaded = false

  // El módulo de gamificación se pide YA, no al pulsar: si se espera al
  // clic, abrir el menú obliga a bajar un fichero antes de enseñar nada.
  const gamificacion = import('./gamification.js').catch(() => null)

  function statsHtml(g, approvedGuidesCount) {
    if (!g) return ''
    const tier = g.contributorTier(approvedGuidesCount || 0)
    return `
      <div><strong>${profile?.total_xp || 0}</strong><span>XP</span></div>
      <div><strong style="display:flex; justify-content:center;">${g.levelBadgeHtml(g.calculateLevel(profile?.total_xp), 11)}</strong><span>Nivel</span></div>
      ${(profile?.current_streak || 0) > 0 ? `<div><strong style="display:flex; align-items:center; justify-content:center; gap:3px;">${icons.flame(14)} ${profile.current_streak}</strong><span>Racha</span></div>` : ''}
      ${(approvedGuidesCount || 0) > 0 ? `<div><strong style="display:flex; justify-content:center;">${tier.icon}</strong><span>${escapeHtml(tier.title)}</span></div>` : ''}`
  }

  // El menú se pinta ENTERO al momento con lo que ya se sabe (el perfil
  // se cargó al arrancar la página), y el recuento de guías aprobadas
  // —lo único que falta— se rellena cuando llega.
  //
  // Antes se esperaba a esa consulta antes de pintar nada, así que el
  // menú tardaba en desplegarse aunque el 90% de lo que enseña ya
  // estuviera disponible.
  async function loadDropdown() {
    const g = await gamificacion

    dropdown.innerHTML = `
      <div class="nav-user-header">
        <span class="nav-user-avatar-lg" style="${estiloAvatar}">${profile?.avatar_url ? '' : getInitial(name)}</span>
        <div>
          <strong>${escapeHtml(name)}</strong>
          ${profile?.username ? `<span class="subtext">@${escapeHtml(profile.username)}</span>` : ''}
        </div>
      </div>
      <div class="nav-user-stats" id="navUserStats">${statsHtml(g, null)}</div>
      <div class="nav-user-links">
        <a href="/perfil.html">${icons.user(16)} Mi perfil</a>
        <!-- Escribir una guía estaba SOLO dentro de una pestaña de
             Comunidad y de otra del perfil: había que saber que existía
             para encontrarlo. Aquí está en todas las páginas, en el menú
             que la gente ya abre. No se pone en la barra de navegación a
             propósito — se dejó en tres enlaces justamente para que no
             se llenara, y la inmensa mayoría de las visitas vienen a
             leer, no a escribir. -->
        <a href="/editor-guia.html">${icons.edit(16)} Escribir una guía</a>
        <a href="/guardados.html">${icons.bookmark(16)} Guardados</a>
        <button type="button" id="navFeedbackBtn">${icons.messageSquare(16)} Enviar feedback</button>
        <button type="button" id="navUserSignOut">${icons.logOut(16)} Cerrar sesión</button>
      </div>`

    // El recuento, cuando llegue. Solo repinta la fila de estadísticas,
    // así que no se pierde el foco ni se mueve nada de sitio.
    supabase
      .from('guides')
      .select('*', { count: 'exact', head: true })
      .eq('author_id', session.user.id)
      .eq('review_status', 'approved')
      .then(({ count }) => {
        const fila = document.getElementById('navUserStats')
        if (fila && count) fila.innerHTML = statsHtml(g, count)
      })
      .catch(() => {})

    document.getElementById('navUserSignOut').addEventListener('click', signOut)
    document.getElementById('navFeedbackBtn').addEventListener('click', async () => {
      dropdown.classList.add('hidden')
      const { openFeedbackModal } = await import('./feedback.js')
      openFeedbackModal()
    })
  }

  document.getElementById('navUserBtn').addEventListener('click', async () => {
    const willShow = dropdown.classList.contains('hidden')
    dropdown.classList.toggle('hidden', !willShow)
    if (willShow && !loaded) {
      loaded = true
      await loadDropdown()
    }
  })
  document.addEventListener('click', (e) => {
    if (!wrap.contains(e.target)) dropdown.classList.add('hidden')
  })
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') dropdown.classList.add('hidden')
  })
}

function initScrollShadow() {
  const navbar = document.getElementById('navbar')
  if (!navbar) return
  const onScroll = () => {
    if (window.scrollY > 20) {
      navbar.classList.add('scrolled')
    } else {
      navbar.classList.remove('scrolled')
    }
  }
  window.addEventListener('scroll', onScroll)
  onScroll()
}

function initMobileMenu() {
  const toggle = document.getElementById('navToggle')
  const menu = document.getElementById('navMobileMenu')
  if (!toggle || !menu) return
  toggle.addEventListener('click', () => {
    menu.classList.toggle('open')
  })
}

function markActiveLink() {
  const page = window.location.pathname.split('/').pop() || 'index.html'
  document.querySelectorAll('.nav-links a, .nav-menu-mobile a').forEach((a) => {
    const href = a.getAttribute('href')
    if (href === page) a.classList.add('active')
  })
}

export async function initNavbar() {
  // Todos los import() dinámicos de aquí llevan .catch(): si uno falla
  // (red inestable, o un bloqueador que se carga el fichero), lo que
  // toca es que ese trozo no funcione y ya, no que reviente el resto de
  // la navbar ni que se llene el registro de errores. Un módulo que no
  // carga dispara los DOS manejadores globales (error y
  // unhandledrejection), así que cada fallo se registraba por duplicado.
  import('./error-log.js').then(({ initErrorLogging }) => initErrorLogging()).catch(() => {})
  initScrollShadow()
  initMobileMenu()
  markActiveLink()
  const session = await getSession()
  if (session) {
    const profile = await getProfile(session.user.id)
    if (profile?.is_banned) {
      await supabase.auth.signOut()
      window.location.href = '/auth.html?banned=1'
      return session
    }
    // Quien entra con Google nunca pasaba por el onboarding (el redirect
    // de OAuth va directo a index.html y se salta la comprobación que sí
    // hace el login con contraseña), así que se quedaba sin nombre. Aquí
    // se le manda a elegirlo.
    //
    // La condición mira si NO HAY NOMBRE, en vez de fiarse solo de
    // onboarding_completed: hay cuentas antiguas con esa columna a null
    // que sí tienen nombre, y no hay que molestarlas.
    //
    // El `#nav-user` es lo que decide dónde se aplica esto. No basta con
    // que onboarding.html no pinte navbar: esta función se ejecuta al
    // IMPORTAR este módulo, y onboarding.js lo importa para usar
    // requireAuth — sin esta comprobación, el onboarding se redirigía a
    // sí mismo en bucle. auth.html y reset-password.html quedan fuera por
    // el mismo motivo.
    const hasNavbar = !!document.getElementById('nav-user')
    const hasName = !!(profile?.display_name || profile?.username)
    if (hasNavbar && (!hasName || profile?.onboarding_completed === false)) {
      window.location.href = '/onboarding.html'
      return session
    }

    // No se espera a que termine — en el 99% de las cargas de página no
    // hace nada (ya se contó hoy), así que no debería frenar el resto de
    // la navbar. Cuando conteste, la racha del día se cuelga en la barra.
    import('./gamification.js')
      .then(({ checkDailyStreak }) => checkDailyStreak(session.user.id))
      .then((racha) => pintarRachaEnNavbar(racha))
      .catch(() => {})
  }
  import('./page-views.js').then(({ logPageView }) => logPageView(session)).catch(() => {})
  // El latido de "usuarios en línea" (js/en-linea.js). Igual que la
  // visita: sin esperar, y si falla no toca nada.
  import('./en-linea.js').then(({ latidoEnLinea }) => latidoEnLinea()).catch(() => {})
  renderNavUser(session).catch(() => {})

  // Los iconos de la barra: se DESCARGAN a la vez y se PINTAN en orden.
  //
  // Antes iban con un `await` cada uno, encadenados: hasta que no bajaba
  // y se ejecutaba el módulo de la lupa no empezaba a pedirse el del
  // tema, y así hasta la campana. Por eso aparecían de izquierda a
  // derecha, uno detrás de otro, y la campana siempre la última: eran
  // cuatro viajes en fila en vez de cuatro a la vez.
  //
  // No vale con lanzarlos todos y ya: cada módulo se mete solo en la
  // barra al terminar, así que el orden de los iconos sería el orden en
  // que acaben de bajar — distinto en cada carga. Por eso se espera a
  // tenerlos todos y se pinta en el orden de siempre.
  const modulos = await Promise.all([
    import('./nav-search.js').catch(() => null),
    import('./theme.js').catch(() => null),
    session ? import('./nav-messages.js').catch(() => null) : null,
    session ? import('./notifications.js').catch(() => null) : null,
  ])
  const [busqueda, tema, mensajes, campana] = modulos

  // Cada icono se pinta aislado: que falle uno no puede dejar la barra a
  // medias. El `catch` tiene que cubrir también los fallos ASÍNCRONOS —
  // estas funciones son `async`, y un try/catch normal no atrapa una
  // promesa rechazada, se convierte en un error suelto de la página.
  const pintar = (fn) => {
    try {
      Promise.resolve(fn()).catch(() => {})
    } catch {}
  }
  pintar(() => busqueda?.renderNavSearch())
  pintar(() => tema?.renderThemeToggle())
  if (session) {
    pintar(() => mensajes?.renderNavMessages(session))
    pintar(() => campana?.renderNotificationBell(session))
  }

  // Las piezas globales que no corren prisa y no pueden tumbar nada: la
  // tarjetita al posar el ratón sobre un nombre, la franja de aviso del
  // admin y el botón de volver arriba.
  import('./hovercard.js').then((m) => m.engancharTarjetasDeUsuario()).catch(() => {})
  import('./aviso-global.js').then((m) => m.pintarAvisoGlobal()).catch(() => {})
  import('./lightbox.js').then((m) => m.engancharLightbox()).catch(() => {})
  try {
    montarVolverArriba()
    montarProgresoLectura()
  } catch {}
  return session
}

// La barra finísima de progreso de lectura, pegada al borde de arriba.
// Solo asoma en páginas largas (una guía, un hilo con chicha): en una
// pantalla y media no dice nada que no diga la propia página.
function montarProgresoLectura() {
  const barra = document.createElement('div')
  barra.className = 'progreso-lectura'
  barra.setAttribute('aria-hidden', 'true')
  document.body.appendChild(barra)
  const pintar = () => {
    const total = document.documentElement.scrollHeight - window.innerHeight
    if (total < window.innerHeight * 1.5) {
      barra.style.transform = 'scaleX(0)'
      return
    }
    const parte = Math.min(1, Math.max(0, window.scrollY / total))
    barra.style.transform = `scaleX(${parte})`
  }
  window.addEventListener('scroll', pintar, { passive: true })
  window.addEventListener('resize', pintar, { passive: true })
  pintar()
}

// La llamita de la racha diaria, a la vista en la barra — antes solo se
// descubría abriendo el menú de la cuenta. Se PREPONE a .nav-right y no
// se cuelga junto al avatar a propósito: la lupa, el tema, los mensajes
// y la campana se insertan ahí de forma asíncrona, así que "antes del
// avatar" sería un sitio distinto en cada carga; el primer hueco de la
// derecha es siempre el mismo.
function pintarRachaEnNavbar(racha) {
  if (!racha || racha < 1) return
  const barra = document.querySelector('.nav-right')
  if (!barra || document.getElementById('navRacha')) return
  const dias = racha === 1 ? '1 día seguido' : `${racha} días seguidos`
  const chip = document.createElement('a')
  chip.id = 'navRacha'
  chip.className = 'nav-racha'
  chip.href = '/perfil.html'
  chip.title = `Racha diaria: llevas ${dias} entrando. Entra mañana para no perderla.`
  chip.setAttribute('aria-label', `Racha diaria: ${dias}`)
  chip.innerHTML = `${icons.flame(15)}<span>${racha}</span>`
  barra.prepend(chip)
}

// El botón flotante de "volver arriba" de los hilos y guías largos.
// Aparece pasadas unas pantallas de scroll; antes solo estorbaría.
function montarVolverArriba() {
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'volver-arriba hidden'
  btn.setAttribute('aria-label', 'Volver arriba')
  btn.textContent = '↑'
  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }))
  document.body.appendChild(btn)
  let visible = false
  window.addEventListener(
    'scroll',
    () => {
      const debe = window.scrollY > 600
      if (debe === visible) return
      visible = debe
      btn.classList.toggle('hidden', !visible)
    },
    { passive: true }
  )
}

// Se ejecuta en cuanto se importa este módulo en cualquier página.
initNavbar()
