// «Lo próximo» en carteles (1463, propuesta «Torneos más visuales», PINGU:
// «podemos hacer que los próximos salgan en grande (los primeros) y los
// demás que sean más tarde, en formato lista»). Los tres primeros de la
// agenda van como carteles: su imagen (o un fondo del color de su tipo con su
// icono y los Pokémon del meta), el día en una losa, sus chapas de color, las
// plazas y el botón. En el móvil, un carrusel que se desliza de lado. Lo que
// viene después sigue en filas (torneos.js).
//
// La liga en curso es un cartel más (ligas-franja.js, `ligaCartelHtml`), en su
// sitio por la fecha de su próxima jornada: ya no hay franja aparte ni una
// agenda que dice «no hay ningún torneo» con la jornada 8 mañana.
import { escapeHtml } from '../html.js'
import { icons } from '../icons.js'
import { chapaTipoHtml, tipoPrincipal } from '../chapa-tipo.js'

export const CARTELES = 3
const DIA = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const MARCA = { online: 'globe', persona: 'mapPin', liga: 'trophy' }

// «Hoy», «Mañana», «En 4 días» (hasta una semana); más lejos, nada: la losa
// ya dice el día.
export function cuandoCorto(fecha, ahora = Date.now()) {
  const f = new Date(fecha)
  if (!Number.isFinite(f.getTime())) return ''
  const dia = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const n = Math.round((dia(f) - dia(new Date(ahora))) / 864e5)
  if (n < 0) return ''
  return n === 0 ? 'Hoy' : n === 1 ? 'Mañana' : n <= 7 ? `En ${n} días` : ''
}

// La losa del día: «VIE / 27 / 18:00».
export function losaHtml(fecha) {
  const d = new Date(fecha)
  if (!Number.isFinite(d.getTime())) return ''
  const hora = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  return `<span class="t-cartel-dia"><small>${DIA[d.getDay()]}</small><b>${d.getDate()}</b><i>${escapeHtml(hora)}</i></span>`
}

// El fondo: la imagen del torneo (el banner si lo tiene, que es apaisado) o
// el color de su tipo con su icono grande. `ponerArteDelMeta` le pone encima
// los tres mazos del meta a los que no tienen imagen (por `.torneo-arte`).
export function arteHtml(t, { tipo = tipoPrincipal(t), arriba = '', abajo = '' } = {}) {
  const url = `/torneo?slug=${encodeURIComponent(t.slug)}`
  const imagen = t.banner_url || t.image_url
  return `<a class="t-cartel-arte torneo-arte" href="${url}" data-torneo="${escapeHtml(String(t.id))}" data-tipo-torneo="${tipo}" tabindex="-1" aria-hidden="true">
      ${imagen ? `<img class="torneo-arte-imagen t-cartel-imagen" src="${escapeHtml(imagen)}" alt="" loading="lazy" onerror="this.remove()" />` : `<span class="t-cartel-marca">${icons[MARCA[tipo] || 'trophy'](150)}</span>`}
      ${losaHtml(t._cuando || t.start_at)}
      ${arriba ? `<span class="t-cartel-tipos">${arriba}</span>` : ''}
      ${abajo ? `<span class="t-cartel-cuando">${abajo}</span>` : ''}
    </a>`
}

// Un torneo suelto. `d` lo prepara torneos.js con lo mismo que su fila: el
// botón, quién organiza, las plazas, si es oficial…
export function cartelHtml(t, d = {}) {
  const { ocupadas = 0, oficial = false, viva = false, estadoTexto = '', accion = null, inscrito = false, organiza = '', caraOrganiza = '', donde = '', estructura = '', precio = '', premio = '', repite = '', privado = '', mio = false, ahora = Date.now() } = d
  const tipo = tipoPrincipal(t)
  const url = `/torneo?slug=${encodeURIComponent(t.slug)}`
  const arriba = [viva ? chapaTipoHtml('vivo', { texto: estadoTexto || 'En juego', llena: true }) : '', oficial ? chapaTipoHtml('oficial', { llena: true }) : '', chapaTipoHtml(tipo, { llena: true })].join('')
  const sinLimite = t.max_players == null
  const pct = sinLimite ? 0 : Math.min(100, (ocupadas / t.max_players) * 100)
  const plazas = sinLimite
    ? `<span class="t-cartel-plazas sin-barra"><span>${ocupadas} inscrito${ocupadas === 1 ? '' : 's'}</span></span>`
    : `<span class="t-cartel-plazas${pct >= 80 ? ' apurada' : ''}"><span class="t-cartel-barra"><i style="width:${pct}%"></i></span><span>${ocupadas}/${t.max_players}</span></span>`
  const chips = [privado, repite ? chapaTipoHtml('repite', { texto: repite }) : '', premio ? `<span class="t-cartel-premio">${icons.trophy(12)} ${escapeHtml(premio)}</span>` : ''].filter(Boolean).join('')
  const boton = inscrito
    // Con el nombre en la etiqueta, como en la fila: un lector de pantalla
    // que salta de botón en botón oye «Estás inscrito: ver Copa…», no tres
    // «Inscrito» seguidos sin saber de qué torneo.
    ? `<a class="torneo-fila-inscrito t-cartel-boton" href="${url}" aria-label="Estás inscrito: ver ${escapeHtml(t.name)}">${icons.checkCircle(14)} Inscrito</a>`
    : accion ? `<a class="${accion.clase} t-cartel-boton" href="${url}" aria-label="${escapeHtml(accion.texto)}: ${escapeHtml(t.name)}">${escapeHtml(accion.texto)}</a>` : ''
  return `<article class="t-cartel${inscrito || mio ? ' t-cartel-mio torneo-tarjeta-mia' : ''}" data-tipo-torneo="${viva ? 'vivo' : tipo}" data-torneo-id="${escapeHtml(String(t.id))}">
    ${arteHtml(t, { tipo, arriba, abajo: viva ? '' : cuandoCorto(t.start_at, ahora) })}
    <div class="t-cartel-cuerpo">
      <h3 class="t-cartel-nombre"><a href="${url}">${escapeHtml(t.name)}</a></h3>
      <p class="t-cartel-sub">${[donde, estructura, precio].filter(Boolean).map((x) => `<span>${x}</span>`).join('')}</p>
      ${chips ? `<p class="t-cartel-chips">${chips}</p>` : ''}
      ${plazas}
      <div class="t-cartel-pie">
        <span class="t-cartel-organiza">${caraOrganiza}<span>${escapeHtml(organiza)}</span></span>
        ${boton}
      </div>
    </div>
  </article>`
}

// El hueco que completa la fila cuando hay menos de tres. Con un filtro
// puesto, sigue siendo un hueco con «Quitar los filtros» (lo que falta es
// culpa del filtro). Sin filtro, desde la 1468 ya no es un recuadro punteado
// de media pantalla (PINGU, con la captura delante: «¿guay? o se puede
// mejorar más»): son tarjetas del MISMO tamaño que un cartel, una por hueco,
// que invitan a algo (`.t-invita` y no `.t-cartel`: un cartel es un torneo
// al que apuntarse, como dice la 1464) — organizar el tuyo (con sesión; sin ella, entrar: el
// botón de crear no existe sin cuenta, la 510) y, si queda otro hueco, ver
// qué se juega en el meta.
export function huecoHtml({ conSesion = false, conFiltro = false, n = 0 } = {}) {
  if (conFiltro) {
    return `<div class="t-cartel-hueco">${icons.trophy(28)}<p>No hay más con estos filtros.</p><button type="button" class="btn-secondary" data-quitar-filtros>Quitar los filtros</button></div>`
  }
  return invitaHtml({ conSesion, n })
}

const MAS = '<svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>'
export function invitaHtml({ conSesion = false, n = 0 } = {}) {
  const ceja = n ? '' : '<p class="t-invita-ceja">No hay ningún torneo abierto ahora mismo.</p>'
  const boton = conSesion
    ? '<button type="button" class="btn-primary t-cartel-boton" data-crear-torneo>Crear un torneo</button>'
    : '<a class="btn-primary t-cartel-boton" href="/auth">Entra para crear uno</a>'
  return `<article class="t-invita" data-invita="crear">
    <span class="t-invita-arte" aria-hidden="true">${MAS}</span>
    <div class="t-cartel-cuerpo">
      ${ceja}<h3 class="t-cartel-nombre">Organiza el tuyo</h3>
      <p class="t-invita-texto">Suizo, top cut y clasificación en vivo. Se monta en 2 minutos.</p>
      ${boton}
    </div>
  </article>`
}

export function metaInvitaHtml() {
  return `<article class="t-invita t-invita-meta" data-invita="meta">
    <span class="t-invita-arte" aria-hidden="true">${icons.barChart(40)}</span>
    <div class="t-cartel-cuerpo">
      <h3 class="t-cartel-nombre">Lo que se juega</h3>
      <p class="t-invita-texto">Los mazos que más ganan esta semana, para llegar al próximo con el tuyo listo.</p>
      <a class="btn-secondary t-cartel-boton" href="/meta">Ver el meta</a>
    </div>
  </article>`
}

export function cartelesHtml(carteles, { conSesion = false, conFiltro = false } = {}) {
  const n = carteles.length
  const huecos = []
  if (n < CARTELES) {
    huecos.push(huecoHtml({ conSesion, conFiltro, n }))
    if (!conFiltro && CARTELES - n >= 2) huecos.push(metaInvitaHtml())
  }
  const total = n + huecos.length
  const puntos = total > 1 ? `<div class="t-carteles-puntos" aria-hidden="true">${Array.from({ length: total }, (_, i) => `<i${i ? '' : ' class="on"'}></i>`).join('')}</div>` : ''
  return `<section class="torneos-tramo t-carteles-tramo"><h2 class="torneos-tramo-cab">Lo próximo</h2>
    <div class="t-carteles" data-n="${n}">${carteles.join('')}${huecos.join('')}</div>${puntos}</section>`
}

// ── CAMPEONES (1464, propuesta «Campeones y ficha», PINGU: «le podemos dar
// más importancia a los ganadores en la lista») ──
//
// Los últimos terminados ya no son una fila con una copita y un nombre en
// medio: son carteles DORADOS con la cara de quien ganó en grande, su mazo
// (lo pone arte-meta.js en `.t-campeon-mazo`, de la lista del campeón que ya
// se pide para el arte), el 2.º y el 3.º del podio guardado y, si jugaste,
// cómo quedaste. El oro es SOLO de esto: los carteles de «Lo próximo» van del
// color de su tipo, así se distinguen de un vistazo.
//
// Es `.t-campeon` y no `.t-cartel`: un cartel es algo a lo que apuntarse.
const CORONA = '<svg class="t-campeon-corona" viewBox="0 0 30 22" width="30" height="22" aria-hidden="true"><path fill="currentColor" d="M2 20h26l2-15-8 6-7-10-7 10-8-6z"/></svg>'
export function campeonHtml(t, d = {}) {
  const { campeon = null, caraCampeon = '', segundo = null, tercero = null, ocupadas = 0, oficial = false, soyCampeon = false, puesto = null, jugaste = false } = d
  const tipo = tipoPrincipal(t)
  const url = `/torneo?slug=${encodeURIComponent(t.slug)}`
  const id = escapeHtml(String(t.id))
  const chapas = [oficial ? chapaTipoHtml('oficial', { llena: true }) : '', chapaTipoHtml(tipo, { llena: true })].join('')
  const podio = [[2, segundo], [3, tercero]].filter(([, p]) => p).map(([n, p]) => `<span><i class="t-campeon-medalla m${n}" aria-label="${n}.º">${n}</i>${p.cara}<span>${escapeHtml(p.nombre)}</span></span>`).join('')
  // El pie dice SIEMPRE algo tuyo (1468): cómo quedaste o, si no jugaste,
  // la puerta a sus mazos (`?ver=meta` abre la pestaña Mazos, 1447). Antes,
  // sin jugar, repetía «N jugadores», que ya va arriba junto al nombre.
  const tuyo = soyCampeon
    ? '<b class="t-campeon-tu oro">¡Ganaste tú!</b>'
    : puesto
      ? `<b class="t-campeon-tu">Quedaste ${puesto}.º</b>`
      : jugaste
        ? '<span class="t-campeon-tu suave">Jugaste</span>'
        : `<a class="t-campeon-tu suave" href="${url}&amp;ver=meta">Ver sus mazos</a>`
  return `<article class="t-campeon${soyCampeon || puesto || jugaste ? ' t-campeon-mio' : ''}" data-tipo-torneo="${tipo}" data-torneo-id="${id}">
    <a class="t-campeon-arte" href="${url}" tabindex="-1" aria-hidden="true">
      <span class="t-campeon-rayos"></span>
      ${losaHtml(t.start_at)}
      <span class="t-cartel-tipos">${chapas}</span>
      <span class="t-campeon-cara">${CORONA}${caraCampeon}</span>
    </a>
    <div class="t-campeon-cuerpo">
      <span class="t-campeon-torneo"><a href="${url}">${escapeHtml(t.name)}</a>${ocupadas ? ` · ${ocupadas} jugador${ocupadas === 1 ? '' : 'es'}` : ''}</span>
      <h3 class="t-campeon-nombre"><small>${icons.trophy(11)} Campeón</small>${escapeHtml(campeon?.username || '—')}</h3>
      <span class="t-campeon-mazo torneo-arte con-meta" data-torneo="${id}" data-con-nombre></span>
      ${podio ? `<span class="t-campeon-podio">${podio}</span>` : ''}
      <span class="t-campeon-pie">${tuyo}<a class="t-campeon-ver" href="${url}" aria-label="Ver resultados: ${escapeHtml(t.name)}">Ver resultados</a></span>
    </div>
  </article>`
}

// El tramo: los carteles en una fila (en el móvil, el mismo carrusel que «Lo
// próximo», con sus puntos) y lo que no tiene campeón (un cancelado), en filas.
export function campeonesHtml(carteles, filas = '') {
  const n = carteles.length
  const puntos = n > 1 ? `<div class="t-carteles-puntos" aria-hidden="true">${carteles.map((_, i) => `<i${i ? '' : ' class="on"'}></i>`).join('')}</div>` : ''
  return `<section class="torneos-tramo t-campeones-tramo torneos-ultimos"><h2 class="torneos-tramo-cab">Campeones</h2>
    ${n ? `<div class="t-carteles t-campeones" data-n="${n}">${carteles.join('')}</div>${puntos}` : ''}${filas ? `<div class="torneos-filas">${filas}</div>` : ''}</section>`
}
