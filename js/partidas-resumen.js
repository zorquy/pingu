// «Resumen», la primera pestaña de Mis partidas (1390, la propuesta «Jugar
// con cara de juego», PINGU: «dale con todo lo recomendado»). Lo que en
// Flinchet es «Tu resumen»: el anillo del %, tu mazo estrella en grande, las
// últimas partidas como cartas de color y contra qué ganas y pierdes.
//
// Las cuentas son las de siempre (`cuenta`, `porGrupo`, `rachas` de
// estadisticas-partidas.js, con `porcentaje`: el empate vale medio, 628): una
// cifra nueva al lado de una vieja usa LA MISMA definición. Aquí solo se
// eligen y se pintan. Las cartas de cada mazo las pinta quien llama
// (`sprites(nombre, clave)`): son las de la tarjeta de siempre.
import { cuenta, porGrupo, rachas, ultimas, fechaCorta } from './estadisticas-partidas.js'
import { artePokemonHtml } from './arte-pokemon.js'
import { dexesDeNombre } from './torneos/arquetipos.js'
import { escapeHtml } from './html.js'

const LETRA = { win: 'V', loss: 'D', draw: 'E' }
const MINIMO = 3 // contra un mazo, con menos partidas el % no dice nada

const pct = (c) => (c?.pct == null ? '—' : `${Math.round(c.pct * 100)} %`)
const vde = (c) => `${c.ganadas}-${c.perdidas}-${c.empatadas}`

// Lo que se enseña, sin HTML (lo usa la prueba).
export function datosDelResumen(jugadas) {
  const total = cuenta(jugadas)
  if (!total.total) return null
  const r = rachas(jugadas)
  const estrella = porGrupo(jugadas, (p) => p.mio, (p) => p.mioNombre)[0] || null
  let mejor = null
  let peor = null
  if (estrella) {
    const suyas = jugadas.filter((p) => p.mio === estrella.clave && p.rival !== 'sin-mazo')
    const rivales = porGrupo(suyas, (p) => p.rival, (p) => p.rivalNombre).filter((g) => g.total >= 2)
    mejor = [...rivales].sort((a, b) => b.pct - a.pct || b.total - a.total)[0] || null
    peor = [...rivales].sort((a, b) => a.pct - b.pct || b.total - a.total).find((g) => g !== mejor) || null
  }
  const rivales = porGrupo(jugadas.filter((p) => p.rival !== 'sin-mazo'), (p) => p.rival, (p) => p.rivalNombre).filter((g) => g.total >= MINIMO)
  const gana = [...rivales].filter((g) => g.pct >= 0.5).sort((a, b) => b.pct - a.pct || b.total - a.total).slice(0, 3)
  const cuesta = [...rivales].filter((g) => g.pct < 0.5).sort((a, b) => a.pct - b.pct || b.total - a.total).slice(0, 3)
  const donde = porGrupo(jugadas, (p) => p.donde || 'Sin decir', (p) => p.donde || 'Sin decir').slice(0, 3)
  return { total, racha: r.actual, forma: ultimas(jugadas, 10).reverse(), estrella, mejor, peor, ultimas: ultimas(jugadas, 6), gana, cuesta, donde }
}

// La barra V · E · D de un grupo.
const barra = (c) => {
  const t = c.total || 1
  return `<span class="pr-barra" aria-hidden="true"><i class="pr-bv" style="width:${(c.ganadas / t) * 100}%"></i><i class="pr-be" style="width:${(c.empatadas / t) * 100}%"></i><i class="pr-bd" style="width:${(c.perdidas / t) * 100}%"></i></span>`
}

function anillo(c) {
  const t = c.total
  const v = (c.ganadas / t) * 360
  const e = ((c.ganadas + c.empatadas) / t) * 360
  return `<div class="pr-anillo" style="--v:${v.toFixed(1)}deg;--e:${e.toFixed(1)}deg" role="img" aria-label="${escapeHtml(`${pct(c)} de victorias`)}"><b>${pct(c).replace(' ', '')}<small>victorias</small></b></div>`
}

const RACHA = { win: ['victoria', 'victorias'], loss: ['derrota', 'derrotas'], draw: ['empate', 'empates'] }

// El dibujo grande del mazo estrella: el arte oficial de su primera especie;
// si el nombre no dice ninguna, sus cartas pequeñas en grande.
function arteDeMazo(e, sprites) {
  const dex = dexesDeNombre(e.nombre || '')[0]
  return dex ? artePokemonHtml(dex, 'pr-estrella-arte') : `<span class="pr-estrella-sprites">${sprites(e.nombre, e.clave)}</span>`
}

const filaRival = (g, sprites, clase) => `
  <li class="pr-rival">
    <span class="pr-rival-caras">${sprites(g.nombre, g.clave)}</span>
    <span class="pr-rival-nombre"><b>${escapeHtml(g.nombre)}</b>${barra(g)}</span>
    <span class="pr-rival-pct ${clase}">${pct(g)}<small>${vde(g)}</small></span>
  </li>`

export function resumenHtml(jugadas, { sprites = () => '', hoy = new Date() } = {}) {
  const d = datosDelResumen(jugadas)
  if (!d) return ''
  const t = d.total
  const racha = d.racha && d.racha.n > 1 ? `<span class="pr-racha pr-racha-${d.racha.resultado}">${d.racha.n} ${RACHA[d.racha.resultado][1]} seguidas</span>` : ''
  const resumen = `
    <section class="pr-caja pr-resumen" aria-label="Tu resumen">
      ${anillo(t)}
      <div class="pr-marcador">
        <div class="pr-vde"><span class="pr-v"><b>${t.ganadas}</b><small>VICT.</small></span><span class="pr-d"><b>${t.perdidas}</b><small>DERR.</small></span><span class="pr-e"><b>${t.empatadas}</b><small>EMP.</small></span></div>
        <span class="subtext">${t.total} ${t.total === 1 ? 'partida' : 'partidas'}</span>
        ${racha}
      </div>
      <div class="pr-forma" aria-label="Últimas ${d.forma.length}, la más reciente a la derecha">${d.forma.map((p) => `<i class="pr-${p.resultado}">${LETRA[p.resultado] || '?'}</i>`).join('')}</div>
      <div class="pr-forma-pie"><span>Últimas ${d.forma.length}</span><span>la más reciente →</span></div>
    </section>`
  const e = d.estrella
  const dato = (titulo, g, clase) => g ? `<div class="pr-dato"><span class="pr-dato-caras">${sprites(g.nombre, g.clave)}</span><span><small>${titulo}</small><b>${escapeHtml(g.nombre)}</b></span><span class="pr-dato-pct ${clase}">${pct(g)}</span></div>` : ''
  const estrella = e ? `
    <section class="pr-caja pr-juego pr-estrella" aria-label="Tu mazo estrella">
      <span class="pr-brillo" aria-hidden="true"></span>
      ${arteDeMazo(e, sprites)}
      <small class="pr-kick">TU MAZO ESTRELLA</small>
      <h3>${escapeHtml(e.nombre)}</h3>
      <div class="pr-cifras"><span><b>${e.total}</b><small>${e.total === 1 ? 'partida' : 'partidas'}</small></span><span><b>${pct(e)}</b><small>victorias</small></span><span><b>${vde(e)}</b><small>V-D-E</small></span></div>
      ${barra(e)}
      <div class="pr-datos">${dato('Gana a', d.mejor, 'pr-bien')}${d.peor && d.peor.pct < (d.mejor?.pct ?? 1) ? dato('Le cuesta', d.peor, 'pr-mal') : ''}</div>
    </section>` : ''
  const ultimasHtml = `
    <section class="pr-ultimas-caja" aria-label="Últimas partidas">
      <div class="pr-titulo"><h3>Últimas partidas</h3><button type="button" class="pr-ver" data-pr-ver="sueltas">Ver las ${t.total}</button></div>
      <div class="pr-ultimas">${d.ultimas.map((p) => `
        <div class="pr-partida pr-${p.resultado}">
          <span class="pr-letra">${LETRA[p.resultado] || '?'}</span>
          <span class="pr-caras"><span class="pr-yo">${sprites(p.mioNombre, p.mio)}</span><small>VS</small><span class="pr-el">${sprites(p.rivalNombre, p.rival)}</span></span>
          <b>${escapeHtml(p.rivalNombre || 'Rival')}</b>
          <small>${escapeHtml([fechaCorta(p.fecha, hoy), p.donde].filter(Boolean).join(' · '))}</small>
        </div>`).join('')}</div>
    </section>`
  const lista = (titulo, grupos, clase, mod) => grupos.length ? `
    <section class="pr-caja pr-lista ${mod}"><h3>${titulo}</h3><ul>${grupos.map((g) => filaRival(g, sprites, clase)).join('')}</ul></section>` : ''
  const donde = d.donde.length > 1 ? `
    <section class="pr-caja pr-lista pr-donde"><h3>Dónde juegas</h3><ul>${d.donde.map((g) => `
      <li class="pr-rival"><span class="pr-rival-nombre"><b>${escapeHtml(g.nombre)} <small>· ${g.total}</small></b>${barra(g)}</span><span class="pr-rival-pct">${pct(g)}<small>${vde(g)}</small></span></li>`).join('')}</ul></section>` : ''
  const abajo = lista('Contra lo que más ganas', d.gana, 'pr-bien', 'pr-gana') + lista('Lo que más te cuesta', d.cuesta, 'pr-mal', 'pr-cuesta') + donde
  return `<div class="pr-arriba">${resumen}${estrella}</div>${ultimasHtml}${abajo ? `<div class="pr-abajo">${abajo}</div>` : ''}`
}
