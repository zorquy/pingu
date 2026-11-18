// Las pantallas que celebran (1399, «PokeDoc en modo app»; PINGU: «las
// pantallas que celebran… también me gusta»). Subir de nivel, completar una
// expansión y las rachas de 7, 30 y 100 días eran un aviso pequeño (un toast,
// una cajita arriba). Ahora son una pantalla con la mascota, como la de
// campeón de la 1394 (js/torneos/celebrar.js), que es el molde.
//
// No va en la portada: quien celebra lo pide con import() en el momento, y
// la hoja (css/celebra.css) se baja a la vez. Cada momento sale UNA vez por
// navegador (su `llave` en localStorage); sin localStorage, no sale (mejor
// callar que repetirlo en cada página). Un toque fuera o «Seguir» la cierra;
// con «menos movimiento», sin confeti (lo decide burstConfetti).
import { escapeHtml } from './html.js'
import { icons } from './icons.js'
import { NIVELES } from './niveles.js'

let hojaLista = null
function hoja(doc = document) {
  if (hojaLista) return hojaLista
  hojaLista = new Promise((listo) => {
    if (doc.querySelector('link[data-celebra]')) return listo()
    const l = doc.createElement('link')
    l.rel = 'stylesheet'
    l.href = '/css/celebra.css'
    l.dataset.celebra = ''
    l.onload = l.onerror = () => listo()
    doc.head.appendChild(l)
    // Si la hoja no llega, se celebra igual (con el aspecto del navegador).
    setTimeout(listo, 2000)
  })
  return hojaLista
}

function marcar(llave) {
  if (!llave) return true
  try {
    if (localStorage.getItem(llave) === '1') return false
    localStorage.setItem(llave, '1')
    return true
  } catch {
    return false
  }
}

// El molde. `tono`: nivel | racha | set (el color del fondo). `modal: false`
// celebra sin capa (la expansión completa: abajo queda el Deshacer de la
// carta que la completó, y no puede quedar tapado).
export async function celebrarMomento({ llave, id = '', tono = 'nivel', gesto = 'contento', insignia = '', ceja = '', titulo, texto = '', cifras = [], boton = null, confeti = 60, colores, modal = true }) {
  if (!titulo || !marcar(llave)) return null
  await hoja()
  const d = document.createElement('dialog')
  if (id) d.id = id
  d.className = `celebra celebra-${tono}${modal ? '' : ' celebra-sin-capa'}`
  d.setAttribute('aria-labelledby', 'celebraTitulo')
  d.innerHTML = `
    <div class="celebra-caja">
      <span class="celebra-mascota mascota-3d" data-mascota="${escapeHtml(gesto)}" data-sin-globo></span>
      ${insignia ? `<span class="celebra-insignia" aria-hidden="true">${insignia}</span>` : ''}
      ${ceja ? `<small class="celebra-ceja">${escapeHtml(ceja.toUpperCase())}</small>` : ''}
      <h2 class="celebra-titulo" id="celebraTitulo">${escapeHtml(titulo)}</h2>
      ${texto ? `<p class="celebra-texto">${escapeHtml(texto)}</p>` : ''}
      ${cifras.length ? `<div class="celebra-cifras">${cifras.map(([n, r]) => `<span><b>${escapeHtml(String(n))}</b><small>${escapeHtml(r)}</small></span>`).join('')}</div>` : ''}
      <div class="celebra-botones">
        ${boton ? `<button type="button" class="btn-secondary celebra-otro" data-celebra-boton>${escapeHtml(boton.texto)}</button>` : ''}
        <button type="button" class="btn-primary celebra-seguir" data-cerrar>Seguir</button>
      </div>
    </div>`
  document.body.appendChild(d)
  const cerrar = () => { d.close(); d.remove() }
  d.addEventListener('click', (e) => {
    if (e.target.closest('[data-celebra-boton]')) boton?.alPulsar?.()
    if (e.target === d || e.target.closest('[data-cerrar]')) cerrar()
  })
  d.addEventListener('cancel', (e) => { e.preventDefault(); cerrar() })
  if (modal) d.showModal()
  else d.show()
  d.querySelector('[data-cerrar]')?.focus({ preventScroll: true })
  if (confeti) import('./app.js').then(({ burstConfetti }) => burstConfetti?.(confeti, colores)).catch(() => {})
  return d
}

// Subir de nivel: el icono del nivel en su color, «Nivel N de 10» y Compartir.
export function celebrarNivel(nivel, { compartir = null } = {}) {
  const i = NIVELES.findIndex((n) => n.level === nivel)
  if (i < 0) return Promise.resolve(null)
  const n = NIVELES[i]
  const insignia = `<span class="celebra-icono celebra-icono-nivel" style="--nivel:${n.color}">${icons[n.icono]?.(40) || icons.star(40)}</span>`
  return celebrarMomento({
    llave: `pd-nivel-${nivel}`,
    tono: n.especial ? 'oro' : 'nivel',
    gesto: i >= 8 ? 'bailar' : 'contento',
    insignia,
    ceja: '¡Subes de nivel!',
    titulo: nivel,
    texto: n.next ? `El siguiente, a ${n.next.toLocaleString('es-ES')} XP.` : 'Es el nivel más alto. Lo has conseguido todo.',
    cifras: [[`${i + 1}`, `de ${NIVELES.length}`]],
    boton: compartir ? { texto: 'Compartir', alPulsar: compartir } : null,
    confeti: i >= 8 ? 120 : 70,
  })
}

// Las rachas que se celebran en grande. Las demás, como siempre (el chip).
export const RACHAS_GRANDES = [7, 30, 100]
export function celebrarRacha(dias, { escudo = false, hoy = new Date().toISOString().slice(0, 10) } = {}) {
  if (!RACHAS_GRANDES.includes(dias)) return Promise.resolve(null)
  return celebrarMomento({
    // Con el día: si la pierdes y vuelves a llegar a 7, se celebra otra vez.
    llave: `pd-racha-${dias}-${hoy}`,
    tono: dias >= 100 ? 'oro' : 'racha',
    gesto: dias >= 30 ? 'bailar' : 'contento',
    insignia: `<span class="celebra-icono celebra-icono-llama">${icons.flame(40)}</span>`,
    ceja: 'Racha',
    titulo: `¡${dias} días seguidos!`,
    texto: dias === 7 ? 'Una semana entera sin fallar.' : dias === 30 ? 'Un mes entero. Esto ya es costumbre.' : 'Cien días. Eres leyenda.',
    cifras: [[dias, 'días'], ...(escudo ? [['+1', 'protector']] : [])],
    confeti: dias >= 100 ? 140 : dias >= 30 ? 90 : 60,
  })
}
