// ── La puerta de un torneo en persona (1453) ──
//
// Lo que faltaba para jugar un torneo en persona de principio a fin (la base
// está desde la 1446: `torneos_dar_entrada`, `torneos_quitar_entrada` y
// `torneos_cerrar_puerta`). Quien organiza, en la pestaña Jugadores:
//   · ve cuántos han entrado y cuántos faltan;
//   · escanea el QR de la entrada de cada uno (el de «Tu entrada»), o le busca
//     por su @usuario — también a quien llega sin haber pedido plaza;
//   · a quien viene sin cuenta le enseña el QR del torneo para que se la haga
//     en su móvil, y luego le da entrada como a los demás;
//   · y en cada fila de la lista, «Dar entrada» o «Dentro · 16:42».
// Al emparejar la ronda 1 la puerta se cierra: quien no ha entrado se queda
// fuera (ronda.js llama a `torneos_cerrar_puerta`).
//
// Solo cuando hay puerta: en persona, con «pedir» u «organizador» (con
// «libre» se apuntan solos, como online) y antes de que empiece.
import { escapeHtml } from '../app.js'
import { icons } from '../icons.js'
import { showToast } from '../toast.js'
import { svgQR } from '../qr.js'

export function hayPuerta(torneo) {
  return Boolean(torneo) && torneo.modalidad === 'presencial' && (torneo.inscripcion || 'pedir') !== 'libre' && ['registration_open', 'registration_closed'].includes(torneo.status)
}

// Lo que lleva el QR de «Tu entrada» (torneo.js, 1452): pokedoc-entrada:<torneo>:<usuario>.
export function leerEntrada(texto, torneoId) {
  const m = /^pokedoc-entrada:([^:\s]+):([^:\s]+)$/.exec(String(texto || '').trim())
  if (!m) return { error: 'Ese QR no es una entrada de PokeDoc.' }
  if (m[1] !== String(torneoId)) return { error: 'Esa entrada es de otro torneo.' }
  return { usuario: m[2] }
}

// Cuántos han entrado de los que juegan o esperan.
export function cuentaDePuerta(inscripciones) {
  const vivas = (inscripciones || []).filter((i) => ['active', 'waitlisted'].includes(i.status))
  const dentro = vivas.filter((i) => i.entrada_at).length
  return { dentro, faltan: vivas.length - dentro }
}

// El trozo de cada fila de la lista: «Dar entrada» o «Dentro · 16:42».
export function entradaDeFilaHtml(i) {
  if (!['active', 'waitlisted'].includes(i.status)) return ''
  if (i.entrada_at) {
    const hora = new Date(i.entrada_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
    // Una sola celda (chapa + Quitar): son dos piezas, pero en la rejilla de
    // la fila ocupan un hueco; sueltas empujaban «Expulsar» a otra línea.
    return `<span class="torneo-entrada-celda"><span class="torneo-entrada-dentro-chapa">${icons.checkCircle(13)} Dentro · ${escapeHtml(hora)}</span><button type="button" class="link-btn torneo-entrada-quitar" data-quitar-entrada="${escapeHtml(i.user_id)}" aria-label="Quitar la entrada a ${escapeHtml(i.perfil?.username || 'este jugador')}">Quitar</button></span>`
  }
  return `<span class="torneo-entrada-celda"><button type="button" class="btn-secondary torneo-entrada-dar" data-dar-entrada="${escapeHtml(i.user_id)}">Dar entrada</button></span>`
}

let ctx = null
let enganchado = false

// `c`: { supabase, torneo, inscripciones, recargar }
export function pintarPuerta(c) {
  ctx = c
  const lista = document.getElementById('listaInscritos')
  let caja = document.getElementById('torneoPuerta')
  if (!hayPuerta(c.torneo)) {
    caja?.remove()
    return
  }
  if (!caja && lista) {
    caja = document.createElement('div')
    caja.id = 'torneoPuerta'
    caja.className = 'torneo-puerta'
    lista.before(caja)
  }
  if (!caja) return
  const { dentro, faltan } = cuentaDePuerta(c.inscripciones)
  const html = `
    <div class="torneo-puerta-cab">
      <span class="torneo-puerta-titulo">${icons.mapPin(16)} La puerta</span>
      <span class="torneo-puerta-cifra dentro"><b>${dentro}</b> dentro</span>
      <span class="torneo-puerta-cifra"><b>${faltan}</b> por llegar</span>
    </div>
    <div class="torneo-puerta-mandos">
      <button type="button" class="btn-primary" data-puerta-escanear>${icons.camera?.(16) || ''} Escanear entrada</button>
      <label class="torneo-puerta-buscar"><span class="sr-only">El @usuario de quien llega</span>${icons.search(15)}<input type="search" id="puertaUsuario" placeholder="@usuario de quien llega" autocomplete="off" /></label>
      <button type="button" class="btn-secondary" data-puerta-sin-cuenta aria-expanded="false">Viene sin cuenta</button>
    </div>
    <div class="torneo-puerta-resultado" id="puertaResultado" aria-live="polite"></div>
    <p class="subtext torneo-puerta-nota">Al emparejar la ronda 1 se cierra la puerta: quien no haya entrado se queda fuera.</p>`
  // Solo si ha cambiado algo: repintar borraría lo que se está escribiendo.
  const firma = `${dentro}/${faltan}`
  if (caja.dataset.firma !== firma) {
    const escrito = document.getElementById('puertaUsuario')?.value || ''
    const foco = document.activeElement?.id === 'puertaUsuario'
    caja.innerHTML = html
    caja.dataset.firma = firma
    const campo = document.getElementById('puertaUsuario')
    campo.value = escrito
    if (foco) campo.focus()
  }
  if (!enganchado) enganchar()
}

async function darEntrada(usuario, nombre = '') {
  const { data, error } = await ctx.supabase.rpc('torneos_dar_entrada', { p_torneo: ctx.torneo.id, p_usuario: usuario })
  if (error) {
    showToast(/does not exist|Could not find the function/i.test(error.message || '') ? 'Falta ejecutar la migración 1446 (supabase-migration-1446-torneos-en-persona.sql).' : error.message, 'error')
    return false
  }
  const quien = nombre ? `«${nombre}»` : 'Esa persona'
  showToast(data === 'ya_estaba' ? `${quien} ya había entrado.` : data === 'nuevo' ? `${quien} no tenía plaza: apuntado y dentro.` : `${quien}, dentro.`, data === 'ya_estaba' ? 'info' : 'success')
  await ctx.recargar()
  return true
}

function nombreDe(usuario) {
  return ctx.inscripciones.find((i) => i.user_id === usuario)?.perfil?.username || ''
}

// Buscar por @usuario: primero los apuntados; si no, cualquier cuenta (quien
// llega sin haber pedido plaza).
let ultimaBusqueda = 0
async function buscarUsuario(texto) {
  const caja = document.getElementById('puertaResultado')
  const q = texto.replace(/^@/, '').trim().toLowerCase()
  const n = ++ultimaBusqueda
  if (q.length < 2) {
    caja.innerHTML = ''
    return
  }
  const apuntados = ctx.inscripciones.filter((i) => ['active', 'waitlisted'].includes(i.status) && (i.perfil?.username || '').toLowerCase().includes(q))
  let otros = []
  if (apuntados.length < 4) {
    const { data } = await ctx.supabase.from('user_profiles').select('id, username, avatar_url').ilike('username', `${q}%`).limit(6)
    if (n !== ultimaBusqueda) return
    const ya = new Set(ctx.inscripciones.map((i) => i.user_id))
    otros = (data || []).filter((p) => !ya.has(p.id))
  }
  const fila = (id, nombre, extra) => `<div class="torneo-puerta-fila"><span>@${escapeHtml(nombre)}</span>${extra}</div>`
  caja.innerHTML =
    apuntados.map((i) => fila(i.user_id, i.perfil?.username || '', i.entrada_at ? '<span class="torneo-entrada-dentro-chapa">Ya dentro</span>' : `<button type="button" class="btn-primary" data-dar-entrada="${escapeHtml(i.user_id)}">Dar entrada</button>`)).join('') +
    otros.map((p) => fila(p.id, p.username, `<span class="subtext">sin plaza</span><button type="button" class="btn-secondary" data-dar-entrada="${escapeHtml(p.id)}" data-nombre="${escapeHtml(p.username)}">Apuntar y dar entrada</button>`)).join('') ||
    '<p class="subtext">Nadie con ese nombre. Si viene sin cuenta, toca «Viene sin cuenta».</p>'
}

function sinCuentaHtml() {
  const url = `${location.origin}/torneo?slug=${encodeURIComponent(ctx.torneo.slug)}`
  return `<div class="torneo-puerta-sin-cuenta">
    <span class="torneo-puerta-qr">${svgQR(url, { tam: 150 })}</span>
    <span><b>Que lo escanee con su móvil</b><br>Se hace la cuenta en un minuto y pide plaza. Luego le das entrada aquí con su QR o su @usuario.</span>
  </div>`
}

// ── El escáner: la cámara y el lector de QR del navegador ──
async function escanear() {
  if (!('BarcodeDetector' in window) || !navigator.mediaDevices?.getUserMedia) {
    showToast('Este navegador no lee códigos QR. Busca a la persona por su @usuario.', 'info')
    document.getElementById('puertaUsuario')?.focus()
    return
  }
  const d = document.createElement('dialog')
  d.className = 'torneo-puerta-escaner'
  d.innerHTML = `<p class="torneo-puerta-escaner-cab"><b>Enseña tu entrada</b><button type="button" class="torneo-lista-cerrar" data-cerrar aria-label="Cerrar">${icons.x(18)}</button></p>
    <video playsinline muted></video><p class="subtext" data-estado>Apunta al QR de «Tu entrada».</p>`
  document.body.append(d)
  d.showModal()
  let corriente = null
  let vivo = true
  const cerrar = () => {
    vivo = false
    corriente?.getTracks().forEach((t) => t.stop())
    d.close()
    d.remove()
  }
  d.querySelector('[data-cerrar]').addEventListener('click', cerrar)
  d.addEventListener('cancel', (e) => { e.preventDefault(); cerrar() })
  try {
    corriente = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
  } catch {
    d.querySelector('[data-estado]').textContent = 'No hay permiso para la cámara. Búscale por su @usuario.'
    return
  }
  const video = d.querySelector('video')
  video.srcObject = corriente
  await video.play().catch(() => {})
  const lector = new window.BarcodeDetector({ formats: ['qr_code'] })
  // Uno detrás de otro: tras cada entrada el escáner sigue abierto para el
  // siguiente de la cola.
  let ultimo = ''
  while (vivo) {
    try {
      const [c] = await lector.detect(video)
      if (c?.rawValue && c.rawValue !== ultimo) {
        ultimo = c.rawValue
        const r = leerEntrada(c.rawValue, ctx.torneo.id)
        const estado = d.querySelector('[data-estado]')
        if (r.error) estado.textContent = r.error
        else {
          const ok = await darEntrada(r.usuario, nombreDe(r.usuario))
          estado.textContent = ok ? `${nombreDe(r.usuario) || 'Entrada'} dentro. El siguiente.` : 'No se ha podido dar entrada.'
        }
      }
    } catch { /* un fotograma que no se lee: el siguiente */ }
    await new Promise((ok) => setTimeout(ok, 350))
  }
}

function enganchar() {
  enganchado = true
  document.addEventListener('click', async (e) => {
    if (!ctx || !hayPuerta(ctx.torneo)) return
    const dar = e.target.closest('[data-dar-entrada]')
    if (dar) {
      dar.disabled = true
      await darEntrada(dar.dataset.darEntrada, dar.dataset.nombre || nombreDe(dar.dataset.darEntrada))
      dar.disabled = false
      const campo = document.getElementById('puertaUsuario')
      if (campo?.value) { campo.value = ''; document.getElementById('puertaResultado').innerHTML = '' }
      return
    }
    const quitar = e.target.closest('[data-quitar-entrada]')
    if (quitar) {
      if (quitar.dataset.confirmar !== '1') {
        quitar.dataset.confirmar = '1'
        quitar.textContent = '¿Seguro?'
        return
      }
      const { error } = await ctx.supabase.rpc('torneos_quitar_entrada', { p_torneo: ctx.torneo.id, p_usuario: quitar.dataset.quitarEntrada })
      if (error) showToast(error.message, 'error')
      else showToast('Entrada quitada.', 'success')
      await ctx.recargar()
      return
    }
    if (e.target.closest('[data-puerta-escanear]')) return void escanear()
    const sin = e.target.closest('[data-puerta-sin-cuenta]')
    if (sin) {
      const caja = document.getElementById('puertaResultado')
      const abierto = sin.getAttribute('aria-expanded') === 'true'
      sin.setAttribute('aria-expanded', String(!abierto))
      caja.innerHTML = abierto ? '' : sinCuentaHtml()
    }
  })
  document.addEventListener('input', (e) => {
    if (e.target.id === 'puertaUsuario') void buscarUsuario(e.target.value)
  })
}
