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
import { arquetipoDeMazo, claveDeArquetipo, claveCanonicaDeMazo, dexesDeNombre } from './torneos/arquetipos.js'
import { urlDeSprite, spriteDeCarta, spriteDeObjeto } from './torneos/sprites-pokemon.js'
import { construirMatriz, resumen, porcentaje, miResultado } from './matriz-partidas.js'
import { montarSelectorMazo } from './torneos/selector-mazo.js'

const $ = (id) => document.getElementById(id)

let session = null
let todas = [] // el registro entero, ya normalizado
let catalogo = []
// Los torneos apuntados a mano (tanda 236): cada uno agrupa sus rondas.
let torneosLog = []
// Los buscadores de los formularios: dos por mazo, porque un arquetipo
// se nombra por una o dos cartas.
let selectores = {}
let tipoElegido = 'normal'
// El torneo al que se está añadiendo una ronda, o null si la partida
// que se apunta es suelta. Lo pone «+ Añadir ronda» y lo limpia cerrar.
let rondaPara = null

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
      // La clave CANÓNICA (por especies, contra el catálogo entero):
      // es lo que junta estas partidas con las apuntadas a mano aunque
      // el nombre deducido lleve un «ex» de más o el orden cambiado.
      mio: claveCanonicaDeMazo(claveDeArquetipo(mio), mio.nombre, catalogo),
      mioNombre: mio.nombre,
      rival: claveCanonicaDeMazo(claveDeArquetipo(rival), rival.nombre, catalogo),
      rivalNombre: rival.nombre,
      resultado,
      fecha: t?.start_at ? String(t.start_at).slice(0, 10) : null,
      donde: t?.name || 'Torneo de PokeDoc',
      enlace: t?.slug ? `/torneo?slug=${encodeURIComponent(t.slug)}` : null,
      deTorneo: true,
      // Para agruparlas en su tarjeta de «Tus torneos».
      torneoId: `pd-${torneoId}`,
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
    // Las claves guardadas se quedan como están en la base; aquí se
    // traducen a la canónica al leer, que es lo que hace que las filas
    // viejas se junten con las nuevas y con las de torneo.
    mio: claveCanonicaDeMazo(p.mi_mazo, p.mi_mazo_nombre, catalogo),
    mioNombre: p.mi_mazo_nombre,
    rival: claveCanonicaDeMazo(p.rival_mazo, p.rival_mazo_nombre, catalogo),
    rivalNombre: p.rival_mazo_nombre,
    resultado: p.resultado,
    fecha: p.jugada_el,
    donde: p.donde || 'Fuera de PokeDoc',
    notas: p.notas,
    tipo: p.tipo || 'normal',
    deTorneo: false,
    // La ronda de un torneo apuntado lleva el id de su torneo; una
    // partida suelta (o una fila de antes de la migración), null. La
    // hora de creación ordena las rondas DENTRO de su tarjeta (todas
    // comparten fecha de juego: la del torneo).
    torneoId: p.torneo_id || null,
    creada: p.created_at,
  }))
}

// Los torneos apuntados a mano. Falla EN SILENCIO como match_log, y por
// lo mismo: entre el despliegue y que un humano ejecute la migración la
// página tiene que seguir sirviendo (sin la sección de torneos a mano).
async function torneosApuntados() {
  const { data, error } = await supabase
    .from('match_log_torneos')
    .select('*')
    .order('jugado_el', { ascending: false })
  if (error) return []
  return data || []
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
    caja.innerHTML = `<p class="subtext">Aquí saldrán tus partidas de escalera y amistosas. Las de un torneo van en su pestaña, cada una con el suyo.</p>`
    return
  }
  caja.innerHTML = ultimas
    .map(
      (p) => `
    <div class="partidas-fila partidas-${p.resultado}">
      <span class="partidas-fila-mazos">${spritesDeMazoHtml(p.mioNombre, p.mio)}<strong>${escapeHtml(p.mioNombre)}</strong>
        <span class="subtext">vs</span> ${spritesDeMazoHtml(p.rivalNombre, p.rival)}${escapeHtml(p.rivalNombre)}</span>
      <span class="partidas-ronda-res partidas-ronda-${p.resultado}">${LETRA_RESULTADO[p.resultado] || '?'}</span>
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

// ── Los minisprites de un mazo, como los pinta trainingcourt ──
//
// Un mazo se enseña por sus (hasta dos) sprites: los iconos del
// catálogo si está catalogado, y si no, las especies sacadas del propio
// nombre. Un mazo-objeto (Martillos) usa el sprite del objeto si lo
// hay. Sin nada que enseñar devuelve cadena vacía y el nombre carga con
// todo el peso, que ya lo hacía antes.
function spritesDeMazoHtml(nombre, clave) {
  let urls = []
  if (String(clave || '').startsWith('a:')) {
    const arq = catalogo.find((a) => `a:${a.id}` === clave)
    urls = (arq?.iconos || []).map((i) => spriteDeCarta(i.nombre ?? i.name)).filter(Boolean)
  }
  if (!urls.length) urls = dexesDeNombre(nombre).slice(0, 2).map(urlDeSprite).filter(Boolean)
  if (!urls.length) {
    const objeto = spriteDeObjeto(nombre)
    if (objeto) urls = [objeto]
  }
  return urls.map((u) => `<img class="partidas-sprite" src="${escapeHtml(u)}" alt="" loading="lazy" />`).join('')
}

// ── Las tarjetas de «Tus torneos» ──
//
// Cada torneo con sus rondas dentro, como trainingcourt: los de PokeDoc
// (solo lectura, con enlace a la ficha) y los apuntados a mano (con
// añadir ronda y borrar). NO se filtran con la barra de arriba a
// propósito: un torneo es una unidad — esconderle rondas según el
// filtro sería enseñar un 1-0 que en realidad fue un 1-3.
function recordDe(rondas) {
  const r = { win: 0, loss: 0, draw: 0 }
  for (const p of rondas) r[p.resultado] = (r[p.resultado] || 0) + 1
  // Como trainingcourt: los empates solo salen si los hay.
  return `${r.win}-${r.loss}${r.draw ? `-${r.draw}` : ''}`
}

// El color del récord, de un vistazo: verde ganando, rojo perdiendo.
function claseDeRecord(rondas) {
  const r = porcentaje(
    rondas.reduce(
      (c, p) => {
        if (p.resultado === 'win') c.ganadas++
        else if (p.resultado === 'loss') c.perdidas++
        else c.empatadas++
        c.total++
        return c
      },
      { ganadas: 0, perdidas: 0, empatadas: 0, total: 0 }
    )
  )
  if (r === null) return ''
  return r >= 0.6 ? ' bien' : r <= 0.4 ? ' mal' : ''
}

const TEXTO_TIPO = { id: ' · ID', no_show: ' · no se presentó', bye: '' }
const LETRA_RESULTADO = { win: 'V', loss: 'D', draw: 'E' }

// Qué torneos están desplegados: sobrevive a los repintados.
const torneosAbiertos = new Set()

function tarjetaTorneoHtml(t) {
  const rondas = t.rondas
    .slice()
    .sort((a, b) => String(a.creada || '').localeCompare(String(b.creada || '')))
  const filas = rondas
    .map((p, i) => {
      const res = `<span class="partidas-ronda-res partidas-ronda-${p.resultado}">${LETRA_RESULTADO[p.resultado] || '?'}</span>`
      const rival =
        p.tipo === 'bye'
          ? '<span class="partidas-ronda-rival">Bye</span>'
          : `<span class="partidas-ronda-rival">${spritesDeMazoHtml(p.rivalNombre, p.rival)}<span>${escapeHtml(p.rivalNombre)}${TEXTO_TIPO[p.tipo] || ''}</span></span>`
      return `<li><span class="partidas-ronda-num">R${i + 1}</span>${rival}${res}</li>`
    })
    .join('')
  const abierto = torneosAbiertos.has(t.id)
  return `
    <div class="partidas-torneo">
      <button type="button" class="partidas-torneo-cab" data-abrir-torneo="${escapeHtml(t.id)}" aria-expanded="${abierto}">
        <span class="partidas-torneo-sprites">${spritesDeMazoHtml(t.mazo, t.mazoClave) || '<span class="partidas-sprite-hueco"></span>'}</span>
        <span class="partidas-torneo-titulo">
          <strong>${escapeHtml(t.nombre)}</strong>
          <span class="subtext">${[t.donde, t.fecha].filter(Boolean).map(escapeHtml).join(' · ')}</span>
        </span>
        <span class="partidas-torneo-record${claseDeRecord(t.rondas)}">${recordDe(t.rondas)}</span>
      </button>
      <div class="partidas-torneo-detalle ${abierto ? '' : 'hidden'}">
        ${t.mazo ? `<p class="subtext">Jugaste <strong>${escapeHtml(t.mazo)}</strong></p>` : ''}
        ${rondas.length ? `<ol class="partidas-torneo-rondas">${filas}</ol>` : '<p class="subtext">Sin rondas todavía.</p>'}
        ${t.aMano ? `<div data-hueco-form="${escapeHtml(t.id)}"></div>` : ''}
        <div class="partidas-torneo-acciones">
          ${
            t.aMano
              ? `<button class="btn-secondary" data-anadir-ronda="${escapeHtml(t.id)}">+ Añadir ronda</button>
                <button class="btn-outline" data-borrar-torneo="${escapeHtml(t.id)}">Borrar</button>`
              : `<a class="btn-secondary" href="${escapeHtml(t.enlace || '/torneos.html')}">Ver el torneo</a>`
          }
        </div>
      </div>
    </div>`
}

function pintarTorneos() {
  const caja = $('partidasTorneos')
  // El formulario de ronda vive DENTRO de una tarjeta cuando está en
  // ese modo: antes de arrasar el HTML hay que sacarlo, o el nodo se
  // pierde con el repintado.
  const form = $('partidaForm')
  if (caja.contains(form)) $('vista-sueltas').insertBefore(form, $('partidasLista'))

  const tarjetas = []

  // Los de PokeDoc, agrupados por torneo a partir de sus partidas.
  const dePokedoc = new Map()
  for (const p of todas) {
    if (!p.deTorneo) continue
    if (!dePokedoc.has(p.torneoId)) {
      dePokedoc.set(p.torneoId, {
        id: p.torneoId,
        nombre: p.donde,
        enlace: p.enlace,
        fecha: p.fecha,
        donde: 'Torneo de PokeDoc',
        mazo: p.mioNombre,
        mazoClave: p.mio,
        rondas: [],
        aMano: false,
      })
    }
    dePokedoc.get(p.torneoId).rondas.push(p)
  }
  tarjetas.push(...dePokedoc.values())

  for (const t of torneosLog) {
    tarjetas.push({
      id: t.id,
      nombre: t.nombre,
      enlace: null,
      fecha: t.jugado_el,
      donde: t.donde,
      mazo: t.mi_mazo_nombre,
      mazoClave: t.mi_mazo,
      rondas: todas.filter((p) => p.torneoId === t.id),
      aMano: true,
    })
  }

  if (!tarjetas.length) {
    caja.innerHTML = `<p class="subtext">Aquí saldrán tus torneos: los de PokeDoc entran solos y los de fuera se apuntan con «+ Apuntar un torneo».</p>`
    return
  }
  tarjetas.sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')))
  caja.innerHTML = tarjetas.map(tarjetaTorneoHtml).join('')

  caja.querySelectorAll('[data-abrir-torneo]').forEach((b) =>
    b.addEventListener('click', () => {
      const id = b.dataset.abrirTorneo
      if (torneosAbiertos.has(id)) torneosAbiertos.delete(id)
      else torneosAbiertos.add(id)
      pintarTorneos()
    })
  )
  caja.querySelectorAll('[data-anadir-ronda]').forEach((b) =>
    b.addEventListener('click', () => {
      const t = torneosLog.find((x) => x.id === b.dataset.anadirRonda)
      if (t) abrirFormPartida(t)
    })
  )
  // Borrar con dos toques, como los torneos de verdad: el primero arma y
  // el segundo ejecuta. Sin ventana del navegador.
  caja.querySelectorAll('[data-borrar-torneo]').forEach((b) =>
    b.addEventListener('click', async () => {
      if (!b.dataset.armado) {
        b.dataset.armado = '1'
        b.textContent = '¿Seguro? Borra sus rondas'
        return
      }
      const { error } = await supabase.from('match_log_torneos').delete().eq('id', b.dataset.borrarTorneo)
      if (error) {
        showToast('No se ha podido borrar: ' + error.message, 'error')
        return
      }
      if (rondaPara?.id === b.dataset.borrarTorneo) cerrarFormPartida()
      await cargar()
    })
  )

  // Si hay una ronda a medias de apuntar, el formulario vuelve a SU
  // tarjeta tras el repintado (guardar una ronda recarga y repinta).
  if (rondaPara) {
    const hueco = caja.querySelector(`[data-hueco-form="${rondaPara.id}"]`)
    if (hueco) hueco.appendChild(form)
    else cerrarFormPartida()
  }
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
  // Un bye no es un enfrentamiento y un «no se presentó» no dice nada
  // del mazo rival: cuentan en la lista de abajo (pasaron) pero NO en la
  // matriz, que es para saber cómo se te da cada emparejamiento. Un ID
  // sí entra: se jugó lo justo para pactar, y cuenta como empate.
  const m = construirMatriz(partidas.filter((p) => !['bye', 'no_show'].includes(p.tipo)))
  pintarResumen(m)
  pintarMatriz(m)
  pintarTorneos()
  // La lista de la pestaña de sueltas: SOLO las sueltas (las rondas de
  // torneo ya viven en su tarjeta) y sin el filtro de arriba, que es de
  // la pestaña de estadísticas.
  pintarLista(todas.filter((p) => !p.deTorneo && !p.torneoId))
}

function rellenarFiltroYSugerencias() {
  const mios = new Map()
  for (const p of todas) mios.set(p.mio, p.mioNombre)
  const sel = $('filtroMazo')
  const elegido = sel.value
  sel.innerHTML =
    '<option value="">Todos los míos</option>' +
    [...mios.entries()].map(([c, n]) => `<option value="${escapeHtml(c)}">${escapeHtml(n)}</option>`).join('')
  sel.value = elegido
  // Ya no hace falta autocompletar a mano: el mazo se ELIGE de una lista
  // con sprites (tanda 233), así que dos personas no pueden escribir el
  // mismo mazo de dos formas y partir el enfrentamiento en dos.
}

// ── Apuntar y borrar ──

// Un mazo son sus dos selectores juntos: «Dragapult» + «Dusknoir» es un
// mazo, «Gardevoir» a secas también. Devuelve la clave con la que se
// agrupa en la matriz y el nombre que se enseña.
function mazoDe(sel1, sel2) {
  const a = selectores[sel1]?.valor()
  const b = selectores[sel2]?.valor()
  const partes = [a, b].filter(Boolean)
  if (!partes.length) return null
  // Si el primero es un arquetipo del catálogo, manda él: su clave es la
  // que agrupa con las partidas de torneo aunque le cambien el nombre.
  const catalogado = partes.find((p) => p.valor.startsWith('a:'))
  return {
    clave: catalogado ? catalogado.valor : `d:${partes.map((p) => p.nombre).join(' ').toLowerCase()}`,
    nombre: catalogado ? catalogado.nombre : partes.map((p) => p.nombre).join(' '),
  }
}

// El sitio elegido, contando la casilla de «Otro…».
function dondeElegido() {
  const sel = $('partidaDonde').value
  if (sel !== '__otro') return sel
  return $('partidaDondeOtro').value.trim() || null
}

async function guardarPartida() {
  // En modo ronda el mazo, la fecha y el dónde vienen del TORNEO: se
  // eligieron una vez al crearlo y repetirlos en cada ronda solo daba
  // ocasión de contradecirse.
  const mio = rondaPara
    ? { clave: rondaPara.mi_mazo, nombre: rondaPara.mi_mazo_nombre }
    : mazoDe('mio1', 'mio2')
  const rival = mazoDe('rival1', 'rival2')

  // Un bye no tiene rival: exigirlo sería no dejar apuntarlo nunca.
  const necesitaRival = tipoElegido !== 'bye'
  if (!mio?.clave || (necesitaRival && !rival)) {
    showToast(
      necesitaRival ? 'Elige los dos mazos: el tuyo y el del rival.' : 'Elige al menos tu mazo.',
      'error'
    )
    return
  }

  const fila = {
    user_id: session.user.id,
    mi_mazo: mio.clave,
    rival_mazo: rival?.clave || 'sin-mazo',
    mi_mazo_nombre: mio.nombre,
    rival_mazo_nombre: rival?.nombre || (tipoElegido === 'bye' ? 'Bye' : 'Sin rival'),
    // El resultado de lo que no se jugó no lo elige nadie: un bye y un
    // «no se presentó» son victorias, y un ID es un empate. Dejarlo a
    // mano solo daba ocasión de apuntarlo mal.
    resultado: tipoElegido === 'id' ? 'draw' : tipoElegido === 'normal' ? $('partidaResultado').value : 'win',
    tipo: tipoElegido,
    donde: rondaPara ? rondaPara.nombre : dondeElegido(),
    notas: $('partidaNotas').value.trim() || null,
  }
  if (rondaPara) {
    fila.torneo_id = rondaPara.id
    fila.jugada_el = rondaPara.jugado_el
  } else {
    const fecha = $('partidaFecha').value
    if (fecha) fila.jugada_el = fecha
  }

  const { error } = await supabase.from('match_log').insert(fila)
  if (error) {
    showToast('No se ha podido guardar: ' + error.message, 'error')
    return
  }
  showToast(rondaPara ? 'Ronda apuntada.' : 'Partida apuntada.', 'success')
  // El mazo TUYO se queda puesto: quien apunta una tanda de partidas
  // suele jugar el mismo mazo toda la tarde. Y en modo ronda el
  // formulario se queda ABIERTO, que lo normal es apuntar varias
  // rondas seguidas.
  selectores.rival1?.limpiar()
  selectores.rival2?.limpiar()
  $('partidaNotas').value = ''
  await cargar()
}

// ── El formulario de partida, en sus dos modos ──
//
// El mismo formulario apunta una partida SUELTA (todo a la vista) o una
// RONDA de un torneo apuntado (el mazo, la fecha y el dónde se esconden
// porque vienen del torneo).
function abrirFormPartida(torneo = null) {
  rondaPara = torneo
  const esRonda = Boolean(torneo)
  $('partidaFormTitulo').textContent = esRonda ? 'Añadir ronda' : 'Apuntar una partida suelta'
  $('partidaFormPista').classList.toggle('hidden', esRonda)
  $('partidaCamposMios').classList.toggle('hidden', esRonda)
  $('partidaCampoFecha').classList.toggle('hidden', esRonda)
  $('partidaCampoDonde').classList.toggle('hidden', esRonda)
  $('partidaDondeOtroCampo').classList.toggle('hidden', esRonda || $('partidaDonde').value !== '__otro')
  $('torneoLogForm').classList.add('hidden')
  $('partidaForm').classList.remove('hidden')
  if (esRonda) {
    // El formulario se MUDA dentro de la tarjeta del torneo, como el
    // inline de trainingcourt: repintar crea el hueco y lo mete.
    torneosAbiertos.add(torneo.id)
    pintarTorneos()
  }
  $('partidaForm').scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  ;$(esRonda ? 'selRival1' : 'selMio1').querySelector('input')?.focus()
}

function cerrarFormPartida() {
  rondaPara = null
  const form = $('partidaForm')
  form.classList.add('hidden')
  // De vuelta a su sitio de la pestaña de sueltas si estaba de mudanza.
  if (!$('vista-sueltas').contains(form)) $('vista-sueltas').insertBefore(form, $('partidasLista'))
}

// ── Apuntar un torneo ──

function dondeTorneoElegido() {
  const sel = $('torneoLogDonde').value
  if (sel !== '__otro') return sel
  return $('torneoLogDondeOtro').value.trim() || null
}

async function guardarTorneoLog() {
  const nombre = $('torneoLogNombre').value.trim()
  const mazo = mazoDe('tmio1', 'tmio2')
  if (!nombre || !mazo) {
    showToast(nombre ? 'Elige el mazo que jugaste.' : 'Ponle nombre al torneo.', 'error')
    return
  }
  const fila = {
    user_id: session.user.id,
    nombre,
    donde: dondeTorneoElegido(),
    mi_mazo: mazo.clave,
    mi_mazo_nombre: mazo.nombre,
  }
  const fecha = $('torneoLogFecha').value
  if (fecha) fila.jugado_el = fecha

  // El insert devuelve la fila para abrir «añadir ronda» al momento:
  // quien crea el torneo viene a apuntar sus rondas, no a mirar.
  const { data, error } = await supabase.from('match_log_torneos').insert(fila).select().single()
  if (error) {
    showToast('No se ha podido crear: ' + error.message, 'error')
    return
  }
  showToast('Torneo creado: ahora sus rondas.', 'success')
  $('torneoLogForm').classList.add('hidden')
  $('torneoLogNombre').value = ''
  await cargar()
  abrirFormPartida(data)
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
  const [deTorneos, apuntadas, torneos] = await Promise.all([
    partidasDeTorneos(),
    partidasApuntadas(),
    torneosApuntados(),
  ])
  todas = [...deTorneos, ...apuntadas]
  torneosLog = torneos
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

  for (const [clave, caja, marcador] of [
    ['mio1', 'selMio1', 'Tu Pokémon principal…'],
    ['mio2', 'selMio2', 'Y el segundo (opcional)…'],
    ['rival1', 'selRival1', 'Su Pokémon principal…'],
    ['rival2', 'selRival2', 'Y el segundo (opcional)…'],
    ['tmio1', 'selTorneoMio1', 'Tu Pokémon principal…'],
    ['tmio2', 'selTorneoMio2', 'Y el segundo (opcional)…'],
  ]) {
    selectores[clave] = montarSelectorMazo($(caja), { catalogo, marcador })
  }

  // «Otro…» abre su campo de texto; el resto lo esconde.
  $('partidaDonde').addEventListener('change', () => {
    $('partidaDondeOtroCampo').classList.toggle('hidden', $('partidaDonde').value !== '__otro')
    if ($('partidaDonde').value === '__otro') $('partidaDondeOtro').focus()
  })

  const NOTA_TIPO = {
    id: 'Cuenta como empate en la matriz: se llegó a jugar lo justo para pactarlo.',
    no_show: 'Cuenta como victoria, pero NO entra en la matriz: no llegaste a jugar contra ese mazo.',
    bye: 'No entra en la matriz ni hace falta decir el mazo rival: no hubo enfrentamiento.',
  }
  document.querySelectorAll('.partidas-tipo').forEach((b) =>
    b.addEventListener('click', () => {
      tipoElegido = b.dataset.tipo
      document.querySelectorAll('.partidas-tipo').forEach((x) => x.classList.toggle('activo', x === b))
      // El resultado solo se elige cuando se jugó de verdad: en los
      // demás casos lo decide el tipo, y enseñarlo invitaría a
      // contradecirse.
      $('partidaResultado').closest('label').classList.toggle('hidden', tipoElegido !== 'normal')
      const nota = $('partidaTipoNota')
      nota.textContent = NOTA_TIPO[tipoElegido] || ''
      nota.classList.toggle('hidden', !NOTA_TIPO[tipoElegido])
    })
  )

  // Las tres vistas, como las pestañas del perfil.
  document.querySelectorAll('#partidasTabs .tab-btn').forEach((btn) =>
    btn.addEventListener('click', () => {
      document.querySelectorAll('#partidasTabs .tab-btn').forEach((b) => b.classList.toggle('active', b === btn))
      for (const v of ['torneos', 'sueltas', 'stats']) {
        $(`vista-${v}`).classList.toggle('active', v === btn.dataset.vista)
      }
    })
  )

  $('btnApuntarPartida').addEventListener('click', () => {
    // Si ya está abierto en modo suelto, el botón lo cierra; si está en
    // modo ronda, lo pasa a suelto.
    if (!$('partidaForm').classList.contains('hidden') && !rondaPara) cerrarFormPartida()
    else abrirFormPartida(null)
  })
  $('btnCancelarPartida').addEventListener('click', cerrarFormPartida)
  $('btnGuardarPartida').addEventListener('click', guardarPartida)

  // El formulario de torneo.
  $('torneoLogFecha').value = new Date().toISOString().slice(0, 10)
  $('btnApuntarTorneo').addEventListener('click', () => {
    cerrarFormPartida()
    $('torneoLogForm').classList.toggle('hidden')
    if (!$('torneoLogForm').classList.contains('hidden')) $('torneoLogNombre').focus()
  })
  $('btnCancelarTorneoLog').addEventListener('click', () => $('torneoLogForm').classList.add('hidden'))
  $('btnGuardarTorneoLog').addEventListener('click', guardarTorneoLog)
  $('torneoLogDonde').addEventListener('change', () => {
    $('torneoLogDondeOtroCampo').classList.toggle('hidden', $('torneoLogDonde').value !== '__otro')
    if ($('torneoLogDonde').value === '__otro') $('torneoLogDondeOtro').focus()
  })
  $('filtroMazo').addEventListener('change', repintar)
  $('filtroDesde').addEventListener('change', repintar)

  await cargar()
}

init()
