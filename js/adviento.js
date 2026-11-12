// EL CALENDARIO DE ADVIENTO en Inicio (tanda 1285, PINGU eligió lo
// recomendado: con XP y logro). Una tira bajo el saludo —su sitio lo reserva
// la línea de la cabecera con `data-adviento`, para que nada salte— y, al
// tocarla, el calendario en un pop-up con las 24 casillas. Abrir una la
// decide y la paga la base (`adviento_abrir`, migración 1285): aquí solo se
// pinta. Lo puro está en js/adviento-puro.js. Lo entra home.js por import()
// y solo en diciembre.
import { supabase } from './supabase.js'
import { getSession, escapeHtml } from './app.js'
import { icons } from './icons.js'
import { hojaInyectada } from './hoja.js'
import { showToast } from './toast.js'
import { CASILLAS, XP_POR_CASILLA, adviento, estadoCasilla, resumenAdviento, siguienteCasilla, dibujoDe } from './adviento-puro.js'

const buscar = (nombre) => `/cartas?ver=buscar&q=${encodeURIComponent(nombre)}`

let estado = { a: null, abiertas: new Set(), sesion: null, caja: null, pop: null }

function puntosHtml(a, abiertas) {
  return Array.from({ length: 24 }, (_, i) => `<i class="adv-punto adv-${estadoCasilla(i + 1, a, abiertas)}"></i>`).join('')
}

function tiraHtml() {
  const { a, abiertas } = estado
  const sig = siguienteCasilla(a, abiertas)
  const boton = sig
      ? `<button type="button" class="btn-primary adv-boton" data-adv-abrir="${sig}">Abrir la ${sig}</button>`
      : '<button type="button" class="btn-secondary adv-boton" data-adv-ver>Ver el calendario</button>'
  return `<button type="button" class="adv-tira-toque" data-adv-ver aria-label="Ver el Calendario de Adviento">
      <span class="adv-regalo" aria-hidden="true">${icons.gift(22)}</span>
      <span class="adv-texto">
        <b>Calendario de Adviento</b>
        <small>${escapeHtml(resumenAdviento(a, abiertas))}</small>
      </span>
    </button>
    ${boton}
    <span class="adv-puntos" aria-hidden="true">${puntosHtml(a, abiertas)}</span>`
}

function pintarTira() {
  if (estado.caja) estado.caja.innerHTML = tiraHtml()
}

function calendarioHtml() {
  const { a, abiertas } = estado
  const casillas = CASILLAS.map((_, i) => {
    const n = i + 1
    const e = estadoCasilla(n, a, abiertas)
    const se = e !== 'cerrada'
    const titulo = e === 'abierta' ? `Casilla ${n}, abierta` : e === 'cerrada' ? `Casilla ${n}, todavía cerrada` : `Abrir la casilla ${n}`
    return `<button type="button" class="adv-casilla adv-${e}" data-adv-abrir="${n}"${se ? '' : ' disabled'} aria-label="${titulo}">${e === 'abierta' ? icons.checkCircle(16) : n}</button>`
  }).join('')
  return `<div class="adv-cab">
      <h2>Calendario de Adviento</h2>
      <button type="button" class="adv-cerrar" data-adv-cerrar aria-label="Cerrar">${icons.x(20)}</button>
    </div>
    <div class="adv-cuerpo" data-adv-cuerpo>
      <p class="adv-lema">${escapeHtml(resumenAdviento(a, abiertas))}</p>
      <div class="adv-rejilla">${casillas}</div>
      <p class="adv-nota">Cada casilla da ${XP_POR_CASILLA} XP la primera vez. Con las 24, el logro «Adviento ${a.anio}». Las de días pasados se pueden abrir hasta el 31.</p>
    </div>`
}

function reveloHtml(n, r) {
  const [dex, nombre, dato] = CASILLAS[n - 1]
  const [src, respaldo] = dibujoDe(dex)
  const premio = !r ? '<span class="adv-chapa adv-chapa-espera">Abriendo…</span>'
    : r.nueva ? `<span class="adv-chapa">+${r.xp} XP</span>` : '<span class="adv-chapa adv-chapa-ya">Ya la habías abierto</span>'
  return `<div class="adv-revelo">
      <span class="adv-numero">Casilla ${n}</span>
      <span class="adv-dibujo"><img src="${src}" data-respaldo="${respaldo}" alt="" width="160" height="160" loading="lazy" decoding="async"></span>
      <h3>${escapeHtml(nombre)}</h3>
      <p>${escapeHtml(dato)}</p>
      <span data-adv-premio>${premio}</span>
      <div class="adv-botones">
        <a class="btn-secondary" href="${buscar(nombre)}">Ver sus cartas</a>
        <button type="button" class="btn-primary" data-adv-volver>Volver al calendario</button>
      </div>
    </div>`
}

function engancharRespaldos(raiz) {
  for (const img of raiz.querySelectorAll('img[data-respaldo]')) {
    img.addEventListener('error', () => {
      if (img.dataset.respaldo) { img.src = img.dataset.respaldo; delete img.dataset.respaldo } else img.remove()
    })
  }
}

function abrirPop() {
  let pop = estado.pop
  if (!pop) {
    document.body.insertAdjacentHTML('beforeend', '<dialog class="adv-pop" aria-label="Calendario de Adviento"></dialog>')
    pop = estado.pop = document.body.lastElementChild
    pop.addEventListener('click', (e) => {
      if (e.target === pop || e.target.closest('[data-adv-cerrar]')) return pop.close()
      if (e.target.closest('[data-adv-volver]')) return pintarPop()
      const n = Number(e.target.closest('[data-adv-abrir]')?.dataset.advAbrir)
      if (n) abrirCasilla(n)
    })
    pop.addEventListener('close', () => pintarTira())
  }
  pintarPop()
  if (!pop.open) pop.showModal()
  return pop
}

function pintarPop() {
  if (estado.pop) estado.pop.innerHTML = calendarioHtml()
}

// Abrir: se enseña YA (la 896) y la base confirma; si dice que no, se vuelve
// al calendario con su aviso.
async function abrirCasilla(n) {
  const { a, abiertas, sesion } = estado
  if (!sesion || estadoCasilla(n, a, abiertas) === 'cerrada') return
  const pop = abrirPop()
  const cuerpo = pop.querySelector('[data-adv-cuerpo]')
  const ya = abiertas.has(n)
  cuerpo.innerHTML = reveloHtml(n, ya ? { nueva: false } : null)
  engancharRespaldos(cuerpo)
  if (ya) return
  abiertas.add(n)
  pintarTira()
  const { data, error } = await supabase.rpc('adviento_abrir', { p_dia: n })
  if (error) {
    abiertas.delete(n)
    pintarTira()
    pintarPop()
    showToast('No se ha podido abrir la casilla. Prueba otra vez en un momento.')
    return
  }
  const premio = cuerpo.querySelector('[data-adv-premio]')
  if (premio) premio.innerHTML = data?.nueva ? `<span class="adv-chapa">+${data.xp} XP</span>` : '<span class="adv-chapa adv-chapa-ya">Ya la habías abierto</span>'
  if (data?.logro) {
    const { data: logro } = await supabase.from('achievement_definitions').select('*').eq('id', data.logro).maybeSingle()
    if (logro) import('./gamification.js').then((m) => m.showAchievementModal(logro)).catch(() => {})
  }
}

export async function montarAdviento({ caja = document.getElementById('adviento'), fecha = new Date() } = {}) {
  const a = adviento(fecha)
  if (!caja) return
  // La cabecera reservó el sitio con la fecha del aparato; si en España no es
  // diciembre (un desfase de zona horaria), se devuelve.
  if (!a) { document.documentElement.removeAttribute('data-adviento'); return }
  // Es de quien tiene cuenta: sin ella, la bienvenida de Inicio (donde va la
  // tira) no se ve y está el héroe.
  const sesion = await getSession().catch(() => null)
  if (!sesion) { document.documentElement.removeAttribute('data-adviento'); return }
  await hojaInyectada('css/adviento.css')
  const abiertas = new Set()
  const { data, error } = await supabase.from('adviento_casillas').select('dia').eq('anio', a.anio)
  // Sin la migración no hay calendario: el hueco se devuelve y nada más.
  if (error) { document.documentElement.removeAttribute('data-adviento'); return }
  for (const f of data || []) abiertas.add(f.dia)
  estado = { a, abiertas, sesion, caja, pop: null }
  pintarTira()
  caja.addEventListener('click', (e) => {
    const n = Number(e.target.closest('[data-adv-abrir]')?.dataset.advAbrir)
    if (n) return abrirCasilla(n)
    if (e.target.closest('[data-adv-ver]')) abrirPop()
  })
}
