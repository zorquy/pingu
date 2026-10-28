// El panel de Analítica, en visual (tanda 848). PINGU: «ponme el panel en el
// admin mucho más bonito y visual». Lo cuenta la base (`admin_analitica`,
// supabase-migration-analitica.sql) y aquí solo se pinta.
//
// Las gráficas son SVG a mano —aquí no entran librerías— con las reglas de
// siempre de una gráfica que se lee: un solo eje, marcas finas, la leyenda
// cuando hay dos series, el valor en el tooltip Y en una tabla (el tooltip
// no puede ser la única forma de leer un número), y el color sale de los
// tokens `--an-*` de admin.css, que tienen su versión para el tema oscuro.
//
// Se dibujan con el ancho de su caja, así que se repintan cuando la caja
// mide algo (la 628: la sección puede estar escondida al cargar).
import { escapeHtml } from '../../js/app.js'
import { trozosDeResumen, variacion, pct, ORDEN_ACCIONES } from '../../js/analitica-frase.js'

// ── Ayudantes puros (los prueba test-tanda-848) ──

export const fmt = (n) => Number(n || 0).toLocaleString('es-ES')
export function compacto(n) {
  const v = Number(n || 0)
  if (v >= 1e6) return `${(v / 1e6).toFixed(1).replace('.', ',').replace(',0', '')} M`
  if (v >= 1e4) return `${Math.round(v / 1e3)} mil`
  if (v >= 1e3) return `${(v / 1e3).toFixed(1).replace('.', ',').replace(',0', '')} mil`
  return fmt(v)
}

// La variación contra el periodo anterior. Sin nada antes no hay variación
// que contar: «nuevo» no es «+∞ %».
export function deltaDe(ahora, antes) {
  const a = Number(ahora || 0)
  const b = Number(antes || 0)
  if (!b) return a ? { tipo: 'nuevo', texto: 'nuevo' } : null
  const pct = Math.round(((a - b) / b) * 100)
  if (pct === 0) return { tipo: 'igual', texto: '= que antes' }
  return { tipo: pct > 0 ? 'sube' : 'baja', texto: `${pct > 0 ? '+' : ''}${pct} %` }
}

// Marcas del eje limpias: 0, 5, 10… o 0, 250, 500… La de arriba cubre el máximo.
export function ticksLimpios(max, cuantos = 4) {
  const m = Math.max(1, Number(max || 0))
  const bruto = m / cuantos
  const mag = 10 ** Math.floor(Math.log10(bruto))
  const paso = [1, 2, 2.5, 5, 10].map((f) => f * mag).find((p) => p >= bruto) || 10 * mag
  const ticks = []
  for (let v = 0; v <= m + paso * 0.001 || ticks.length < 2; v += paso) ticks.push(Math.round(v * 100) / 100)
  if (ticks[ticks.length - 1] < m) ticks.push(ticks[ticks.length - 1] + paso)
  return ticks
}

const DIAS = ['', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']
const DIAS_CORTOS = ['', 'L', 'M', 'X', 'J', 'V', 'S', 'D']

// La celda con más visitas de la semana tipo, dicha en palabras.
export function horaPunta(horas = []) {
  const top = [...horas].sort((a, b) => b.n - a.n)[0]
  if (!top || !top.n) return null
  return { ...top, texto: `los ${DIAS[top.dia]} a las ${top.hora} h` }
}

// De quien entró una semana, cuántos volvieron la siguiente.
export function retencionPct(fila) {
  if (!fila || fila.vuelven == null || !fila.activos) return null
  return Math.round((fila.vuelven / fila.activos) * 100)
}

const NOMBRES_ORIGEN = {
  directo: 'Directo',
  // Desde la 1065 la app instalada va aparte (antes caía en «directo»).
  app: 'App instalada',
  google: 'Google',
  bing: 'Bing',
  duckduckgo: 'DuckDuckGo',
  instagram: 'Instagram',
  telegram: 'Telegram',
  x: 'X (Twitter)',
  facebook: 'Facebook',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  reddit: 'Reddit',
  discord: 'Discord',
  whatsapp: 'WhatsApp',
  'ko-fi': 'Ko-fi',
}
export const nombreDeOrigen = (o) => NOMBRES_ORIGEN[o] || o
const NOMBRES_APARATO = { movil: 'Móvil', pc: 'Ordenador', tablet: 'Tableta' }
// El orden fija el color (el color sigue a la cosa, no a su puesto).
const ORDEN_APARATO = ['movil', 'pc', 'tablet']

// ── Piezas ──

function tileHtml({ etiqueta, valor, delta, nota, chispa, grande }) {
  return `<div class="an-tile${grande ? ' an-tile-grande' : ''}">
    <span class="an-tile-etiqueta">${escapeHtml(etiqueta)}</span>
    <strong class="an-tile-valor">${valor}</strong>
    ${delta ? `<span class="an-delta an-delta-${delta.tipo}">${delta.tipo === 'sube' ? '▲ ' : delta.tipo === 'baja' ? '▼ ' : ''}${escapeHtml(delta.texto)} <small>vs. antes</small></span>` : ''}
    ${nota ? `<span class="an-tile-nota">${escapeHtml(nota)}</span>` : ''}
    ${chispa || ''}
  </div>`
}

// La chispa de la ficha grande: la misma serie de la gráfica, sin ejes.
function chispaSvg(valores) {
  if (valores.length < 2) return ''
  const w = 160
  const h = 36
  const max = Math.max(1, ...valores)
  const pts = valores.map((v, i) => `${((i / (valores.length - 1)) * w).toFixed(1)},${(h - 2 - (v / max) * (h - 6)).toFixed(1)}`)
  return `<svg class="an-chispa" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts.join(' ')}" /></svg>`
}

function tarjeta(titulo, cuerpo, { sub = '', clase = '', id = '', tab = '' } = {}) {
  return `<section class="an-card ${clase}"${id ? ` id="${id}"` : ''}${tab ? ` data-an-tab="${tab}"` : ''}>
    <header class="an-card-cab"><h2>${titulo}</h2>${sub ? `<p>${sub}</p>` : ''}</header>
    ${cuerpo}
  </section>`
}

function barrasHtml(filas, { vacio = 'Todavía no hay datos.' } = {}) {
  if (!filas.length) return `<p class="an-vacio">${vacio}</p>`
  const max = Math.max(...filas.map((f) => f.n))
  const total = filas.reduce((s, f) => s + f.n, 0)
  return `<ul class="an-barras">${filas
    .map(
      (f) => `<li>
        <span class="an-barra-nombre">${f.html || escapeHtml(f.nombre)}</span>
        <span class="an-barra-pista"><i style="width:${Math.max(2, (f.n / max) * 100).toFixed(1)}%"></i></span>
        <span class="an-barra-n">${fmt(f.n)}${f.extra || (total ? ` <small>${Math.round((f.n / total) * 100)} %</small>` : '')}</span>
      </li>`
    )
    .join('')}</ul>`
}

function tablaDatos(cabeza, filas) {
  return `<details class="an-tabla"><summary>Ver los datos</summary><table class="admin-table"><thead><tr>${cabeza.map((c) => `<th>${c}</th>`).join('')}</tr></thead><tbody>${filas
    .map((f) => `<tr>${f.map((c) => `<td>${c}</td>`).join('')}</tr>`)
    .join('')}</tbody></table></details>`
}

// ── Gráfica de líneas: visitas por día ──

function lineasSvg(caja, dias) {
  const ancho = caja.clientWidth
  if (!ancho || !dias.length) return false
  const alto = 240
  const m = { t: 16, r: 56, b: 28, l: 40 }
  const w = ancho - m.l - m.r
  const h = alto - m.t - m.b
  const max = Math.max(1, ...dias.map((d) => d.personas))
  const ticks = ticksLimpios(max)
  const top = ticks[ticks.length - 1]
  const x = (i) => m.l + (dias.length === 1 ? w / 2 : (i / (dias.length - 1)) * w)
  const y = (v) => m.t + h - (v / top) * h
  const camino = (k) => dias.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d[k]).toFixed(1)}`).join('')
  const area = `${camino('personas')}L${x(dias.length - 1).toFixed(1)},${y(0)}L${x(0).toFixed(1)},${y(0)}Z`
  const cadaCuanto = Math.ceil(dias.length / Math.max(2, Math.floor(w / 64)))
  const ultimo = dias[dias.length - 1]
  const etiquetaFin = (k, clase) => `<text class="an-fin ${clase}" x="${x(dias.length - 1) + 8}" y="${y(ultimo[k]) + 4}">${fmt(ultimo[k])}</text>`
  // Las dos etiquetas de la derecha no se pisan: si caen juntas, solo la de arriba.
  const juntas = Math.abs(y(ultimo.personas) - y(ultimo.con_sesion)) < 14
  caja.innerHTML = `<svg class="an-lineas" width="${ancho}" height="${alto}" role="img" aria-label="Visitas por día: personas y con sesión">
    ${ticks.map((t) => `<line class="an-rejilla" x1="${m.l}" x2="${m.l + w}" y1="${y(t)}" y2="${y(t)}" /><text class="an-eje" x="${m.l - 8}" y="${y(t) + 4}" text-anchor="end">${compacto(t)}</text>`).join('')}
    ${dias.map((d, i) => (i % cadaCuanto === 0 || i === dias.length - 1 ? `<text class="an-eje" x="${x(i)}" y="${alto - 8}" text-anchor="middle">${d.dia.slice(8, 10)}/${d.dia.slice(5, 7)}</text>` : '')).join('')}
    <path class="an-area" d="${area}" />
    <path class="an-linea an-s1" d="${camino('personas')}" />
    <path class="an-linea an-s2" d="${camino('con_sesion')}" />
    ${etiquetaFin('personas', 'an-fin-1')}${juntas ? '' : etiquetaFin('con_sesion', 'an-fin-2')}
    <g class="an-cruz" style="display:none"><line class="an-cruz-linea" y1="${m.t}" y2="${m.t + h}" /><circle class="an-punto an-s1" r="4" /><circle class="an-punto an-s2" r="4" /></g>
    <rect class="an-toque" x="${m.l}" y="${m.t}" width="${w}" height="${h}" tabindex="0" aria-label="Recorre los días con las flechas" />
  </svg><div class="an-tip" role="status" hidden></div>`
  const svg = caja.querySelector('svg')
  const cruz = svg.querySelector('.an-cruz')
  const tip = caja.querySelector('.an-tip')
  const toque = svg.querySelector('.an-toque')
  let actual = dias.length - 1
  const mostrar = (i) => {
    actual = Math.max(0, Math.min(dias.length - 1, i))
    const d = dias[actual]
    const cx = x(actual)
    cruz.style.display = ''
    cruz.querySelector('line').setAttribute('x1', cx)
    cruz.querySelector('line').setAttribute('x2', cx)
    const [p1, p2] = cruz.querySelectorAll('circle')
    p1.setAttribute('cx', cx)
    p1.setAttribute('cy', y(d.personas))
    p2.setAttribute('cx', cx)
    p2.setAttribute('cy', y(d.con_sesion))
    const fecha = new Date(`${d.dia}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
    tip.replaceChildren()
    const t = document.createElement('b')
    t.textContent = fecha
    tip.append(t)
    for (const [k, n, c] of [['personas', 'Personas', 'an-s1'], ['con_sesion', 'Con sesión', 'an-s2']]) {
      const fila = document.createElement('span')
      fila.innerHTML = `<i class="an-clave ${c}"></i><strong></strong> `
      fila.querySelector('strong').textContent = fmt(d[k])
      fila.append(n)
      tip.append(fila)
    }
    tip.hidden = false
    const izq = Math.min(Math.max(cx - 70, 0), ancho - 150)
    tip.style.left = `${izq}px`
  }
  const esconder = () => {
    cruz.style.display = 'none'
    tip.hidden = true
  }
  toque.addEventListener('pointermove', (e) => {
    const r = svg.getBoundingClientRect()
    const rel = (e.clientX - r.left - m.l) / w
    mostrar(Math.round(rel * (dias.length - 1)))
  })
  toque.addEventListener('pointerleave', esconder)
  // Con el teclado se empieza por el último día, que es lo que se busca.
  toque.addEventListener('focus', () => mostrar(dias.length - 1))
  toque.addEventListener('blur', esconder)
  toque.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') mostrar(actual - 1)
    else if (e.key === 'ArrowRight') mostrar(actual + 1)
    else return
    e.preventDefault()
  })
  return true
}

// ── Aparatos: una barra al 100 % en tres trozos ──

function aparatosHtml(aparatos) {
  const total = aparatos.reduce((s, a) => s + a.n, 0)
  if (!total) return '<p class="an-vacio">Se empieza a apuntar con esta tanda: vuelve en unas horas.</p>'
  const filas = ORDEN_APARATO.map((k, i) => ({ k, i, n: aparatos.find((a) => a.aparato === k)?.n || 0 })).filter((f) => f.n)
  return `<div class="an-pila" role="img" aria-label="${filas.map((f) => `${NOMBRES_APARATO[f.k]} ${Math.round((f.n / total) * 100)} %`).join(', ')}">${filas
    .map((f) => `<i class="an-s${f.i + 1}" style="flex:${f.n}" title="${NOMBRES_APARATO[f.k]}: ${fmt(f.n)}"></i>`)
    .join('')}</div>
    <ul class="an-leyenda">${filas
      .map((f) => `<li><i class="an-clave-caja an-s${f.i + 1}"></i>${NOMBRES_APARATO[f.k]} <strong>${Math.round((f.n / total) * 100)} %</strong> <small>${fmt(f.n)}</small></li>`)
      .join('')}</ul>`
}

// ── Mapa de calor: día de la semana × hora ──

function calorHtml(horas) {
  const n = (d, h) => horas.find((x) => x.dia === d && x.hora === h)?.n || 0
  const max = Math.max(1, ...horas.map((x) => x.n))
  let celdas = ''
  for (let d = 1; d <= 7; d++) {
    celdas += `<span class="an-calor-dia">${DIAS_CORTOS[d]}</span>`
    for (let h = 0; h < 24; h++) {
      const v = n(d, h)
      // Un solo tono de claro a oscuro: la intensidad es la cantidad.
      const pct = v ? Math.round(12 + (v / max) * 88) : 0
      celdas += `<span class="an-calor-celda" style="--i:${pct}%" tabindex="0" data-tip="${DIAS[d]} a las ${h} h: ${fmt(v)} ${v === 1 ? 'visita' : 'visitas'}" aria-label="${DIAS[d]} a las ${h} h: ${fmt(v)}"></span>`
    }
  }
  const horasEje = Array.from({ length: 24 }, (_, h) => `<span>${h % 3 === 0 ? h : ''}</span>`).join('')
  return `<div class="an-calor"><span></span>${horasEje}${celdas}</div>
    <div class="an-calor-escala"><span>Menos</span><i></i><span>Más</span></div>
    <div class="an-tip an-tip-celda" role="status" hidden></div>`
}

// ── Retención: columnas por semana ──

function retencionHtml(semanas) {
  if (!semanas.some((s) => s.activos)) return '<p class="an-vacio">Todavía no hay semanas con gente con cuenta.</p>'
  const max = Math.max(1, ...semanas.map((s) => s.activos))
  return `<div class="an-columnas">${semanas
    .map((s) => {
      const pct = retencionPct(s)
      const alto = (s.activos / max) * 100
      const vuelven = s.vuelven == null ? 0 : (s.vuelven / Math.max(1, s.activos)) * 100
      const fecha = new Date(`${s.semana}T12:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
      const tip = `Semana del ${fecha}: ${fmt(s.activos)} con cuenta${s.vuelven == null ? ', en curso' : `, ${fmt(s.vuelven)} volvieron (${pct} %)`} · ${fmt(s.altas)} altas`
      return `<div class="an-col" tabindex="0" data-tip="${escapeHtml(tip)}" aria-label="${escapeHtml(tip)}">
        <span class="an-col-pct">${pct == null ? (s.activos ? 'en curso' : '') : `${pct} %`}</span>
        <span class="an-col-barra${s.vuelven == null ? ' en-curso' : ''}" style="height:${Math.max(alto, s.activos ? 2 : 0)}%"><i style="height:${vuelven}%"></i></span>
        <span class="an-col-eje">${fecha}</span>
      </div>`
    })
    .join('')}</div>
    <ul class="an-leyenda"><li><i class="an-clave-caja an-s1"></i>Volvieron la semana siguiente</li><li><i class="an-clave-caja an-neutro"></i>No volvieron</li></ul>
    <div class="an-tip an-tip-celda" role="status" hidden></div>
    ${tablaDatos(['Semana', 'Con cuenta', 'Volvieron', '%', 'Altas'], semanas.map((s) => [escapeHtml(s.semana), fmt(s.activos), s.vuelven == null ? '—' : fmt(s.vuelven), retencionPct(s) == null ? '—' : `${retencionPct(s)} %`, fmt(s.altas)]))}`
}

// Los tooltips de celdas y columnas: el mismo para todas, al pasar y al enfocar.
function engancharTips(raiz) {
  raiz.querySelectorAll('.an-card').forEach((card) => {
    const tip = card.querySelector('.an-tip-celda')
    if (!tip) return
    const mostrar = (el) => {
      tip.textContent = el.dataset.tip
      tip.hidden = false
      const r = el.getBoundingClientRect()
      const c = card.getBoundingClientRect()
      tip.style.left = `${Math.min(Math.max(r.left - c.left + r.width / 2 - 100, 8), c.width - 208)}px`
      tip.style.top = `${r.top - c.top - 40}px`
    }
    card.addEventListener('pointerover', (e) => {
      const el = e.target.closest('[data-tip]')
      if (el) mostrar(el)
    })
    card.addEventListener('pointerleave', () => (tip.hidden = true))
    card.addEventListener('focusin', (e) => {
      const el = e.target.closest('[data-tip]')
      if (el) mostrar(el)
    })
    card.addEventListener('focusout', () => (tip.hidden = true))
  })
}

// ── El Resumen (1066) ──
//
// Lo que dice si la web mejora, en una pantalla: la frase, seis cifras con
// su flecha contra el periodo anterior, las personas por día (web y app), lo
// que hace la gente, las altas paso a paso y la salud. Lo cuenta
// `admin_analitica_resumen`; «vuelven» sale de la retención de siempre.

// La flecha de un porcentaje se dice en PUNTOS: de 29 % a 34 % es «+5
// puntos», no «+17 %».
export function deltaPuntos(ahora, antes) {
  if (ahora == null || antes == null) return null
  const d = Math.round(ahora - antes)
  if (!d) return { tipo: 'igual', texto: '= que antes' }
  return { tipo: d > 0 ? 'sube' : 'baja', texto: `${d > 0 ? '+' : ''}${d} ${Math.abs(d) === 1 ? 'punto' : 'puntos'}` }
}

const ACCIONES = {
  cartas: { nombre: 'Cartas añadidas', letra: 'C', color: '#e4b44a' },
  deseos: { nombre: 'Apuntadas en «La quiero»', letra: '♥', color: '#f472b6' },
  retos: { nombre: 'Retos jugados', letra: 'R', color: '#9b7bff' },
  foro: { nombre: 'Mensajes del foro', letra: 'F', color: '#f06c9b' },
  guias: { nombre: 'Guías y cursos terminados', letra: 'G', color: '#2fb47c' },
  partidas: { nombre: 'Partidas apuntadas', letra: 'P', color: '#7cbae4' },
}

// La parte de la app, en una barra y dos cifras. La comparten el Resumen y
// la pestaña de Tráfico.
export function appOWebHtml(r) {
  if (!r?.medido_desde) return '<p class="an-vacio">Se empieza a contar con esta tanda: vuelve mañana.</p>'
  const total = Number(r.personas || 0)
  const app = Number(r.personas_app || 0)
  if (!total) return '<p class="an-vacio">Nadie en este periodo.</p>'
  const p = pct(app, total)
  const por = r.instalaciones_por || {}
  const plataformas = [['ios', 'iPhone'], ['android', 'Android'], ['otro', 'ordenador u otro']].filter(([k]) => por[k]).map(([k, n]) => `${n} ${fmt(por[k])}`)
  return `<div class="an-pila" role="img" aria-label="Web ${100 - p} %, app ${p} %"><i class="an-s1" style="flex:${total - app}"></i><i class="an-s3" style="flex:${app}"></i></div>
    <ul class="an-leyenda"><li><i class="an-clave-caja an-s1"></i>Web <strong>${fmt(total - app)}</strong> <small>${100 - p} %</small></li><li><i class="an-clave-caja an-s3"></i>App instalada <strong>${fmt(app)}</strong> <small>${p} %</small></li></ul>
    <p class="an-titular">Instalaciones nuevas: <strong>${fmt(r.instalaciones)}</strong>${plataformas.length ? ` (${plataformas.join(' · ')})` : ''}</p>`
}

// Personas por día, web y app una encima de otra: columnas en HTML (se
// estiran con su caja, sin medirla).
function columnasDiasHtml(dias) {
  const max = Math.max(1, ...dias.map((d) => d.web + d.app))
  return `<div class="an-dias" role="img" aria-label="Personas por día, web y app">${dias
    .map((d) => {
      const tip = `${new Date(`${d.dia}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}: ${fmt(d.web + d.app)} personas (${fmt(d.app)} desde la app)`
      return `<span class="an-dia" tabindex="0" data-tip="${escapeHtml(tip)}" aria-label="${escapeHtml(tip)}"><i class="an-s3" style="height:${((d.app / max) * 100).toFixed(1)}%"></i><i class="an-s1" style="height:${((d.web / max) * 100).toFixed(1)}%"></i></span>`
    })
    .join('')}</div>
    <div class="an-dias-eje"><span>${escapeHtml(dias[0]?.dia.slice(8, 10) + '/' + dias[0]?.dia.slice(5, 7))}</span><span>${escapeHtml((dias.at(-1)?.dia || '').slice(8, 10) + '/' + (dias.at(-1)?.dia || '').slice(5, 7))}</span></div>
    <ul class="an-leyenda"><li><i class="an-clave-caja an-s1"></i>Web</li><li><i class="an-clave-caja an-s3"></i>App instalada</li></ul>
    <div class="an-tip an-tip-celda" role="status" hidden></div>`
}

function accionesHtml(acc = {}) {
  return `<ul class="an-acciones">${ORDEN_ACCIONES.map((k) => {
    const a = acc[k] || { n: 0, antes: 0 }
    const d = deltaDe(a.n, a.antes)
    const info = ACCIONES[k]
    return `<li><span class="an-acc-ic" style="--c:${info.color}" aria-hidden="true">${info.letra}</span><span class="an-acc-nombre">${escapeHtml(info.nombre)}</span><strong>${fmt(a.n)}</strong><span class="an-delta an-delta-${d?.tipo || 'igual'}">${d ? escapeHtml(d.texto) : ''}</span></li>`
  }).join('')}</ul>`
}

function embudoHtml(al = {}) {
  const n = Number(al.n || 0)
  if (!n) return '<p class="an-vacio">Nadie se ha registrado en este periodo.</p>'
  // El texto encima de la barra: dentro se cortaba en las cortas.
  const paso = (texto, v) => `<li><span class="an-embudo-texto">${escapeHtml(texto)} · <strong>${fmt(v)}</strong></span><b>${pct(v, n)} %</b><span class="an-embudo-pista"><i style="width:${Math.max(2, (v / n) * 100).toFixed(1)}%"></i></span></li>`
  return `<ol class="an-embudo">${paso('Se registran', n)}${paso('Hacen algo en 7 días', al.hacen)}${paso('Añaden su primera carta', al.carta)}${paso('Vuelven otra semana', al.vuelven)}</ol>
    <p class="an-titular">«Hacen algo»: añadir una carta, apuntar un deseo, escribir en el foro, jugar un reto, apuntar una partida o terminar una guía. Las altas de los últimos días aún pueden.</p>`
}

// El semáforo: verde, ámbar o rojo con los umbrales de siempre (el LCP, los de
// Google; los errores y las rotas, a ojo para una web de este tamaño).
export function notaDeSalud(tipo, v) {
  if (v == null) return 'nada'
  if (tipo === 'errores') return v <= 5 ? 'bien' : v <= 20 ? 'regular' : 'mal'
  if (tipo === 'rotos') return v === 0 ? 'bien' : v <= 3 ? 'regular' : 'mal'
  if (tipo === 'lcp') return v <= 2500 ? 'bien' : v <= 4000 ? 'regular' : 'mal'
  return 'nada'
}
function saludHtml(sa = {}, dias = 7) {
  const porDia = sa.errores == null ? null : Math.round((sa.errores / dias) * 10) / 10
  const celda = (etiqueta, tipo, v, texto, ir) => `<button type="button" class="an-salud-celda an-salud-${notaDeSalud(tipo, v)}" data-an-ir="${ir}"><small>${etiqueta}</small><b><i aria-hidden="true"></i>${texto}</b></button>`
  return `<div class="an-salud">
    ${celda('Errores', 'errores', porDia, porDia == null ? '—' : `${String(porDia).replace('.', ',')} al día`, 'errores')}
    ${celda('Páginas rotas', 'rotos', sa.rotos, sa.rotos == null ? '—' : fmt(sa.rotos), 'tecnico')}
    ${celda('Velocidad (LCP)', 'lcp', sa.lcp_p75, sa.lcp_p75 == null ? '—' : `${(sa.lcp_p75 / 1000).toFixed(1).replace('.', ',')} s`, 'tecnico')}
  </div>`
}

export function pintarResumen(caja, r, datos = {}) {
  const dias = Number(r?.dias) || 7
  const ret = datos.retencion || []
  const completas = ret.filter((s) => s.vuelven != null && s.activos)
  const ultima = completas.at(-1)
  const penultima = completas.at(-2)
  const vuelven = ultima ? retencionPct(ultima) : null
  const trozos = trozosDeResumen(r, { vuelven })
  const medido = Boolean(r.medido_desde)
  const pApp = pct(r.personas_app, r.personas)
  const pAppAntes = pct(r.personas_app_antes, r.personas_antes)
  const al = r.altas || {}
  const pAltas = pct(al.hacen, al.n)
  const pAltasAntes = pct(al.hacen_antes, al.n_antes)
  const acc = r.acciones || {}
  const hechas = ORDEN_ACCIONES.reduce((s, k) => s + Number(acc[k]?.n || 0), 0)
  const hechasAntes = ORDEN_ACCIONES.reduce((s, k) => s + Number(acc[k]?.antes || 0), 0)
  const sin = 'se empieza a contar con esta tanda'
  const tiles = [
    tileHtml({ etiqueta: 'Personas distintas', valor: medido ? compacto(r.personas) : '—', delta: medido ? deltaDe(r.personas, r.personas_antes) : null, nota: medido ? `${fmt(Math.round(r.personas / dias))} al día, de media` : sin, chispa: medido ? chispaSvg((r.por_dia || []).map((d) => d.web + d.app)) : '' }),
    tileHtml({ etiqueta: 'Desde la app instalada', valor: medido && pApp != null ? `${pApp} %` : '—', delta: medido ? deltaPuntos(pApp, pAppAntes) : null, nota: medido ? `${fmt(r.personas_app)} personas · ${fmt(r.instalaciones)} ${r.instalaciones === 1 ? 'instalación nueva' : 'instalaciones nuevas'}` : sin }),
    tileHtml({ etiqueta: 'Con cuenta, activas', valor: compacto(r.activos), delta: deltaDe(r.activos, r.activos_antes), nota: `de ${fmt(r.registrados)} registradas` }),
    tileHtml({ etiqueta: 'Vuelven a la semana', valor: vuelven == null ? '—' : `${vuelven} %`, delta: vuelven == null || !penultima ? null : deltaPuntos(vuelven, retencionPct(penultima)), nota: ultima ? `${fmt(ultima.vuelven)} de ${fmt(ultima.activos)} con cuenta` : 'hace falta una semana entera' }),
    tileHtml({ etiqueta: 'Altas que empiezan', valor: pAltas == null ? '—' : `${pAltas} %`, delta: deltaPuntos(pAltas, pAltasAntes), nota: al.n ? `${fmt(al.hacen)} de ${fmt(al.n)} hicieron algo en 7 días` : 'ninguna alta en el periodo' }),
    tileHtml({ etiqueta: 'Cosas hechas', valor: compacto(hechas), delta: deltaDe(hechas, hechasAntes), nota: 'cartas, deseos, retos, foro, guías y partidas' }),
  ].join('')
  caja.innerHTML = `
    <p class="an-frase">${trozos.map((t) => (t.tono ? `<span class="an-frase-${t.tono}">${escapeHtml(t.texto)}</span>` : escapeHtml(t.texto))).join('')}</p>
    <div class="an-tiles an-tiles-resumen">${tiles}</div>
    <div class="an-rejilla-cards">
      ${tarjeta('Personas al día', medido ? columnasDiasHtml(r.por_dia || []) : `<p class="an-vacio">Se empieza a contar con esta tanda: vuelve mañana.</p>`, { sub: 'Web y app instalada, una encima de otra' })}
      ${tarjeta('Lo que hace la gente', accionesHtml(acc), { sub: 'Contra el periodo anterior' })}
      ${tarjeta('Las altas, paso a paso', embudoHtml(al), { sub: 'Quien se registró en el periodo' })}
      ${tarjeta('Salud', saludHtml(r.salud, dias), { sub: 'Si algo se rompe, aquí se ve primero' })}
    </div>`
  engancharTips(caja)
}

// ── Todo junto ──

export function pintarAnalitica(raiz, datos, { pageLabel = (r) => r, resumen = null } = {}) {
  const r = datos.resumen || {}
  const dias = datos.por_dia || []
  const ret = datos.retencion || []
  const ultimaCompleta = [...ret].reverse().find((s) => s.vuelven != null && s.activos)
  const pctMovil = r.con_aparato ? Math.round((r.movil / r.con_aparato) * 100) : null
  const punta = horaPunta(datos.horas)
  const bus = datos.busquedas || { total: 0, vacias: 0, top: [], sin_resultado: [] }

  const tiles = [
    tileHtml({ etiqueta: 'Visitas de personas', valor: compacto(r.personas), delta: deltaDe(r.personas, r.personas_antes), chispa: chispaSvg(dias.map((d) => d.personas)), grande: true }),
    tileHtml({ etiqueta: 'Entradas desde fuera', valor: compacto(r.entradas), delta: deltaDe(r.entradas, r.entradas_antes), nota: 'llegan de otra web o directas' }),
    tileHtml({ etiqueta: 'Personas con cuenta', valor: compacto(r.activos), delta: deltaDe(r.activos, r.activos_antes), nota: `de ${fmt(r.registrados)} registradas` }),
    tileHtml({ etiqueta: 'Altas nuevas', valor: compacto(r.altas), delta: deltaDe(r.altas, r.altas_antes) }),
    tileHtml({ etiqueta: 'Desde el móvil', valor: pctMovil == null ? '—' : `${pctMovil} %`, nota: pctMovil == null ? 'se apunta desde esta tanda' : `${fmt(r.movil)} de ${fmt(r.con_aparato)} visitas` }),
    tileHtml({ etiqueta: 'Vuelven a la semana', valor: ultimaCompleta ? `${retencionPct(ultimaCompleta)} %` : '—', nota: ultimaCompleta ? `${fmt(ultimaCompleta.vuelven)} de ${fmt(ultimaCompleta.activos)} con cuenta` : 'hace falta una semana entera' }),
  ].join('')

  const origenes = (datos.origenes || []).map((o) => ({ nombre: nombreDeOrigen(o.origen), n: o.n }))
  const campanas = (datos.campanas || []).map((c) => ({ nombre: c.campana, n: c.n }))
  const paginas = (datos.paginas || []).map((p) => ({ html: `${escapeHtml(pageLabel(p.ruta))} <span class="admin-path">${escapeHtml(p.ruta)}</span>`, n: p.n }))
  const buscado = (bus.top || []).map((b) => ({ nombre: b.q, n: b.n, extra: b.vacias ? ` <small class="an-sin">${fmt(b.vacias)} sin nada</small>` : ' <small></small>' }))
  const sinNada = (bus.sin_resultado || []).map((b) => ({ nombre: b.q, n: b.n, extra: ' <small></small>' }))
  const rotos = datos.rotos || []

  // Cada tarjeta, en su pestaña (1066): Tráfico, Qué hacen o Técnico.
  raiz.innerHTML = `
    <div class="an-tiles" data-an-tab="trafico">${tiles}</div>
    <div class="an-rejilla-cards">
      ${resumen ? tarjeta('App instalada o web', appOWebHtml(resumen), { tab: 'trafico', sub: 'Personas distintas en el periodo, por cómo abren PokeDoc' }) : ''}
      ${tarjeta(
        'Visitas por día',
        `<ul class="an-leyenda"><li><i class="an-clave an-s1"></i>Personas</li><li><i class="an-clave an-s2"></i>Con sesión</li></ul><div class="an-lienzo" id="anLineas"></div>
        ${tablaDatos(['Día', 'Personas', 'Con sesión'], dias.map((d) => [escapeHtml(d.dia), fmt(d.personas), fmt(d.con_sesion)]))}`,
        { clase: 'an-ancha', tab: 'trafico', sub: `${fmt(r.robots)} visitas de robots aparte, que no cuentan` }
      )}
      ${tarjeta('De dónde llegan', barrasHtml(origenes, { vacio: 'Se empieza a apuntar con esta tanda: vuelve en unas horas.' }), { tab: 'trafico', sub: 'Las entradas desde fuera, por la web de la que vienen' })}
      ${tarjeta('Con qué lo miran', aparatosHtml(datos.aparatos || []), { tab: 'trafico', sub: 'Por el ancho de la pantalla' })}
      ${tarjeta(
        'Cuándo entra la gente',
        punta ? `<p class="an-titular">La hora punta: <strong>${escapeHtml(punta.texto)}</strong></p>${calorHtml(datos.horas)}` : '<p class="an-vacio">Todavía no hay visitas en este periodo.</p>',
        { clase: 'an-ancha', tab: 'trafico', sub: 'Visitas de personas por día de la semana y hora (hora de Madrid). Buen sitio para elegir cuándo publicar.' }
      )}
      ${tarjeta('Quién vuelve', retencionHtml(ret), { clase: 'an-ancha', tab: 'hacen', sub: 'Las últimas ocho semanas, entre quien tiene cuenta' })}
      ${tarjeta('Lo más buscado', barrasHtml(buscado, { vacio: 'Nadie ha buscado nada todavía (o falta la migración).' }), { tab: 'hacen', sub: `${fmt(bus.total)} búsquedas en el periodo` })}
      ${tarjeta('Buscado sin resultado', barrasHtml(sinNada, { vacio: 'Todo lo que se ha buscado ha encontrado algo.' }), { tab: 'hacen', sub: 'Ideas de guías, o nombres que no casan' })}
      ${campanas.length ? tarjeta('Campañas', barrasHtml(campanas), { tab: 'trafico', sub: 'Los enlaces con <code>?utm_source=</code> que has compartido' }) : ''}
      ${tarjeta(
        'Páginas rotas',
        rotos.length
          ? `<table class="admin-table an-rotos"><thead><tr><th>Dirección</th><th>Llegan desde</th><th>Veces</th><th>Última</th></tr></thead><tbody>${rotos
              .map(
                (x) => `<tr><td><code>${escapeHtml(x.ruta)}</code></td><td>${x.desde ? (x.desde.startsWith('/') ? `<a href="${escapeHtml(x.desde)}" target="_blank" rel="noopener">${escapeHtml(x.desde)}</a> <span class="an-chapa">enlace nuestro</span>` : escapeHtml(nombreDeOrigen(x.desde))) : '—'}</td><td>${fmt(x.n)}</td><td>${escapeHtml(new Date(x.ultima).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }))}</td></tr>`
              )
              .join('')}</tbody></table>`
          : '<p class="an-vacio">Ninguna dirección rota en este periodo.</p>',
        { clase: 'an-ancha', tab: 'tecnico', sub: 'Las que dieron «no existe». Si llegan desde una página nuestra, el enlace roto es nuestro.' }
      )}
      ${tarjeta('Páginas más visitadas', barrasHtml(paginas), { clase: 'an-ancha', tab: 'hacen' })}
    </div>`

  engancharTips(raiz)
  const lienzo = raiz.querySelector('#anLineas')
  const dibujar = () => lineasSvg(lienzo, dias)
  dibujar()
  if (typeof ResizeObserver === 'function') {
    let ancho = lienzo.clientWidth
    const ro = new ResizeObserver(() => {
      if (lienzo.clientWidth && lienzo.clientWidth !== ancho) {
        ancho = lienzo.clientWidth
        dibujar()
      }
    })
    ro.observe(lienzo)
  }
}
