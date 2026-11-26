// /torneos, «Arena limpia» (propuesta de PINGU y Manso: «algo sencillo,
// visual, que si hay muchos torneos se puedan ver, los pasados también»).
//
// Una fila por torneo, TODAS iguales, y lo que la distingue de un vistazo es
// SU IMAGEN: la cuadrada del torneo (`image_url`) a la izquierda y su banner
// (`banner_url`) difuminado al fondo de la derecha (PINGU: «la imagen que la
// gente mete… ¿se podría hacer y que así se diferenciase más rápido la
// fila?»). Sin imagen, sus iniciales en el color de su tipo; sin banner, un
// velo de ese color. El color de su tipo (online, en persona, liga) va en la
// fecha y en el borde: dice «qué es», como en toda la web (chapa-tipo.js).
//
// Arriba, UN torneo destacado con su banner grande: el tuyo más cercano, o el
// oficial, o el primero que tenga banner. Todo lo de aquí es puro: lo pinta
// torneos.js con los datos ya traídos.
import { escapeHtml } from '../html.js'
import { icons } from '../icons.js'
import { chapaTipoHtml, tipoPrincipal } from '../chapa-tipo.js'

const DIA = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const hora = (d) => d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
const MARCA = { online: 'globe', persona: 'mapPin', liga: 'trophy', vivo: 'gamepad' }

// Las iniciales de un torneo sin imagen: las dos primeras palabras que
// cuentan («Sábado en Madrid» → «SM»). Mejor que un icono: dos torneos sin
// imagen no se parecen.
export function inicialesDe(nombre) {
  const VACIAS = new Set(['de', 'del', 'la', 'el', 'en', 'los', 'las', 'y', 'x', 'a', 'al', '·', '-'])
  const palabras = String(nombre || '').replace(/[[\]()]/g, ' ').split(/\s+/).filter((p) => p && !VACIAS.has(p.toLowerCase()))
  return (palabras.slice(0, 2).map((p) => p[0]).join('') || '?').toUpperCase()
}

// La imagen cuadrada, o las iniciales en su color.
export function avatarDeTorneoHtml(t, { tipo = tipoPrincipal(t), clase = 'tf-avatar' } = {}) {
  return t.image_url
    ? `<span class="${clase}" data-tipo-torneo="${tipo}"><img src="${escapeHtml(t.image_url)}" alt="" loading="lazy" onerror="this.parentElement.classList.add('sin-imagen');this.parentElement.textContent=${escapeHtml(JSON.stringify(inicialesDe(t.name)))}" /></span>`
    : `<span class="${clase} sin-imagen" data-tipo-torneo="${tipo}" aria-hidden="true">${escapeHtml(inicialesDe(t.name))}</span>`
}

// Los grupos por mes, del primero al último (lo que viene) o al revés (los
// terminados): «Noviembre», y el año solo si no es este.
export function porMeses(torneos, { recientes = false, cuando = (t) => t.start_at, ahora = new Date() } = {}) {
  const grupos = []
  const orden = [...(torneos || [])].sort((a, b) => (new Date(cuando(a)) - new Date(cuando(b))) * (recientes ? -1 : 1))
  for (const t of orden) {
    const d = new Date(cuando(t))
    const clave = `${d.getFullYear()}-${d.getMonth()}`
    let g = grupos[grupos.length - 1]
    if (!g || g.clave !== clave) {
      const mes = d.toLocaleString('es-ES', { month: 'long' })
      g = { clave, texto: `${mes.charAt(0).toUpperCase()}${mes.slice(1)}${d.getFullYear() !== ahora.getFullYear() ? ` ${d.getFullYear()}` : ''}`, torneos: [] }
      grupos.push(g)
    }
    g.torneos.push(t)
  }
  return grupos
}

// Las caras de los apuntados, tres como mucho.
const carasHtml = (caras = []) => (caras.length ? `<span class="tf-caras" aria-hidden="true">${caras.slice(0, 3).join('')}</span>` : '')

// `d` lo prepara torneos.js: { tipo, ocupadas, caras, viva, enPausa,
// rotuloVivo, accion, inscrito, organiza, oficial, privado, precio, premio,
// estructura, ciudad, repite, campeon:{nombre,cara}, puesto, soyCampeon,
// jugaste, jugaron, masMenu, cuando, nota }
export function filaArenaHtml(t, d = {}) {
  const { tipo = tipoPrincipal(t), ocupadas = 0, caras = [], viva = false, rotuloVivo = '', accion = null, inscrito = false, oficial = false, privado = '', precio = '', premio = '', estructura = '', ciudad = '', repite = '', campeon = null, puesto = null, soyCampeon = false, jugaste = false, jugaron = 0, masMenu = '', cuando = t.start_at, nota = '', mia = false, organiza = '' } = d
  const hecho = ['finished', 'cancelled'].includes(t.status)
  const f = new Date(cuando)
  const url = `/torneo?slug=${encodeURIComponent(t.slug)}`
  const tipoColor = viva ? 'vivo' : tipo
  // La fecha: en juego, «Ahora» y la ronda; si no, día de la semana, número y hora.
  const fecha = viva
    ? `<span class="tf-fecha viva"><small>ahora</small><b>${escapeHtml(rotuloVivo.split(' ')[0] || 'R')}</b><i>${escapeHtml(rotuloVivo.split(' ').slice(1).join(' '))}</i></span>`
    : `<span class="tf-fecha"><small>${DIA[f.getDay()]}</small><b>${f.getDate()}</b><i>${hecho ? f.toLocaleString('es-ES', { month: 'short' }).replace('.', '') : hora(f)}</i></span>`
  const dondeTexto = t.modalidad === 'presencial' ? ciudad || t.lugar || 'En persona' : t.format === 'league' ? 'Liga online' : 'Online'
  // En el móvil la losa de la fecha se va y el cuándo abre la línea de abajo.
  const cuandoCorto = viva ? `Ahora · ${rotuloVivo}` : hecho ? `${f.getDate()} ${f.toLocaleString('es-ES', { month: 'short' }).replace('.', '')}` : `${DIA[f.getDay()]} ${f.getDate()} · ${hora(f)}`
  const sub = [
    `<span class="tf-sub-cuando">${escapeHtml(cuandoCorto)}</span>`,
    `<span class="tf-tipo" data-tipo-torneo="${tipo}">${icons[MARCA[tipo]]?.(12) || ''}${escapeHtml(dondeTexto)}</span>`,
    t.modalidad === 'presencial' && t.lugar && t.lugar !== ciudad ? `<span class="tf-sitio">${escapeHtml(t.lugar)}</span>` : '',
    hecho ? (jugaron || ocupadas ? `<span>${jugaron || ocupadas} jugador${(jugaron || ocupadas) === 1 ? '' : 'es'}</span>` : '') : estructura ? `<span>${estructura}</span>` : '',
    !hecho && precio ? `<span>${escapeHtml(precio)}</span>` : '',
    !hecho && premio ? `<span class="tf-premio">${icons.trophy(12)} ${escapeHtml(premio)}</span>` : '',
    nota ? `<span class="tf-nota">${nota}</span>` : '',
    !hecho && organiza ? `<span class="tf-organiza">${escapeHtml(organiza)}</span>` : '',
  ].filter(Boolean).join('')
  const chapas = [
    viva ? chapaTipoHtml('vivo', { texto: 'En juego', llena: true }) : '',
    oficial ? chapaTipoHtml('oficial') : '',
    !hecho && repite ? chapaTipoHtml('repite', { texto: repite }) : '',
    privado,
    t.status === 'cancelled' ? '<span class="tf-chapa suave">Cancelado</span>' : '',
    t.status === 'registration_closed' ? '<span class="tf-chapa suave">Inscripción cerrada</span>' : '',
    t.status === 'draft' ? '<span class="tf-chapa suave">Borrador</span>' : '',
    hecho && soyCampeon ? `<span class="tf-chapa oro">${icons.trophy(11)} Campeón</span>` : hecho && puesto ? `<span class="tf-chapa tuya">Quedaste ${puesto}.º</span>` : hecho && jugaste ? '<span class="tf-chapa suave">Jugaste</span>' : '',
  ].filter(Boolean).join('')
  // La columna de la gente: quién va (caras y plazas) o quién ganó.
  const sinLimite = t.max_players == null
  // Casi lleno (el 80 %, como la barra de antes, 297): «quedan N» en naranja.
  const apurada = !hecho && !viva && !sinLimite && t.max_players > 0 && ocupadas / t.max_players >= 0.8
  const gente = hecho
    ? campeon
      ? `<span class="tf-campeon"><span class="tf-campeon-cara">${campeon.cara}</span><span class="tf-campeon-texto"><b>${escapeHtml(campeon.nombre)}</b><small data-mazo-de="${escapeHtml(String(t.id))}">Campeón</small></span><span class="tf-campeon-mazo torneo-arte con-meta" data-torneo="${escapeHtml(String(t.id))}"></span></span>`
      : ''
    : `${carasHtml(caras)}<span class="tf-plazas${apurada ? ' apurada' : ''}"><b class="torneo-ocupacion-cifra">${ocupadas}${sinLimite ? '' : `/${t.max_players}`}</b><small>${viva ? 'jugando' : sinLimite ? 'apuntados' : t.max_players - ocupadas > 0 ? `quedan ${t.max_players - ocupadas}` : 'completo'}</small></span>`
  const boton = inscrito
    ? `<a class="tf-inscrito torneo-pie-accion" href="${url}" aria-label="Estás inscrito: ver ${escapeHtml(t.name)}">${icons.checkCircle(14)}<span>Inscrito</span></a>`
    : accion
      ? `<a class="${accion.clase} torneo-pie-accion" href="${url}${accion.ver ? `&ver=${accion.ver}` : ''}"${accion.corto ? ` aria-label="${escapeHtml(accion.texto)}: ${escapeHtml(t.name)}"` : ''}>${escapeHtml(accion.corto || accion.texto)}</a>`
      : ''
  const banner = t.banner_url ? `<span class="tf-banner" style="background-image:url('${escapeHtml(t.banner_url)}')" aria-hidden="true"></span>` : '<span class="tf-banner sin-banner" aria-hidden="true"></span>'
  const clases = ['tf', 'torneo-tarjeta', viva ? 'tf-viva' : '', mia ? 'tf-mia torneo-tarjeta-mia' : '', hecho ? 'tf-hecha' : '', t.status === 'draft' ? 'tf-borrador' : ''].filter(Boolean).join(' ')
  return `<article class="${clases}" data-torneo-id="${escapeHtml(String(t.id))}" data-tipo-torneo="${tipoColor}">
    ${banner}
    <a class="tf-enlace torneo-tarjeta-enlace" href="${url}">
      ${fecha}
      ${avatarDeTorneoHtml(t, { tipo })}
      <span class="tf-texto">
        <span class="tf-titulo"><strong class="torneo-nombre">${escapeHtml(t.name)}</strong>${chapas}</span>
        <span class="tf-sub">${sub}</span>
      </span>
      <span class="tf-gente">${gente}</span>
    </a>
    <span class="tf-der">${masMenu}${boton}</span>
  </article>`
}

// El destacado: el banner grande y lo que decide en tres losas iguales.
export function destacadoHtml(t, d = {}) {
  const { tipo = tipoPrincipal(t), ocupadas = 0, caras = [], accion = null, inscrito = false, oficial = false, organiza = '', donde = '', estructura = '', motivo = '', cuando = t.start_at, privado = '', repite = '', tuyo = null } = d
  const f = new Date(cuando)
  const url = `/torneo?slug=${encodeURIComponent(t.slug)}`
  const losa = (b, s) => `<span class="tdest-losa"><b>${b}</b><small>${s}</small></span>`
  const sinLimite = t.max_players == null
  return `<article class="tdest torneo-tarjeta" data-torneo-id="${escapeHtml(String(t.id))}" data-tipo-torneo="${tipo}">
    <a class="tdest-arte${t.banner_url ? '' : ' sin-banner'}" href="${url}" tabindex="-1" aria-hidden="true"${t.banner_url ? ` style="background-image:url('${escapeHtml(t.banner_url)}')"` : ''}>
      ${t.banner_url ? '' : `<span class="tdest-marca">${icons[MARCA[tipo]]?.(140) || ''}</span>`}
    </a>
    <div class="tdest-cuerpo">
      ${avatarDeTorneoHtml(t, { tipo, clase: 'tdest-avatar' })}
      <div class="tdest-texto">
        <span class="tdest-ceja">${motivo ? `<span class="tdest-motivo">${escapeHtml(motivo)}</span>` : ''}${oficial ? chapaTipoHtml('oficial') : ''}${chapaTipoHtml(tipo)}${repite ? chapaTipoHtml('repite', { texto: repite }) : ''}${privado}</span>
        <h2 class="tdest-nombre"><a class="torneo-nombre" href="${url}">${escapeHtml(t.name)}</a></h2>
        <span class="tdest-quien">${escapeHtml([organiza, donde].filter(Boolean).join(' · '))}</span>
      </div>
      <div class="tdest-losas">
        ${losa(`${DIA[f.getDay()]} ${f.getDate()}`, escapeHtml(hora(f)))}
        ${losa(`${ocupadas}${sinLimite ? '' : `/${t.max_players}`}`, sinLimite ? 'apuntados' : 'plazas')}
        ${losa(escapeHtml(estructura || '—'), 'formato')}
      </div>
      <div class="tdest-accion">
        ${carasHtml(caras)}
        ${inscrito && tuyo ? `<a class="btn-secondary tdest-tuyo" href="${url}&ver=${tuyo.ver}">${escapeHtml(tuyo.texto)}</a>` : ''}${inscrito ? `<a class="tf-inscrito torneo-pie-accion" href="${url}" aria-label="Estás inscrito: ver ${escapeHtml(t.name)}">${icons.checkCircle(14)} Estás dentro</a>` : accion ? `<a class="${accion.clase} torneo-pie-accion" href="${url}">${escapeHtml(accion.texto)}</a>` : ''}
      </div>
    </div>
  </article>`
}

// Qué torneo se destaca: el tuyo más cercano, si no el oficial más cercano y
// si no el primero que tenga banner. Nunca uno en juego (ese tiene su
// pestaña) ni un borrador.
export function elegirDestacado(proximos, { mio = () => false, oficial = () => false } = {}) {
  const abiertos = (proximos || []).filter((t) => ['registration_open', 'registration_closed'].includes(t.status))
  const tuyo = abiertos.find(mio)
  if (tuyo) return { t: tuyo, motivo: 'Tu próximo torneo' }
  const ofi = abiertos.find(oficial)
  if (ofi) return { t: ofi, motivo: 'Destacado' }
  const conBanner = abiertos.find((t) => t.banner_url)
  return conBanner ? { t: conBanner, motivo: 'Destacado' } : null
}
