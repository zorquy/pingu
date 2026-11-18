// La mascota en 3D, en toda la web (1389, PINGU: «dale con todo lo
// recomendado… prefiero que tarde más en cargar y que salga la mascota»).
//
// Un hueco es cualquier elemento con `data-mascota="<gesto>"` (lo escriben
// home.js, vacio.js, guardados.js, el 404…). Aquí se hace todo lo demás:
//   · el motor (js/vendor/three.min.js, 149 KB comprimido) y el modelo
//     (js/mascota-modelo.js) se bajan SOLO cuando hay un hueco en la página,
//     y fuera del presupuesto de la portada: llegan por `import()`;
//   · NO se enseña antes el dibujo de siempre: el hueco guarda su sitio
//     vacío y la mascota aparece cuando está lista. El dibujo solo sale si el
//     3D no puede (sin WebGL, o sin red y sin el motor guardado);
//   · un solo motor pinta todos los huecos que se ven, uno tras otro, a 30
//     imágenes por segundo, y se para cuando no se ve ninguno;
//   · cada hueco hace su gesto al aparecer y luego se queda respirando; si
//     le tocas, reacciona (cosquillas, enfado, mareo);
//   · Ajustes › Apariencia › Mascota: «Con movimiento», «Quieta» (una foto
//     del gesto) o «Sin mascota». Y «menos movimiento» del sistema = Quieta.
//
// Este fichero no importa nada de la web: lo usa también /sin-conexion.

const LLAVE = 'pd-mascota'
const DIBUJO = '/assets/images/mascota.webp'
const LADO = 384 // lo que pinta el motor; cada hueco lo escala a su tamaño
const PASO = 1000 / 30

export function preferenciaMascota() {
  try {
    const v = localStorage.getItem(LLAVE)
    return v === 'quieta' || v === 'no' ? v : 'mueve'
  } catch { return 'mueve' }
}

export function guardarPreferenciaMascota(v) {
  try { v === 'mueve' ? localStorage.removeItem(LLAVE) : localStorage.setItem(LLAVE, v) } catch {}
  document.documentElement.toggleAttribute('data-sin-mascota', v === 'no')
  for (const p of puestos) p.quieta = estaQuieta()
  pedirFotograma()
}

const reducido = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
const estaQuieta = () => preferenciaMascota() === 'quieta' || reducido()

// ── El motor, una vez ──
let motor = null
function cargarTres() {
  if (window.THREE) return Promise.resolve(window.THREE)
  return new Promise((ok, mal) => {
    const s = document.createElement('script')
    s.src = '/js/vendor/three.min.js'
    s.async = true
    s.onload = () => (window.THREE ? ok(window.THREE) : mal(new Error('sin THREE')))
    s.onerror = () => mal(new Error('no se pudo bajar el motor 3D'))
    document.head.appendChild(s)
  })
}
function arrancarMotor() {
  motor ||= (async () => {
    const T = await cargarTres()
    const { crearModelo } = await import('./mascota-modelo.js')
    const lienzo = document.createElement('canvas')
    const render = new T.WebGLRenderer({ canvas: lienzo, antialias: true, alpha: true })
    render.setPixelRatio(1)
    render.setSize(LADO, LADO, false)
    const camara = new T.PerspectiveCamera(30, 1, 0.1, 60)
    camara.position.set(0.55, 2.2, 6.3)
    camara.lookAt(0.1, 1.95, 0)
    return { modelo: crearModelo(T), render, camara, lienzo }
  })()
  return motor
}

// ── Los huecos ──
const puestos = []
let visor = null
function vigilar(p) {
  visor ||= new IntersectionObserver((es) => {
    for (const e of es) {
      const q = puestos.find((x) => x.el === e.target)
      if (!q) continue
      q.ve = e.isIntersecting
      // El gesto empieza la primera vez que se ve, no al cargar la página.
      if (q.ve && q.inicio == null) q.inicio = performance.now() / 1000
    }
    pedirFotograma()
  }, { rootMargin: '60px' })
  visor.observe(p.el)
}

function respaldo(el) {
  // /sin-conexion trae el dibujo dentro (no hay red para pedirlo).
  const propio = el.querySelector('img[hidden]')
  if (propio) { propio.hidden = false; el.dataset.montada = 'dibujo'; return }
  if (el.querySelector('img')) return
  el.insertAdjacentHTML('beforeend', `<img class="mascota-dibujo" src="${DIBUJO}" alt="" loading="lazy" decoding="async">`)
  el.dataset.montada = 'dibujo'
}

// El saludo de Inicio, una vez al día (las demás veces ya está ahí, quieta
// y respirando).
function gestoDelHueco(el) {
  const g = el.dataset.mascota || 'reposo'
  if (!('saludoDelDia' in el.dataset)) return g
  const hoy = new Date().toISOString().slice(0, 10)
  try {
    if (localStorage.getItem('pd-mascota-saludo') === hoy) return 'reposo'
    localStorage.setItem('pd-mascota-saludo', hoy)
  } catch {}
  return g
}

export function montarMascotas(raiz = document) {
  if (preferenciaMascota() === 'no') return
  const nuevos = [...raiz.querySelectorAll('[data-mascota]:not([data-montada])')]
  if (raiz !== document && raiz.matches?.('[data-mascota]:not([data-montada])')) nuevos.unshift(raiz)
  if (!nuevos.length) return
  for (const el of nuevos) {
    el.dataset.montada = 'cargando'
    const lienzo = document.createElement('canvas')
    lienzo.className = 'mascota-lienzo'
    lienzo.setAttribute('aria-hidden', 'true')
    el.appendChild(lienzo)
    let globo = null
    if (!('sinGlobo' in el.dataset)) {
      globo = document.createElement('span')
      globo.className = 'mascota-globo'
      globo.hidden = true
      el.appendChild(globo)
    }
    const p = { el, lienzo, g: lienzo.getContext('2d'), globo, gesto: gestoDelHueco(el), vacio: 'vacio' in el.dataset, giro: el.dataset.giro ? Number(el.dataset.giro) : -0.3, inicio: null, ve: false, toque: -99, toques: 0, extra: null, dicho: '', quieta: estaQuieta(), pintada: false }
    puestos.push(p)
    lienzo.addEventListener('click', () => tocar(p))
  }
  arrancarMotor()
    .then(() => {
      for (const p of puestos) if (p.el.dataset.montada === 'cargando') { p.el.dataset.montada = '3d'; vigilar(p) }
      pedirFotograma()
    })
    .catch(() => {
      for (const p of puestos.splice(0)) respaldo(p.el)
    })
}

function tocar(p) {
  if (p.quieta) return
  const ahora = performance.now() / 1000
  p.toques = ahora - p.toque < 2.5 ? p.toques + 1 : 1
  p.toque = ahora
  p.extra = p.toques >= 7 ? 'mareado' : p.toques >= 4 ? 'enfado' : p.toques >= 2 ? 'risa' : 'toque'
  pedirFotograma()
}

// Un momento suelto (La quiero, un logro): la mascota sale junto a `ancla`,
// hace su gesto y se va. No deja nada en la página.
export function mascotaMomento(ancla, gesto, { lado = 96, sinGlobo = false } = {}) {
  if (preferenciaMascota() === 'no' || !ancla?.getBoundingClientRect) return
  const r = ancla.getBoundingClientRect()
  const el = document.createElement('span')
  el.className = 'mascota-3d mascota-momento'
  el.dataset.mascota = gesto
  if (sinGlobo) el.dataset.sinGlobo = ''
  const x = Math.min(window.innerWidth - lado - 6, Math.max(6, r.left + r.width / 2 - lado / 2))
  const y = Math.max(6, r.top - lado + 10)
  el.style.cssText = `left:${x}px;top:${y}px;width:${lado}px;height:${lado}px`
  document.body.appendChild(el)
  montarMascotas(el)
  arrancarMotor().then(({ modelo }) => {
    const dura = Math.min(4, (modelo.ANIM[gesto]?.d || 2.5) + 0.4)
    setTimeout(() => { el.classList.add('mascota-se-va'); setTimeout(() => quitar(el), 400) }, dura * 1000)
  }).catch(() => quitar(el))
}

function quitar(el) {
  const i = puestos.findIndex((p) => p.el === el)
  if (i >= 0) { visor?.unobserve(el); puestos.splice(i, 1) }
  el.remove()
}

// ── El bucle: solo mientras se vea algún hueco que se mueva ──
let pedido = 0
let ultimo = 0
function pedirFotograma() {
  if (!pedido) pedido = requestAnimationFrame(fotograma)
}
async function fotograma(ahoraMs) {
  pedido = 0
  if (!motor || document.hidden) return
  const m = await motor.catch(() => null)
  if (!m) return
  // Los huecos que ya no están en la página (una lista que se repinta), fuera.
  for (const p of [...puestos]) if (!p.el.isConnected) quitar(p.el)
  const vivos = puestos.filter((p) => p.ve && p.el.dataset.montada === '3d')
  if (!vivos.length) return
  if (ahoraMs - ultimo < PASO - 2) { pedirFotograma(); return }
  ultimo = ahoraMs
  const t = ahoraMs / 1000
  let sigue = false
  for (const p of vivos) {
    if (p.quieta && p.pintada) continue
    const anim = m.modelo.ANIM
    let gesto = 'reposo'
    let a = 0
    if (p.quieta) {
      if (anim[p.gesto]) { gesto = p.gesto; a = Math.min(anim[p.gesto].d * 0.45, 1.3) }
    } else if (p.extra && t - p.toque < anim[p.extra].d) {
      gesto = p.extra; a = t - p.toque
    } else {
      p.extra = null
      a = t - (p.inicio ?? t)
      if (anim[p.gesto] && a < anim[p.gesto].d) gesto = p.gesto
    }
    m.modelo.girar(p.giro)
    m.modelo.pose(gesto, a, t, { vivo: !p.quieta, vacio: p.vacio })
    m.render.render(m.modelo.escena, m.camara)
    const lado = Math.round(Math.min(512, p.lienzo.clientWidth * (window.devicePixelRatio || 1)))
    if (lado && p.lienzo.width !== lado) { p.lienzo.width = lado; p.lienzo.height = lado }
    p.g.clearRect(0, 0, p.lienzo.width, p.lienzo.height)
    p.g.drawImage(m.lienzo, 0, 0, p.lienzo.width, p.lienzo.height)
    if (!p.pintada) { p.pintada = true; p.el.classList.add('mascota-lista') }
    if (p.globo) {
      const dicho = gesto === 'reposo' ? '' : anim[gesto].t(a) || ''
      if (dicho !== p.dicho) { p.dicho = dicho; p.globo.textContent = dicho; p.globo.hidden = !dicho }
    }
    if (!p.quieta) sigue = true
  }
  if (sigue) pedirFotograma()
}

document.addEventListener('visibilitychange', () => { if (!document.hidden) pedirFotograma() })
