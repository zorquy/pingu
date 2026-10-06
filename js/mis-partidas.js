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
import { urlDeSprite, spriteDeCarta, spriteDeObjeto, atributosDeRespaldo } from './torneos/sprites-pokemon.js'
import { construirMatriz, resumen, porcentaje, miResultado, filtrarTorneos, enfrentamientosDe } from './matriz-partidas.js'
import { montarSelectorMazo } from './torneos/selector-mazo.js'
import {
  arquetipoDeMazoGuardado,
  mazoDeJugador,
  opcionesDeMazosGuardados,
  partidaDesdeRepeticion,
  repeticionesSinApuntar,
  resultadoDeRepeticion,
} from './partidas-mazos.js'
import {
  PERIODOS,
  filtrarPartidas,
  hoyLocal,
  ordenarPartidas,
  porDiaDeLaSemana,
  porGrupo,
  porPeriodo,
  rachas,
  rangoDePeriodo,
  seJugo,
  ultimas,
} from './estadisticas-partidas.js'
import { graficoBarras, graficoEvolucion } from './graficos-partidas.js'
import { resultadoDeJuegos, filasVisibles, recortar, aColumnas, deColumnas, textoMarcador, decidida, cifrasDeJuegos } from './partidas-juegos.js'

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
// Los juegos de la partida (tanda 632): el formato y, por juego, quién
// ganó (`r`: W/L/T) y quién empezó (`s`: '1' tú, '2' el rival).
let formatoElegido = 'bo1'
let juegosElegidos = []
// ¿La base ya tiene dónde guardarlos? Sin la migración, el formulario se
// queda al mejor de uno (que es lo que cabe en `resultado`).
let juegosEnBase = false
// El torneo al que se está añadiendo una ronda, o null si la partida
// que se apunta es suelta. Lo pone «+ Añadir ronda» y lo limpia cerrar.
let rondaPara = null
// Tus mazos guardados del constructor y tus repeticiones (tanda 627), y
// si la base ya sabe enlazar una partida con un mazo guardado
// (`match_log.user_deck_id`). Mientras no lo sepa, no se ofrece: mandar
// esa columna haría fallar el guardado entero.
let mazosGuardados = []
let repeticionesMias = []
let vinculoMazo = false

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
    // La repetición de la que se apuntó (tanda 494), si se apuntó al
    // guardarla en /repeticiones. Una fila de antes no la trae.
    repeticion: p.replay_id || null,
    // El mazo guardado con el que se jugó (tanda 627), si se dijo.
    mazoGuardado: p.user_deck_id || null,
    // Sus juegos (tanda 632). Una fila de antes, o de antes de la
    // migración, no los trae: al mejor de uno y sin detalle.
    ...deColumnas(p),
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

// Los enfrentamientos, en bloques: uno por mazo mío, con su lista de
// rivales dentro. Sustituye a la tabla ancha que había que arrastrar de
// lado (ver enfrentamientosDe en matriz-partidas.js).
//
// Cada fila lleva una barra proporcional al porcentaje: es lo que hace
// que se lea de un vistazo sin tener que comparar números. Y el récord
// al lado, porque un 100% de una partida y un 100% de doce no son lo
// mismo — la barra sola mentiría.
function filaEnfrentamientoHtml(e) {
  const c = e.casilla
  const pctNum = e.ratio === null ? null : Math.round(e.ratio * 100)
  const record = `${c.ganadas}-${c.perdidas}${c.empatadas ? `-${c.empatadas}` : ''}`
  return `
    <li class="partidas-enf">
      <span class="partidas-enf-rival">${spritesDeMazoHtml(e.nombre, e.clave)}<span>${escapeHtml(e.nombre)}</span></span>
      <span class="partidas-enf-barra${claseDeCasilla(c)}" role="img" aria-label="${pctNum ?? 0}% de victorias">
        <span style="width:${pctNum ?? 0}%"></span>
      </span>
      <span class="partidas-enf-record">${record}</span>
      <span class="partidas-enf-pct">${pctNum === null ? '—' : pctNum + '%'}</span>
    </li>`
}

function pintarMatriz(m) {
  const caja = $('partidasMatriz')
  if (!m.filas.length) {
    caja.innerHTML = `<div class="simple-card"><p>Todavía no hay partidas que contar.</p>
      <p class="subtext">Las de los torneos de PokeDoc entran solas cuando el torneo termina. Las de fuera, con «Apuntar una partida».</p></div>`
    return
  }
  caja.innerHTML = m.filas
    .map((f) => {
      const enfrentamientos = enfrentamientosDe(f, m.columnas)
      const total = f.total
      const pctTotal = pct(total)
      return `
        <section class="partidas-mazo-bloque">
          <header class="partidas-mazo-cab">
            <span class="partidas-mazo-nombre">${spritesDeMazoHtml(f.nombre, f.clave)}<strong>${escapeHtml(f.nombre)}</strong></span>
            <span class="partidas-mazo-total${claseDeCasilla(total)}">
              ${total.ganadas}-${total.perdidas}${total.empatadas ? `-${total.empatadas}` : ''}
              <span class="subtext">${pctTotal}</span>
            </span>
          </header>
          <ul class="partidas-enfrentamientos">${enfrentamientos.map(filaEnfrentamientoHtml).join('')}</ul>
        </section>`
    })
    .join('')
}

const TEXTO_RESULTADO = { win: 'Ganada', loss: 'Perdida', draw: 'Empate' }

// Cuántas partidas sueltas se enseñan de golpe.
//
// Antes se cortaba en 30 EN SILENCIO: la 31 y las siguientes
// desaparecían sin que nada lo dijera, que es peor que un scroll largo
// — parecía que se habían perdido. Ahora el corte se anuncia y se
// levanta (tanda 251).
const SUELTAS_DE_GOLPE = 30
let verTodasLasSueltas = false

function pintarLista(partidas) {
  const caja = $('partidasLista')
  const ordenadas = ordenarPartidas(partidas, $('listaOrden').value)
  const visibles = verTodasLasSueltas ? ordenadas : ordenadas.slice(0, SUELTAS_DE_GOLPE)
  const ocultas = ordenadas.length - visibles.length
  if (!visibles.length) {
    // Dos vacíos distintos: no hay ninguna, o las hay y el filtro no deja
    // pasar ninguna (tanda 510: un vacío no puede decir las dos cosas).
    const hay = todas.some((p) => !p.deTorneo && !p.torneoId)
    caja.innerHTML = hay
      ? `<p class="subtext">Ninguna partida suelta casa con estos filtros.</p>`
      : `<p class="subtext">Aquí saldrán tus partidas de escalera y amistosas. Las de un torneo van en su pestaña, cada una con el suyo.</p>`
    return
  }
  caja.innerHTML = visibles
    .map(
      (p) => `
    <div class="partidas-fila partidas-${p.resultado}">
      <span class="partidas-fila-mazos">${spritesDeMazoHtml(p.mioNombre, p.mio)}<strong>${escapeHtml(p.mioNombre)}</strong>
        <span class="subtext">vs</span> ${spritesDeMazoHtml(p.rivalNombre, p.rival)}${escapeHtml(p.rivalNombre)}</span>
      <span class="partidas-ronda-res partidas-ronda-${p.resultado}">${LETRA_RESULTADO[p.resultado] || '?'}</span>${juegosMiniHtml(p)}
      <span class="subtext partidas-fila-donde">${
        p.enlace ? `<a href="${escapeHtml(p.enlace)}">${escapeHtml(p.donde)}</a>` : escapeHtml(p.donde)
      }${p.fecha ? ` · ${escapeHtml(p.fecha)}` : ''}</span>
      ${p.mazoGuardado ? mazoGuardadoHtml(p.mazoGuardado) : ''}
      ${p.notas ? `<span class="subtext partidas-fila-notas">${escapeHtml(p.notas)}</span>` : ''}
      ${
        p.deTorneo
          ? ''
          : `<span class="partidas-fila-acciones">
              ${p.repeticion ? `<a class="btn-outline" href="/repeticiones?r=${encodeURIComponent(p.repeticion)}">Ver la repetición</a>` : ''}
              <button class="btn-outline" data-editar="${escapeHtml(p.id)}">Editar</button>
              <button class="btn-outline partidas-borrar" data-borrar="${escapeHtml(p.id)}">Borrar</button>
            </span>`
      }
    </div>`
    )
    .join('') +
    (ocultas > 0
      ? `<button type="button" class="btn-secondary torneo-ver-mas" id="btnVerMasSueltas">Ver ${ocultas} más</button>`
      : '')
  caja.querySelectorAll('[data-borrar]').forEach((b) =>
    b.addEventListener('click', async () => {
      if (!b.dataset.armado) {
        b.dataset.armado = '1'
        b.textContent = '¿Seguro?'
        return
      }
      if (editando?.id === b.dataset.borrar) cerrarFormPartida()
      await borrarPartida(b.dataset.borrar)
    })
  )
  caja.querySelectorAll('[data-editar]').forEach((b) =>
    b.addEventListener('click', () => {
      const partida = todas.find((x) => x.id === b.dataset.editar)
      if (partida) abrirFormPartida(null, partida)
    })
  )
  caja.querySelector('#btnVerMasSueltas')?.addEventListener('click', () => {
    verTodasLasSueltas = true
    repintar()
  })
}

// El mazo guardado de una partida, con su enlace al constructor. Si ya no
// está en tu lista (se borró y la base aún no ha soltado el enlace, o no
// se ha podido leer), se dice así en vez de inventarle un nombre.
function mazoGuardadoHtml(id) {
  const m = mazosGuardados.find((x) => x.id === id)
  return `<span class="subtext partidas-fila-guardado">Con tu mazo <a href="/constructor?mazo=${encodeURIComponent(id)}">${escapeHtml(m?.name || 'guardado')}</a></span>`
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
  // Si un sprite no llega, atributosDeRespaldo recorre la cadena: la
  // especie base (una mega que la CDN aún no tiene) y luego el segundo
  // ORIGEN, por si la que está caída es la CDN entera — pasó el
  // 2026-09-20 y esta pantalla se quedó con los huecos y nada dentro.
  // Agotada la cadena la imagen se ESCONDE: un icono de imagen rota es
  // peor que no enseñar nada, parece que la página está estropeada.
  return urls
    .map((u) => `<img class="partidas-sprite" src="${escapeHtml(u)}" alt="" loading="lazy"${atributosDeRespaldo(u)} />`)
    .join('')
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

// Los juegos de una partida al mejor de tres, en pequeño al lado de su
// resultado (tanda 632): «V D V · 2-1». Al mejor de uno no aportan nada que
// no diga ya la letra.
function juegosMiniHtml(p) {
  if (p.formato !== 'bo3' || !p.juegos?.length) return ''
  const quien = { 1: ', empezaste tú', 2: ', empezó el rival' }
  const palabra = { W: 'ganado', L: 'perdido', T: 'empate' }
  const texto = p.juegos.map((j, i) => `juego ${i + 1} ${palabra[j.r]}${quien[j.s] || ''}`).join('; ')
  return `<span class="partidas-mini" role="img" aria-label="${escapeHtml(`${textoMarcador(p.juegos)}: ${texto}`)}">${p.juegos
    .map((j) => `<span class="partidas-mini-juego partidas-ronda-${{ W: 'win', L: 'loss', T: 'draw' }[j.r]}${j.s === '1' ? ' partidas-mini-empiezas' : ''}" aria-hidden="true">${{ W: 'V', L: 'D', T: 'E' }[j.r]}</span>`)
    .join('')}<span class="partidas-mini-marcador" aria-hidden="true">${escapeHtml(textoMarcador(p.juegos))}</span></span>`
}

// Qué torneos están desplegados: sobrevive a los repintados.
const torneosAbiertos = new Set()

// Cuántos torneos se enseñan de golpe, y si ya se ha pedido verlos
// todos. El corte es lo que evita el scroll sin fin.
const TORNEOS_DE_GOLPE = 8
let verTodosLosTorneos = false

// La ronda o partida que se está EDITANDO (null = se está apuntando una
// nueva). Es lo que decide si al guardar se hace insert o update.
let editando = null

// Y lo mismo para el TORNEO apuntado: null = se está creando uno nuevo.
let editandoTorneo = null

// Un torneo CERRADO no pide más rondas: se acabó y la tarjeta deja de
// ofrecer campos para seguir metiendo (tanda 251). No cambia ningún
// dato — solo esconde los botones —, y por eso reabrirlo es gratis.
// Editar una ronda solo se ofrece con el torneo ABIERTO: eso es lo que
// le da sentido a «Reabrir», que si no sería un botón sin consecuencia.
function tarjetaTorneoHtml(t) {
  const rondas = t.rondas
    .slice()
    .sort((a, b) => String(a.creada || '').localeCompare(String(b.creada || '')))
  const editable = t.aMano && !t.cerrado
  const filas = rondas
    .map((p, i) => {
      const res = `<span class="partidas-ronda-res partidas-ronda-${p.resultado}">${LETRA_RESULTADO[p.resultado] || '?'}</span>`
      const rival =
        p.tipo === 'bye'
          ? '<span class="partidas-ronda-rival">Bye</span>'
          : `<span class="partidas-ronda-rival">${spritesDeMazoHtml(p.rivalNombre, p.rival)}<span>${escapeHtml(p.rivalNombre)}${TEXTO_TIPO[p.tipo] || ''}</span></span>`
      const acciones = editable
        ? `<span class="partidas-ronda-acciones">
             <button type="button" class="link-btn" data-editar-ronda="${escapeHtml(p.id)}" title="Editar esta ronda">Editar</button>
             <button type="button" class="link-btn" data-borrar-ronda="${escapeHtml(p.id)}" title="Borrar esta ronda">Borrar</button>
           </span>`
        : ''
      return `<li><span class="partidas-ronda-num">R${i + 1}</span>${rival}${res}${juegosMiniHtml(p)}${acciones}</li>`
    })
    .join('')
  const abierto = torneosAbiertos.has(t.id)
  return `
    <div class="partidas-torneo${t.cerrado ? ' cerrado' : ''}">
      <button type="button" class="partidas-torneo-cab" data-abrir-torneo="${escapeHtml(t.id)}" aria-expanded="${abierto}">
        <span class="partidas-torneo-sprites">${spritesDeMazoHtml(t.mazo, t.mazoClave) || '<span class="partidas-sprite-hueco"></span>'}</span>
        <span class="partidas-torneo-titulo">
          <strong>${escapeHtml(t.nombre)}</strong>
          <span class="subtext">${[t.donde, t.fecha].filter(Boolean).map(escapeHtml).join(' · ')}</span>
        </span>
        ${t.cerrado ? '<span class="partidas-chapa-cerrado">Cerrado</span>' : ''}
        <span class="partidas-torneo-record${claseDeRecord(t.rondas)}">${recordDe(t.rondas)}</span>
      </button>
      <div class="partidas-torneo-detalle ${abierto ? '' : 'hidden'}">
        ${t.mazo ? `<p class="subtext">Jugaste <strong>${escapeHtml(t.mazo)}</strong></p>` : ''}
        ${rondas.length ? `<ol class="partidas-torneo-rondas">${filas}</ol>` : '<p class="subtext">Sin rondas todavía.</p>'}
        ${editable ? `<div data-hueco-form="${escapeHtml(t.id)}"></div>` : ''}
        <div class="partidas-torneo-acciones">
          ${accionesDeTorneoHtml(t)}
        </div>
      </div>
    </div>`
}

function accionesDeTorneoHtml(t) {
  if (!t.aMano) return `<a class="btn-secondary" href="${escapeHtml(t.enlace || '/torneos.html')}">Ver el torneo</a>`
  const id = escapeHtml(t.id)
  if (t.cerrado) {
    return `<span class="subtext partidas-cerrado-nota">Cerrado. Reábrelo si tienes que arreglar algo.</span>
      <button class="btn-secondary" data-reabrir-torneo="${id}">Reabrir</button>
      <button class="btn-outline" data-borrar-torneo="${id}">Borrar</button>`
  }
  return `<button class="btn-secondary" data-anadir-ronda="${id}">+ Añadir ronda</button>
      <button class="btn-secondary" data-editar-torneo="${id}">Editar torneo</button>
      <button class="btn-secondary" data-cerrar-torneo="${id}">Cerrar torneo</button>
      <button class="btn-outline" data-borrar-torneo="${id}">Borrar</button>`
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
      cerrado: Boolean(t.cerrado_el),
    })
  }

  if (!tarjetas.length) {
    caja.innerHTML = `<p class="subtext">Aquí saldrán tus torneos: los de PokeDoc entran solos y los de fuera se apuntan con «+ Apuntar un torneo».</p>`
    return
  }
  // El orden que se pida (tanda 628); por defecto, el más reciente arriba.
  const signo = $('torneoOrden')?.value === 'antiguas' ? 1 : -1
  tarjetas.sort((a, b) => signo * String(a.fecha || '').localeCompare(String(b.fecha || '')))

  const casan = filtrarTorneos(tarjetas, $('torneoBuscar')?.value, $('torneoEstado')?.value)
  if (!casan.length) {
    caja.innerHTML = `<p class="subtext">Ningún torneo casa con lo que buscas. Prueba a vaciar el buscador o a cambiar el estado.</p>`
    return
  }
  // El corte: la lista crece para siempre y el scroll infinito era la
  // queja de PINGU. Un torneo abierto con el formulario dentro NO se
  // puede quedar fuera del corte, o el formulario se iría con él.
  const forzados = rondaPara ? casan.filter((t) => t.id === rondaPara.id) : []
  const visibles = verTodosLosTorneos ? casan : casan.slice(0, TORNEOS_DE_GOLPE)
  for (const t of forzados) if (!visibles.includes(t)) visibles.push(t)
  const ocultos = casan.length - visibles.length

  caja.innerHTML =
    visibles.map(tarjetaTorneoHtml).join('') +
    (ocultos > 0
      ? `<button type="button" class="btn-secondary torneo-ver-mas" id="btnVerMasTorneosLog">Ver ${ocultos} más</button>`
      : '')
  caja.querySelector('#btnVerMasTorneosLog')?.addEventListener('click', () => {
    verTodosLosTorneos = true
    pintarTorneos()
  })

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

  caja.querySelectorAll('[data-editar-torneo]').forEach((b) =>
    b.addEventListener('click', () => {
      const t = torneosLog.find((x) => x.id === b.dataset.editarTorneo)
      if (t) abrirFormTorneo(t)
    })
  )
  caja.querySelectorAll('[data-cerrar-torneo]').forEach((b) =>
    b.addEventListener('click', () => cambiarCierre(b.dataset.cerrarTorneo, true))
  )
  caja.querySelectorAll('[data-reabrir-torneo]').forEach((b) =>
    b.addEventListener('click', () => cambiarCierre(b.dataset.reabrirTorneo, false))
  )
  caja.querySelectorAll('[data-editar-ronda]').forEach((b) =>
    b.addEventListener('click', () => {
      const ronda = todas.find((p) => p.id === b.dataset.editarRonda)
      const torneo = torneosLog.find((x) => x.id === ronda?.torneoId)
      if (ronda && torneo) abrirFormPartida(torneo, ronda)
    })
  )
  // Borrar UNA ronda, en dos toques como todo lo que no tiene vuelta.
  caja.querySelectorAll('[data-borrar-ronda]').forEach((b) =>
    b.addEventListener('click', async () => {
      if (!b.dataset.armado) {
        b.dataset.armado = '1'
        b.textContent = '¿Seguro?'
        return
      }
      if (editando?.id === b.dataset.borrarRonda) cerrarFormPartida()
      await borrarPartida(b.dataset.borrarRonda)
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

// ── Los filtros (tanda 628) ──
//
// Se aplican sobre lo ya cargado, sin volver a pedir nada: son unas pocas
// decenas o cientos de filas y la respuesta es instantánea. Los de la
// pestaña de estadísticas valen para TODO lo de esa pestaña (cifras,
// gráficos y enfrentamientos); la lista de sueltas tiene los suyos.
function filtrosDeStats() {
  return {
    periodo: $('filtroPeriodo').value,
    desde: $('filtroFechaDesde').value,
    hasta: $('filtroFechaHasta').value,
    resultado: $('filtroResultado').value,
    mazo: $('filtroMazo').value,
    guardado: $('filtroGuardado').value,
    rival: $('filtroRival').value,
    origen: $('filtroOrigen').value,
  }
}

function filtrosDeLista() {
  return {
    periodo: $('listaPeriodo').value,
    desde: $('listaFechaDesde').value,
    hasta: $('listaFechaHasta').value,
    resultado: $('listaResultado').value,
  }
}

// «Entre dos fechas…» abre sus dos campos; los demás periodos los
// esconden (y sus fechas dejan de contar, que es lo que dice el filtro).
function mostrarRango(prefijo) {
  const rango = $(`${prefijo}Periodo`).value === 'rango'
  $(`${prefijo}DesdeCampo`).classList.toggle('hidden', !rango)
  $(`${prefijo}HastaCampo`).classList.toggle('hidden', !rango)
}

const hayFiltro = (f) => Object.entries(f).some(([k, v]) => v && !(k === 'periodo' && v === 'siempre') && !(['desde', 'hasta'].includes(k) && f.periodo !== 'rango'))

function repintar() {
  const filtros = filtrosDeStats()
  const partidas = filtrarPartidas(todas, filtros)
  // Un bye no es un enfrentamiento y un «no se presentó» no dice nada
  // del mazo rival: cuentan en la lista de abajo (pasaron) pero NO en la
  // matriz ni en las cifras, que son para saber cómo se te da cada
  // emparejamiento. Un ID sí entra: se jugó lo justo para pactar, y
  // cuenta como empate.
  const jugadas = partidas.filter(seJugo)
  const m = construirMatriz(jugadas)
  const filtrado = hayFiltro(filtros)
  $('filtroLimpiar').classList.toggle('hidden', !filtrado)
  const n = jugadas.length
  $('filtroCuenta').textContent = filtrado ? `${n} de ${todas.filter(seJugo).length} partidas con estos filtros.` : ''
  pintarResumen(m)
  pintarExtra(jugadas)
  ultimasJugadas = jugadas
  pintarGraficos()
  pintarMatriz(m)
  pintarTorneos()
  // La lista de la pestaña de sueltas: SOLO las sueltas (las rondas de
  // torneo ya viven en su tarjeta), con SUS filtros y su orden.
  pintarLista(filtrarPartidas(todas.filter((p) => !p.deTorneo && !p.torneoId), filtrosDeLista()))
}

function rellenarFiltroYSugerencias() {
  // Un desplegable se rellena con lo que HAY, y conserva lo elegido si
  // sigue existiendo; si no, vuelve a «todos» (tanda 472: un valor que no
  // está entre las opciones se quedaría con la primera sin decirlo).
  const rellenar = (id, primera, pares) => {
    const sel = $(id)
    const elegido = sel.value
    sel.innerHTML = `<option value="">${escapeHtml(primera)}</option>` + pares.map(([c, n]) => `<option value="${escapeHtml(c)}">${escapeHtml(n)}</option>`).join('')
    sel.value = pares.some(([c]) => c === elegido) ? elegido : ''
  }
  const por = (clave, nombre) => {
    const mapa = new Map()
    for (const p of todas) if (p[clave] && !mapa.has(p[clave])) mapa.set(p[clave], p[nombre])
    return [...mapa.entries()].sort((a, b) => String(a[1]).localeCompare(String(b[1])))
  }
  rellenar('filtroMazo', 'Todos los míos', por('mio', 'mioNombre'))
  rellenar('filtroRival', 'Todos', por('rival', 'rivalNombre').filter(([c]) => c !== 'sin-mazo'))
  // El de los mazos guardados, solo si alguna partida lleva uno.
  const guardados = [...new Set(todas.map((p) => p.mazoGuardado).filter(Boolean))].map((id) => [id, mazosGuardados.find((m) => m.id === id)?.name || 'Un mazo que ya no está en tu lista'])
  rellenar('filtroGuardado', 'Todos', guardados)
  $('filtroGuardadoCampo').classList.toggle('hidden', !guardados.length)
  // Ya no hace falta autocompletar a mano: el mazo se ELIGE de una lista
  // con sprites (tanda 233), así que dos personas no pueden escribir el
  // mismo mazo de dos formas y partir el enfrentamiento en dos.
}

// ── Las cifras de más (tanda 628) ──
const TEXTO_RACHA = { win: ['victoria', 'victorias'], loss: ['derrota', 'derrotas'], draw: ['empate', 'empates'] }
const enPalabras = (n, r) => `${n} ${TEXTO_RACHA[r][n === 1 ? 0 : 1]}`

function pintarExtra(jugadas) {
  const caja = $('partidasExtra')
  if (!jugadas.length) {
    caja.innerHTML = ''
    return
  }
  const r = rachas(jugadas)
  const diez = ultimas(jugadas, 10).reverse()
  const masJugado = porGrupo(jugadas, (p) => p.mio, (p) => p.mioNombre)[0]
  const masRival = porGrupo(jugadas.filter((p) => p.rival !== 'sin-mazo'), (p) => p.rival, (p) => p.rivalNombre)[0]
  const dato = (titulo, fuerte, sub = '') =>
    `<div class="partidas-dato"><span class="partidas-dato-titulo">${titulo}</span><strong>${fuerte}</strong>${sub ? `<span class="subtext">${sub}</span>` : ''}</div>`
  const rec = (c) => `${c.ganadas}-${c.perdidas}${c.empatadas ? `-${c.empatadas}` : ''} · ${c.pct == null ? '—' : `${Math.round(c.pct * 100)}%`}`
  caja.innerHTML = [
    r.actual
      ? dato('Racha actual', escapeHtml(`${enPalabras(r.actual.n, r.actual.resultado)}${r.actual.n > 1 ? ' seguidas' : ''}`), escapeHtml(`Mejor: ${r.mejorVictorias ? enPalabras(r.mejorVictorias, 'win') : 'ninguna victoria'} · peor: ${r.peorDerrotas ? enPalabras(r.peorDerrotas, 'loss') : 'ninguna derrota'}`))
      : '',
    dato(
      `Últimas ${diez.length}`,
      `<span class="partidas-forma" aria-label="${escapeHtml(diez.map((p) => TEXTO_RESULTADO[p.resultado]).join(', '))}">${diez.map((p) => `<span class="partidas-ronda-res partidas-ronda-${p.resultado}" title="${escapeHtml(`${TEXTO_RESULTADO[p.resultado]} contra ${p.rivalNombre}${p.fecha ? ` · ${p.fecha}` : ''}`)}">${LETRA_RESULTADO[p.resultado] || '?'}</span>`).join('')}</span>`,
      'La más reciente, a la derecha'
    ),
    masJugado ? dato('Tu mazo más jugado', escapeHtml(masJugado.nombre), escapeHtml(`${masJugado.total} ${masJugado.total === 1 ? 'partida' : 'partidas'} · ${rec(masJugado)}`)) : '',
    masRival ? dato('El rival que más te sale', escapeHtml(masRival.nombre), escapeHtml(`${masRival.total} ${masRival.total === 1 ? 'partida' : 'partidas'} · ${rec(masRival)}`)) : '',
    ...datosDeJuegos(jugadas, dato),
  ].join('')
}

// Lo que dicen los juegos (tanda 632): cuántos ganas al mejor de tres y
// cómo te va empezando tú y empezando el rival. Solo con las partidas que
// los traen; sin ninguna, no se enseña (no es un cero, es «no se sabe»).
function datosDeJuegos(jugadas, dato) {
  const c = cifrasDeJuegos(jugadas)
  if (!c.partidas) return []
  const pct = (g, t) => (t ? `${Math.round((g / t) * 100)}%` : '—')
  const jugados = c.juegos.g + c.juegos.p + c.juegos.e
  const salida = c.primero.total + c.segundo.total
  return [
    dato(
      'Juegos',
      escapeHtml(`${c.juegos.g}-${c.juegos.p}${c.juegos.e ? `-${c.juegos.e}` : ''} · ${pct(c.juegos.g + c.juegos.e / 2, jugados)}`),
      escapeHtml(`En ${c.partidas} ${c.partidas === 1 ? 'partida apuntada' : 'partidas apuntadas'} juego a juego`)
    ),
    salida
      ? dato(
          'Empezando tú / el rival',
          escapeHtml(`${pct(c.primero.g, c.primero.total)} / ${pct(c.segundo.g, c.segundo.total)}`),
          escapeHtml(`Juegos ganados: ${c.primero.g} de ${c.primero.total} empezando tú, ${c.segundo.g} de ${c.segundo.total} empezando el rival`)
        )
      : '',
  ]
}

// ── Los gráficos (tanda 628) ──
//
// Se miden con el ancho de su caja, así que solo se pueden pintar con la
// pestaña A LA VISTA (escondida, la caja mide 0): si no lo está, se dejan
// pendientes y se pintan al abrirla. Y se repintan si cambia el ancho.
let ultimasJugadas = []
let anchoPintado = 0

function filaBarraHtml({ nombre, sprites = '', c }) {
  const pctNum = c.pct === null ? null : Math.round(c.pct * 100)
  const rec = `${c.ganadas}-${c.perdidas}${c.empatadas ? `-${c.empatadas}` : ''}`
  return `
    <li class="partidas-enf">
      <span class="partidas-enf-rival">${sprites}<span>${escapeHtml(nombre)}</span></span>
      <span class="partidas-enf-barra${claseDeCasilla(c)}" role="img" aria-label="${pctNum ?? 0}% de victorias">
        <span style="width:${pctNum ?? 0}%"></span>
      </span>
      <span class="partidas-enf-record">${rec}</span>
      <span class="partidas-enf-pct">${pctNum === null ? '—' : pctNum + '%'}</span>
    </li>`
}

function bloqueGrafico(titulo, cuerpo, { leyenda = '', nota = '' } = {}) {
  return `<section class="partidas-graf-bloque">
      <h3 class="partidas-graf-titulo">${titulo}</h3>
      ${leyenda}
      ${cuerpo}
      ${nota ? `<p class="subtext">${nota}</p>` : ''}
    </section>`
}

const LEYENDA_RESULTADOS = `<p class="partidas-graf-leyenda"><span class="graf-muestra graf-v"></span>Victorias <span class="graf-muestra graf-e"></span>Empates <span class="graf-muestra graf-d"></span>Derrotas</p>`

function pintarGraficos() {
  const caja = $('partidasGraficos')
  const ancho = caja.clientWidth
  if (!ancho) return // escondida: se pinta al abrir la pestaña
  anchoPintado = ancho
  const jugadas = ultimasJugadas
  if (!jugadas.length) {
    caja.innerHTML = ''
    return
  }
  const f = filtrosDeStats()
  const { desde, hasta } = rangoDePeriodo(f.periodo, hoyLocal(), f.desde, f.hasta)
  const serie = porPeriodo(jugadas, { desde, hasta })
  const unidadTexto = { dia: 'día', semana: 'semana', mes: 'mes' }[serie.unidad]
  const anchoGraf = Math.max(240, ancho - 2 * 16 - 2)
  const evol = graficoEvolucion(serie.cubos, { ancho: anchoGraf, unidad: serie.unidad })
  const barras = graficoBarras(serie.cubos, { ancho: anchoGraf })
  const semana = graficoBarras(porDiaDeLaSemana(jugadas), { ancho: anchoGraf, todasLasEtiquetas: true })
  const lista = (filas) => `<ul class="partidas-enfrentamientos">${filas.join('')}</ul>`
  const grupos = (clave, nombre, conSprites = true, max = 10) =>
    porGrupo(jugadas, (p) => p[clave], (p) => p[nombre])
      .filter((g) => g.clave !== 'sin-mazo')
      .slice(0, max)
      .map((g) => filaBarraHtml({ nombre: g.nombre, sprites: conSprites ? spritesDeMazoHtml(g.nombre, g.clave) : '', c: g }))
  const guardados = porGrupo(jugadas.filter((p) => p.mazoGuardado), (p) => p.mazoGuardado, (p) => mazosGuardados.find((m) => m.id === p.mazoGuardado)?.name || 'Un mazo que ya no está en tu lista').map((g) => filaBarraHtml({ nombre: g.nombre, c: g }))
  const rivales = grupos('rival', 'rivalNombre')
  const totalRivales = new Set(jugadas.map((p) => p.rival).filter((r) => r && r !== 'sin-mazo')).size

  caja.innerHTML = [
    bloqueGrafico(
      'Tus victorias en el tiempo',
      evol.svg ? `<div class="partidas-graf">${evol.svg}</div>` : `<p class="subtext">${escapeHtml(evol.vacio)}</p>`,
      { leyenda: evol.svg ? `<p class="partidas-graf-leyenda"><span class="graf-muestra graf-muestra-punto"></span>Cada ${unidadTexto} <span class="graf-muestra graf-muestra-linea"></span>Acumulado</p>` : '' }
    ),
    bloqueGrafico(`Partidas por ${unidadTexto}`, barras.svg ? `<div class="partidas-graf">${barras.svg}</div>` : `<p class="subtext">${escapeHtml(barras.vacio)}</p>`, { leyenda: barras.svg ? LEYENDA_RESULTADOS : '' }),
    bloqueGrafico('Por día de la semana', semana.svg ? `<div class="partidas-graf">${semana.svg}</div>` : `<p class="subtext">${escapeHtml(semana.vacio)}</p>`, { leyenda: semana.svg ? LEYENDA_RESULTADOS : '' }),
    bloqueGrafico('Con cada mazo tuyo', lista(grupos('mio', 'mioNombre'))),
    guardados.length ? bloqueGrafico('Con cada mazo guardado', lista(guardados)) : '',
    rivales.length ? bloqueGrafico('Contra qué mazos', lista(rivales), { nota: totalRivales > rivales.length ? `Los ${rivales.length} que más te han salido, de ${totalRivales}.` : '' }) : '',
    bloqueGrafico('Dónde juegas', lista(grupos('donde', 'donde', false))),
  ].join('')
}

// El cartel de los gráficos: uno para todos, siguiendo al dedo o al ratón.
function montarCartel() {
  const caja = $('partidasGraficos')
  const cartel = document.createElement('div')
  cartel.className = 'partidas-cartel hidden'
  cartel.setAttribute('role', 'status')
  document.body.appendChild(cartel)
  const ensenar = (e) => {
    const marca = e.target.closest?.('[data-tip]')
    if (!marca || !caja.contains(marca)) return cartel.classList.add('hidden')
    cartel.textContent = marca.dataset.tip
    cartel.classList.remove('hidden')
    const r = cartel.getBoundingClientRect()
    const x = Math.min(window.innerWidth - r.width - 8, Math.max(8, e.clientX - r.width / 2))
    const y = e.clientY - r.height - 12 < 8 ? e.clientY + 16 : e.clientY - r.height - 12
    cartel.style.left = `${x + window.scrollX}px`
    cartel.style.top = `${y + window.scrollY}px`
  }
  caja.addEventListener('pointermove', ensenar)
  caja.addEventListener('pointerdown', ensenar)
  caja.addEventListener('pointerleave', () => cartel.classList.add('hidden'))
  window.addEventListener('scroll', () => cartel.classList.add('hidden'), { passive: true })
  // Si cambia el ancho (girar el móvil, estrechar la ventana), se vuelven
  // a medir.
  if ('ResizeObserver' in window) {
    let t = null
    new ResizeObserver(() => {
      clearTimeout(t)
      t = setTimeout(() => {
        // Solo si ya estaban pintados: el primer pintado (de 0 a algo, al
        // abrir la pestaña) lo hace el clic en la pestaña, y que lo hagan
        // los dos es una guarda que tapa a la otra.
        if (anchoPintado && caja.clientWidth && caja.clientWidth !== anchoPintado) pintarGraficos()
      }, 150)
    }).observe(caja)
  }
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
  // Sin resultado no se guarda: «Ganada» por defecto era apuntar una
  // victoria que nadie había marcado.
  if (tipoElegido === 'normal' && !$('partidaResultado').value) {
    showToast(formatoElegido === 'bo3' ? 'Marca al menos el primer juego.' : 'Marca si la ganaste, la perdiste o empataste.', 'error')
    return
  }
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
    // Los juegos van con la partida si la base tiene dónde (tanda 632); lo
    // que no se jugó (ID, no presentado, bye) no tiene juegos.
    ...(juegosEnBase ? (tipoElegido === 'normal' ? aColumnas(formatoElegido, juegosElegidos) : { formato: null, juegos: null, salida: null }) : {}),
    tipo: tipoElegido,
    donde: rondaPara ? rondaPara.nombre : dondeElegido(),
    notas: $('partidaNotas').value.trim() || null,
  }
  // El mazo guardado (tanda 627): solo en una suelta, y solo si la base ya
  // tiene la columna — antes de la migración, mandarla haría fallar todo.
  if (vinculoMazo && !rondaPara) fila.user_deck_id = $('partidaMazoGuardado').value || null
  if (rondaPara) {
    fila.torneo_id = rondaPara.id
    fila.jugada_el = rondaPara.jugado_el
  } else if (editando) {
    // Una suelta editada conserva SU fecha si el campo viene vacío: no
    // se le pone la de hoy por haberla abierto para cambiar una nota.
    const fecha = $('partidaFecha').value || editando.fecha
    if (fecha) fila.jugada_el = fecha
  } else {
    const fecha = $('partidaFecha').value
    if (fecha) fila.jugada_el = fecha
  }

  // Editando se ACTUALIZA la fila; apuntando se inserta. El user_id no
  // se toca al actualizar: es de quien era, y la política de la base
  // solo deja tocar lo propio de todas formas.
  const { user_id, ...cambios } = fila
  const { error } = editando
    ? await supabase.from('match_log').update(cambios).eq('id', editando.id)
    : await supabase.from('match_log').insert(fila)
  if (error) {
    showToast('No se ha podido guardar: ' + error.message, 'error')
    return
  }

  if (editando) {
    // Al editar, el formulario se CIERRA: se vino a arreglar una cosa
    // concreta, no a seguir metiendo.
    showToast('Cambios guardados.', 'success')
    cerrarFormPartida()
    await cargar()
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
  ponerJuegos(formatoElegido, [])
  await cargar()
}

// ── El formulario de partida, en sus dos modos ──
//
// El mismo formulario apunta una partida SUELTA (todo a la vista) o una
// RONDA de un torneo apuntado (el mazo, la fecha y el dónde se esconden
// porque vienen del torneo).
function abrirFormPartida(torneo = null, partida = null) {
  rondaPara = torneo
  editando = partida
  const esRonda = Boolean(torneo)
  $('partidaFormTitulo').textContent = partida
    ? esRonda
      ? 'Editar ronda'
      : 'Editar partida'
    : esRonda
      ? 'Añadir ronda'
      : 'Apuntar una partida suelta'
  $('partidaFormPista').classList.toggle('hidden', esRonda)
  $('partidaCamposMios').classList.toggle('hidden', esRonda)
  $('partidaCampoFecha').classList.toggle('hidden', esRonda)
  $('partidaCampoDonde').classList.toggle('hidden', esRonda)
  $('partidaDondeOtroCampo').classList.toggle('hidden', esRonda || $('partidaDonde').value !== '__otro')
  // En una ronda ya lo esconde su bloque (#partidaCamposMios, el de «Tu
  // mazo»): el mazo de una ronda es el del torneo.
  $('partidaCampoMazoGuardado').classList.toggle('hidden', !vinculoMazo)
  pintarSelectMazoGuardado($('partidaMazoGuardado'), partida?.mazoGuardado || null)
  $('torneoLogForm').classList.add('hidden')
  $('partidaForm').classList.remove('hidden')
  if (esRonda) {
    // El formulario se MUDA dentro de la tarjeta del torneo, como el
    // inline de trainingcourt: repintar crea el hueco y lo mete.
    torneosAbiertos.add(torneo.id)
    pintarTorneos()
  }
  $('btnGuardarPartida').textContent = partida ? 'Guardar cambios' : 'Guardar'
  if (partida) rellenarFormConPartida(partida, esRonda)
  else limpiarFormPartida(esRonda)

  $('partidaForm').scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  ;$(esRonda ? 'selRival1' : 'selMio1').querySelector('input')?.focus()
}

// ── El mazo guardado (tanda 627) ──

// Las opciones de un desplegable de mazos guardados. Sin ninguno, el
// desplegable se queda apagado y al lado sale a dónde ir a guardar uno.
function pintarSelectMazoGuardado(sel, actual = null) {
  const ops = opcionesDeMazosGuardados(mazosGuardados, actual)
  sel.innerHTML = '<option value="">Ninguno</option>' + ops.map((o) => `<option value="${escapeHtml(o.id)}">${escapeHtml(o.nombre)}</option>`).join('')
  sel.value = actual || ''
  sel.disabled = !ops.length
  const pista = sel.closest('label')?.querySelector('.partidas-sin-mazos')
  if (pista) pista.classList.toggle('hidden', ops.length > 0)
}

// Las cartas de los mazos guardados, para deducir de qué arquetipo es
// cada uno: una vez por carta y por visita.
const filasDeCartas = new Map()
async function arquetipoDeGuardado(id) {
  const m = mazosGuardados.find((x) => x.id === id)
  if (!m) return null
  const faltan = [...new Set((m.cards || []).map((c) => c?.id).filter((x) => x && !filasDeCartas.has(x)))]
  if (faltan.length) {
    const { data, error } = await supabase.from('tcg_cards').select('id,name,category').in('id', faltan)
    if (error) return null
    for (const f of data || []) filasDeCartas.set(f.id, f)
  }
  return arquetipoDeMazoGuardado(m.cards, (x) => filasDeCartas.get(x), catalogo)
}

// Al elegir un mazo guardado con «Tu mazo» vacío, se rellena con el
// arquetipo de ese mazo: es lo que se jugó. Si ya habías puesto uno, se
// respeta — puede que lo nombres de otra manera a propósito.
async function alElegirMazoGuardado() {
  const id = $('partidaMazoGuardado').value
  if (!id || selectores.mio1?.valor() || selectores.mio2?.valor()) return
  const arq = await arquetipoDeGuardado(id)
  if (arq && !selectores.mio1?.valor()) ponerMazoEnSelector('mio1', 'mio2', claveDeArquetipo(arq), arq.nombre)
}

// Un mazo guardado vuelve al selector ENTERO en el primero de los dos
// campos, no repartido entre los dos.
//
// Se guarda el nombre ya junto («Dragapult Dusknoir») y partirlo otra
// vez sería adivinar por dónde. Puesto entero, `mazoDe()` reconstruye
// EXACTAMENTE la misma clave (`d:dragapult dusknoir`), así que la
// partida no se cambia de casilla en la matriz por haberla editado —
// que es justo lo que no puede pasar.
function ponerMazoEnSelector(sel1, sel2, clave, nombre) {
  const primero = selectores[sel1]
  const segundo = selectores[sel2]
  segundo?.limpiar()
  if (!primero) return
  if (!nombre) {
    primero.limpiar()
    return
  }
  const dex = dexesDeNombre(nombre)[0]
  primero.poner({
    valor: clave,
    nombre,
    sprite: dex ? urlDeSprite(dex) : spriteDeCarta(nombre) || spriteDeObjeto(nombre) || null,
  })
}

function rellenarFormConPartida(p, esRonda) {
  if (!esRonda) {
    ponerMazoEnSelector('mio1', 'mio2', p.mio, p.mioNombre)
    $('partidaFecha').value = p.fecha || ''
    // El «dónde» guardado puede no estar en la lista (se escribió a
    // mano): se cae a «Otro…» con el texto puesto, que es donde estaba.
    const sel = $('partidaDonde')
    const hay = [...sel.options].some((o) => o.value === p.donde)
    sel.value = hay ? p.donde : '__otro'
    $('partidaDondeOtro').value = hay ? '' : p.donde || ''
    $('partidaDondeOtroCampo').classList.toggle('hidden', hay)
  }
  ponerMazoEnSelector('rival1', 'rival2', p.rival, p.tipo === 'bye' ? '' : p.rivalNombre)
  // Una partida de antes, sin juegos, se abre al mejor de uno con su
  // resultado marcado: es lo que se apuntó.
  const letra = { win: 'W', loss: 'L', draw: 'T' }[p.resultado]
  ponerJuegos(p.juegos?.length ? p.formato : 'bo1', p.juegos?.length ? p.juegos : letra ? [{ r: letra, s: null }] : [])
  $('partidaNotas').value = p.notas || ''
  marcarTipo(p.tipo || 'normal')
}

// ── Los juegos, uno a uno (tanda 632) ──
//
// Al mejor de uno, tres botones; al mejor de tres, una fila por juego con
// quién lo ganó y quién empezó, y la fila siguiente sale al marcar la
// anterior —como en trainingcourt—, hasta que la partida está decidida.
// El resultado de la partida no se elige: sale de los juegos.
const CLAVE_FORMATO = 'pokedoc-partidas-formato'
const PALABRA_JUEGO = { W: 'Ganado', L: 'Perdido', T: 'Empate' }
const PALABRA_PARTIDA = { W: 'Ganada', L: 'Perdida', T: 'Empate' }
const LETRA_JUEGO = { W: 'V', L: 'D', T: 'E' }
const CLASE_JUEGO = { W: 'win', L: 'loss', T: 'draw' }

function formatoRecordado(esRonda) {
  try {
    const f = localStorage.getItem(`${CLAVE_FORMATO}-${esRonda ? 'ronda' : 'suelta'}`)
    if (f === 'bo1' || f === 'bo3') return f
  } catch {}
  return esRonda ? 'bo3' : 'bo1'
}

function recordarFormato(f) {
  try {
    localStorage.setItem(`${CLAVE_FORMATO}-${rondaPara ? 'ronda' : 'suelta'}`, f)
  } catch {}
}

function ponerJuegos(formato, juegos) {
  formatoElegido = formato === 'bo3' && juegosEnBase ? 'bo3' : 'bo1'
  juegosElegidos = recortar(formatoElegido, juegos)
  pintarJuegos()
}

function pintarJuegos() {
  const bo3 = formatoElegido === 'bo3'
  $('partidaFormato').classList.toggle('hidden', !juegosEnBase)
  document.querySelectorAll('#partidaFormato [data-formato]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.formato === formatoElegido)))
  const filas = filasVisibles(formatoElegido, juegosElegidos)
  const botones = (i, j) =>
    ['W', 'L', 'T']
      .map((r) => {
        const texto = bo3 ? LETRA_JUEGO[r] : PALABRA_PARTIDA[r]
        const etiqueta = bo3 ? `Juego ${i + 1}: ${PALABRA_JUEGO[r].toLowerCase()}` : PALABRA_PARTIDA[r]
        return `<button type="button" class="partidas-juego-r partidas-juego-${CLASE_JUEGO[r]}" data-juego="${i}" data-r="${r}" aria-pressed="${j?.r === r}" aria-label="${etiqueta}"${bo3 ? ` title="${PALABRA_JUEGO[r]}"` : ''}>${texto}</button>`
      })
      .join('')
  // Quién empezó: solo con la base al día (se guarda en `salida`).
  const salida = (i, j) =>
    juegosEnBase
      ? `<span class="partidas-juego-salida" role="group" aria-label="${bo3 ? `Juego ${i + 1}: quién empezó` : 'Quién empezó'}">
           <span class="subtext">Empieza</span>
           <button type="button" data-juego="${i}" data-s="1" aria-pressed="${j?.s === '1'}">Tú</button>
           <button type="button" data-juego="${i}" data-s="2" aria-pressed="${j?.s === '2'}">Rival</button>
         </span>`
      : ''
  $('partidaJuegos').innerHTML = Array.from({ length: filas }, (_, i) => {
    const j = juegosElegidos[i] || null
    return `<div class="partidas-juego${bo3 ? '' : ' partidas-juego-unico'}">
        ${bo3 ? `<span class="partidas-juego-num">Juego ${i + 1}</span>` : ''}
        <span class="partidas-juego-botones">${botones(i, j)}</span>
        ${salida(i, j)}
      </div>`
  }).join('')
  const res = resultadoDeJuegos(formatoElegido, juegosElegidos)
  $('partidaResultado').value = res || ''
  const palabra = { win: 'Ganada', loss: 'Perdida', draw: 'Empate' }[res]
  $('partidaMarcador').innerHTML = bo3 && juegosElegidos.length
    ? `<strong class="partidas-ronda-res partidas-ronda-${res}">${LETRA_RESULTADO[res]}</strong> ${escapeHtml(textoMarcador(juegosElegidos))} · ${palabra}${decidida('bo3', juegosElegidos) ? '' : ' <span class="subtext">(si se acabó el tiempo, guárdala así)</span>'}`
    : ''
}

function marcarJuego(boton) {
  const i = Number(boton.dataset.juego)
  const js = juegosElegidos.map((j) => ({ ...j }))
  while (js.length <= i) js.push({ r: null, s: null })
  if (boton.dataset.r) {
    // Volver a tocar el marcado lo quita (y con él los de detrás).
    if (js[i].r === boton.dataset.r) js.splice(i)
    else js[i].r = boton.dataset.r
  } else js[i].s = js[i].s === boton.dataset.s ? null : boton.dataset.s
  const antes = recortar(formatoElegido, juegosElegidos).length
  const hechos = recortar(formatoElegido, js)
  // Quién empezó se puede marcar ANTES que el resultado (se sabe al
  // empezar el juego): la fila siguiente lo guarda sin contar como jugada.
  const siguiente = js[hechos.length]
  juegosElegidos = siguiente && !siguiente.r && siguiente.s && hechos.length < filasVisibles(formatoElegido, hechos) ? [...hechos, { r: null, s: siguiente.s }] : hechos
  pintarJuegos()
  // Al marcar un juego nuevo, el foco va al siguiente: se rellena de
  // corrido con el teclado igual que con el dedo.
  const sig = boton.dataset.r && hechos.length > antes ? document.querySelector(`#partidaJuegos [data-juego="${hechos.length}"][data-r="W"]`) : null
  ;(sig || document.querySelector(`#partidaJuegos [data-juego="${i}"][data-${boton.dataset.r ? 'r' : 's'}="${boton.dataset.r || boton.dataset.s}"]`))?.focus()
}

const NOTA_TIPO = {
  id: 'Cuenta como empate en la matriz: se llegó a jugar lo justo para pactarlo.',
  no_show: 'Cuenta como victoria, pero NO entra en la matriz: no llegaste a jugar contra ese mazo.',
  bye: 'No entra en la matriz ni hace falta decir el mazo rival: no hubo enfrentamiento.',
}

// Marcar el tipo de ronda. Sale de los botones a una función propia
// (tanda 251) porque al EDITAR hay que dejar el formulario como estaba,
// y eso es exactamente lo mismo que hace un clic.
function marcarTipo(tipo) {
  tipoElegido = tipo || 'normal'
  document.querySelectorAll('.partidas-tipo').forEach((x) => x.classList.toggle('activo', x.dataset.tipo === tipoElegido))
  // El resultado solo se elige cuando se jugó de verdad: en los demás
  // casos lo decide el tipo, y enseñarlo invitaría a contradecirse.
  $('partidaCampoResultado').classList.toggle('hidden', tipoElegido !== 'normal')
  const nota = $('partidaTipoNota')
  nota.textContent = NOTA_TIPO[tipoElegido] || ''
  nota.classList.toggle('hidden', !NOTA_TIPO[tipoElegido])
}

function limpiarFormPartida(esRonda) {
  selectores.rival1?.limpiar()
  selectores.rival2?.limpiar()
  if (!esRonda) {
    selectores.mio1?.limpiar()
    selectores.mio2?.limpiar()
  }
  $('partidaNotas').value = ''
  marcarTipo('normal')
  // El formato se queda el que se usa en ese sitio: las rondas de un
  // torneo suelen ser al mejor de tres y las sueltas (TCG Live) al de uno.
  ponerJuegos(juegosEnBase ? formatoRecordado(esRonda) : 'bo1', [])
}

function cerrarFormPartida() {
  rondaPara = null
  editando = null
  const form = $('partidaForm')
  form.classList.add('hidden')
  // De vuelta a su sitio de la pestaña de sueltas si estaba de mudanza.
  if (!$('vista-sueltas').contains(form)) $('vista-sueltas').insertBefore(form, $('partidasLista'))
}

// ── Apuntar desde una repetición (tanda 627) ──
//
// Tus repeticiones guardadas que aún no están en Mis partidas: eliges cuál
// de los dos eras y con qué mazo guardado jugaste, y se apunta como una
// partida suelta con su enlace a la repetición. Lo mismo que hace
// /repeticiones al guardarla, para las que se guardaron sin apuntar.

// Quién eras en tus repeticiones: el mismo recuerdo que usa /repeticiones.
const CLAVE_YO = 'pokedoc-repeticion-yo'
function yoRecordado() {
  try {
    return localStorage.getItem(CLAVE_YO) || null
  } catch {
    return null
  }
}

const fechaDe = (iso) => (iso ? String(iso).slice(0, 10) : '')

function pintarDesdeRepeticion(elegida = null) {
  const caja = $('desdeRepForm')
  const libres = repeticionesSinApuntar(repeticionesMias, todas)
  const cerrar = '<button type="button" class="btn-secondary" data-cerrar-desde-rep>Cancelar</button>'
  if (!libres.length) {
    caja.innerHTML = `<h3>Apuntar desde una repetición</h3>
      <p class="subtext">${repeticionesMias.length ? 'Todas tus repeticiones guardadas ya están apuntadas.' : 'Todavía no tienes repeticiones guardadas.'} En Repeticiones pegas el registro de una partida de TCG Live y la guardas; al guardarla también se puede apuntar aquí.</p>
      <div class="partidas-form-fila"><a class="btn-primary" href="/repeticiones">Ir a Repeticiones</a>${cerrar}</div>`
    return
  }
  const rep = libres.find((r) => r.id === elegida) || libres[0]
  const recordado = yoRecordado()
  const yo = [rep.jugador_a, rep.jugador_b].includes(recordado) ? recordado : ''
  const jugador = (j) =>
    j
      ? `<label class="partidas-quien-opcion"><input type="radio" name="desdeRepYo" value="${escapeHtml(j)}"${j === yo ? ' checked' : ''} />
          <strong>${escapeHtml(j)}</strong> <span class="subtext">${escapeHtml(mazoDeJugador(rep, j) || 'mazo sin identificar')}${rep.ganador === j ? ' · ganó' : ''}</span></label>`
      : ''
  const sinGanador = rep.ganador
    ? ''
    : `<fieldset class="partidas-quien" id="desdeRepResultado">
        <legend>La repetición no dice quién ganó. ¿Cómo acabó para ti?</legend>
        ${[['win', 'La gané'], ['loss', 'La perdí'], ['draw', 'Empate']].map(([v, t]) => `<label class="partidas-quien-opcion"><input type="radio" name="desdeRepRes" value="${v}" /> ${t}</label>`).join('')}
      </fieldset>`
  caja.innerHTML = `<h3>Apuntar desde una repetición</h3>
    <p class="subtext">Se apunta como partida suelta de TCG Live, con el enlace a su repetición.</p>
    <div class="partidas-form-fila">
      <label>Repetición
        <select id="desdeRepSel">${libres.map((r) => `<option value="${escapeHtml(r.id)}"${r.id === rep.id ? ' selected' : ''}>${escapeHtml(r.titulo || 'Repetición')}${r.created_at ? ` · ${escapeHtml(fechaDe(r.created_at))}` : ''}</option>`).join('')}</select>
      </label>
      <label>Fecha <input type="date" id="desdeRepFecha" value="${escapeHtml(fechaDe(rep.created_at))}" /></label>
    </div>
    <fieldset class="partidas-quien">
      <legend>¿Cuál de los dos eras?</legend>
      ${jugador(rep.jugador_a)}${jugador(rep.jugador_b)}
    </fieldset>
    ${sinGanador}
    <div class="partidas-form-fila">
      <label>Con tu mazo guardado
        <select id="desdeRepMazo"></select>
        <span class="subtext partidas-sin-mazos hidden">Aún no tienes ninguno: se guardan en el <a href="/constructor">constructor</a>.</span>
      </label>
    </div>
    <div class="partidas-form-fila">
      <button type="button" class="btn-primary" id="btnGuardarDesdeRep">Apuntar</button>
      ${cerrar}
    </div>`
  pintarSelectMazoGuardado(caja.querySelector('#desdeRepMazo'))
}

function abrirDesdeRepeticion() {
  cerrarFormPartida()
  const caja = $('desdeRepForm')
  caja.classList.remove('hidden')
  pintarDesdeRepeticion()
  caja.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
}

function cerrarDesdeRepeticion() {
  $('desdeRepForm').classList.add('hidden')
  $('desdeRepForm').innerHTML = ''
}

async function guardarDesdeRepeticion(boton) {
  const caja = $('desdeRepForm')
  const rep = repeticionesMias.find((r) => r.id === caja.querySelector('#desdeRepSel')?.value)
  const yo = caja.querySelector('[name=desdeRepYo]:checked')?.value || ''
  const resultado = resultadoDeRepeticion(rep, yo) || caja.querySelector('[name=desdeRepRes]:checked')?.value || null
  if (!rep) return
  if (!yo) return showToast('Dinos cuál de los dos eras.', 'error')
  if (!resultado) return showToast('Dinos cómo acabó.', 'error')
  const mazo = caja.querySelector('#desdeRepMazo')?.value || null
  boton.disabled = true
  try {
    const arq = mazo ? await arquetipoDeGuardado(mazo) : null
    const fila = partidaDesdeRepeticion({
      rep, yo, resultado, catalogo,
      userId: session.user.id,
      mazoGuardado: mazo,
      arqGuardado: arq,
      fecha: caja.querySelector('#desdeRepFecha')?.value || null,
      conVinculo: vinculoMazo,
    })
    const { error } = await supabase.from('match_log').insert(fila)
    if (error) {
      showToast(error.code === '23505' ? 'Esa repetición ya está apuntada.' : 'No se ha podido apuntar: ' + error.message, 'error')
      return
    }
    try {
      localStorage.setItem(CLAVE_YO, yo)
    } catch {
      /* sin almacenamiento, la próxima vez se vuelve a preguntar */
    }
    showToast('Partida apuntada.', 'success')
    cerrarDesdeRepeticion()
    await cargar()
  } finally {
    boton.disabled = false
  }
}

// ── Apuntar un torneo ──

function dondeTorneoElegido() {
  const sel = $('torneoLogDonde').value
  if (sel !== '__otro') return sel
  return $('torneoLogDondeOtro').value.trim() || null
}

// El formulario del torneo, en sus dos modos: crear uno nuevo o EDITAR
// uno ya apuntado (tanda 251, pedido por PINGU: «debería poder editar
// cada ronda e incluso mi mazo, por si no lo he puesto bien»).
function abrirFormTorneo(torneo = null) {
  editandoTorneo = torneo
  cerrarFormPartida()
  const caja = $('torneoLogForm')
  caja.classList.remove('hidden')
  $('torneoLogTitulo').textContent = torneo ? 'Editar el torneo' : 'Apuntar un torneo de fuera'
  $('torneoLogPista').classList.toggle('hidden', Boolean(torneo))
  $('torneoLogAviso').classList.toggle('hidden', !torneo)
  $('btnGuardarTorneoLog').textContent = torneo ? 'Guardar cambios' : 'Crear torneo'

  $('torneoLogNombre').value = torneo?.nombre || ''
  $('torneoLogFecha').value = torneo?.jugado_el || new Date().toISOString().slice(0, 10)
  // El «dónde» guardado puede no estar en la lista (se escribió a mano).
  const sel = $('torneoLogDonde')
  const hay = [...sel.options].some((o) => o.value === torneo?.donde)
  sel.value = torneo ? (hay ? torneo.donde : '__otro') : sel.options[0].value
  $('torneoLogDondeOtro').value = torneo && !hay ? torneo.donde || '' : ''
  $('torneoLogDondeOtroCampo').classList.toggle('hidden', sel.value !== '__otro')
  ponerMazoEnSelector('tmio1', 'tmio2', torneo?.mi_mazo, torneo?.mi_mazo_nombre)

  caja.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  $('torneoLogNombre').focus()
}

async function guardarTorneoLog() {
  const nombre = $('torneoLogNombre').value.trim()
  const mazo = mazoDe('tmio1', 'tmio2')
  if (!nombre || !mazo) {
    showToast(nombre ? 'Elige el mazo que jugaste.' : 'Ponle nombre al torneo.', 'error')
    return
  }
  const campos = {
    nombre,
    donde: dondeTorneoElegido(),
    mi_mazo: mazo.clave,
    mi_mazo_nombre: mazo.nombre,
  }
  const fecha = $('torneoLogFecha').value
  if (fecha) campos.jugado_el = fecha

  if (editandoTorneo) {
    // Las RONDAS no se tocan desde aquí a propósito: de arrastrarles el
    // mazo, el nombre y la fecha se encarga un disparador de la base
    // (supabase-migration-partidas-editar.sql), y así las dos escrituras
    // pasan juntas o no pasa ninguna. Hacerlo con dos peticiones desde
    // el navegador dejaría el histórico a medias si fallara la segunda.
    const { error } = await supabase.from('match_log_torneos').update(campos).eq('id', editandoTorneo.id)
    if (error) {
      showToast('No se ha podido guardar: ' + error.message, 'error')
      return
    }
    showToast('Torneo actualizado. Sus rondas se han puesto al día solas.', 'success')
    cerrarFormTorneo()
    await cargar()
    return
  }

  // El insert devuelve la fila para abrir «añadir ronda» al momento:
  // quien crea el torneo viene a apuntar sus rondas, no a mirar.
  const { data, error } = await supabase
    .from('match_log_torneos')
    .insert({ user_id: session.user.id, ...campos })
    .select()
    .single()
  if (error) {
    showToast('No se ha podido crear: ' + error.message, 'error')
    return
  }
  showToast('Torneo creado: ahora sus rondas.', 'success')
  cerrarFormTorneo()
  await cargar()
  abrirFormPartida(data)
}

function cerrarFormTorneo() {
  editandoTorneo = null
  $('torneoLogForm').classList.add('hidden')
  $('torneoLogNombre').value = ''
  selectores.tmio1?.limpiar()
  selectores.tmio2?.limpiar()
}

// Cerrar o reabrir un torneo apuntado. Cerrar no toca ningún dato: solo
// deja de ofrecer «añadir ronda» y «editar». Por eso reabrir es gratis y
// no hay que confirmar nada — no se pierde nada en ninguna de las dos
// direcciones.
async function cambiarCierre(id, cerrar) {
  const { error } = await supabase
    .from('match_log_torneos')
    .update({ cerrado_el: cerrar ? new Date().toISOString() : null })
    .eq('id', id)
  if (error) {
    showToast('No se ha podido: ' + error.message, 'error')
    return
  }
  // Si se estaba apuntando o editando una ronda de ESE torneo, el
  // formulario se va con él: al cerrarlo ya no tiene dónde vivir.
  if (cerrar && (rondaPara?.id === id || editando?.torneoId === id)) cerrarFormPartida()
  // Al cerrarlo se pliega, que es lo que uno quiere después de decir
  // «ya está»; al reabrirlo se deja abierto para poder arreglar.
  if (cerrar) torneosAbiertos.delete(id)
  else torneosAbiertos.add(id)
  showToast(cerrar ? 'Torneo cerrado.' : 'Torneo reabierto: ya puedes arreglar lo que haga falta.', 'success')
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

// Tus mazos guardados, tus repeticiones y si la base ya enlaza una partida
// con un mazo (tanda 627). Cada una falla por su lado: sin mazos o sin
// repeticiones, la página sigue siendo la de siempre.
async function cargarMazosYRepeticiones() {
  const yo = session.user.id
  const [mazos, reps, sonda, sondaJuegos] = await Promise.all([
    supabase.from('user_decks').select('id,name,cards,updated_at').eq('user_id', yo).order('updated_at', { ascending: false }),
    supabase.from('replays').select('id,titulo,jugador_a,jugador_b,ganador,mazo_a,mazo_b,turnos,created_at').eq('user_id', yo).order('created_at', { ascending: false }).limit(500),
    // Pedirla por su nombre falla entera si la columna no existe (42703):
    // así se sabe si la migración está puesta sin tocar nada.
    supabase.from('match_log').select('user_deck_id').limit(1),
    // Y lo mismo para los juegos (tanda 632).
    supabase.from('match_log').select('formato').limit(1),
  ])
  mazosGuardados = mazos.error ? [] : mazos.data || []
  repeticionesMias = reps.error ? [] : reps.data || []
  vinculoMazo = !sonda.error
  juegosEnBase = !sondaJuegos.error
}

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
  const [{ data }] = await Promise.all([
    supabase.from('tcg_archetypes').select('*').eq('activo', true),
    cargarMazosYRepeticiones(),
  ])
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

  document.querySelectorAll('.partidas-tipo').forEach((b) =>
    b.addEventListener('click', () => marcarTipo(b.dataset.tipo))
  )

  // Las tres vistas, como las pestañas del perfil.
  document.querySelectorAll('#partidasTabs .tab-btn').forEach((btn) =>
    btn.addEventListener('click', () => {
      document.querySelectorAll('#partidasTabs .tab-btn').forEach((b) => b.classList.toggle('active', b === btn))
      for (const v of ['torneos', 'sueltas', 'stats']) {
        $(`vista-${v}`).classList.toggle('active', v === btn.dataset.vista)
      }
      // Los gráficos se miden al verse (escondidos, su caja mide 0).
      if (btn.dataset.vista === 'stats') pintarGraficos()
    })
  )

  $('btnApuntarPartida').addEventListener('click', () => {
    // Si ya está abierto en modo suelto, el botón lo cierra; si está en
    // modo ronda, lo pasa a suelto.
    if (!$('partidaForm').classList.contains('hidden') && !rondaPara) cerrarFormPartida()
    else abrirFormPartida(null)
  })
  $('btnCancelarPartida').addEventListener('click', cerrarFormPartida)
  $('partidaMazoGuardado').addEventListener('change', () => alElegirMazoGuardado().catch(() => {}))
  $('btnDesdeRepeticion').addEventListener('click', () => {
    if (!$('desdeRepForm').classList.contains('hidden')) cerrarDesdeRepeticion()
    else abrirDesdeRepeticion()
  })
  $('desdeRepForm').addEventListener('change', (e) => {
    if (e.target.id === 'desdeRepSel') pintarDesdeRepeticion(e.target.value)
  })
  $('desdeRepForm').addEventListener('click', (e) => {
    if (e.target.closest('[data-cerrar-desde-rep]')) cerrarDesdeRepeticion()
    const b = e.target.closest('#btnGuardarDesdeRep')
    if (b) guardarDesdeRepeticion(b)
  })
  for (const id of ['torneoBuscar', 'torneoEstado']) {
    $(id)?.addEventListener('input', () => {
      verTodosLosTorneos = false
      pintarTorneos()
    })
  }

  $('btnGuardarPartida').addEventListener('click', guardarPartida)
  $('partidaJuegos').addEventListener('click', (e) => {
    const b = e.target.closest('[data-juego]')
    if (b) marcarJuego(b)
  })
  $('partidaFormato').addEventListener('click', (e) => {
    const b = e.target.closest('[data-formato]')
    if (!b || b.dataset.formato === formatoElegido) return
    recordarFormato(b.dataset.formato)
    // Lo marcado se conserva: el juego 1 de un Bo1 es el juego 1 del Bo3.
    ponerJuegos(b.dataset.formato, juegosElegidos)
  })

  // El formulario de torneo.
  $('torneoLogFecha').value = new Date().toISOString().slice(0, 10)
  $('btnApuntarTorneo').addEventListener('click', () => {
    // Si estaba abierto EDITANDO, este botón lo devuelve a «crear uno
    // nuevo» en vez de cerrarlo: si no, había que cerrarlo y volver a
    // abrirlo para entender qué estaba pasando.
    if (!$('torneoLogForm').classList.contains('hidden') && !editandoTorneo) cerrarFormTorneo()
    else abrirFormTorneo(null)
  })
  $('btnCancelarTorneoLog').addEventListener('click', cerrarFormTorneo)
  $('btnGuardarTorneoLog').addEventListener('click', guardarTorneoLog)
  $('torneoLogDonde').addEventListener('change', () => {
    $('torneoLogDondeOtroCampo').classList.toggle('hidden', $('torneoLogDonde').value !== '__otro')
    if ($('torneoLogDonde').value === '__otro') $('torneoLogDondeOtro').focus()
  })
  // Los filtros (tanda 628).
  const periodos = PERIODOS.map(([v, t]) => `<option value="${v}">${escapeHtml(t)}</option>`).join('')
  $('filtroPeriodo').innerHTML = periodos
  $('listaPeriodo').innerHTML = periodos
  for (const id of ['filtroPeriodo', 'filtroFechaDesde', 'filtroFechaHasta', 'filtroResultado', 'filtroMazo', 'filtroGuardado', 'filtroRival', 'filtroOrigen']) {
    $(id).addEventListener('change', () => {
      mostrarRango('filtro')
      repintar()
    })
  }
  $('filtroLimpiar').addEventListener('click', () => {
    for (const id of ['filtroResultado', 'filtroMazo', 'filtroGuardado', 'filtroRival', 'filtroOrigen', 'filtroFechaDesde', 'filtroFechaHasta']) $(id).value = ''
    $('filtroPeriodo').value = 'siempre'
    mostrarRango('filtro')
    repintar()
  })
  for (const id of ['listaOrden', 'listaPeriodo', 'listaFechaDesde', 'listaFechaHasta', 'listaResultado']) {
    $(id).addEventListener('change', () => {
      mostrarRango('lista')
      verTodasLasSueltas = false
      repintar()
    })
  }
  $('torneoOrden').addEventListener('change', () => pintarTorneos())
  montarCartel()

  await cargar()
}

init()
