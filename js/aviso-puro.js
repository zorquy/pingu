// Las reglas de los avisos del equipo (1260; antes, 1120), puras: las usan
// la web (js/aviso-global.js, js/aviso-pop.js) Y /admin → Avisos para la
// vista previa, así que lo que ve el equipo es lo que sale. Lo prueba Node.
//
// Un aviso es una fila de `avisos` (supabase-migration-1260-avisos.sql):
// título, texto, imagen, botón (o «Me apunto»), dónde sale (`sitios`),
// desde, hasta y a quién. Sin la migración, el aviso de antes
// (site_settings.aviso_global) se convierte con `desdeAvisoViejo`.
import { escapeHtml } from './html.js'
import { icons } from './icons.js'

// `orden`: qué franja gana si hay varias (lo urgente antes).
export const TIPOS_DE_AVISO = {
  concurso: { nombre: 'Concurso', icono: 'trophy', orden: 2 },
  novedad: { nombre: 'Novedad', icono: 'sparkles', orden: 4 },
  evento: { nombre: 'Evento', icono: 'calendar', orden: 3 },
  aviso: { nombre: 'Aviso', icono: 'triangleAlert', orden: 1 },
  mantenimiento: { nombre: 'Mantenimiento', icono: 'settings', orden: 0 },
}

export const SITIOS_DE_AVISO = {
  popup: { nombre: 'Pop-up', ayuda: 'Una vez por persona, al entrar' },
  franja: { nombre: 'Franja de arriba', ayuda: 'En todas las páginas' },
  inicio: { nombre: 'Tarjeta en Inicio', ayuda: 'Encima de las noticias' },
  campanita: { nombre: 'Campanita y móvil', ayuda: 'Al publicar' },
}

export const PUBLICOS_DE_AVISO = { todos: 'Todo el mundo', cuenta: 'Con cuenta', sin_cuenta: 'Sin cuenta', movil: 'Solo móvil' }

// Lo que suele llevar cada tipo: al elegirlo en el editor se rellena así.
export const PLANTILLAS = {
  // El botón de un concurso LLEVA a donde se participa (un tema del foro): la
  // lista de «Me apunto» es para cuando el concurso se lleva aquí (1260b).
  concurso: { sitios: ['popup', 'franja', 'inicio', 'campanita'], participar: false, cuenta_atras: true, recordar: true, boton_texto: 'Apuntarme' },
  novedad: { sitios: ['franja', 'campanita'], participar: false, cuenta_atras: false, recordar: false, boton_texto: 'Ver más' },
  evento: { sitios: ['franja', 'inicio', 'campanita'], participar: false, cuenta_atras: true, recordar: true, boton_texto: 'Ver el evento' },
  aviso: { sitios: ['franja'], participar: false, cuenta_atras: false, recordar: false, boton_texto: '' },
  mantenimiento: { sitios: ['franja'], participar: false, cuenta_atras: false, recordar: false, boton_texto: '' },
}

export const tipoDe = (a) => (TIPOS_DE_AVISO[a?.tipo] ? a.tipo : 'novedad')

// Un enlace de la casa (/algo) o de fuera con https; lo demás no se pinta.
export function enlaceSeguro(e) {
  const s = String(e || '').trim()
  return /^(\/(?!\/)|https:\/\/)/.test(s) ? s : ''
}

// borrador · programado · en_marcha · terminado
export function estadoDeAviso(a, ahora = new Date()) {
  if (!a?.publicado) return 'borrador'
  const t = +ahora
  if (a.desde && t < +new Date(a.desde)) return 'programado'
  if (a.hasta && t >= +new Date(a.hasta)) return 'terminado'
  return 'en_marcha'
}

// Una tienda solo tiene su panel (1071): de los avisos, solo le llega el de
// mantenimiento, que también le afecta.
export function seVeAviso(a, { ahora = new Date(), conCuenta = false, movil = false, tienda = false } = {}) {
  if (estadoDeAviso(a, ahora) !== 'en_marcha') return false
  if (tienda && a.tipo !== 'mantenimiento') return false
  if (a.publico === 'cuenta' && !conCuenta) return false
  if (a.publico === 'sin_cuenta' && conCuenta) return false
  if (a.publico === 'movil' && !movil) return false
  return true
}

export const tieneSitio = (a, sitio) => Array.isArray(a?.sitios) && a.sitios.includes(sitio)

// Un resumen barato del aviso, para saber si es EL MISMO que ya cerraste o
// viste: cambiar el título o la fecha de salida lo vuelve a sacar.
export function huellaDeAviso(a) {
  const s = `${a?.id || ''}|${String(a?.titulo || '').trim()}|${a?.desde || ''}`
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0
  return String(h)
}

// El de un sitio: la franja, la más urgente (y entre iguales la más nueva);
// el pop-up y la tarjeta, el más nuevo que no hayas visto ya.
const nuevo = (a) => +new Date(a.publicado_at || a.desde || a.created_at || 0)
export function elegir(lista, sitio, { vistos = new Set() } = {}) {
  const con = (lista || []).filter((a) => tieneSitio(a, sitio))
  if (sitio === 'franja') {
    con.sort((x, y) => TIPOS_DE_AVISO[tipoDe(x)].orden - TIPOS_DE_AVISO[tipoDe(y)].orden || nuevo(y) - nuevo(x))
    return con[0] || null
  }
  con.sort((x, y) => nuevo(y) - nuevo(x))
  return con.find((a) => !vistos.has(huellaDeAviso(a))) || null
}

export function loQueQueda(hasta, ahora = new Date()) {
  if (!hasta) return null
  const ms = +new Date(hasta) - +ahora
  if (!(ms > 0)) return null
  const min = Math.floor(ms / 60000)
  return { dias: Math.floor(min / 1440), horas: Math.floor((min % 1440) / 60), minutos: min % 60 }
}

export function quedanTexto(hasta, ahora = new Date()) {
  const q = loQueQueda(hasta, ahora)
  if (!q) return ''
  if (q.dias >= 1) return q.dias === 1 ? 'Queda 1 día' : `Quedan ${q.dias} días`
  if (q.horas >= 1) return q.horas === 1 ? 'Queda 1 hora' : `Quedan ${q.horas} horas`
  return `Quedan ${Math.max(1, q.minutos)} min`
}

export const fechaCorta = (iso) => new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', timeZone: 'Europe/Madrid' })

// Los números de la cuenta atrás grande. `data-cuenta` lleva la fecha: la
// web la repinta cada minuto con `cuentaAtrasHtml`.
export function cuentaAtrasHtml(hasta, ahora = new Date()) {
  const q = loQueQueda(hasta, ahora)
  if (!q) return ''
  const caja = (n, que) => `<span><b>${n}</b><small>${que}</small></span>`
  return `${caja(q.dias, q.dias === 1 ? 'día' : 'días')}${caja(q.horas, q.horas === 1 ? 'hora' : 'horas')}${caja(q.minutos, 'min')}`
}

const i = (nombre, lado) => icons[nombre](lado)
const fuera = (href) => (/^https:/.test(href) ? ' target="_blank" rel="noopener"' : '')

// La imagen con su hueco reservado (la 313); sin imagen, el icono del tipo.
function imagenHtml(a, clase, lado) {
  const src = /^https:\/\//.test(a?.imagen || '') ? a.imagen : ''
  if (src) return `<img class="${clase}" src="${escapeHtml(src)}" alt="" width="800" height="500" loading="lazy" decoding="async" />`
  return `<span class="${clase} aviso-sin-imagen" aria-hidden="true">${i(TIPOS_DE_AVISO[tipoDe(a)].icono, lado)}</span>`
}

const chapaHtml = (a) => `<span class="aviso-chapa">${i(TIPOS_DE_AVISO[tipoDe(a)].icono, 14)} ${TIPOS_DE_AVISO[tipoDe(a)].nombre}</span>`

// El botón principal: «Me apunto» si hay que apuntarse; si no, el enlace.
function botonHtml(a, clase, { abrir = false } = {}) {
  if (a.participar) {
    return abrir
      ? `<button type="button" class="${clase}" data-abrir-aviso="${escapeHtml(a.id || '')}">Me apunto</button>`
      : `<button type="button" class="${clase}" data-apuntarme>Me apunto</button>`
  }
  const href = enlaceSeguro(a.boton_enlace)
  if (!href) return ''
  const texto = String(a.boton_texto || '').trim() || 'Ver más'
  return `<a class="${clase}" href="${escapeHtml(href)}"${fuera(href)} data-aviso-clic>${escapeHtml(texto)}</a>`
}

export function popHtml(a, { ahora = new Date() } = {}) {
  const tipo = tipoDe(a)
  const texto = String(a.texto || '').trim()
  const enlace = enlaceSeguro(a.enlace)
  const cuenta = a.cuenta_atras && a.hasta ? cuentaAtrasHtml(a.hasta, ahora) : ''
  const hasta = a.hasta ? `hasta el ${fechaCorta(a.hasta)}` : ''
  return `<div class="aviso-pop-caja" data-tipo="${tipo}">
    <div class="aviso-pop-hero${a.imagen ? '' : ' sin-imagen'}">
      ${imagenHtml(a, 'aviso-pop-imagen', 56)}
      ${chapaHtml(a)}
      <button type="button" class="aviso-pop-cerrar" data-aviso-cerrar aria-label="Cerrar">${i('x', 18)}</button>
    </div>
    <div class="aviso-pop-cuerpo">
      <h2 class="aviso-pop-titulo" id="avisoPopTitulo">${escapeHtml(String(a.titulo || '').trim())}</h2>
      ${texto ? `<p class="aviso-pop-texto">${escapeHtml(texto)}</p>` : ''}
      ${cuenta ? `<div class="aviso-cuenta" data-cuenta="${escapeHtml(a.hasta)}">${cuenta}</div><p class="aviso-pop-hasta">${escapeHtml(hasta)}</p>` : hasta && a.participar ? `<p class="aviso-pop-hasta">${escapeHtml(hasta)}</p>` : ''}
      ${botonHtml(a, 'btn-primary aviso-pop-boton')}
      ${a.participar ? '<p class="aviso-pop-apuntados" data-apuntados aria-hidden="true">&nbsp;</p>' : ''}
      <p class="aviso-pop-pie"><button type="button" class="aviso-pop-ahora-no" data-aviso-cerrar>Ahora no</button>${enlace ? ` · <a href="${escapeHtml(enlace)}"${fuera(enlace)}>${escapeHtml(String(a.enlace_texto || '').trim() || 'Más información')}</a>` : ''}</p>
    </div>
  </div>`
}

export function franjaHtml(a, { ahora = new Date(), cerrar = true } = {}) {
  const tipo = tipoDe(a)
  const quedan = a.cuenta_atras ? quedanTexto(a.hasta, ahora) : ''
  const prefijo = tipo === 'concurso' || tipo === 'evento' ? `<b>${TIPOS_DE_AVISO[tipo].nombre}:</b> ` : ''
  return `<div class="aviso-global" data-tipo="${tipo}" data-aviso-id="${escapeHtml(a.id || '')}" role="status">
      <span class="aviso-global-mini">${imagenHtml(a, 'aviso-global-img', 16)}</span>
      <span class="aviso-global-texto">${prefijo}${escapeHtml(String(a.titulo || '').trim())}</span>
      ${quedan ? `<span class="aviso-global-quedan" data-quedan="${escapeHtml(a.hasta)}">${i('clock', 12)} ${quedan}</span>` : ''}
      ${botonHtml(a, 'aviso-global-boton', { abrir: true })}
      ${cerrar ? `<button type="button" class="aviso-global-cerrar" aria-label="Cerrar el aviso">${i('x', 16)}</button>` : ''}
    </div>`
}

export function tarjetaHtml(a, { ahora = new Date() } = {}) {
  const tipo = tipoDe(a)
  const quedan = a.cuenta_atras ? quedanTexto(a.hasta, ahora) : ''
  const linea = [quedan, a.hasta && (a.cuenta_atras || a.participar) ? `hasta el ${fechaCorta(a.hasta)}` : ''].filter(Boolean).join(' · ')
  const texto = String(a.texto || '').trim()
  return `<div class="aviso-tarjeta" data-tipo="${tipo}" data-aviso-id="${escapeHtml(a.id || '')}">
    <div class="aviso-tarjeta-texto">
      ${chapaHtml(a)}
      <h3 class="aviso-tarjeta-titulo">${escapeHtml(String(a.titulo || '').trim())}</h3>
      ${texto ? `<p class="aviso-tarjeta-sub">${escapeHtml(texto)}</p>` : ''}
      ${linea ? `<p class="aviso-tarjeta-quedan"${a.cuenta_atras && a.hasta ? ` data-quedan-largo="${escapeHtml(a.hasta)}"` : ''}>${escapeHtml(linea)}</p>` : ''}
      ${botonHtml(a, 'aviso-tarjeta-boton', { abrir: true })}
    </div>
    <div class="aviso-tarjeta-arte">${imagenHtml(a, 'aviso-tarjeta-img', 48)}</div>
  </div>`
}

// La fila de la campanita, para la vista previa del panel.
export function campanitaHtml(a) {
  return `<div class="aviso-campanita-fila" data-tipo="${tipoDe(a)}"><span class="aviso-campanita-icono">${i(TIPOS_DE_AVISO[tipoDe(a)].icono, 16)}</span><span><b>${escapeHtml(String(a.titulo || '').trim())}</b><small>PokeDoc · ahora</small></span></div>`
}

export function sumarCifras(filas) {
  const s = (filas || []).reduce((t, f) => ({ vistos: t.vistos + (f.vistos || 0), clics: t.clics + (f.clics || 0), cerrados: t.cerrados + (f.cerrados || 0) }), { vistos: 0, clics: 0, cerrados: 0 })
  return { ...s, porcentaje: s.vistos ? Math.round((100 * s.clics) / s.vistos) : null }
}

// El aviso de antes de la 1260 (site_settings.aviso_global, un JSON) en la
// forma de ahora, para la web mientras no esté la migración.
export function desdeAvisoViejo(v) {
  if (!v || !String(v.texto || '').trim()) return null
  const tipo = ['novedad', 'aviso', 'mantenimiento'].includes(v.tipo) ? v.tipo : v.tono === 'aviso' ? 'aviso' : 'novedad'
  return {
    id: 'viejo',
    tipo,
    titulo: String(v.texto).trim(),
    boton_texto: v.texto_enlace || '',
    boton_enlace: v.enlace || '',
    sitios: ['franja'],
    publico: ['cuenta', 'movil'].includes(v.publico) ? v.publico : 'todos',
    desde: v.desde || null,
    hasta: v.hasta || null,
    publicado: Boolean(v.activo),
  }
}
