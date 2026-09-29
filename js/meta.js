// /meta: qué mazos se juegan (tanda 364). El ranking de arquetipos de
// los torneos online de Estándar, sacado de Limitless por la función
// programada meta-limitless. Cada fila lleva a la ficha del arquetipo.
import { escapeHtml } from './html.js'
import { resumen, totales } from './meta/datos.js'
import { iconosHtml, periodoHtml, engancharPeriodo, haceCuanto } from './meta/pintar.js'
import {
  periodoDe,
  porcentaje,
  entero,
  tendencia,
  textoTendencia,
  MIN_MAZOS_CON_MUESTRA,
  ARQUETIPO_OTROS,
} from './meta/nucleo.js'

const $ = (id) => document.getElementById(id)
let dias = periodoDe(new URLSearchParams(location.search).get('dias'))
let turno = 0
let verTodos = false
let filas = []

function aviso(html) {
  $('metaAviso').innerHTML = html
  $('metaAviso').classList.toggle('hidden', !html)
}

function filaHtml(f, i, maximo) {
  const t = tendencia(f.cuota, f.cuota_anterior)
  const pv = Number(f.porcentaje_victorias)
  const claseV = !Number.isFinite(pv) ? '' : pv >= 52 ? ' meta-bueno' : pv <= 47 ? ' meta-malo' : ''
  // La barra se mide contra el MÁS jugado, no contra el 100 %: con el
  // primero en un 15 %, todas las barras serían rayitas iguales.
  const ancho = maximo > 0 ? Math.max(2, Math.round((Number(f.cuota) / maximo) * 100)) : 0
  const href = `/meta/${encodeURIComponent(f.arquetipo)}${dias !== 14 ? `?dias=${dias}` : ''}`
  return `
    <li class="meta-fila">
      <a class="meta-fila-enlace" href="${href}">
        <span class="meta-pos">${i + 1}</span>
        ${iconosHtml(f.iconos)}
        <span class="meta-nombre">
          <strong>${escapeHtml(f.nombre)}</strong>
          <span class="meta-sub">${entero(f.mazos)} mazos · ${entero(f.top8)} top 8</span>
        </span>
        <span class="meta-uso">
          <span class="meta-barra" aria-hidden="true"><i style="--ancho:${ancho}%"></i></span>
          <span class="meta-uso-num">${porcentaje(f.cuota)}</span>
        </span>
        <span class="meta-tend meta-tend-${t?.tipo || 'igual'}" title="${t?.tipo === 'nuevo' ? 'Sin datos del periodo anterior' : 'Diferencia de uso con el periodo anterior, en puntos'}">${escapeHtml(textoTendencia(t))}</span>
        <span class="meta-victorias${claseV}" title="${entero(f.victorias)}-${entero(f.derrotas)}-${entero(f.empates)}">${porcentaje(f.porcentaje_victorias)}</span>
      </a>
    </li>`
}

function pintar() {
  const lista = filas.filter((f) => f.arquetipo !== ARQUETIPO_OTROS)
  const otros = filas.find((f) => f.arquetipo === ARQUETIPO_OTROS)
  const conMuestra = lista.filter((f) => f.mazos >= MIN_MAZOS_CON_MUESTRA)
  // Si todavía hay poca muestra en total (primeras horas), se enseña
  // todo: esconderlo dejaría la página vacía.
  const visibles = verTodos || conMuestra.length < 8 ? lista : conMuestra
  const maximo = Math.max(0, ...lista.map((f) => Number(f.cuota) || 0))

  $('metaRanking').innerHTML = visibles.map((f, i) => filaHtml(f, i, maximo)).join('')
  $('metaRanking').removeAttribute('aria-busy')
  $('metaCabeceraTabla').classList.toggle('hidden', !visibles.length)

  const escondidos = lista.length - visibles.length
  $('metaVerTodos').classList.toggle('hidden', escondidos <= 0)
  $('metaVerTodos').textContent = `Ver ${escondidos} ${escondidos === 1 ? 'mazo' : 'mazos'} más con menos de ${MIN_MAZOS_CON_MUESTRA} partidas`
  $('metaOtros').textContent = otros
    ? `Además, un ${porcentaje(otros.cuota)} de los mazos (${entero(otros.mazos)}) son listas que Limitless no encaja en ningún arquetipo.`
    : ''
}

async function cargar() {
  const mio = ++turno
  $('metaRanking').setAttribute('aria-busy', 'true')
  $('metaRanking').classList.add('meta-cargando')
  try {
    const [r, t] = await Promise.all([resumen(dias), totales(dias)])
    if (mio !== turno) return
    filas = r
    aviso('')
    if (!t.torneos) {
      $('metaTotales').textContent = ''
      $('metaRanking').innerHTML = ''
      $('metaCabeceraTabla').classList.add('hidden')
      aviso('<p><strong>Todavía no hay torneos leídos en este periodo.</strong> Los datos se cargan solos cada diez minutos; la primera carga tarda unas horas.</p>')
      return
    }
    $('metaTotales').textContent = `${entero(t.torneos)} torneos · ${entero(t.jugadores)} jugadores · actualizado ${haceCuanto(t.ultima_lectura)}`
    pintar()
  } catch (err) {
    if (mio !== turno) return
    $('metaRanking').innerHTML = ''
    aviso(`<p>${escapeHtml(err.message)}</p>`)
  } finally {
    if (mio === turno) $('metaRanking').classList.remove('meta-cargando')
  }
}

function iniciar() {
  const caja = $('metaPeriodo')
  caja.innerHTML = periodoHtml(dias)
  engancharPeriodo(caja, (d) => {
    dias = d
    cargar()
  })
  $('metaVerTodos').addEventListener('click', () => {
    verTodos = true
    pintar()
  })
  cargar()
}

iniciar()
