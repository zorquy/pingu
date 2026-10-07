// /meta: qué mazos se juegan (tanda 364). El ranking de arquetipos de
// los torneos online de Estándar, sacado de Limitless por la función
// programada meta-limitless. Cada fila lleva a la ficha del arquetipo.
import { escapeHtml } from './html.js'
import { resumen, totales, tiposDeArquetipos, tiposDeEspecies } from './meta/datos.js'
import { iconosHtml, periodoHtml, engancharPeriodo, fuenteHtml, engancharFuente, haceCuanto } from './meta/pintar.js'
import {
  periodoDe,
  fuenteDe,
  porcentaje,
  entero,
  tendencia,
  textoTendencia,
  MIN_MAZOS_CON_MUESTRA,
  ARQUETIPO_OTROS,
} from './meta/nucleo.js'

const $ = (id) => document.getElementById(id)
let dias = periodoDe(new URLSearchParams(location.search).get('dias'))
let fuente = fuenteDe(new URLSearchParams(location.search).get('fuente'))
let turno = 0
let verTodos = false
let filas = []
// El tipo de cada arquetipo (721): llega después del ranking y repinta.
// Mientras no llega —o si falla— la barra va en el azul de siempre: es
// un adorno, y «no se sabe» no se pinta como un tipo.
let tipos = new Map()

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
  const q = new URLSearchParams()
  if (dias !== 14) q.set('dias', String(dias))
  if (fuente) q.set('fuente', fuente)
  const href = `/meta/${encodeURIComponent(f.arquetipo)}${q.toString() ? `?${q}` : ''}`
  // Incoloro tiñe desde la 748, con un gris que se ve (meta.css).
  const tipo = tipos.get(f.arquetipo) || null
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
          <span class="meta-barra"${tipo ? ` data-tipo="${escapeHtml(tipo)}"` : ''} aria-hidden="true"><i style="--ancho:${ancho}%"></i></span>
          <span class="meta-uso-num">${porcentaje(f.cuota)}</span>
        </span>
        <span class="meta-tend meta-tend-${t?.tipo || 'igual'}" title="${t?.tipo === 'nuevo' ? 'Sin datos del periodo anterior' : 'Diferencia de uso con el periodo anterior, en puntos'}">${escapeHtml(textoTendencia(t))}</span>
        <span class="meta-victorias${claseV}" title="${entero(f.victorias)}-${entero(f.derrotas)}-${entero(f.empates)}">${porcentaje(f.porcentaje_victorias)}<small class="meta-gana">gana</small></span>
        <span class="meta-de-listas">${porcentaje(f.cuota)} de las listas</span>
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
    const [r, t] = await Promise.all([resumen(dias, fuente), totales(dias, fuente)])
    if (mio !== turno) return
    filas = r
    aviso('')
    if (!t.torneos) {
      $('metaTotales').textContent = ''
      $('metaRanking').innerHTML = ''
      $('metaCabeceraTabla').classList.add('hidden')
      aviso(fuente === 'oficial'
        ? '<p><strong>No hay torneos oficiales en este periodo.</strong> Prueba con 90 días: hay dos o tres al mes.</p>'
        : fuente === 'pokedoc'
          ? '<p><strong>No hay torneos de PokeDoc terminados en este periodo.</strong> <a class="link-btn" href="/torneos.html">Mira los próximos</a>.</p>'
          : '<p><strong>Todavía no hay torneos leídos en este periodo.</strong> Los datos se cargan solos; la primera carga tarda unas horas.</p>')
      return
    }
    const partes = [
      t.oficiales ? `${entero(t.oficiales)} ${t.oficiales === 1 ? 'oficial' : 'oficiales'}` : '',
      t.online ? `${entero(t.online)} online` : '',
      t.pokedoc ? `${entero(t.pokedoc)} de PokeDoc` : '',
    ].filter(Boolean)
    $('metaTotales').textContent = `${entero(t.torneos)} torneos${partes.length > 1 ? ` (${partes.join(', ')})` : ''} · ${entero(t.jugadores)} jugadores · actualizado ${haceCuanto(t.ultima_lectura)}`
    // El de la especie, ya; el de las cartas, cuando llegue (748).
    tipos = tiposDeEspecies(filas)
    pintar()
    tiposDeArquetipos(filas)
      .then((m) => {
        if (mio !== turno) return
        tipos = m
        pintar()
      })
      .catch(() => {})
  } catch (err) {
    if (mio !== turno) return
    $('metaRanking').innerHTML = ''
    aviso(`<p>${escapeHtml(err.message)}</p>`)
  } finally {
    if (mio === turno) $('metaRanking').classList.remove('meta-cargando')
  }
}

function iniciar() {
  $('metaFuente').innerHTML = fuenteHtml(fuente)
  engancharFuente($('metaFuente'), (f) => {
    fuente = f
    cargar()
  })
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
