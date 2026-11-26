// La página de torneos (/torneos): listar y crear. Parte del porte de
// TrainerArena (ver CLAUDE.md, sección «Jugar»). Crear va en su ventana de
// preguntas (js/torneos/crear.js, 1434).
//
// ABIERTA A TODO EL MUNDO (tanda 252 + pedido de Ibai del 2026-09-02):
// la lista se ve con y sin cuenta, como las demás secciones — es el
// escaparate. Apuntarse sí pide cuenta: la ficha manda al REGISTRO a
// quien no la tenga. Quien decide qué datos salen es la política de la
// base (supabase-migration-torneos-publico.sql). Crear sigue siendo
// del equipo.
import { supabase } from '../supabase.js'
import { claveDeVista, pintarUltimaVista, guardarVista, tomarPartes, visiblesDe, vistaAlDia } from '../ultima-vista.js'
import { escapeHtml, getSession, getProfile } from '../app.js'
import { showToast } from '../toast.js'
import { icons } from '../icons.js'
import { ESTADOS, estadoDeTorneo, fechaBonita, puedeBorrarTorneo, colorDeNombre, hayPremios, resumenDePremios } from './comun.js'
import { borrarTorneo, anunciarBorrado, textoConfirmarBorrado } from './borrar.js'
import { numJornadas, rondasPorJornada } from './rondas-jornada.js'
import { ligaCartelHtml, completarLiga, conJornadas } from './ligas-franja.js'
import { jornadasDeLiga } from './liga-en-curso.js'
import { esTorneoDeTienda, textoDePrecio } from './torneo-tienda.js'
import { leerAvisosHuerfanos } from './avisos-huerfanos.js'
import { chapaTipoHtml, tipoPrincipal } from '../chapa-tipo.js'
import { CARTELES, cartelHtml, cartelesHtml } from './carteles.js'
import { ciudadDe, ciudadesDe, tramoDe, TRAMOS, ordenarProximos, terminadosPorMes, filtrarTorneos, borradoresDe, textoDeRepite } from './agenda-puro.js'

const $ = (id) => document.getElementById(id)

// ── La lista ──

// Qué torneos son OFICIALES de PokeDoc.
//
// Nació en la tanda 246 deduciéndolo del creador: oficial = lo hizo un
// admin. Con la creación abierta a todo el mundo (tanda 266) eso ya no
// vale, y por dos motivos: hay torneos de gente que no es del equipo, y
// un admin también quiere poder montarse una pachanga suya SIN el sello
// de PokeDoc. Así que ahora es una casilla, `is_official`, que solo
// administración puede marcar.
//
// El respaldo por creador se queda para el rato que va entre desplegar
// esto y ejecutar la migración: sin la columna, `is_official` llega
// `undefined` y la Copa Inaugural perdería su sello hasta entonces.
let creadoresOficiales = new Set()

function esOficial(t) {
  if (t?.is_official !== undefined && t?.is_official !== null) return Boolean(t.is_official)
  return creadoresOficiales.has(t.admin_id)
}

// Un torneo privado no sale en la lista para casi nadie, pero SÍ para
// quien está dentro y para quien lo organiza: a ellos hay que decirles
// que no lo va a ver el resto.
// Desde la tanda 367 un torneo con código SE VE como los demás: la
// chapa ya no avisa de que está escondido, avisa de que para apuntarse
// hace falta la llave.
const CHAPA_PRIVADO = () =>
  `<span class="torneo-privado" title="Para inscribirse hace falta el código que da quien organiza">${icons.lock(11)} Con código</span>`

// ── La tarjeta de un torneo (tanda 297) ──
//
// Hasta hoy cada torneo era UNA LÍNEA de texto: no se veía quién iba
// apuntado, la imagen del torneo cabía en 48 px y un torneo EN JUEGO
// ahora mismo pesaba lo mismo que uno terminado hace un mes. PINGU:
// «la web está muy chula y todo está bien pensado, pero necesitamos
// modernizar las interfaces».
//
// Lo que decide el diseño: la tarjeta tiene que responder de un vistazo
// a «¿me apunto?» o «¿qué está pasando?», y el resto es decoración.
// Por eso hay UNA acción por tarjeta, y el estado manda sobre todo lo
// demás.

// Las caras de quien va apuntado. Un avatar de verdad si lo tiene, y si
// no la inicial sobre un color sacado del mismo nombre (mismo truco que
// el arte: estable, no aleatorio).
function caraHtml(perfil) {
  const nombre = perfil?.username || '?'
  if (perfil?.avatar_url) {
    return `<span class="torneo-cara"><img src="${escapeHtml(perfil.avatar_url)}" alt="${escapeHtml(nombre)}" loading="lazy" onerror="this.remove()" /></span>`
  }
  return `<span class="torneo-cara" style="background:${colorDeNombre(nombre)}" title="${escapeHtml(nombre)}">${escapeHtml(nombre.slice(0, 1).toUpperCase())}</span>`
}

// Qué dice el botón, que es la única acción de la tarjeta. Lo que solo LLEVA a
// la ficha dice «Ver» (1221, la maqueta de «La web como la portada»), con lo
// largo para el lector de pantalla; lo que hace algo distinto (apuntarse, el
// directo, seguir editando) lo sigue diciendo entero. Apuntarse de
// verdad se hace en la FICHA (ahí está el aviso de decklist, el código
// del torneo privado y la lista de espera): esto lleva allí, no hace el
// trabajo. Un botón que promete más de lo que hace es peor que ninguno.
function accionDe(t, miEstado, pausa = false) {
  if (t.status === 'draft') return { texto: 'Seguir editando', corto: 'Editar', clase: 'btn-secondary' }
  if (t.status === 'registration_open') {
    return miEstado === 'active'
      ? { texto: 'Ver el torneo', corto: 'Ver', clase: 'btn-secondary' }
      : { texto: 'Apuntarme', clase: 'torneo-btn-apuntarse' }
  }
  // Entre jornadas no hay directo que ver (850): se va a la liga.
  if (t.status === 'in_progress' && pausa) return { texto: 'Ver la liga', corto: 'Ver', clase: 'btn-secondary' }
  if (t.status === 'in_progress') {
    return { texto: 'Ver el directo', clase: miEstado === 'active' ? 'btn-primary' : 'btn-secondary' }
  }
  if (t.status === 'finished') return { texto: 'Resultados y mazos', corto: 'Ver', clase: 'btn-secondary' }
  return { texto: 'Ver el torneo', corto: 'Ver', clase: 'btn-secondary' }
}

// La estructura en dos palabras. `textoFormato` de comun.js es la frase
// larga de la ficha («3 suizas BO3 + top 4 BO3 · 30 min/ronda»): en una
// tarjeta se lee como un trabalenguas, así que aquí va troceada en
// etiquetas sueltas y esta es la primera.
function estructuraCorta(t) {
  return t.format === 'league' ? `Liga de ${numJornadas(t)} jornadas${rondasPorJornada(t) > 1 ? ` × ${rondasPorJornada(t)} rondas` : ''}` : `${t.swiss_rounds} rondas suizas`
}

// Tu próximo torneo, en la banda (1215, de la propuesta del repaso): cuándo
// es (y cuánto falta), las plazas, desde qué hora es el check-in y los dos
// caminos: tu lista (la pestaña Jugar de la ficha) y el torneo. Puro.
// Desde la 1398 («PokeDoc en modo app», PINGU: «más visual, no demasiado
// texto») es un cartel: los días que faltan en una losa grande y la línea de
// datos se queda en el día, la hora y las plazas.
export function proximoHtml(t, ocupadas = 0, ahora = Date.now()) {
  const inicio = new Date(t.start_at)
  const dias = Math.max(0, Math.round((new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate()) - new Date(new Date(ahora).getFullYear(), new Date(ahora).getMonth(), new Date(ahora).getDate())) / 864e5))
  const cuando = dias === 0 ? 'hoy' : dias === 1 ? 'mañana' : `en ${dias} días`
  const hora = (d) => d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  // En persona no hay check-in en la web: se entra por la puerta, con el QR
  // de tu entrada (1452). Decía «check-in desde las 16:55» igualmente.
  const enPersona = t.modalidad === 'presencial'
  const checkin = enPersona ? 'entrada en la puerta' : Number(t.checkin_minutes) > 0 ? `check-in desde las ${hora(new Date(inicio.getTime() - Number(t.checkin_minutes) * 6e4))}` : ''
  const plazas = t.max_players == null ? `${ocupadas} inscrito${ocupadas === 1 ? '' : 's'}` : `${ocupadas} de ${t.max_players} plazas`
  const url = `/torneo?slug=${encodeURIComponent(t.slug)}`
  // La losa lee «12 días» al lector de pantalla; «hoy» lleva la hora debajo.
  const losa = dias === 0 ? ['HOY', hora(inicio)] : [String(dias), dias === 1 ? 'DÍA' : 'DÍAS']
  return `<span class="t-proximo-dias" aria-label="${escapeHtml(dias === 0 ? `Hoy a las ${hora(inicio)}` : dias === 1 ? 'Mañana' : `Faltan ${dias} días`)}"><b>${losa[0]}</b><small>${escapeHtml(losa[1])}</small></span>
    <span class="t-proximo-ceja">Tu próximo torneo<span class="sr-only"> · ${escapeHtml(cuando)}</span></span>
    <a class="t-proximo-nombre" href="${url}">${escapeHtml(t.name)}</a>
    <span class="t-proximo-datos">${escapeHtml([`${inicio.getDate()} ${inicio.toLocaleString('es-ES', { month: 'short' }).replace('.', '')} · ${hora(inicio)}`, plazas, checkin].filter(Boolean).join(' · '))}</span>
    <span class="t-proximo-botones">${enPersona ? `<a class="btn-secondary" href="${url}&ver=torneo">Tu entrada</a>` : `<a class="btn-secondary" href="${url}&ver=jugar">Tu lista</a>`}<a class="btn-primary" href="${url}">Ver el torneo</a></span>`
}

// ── Una fila por torneo (1454, la agenda) ──
//
// Hasta la 1453 cada torneo era un cartel con su degradado: en el móvil
// cabían dos y medio por pantalla, las chapas se apilaban encima del nombre
// y lo que decide («¿cuándo?, ¿dónde?, ¿queda sitio?») iba en letra pequeña
// debajo. Ahora es UNA fila: el día a la izquierda, el nombre y dónde se
// juega en medio, las plazas y un botón a la derecha. En el PC, además,
// quién lo organiza. La foto del torneo, si la tiene, se ve en la ficha.
//
// Los nombres de siempre se quedan (`torneo-tarjeta`, `torneo-nombre`,
// `torneo-pie-accion`, `torneo-ocupacion-cifra`, `torneo-tarjeta-mas`):
// el «⋯», Borrar y Duplicar los recogen por ellos.
const DIA_SEMANA = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
function filaHtml(t, datos) {
  const { ocupadas = 0, miEstado = null, organizador = null, organiza = '', campeonPerfil = null, soyCampeon = false, puedeBorrar = false, puedeDuplicar = false, rondas = null, deTienda = false, tramo = null, puesto = null } = datos || {}
  const estado = estadoDeTorneo(t, rondas)
  const viva = t.status === 'in_progress' && !estado.pausa
  const hecho = ['finished', 'cancelled'].includes(t.status)
  const fecha = new Date(t.start_at)
  const hora = fecha.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  const mes = fecha.toLocaleString('es-ES', { month: 'short' }).replace('.', '')
  const url = `/torneo?slug=${encodeURIComponent(t.slug)}`
  const enPersona = t.modalidad === 'presencial'
  const ciudad = ciudadDe(t)
  // El día: hoy manda la hora (y si se juega ya, lo dice); esta semana, el
  // día de la semana; más adelante y lo pasado, el mes.
  const losa = tramo === 'hoy'
    ? { b: hora, s: viva ? 'ahora' : estado.pausa ? 'pausa' : 'hoy', clase: viva ? 'viva' : 'hoy' }
    : { b: String(fecha.getDate()), s: tramo === 'semana' ? DIA_SEMANA[fecha.getDay()] : mes, clase: '' }
  // Dónde, en su color (1462): verde con la ciudad, azul «Online».
  const donde = enPersona
    ? `<span class="torneo-fila-donde persona">${chapaTipoHtml('persona', { texto: ciudad || t.lugar || 'En persona' })}</span>`
    : `<span class="torneo-fila-donde">${chapaTipoHtml('online')}</span>`
  // Lo de la segunda línea, en orden de lo que más decide: dónde, la hora
  // (si no la dice ya la losa), los premios, el precio y la estructura.
  const precio = textoDePrecio(t.precio_entrada, { deTienda })
  const sub = [
    donde,
    tramo !== 'hoy' && !hecho ? `<span>${escapeHtml(hora)}</span>` : '',
    hecho ? `<span>${ocupadas} jugador${ocupadas === 1 ? '' : 'es'}</span>` : `<span class="torneo-fila-estructura">${escapeHtml(estructuraCorta(t))}${t.top_cut_size ? ` · top ${t.top_cut_size}` : ''}</span>`,
    !hecho && hayPremios(t) ? `<span class="torneo-fila-premio">${icons.trophy(12)} ${escapeHtml(resumenDePremios(t))}</span>` : '',
    !hecho && precio ? `<span class="torneo-fila-precio">${escapeHtml(precio)}</span>` : '',
  ].filter(Boolean).join('')
  // Las chapas van detrás del nombre, pequeñas y en una sola línea.
  // Un color por tipo (1462): en juego rojo, liga violeta, oficial oro y se
  // repite rosa. «Tienda» ya no va aparte: es un torneo en persona y lo dice
  // su chapa verde (y quién organiza, a la derecha).
  const chapas = [
    viva ? chapaTipoHtml('vivo', { texto: estado.texto }) : '',
    t.status === 'registration_closed' ? `<span class="torneo-estado ${estado.clase}">${escapeHtml(estado.texto)}</span>` : '',
    t.status === 'cancelled' ? `<span class="torneo-estado ${estado.clase}">${escapeHtml(estado.texto)}</span>` : '',
    esOficial(t) ? chapaTipoHtml('oficial', { titulo: 'Torneo oficial, organizado por el equipo de PokeDoc' }) : '',
    t.format === 'league' ? chapaTipoHtml('liga') : '',
    // Se repite (1457): la chapa dice cuándo, que es lo que hace volver.
    !hecho && textoDeRepite(t) ? chapaTipoHtml('repite', { texto: textoDeRepite(t) }) : '',
    t.is_private ? CHAPA_PRIVADO() : '',
  ].filter(Boolean).join('')
  // La tercera columna: quién organiza; en un terminado, quién ganó, con su
  // cara y los Pokémon de su mazo (los pone arte-meta.js en `data-torneo`).
  const quien = hecho
    ? campeonPerfil
      ? `<span class="torneo-campeon">${icons.trophy(13)}<span class="torneo-fila-mazo torneo-arte con-meta" data-torneo="${escapeHtml(String(t.id))}"></span>${caraHtml(campeonPerfil)}<b>${escapeHtml(campeonPerfil.username)}</b></span>`
      : ''
    : organiza
      ? `<span class="torneo-fila-organiza">${organizador ? caraHtml(organizador) : ''}<span>${escapeHtml(organiza)}</span></span>`
      : ''
  // Las plazas: la barra se pone ámbar al 80 %, como siempre.
  const sinLimite = t.max_players == null
  const porcentaje = sinLimite ? 0 : Math.min(100, (ocupadas / t.max_players) * 100)
  const plazas = hecho
    ? soyCampeon
      ? `<span class="torneo-fila-puesto oro">${icons.trophy(12)} Campeón</span>`
      : puesto
        ? `<span class="torneo-fila-puesto">Tú: ${puesto}.º</span>`
        : miEstado
          ? '<span class="torneo-fila-puesto suave">Jugaste</span>'
          : ''
    : `<span class="torneo-ocupacion">${sinLimite ? '' : `<span class="torneo-ocupacion-barra ${porcentaje >= 80 ? 'apurada' : ''}"><span class="torneo-ocupacion-relleno" style="width:${porcentaje}%"></span></span>`}<span class="torneo-ocupacion-cifra">${sinLimite ? `${ocupadas} inscrito${ocupadas === 1 ? '' : 's'}` : `${ocupadas}/${t.max_players}`}</span></span>`
  // El botón. Lo tuyo abierto dice «Inscrito» en verde (y lleva a la ficha);
  // en persona con plaza a pedir, «Pedir plaza».
  const accion = t.status === 'registration_open' && !miEstado && enPersona && (t.inscripcion || 'pedir') === 'pedir'
    ? { texto: 'Pedir plaza', clase: 'torneo-btn-apuntarse' }
    : viva && miEstado === 'active'
      ? { texto: 'Ir a tu mesa', clase: 'btn-primary' }
      : accionDe(t, miEstado, estado.pausa)
  const inscrito = !hecho && t.status !== 'draft' && miEstado === 'active' && !viva
  const masMenu = (() => {
    const duplicar = puedeDuplicar ? `<button type="button" class="btn-secondary torneo-duplicar" data-duplicar="${escapeHtml(t.id)}">Duplicar</button>` : ''
    const borrar = puedeBorrar ? `<button type="button" class="torneo-borrar torneo-borrar-fila" data-borrar="${escapeHtml(t.id)}" data-nombre="${escapeHtml(t.name)}" data-dentro="${ocupadas}">Borrar</button>` : ''
    return duplicar || borrar
      ? `<details class="torneo-mas torneo-tarjeta-mas"><summary class="torneo-mas-boton" aria-label="Más opciones: ${escapeHtml(t.name)}">⋯</summary><div class="torneo-mas-menu">${duplicar}${borrar}</div></details>`
      : ''
  })()
  const clases = ['torneo-tarjeta', 'torneo-fila', viva ? 'torneo-fila-viva' : '', miEstado === 'active' ? 'torneo-tarjeta-mia' : '', hecho ? 'torneo-fila-hecha' : '', t.status === 'draft' ? 'torneo-fila-borrador' : ''].filter(Boolean).join(' ')
  return `
  <article class="${clases}" data-torneo-id="${escapeHtml(String(t.id))}"${hecho ? '' : ` data-tipo-torneo="${viva ? 'vivo' : tipoPrincipal(t)}"`}>
    <a class="torneo-tarjeta-enlace torneo-fila-enlace" href="${url}">
      <span class="torneo-fila-fecha ${losa.clase}" aria-hidden="true"><b>${escapeHtml(losa.b)}</b><small>${escapeHtml(losa.s)}</small></span>
      <span class="torneo-fila-texto">
        <span class="torneo-fila-titulo"><strong class="torneo-nombre">${escapeHtml(t.name)}</strong>${chapas}</span>
        <span class="torneo-fila-sub">${sub}</span>
      </span>
      <span class="torneo-fila-quien">${quien}</span>
      <span class="torneo-fila-plazas">${plazas}</span>
    </a>
    <span class="torneo-fila-der">
      ${masMenu}
      ${inscrito ? `<a class="torneo-fila-inscrito torneo-pie-accion" href="${url}" aria-label="Estás inscrito: ver ${escapeHtml(t.name)}">${icons.checkCircle(13)} Inscrito</a>` : `<a class="${accion.clase} torneo-pie-accion" href="${url}"${accion.corto ? ` aria-label="${escapeHtml(/^Ver /.test(accion.texto) ? accion.texto : `Ver ${accion.texto.toLowerCase()}`)}: ${escapeHtml(t.name)}"` : ''}>${accion.corto || accion.texto}</a>`}
    </span>
  </article>`
}

// El cartel de un torneo suelto (1463), con lo mismo que decide su fila: el
// botón, quién organiza, dónde, la estructura, el precio y los premios.
function cartelDe(t, { ocupadas = 0, miEstado = null, rondas = null, gente = {} } = {}) {
  const estado = estadoDeTorneo(t, rondas)
  const viva = t.status === 'in_progress' && !estado.pausa
  const enPersona = t.modalidad === 'presencial'
  const oficial = esOficial(t)
  const org = oficial ? null : gente[t.admin_id] || null
  const ciudad = ciudadDe(t)
  const accion = t.status === 'registration_open' && !miEstado && enPersona && (t.inscripcion || 'pedir') === 'pedir'
    ? { texto: 'Pedir plaza', clase: 'torneo-btn-apuntarse' }
    : viva && miEstado === 'active'
      ? { texto: 'Ir a tu mesa', clase: 'btn-primary' }
      : accionDe(t, miEstado, estado.pausa)
  return cartelHtml(t, {
    ocupadas,
    oficial,
    viva,
    estadoTexto: estado.texto,
    accion,
    inscrito: t.status !== 'draft' && miEstado === 'active' && !viva,
    organiza: oficial ? 'El equipo de PokeDoc' : org?.username || '',
    caraOrganiza: org ? caraHtml(org) : '',
    donde: enPersona
      ? `${icons.mapPin(13)} ${escapeHtml([t.lugar, ciudad].filter(Boolean).join(' · ') || 'En persona')}`
      : `${icons.globe(13)} TCG Live`,
    estructura: escapeHtml(`${estructuraCorta(t)}${t.top_cut_size ? ` · top ${t.top_cut_size}` : ''}`),
    precio: escapeHtml(textoDePrecio(t.precio_entrada, { deTienda: esTorneoDeTienda(t, gente) }) || ''),
    premio: hayPremios(t) ? resumenDePremios(t) : '',
    repite: textoDeRepite(t),
  })
}

// ── La barra del torneo que estás jugando AHORA (tanda 297) ──
//
// Es lo primero que quiere quien entra a /torneos un domingo por la
// tarde: cuánto queda de ronda y por dónde se vuelve a su mesa. Antes
// había que encontrar tu torneo entre los demás, entrar y buscar.
//
// Solo se pide la ronda cuando HAY un torneo tuyo en juego: quien no
// esté jugando nada no paga ninguna consulta de más.
let relojVivo = null
let relojLigas = null

function textoCuenta(ms) {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

// «Después: …» (1454): el siguiente torneo tuyo en una línea bajo el
// combate, en vez de un segundo cartel que empujaba la lista hacia abajo.
function despuesHtml(t) {
  const d = new Date(t.start_at)
  const hoy = new Date()
  const mismoDia = d.toDateString() === hoy.toDateString()
  const cuando = `${mismoDia ? 'hoy' : d.toLocaleDateString('es-ES', { weekday: 'long' })} ${d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`
  const url = `/torneo?slug=${encodeURIComponent(t.slug)}`
  const enPersona = t.modalidad === 'presencial'
  return `<span class="torneo-vivo-despues"><span>Después:</span> <a href="${url}">${escapeHtml(t.name)}</a> · ${escapeHtml(cuando)}${enPersona ? '<span class="torneo-vivo-despues-puerta"> · en persona, entrada en la puerta</span>' : ''}<a class="torneo-vivo-despues-ir" href="${url}${enPersona ? '&ver=torneo' : '&ver=jugar'}">${enPersona ? 'Tu entrada' : 'Tu lista'}</a></span>`
}

async function pintarVivo(torneo, despues = null) {
  const caja = $('torneoVivo')
  if (!caja) return
  if (relojVivo) {
    clearInterval(relojVivo)
    relojVivo = null
  }
  if (!torneo) {
    caja.classList.add('hidden')
    caja.innerHTML = ''
    return
  }
  const { data: rondas } = await supabase
    .from('rounds')
    .select('id, round_number, status, ends_at, phase')
    .eq('tournament_id', torneo.id)
    .eq('status', 'active')
    .limit(1)
  const ronda = (rondas || [])[0] || null
  // Tu mesa y contra quién (1454): lo primero que se busca al volver a la
  // lista en mitad de una ronda. Dos consultas, y solo cuando juegas.
  const yo = quienMira.session?.user?.id || null
  let mesa = null
  if (ronda?.id && yo) {
    const { data: mesas } = await supabase.from('tournament_matches').select('table_number, player_a_id, player_b_id, is_bye').eq('round_id', ronda.id)
    const mia = (mesas || []).find((m) => m.player_a_id === yo || m.player_b_id === yo)
    if (mia) {
      const rival = mia.player_a_id === yo ? mia.player_b_id : mia.player_a_id
      const { data: perfilRival } = rival ? await supabase.from('user_profiles').select('username').eq('id', rival).maybeSingle() : { data: null }
      mesa = mia.is_bye || !rival ? 'Descansas esta ronda' : `Mesa ${mia.table_number}${perfilRival?.username ? ` · contra ${perfilRival.username}` : ''}`
    }
  }
  // Las rondas de verdad (1346): las suizas y, si hay corte, «Top N» detrás;
  // en el corte, la ronda dice «Top cut», no «Ronda 4 de 3».
  const total = torneo.swiss_rounds || 0
  const enCorte = ronda?.phase === 'top_cut'
  const rotuloRonda = !ronda
    ? 'Entre rondas'
    : enCorte
      ? `Top cut · ronda ${ronda.round_number}`
      : `Ronda ${ronda.round_number}${total ? ` de ${total}` : ''}${torneo.top_cut_size ? ` · luego, top ${torneo.top_cut_size}` : ''}`
  caja.classList.remove('hidden')
  caja.innerHTML = `
    <span class="torneo-vivo-texto">
      <span class="torneo-vivo-ceja">Tu combate</span>
      <span class="torneo-vivo-chapa"><span class="torneo-punto"></span>En juego</span>
      <strong>${escapeHtml(torneo.name)}</strong>
      ${total && total <= 12 ? `<span class="torneo-vivo-rondas" aria-hidden="true">${Array.from({ length: total }, (_, i) => `<i class="${enCorte || (ronda && i + 1 < ronda.round_number) ? 'hecha' : ronda && i + 1 === ronda.round_number ? 'ahora' : ''}"></i>`).join('')}${torneo.top_cut_size ? `<i class="corte${enCorte ? ' ahora' : ''}"></i>` : ''}</span>` : ''}
      <span class="torneo-vivo-sub">${escapeHtml(rotuloRonda)}${mesa ? ` · <b>${escapeHtml(mesa)}</b>` : ''}</span>
    </span>
    <span class="torneo-vivo-der">
      ${ronda?.ends_at ? '<span class="torneo-vivo-reloj"><span class="torneo-vivo-rotulo">Queda de ronda</span><b id="torneoVivoReloj">—</b></span>' : ''}
      <a class="btn-primary" href="/torneo?slug=${encodeURIComponent(torneo.slug)}">Ir a tu mesa</a>
    </span>
    ${despues ? despuesHtml(despues) : ''}`
  if (!ronda?.ends_at) return
  // El reloj del navegador es ORIENTATIVO, igual que en la ficha: quien
  // cierra la ronda de verdad es el barredor por minuto del servidor.
  const fin = new Date(ronda.ends_at).getTime()
  const marcador = $('torneoVivoReloj')
  const tic = () => {
    marcador.textContent = textoCuenta(fin - Date.now())
  }
  tic()
  relojVivo = setInterval(tic, 1000)
}

// El «Mis torneos» del menú de cuenta llega con #mios: la agenda abre con el
// filtro «Los míos» puesto (ver `filtroLista`, más abajo).

// LA SEMANA DE UN VISTAZO (790, PA15): los siete días desde hoy, cada uno
// con sus torneos como puntos y la hora del primero. Pura para la prueba.
const DIAS_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
export function semanaDeTorneos(torneos, ahora = new Date()) {
  const dias = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + i)
    const clave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const delDia = (torneos || [])
      .filter((t) => t.start_at && !['draft', 'cancelled'].includes(t.status))
      .filter((t) => { const s = new Date(t.start_at); return s.getFullYear() === d.getFullYear() && s.getMonth() === d.getMonth() && s.getDate() === d.getDate() })
      .sort((a, b) => new Date(a.start_at) - new Date(b.start_at))
    dias.push({ clave, nombre: i === 0 ? 'hoy' : DIAS_CORTOS[d.getDay()], numero: d.getDate(), torneos: delDia, primera: delDia[0] ? new Date(delDia[0].start_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '' })
  }
  return dias
}

// La semana solo sale en la vista de calendario (1164, J1): en «Lista» eran
// siete casillas que no hacían nada, la segunda de tres filas de mandos.
function mostrarSemana() {
  const caja = $('torneosSemana')
  if (caja) caja.classList.toggle('hidden', !(caja.dataset.hay === '1' && vistaTorneos === 'calendario'))
}

function pintarSemana(torneos) {
  const caja = $('torneosSemana')
  if (!caja) return
  const dias = semanaDeTorneos(torneos)
  caja.dataset.hay = dias.some((d) => d.torneos.length) ? '1' : '0'
  if (caja.dataset.hay !== '1') return mostrarSemana()
  caja.innerHTML = dias.map((d) => {
    const primero = d.torneos[0]
    const dentro = `<span class="tsem-nombre">${d.nombre}</span><b>${d.numero}</b><span class="tsem-puntos" aria-hidden="true">${'<i></i>'.repeat(Math.min(d.torneos.length, 4))}</span><small>${escapeHtml(d.primera)}</small>`
    const etiqueta = `${d.nombre} ${d.numero}: ${d.torneos.length ? `${d.torneos.length} ${d.torneos.length === 1 ? 'torneo' : 'torneos'}, el primero a las ${d.primera}` : 'sin torneos'}`
    return primero
      ? `<a class="tsem-dia con" href="/torneo?slug=${encodeURIComponent(primero.slug)}" aria-label="${escapeHtml(etiqueta)}">${dentro}</a>`
      : `<span class="tsem-dia" aria-label="${escapeHtml(etiqueta)}">${dentro}</span>`
  }).join('')
  mostrarSemana()
}

// En el teléfono (1040), el calendario y «+» van DELANTE de los chips, en
// la misma fila que se desliza: se mueve la caja de verdad (con sus
// manejadores) y vuelve a la cabecera antes de repintar, en el PC y en la
// vista de calendario (los chips son de la lista).
const telefono = typeof matchMedia === 'function' ? matchMedia('(max-width: 599px)') : { matches: false, addEventListener() {} }
function colocarMandosTorneos({ aCasa = false } = {}) {
  const acciones = document.querySelector('.torneos-heroe-acciones')
  const casa = document.querySelector('.torneos-heroe')
  if (!acciones || !casa) return
  const chips = $('listaTorneos')?.querySelector('.torneo-pestanas-chips')
  const listaALaVista = !aCasa && chips && !$('listaTorneos').classList.contains('hidden')
  const enLista = telefono.matches && listaALaVista
  // El botón del calendario vuelve a su sitio (delante de «Crear») antes de
  // colocar nada: en el PC se muda al final de la fila de filtros.
  const icono = $('torneosVistaIcono')
  if (icono && icono.parentElement !== acciones) acciones.prepend(icono)
  if (enLista) chips.prepend(acciones)
  else if (acciones.parentElement !== casa) casa.append(acciones)
  casa.classList.toggle('torneos-heroe-vacia', Boolean(enLista))
  // En el PC (1462) Lista/Calendario es UN botón redondo al final de la fila
  // de filtros, después de la lupa (antes, el conmutador de dos delante de
  // los chips: dos mandos más en una fila que ya no se leía).
  if (icono && !telefono.matches && listaALaVista) chips.append(icono)
}
telefono.addEventListener?.('change', () => colocarMandosTorneos())

// ── La agenda (1454), los filtros (1455) y los terminados (1456) ──
//
// Antes eran pestañas de estado (Tus torneos · Abiertas · Por empezar · En
// juego · Terminados · Borradores): para saber qué había el sábado había que
// mirar en tres, y dentro no iban por fecha. Ahora lo que viene va en UNA
// lista por días (Hoy · Esta semana · Más adelante) y lo de arriba son
// filtros que la recortan: Los míos, Online, En persona (con su ciudad),
// Oficiales y Ligas, y el buscador.
//
// LOS TERMINADOS (PINGU: «¿qué pasa con los torneos terminados? ¿deberían
// salir en otro sitio? ¿se van hacia abajo? ¿con filtro?»): no se mezclan con
// lo que viene, que es a lo que se viene aquí. Abajo del todo van los tres
// últimos («Últimos resultados»), y «Terminados» es su propia vista, con los
// mismos filtros, por meses, con quién ganó y tu puesto. Se llega por el chip
// del final de la fila, por el botón de abajo o con /torneos#terminados.
//
// LOS BORRADORES, solo de quien los creó (ver `borradoresDe`), arriba del
// todo, que es lo que su dueño viene a terminar.
let agenda = null
let filtroLista = window.location.hash === '#mios' ? 'mios' : 'todos'
let vistaHechos = window.location.hash === '#terminados'
let buscaLista = ''
let ciudadLista = (() => { try { return localStorage.getItem('pokedoc-torneos-ciudad') || null } catch { return null } })()
const ULTIMOS_RESULTADOS = 3

function chipsDeFiltroHtml() {
  const { proximos, hechos } = agenda
  const base = vistaHechos ? hechos : proximos
  const ciudades = ciudadesDe(base)
  const persona = filtroLista === 'persona'
  const nPersona = base.filter((t) => t.modalidad === 'presencial').length
  // Cuatro mandos y no nueve (1462, PINGU: «los filtros son demasiados, no se
  // lee todo a la primera»): Todos, Online y En persona (con su ciudad), cada
  // uno con su color y cuántos hay; la lupa y el calendario, al final. Fuera
  // de la fila: Oficiales y Ligas (se ven solos por su chapa de color), Los
  // míos (lo tuyo está en «Tu próximo torneo» y en Mis partidas; #mios sigue
  // valiendo) y Terminados (su botón «Ver los N terminados» al final).
  const cuenta = (n) => ` <span class="torneo-pestana-cuenta">${n}</span>`
  const chip = (id, texto, n, tipo = '') => `<button type="button" class="chip-filtro${filtroLista === id ? ' activa' : ''}"${tipo ? ` data-tipo-torneo="${tipo}"` : ''} data-filtro-lista="${id}" aria-pressed="${filtroLista === id}">${texto}${cuenta(n)}</button>`
  return `
    ${chip('todos', 'Todos', base.length)}
    ${chip('online', `${icons.globe(14)} Online`, base.length - nPersona, 'online')}
    <details class="torneos-ciudad">
      <summary class="chip-filtro${persona ? ' activa' : ''}" data-tipo-torneo="persona" data-filtro-lista="persona">${icons.mapPin(14)} En persona${persona && ciudadLista ? ` · ${escapeHtml(ciudadLista)}` : ''}${cuenta(nPersona)} <span class="torneos-ciudad-flecha" aria-hidden="true">▾</span></summary>
      <div class="torneos-ciudad-menu" role="menu">
        <button type="button" role="menuitem" data-ciudad=""${persona && !ciudadLista ? ' class="activa"' : ''}>Todas las ciudades <small>${nPersona}</small></button>
        ${ciudades.map((c) => `<button type="button" role="menuitem" data-ciudad="${escapeHtml(c.ciudad)}"${ciudadLista === c.ciudad ? ' class="activa"' : ''}>${escapeHtml(c.ciudad)} <small>${c.n}</small></button>`).join('')}
      </div>
    </details>
    <label class="torneos-buscar${buscaLista ? ' abierta' : ''}"><span class="sr-only">Busca un torneo</span>${icons.search(16)}<input type="search" id="torneosBuscar" placeholder="Busca un torneo o un sitio" autocomplete="off" value="${escapeHtml(buscaLista)}" /></label>`
}

function filtrados(lista) {
  const { mio, oficial, organiza } = agenda
  return filtrarTorneos(lista, { filtro: filtroLista, ciudad: ciudadLista, busca: buscaLista, mio, oficial, organiza })
}

const tramoHtml = (titulo, filas, { extra = '', clase = '' } = {}) =>
  `<section class="torneos-tramo ${clase}"><h2 class="torneos-tramo-cab">${titulo}${extra}</h2><div class="torneos-filas">${filas.join('')}</div></section>`

function cuerpoProximosHtml() {
  const { proximos, hechos, borradores, fila } = agenda
  const partes = []
  if (borradores.length && ['todos', 'mios'].includes(filtroLista)) {
    const suyos = buscaLista ? filtrarTorneos(borradores, { busca: buscaLista }) : borradores
    if (suyos.length) partes.push(tramoHtml('Tus borradores', suyos.map((t) => fila(t, null)), { extra: '<span>solo los ves tú</span>', clase: 'torneos-tramo-borradores' }))
  }
  const lista = filtrados(proximos)
  const hoy = new Date()
  // Lo próximo en grande (1463): los tres primeros, en carteles; el resto,
  // en filas por días, como antes.
  const conFiltro = filtroLista !== 'todos' || Boolean(buscaLista)
  if (lista.length || !conFiltro) partes.push(cartelesHtml(lista.slice(0, CARTELES).map((t) => agenda.cartel(t)), { conSesion: agenda.conSesion, conFiltro }))
  const resto = lista.slice(CARTELES)
  for (const [id, texto] of TRAMOS) {
    const delTramo = resto.filter((t) => tramoDe(t, hoy) === id)
    if (!delTramo.length) continue
    const extra = id === 'hoy' ? `<span>${escapeHtml(hoy.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric' }))}</span>` : ''
    partes.push(tramoHtml(texto, delTramo.map((t) => fila(t, id)), { extra }))
  }
  if (!lista.length && conFiltro) partes.push(vacioDeFiltrosHtml('No hay torneos con estos filtros.'))
  const ultimos = filtrados(hechos).sort((a, b) => new Date(b.start_at) - new Date(a.start_at))
  if (ultimos.length) {
    partes.push(tramoHtml('Últimos resultados', ultimos.slice(0, ULTIMOS_RESULTADOS).map((t) => fila(t, null)), { clase: 'torneos-ultimos' }) +
      `<button type="button" class="btn-secondary torneos-ver-hechos" data-ver-hechos>Ver ${ultimos.length === 1 ? 'el terminado' : `los ${ultimos.length} terminados`}</button>`)
  }
  return partes.join('')
}

function cuerpoHechosHtml() {
  const lista = filtrados(agenda.hechos)
  const grupos = terminadosPorMes(lista)
  let quedan = verTodosLosTerminados ? Infinity : TERMINADOS_DE_GOLPE
  const partes = [`<div class="torneos-hechos-cab"><button type="button" class="link-btn" data-volver-proximos>${icons.chevronLeft?.(15) || '←'} Próximos</button><h2>Terminados</h2><span>${lista.length}</span></div>`]
  for (const g of grupos) {
    if (quedan <= 0) break
    const filas = g.torneos.slice(0, quedan)
    quedan -= filas.length
    partes.push(tramoHtml(escapeHtml(g.texto), filas.map((t) => agenda.fila(t, null))))
  }
  if (!lista.length) partes.push(vacioDeFiltrosHtml(agenda.hechos.length ? 'Ningún terminado con estos filtros.' : 'Todavía no ha terminado ningún torneo.'))
  const ocultos = lista.length - Math.min(lista.length, verTodosLosTerminados ? lista.length : TERMINADOS_DE_GOLPE)
  if (ocultos > 0) partes.push(`<button type="button" class="btn-secondary torneo-ver-mas" id="btnVerMasTerminados">Ver ${ocultos} más</button>`)
  return partes.join('')
}

function vacioDeFiltrosHtml(texto) {
  const conFiltro = filtroLista !== 'todos' || buscaLista
  return `<div class="torneos-vacio-filtros"><p>${escapeHtml(texto)}</p>${conFiltro ? '<button type="button" class="btn-secondary" data-quitar-filtros>Quitar los filtros</button>' : ''}</div>`
}

function pintarCuerpoAgenda() {
  const caja = $('torneosAgenda')
  if (!caja || !agenda) return
  caja.innerHTML = vistaHechos ? cuerpoHechosHtml() : cuerpoProximosHtml()
  caja.classList.toggle('torneos-agenda-hechos', vistaHechos)
  // La franja de ligas en curso es de lo que viene: en Terminados, fuera.
  const franja = $('torneosLigas')
  if (franja) franja.classList.toggle('hidden', vistaHechos)
  // Los Pokémon del mazo de cada campeón, en las filas que se acaban de pintar.
  if (caja.querySelector('.torneo-fila-mazo')) import('./arte-meta.js').then((m) => m.ponerArteDeCampeones(caja, agenda.hechos)).catch(() => {})
  // Los carteles (1463): los mazos del meta en los que no tienen imagen, lo
  // que le falta a la liga (podio, tu puesto, listas) y su reloj si se juega.
  if (caja.querySelector('.t-cartel-arte')) import('./arte-meta.js').then((m) => m.ponerArteDelMeta(caja)).catch(() => {})
  completarLigasEnCarteles(caja)
  ponerRelojesDeLiga(caja)
}

function pintarFiltros() {
  const nav = $('listaTorneos')?.querySelector('.torneos-filtros')
  if (!nav) return
  // Lo que se mudó a la fila (el conmutador del PC, los botones del móvil)
  // vuelve a casa antes de repintarla, y luego se coloca otra vez.
  colocarMandosTorneos({ aCasa: true })
  const foco = document.activeElement?.id === 'torneosBuscar'
  nav.innerHTML = chipsDeFiltroHtml()
  colocarMandosTorneos()
  if (foco) { const i = $('torneosBuscar'); i?.focus(); i?.setSelectionRange(i.value.length, i.value.length) }
}

function pintarAgenda(datos) {
  agenda = datos
  colocarMandosTorneos({ aCasa: true })
  const lista = $('listaTorneos')
  lista.innerHTML = `<nav class="torneo-pestanas-chips torneos-filtros" aria-label="Filtrar los torneos">${chipsDeFiltroHtml()}</nav><div id="torneosAgenda" class="torneos-agenda en-cascada"></div>`
  colocarMandosTorneos()
  pintarCuerpoAgenda()
}

function cambiarVista(hechos) {
  vistaHechos = hechos
  try { history.replaceState(null, '', hechos ? '#terminados' : location.pathname + location.search) } catch {}
  pintarFiltros()
  pintarCuerpoAgenda()
  if (hechos) $('listaTorneos')?.scrollIntoView({ block: 'start', behavior: 'smooth' })
}

// Los mandos de la agenda, delegados en la lista: la fila se repinta entera
// con cada cambio y los manejadores sueltos se perderían.
function engancharAgenda() {
  const lista = $('listaTorneos')
  if (!lista || lista.dataset.agenda) return
  lista.dataset.agenda = '1'
  lista.addEventListener('click', (e) => {
    const filtro = e.target.closest('[data-filtro-lista]')
    if (filtro && filtro.dataset.filtroLista !== 'persona') {
      filtroLista = filtro.dataset.filtroLista
      pintarFiltros()
      return pintarCuerpoAgenda()
    }
    // El chip de la fila va y vuelve; el botón de abajo solo va.
    const verHechos = e.target.closest('[data-ver-hechos]')
    if (verHechos) return cambiarVista(verHechos.classList.contains('torneos-chip-hechos') ? !vistaHechos : true)
    if (e.target.closest('[data-volver-proximos]')) return cambiarVista(false)
    if (e.target.closest('[data-quitar-filtros]')) {
      filtroLista = 'todos'
      buscaLista = ''
      pintarFiltros()
      return pintarCuerpoAgenda()
    }
    if (e.target.closest('[data-crear-torneo]')) return $('btnNuevoTorneo')?.click()
    if (e.target.closest('#btnVerMasTerminados')) {
      verTodosLosTerminados = true
      return pintarCuerpoAgenda()
    }
  })
  // El menú de ciudades se pinta FUERA de la fila, colgado de la página: en
  // el móvil la fila se desliza de lado y su `overflow` lo recortaba entero.
  // Se coloca bajo su chip al abrirse y se cierra al elegir, al tocar fuera
  // o si la página se mueve.
  const cerrarCiudades = () => {
    document.getElementById('torneosCiudadMenu')?.remove()
    const d = lista.querySelector('details.torneos-ciudad[open]')
    if (d) d.open = false
  }
  lista.addEventListener('toggle', (e) => {
    const d = e.target
    if (!d.matches?.('details.torneos-ciudad')) return
    document.getElementById('torneosCiudadMenu')?.remove()
    if (!d.open) return
    const r = d.querySelector('summary').getBoundingClientRect()
    const menu = d.querySelector('.torneos-ciudad-menu').cloneNode(true)
    menu.id = 'torneosCiudadMenu'
    menu.hidden = false
    menu.style.top = `${Math.round(r.bottom + 6)}px`
    menu.style.left = `${Math.max(8, Math.min(Math.round(r.left), window.innerWidth - 226))}px`
    menu.addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-ciudad]')
      if (!b) return
      filtroLista = 'persona'
      ciudadLista = b.dataset.ciudad || null
      // La ciudad elegida se queda para la próxima vez (la de quien vive en
      // Bilbao es casi siempre Bilbao).
      try { ciudadLista ? localStorage.setItem('pokedoc-torneos-ciudad', ciudadLista) : localStorage.removeItem('pokedoc-torneos-ciudad') } catch {}
      cerrarCiudades()
      pintarFiltros()
      pintarCuerpoAgenda()
    })
    document.body.append(menu)
  }, true)
  document.addEventListener('click', (e) => {
    if (!document.getElementById('torneosCiudadMenu')) return
    if (e.target.closest('#torneosCiudadMenu, details.torneos-ciudad > summary')) return
    cerrarCiudades()
  })
  window.addEventListener('scroll', cerrarCiudades, { passive: true })
  // Los puntos del carrusel de carteles (1463, móvil): el que se ve, encendido.
  lista.addEventListener('scroll', (e) => {
    const fila = e.target
    if (!fila.classList?.contains('t-carteles')) return
    const puntos = fila.parentElement?.querySelectorAll('.t-carteles-puntos i') || []
    const ancho = fila.firstElementChild?.getBoundingClientRect().width || 1
    const i = Math.round(fila.scrollLeft / (ancho + 12))
    puntos.forEach((p, k) => p.classList.toggle('on', k === i))
  }, true)
  // La lupa del móvil (1462): un botón redondo que se abre a lo ancho de la
  // fila al tocarlo y se cierra al salir si no se ha escrito nada.
  lista.addEventListener('click', (e) => {
    const lupa = e.target.closest('.torneos-buscar')
    if (!lupa || lupa.classList.contains('abierta') || !telefono.matches) return
    lupa.classList.add('abierta')
    lupa.closest('.torneos-filtros')?.scrollTo?.({ left: 0 })
    $('torneosBuscar')?.focus()
  })
  lista.addEventListener('focusout', (e) => {
    if (e.target.id !== 'torneosBuscar' || e.target.value) return
    e.target.closest('.torneos-buscar')?.classList.remove('abierta')
  })
  lista.addEventListener('input', (e) => {
    if (e.target.id !== 'torneosBuscar') return
    buscaLista = e.target.value
    pintarCuerpoAgenda()
  })
}

// Cuántos torneos terminados se enseñan de golpe. Antes se cortaba en
// 10 y no había manera de ver el resto: el historial de la comunidad
// se perdía por el borde. Ahora el corte lo levanta un botón.
const TERMINADOS_DE_GOLPE = 10
let verTodosLosTerminados = false
// Quién está mirando, guardado para los repintados que nacen de un
// clic suelto («ver más», borrar una fila) y no tienen a mano ni la
// sesión ni el perfil.
let quienMira = { session: null, perfil: null }
const recargarLista = () => cargarLista(quienMira.session, quienMira.perfil)

// LAS LIGAS EN CURSO, EN SU CARTEL (1463; antes una franja aparte, 1303). La
// tarjeta sale entera con las rondas que ya se tienen; el podio, tu puesto y
// «N de M ya han mandado lista» caen después en su hueco. Lo que llega se
// guarda: los filtros repintan la agenda entera y no se vuelve a preguntar.
const ligaCompletada = new Map()
const HUECOS_DE_LIGA = ['[data-lc-podio]', '[data-lc-tu]', '[data-lc-listas]', '[data-lc-boton]']
function completarLigasEnCarteles(caja) {
  const ctx = agenda?.ligas
  if (!caja || !ctx) return null
  return Promise.all(
    [...caja.querySelectorAll('.t-cartel-liga[data-liga]')].map((tarjeta) => {
      const id = tarjeta.dataset.liga
      const t = ctx.porId.get(id)
      if (!t) return null
      const guardado = ligaCompletada.get(id)
      if (guardado) {
        HUECOS_DE_LIGA.forEach((sel, i) => {
          const el = tarjeta.querySelector(sel)
          if (el && guardado[i]) { el.outerHTML = guardado[i] }
        })
        return null
      }
      return completarLiga(supabase, tarjeta, t, ctx.rondasDe[id], { userId: ctx.userId, inscrito: ctx.miEstado[id] === 'active', inscritos: ctx.ocupadasDe[id] || 0, gente: ctx.gente })
        .then(() => ligaCompletada.set(id, HUECOS_DE_LIGA.map((sel) => tarjeta.querySelector(sel)?.outerHTML || '')))
        .catch(() => {})
    })
  )
}
// El reloj de la ronda en una liga en vivo (1346), con el mismo tictac
// orientativo que el aviso de arriba.
function ponerRelojesDeLiga(caja) {
  if (relojLigas) clearInterval(relojLigas)
  relojLigas = null
  const relojes = [...(caja?.querySelectorAll('[data-lc-reloj]') || [])]
  if (!relojes.length) return
  const tic = () => relojes.forEach((r) => (r.textContent = textoCuenta(new Date(r.dataset.lcReloj).getTime() - Date.now())))
  tic()
  relojLigas = setInterval(tic, 1000)
}

async function cargarLista(session, perfil = null) {
  quienMira = { session, perfil }
  const vacio = $('torneosVacio')
  // La lista de la última vez, ya (894); la clave lleva a quien mira,
  // porque la tarjeta dice si ESTÁS inscrito.
  const clave = claveDeVista('torneos', session?.user?.id)
  pintarUltimaVista(clave)
  const guardar = () => {
    vistaAlDia()
    guardarVista(clave, tomarPartes(['torneoVivo', 'torneosLigas', 'torneosSemana', 'listaTorneos', 'torneosVacio']), { visibles: visiblesDe(['torneoVivo', 'torneosLigas', 'torneosSemana', 'torneosVacio']) })
  }
  // Los torneos y las inscripciones no dependen una de otra: a la vez
  // (894, R3). Una sola consulta de inscripciones da la ocupación de cada
  // torneo Y mi estado (la sección es solo-admins: la RLS deja leerlo todo).
  const [{ data, error }, { data: inscripciones }] = await Promise.all([
    supabase
      .from('tournaments')
      .select('*')
      .order('start_at', { ascending: false })
      .limit(50),
    supabase
      .from('tournament_registrations')
      .select('tournament_id, user_id, status'),
  ])
  const torneos = data || []
  // El calendario pinta sobre esta misma lista: se guarda y, si es la
  // vista activa, se repinta con lo recién traído.
  torneosCargados = torneos
  pintarCalendario()
  const ocupadasDe = {}
  const miEstado = {}
  for (const i of inscripciones || []) {
    if (i.status === 'active') {
      ocupadasDe[i.tournament_id] = (ocupadasDe[i.tournament_id] || 0) + 1
    }
    // `session?.user` y no `session.user`: sin cuenta esto reventaba, y
    // hasta la 252 daba igual porque la página echaba a quien no fuese
    // admin. Ahora entra cualquiera.
    if (session?.user && i.user_id === session.user.id) miEstado[i.tournament_id] = i.status
  }

  // Las rondas de las ligas en juego (850), para saber cuáles están ENTRE
  // JORNADAS: en la base siguen `in_progress` toda la temporada, pero entre
  // una jornada y la siguiente no se está jugando nada. Si falla, se queda
  // en «no se sabe» y se pintan como siempre.
  const rondasDe = {}
  const ligasEnJuego = torneos.filter((t) => t.format === 'league' && t.status === 'in_progress').map((t) => t.id)

  // UNA consulta de perfiles para dos cosas: quién de los creadores es
  // admin del sitio (→ torneos oficiales) y la cara y el nombre de quien
  // organiza y de quien ganó. Las caras de los inscritos se fueron con las
  // tarjetas (1454): la fila dice cuántos son, y quiénes, la ficha. Si
  // falla, la lista sigue sin caras ni nombres.
  const quienes = new Set()
  for (const t of torneos) {
    if (t.admin_id) quienes.add(t.admin_id)
    if (t.champion_id) quienes.add(t.champion_id)
  }
  // Las rondas de las ligas y los perfiles salen de lo ya traído y no
  // dependen una de otra: a la vez (894, R3).
  const [rondasRes, perfilesRes] = await Promise.all([
    ligasEnJuego.length
      ? supabase.from('rounds').select('id, tournament_id, round_number, status, phase, started_at, closed_at, ends_at').in('tournament_id', ligasEnJuego)
      : Promise.resolve(null),
    quienes.size
      ? supabase
          .from('user_profiles')
          // sin rango: aquí `is_admin` NO es un rango que pintar — es quién
          // puede poner el sello de OFICIAL de PokeDoc. Y el nombre del
          // organizador va como texto en la tarjeta (tanda 386).
          .select('id, username, avatar_url, is_admin, tipo')
          .in('id', [...quienes])
      : Promise.resolve(null),
  ])
  if (rondasRes && !rondasRes.error) {
    for (const id of ligasEnJuego) rondasDe[id] = []
    for (const r of rondasRes.data || []) rondasDe[r.tournament_id].push(r)
  }
  const enPausa = (t) => Boolean(estadoDeTorneo(t, rondasDe[t.id] || null).pausa)
  const gente = {}
  if (perfilesRes) {
    const perfiles = perfilesRes.data || []
    for (const p of perfiles) gente[p.id] = p
    creadoresOficiales = new Set(perfiles.filter((p) => p.is_admin).map((p) => p.id))
  }

  // ── EL VACÍO DICE DE QUÉ ES, Y NO NOMBRA UN BOTÓN QUE NO ESTÁ (510) ──
  //
  // Decía siempre «crea el primero con el botón de arriba». Pero ese
  // botón se ESCONDE sin sesión (`btnNuevoTorneo`, unas líneas más
  // abajo), así que quien llega sin cuenta —y /torneos es el escaparate
  // abierto, por la tanda 252— leía que pulsara un botón que no existe en
  // su pantalla. Y si la consulta FALLA, también decía «no hay ningún
  // torneo»: un fallo nuestro presentado como un dato.
  vacio.classList.toggle('hidden', torneos.length > 0)
  if (!torneos.length) {
    vacio.textContent = error
      ? 'No se han podido cargar los torneos. Vuelve a intentarlo en un momento.'
      : session
        ? 'Todavía no hay ningún torneo. Crea el primero con el botón de arriba.'
        : 'Todavía no hay ningún torneo. Entra con tu cuenta para crear el primero.'
  }

  const yo = session?.user?.id || null
  const fila = (t, tramo) =>
    filaHtml(t, {
      tramo,
      ocupadas: ocupadasDe[t.id] || 0,
      miEstado: miEstado[t.id] || null,
      // «Organiza el equipo» y no el nombre del admin: un torneo oficial
      // lo firma PokeDoc, no la persona que le dio al botón.
      organiza: esOficial(t) ? 'Organiza el equipo' : gente[t.admin_id]?.username ? `Organiza ${gente[t.admin_id].username}` : '',
      organizador: esOficial(t) ? null : gente[t.admin_id] || null,
      campeonPerfil: t.status === 'finished' ? gente[t.champion_id] || null : null,
      soyCampeon: Boolean(yo && t.status === 'finished' && t.champion_id === yo),
      // Tu puesto en un terminado sale del podio guardado (como en el
      // perfil, 1395): fuera del podio, «Jugaste».
      puesto: yo && Array.isArray(t.podium) && t.podium.indexOf(yo) > 0 ? t.podium.indexOf(yo) + 1 : null,
      puedeBorrar: puedeBorrarTorneo(perfil, t, yo),
      puedeDuplicar: Boolean(yo) && ['finished', 'cancelled'].includes(t.status),
      rondas: rondasDe[t.id] || null,
      deTienda: esTorneoDeTienda(t, gente),
    })

  // «Por empezar» y «En juego» son cosas distintas (248) y lo siguen siendo
  // en la chapa de cada fila; en la agenda van juntos, por fecha. Una LIGA EN
  // CURSO (1303) va en su franja de arriba, con sus jornadas y su
  // clasificación, y no repetida en la agenda (sí con «Los míos»). Solo si se
  // saben sus rondas: si no, va donde iba.
  //
  // Desde la 1463 una liga en curso va DENTRO de la agenda, como un cartel
  // más (ya no en su franja): por la fecha de su próxima jornada, y «en
  // juego» solo mientras se juega una. Así la agenda nunca dice que no hay
  // nada que jugar con una jornada mañana.
  const ligasEnCurso = torneos.filter((t) => t.format === 'league' && t.status === 'in_progress' && rondasDe[t.id])
  const enCartelDeLiga = new Set(ligasEnCurso.map((t) => String(t.id)))
  const siguienteDe = new Map(ligasEnCurso.map((t) => [String(t.id), jornadasDeLiga(t, rondasDe[t.id]).siguiente]))
  const abiertas = torneos.filter((t) => t.status === 'registration_open')
  const enJuego = torneos.filter((t) => !enCartelDeLiga.has(String(t.id)) && t.status === 'in_progress' && !enPausa(t))
  const proximos = ordenarProximos(torneos.filter((t) => ['registration_open', 'registration_closed', 'in_progress'].includes(t.status)), {
    cuando: (t) => siguienteDe.get(String(t.id))?.fecha || t.start_at,
    enJuego: (t) => t.status === 'in_progress' && (enCartelDeLiga.has(String(t.id)) ? siguienteDe.get(String(t.id))?.estado === 'en_juego' : !enPausa(t)),
  })
  const acabados = torneos.filter((t) => ['finished', 'cancelled'].includes(t.status))
  const franja = $('torneosLigas')
  if (franja) { franja.hidden = true; franja.innerHTML = '' }

  pintarSemana(conJornadas(torneos))
  // Tu próximo torneo (1215): el más cercano en el que estás inscrito y que
  // todavía no ha empezado.
  const proximo = torneos
    .filter((t) => miEstado[t.id] && miEstado[t.id] !== 'dropped' && ['registration_open', 'registration_closed'].includes(t.status) && new Date(t.start_at) > Date.now() - 36e5)
    .sort((a, b) => new Date(a.start_at) - new Date(b.start_at))[0]
  // El tuyo en juego: el que manda arriba. Si hubiera dos (raro pero
  // posible), el que empezó antes — es el que lleva prisa. Una liga en curso
  // con sus rondas ya va EN VIVO en su tarjeta de la franja (1346).
  const vivo = torneos
    .filter((t) => t.status === 'in_progress' && miEstado[t.id] === 'active' && !enPausa(t) && !(t.format === 'league' && rondasDe[t.id]))
    .sort((a, b) => new Date(a.start_at) - new Date(b.start_at))[0] || null
  // LO TUYO EN UNA PIEZA (1454): jugando, el combate manda y el próximo va
  // en una línea debajo («Después: …»); sin jugar, el próximo es el cartel.
  const vivoListo = pintarVivo(vivo, proximo || null)
  const cajaProximo = $('torneosProximo')
  if (cajaProximo) {
    const enCartel = proximo && !vivo
    cajaProximo.innerHTML = enCartel ? proximoHtml(proximo, ocupadasDe[proximo.id] || 0) : ''
    cajaProximo.hidden = !enCartel
    document.querySelector('.torneos-heroe')?.classList.toggle('con-proximo', Boolean(enCartel))
  }
  // Las cifras de la banda (1212), de los torneos ya cargados.
  // «En juego» cuenta también las ligas en curso (1303), y si solo hay ligas
  // lo dice: «1 liga en curso» (entre jornadas una liga no «se juega»).
  for (const [id, n] of [['tNAbiertas', abiertas.length], ['tNEnJuego', enJuego.length + ligasEnCurso.length], ['tNTerminados', acabados.length]]) {
    const el = $(id)
    if (el) el.textContent = String(n)
  }
  // Una liga en marcha ES un torneo en juego (1463), entre jornadas también:
  // la cifra dice «en juego» siempre.
  const textoEnJuego = $('tNEnJuegoTexto')
  if (textoEnJuego) textoEnJuego.textContent = 'en juego'
  pintarAgenda({
    proximos,
    hechos: acabados,
    borradores: borradoresDe(torneos, yo),
    fila,
    // «Los míos»: donde estás apuntado (o jugaste) y los que organizas tú.
    mio: (t) => Boolean(miEstado[t.id]) || (Boolean(yo) && t.admin_id === yo),
    oficial: esOficial,
    organiza: (t) => gente[t.admin_id]?.username || '',
    cartel: (t) => (enCartelDeLiga.has(String(t.id))
      ? ligaCartelHtml(t, rondasDe[t.id], { inscrito: miEstado[t.id] === 'active' })
      : cartelDe(t, { ocupadas: ocupadasDe[t.id] || 0, miEstado: miEstado[t.id] || null, rondas: rondasDe[t.id] || null, gente })),
    ligas: { porId: new Map(ligasEnCurso.map((t) => [String(t.id), t])), rondasDe, miEstado, ocupadasDe, gente, userId: yo },
    conSesion: Boolean(session),
  })
  // Lo de ahora, guardado para la próxima vez (894): ya, y otra vez cuando
  // lleguen la barra del torneo en juego y los sprites del meta.
  guardar()
  Promise.resolve(vivoListo).then(guardar, () => {})
  // Los torneos sin imagen llevan los sprites del meta (796, SI4).
  // Y los terminados, el mazo de su campeón (1216), encima de los del meta.
  // (El del campeón lo pone ya la agenda al pintar los terminados.)
  import('./arte-meta.js').then((m) => m.ponerArteDelMeta(document)).catch(() => {}).then(guardar)
}

// ── El calendario anual (tanda 242, pedido por Ibai) ──
//
// El año entero, mes a mes, con los días de torneo en navy: la vista
// de «¿cuándo se juega?» que una lista ordenada no da. Se pinta de la
// MISMA lista ya cargada (nada de consultas nuevas); en una liga
// cuentan también sus jornadas, que son días de juego de verdad.
let torneosCargados = []
let vistaTorneos = localStorage.getItem('pokedoc-torneos-vista') === 'calendario' ? 'calendario' : 'lista'
// La ventana del calendario EMPIEZA en el mes actual (tanda 243): lo
// que importa es lo que viene, y lo pasado se alcanza con la flecha.
const hoyCal = new Date()
let inicioCalendario = { anio: hoyCal.getFullYear(), mes: hoyCal.getMonth() }

function claveDeDia(fecha) {
  const d = new Date(fecha)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function torneosPorDia() {
  const porDia = new Map()
  // Cada jornada de una liga es un día de juego con su nombre (1303): «Liga
  // FDN · J6» y su hora, no la fecha de la liga.
  for (const t of conJornadas(torneosCargados)) {
    if (t.status === 'cancelled' || !t.start_at) continue
    const clave = claveDeDia(t.start_at)
    if (!porDia.has(clave)) porDia.set(clave, [])
    if (!porDia.get(clave).some((x) => x.id === t.id)) porDia.get(clave).push(t)
  }
  return porDia
}

// `direccion` dice de dónde viene el cambio (−1 atrás, 1 adelante, 0
// primer pintado) y decide hacia dónde desliza la animación de entrada.
function pintarCalendario(direccion = 0) {
  const caja = $('torneosCalendario')
  if (!caja || vistaTorneos !== 'calendario') return
  const porDia = torneosPorDia()
  const hoy = claveDeDia(new Date())
  const mesDeHoy = `${hoyCal.getFullYear()}-${hoyCal.getMonth()}`

  // SEIS meses por página (tanda 245: doce eran demasiados) — tres por
  // fila, dos filas —, empezando por el mes en el que estamos (o donde
  // hayan llevado las flechas), cruzando el cambio de año sin cortarse.
  const meses = []
  for (let i = 0; i < 6; i++) {
    const primero = new Date(inicioCalendario.anio, inicioCalendario.mes + i, 1)
    const anio = primero.getFullYear()
    const mes = primero.getMonth()
    const nombreMes = primero.toLocaleString('es-ES', { month: 'long' })
    const diasEnMes = new Date(anio, mes + 1, 0).getDate()
    // La semana empieza en lunes, como los calendarios de aquí.
    const hueco = (primero.getDay() + 6) % 7
    const celdas = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
      .map((d) => `<span class="torneo-cal-diasemana">${d}</span>`)
      .join('')
      .concat('<span></span>'.repeat(hueco))
    let dias = ''
    for (let dia = 1; dia <= diasEnMes; dia++) {
      const clave = `${anio}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
      const deEsteDia = porDia.get(clave)
      const esHoy = clave === hoy ? ' hoy' : ''
      // El color distingue quién organiza: navy los oficiales, hielo
      // los de la comunidad. Un día con de los dos cuenta como oficial
      // (es el color que más importa no perder).
      const conOficial = deEsteDia?.some(esOficial) ? ' oficial' : ''
      const conJornada = deEsteDia?.some((t) => t.jornadaDeLiga) ? ' con-jornada' : ''
      dias += deEsteDia
        ? `<button type="button" class="torneo-cal-dia con-torneo${conOficial}${conJornada}${esHoy}" data-cal-dia="${clave}"
            title="${escapeHtml(deEsteDia.map((t) => `${t.name}${t.jornadaDeLiga ? ` · J${t.jornadaDeLiga}` : ''}${esOficial(t) ? ' (oficial)' : ''}`).join(' · '))}">${dia}</button>`
        : `<span class="torneo-cal-dia${esHoy}">${dia}</span>`
    }
    const esMesActual = `${anio}-${mes}` === mesDeHoy
    // El --i escalona la entrada de las tarjetas (25 ms por mes).
    meses.push(`<div class="torneo-cal-mes ${esMesActual ? 'actual' : ''}" style="--i:${i}">
      <h5>${escapeHtml(nombreMes)} <span class="torneo-cal-anio">${anio}</span>${esMesActual ? '<span class="torneo-cal-chapa-hoy">hoy</span>' : ''}</h5>
      <div class="torneo-cal-dias">${celdas}${dias}</div></div>`)
  }

  const fin = new Date(inicioCalendario.anio, inicioCalendario.mes + 5, 1)
  const rango = `${new Date(inicioCalendario.anio, inicioCalendario.mes, 1).toLocaleString('es-ES', { month: 'long' })} ${inicioCalendario.anio} — ${fin.toLocaleString('es-ES', { month: 'long' })} ${fin.getFullYear()}`
  const claseEntrada = direccion > 0 ? 'cal-entra-der' : direccion < 0 ? 'cal-entra-izq' : 'cal-entra'
  // Las flechas pasan de PÁGINA en página (los mismos 6 meses que se
  // ven). Sin botón «Hoy»: el presente queda a un toque y el botón
  // solo estorbaba en la cabecera.
  caja.innerHTML = `
    <div class="torneo-cal-cabecera">
      <button type="button" class="btn-secondary" data-cal-mes="-6" aria-label="Página anterior">←</button>
      <strong class="torneo-cal-rango">${escapeHtml(rango)}</strong>
      <button type="button" class="btn-secondary" data-cal-mes="6" aria-label="Página siguiente">→</button>
    </div>
    <div class="torneo-cal-leyenda">
      <span><span class="torneo-cal-punto oficial"></span> Oficial PokeDoc</span>
      <span><span class="torneo-cal-punto comunidad"></span> Comunidad</span>
    </div>
    <div class="torneo-cal-meses ${claseEntrada}">${meses.join('')}</div>
    <div id="torneoCalDia"></div>`

  caja.querySelectorAll('[data-cal-mes]').forEach((b) =>
    b.addEventListener('click', () => {
      const paso = Number(b.dataset.calMes)
      const d = new Date(inicioCalendario.anio, inicioCalendario.mes + paso, 1)
      inicioCalendario = { anio: d.getFullYear(), mes: d.getMonth() }
      pintarCalendario(paso)
    })
  )
  caja.querySelectorAll('[data-cal-dia]').forEach((b) =>
    b.addEventListener('click', () => {
      const clave = b.dataset.calDia
      const lista = porDia.get(clave) || []
      // La clave es un día, no un instante: se construye la fecha LOCAL
      // a mano (parsear '2026-08-30' a secas la haría UTC y saldría una
      // hora fantasma en el título).
      const [a, m, d] = clave.split('-').map(Number)
      const titulo = new Date(a, m - 1, d).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
      // El día elegido se marca en la rejilla y el panel entra animado.
      caja.querySelectorAll('.torneo-cal-dia.elegido').forEach((x) => x.classList.remove('elegido'))
      b.classList.add('elegido')
      $('torneoCalDia').innerHTML = `
        <div class="torneo-cal-dia-panel">
        <h4 class="torneo-cal-dia-titulo">${escapeHtml(titulo[0].toUpperCase() + titulo.slice(1))}</h4>
        ${lista
          .map(
            (t) => `
          <a class="torneo-cal-torneo" href="/torneo?slug=${encodeURIComponent(t.slug)}">
            ${
              t.image_url
                ? `<img class="torneo-tarjeta-imagen" src="${escapeHtml(t.image_url)}" alt="" loading="lazy" onerror="this.style.display='none'" />`
                : ''
            }
            <span class="torneo-cal-torneo-nombre"><strong>${escapeHtml(t.name)}${t.jornadaDeLiga ? ` · Jornada ${t.jornadaDeLiga}` : ''}</strong>
              <span class="subtext">${escapeHtml(fechaBonita(t.start_at))}</span></span>
            ${t.is_private ? CHAPA_PRIVADO() : ''}
            ${esOficial(t) ? chapaTipoHtml('oficial') : ''}
            <span class="torneo-estado ${(ESTADOS[t.status] || ESTADOS.draft).clase}">${(ESTADOS[t.status] || ESTADOS.draft).texto}</span>
          </a>`
          )
          .join('')}
        </div>`
      $('torneoCalDia').scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
  )
}

// El conmutador Lista/Calendario. La elección se recuerda por
// navegador: quien piensa en fechas vuelve a encontrarse su calendario.
// «A un torneo» desde Mazos (1358): mientras eliges, una línea dice qué mazo
// llevas; la ficha del torneo pone su lista al ir a inscribirte.
function pintarMazoElegido() {
  const caja = document.getElementById('torneosMazoElegido')
  let nombre = null
  try { nombre = sessionStorage.getItem('pd-mazo-a-torneo') && sessionStorage.getItem('pd-mazo-a-torneo-nombre') } catch {}
  if (!caja || !nombre) return
  caja.innerHTML = `${icons.layers?.(16) || ''}<span>Elige torneo para <b>${escapeHtml(nombre)}</b>: al inscribirte, su lista va puesta.</span><button type="button" class="link-btn">Quitar</button>`
  caja.hidden = false
  caja.querySelector('button').addEventListener('click', () => {
    try { sessionStorage.removeItem('pd-mazo-a-torneo'); sessionStorage.removeItem('pd-mazo-a-torneo-nombre') } catch {}
    caja.hidden = true
  })
}

function engancharVistas() {
  const aplicar = () => {
    document.querySelectorAll('[data-vista-torneos]').forEach((b) =>
      b.classList.toggle('activa', b.dataset.vistaTorneos === vistaTorneos)
    )
    const calendario = vistaTorneos === 'calendario'
    $('torneosCalendario').classList.toggle('hidden', !calendario)
    $('listaTorneos').classList.toggle('hidden', calendario)
    if (calendario) $('torneosVacio').classList.add('hidden')
    mostrarSemana()
    // El icono de la cabecera (1021, móvil): enseña la OTRA vista.
    const icono = $('torneosVistaIcono')
    if (icono) {
      icono.hidden = false
      icono.innerHTML = calendario ? (icons.alignLeft?.(20) || '') : (icons.calendar?.(20) || '')
      icono.setAttribute('aria-label', calendario ? 'Ver como lista' : 'Ver como calendario')
    }
    pintarCalendario()
    colocarMandosTorneos()
  }
  $('torneosVistaIcono')?.addEventListener('click', () => {
    vistaTorneos = vistaTorneos === 'calendario' ? 'lista' : 'calendario'
    localStorage.setItem('pokedoc-torneos-vista', vistaTorneos)
    aplicar()
  })
  document.querySelectorAll('[data-vista-torneos]').forEach((b) =>
    b.addEventListener('click', () => {
      vistaTorneos = b.dataset.vistaTorneos
      localStorage.setItem('pokedoc-torneos-vista', vistaTorneos)
      aplicar()
    })
  )
  aplicar()
}

// ── Crear (1434): una pregunta cada vez, en js/torneos/crear.js ──
// Se baja al pulsar «Crear un torneo» (o «Duplicar»): quien solo mira la lista
// no paga ni el módulo, ni su hoja, ni el editor de la descripción.
async function abrirCreador(session, perfil, plantilla = null) {
  const { abrirCrear } = await import('./crear.js')
  await abrirCrear({ session, perfil, plantilla, alCrear: () => cargarLista(session, perfil) })
}

function engancharFormulario(session, perfil) {
  $('btnNuevoTorneo').addEventListener('click', () => abrirCreador(session, perfil))
  // Los «⋯» de las tarjetas (1348): se cierran al tocar fuera. Y como la
  // tarjeta es un enlace, abrirlos no navega.
  document.addEventListener('click', (e) => {
    for (const mas of document.querySelectorAll('details.torneo-tarjeta-mas[open]')) if (!mas.contains(e.target)) mas.open = false
  })
  // Borrar desde la tarjeta (tanda 223). Dos toques como en la ficha: el
  // primero avisa —y dice a cuánta gente afecta—, el segundo va. La
  // tarjeta es un enlace al torneo, de ahí el preventDefault.
  document.addEventListener('click', async (e) => {
    const boton = e.target.closest('[data-borrar]')
    if (!boton) return
    e.preventDefault()
    const dentro = Number(boton.dataset.dentro || 0)
    if (boton.dataset.confirmar !== '1') {
      boton.dataset.confirmar = '1'
      boton.textContent = textoConfirmarBorrado(dentro)
      return
    }
    boton.disabled = true
    const { error, diferido } = await borrarTorneo(boton.dataset.borrar, dentro)
    if (error) {
      boton.disabled = false
      boton.dataset.confirmar = ''
      boton.textContent = 'Borrar'
      showToast(`No se ha podido borrar: ${error.message}`, 'error')
      return
    }
    showToast(
      diferido
        ? `«${boton.dataset.nombre}» cancelado. Se avisa a ${dentro} inscrito${dentro === 1 ? '' : 's'} y desaparece en un minuto.`
        : `«${boton.dataset.nombre}» borrado.`,
      'success'
    )
    await recargarLista()
  })

  // Duplicar: el creador con todo lo del torneo elegido, directo a «¿Lo
  // creamos?» para cambiar solo lo que haga falta (la fecha la pone él).
  document.addEventListener('click', async (e) => {
    const boton = e.target.closest('[data-duplicar]')
    if (!boton) return
    e.preventDefault()
    const { data: viejo } = await supabase.from('tournaments').select('*').eq('id', boton.dataset.duplicar).maybeSingle()
    if (viejo) await abrirCreador(session, perfil, viejo)
  })
}

async function init() {
  const session = await getSession()
  const perfil = session ? await getProfile(session.user.id) : null
  // Los avisos de torneos que ya no existen (1406): por su lado, sin esperar.
  if (session) leerAvisosHuerfanos(supabase, session.user.id).catch(() => {})
  // Esta página NO echa a nadie: la lista y el calendario se ven sin
  // cuenta (escaparate). Apuntarse ya se lo pide la ficha, que a quien
  // no tenga cuenta lo manda al registro.
  //
  // CREAR un torneo lo puede hacer cualquiera con cuenta (tanda 266).
  // Antes era del equipo, y a un usuario normal ni le salía el botón.
  // Quien no ha entrado sí lo tiene escondido: el formulario acabaría en
  // un INSERT sin dueño, y la base lo rechazaría en silencio.
  document.getElementById('btnNuevoTorneo')?.classList.toggle('hidden', !session)
  // Escondida con `visibility` y no con `display` (981): ocupando su sitio
  // desde el principio, el pie no se ve a media pantalla y luego cae.
  document.getElementById('torneosContenido').style.display = ''
  document.getElementById('torneosContenido').style.visibility = ''
  // El aviso de «borrado» lo deja la ficha antes de traernos aquí: allí
  // no se podía enseñar, porque la página que lo diría ya no existe.
  const borrado = sessionStorage.getItem('torneo-borrado')
  if (borrado) {
    const avisados = Number(sessionStorage.getItem('torneo-borrado-inscritos') || 0)
    sessionStorage.removeItem('torneo-borrado')
    sessionStorage.removeItem('torneo-borrado-inscritos')
    // Con gente dentro el borrado es diferido (tanda 223): primero se
    // les avisa y luego desaparece. Decirlo, para que no extrañe verlo
    // todavía ahí un minuto más.
    showToast(
      avisados
        ? `«${borrado}» cancelado. Se avisa a ${avisados} inscrito${avisados === 1 ? '' : 's'} y desaparece en un minuto.`
        : `«${borrado}» borrado.`,
      'success'
    )
  }
  engancharFormulario(session, perfil)
  engancharVistas()
  engancharAgenda()
  pintarMazoElegido()
  // «Crear uno» desde /colabora (1153): `?crear=1` abre el formulario ya.
  // Sin cuenta el botón está escondido y el formulario no serviría: se queda
  // la lista (el registro lo pide el propio /colabora).
  if (session && new URLSearchParams(location.search).get('crear') === '1') {
    void abrirCreador(session, perfil)
  }
  await cargarLista(session, perfil)
}

init()
