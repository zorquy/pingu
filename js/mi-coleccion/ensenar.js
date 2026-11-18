// MODO «ENSEÑAR» (725, X15 de la lista): la colección a pantalla completa,
// una carta cada vez y grande, para enseñarla en persona —en la mesa de la
// tienda, al de al lado—. Se pasa con las flechas, deslizando o tocando
// los lados, y se sale con Esc o con la ✕.
//
// Y LA MEDALLA DE UN SET COMPLETO (725, X9): cuando la carta que acabas de
// añadir es la que faltaba, sale la mascota con su medalla. Una vez por set
// y por navegador: quitarla y volverla a poner no es completarlo otra vez.
import { escapeHtml } from '../html.js'
import { icons } from '../icons.js'
import { decidirGesto } from './gestos-ficha.js'

// Lo que se enseña: [{ fotos: [url, …respaldos], nombre, detalle }].
export function abrirEnsenar(cartas, { inicio = 0, doc = document, win = window } = {}) {
  if (!cartas?.length) return null
  let i = Math.max(0, Math.min(cartas.length - 1, inicio))
  let d = doc.getElementById('mcEnsenar')
  if (!d) {
    d = doc.createElement('dialog')
    d.id = 'mcEnsenar'
    d.className = 'mc-ensenar'
    d.setAttribute('aria-label', 'Enseñar tu colección')
    d.innerHTML = `
      <button type="button" class="mc-ensenar-cerrar" data-ensenar="cerrar" aria-label="Salir">✕</button>
      <button type="button" class="mc-ensenar-lado mc-ensenar-antes" data-ensenar="-1" aria-label="La anterior">‹</button>
      <figure class="mc-ensenar-carta"><img alt="" width="600" height="837" loading="eager"><figcaption><b></b><small></small></figcaption></figure>
      <button type="button" class="mc-ensenar-lado mc-ensenar-despues" data-ensenar="1" aria-label="La siguiente">›</button>
      <p class="mc-ensenar-sitio" aria-live="polite"></p>`
    doc.body.appendChild(d)
  }
  const img = d.querySelector('img')
  const pintar = () => {
    const c = cartas[i]
    let resto = (c.fotos || []).slice(1)
    img.onerror = () => {
      if (resto.length) {
        img.src = resto[0]
        resto = resto.slice(1)
      } else img.removeAttribute('src')
    }
    img.src = c.fotos?.[0] || ''
    img.alt = c.nombre || ''
    d.querySelector('figcaption b').textContent = c.nombre || ''
    d.querySelector('figcaption small').textContent = c.detalle || ''
    d.querySelector('.mc-ensenar-sitio').textContent = `${i + 1} de ${cartas.length}`
    d.querySelector('.mc-ensenar-antes').disabled = i === 0
    d.querySelector('.mc-ensenar-despues').disabled = i >= cartas.length - 1
  }
  const ir = (paso) => {
    const j = i + paso
    if (j < 0 || j >= cartas.length) return
    i = j
    pintar()
  }
  // Los oyentes se cambian en cada apertura (`on…`): la lista de cartas es
  // otra y no pueden apilarse.
  d.onclick = (e) => {
    const b = e.target.closest('[data-ensenar]')
    if (!b) return
    if (b.dataset.ensenar === 'cerrar') return d.close()
    ir(Number(b.dataset.ensenar))
  }
  // En el documento y no en el diálogo: al llegar a la última, su flecha
  // se apaga, el foco se cae del diálogo y sus teclas dejarían de llegar.
  doc.removeEventListener('keydown', d.__teclas || (() => {}))
  d.__teclas = (e) => {
    if (!d.open) return
    if (e.key === 'ArrowRight') ir(1)
    else if (e.key === 'ArrowLeft') ir(-1)
  }
  doc.addEventListener('keydown', d.__teclas)
  let toque = null
  d.ontouchstart = (e) => { toque = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null }
  d.ontouchend = (e) => {
    if (!toque) return
    const t = e.changedTouches[0]
    const g = decidirGesto({ dx: t.clientX - toque.x, dy: t.clientY - toque.y })
    toque = null
    if (g === 'siguiente') ir(1)
    else if (g === 'anterior') ir(-1)
    else if (g === 'cerrar') d.close()
  }
  d.onclose = () => {
    doc.removeEventListener('keydown', d.__teclas)
    if (doc.fullscreenElement) doc.exitFullscreen?.().catch(() => {})
  }
  pintar()
  if (!d.open) d.showModal()
  // A pantalla completa si se deja (en el iPhone no: el diálogo ya la ocupa).
  d.requestFullscreen?.().catch(() => {})
  return { dialogo: d, ir }
}

const CLAVE = 'pokedoc-sets-completos'

export function yaCelebrado(setId, almacen = globalThis.localStorage) {
  try {
    return (JSON.parse(almacen.getItem(CLAVE) || '[]') || []).includes(setId)
  } catch {
    return false
  }
}

function apuntarCelebrado(setId, almacen = globalThis.localStorage) {
  try {
    const lista = JSON.parse(almacen.getItem(CLAVE) || '[]') || []
    if (!lista.includes(setId)) almacen.setItem(CLAVE, JSON.stringify([...lista, setId].slice(-200)))
  } catch {}
}

// `logo` y `compartir` (784, MV4): confeti con los colores del logo, la
// medalla que gira hasta su sitio y un botón que comparte la lista del set.
// Desde la 1399 es la pantalla de las celebraciones (js/celebrar-momento.js,
// por import()), con el logo del set arriba. SIN capa (`modal: false`): la
// carta que lo completa acaba de entrar con su aviso de Deshacer, y una capa
// encima lo dejaría sin poder pulsar; la hoja la deja libre por abajo.
export async function celebrarSetCompleto({ setId, nombre, total, logo = null, compartir = null }) {
  if (!setId || yaCelebrado(setId)) return null
  apuntarCelebrado(setId)
  const [{ celebrarMomento }, colores] = await Promise.all([
    import('../celebrar-momento.js'),
    import('../efectos.js').then(({ coloresDeLogo }) => coloresDeLogo(logo)).catch(() => null),
  ])
  const insignia = logo
    ? `<img class="celebra-logo" src="${escapeHtml(logo)}" alt="" />`
    : `<span class="celebra-icono celebra-icono-medalla">${icons.medal(36)}</span>`
  return celebrarMomento({
    id: 'mcCompleto',
    tono: 'set',
    gesto: 'contento',
    insignia,
    ceja: 'Expansión completa',
    titulo: `¡Has completado ${nombre || 'la colección'}!`,
    texto: total ? `Las ${total} cartas del set, todas tuyas.` : 'Todas las cartas del set, tuyas.',
    cifras: total ? [[total, total === 1 ? 'carta' : 'cartas'], ['100 %', 'completa']] : [],
    boton: compartir ? { texto: 'Compartir', alPulsar: compartir } : null,
    confeti: 70,
    colores: colores?.length ? colores : undefined,
    modal: false,
  })
}

// «AÑADIDA», DICHO CON EL PROPIO BOTÓN (728, V4 de la lista). Al añadir, el
// «+» de esa carta rebota, se vuelve una marca verde un momento y suelta un
// «+1». Con «menos movimiento» el CSS no lo mueve y la marca se queda
// quieta lo mismo. Se quita con un temporizador y NO con `animationend`,
// que con «menos movimiento» no llega (la 313).
export function celebrarAnadida(raiz, cardId, { win = window } = {}) {
  if (!raiz || !cardId) return 0
  const botones = [...raiz.querySelectorAll(`[data-anadir="${CSS.escape(cardId)}"]`)]
  for (const b of botones) {
    b.classList.remove('mc-mas-hecho')
    void b.offsetWidth
    b.classList.add('mc-mas-hecho')
    const uno = b.ownerDocument.createElement('span')
    uno.className = 'mc-mas-uno'
    uno.setAttribute('aria-hidden', 'true')
    uno.textContent = '+1'
    b.appendChild(uno)
    win.setTimeout(() => {
      b.classList.remove('mc-mas-hecho')
      uno.remove()
    }, 900)
  }
  // Y la carta vuela a tu colección (784, MV3): a la pestaña del Panel de la
  // burbuja. Una por lote: si se añaden varias seguidas (ráfaga, selección),
  // vuela la primera y las demás no marean.
  const img = botones[0]?.closest('.mc-bolsillo, .mc-rejilla-celda, .mc-resultado')?.querySelector('img')
  const destino = raiz.ownerDocument.querySelector('#mcMenu [data-pestania="resumen"]')
  const ahora = Date.now()
  if (img && destino && ahora - ultimoVuelo > 900) {
    ultimoVuelo = ahora
    import('../efectos.js').then(({ volarCarta }) => volarCarta(img, destino)).catch(() => {})
  }
  return botones.length
}
let ultimoVuelo = 0

