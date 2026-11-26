// Estadísticas de Mis partidas en una pantalla (1477, propuesta «Partidas,
// más visual»; PINGU: «demasiadísimo scroll… y demasiado filtro»). Cuatro
// losas, tus mazos con su dibujo, una rejilla de color contra cada mazo y
// cuándo y dónde juegas. Las cuentas son las de estadisticas-partidas.js
// (`cuenta`, `porGrupo`, `rachas`…): aquí solo se pinta. Puro: lo prueba Node.
import { escapeHtml } from './html.js'
import { porGrupo, rachas, ultimas, porDiaDeLaSemana, cuenta, esFecha, sumarDias } from './estadisticas-partidas.js'
import { cifrasDeJuegos } from './partidas-juegos.js'
import { dexesDeNombre } from './torneos/arquetipos.js'
import { artePokemonHtml } from './arte-pokemon.js'

const pctTexto = (c) => (c.pct == null ? '—' : `${Math.round(c.pct * 100)}%`)
const vde = (c) => `${c.ganadas}-${c.perdidas}${c.empatadas ? `-${c.empatadas}` : ''}`
const LETRA = { win: 'V', loss: 'D', draw: 'E' }
const PALABRA = { win: 'Victoria', loss: 'Derrota', draw: 'Empate' }
// Lo mismo que la matriz de siempre: 60 % o más es que le ganas, 40 % o
// menos que te gana (claseDeCasilla en mis-partidas.js).
const tono = (c) => (c.pct == null ? 'pe-igual' : c.pct >= 0.6 ? 'pe-bien' : c.pct <= 0.4 ? 'pe-mal' : 'pe-igual')
// Un «mejor» o «peor» con una partida no dice nada (la regla del Resumen).
const MINIMO = 3

// ── Las cuatro losas ──
export function losasHtml(jugadas, { hoy } = {}) {
  if (!jugadas.length) return ''
  const t = cuenta(jugadas)
  const v = t.total ? (t.ganadas / t.total) * 100 : 0
  const e = t.total ? ((t.ganadas + t.empatadas) / t.total) * 100 : 0
  const semana = hoy ? jugadas.filter((p) => esFecha(p.fecha) && p.fecha >= sumarDias(hoy, -6)).length : 0
  const r = rachas(jugadas)
  const forma = ultimas(jugadas, 5).reverse()
  const j = cifrasDeJuegos(jugadas)
  const p = (g, n) => (n ? Math.round((g / n) * 100) : null)
  const tu = p(j.primero.g, j.primero.total)
  const el = p(j.segundo.g, j.segundo.total)
  const fila = (quien, n) => `<span class="pe-duelo-fila"><span>${quien}</span><span class="pe-barra"><i class="pe-bv" style="width:${n ?? 0}%"></i></span><b>${n == null ? '—' : `${n}%`}</b></span>`
  const racha = r.actual
    ? `<b class="pe-racha-n pe-r-${r.actual.resultado}">${r.actual.n} ${r.actual.resultado === 'win' ? (r.actual.n === 1 ? 'victoria' : 'victorias') : r.actual.resultado === 'loss' ? (r.actual.n === 1 ? 'derrota' : 'derrotas') : r.actual.n === 1 ? 'empate' : 'empates'}${r.actual.n > 1 ? ' seguidas' : ''}</b>`
    : ''
  return `
    <div class="pe-losa pe-losa-anillo">
      <span class="pe-anillo" style="--v:${v.toFixed(1)}%;--e:${e.toFixed(1)}%" role="img" aria-label="${pctTexto(t)} de victorias"><b>${pctTexto(t)}</b></span>
      <span class="pe-losa-txt"><small>Victorias</small><span class="pe-vde"><b class="pe-tv">${t.ganadas} V</b> · <b class="pe-td">${t.perdidas} D</b>${t.empatadas ? ` · <b>${t.empatadas} E</b>` : ''}</span></span>
    </div>
    <div class="pe-losa"><small>Partidas</small><b class="pe-grande">${t.total}</b><span class="pe-sub">${semana ? `${semana} en los últimos 7 días` : 'Ninguna en los últimos 7 días'}</span></div>
    <div class="pe-losa"><small>Racha</small>
      <span class="pe-forma" aria-label="${escapeHtml(forma.map((x) => PALABRA[x.resultado]).join(', '))}">${forma.map((x) => `<i class="pe-f-${x.resultado}">${LETRA[x.resultado] || '?'}</i>`).join('')}</span>
      <span class="pe-sub">${racha}${r.mejorVictorias > 1 ? `${racha ? ' · ' : ''}tu mejor, ${r.mejorVictorias}` : ''}</span></div>
    ${tu != null || el != null
      ? `<div class="pe-losa"><small>Empezando</small><span class="pe-duelo">${fila('Tú', tu)}${fila('Rival', el)}</span><span class="pe-sub">Juegos ganados</span></div>`
      : `<div class="pe-losa"><small>Empezando</small><b class="pe-grande pe-gris">—</b><span class="pe-sub">Apunta quién empieza cada juego y saldrá aquí</span></div>`}`
}

// ── Tus mazos, con su dibujo ──
// Tocar uno es el filtro «Tu mazo» (el valor es la clave de siempre); el
// elegido va marcado y tocarlo otra vez lo quita.
export function mazosHtml(jugadas, { sprites = () => '', elegido = '' } = {}) {
  const grupos = porGrupo(jugadas, (p) => p.mio, (p) => p.mioNombre).filter((g) => g.clave && g.clave !== 'sin-mazo')
  if (!grupos.length) return ''
  const tarjeta = (g) => {
    const dex = dexesDeNombre(g.nombre || '')[0]
    const on = g.clave === elegido
    return `<button type="button" class="pe-mazo${on ? ' pe-on' : ''}" data-pe-mazo="${escapeHtml(g.clave)}" aria-pressed="${on}">
      ${dex ? artePokemonHtml(dex, 'pe-mazo-arte') : `<span class="pe-mazo-sprites">${sprites(g.nombre, g.clave)}</span>`}
      <span class="pe-mazo-nombre">${escapeHtml(g.nombre)}</span>
      <span class="pe-mazo-cifra"><b>${pctTexto(g)}</b><small>${g.total} ${g.total === 1 ? 'partida' : 'partidas'} · ${vde(g)}</small></span>
      <span class="pe-barra"><i class="pe-bv" style="width:${g.total ? (g.ganadas / g.total) * 100 : 0}%"></i><i class="pe-be" style="width:${g.total ? (g.empatadas / g.total) * 100 : 0}%"></i><i class="pe-bd" style="width:${g.total ? (g.perdidas / g.total) * 100 : 0}%"></i></span>
    </button>`
  }
  return `<section class="pe-caja" aria-label="Tus mazos">
      <div class="pe-cab"><h3>${elegido ? 'Tu mazo' : 'Tus mazos'}</h3><small>${elegido ? 'Tócalo otra vez para ver todos' : 'Toca uno para ver solo sus partidas'}</small></div>
      <div class="pe-mazos">${grupos.map(tarjeta).join('')}</div>
    </section>`
}

// ── Contra cada mazo: rejilla de color ──
// Los rivales de más a menos partidas, con su sprite, su % y cuántas. El
// que más sale, el mejor y el peor cruce llevan su chapa (el mejor y el
// peor, con MINIMO partidas). Tocar uno es el filtro «Rival».
export const CRUCES_DE_GOLPE = 10
export function crucesHtml(jugadas, { sprites = () => '', rival = '', todos = false, mazo = '' } = {}) {
  const grupos = porGrupo(jugadas.filter((p) => p.rival && p.rival !== 'sin-mazo'), (p) => p.rival, (p) => p.rivalNombre)
  if (!grupos.length) return ''
  const conDatos = grupos.filter((g) => g.total >= MINIMO && g.pct != null)
  const mejor = conDatos.length > 1 ? [...conDatos].sort((a, b) => b.pct - a.pct || b.total - a.total)[0] : null
  const peor = conDatos.length > 1 ? [...conDatos].sort((a, b) => a.pct - b.pct || b.total - a.total)[0] : null
  const chapa = (g, i) =>
    g === mejor && g.pct >= 0.5 ? '<em class="pe-chapa pe-bien">Tu mejor cruce</em>'
      : g === peor && g.pct < 0.5 ? '<em class="pe-chapa pe-mal">Tu bestia negra</em>'
      : i === 0 && grupos.length > 1 ? '<em class="pe-chapa">El que más sale</em>' : ''
  const vistos = todos ? grupos : grupos.slice(0, CRUCES_DE_GOLPE)
  const casilla = (g, i) => `<button type="button" class="pe-cruce ${tono(g)}${g.clave === rival ? ' pe-on' : ''}" data-pe-rival="${escapeHtml(g.clave)}" aria-pressed="${g.clave === rival}" title="${escapeHtml(`${g.nombre}: ${vde(g)}`)}">
      ${chapa(g, i)}<span class="pe-cruce-caras">${sprites(g.nombre, g.clave)}</span>
      <b>${pctTexto(g)}</b><span class="pe-cruce-nombre">${escapeHtml(g.nombre)} · ${g.total}</span>
    </button>`
  return `<section class="pe-caja" aria-label="Contra cada mazo">
      <div class="pe-cab"><h3>${mazo ? `${escapeHtml(mazo)} contra cada mazo` : 'Contra cada mazo'}</h3><small>${rival ? 'Tócalo otra vez para ver todos' : 'De más a menos partidas'}</small></div>
      <div class="pe-cruces">${vistos.map(casilla).join('')}</div>
      ${grupos.length > vistos.length ? `<button type="button" class="btn-secondary pe-ver" data-pe-cruces="todos">Ver los ${grupos.length}</button>` : ''}
      <p class="pe-leyenda"><span><i class="pe-m pe-bien"></i>Le ganas (60 % o más)</span><span><i class="pe-m pe-igual"></i>Igualado</span><span><i class="pe-m pe-mal"></i>Te gana (40 % o menos)</span></p>
    </section>`
}

// ── Cuándo y dónde ──
const DIA_LARGO = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']
export function cuandoDondeHtml(jugadas) {
  const dias = porDiaDeLaSemana(jugadas)
  const donde = porGrupo(jugadas, (p) => p.donde, (p) => p.donde)
  if (!dias.some((d) => d.total) && !donde.length) return ''
  // El mejor y el peor día, solo entre los que tienen MINIMO partidas.
  const validos = dias.filter((d) => d.total >= MINIMO && d.pct != null)
  const top = validos.length > 1 ? Math.max(...validos.map((d) => d.pct)) : null
  const bajo = validos.length > 1 ? Math.min(...validos.map((d) => d.pct)) : null
  const dia = (d, i) => {
    const marca = d.total >= MINIMO && top !== bajo ? (d.pct === top ? ' pe-top' : d.pct === bajo ? ' pe-bajo' : '') : ''
    return `<span class="pe-dia${d.total ? '' : ' pe-vacio'}${marca}" title="${escapeHtml(`Los ${DIA_LARGO[i]}: ${d.total ? `${d.total} ${d.total === 1 ? 'partida' : 'partidas'} · ${vde(d)}` : 'sin partidas'}`)}">${d.etiqueta.slice(0, 1)}<b>${d.total ? pctTexto(d) : '·'}</b></span>`
  }
  return `<section class="pe-caja" aria-label="Cuándo y dónde">
      <div class="pe-cab"><h3>Cuándo y dónde</h3><small>% de victorias</small></div>
      <div class="pe-dias">${dias.map(dia).join('')}</div>
      ${donde.length ? `<div class="pe-donde">${donde.map((g) => `<span><b>${escapeHtml(g.nombre)}</b> · ${g.total} · ${pctTexto(g)}</span>`).join('')}</div>` : ''}
    </section>`
}
