// «Así funciona un trato» (tanda 1238, PINGU: «le he hecho una propuesta a
// un chico y me ha dicho: ¿cómo funciona esto? Soy nuevo»). Los cuatro pasos
// de un trato contados para ESE trato (cambio, venta o compra; en mano o por
// correo; quien propone o quien recibe), con el de ahora marcado, y «Para ir
// seguro». Lo abren el «?» del pop-up de un trato, la hoja de proponer y la
// línea «¿Primera vez?» de la tarjeta del trato en Mensajes. La franja «Es tu
// primera propuesta» sale dentro del trato a quien nunca ha cerrado uno, hasta
// que pulsa «Entendido». Ver SCHEMA 1238.
import { escapeHtml } from './html.js'
import { hojaInyectada } from './hoja.js'
import { icons } from './icons.js'

export const TIPOS_DE_AYUDA = [['cambio', 'Cambio'], ['vendo', 'Venta'], ['compro', 'Compra']]
export const NOMBRES_DE_PASO = ['Propuesta', 'Aceptar', 'Mandar', 'Confirmar']
export const LLAVE_VISTA = 'pd-trato-ayuda-vista'

// Los cuatro pasos, desde quien mira. `correo`: true (por correo), false (en
// mano) o null (no se sabe todavía: se cuentan los dos).
export function pasosDeAyuda({ tipo = 'cambio', correo = null, propones = false, nombre = '' } = {}) {
  const otro = nombre || 'la otra persona'
  const Otro = nombre || 'La otra persona'
  const primero = {
    cambio: propones ? `Eliges qué cartas das y cuáles quieres de ${otro}.` : `${Otro} elige qué cartas te da y cuáles quiere de las tuyas.`,
    vendo: propones ? `Eliges qué cartas le vendes a ${otro} y pones el precio.` : `${Otro} elige qué cartas tuyas quiere y pone un precio.`,
    compro: propones ? `Eliges qué cartas le compras a ${otro} y pones el precio.` : `${Otro} te ofrece sus cartas con un precio.`,
  }[tipo] || ''
  const mandas = tipo === 'compro' ? 'el dinero' : tipo === 'vendo' ? 'tus cartas' : 'tus cartas'
  const cobro = tipo === 'vendo' ? ' y tú tu Bizum o PayPal para cobrar' : tipo === 'compro' ? '; tú le pagas por Bizum o PayPal' : ''
  const porCorreo = `Por correo, cada uno pone su dirección${cobro}. Mandas ${mandas} y pulsas «Ya lo he enviado».`
  const enMano = `En mano, quedáis y os dais ${tipo === 'cambio' ? 'las cartas' : 'las cartas y el dinero'}.`
  const tercero = correo === true ? porCorreo : correo === false ? enMano : `${enMano} ${porCorreo}`
  return [
    { titulo: propones ? 'Propones' : 'Te hacen una propuesta', texto: `${primero} Nada se mueve todavía.`, icono: 'edit' },
    { titulo: propones ? `${nombre || 'Te'} acepta` : 'Aceptas', texto: propones ? `${Otro} elige en mano o por correo y acepta, te propone otra cosa o la rechaza. Te llega un aviso.` : 'Eliges en mano o por correo y aceptas. Si algo no te cuadra, «Cambiar algo» le manda otra versión; o la rechazas.', icono: 'check' },
    { titulo: 'Os lo mandáis', texto: tercero, icono: 'package' },
    { titulo: 'Confirmáis y listo', texto: 'Cuando a cada uno le llega lo suyo, lo confirma. Las cartas cambian de colección solas y os podéis valorar.', icono: 'star' },
  ]
}

// En qué paso está un trato (0 a 3; 4 = hecho). Sin trato, null.
export function pasoDeAyuda(o, yo) {
  if (!o) return null
  if (o.estado === 'hecha') return 4
  if (o.estado === 'aceptada') return (yo === o.de ? o.recibido_de_at : o.recibido_para_at) ? 3 : 2
  return 1
}

export const SEGURO = [
  'PokeDoc no cobra ni guarda el dinero: el pago va entre vosotros.',
  'Confirma solo cuando lo tengas en la mano.',
  'Mira su confianza en su perfil y escríbele si tienes dudas.',
]

const ICONO = { edit: () => icons.edit(16), check: () => icons.checkCircle(16), package: () => icons.package(16), star: () => icons.star(16) }

export function pasosHtml(opts, paso = null) {
  return `<ol class="cay-pasos">${pasosDeAyuda(opts).map((p, i) => {
    const clase = paso == null ? '' : i < paso ? ' hecho' : i === paso ? ' ahora' : ''
    return `<li class="cay-paso${clase}"><span class="cay-paso-ico" aria-hidden="true">${ICONO[p.icono]()}</span><span><b>${i + 1} · ${escapeHtml(p.titulo)}${clase === ' ahora' ? ' <span class="cay-tu">Ahora</span>' : ''}</b><p>${escapeHtml(p.texto)}</p></span></li>`
  }).join('')}</ol>`
}

export function hojaHtml(opts = {}, paso = null) {
  const tipo = opts.tipo || 'cambio'
  return `<header class="cay-cab"><h2 id="cayTitulo">Así funciona un trato</h2><button type="button" class="cay-cerrar" data-cay-cerrar aria-label="Cerrar">${icons.x(18)}</button></header>
    <div class="cay-cuerpo">
      <div class="cay-tipos" role="group" aria-label="Tipo de trato">${TIPOS_DE_AYUDA.map(([id, n]) => `<button type="button" class="cay-tipo" data-cay-tipo="${id}" aria-pressed="${id === tipo}">${n}</button>`).join('')}</div>
      ${pasosHtml({ ...opts, tipo }, paso)}
      <div class="cay-seguro"><b>Para ir seguro</b><ul>${SEGURO.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul></div>
    </div>`
}

// Abre la hoja. `opts`: { tipo, correo, propones, nombre } y `paso` (el de
// ahora, o null). Cambiar de tipo con los chips deja de marcar el paso: ese
// ya no es tu trato.
export async function abrirAyuda(opts = {}, paso = null) {
  await hojaInyectada('css/cambio-ayuda.css')
  let d = document.getElementById('cayDialogo')
  if (!d) {
    d = document.createElement('dialog')
    d.id = 'cayDialogo'
    d.className = 'cay-dialogo'
    d.setAttribute('aria-labelledby', 'cayTitulo')
    d.setAttribute('data-sin-arrastre', '')
    document.body.appendChild(d)
    d.addEventListener('click', (e) => {
      if (e.target === d || e.target.closest('[data-cay-cerrar]')) return void d.close()
      const t = e.target.closest('[data-cay-tipo]')
      if (!t) return
      const o = JSON.parse(d.dataset.opts || '{}')
      const mismo = t.dataset.cayTipo === o.tipo
      d.innerHTML = hojaHtml({ ...o, tipo: t.dataset.cayTipo }, mismo ? (d.dataset.paso === '' ? null : Number(d.dataset.paso)) : null)
    })
  }
  d.dataset.opts = JSON.stringify(opts)
  d.dataset.paso = paso == null ? '' : String(paso)
  d.innerHTML = hojaHtml(opts, paso)
  if (!d.open) d.showModal()
  return d
}

// ¿Sale la franja de la primera vez? Solo a quien no ha cerrado ningún trato
// y no la ha quitado con «Entendido».
export function tocaPrimeraVez(ofertas = []) {
  if (ofertas.some((o) => o.estado === 'hecha')) return false
  try { return !localStorage.getItem(LLAVE_VISTA) } catch { return true }
}

export function franjaHtml({ recibida = false, frase = '', paso = 1 } = {}) {
  const mini = NOMBRES_DE_PASO.map((n, i) => `<span class="${i < paso ? 'hecho' : i === paso ? 'ahora' : ''}"><i></i>${n}</span>`).join('')
  const texto = recibida ? 'Ahora te toca a ti: mira qué te ofrece, elige si os lo dais en mano o por correo y acepta. También puedes cambiar algo (una contraoferta) o rechazarla.' : frase
  return `<div class="cay-franja" data-cay-franja>
    <div class="cay-franja-cab"><b>${recibida ? 'Es tu primera propuesta' : 'Tu primer trato'}</b><button type="button" class="cay-entendido" data-cay-entendido>Entendido</button></div>
    <div class="cay-mini" role="img" aria-label="Paso ${Math.min(paso + 1, 4)} de 4: ${escapeHtml(NOMBRES_DE_PASO[Math.min(paso, 3)])}">${mini}</div>
    ${texto ? `<p>${escapeHtml(texto)}</p>` : ''}
  </div>`
}

export function quitarFranjas(raiz = document) {
  try { localStorage.setItem(LLAVE_VISTA, String(Date.now())) } catch {}
  for (const f of raiz.querySelectorAll('[data-cay-franja]')) f.remove()
}

// Los datos de un botón «?» (`data-cay-*`), para abrir la hoja desde un oyente.
export function abrirDesdeBoton(b) {
  const d = b.dataset
  const correo = d.cayCorreo === 'si' ? true : d.cayCorreo === 'no' ? false : null
  return abrirAyuda({ tipo: d.cayTipoTrato || 'cambio', correo, propones: d.cayPropones === 'si', nombre: d.cayNombre || '' }, d.cayPaso === undefined || d.cayPaso === '' ? null : Number(d.cayPaso))
}
