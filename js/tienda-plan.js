// Los planes de una tienda en su panel (tanda 1429): la chapa del saludo, la
// banda de la prueba, Datos → Tu plan, y la pantalla de «es de…» cuando se
// abre algo que su plan no trae. Qué abre cada plan vive en
// js/tienda-plan-puro.js (`puede`); aquí solo se lee y se pinta.
//
// Sin la migración 1429 no hay `tienda_mi_plan`: entonces no se cierra NADA
// (como antes de los planes), ni se pinta la chapa ni la banda. Un panel que se
// cierra porque falta una función en la base es peor que uno que no cobra.
import { supabase } from './supabase.js'
import { escapeHtml } from './html.js'
import { hojaInyectada } from './hoja.js'
import { icons } from './icons.js'
import { showToast } from './toast.js'
import {
  PLANES, ORDEN, QUE_TRAE, FUNCIONES, puede, estadoDelPlan, chapaDe, bandaDe, tituloDeCandado,
  nombreDePlan, precioTexto, fechaLarga, planMinimo, DIAS_DE_PRUEBA,
} from './tienda-plan-puro.js'

let pedido = null

// El estado del plan, una vez por página (null si no se puede saber).
export function cargarPlan({ otraVez = false } = {}) {
  if (pedido && !otraVez) return pedido
  pedido = supabase.rpc('tienda_mi_plan').then(({ data, error }) => {
    if (error || !data) return null
    return estadoDelPlan(data)
  }, () => null)
  return pedido
}

// ¿Lo abre su plan? Si no, la pantalla de «es de…» y `false`.
export async function permitido(funcion) {
  const e = await cargarPlan()
  if (!e || puede(e.plan, funcion)) return true
  abrirCandado(funcion, e)
  return false
}

// Para lo que se pinta (sin abrir nada): ¿lo abre su plan? Sin saberlo, sí.
export async function abre(funcion) {
  const e = await cargarPlan()
  return !e || puede(e.plan, funcion)
}

// El visto de las listas, aquí y no en icons.js (lo baja toda la web).
const check = () => '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M20 6 9 17l-5-5"/></svg>'
const listaHtml = (xs) => `<ul class="tdp-lista">${xs.map((t) => `<li>${check()}<span>${escapeHtml(t)}</span></li>`).join('')}</ul>`

// ── La pantalla de «es de…» ──
let dialogo = null
export function candadoHtml(funcion, e) {
  const min = planMinimo(funcion)
  const fundadora = Boolean(e?.fundadora)
  return `
    <span class="tdp-candado-ico">${icons.lock(28)}</span>
    <h2 id="tdpCandadoTitulo">${escapeHtml(tituloDeCandado(funcion))}</h2>
    <p class="tdp-candado-texto">${e?.acabo
      ? `Tu prueba acabó el ${escapeHtml(fechaLarga(e.pruebaHasta))}. No se ha borrado nada: lo tuyo vuelve en cuanto elijas plan. Tu escaparate y tu stock siguen funcionando.`
      : 'Tu escaparate y tu stock siguen funcionando con tu plan. Esto vuelve en cuanto lo subas.'}</p>
    <div class="tdp-candado-trae"><p class="tdp-etq">Con ${escapeHtml(nombreDePlan(min))}</p>${listaHtml(QUE_TRAE[min])}</div>
    <p class="tdp-candado-precio"><b>${escapeHtml(precioTexto(min, fundadora))}</b>${fundadora ? '<span>tu precio de fundadora, mientras sigas</span>' : ''}</p>
    <div class="tdp-botones"><a class="btn-primary" href="/tienda?ver=datos#plan" data-tdp="elegir">Elegir plan</a><button type="button" class="btn-secondary" data-tdp="cerrar">Ahora no</button></div>`
}

export function abrirCandado(funcion, e) {
  hojaInyectada('css/tienda-plan.css')
  if (!dialogo) {
    dialogo = document.createElement('dialog')
    dialogo.className = 'tdp-candado'
    dialogo.setAttribute('aria-labelledby', 'tdpCandadoTitulo')
    document.body.appendChild(dialogo)
    dialogo.addEventListener('click', (ev) => {
      if (ev.target === dialogo || ev.target.closest('[data-tdp="cerrar"]')) return dialogo.close()
      const elegir = ev.target.closest('[data-tdp="elegir"]')
      if (elegir && location.pathname.replace(/\.html$/, '') === '/tienda') {
        // Dentro del panel, a Datos sin recargar (lo cambia js/tienda.js).
        dialogo.close()
        document.dispatchEvent(new CustomEvent('pokedoc:tienda-ir', { detail: 'datos' }))
        ev.preventDefault()
        setTimeout(() => document.getElementById('plan')?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 60)
      }
    })
  }
  dialogo.innerHTML = `<div class="tdp-candado-caja">${candadoHtml(funcion, e)}</div>`
  if (!dialogo.open) dialogo.showModal?.() ?? dialogo.setAttribute('open', '')
}

// La misma pantalla, pero dentro de una pestaña (Ventas, sin plan).
export function candadoEnSitio(caja, funcion, e) {
  hojaInyectada('css/tienda-plan.css')
  caja.innerHTML = `<div class="tdp-candado-caja tdp-en-sitio" role="region" aria-labelledby="tdpCandadoTitulo">${candadoHtml(funcion, e)}</div>`
  caja.querySelector('[data-tdp="cerrar"]')?.remove()
  caja.querySelector('[data-tdp="elegir"]')?.addEventListener('click', (ev) => {
    ev.preventDefault()
    document.dispatchEvent(new CustomEvent('pokedoc:tienda-ir', { detail: 'datos' }))
    setTimeout(() => document.getElementById('plan')?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 60)
  })
}

// ── La chapa y la banda de arriba del panel ──
export async function pintarCabecera({ chapa, banda }) {
  const e = await cargarPlan()
  if (!e) return null
  if (chapa) {
    chapa.textContent = chapaDe(e)
    chapa.classList.toggle('td-chapa-gratis', e.plan === 'gratis')
  }
  const b = bandaDe(e)
  if (banda) {
    if (!b) banda.innerHTML = ''
    else {
      await hojaInyectada('css/tienda-plan.css')
      banda.innerHTML = `<div class="tdp-banda tdp-banda-${b.tipo}">
        <span class="tdp-banda-ico">${b.tipo === 'prueba' ? icons.star(20) : icons.clock(20)}</span>
        <span class="tdp-banda-txt"><b>${escapeHtml(b.titulo)}</b><small>${escapeHtml(b.texto)}</small>${b.tipo === 'prueba' ? `<span class="tdp-barra" style="--tdp-gastado:${Math.round(b.gastado * 100)}%"><i></i></span>` : ''}</span>
        <a class="tdp-banda-ir" href="/tienda?ver=datos#plan" data-ver="datos">${escapeHtml(b.enlace)} ${icons.chevronRight(16)}</a>
      </div>`
      banda.querySelector('.tdp-banda-ir').addEventListener('click', () => setTimeout(() => document.getElementById('plan')?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 60))
    }
  }
  document.documentElement.dataset.tdPlan = e.plan
  return e
}

// ── Datos → Tu plan ──
function tarjetaHtml(plan, e) {
  const p = PLANES[plan]
  const actual = e.seQueda === plan
  const recomendada = plan === 'tienda'
  return `<div class="tdp-tarjeta${recomendada ? ' tdp-tarjeta-rec' : ''}${actual ? ' tdp-tarjeta-mia' : ''}">
    ${recomendada ? '<span class="tdp-cinta">Recomendada</span>' : ''}
    <h3>${escapeHtml(p.nombre)}</h3>
    <p class="tdp-precio"><b>${escapeHtml(precioTexto(plan, e.fundadora))}</b>${e.fundadora ? `<small>fundadora · luego ${p.mes} € para las nuevas</small>` : ''}</p>
    <p class="tdp-para">${escapeHtml(p.para)}</p>
    ${plan !== 'puesto' ? `<p class="tdp-todo">Todo lo de ${escapeHtml(nombreDePlan(ORDEN[ORDEN.indexOf(plan) - 1]))}, y:</p>` : '<p class="tdp-todo">Todo lo de Gratis, y:</p>'}
    ${listaHtml(QUE_TRAE[plan])}
    <button type="button" class="${actual ? 'btn-secondary' : recomendada ? 'btn-primary' : 'btn-secondary'}" data-tdp-quedo="${plan}" aria-pressed="${actual}">${actual ? `${check()} Te quedas con ${escapeHtml(p.nombre)}` : `Me quedo con ${escapeHtml(p.nombre)}`}</button>
  </div>`
}

export function tuPlanHtml(e) {
  const titulo = e.enPrueba ? 'Prueba de Tienda+' : e.pagando ? e.nombre : 'Gratis'
  const sub = e.enPrueba
    ? `Gratis hasta el ${fechaLarga(e.pruebaHasta)} · ${e.dias === 1 ? 'queda 1 día' : `quedan ${e.dias} días`}`
    : e.pagando ? `Pagado hasta el ${fechaLarga(e.pagadoHasta)}`
      : e.acabo ? `Tu prueba acabó el ${fechaLarga(e.pruebaHasta)}. No se ha borrado nada.` : 'Escaparate, stock, Mercado, ofertas y torneos.'
  return `
    <div class="tdp-cab">
      <h2 id="tdpTitulo">Tu plan</h2>
      <span class="tdp-chapa">${escapeHtml(titulo)}</span>
      ${e.fundadora ? '<span class="tdp-chapa tdp-chapa-oro">Fundadora</span>' : ''}
    </div>
    <p class="tdp-ahora">${escapeHtml(sub)}</p>
    ${e.enPrueba ? `<span class="tdp-barra" style="--tdp-gastado:${Math.round(e.gastado * 100)}%" aria-hidden="true"><i></i></span>` : ''}
    <p class="tdp-explica">${e.fundadora
      ? 'Eres <b>fundadora</b>: el plan que elijas te queda a este precio <b>mientras sigas</b>. Si te das de baja y vuelves, pagas el de entonces.'
      : 'Elige el plan que te encaje. Sin permanencia: lo cambias cuando quieras.'} «Me quedo con…» no cobra nada: nos avisa de lo que quieres. Para pagar, escríbenos a <a href="mailto:info@pokedoc.es">info@pokedoc.es</a>.</p>
    <div class="tdp-tarjetas">${['puesto', 'tienda', 'tienda_mas'].map((p) => tarjetaHtml(p, e)).join('')}</div>
    <p class="tdp-nota">Si no eliges ninguno, al acabar la prueba pasas a Gratis: tu escaparate, tu stock y tus datos se quedan como están. Precios sin IVA.</p>`
}

export async function montarTuPlan(caja) {
  const e = await cargarPlan()
  if (!caja) return
  if (!e) { caja.hidden = true; return }
  await hojaInyectada('css/tienda-plan.css')
  const pintar = (estado) => { caja.innerHTML = tuPlanHtml(estado); caja.hidden = false }
  pintar(e)
  caja.addEventListener('click', async (ev) => {
    const b = ev.target.closest('[data-tdp-quedo]')
    if (!b) return
    const plan = b.getAttribute('aria-pressed') === 'true' ? null : b.dataset.tdpQuedo
    b.disabled = true
    const { error } = await supabase.rpc('tienda_me_quedo', { p_plan: plan })
    if (error) {
      b.disabled = false
      return showToast('No se ha podido guardar. Prueba otra vez.', 'error')
    }
    showToast(plan ? `Apuntado: te quedas con ${nombreDePlan(plan)}. Te escribimos antes de que acabe la prueba.` : 'Quitado.', 'success')
    const nuevo = await cargarPlan({ otraVez: true })
    if (nuevo) pintar(nuevo)
  })
  if (location.hash === '#plan') setTimeout(() => caja.scrollIntoView({ block: 'start' }), 80)
}

// ── El Panel con un plan que no lo trae todo ──
// Sin Puesto: ni lo vendido, ni la gráfica, ni la caja, ni las últimas ventas.
// Sin Tienda: ni las cuatro cifras, ni las de abajo, ni «Avisar». En su
// sitio, una línea que dice de qué plan son. Por clases (el Panel se repinta
// solo, y lo escondido se queda escondido).
export async function marcarPanel(caja) {
  const e = await cargarPlan()
  if (!e || !caja) return
  await hojaInyectada('css/tienda-plan.css')
  const sinMostrador = !puede(e.plan, 'ventas')
  const sinCifras = !puede(e.plan, 'cifras')
  caja.classList.toggle('tdp-sin-ventas', sinMostrador)
  caja.classList.toggle('tdp-sin-cifras', sinCifras)
  caja.classList.toggle('tdp-sin-avisar', !puede(e.plan, 'avisar'))
  for (const m of caja.querySelectorAll('.tdp-mini')) m.remove()
  const mini = (texto, plan) => `<p class="tdp-mini">${icons.lock(18)}<span>${escapeHtml(texto)}: con ${escapeHtml(nombreDePlan(plan))}, ${escapeHtml(precioTexto(plan, e.fundadora))}.</span><a href="/tienda?ver=datos#plan" data-ver="datos">Ver planes</a></p>`
  if (sinMostrador) caja.querySelector('.tdh-cartera')?.insertAdjacentHTML('afterend', mini('Lo que vendes, la gráfica, la caja de hoy y el mostrador', 'puesto'))
  else if (sinCifras) caja.querySelector('.tdh-grafica')?.insertAdjacentHTML('afterend', mini('Beneficio, margen, valor del stock y lo que no rota', 'tienda'))
}

// Para quien quiera saber cuántos días tiene la prueba (/para-tiendas).
export { DIAS_DE_PRUEBA, FUNCIONES }
