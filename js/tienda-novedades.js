// Cuéntaselo a tus seguidores (tanda 1432): en /tienda → Escaparate, la tienda
// escribe una novedad corta con hasta seis cartas de su stock. Sale arriba de
// su escaparate (perfil-tienda.js) y les llega a la campanita a quienes la
// siguen. Una por semana: lo cuenta la base (`tienda_publicar_novedad`), aquí
// solo se enseña cuándo toca la siguiente.
//
// Es del plan Tienda (1429): con uno menor, la tarjeta dice de qué plan es. Sin
// la migración (`tienda_novedades_estado` falla), la tarjeta no sale.
import { supabase } from './supabase.js'
import { escapeHtml } from './html.js'
import { icons } from './icons.js'
import { showToast } from './toast.js'
import { cadenaDeEscaneo, atributosDeEscaneo } from './escaneo-carta.js'
import { COLUMNAS_CARTA_DE_SET } from './mi-coleccion/columnas-set.js'

const MAX_TEXTO = 280
const MAX_CARTAS = 6
const est = { tiendaId: null, estado: null, ultimas: [], elegidas: [], fotos: new Map(), buscando: 0 }
let caja = null
let alCambiar = () => {}
const $ = (sel) => caja.querySelector(sel)
const fecha = (d) => new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })

function fotoHtml(cardId) {
  const c = est.fotos.get(cardId)
  const foto = c ? atributosDeEscaneo(cadenaDeEscaneo(c)) : null
  return `<span class="tdn-foto" aria-hidden="true">${foto ? `<img ${foto} alt="" width="245" height="342" loading="lazy" />` : ''}</span>`
}

async function completarFotos(lista) {
  for (const market of ['WEST', 'JP']) {
    const faltan = [...new Set(lista.filter((x) => x?.card_id && (x.market || 'WEST') === market && !est.fotos.has(x.card_id)).map((x) => x.card_id))]
    if (!faltan.length) continue
    const { data } = await supabase.from('tcg_cards').select(COLUMNAS_CARTA_DE_SET).eq('market', market).in('id', faltan.slice(0, 60))
    for (const c of data || []) est.fotos.set(c.id, c)
  }
}

export async function montarNovedades(destino, { tiendaId, alCambiar: cb } = {}) {
  caja = destino
  est.tiendaId = tiendaId
  if (cb) alCambiar = cb
  const { data, error } = await supabase.rpc('tienda_novedades_estado')
  if (error || !data) {
    caja.hidden = true
    return
  }
  est.estado = data
  const r = await supabase.from('tienda_novedades').select('id,texto,cartas,avisados,created_at').eq('tienda_id', tiendaId).order('created_at', { ascending: false }).limit(3)
  est.ultimas = Array.isArray(r.data) ? r.data : []
  await completarFotos(est.ultimas.flatMap((n) => (Array.isArray(n.cartas) ? n.cartas : []))).catch(() => {})
  const plan = await import('./tienda-plan.js').catch(() => null)
  const abre = plan ? await plan.abre('novedades') : true
  let candado = ''
  if (!abre) {
    const e = await plan.cargarPlan()
    const { precioTexto } = await import('./tienda-plan-puro.js')
    candado = `<p class="tdn-candado">${icons.lock(14)} Con Tienda (${escapeHtml(precioTexto('tienda', e?.fundadora))}) les cuentas tus novedades a quienes te siguen. <a href="/tienda?ver=datos#plan" data-ver="datos">Ver planes</a></p>`
  }
  pintar(candado)
  caja.hidden = false
}

function pintar(candado = '') {
  const s = Number(est.estado?.seguidores) || 0
  const proxima = est.estado?.proxima && new Date(est.estado.proxima) > new Date() ? est.estado.proxima : null
  const cuerpo = candado
    || (proxima
      ? `<p class="tdn-espera">${icons.clock(16)}<span>Ya has contado una esta semana. La siguiente, a partir del <b>${escapeHtml(fecha(proxima))}</b>.</span></p>`
      : `<label class="tdn-campo"><span class="sr-only">Tu novedad</span><textarea data-tdn-texto rows="3" maxlength="${MAX_TEXTO}" placeholder="Ha llegado la caja de 151: Charizard, Mew y alguna más. ¡Pásate!"></textarea><small class="tdn-cuenta" data-tdn-cuenta>0 / ${MAX_TEXTO}</small></label>
        <div class="tdn-cartas" data-tdn-cartas></div>
        <div class="tdn-busca" data-tdn-busca hidden>
          <input type="search" data-tdn-q placeholder="Busca en tu stock" aria-label="Busca una carta de tu stock" />
          <ul class="tdn-resultados" data-tdn-resultados></ul>
        </div>
        <div class="tdn-pie">
          <button type="button" class="btn-secondary" data-tdn-anadir>${icons.cards(16)}<span>Añadir cartas</span></button>
          <button type="button" class="btn-primary" data-tdn-publicar disabled>${icons.send(16)}<span>${s ? `Publicar y avisar a ${s}` : 'Publicar'}</span></button>
        </div>`)
  caja.innerHTML = `
    <div class="tdn-cab">
      <h2>${icons.bell(18)}<span>Cuéntaselo a tus seguidores</span></h2>
      <span class="tdn-seguidores">${s === 1 ? '1 persona te sigue' : `${s} personas te siguen`}</span>
    </div>
    <p class="tdn-sub">${s ? 'Una novedad corta, con sus cartas: sale arriba de tu escaparate y les llega a la campanita. Una por semana, para que nadie se harte.' : 'Aún no te sigue nadie: la novedad sale arriba de tu escaparate igual. Comparte tu QR para que te sigan.'}</p>
    ${cuerpo}
    ${est.ultimas.length ? `<h3 class="tdn-ultimas-titulo">Lo que has contado</h3><ul class="tdn-ultimas">${est.ultimas.map((n) => `<li>
        <time datetime="${escapeHtml(n.created_at)}">${escapeHtml(fecha(n.created_at))}</time>
        <p>${escapeHtml(n.texto)}</p>
        ${Array.isArray(n.cartas) && n.cartas.length ? `<span class="tdn-mini">${n.cartas.map((c) => fotoHtml(c.card_id)).join('')}</span>` : ''}
        <span class="tdn-ultima-pie"><small>${n.avisados === 1 ? 'Avisaste a 1 persona' : `Avisaste a ${n.avisados || 0} personas`}</small><button type="button" class="link-btn tdn-borrar" data-tdn-borrar="${escapeHtml(n.id)}">Borrar</button></span>
      </li>`).join('')}</ul>` : ''}`
  pintarElegidas()
}

function pintarElegidas() {
  const hueco = $('[data-tdn-cartas]')
  if (!hueco) return
  hueco.innerHTML = est.elegidas.map((c, i) => `<span class="tdn-chip">${fotoHtml(c.card_id)}<span>${escapeHtml(c.nombre || c.card_id)}</span><button type="button" data-tdn-quitar="${i}" aria-label="Quitar ${escapeHtml(c.nombre || 'carta')}">${icons.x(14)}</button></span>`).join('')
  const anadir = $('[data-tdn-anadir]')
  if (anadir) anadir.disabled = est.elegidas.length >= MAX_CARTAS
  listo()
}

function listo() {
  const t = $('[data-tdn-texto]')
  const b = $('[data-tdn-publicar]')
  if (!t || !b) return
  const n = t.value.trim().length
  $('[data-tdn-cuenta]').textContent = `${t.value.length} / ${MAX_TEXTO}`
  b.disabled = n < 1 || n > MAX_TEXTO
}

async function buscar(q) {
  const yo = ++est.buscando
  const ul = $('[data-tdn-resultados]')
  if (q.length < 2) {
    ul.innerHTML = ''
    return
  }
  const { data } = await supabase.rpc('tienda_stock_lista', { p_filtros: { q, unidades: ['una', 'varias'] }, p_orden: 'nombre', p_desde: 0, p_cuantas: 12 }).then((r) => r, () => ({ data: null }))
  if (yo !== est.buscando) return
  const vistas = new Set()
  const filas = (data?.filas || []).filter((f) => f.card_id && !vistas.has(f.card_id) && vistas.add(f.card_id))
  await completarFotos(filas).catch(() => {})
  if (yo !== est.buscando) return
  ul.innerHTML = filas.length
    ? filas.map((f) => `<li><button type="button" class="tdn-res" data-tdn-elegir='${escapeHtml(JSON.stringify({ card_id: f.card_id, market: f.market || 'WEST', nombre: f.nombre || '' }))}'>${fotoHtml(f.card_id)}<span><strong>${escapeHtml(f.nombre || f.card_id)}</strong><small>${escapeHtml([f.numero ? `nº ${f.numero}` : '', `${f.unidades} ${f.unidades === 1 ? 'ud.' : 'uds.'}`].filter(Boolean).join(' · '))}</small></span></button></li>`).join('')
    : `<li class="tdn-nada">Nada en tu stock con «${escapeHtml(q)}».</li>`
}

async function publicar(boton) {
  const plan = await import('./tienda-plan.js').catch(() => null)
  if (plan && !(await plan.permitido('novedades'))) return
  const texto = $('[data-tdn-texto]').value.trim()
  boton.disabled = true
  const { data, error } = await supabase.rpc('tienda_publicar_novedad', { p_texto: texto, p_cartas: est.elegidas.map(({ card_id, market }) => ({ card_id, market })) })
  if (error || !data) {
    boton.disabled = false
    return showToast('No se ha podido publicar. Inténtalo de nuevo.', 'error')
  }
  if (!data.vale) {
    boton.disabled = false
    return showToast(data.motivo === 'una_por_semana' ? `Ya has contado una esta semana. La siguiente, a partir del ${fecha(data.proxima)}.` : data.motivo === 'texto' ? `Escribe algo (como mucho ${MAX_TEXTO} letras).` : 'No se ha podido publicar.', 'info')
  }
  est.elegidas = []
  showToast(data.avisados ? `Publicada. Se lo hemos contado a ${data.avisados === 1 ? '1 persona' : `${data.avisados} personas`}.` : 'Publicada en tu escaparate.', 'success')
  await montarNovedades(caja, { tiendaId: est.tiendaId })
  alCambiar()
}

// Borrar pide un segundo toque en el mismo botón (sin pop-up encima).
async function borrar(boton) {
  if (boton.dataset.seguro !== '1') {
    boton.dataset.seguro = '1'
    boton.textContent = '¿Seguro? Borrar'
    setTimeout(() => { if (boton.isConnected) { boton.dataset.seguro = ''; boton.textContent = 'Borrar' } }, 4000)
    return
  }
  boton.disabled = true
  const { data, error } = await supabase.rpc('tienda_borrar_novedad', { p_id: boton.dataset.tdnBorrar })
  if (error || data !== true) {
    boton.disabled = false
    return showToast('No se ha podido borrar.', 'error')
  }
  showToast('Borrada. La semana sigue contando.', 'info')
  await montarNovedades(caja, { tiendaId: est.tiendaId })
  alCambiar()
}

// Los oyentes, una vez por caja (se repinta dentro, no se cambia de caja).
export function oyentesDeNovedades(destino) {
  if (destino.dataset.tdnOyentes) return
  destino.dataset.tdnOyentes = '1'
  let espera = null
  destino.addEventListener('input', (e) => {
    if (e.target.matches('[data-tdn-texto]')) listo()
    if (e.target.matches('[data-tdn-q]')) {
      clearTimeout(espera)
      espera = setTimeout(() => buscar(e.target.value.trim()), 250)
    }
  })
  destino.addEventListener('click', (e) => {
    if (e.target.closest('[data-tdn-anadir]')) {
      const b = $('[data-tdn-busca]')
      b.hidden = false
      b.querySelector('input').focus()
      return
    }
    const elegir = e.target.closest('[data-tdn-elegir]')
    if (elegir) {
      const c = JSON.parse(elegir.dataset.tdnElegir)
      if (!est.elegidas.some((x) => x.card_id === c.card_id) && est.elegidas.length < MAX_CARTAS) est.elegidas.push(c)
      if (est.elegidas.length >= MAX_CARTAS) $('[data-tdn-busca]').hidden = true
      return pintarElegidas()
    }
    const quitar = e.target.closest('[data-tdn-quitar]')
    if (quitar) {
      est.elegidas.splice(Number(quitar.dataset.tdnQuitar), 1)
      return pintarElegidas()
    }
    const pub = e.target.closest('[data-tdn-publicar]')
    if (pub) return void publicar(pub)
    const bo = e.target.closest('[data-tdn-borrar]')
    if (bo) return void borrar(bo)
  })
}
