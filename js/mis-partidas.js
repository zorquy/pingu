// /mis-partidas (tanda 230): contra qué mazos juegas y cómo te va.
//
// Lo pidió PINGU tras enseñarme trainingcourt.app, con una diferencia
// importante: aquí la mitad del trabajo ya está hecho. Las partidas
// jugadas en los torneos de PokeDoc entran SOLAS — sabemos quién jugó
// contra quién, con qué resultado, y el arquetipo sale de la decklist.
// Solo hay que apuntar a mano lo de fuera.
//
// ── POR QUÉ NO SE COPIAN LAS DE TORNEO A match_log ──
//
// Sería más fácil de consultar, y sería una fuente de verdad duplicada:
// el mismo resultado en dos sitios, y el día que se desincronicen no hay
// forma de saber cuál miente. Además el arquetipo del rival puede
// MEJORAR con el tiempo (un admin cataloga un mazo que antes salía
// deducido), y lo copiado no se enteraría. Leyéndolas cada vez, el
// histórico entero se reagrupa solo.
import { supabase } from './supabase.js'
import { escapeHtml, getSession } from './app.js'
import { showToast } from './toast.js'
import { arquetipoDeMazo, claveDeArquetipo, normalizarNombre } from './torneos/arquetipos.js'
import { construirMatriz, resumen, porcentaje, miResultado } from './matriz-partidas.js'

const $ = (id) => document.getElementById(id)

let session = null
let todas = [] // el registro entero, ya normalizado
let catalogo = []

// ── Las partidas de los torneos de PokeDoc ──
//
// Se leen de las mesas, no de ninguna tabla de histórico. Ojo con lo que
// esto implica: solo entran las partidas de torneos cuyas DECKLISTS se
// pueden ver (los terminados, y los de lista abierta en juego). Es
// correcto y no es una limitación a arreglar — sin poder ver la lista
// del rival no se puede saber a qué jugaba, y adivinarlo sería inventar.
async function partidasDeTorneos() {
  const yo = session.user.id

  // Mis mesas: las de los torneos donde jugué. Se piden por jugador y
  // no por torneo, que es lo que hace que esto no crezca con el número
  // de torneos que haya en la web.
  const { data: mesas } = await supabase
    .from('tournament_matches')
    .select('id, round_id, player_a_id, player_b_id, status')
    .or(`player_a_id.eq.${yo},player_b_id.eq.${yo}`)
  if (!mesas?.length) return []

  // El bye no es un enfrentamiento: no hubo rival ni mazo contra el que
  // medirse. Fuera antes de pedir nada más.
  const jugadas = mesas.filter((m) => m.status !== 'bye' && m.player_a_id && m.player_b_id)
  if (!jugadas.length) return []

  const [{ data: resultados }, { data: rondas }] = await Promise.all([
    supabase.from('match_results').select('match_id, result').in('match_id', jugadas.map((m) => m.id)),
    supabase.from('rounds').select('id, tournament_id').in('id', [...new Set(jugadas.map((m) => m.round_id))]),
  ])
  const resultadoDe = new Map((resultados || []).map((r) => [r.match_id, r.result]))
  const torneoDeRonda = new Map((rondas || []).map((r) => [r.id, r.tournament_id]))
  const torneoIds = [...new Set([...torneoDeRonda.values()].filter(Boolean))]
  if (!torneoIds.length) return []

  const [{ data: torneos }, { data: listas }] = await Promise.all([
    supabase.from('tournaments').select('id, name, slug, start_at').in('id', torneoIds),
    // Las que la base nos deje: en un torneo de lista cerrada aún en
    // juego, esto vuelve solo con la mía, y esas partidas se quedan
    // fuera de la matriz hasta que termine.
    supabase.from('tournament_decklists').select('tournament_id, user_id, parsed_cards').in('tournament_id', torneoIds),
  ])
  const torneoPorId = new Map((torneos || []).map((t) => [t.id, t]))
  const mazoDe = new Map()
  for (const d of listas || []) {
    if (d?.parsed_cards) mazoDe.set(`${d.tournament_id}|${d.user_id}`, arquetipoDeMazo(d.parsed_cards, catalogo))
  }

  const salida = []
  for (const m of jugadas) {
    const resultado = miResultado(resultadoDe.get(m.id) ?? m.status, m.player_a_id === yo)
    if (!resultado) continue // mesa aún sin resolver
    const torneoId = torneoDeRonda.get(m.round_id)
    const rivalId = m.player_a_id === yo ? m.player_b_id : m.player_a_id
    const mio = mazoDe.get(`${torneoId}|${yo}`)
    const rival = mazoDe.get(`${torneoId}|${rivalId}`)
    // Sin saber los DOS mazos la partida no dice nada en una matriz de
    // enfrentamientos: se descarta en vez de meterla en un cajón
    // «desconocido» que ensuciaría los porcentajes.
    if (!mio || !rival) continue
    const t = torneoPorId.get(torneoId)
    salida.push({
      id: `t-${m.id}`,
      mio: claveDeArquetipo(mio),
      mioNombre: mio.nombre,
      rival: claveDeArquetipo(rival),
      rivalNombre: rival.nombre,
      resultado,
      fecha: t?.start_at ? String(t.start_at).slice(0, 10) : null,
      donde: t?.name || 'Torneo de PokeDoc',
      enlace: t?.slug ? `/torneo?slug=${encodeURIComponent(t.slug)}` : null,
      deTorneo: true,
    })
  }
  return salida
}

// ── Las apuntadas a mano ──
async function partidasApuntadas() {
  const { data, error } = await supabase
    .from('match_log')
    .select('*')
    .order('jugada_el', { ascending: false })
  // Falla EN SILENCIO a propósito, igual que curso-datos.js: entre que
  // esto se despliega y un humano ejecuta la migración pueden pasar
  // horas, y en ese rato la página tiene que seguir sirviendo (con las
  // partidas de torneo, que no dependen de esta tabla). Un aviso de
  // «falta ejecutar tal SQL» tampoco es asunto de quien viene a mirar
  // sus enfrentamientos: de eso ya avisa el comprobador de /admin.
  if (error) return []
  return (data || []).map((p) => ({
    id: p.id,
    mio: p.mi_mazo,
    mioNombre: p.mi_mazo_nombre,
    rival: p.rival_mazo,
    rivalNombre: p.rival_mazo_nombre,
    resultado: p.resultado,
    fecha: p.jugada_el,
    donde: p.donde || 'Fuera de PokeDoc',
    notas: p.notas,
    deTorneo: false,
  }))
}

// ── Pintar ──

function pct(casilla) {
  const r = porcentaje(casilla)
  return r === null ? '—' : `${Math.round(r * 100)}%`
}

// El color de una casilla: verde si ganas, rojo si pierdes. Se pinta con
// opacidad y no con colores fijos para que funcione igual en tema claro
// y oscuro sin duplicar reglas.
function claseDeCasilla(casilla) {
  const r = porcentaje(casilla)
  if (r === null) return ''
  if (r >= 0.6) return ' partidas-bien'
  if (r <= 0.4) return ' partidas-mal'
  return ' partidas-igualado'
}

function pintarResumen(m) {
  const r = resumen(m)
  const caja = $('partidasResumen')
  if (!r.total.total) {
    caja.innerHTML = ''
    return
  }
  const linea = (titulo, e) =>
    e
      ? `<div class="partidas-dato"><span class="partidas-dato-titulo">${titulo}</span>
          <strong>${escapeHtml(e.mio)} vs ${escapeHtml(e.rival)}</strong>
          <span class="subtext">${e.casilla.ganadas}-${e.casilla.perdidas}${e.casilla.empatadas ? `-${e.casilla.empatadas}` : ''} · ${Math.round(e.ratio * 100)}%</span></div>`
      : ''
  caja.innerHTML = `
    <div class="partidas-dato"><span class="partidas-dato-titulo">Partidas</span>
      <strong>${r.total.total}</strong>
      <span class="subtext">${r.total.ganadas}-${r.total.perdidas}${r.total.empatadas ? `-${r.total.empatadas}` : ''} · ${pct(r.total)}</span></div>
    ${linea('Mejor enfrentamiento', r.mejor)}
    ${linea('Peor enfrentamiento', r.peor)}`
}

function pintarMatriz(m) {
  const caja = $('partidasMatriz')
  if (!m.filas.length) {
    caja.innerHTML = `<div class="simple-card"><p>Todavía no hay partidas que contar.</p>
      <p class="subtext">Las de los torneos de PokeDoc entran solas cuando el torneo termina. Las de fuera, con «Apuntar una partida».</p></div>`
    return
  }
  caja.innerHTML = `
    <div class="partidas-matriz-scroll">
      <table class="partidas-matriz">
        <thead><tr><th></th>${m.columnas
          .map((c) => `<th><span>${escapeHtml(c.nombre)}</span></th>`)
          .join('')}<th>Total</th></tr></thead>
        <tbody>${m.filas
          .map(
            (f) => `<tr>
              <th scope="row">${escapeHtml(f.nombre)}</th>
              ${m.columnas
                .map((c) => {
                  const casilla = f.contra.get(c.clave)
                  if (!casilla) return '<td class="partidas-vacia">·</td>'
                  return `<td class="${claseDeCasilla(casilla).trim()}" title="${casilla.ganadas}-${casilla.perdidas}${casilla.empatadas ? `-${casilla.empatadas}` : ''} contra ${escapeHtml(c.nombre)}">
                    <strong>${pct(casilla)}</strong><span class="subtext">${casilla.ganadas}-${casilla.perdidas}${casilla.empatadas ? `-${casilla.empatadas}` : ''}</span></td>`
                })
                .join('')}
              <td class="partidas-total"><strong>${pct(f.total)}</strong><span class="subtext">${f.total.total}</span></td>
            </tr>`
          )
          .join('')}</tbody>
      </table>
    </div>`
}

const TEXTO_RESULTADO = { win: 'Ganada', loss: 'Perdida', draw: 'Empate' }

function pintarLista(partidas) {
  const caja = $('partidasLista')
  const ultimas = [...partidas]
    .sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')))
    .slice(0, 30)
  if (!ultimas.length) {
    caja.innerHTML = ''
    return
  }
  caja.innerHTML = ultimas
    .map(
      (p) => `
    <div class="partidas-fila partidas-${p.resultado}">
      <span class="partidas-fila-mazos"><strong>${escapeHtml(p.mioNombre)}</strong> vs ${escapeHtml(p.rivalNombre)}</span>
      <span class="partidas-fila-res">${TEXTO_RESULTADO[p.resultado] || p.resultado}</span>
      <span class="subtext partidas-fila-donde">${
        p.enlace ? `<a href="${escapeHtml(p.enlace)}">${escapeHtml(p.donde)}</a>` : escapeHtml(p.donde)
      }${p.fecha ? ` · ${escapeHtml(p.fecha)}` : ''}</span>
      ${p.notas ? `<span class="subtext partidas-fila-notas">${escapeHtml(p.notas)}</span>` : ''}
      ${p.deTorneo ? '' : `<button class="btn-outline partidas-borrar" data-borrar="${escapeHtml(p.id)}">Borrar</button>`}
    </div>`
    )
    .join('')
  caja.querySelectorAll('[data-borrar]').forEach((b) =>
    b.addEventListener('click', () => borrarPartida(b.dataset.borrar))
  )
}

// El filtro de arriba. Se aplica sobre lo ya cargado, sin volver a
// pedir nada: son unas pocas decenas de filas y la respuesta es
// instantánea.
function filtrar() {
  const mazo = $('filtroMazo').value
  const dias = Number($('filtroDesde').value) || 0
  const corte = dias ? new Date(Date.now() - dias * 86400000).toISOString().slice(0, 10) : null
  return todas.filter((p) => (!mazo || p.mio === mazo) && (!corte || !p.fecha || p.fecha >= corte))
}

function repintar() {
  const partidas = filtrar()
  const m = construirMatriz(partidas)
  pintarResumen(m)
  pintarMatriz(m)
  pintarLista(partidas)
}

function rellenarFiltroYSugerencias() {
  const mios = new Map()
  const todosLosMazos = new Set()
  for (const p of todas) {
    mios.set(p.mio, p.mioNombre)
    todosLosMazos.add(p.mioNombre)
    todosLosMazos.add(p.rivalNombre)
  }
  const sel = $('filtroMazo')
  const elegido = sel.value
  sel.innerHTML =
    '<option value="">Todos los míos</option>' +
    [...mios.entries()].map(([c, n]) => `<option value="${escapeHtml(c)}">${escapeHtml(n)}</option>`).join('')
  sel.value = elegido
  // Autocompletado del formulario con lo que ya se ha visto: escribir
  // «Gardevoir» dos veces distinto partiría el enfrentamiento en dos.
  $('listaMazos').innerHTML = [...todosLosMazos]
    .filter(Boolean)
    .sort()
    .map((n) => `<option value="${escapeHtml(n)}"></option>`)
    .join('')
}

// ── Apuntar y borrar ──

// La clave de un mazo escrito a mano. Se busca primero en el catálogo:
// si escribes «Dragapult Dusknoir» y ese arquetipo existe, la partida
// cae en la MISMA casilla que las de los torneos. Si no, se agrupa por
// el nombre normalizado, igual que un mazo deducido.
function claveDeNombre(nombre) {
  const norm = normalizarNombre(nombre)
  const enCatalogo = catalogo.find((a) => normalizarNombre(a.nombre) === norm)
  return enCatalogo ? `a:${enCatalogo.id}` : `d:${norm}`
}

async function guardarPartida() {
  const mio = $('partidaMio').value.trim()
  const rival = $('partidaRival').value.trim()
  if (!mio || !rival) {
    showToast('Di los dos mazos: el tuyo y el del rival.', 'error')
    return
  }
  const fila = {
    user_id: session.user.id,
    mi_mazo: claveDeNombre(mio),
    rival_mazo: claveDeNombre(rival),
    mi_mazo_nombre: mio,
    rival_mazo_nombre: rival,
    resultado: $('partidaResultado').value,
    donde: $('partidaDonde').value.trim() || null,
    notas: $('partidaNotas').value.trim() || null,
  }
  const fecha = $('partidaFecha').value
  if (fecha) fila.jugada_el = fecha

  const { error } = await supabase.from('match_log').insert(fila)
  if (error) {
    showToast('No se ha podido guardar: ' + error.message, 'error')
    return
  }
  showToast('Partida apuntada.', 'success')
  for (const id of ['partidaRival', 'partidaNotas']) $(id).value = ''
  await cargar()
}

async function borrarPartida(id) {
  const { error } = await supabase.from('match_log').delete().eq('id', id)
  if (error) {
    showToast('No se ha podido borrar: ' + error.message, 'error')
    return
  }
  await cargar()
}

// ── Arranque ──

async function cargar() {
  const [deTorneos, apuntadas] = await Promise.all([partidasDeTorneos(), partidasApuntadas()])
  todas = [...deTorneos, ...apuntadas]
  rellenarFiltroYSugerencias()
  repintar()
}

async function init() {
  session = await getSession()
  if (!session) {
    $('partidasContenido').classList.add('hidden')
    $('partidasSinCuenta').classList.remove('hidden')
    return
  }

  // El catálogo, una vez: lo necesitan tanto los arquetipos de torneo
  // como las partidas escritas a mano, para que caigan en la misma
  // casilla.
  const { data } = await supabase.from('tcg_archetypes').select('*').eq('activo', true)
  catalogo = data || []

  $('partidaFecha').value = new Date().toISOString().slice(0, 10)
  $('btnApuntarPartida').addEventListener('click', () => {
    $('partidaForm').classList.toggle('hidden')
    if (!$('partidaForm').classList.contains('hidden')) $('partidaMio').focus()
  })
  $('btnCancelarPartida').addEventListener('click', () => $('partidaForm').classList.add('hidden'))
  $('btnGuardarPartida').addEventListener('click', guardarPartida)
  $('filtroMazo').addEventListener('change', repintar)
  $('filtroDesde').addEventListener('change', repintar)

  await cargar()
}

init()
