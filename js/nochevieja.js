// NOCHEVIEJA (tanda 1288, PINGU eligió «Sí, con la temporada»). El 31 y el 1
// la cabecera pone `data-fiesta="nochevieja"` y reserva el sitio de una
// tarjeta en Inicio (portada.css): fuegos artificiales, la cuenta atrás hasta
// las 00:00 de España y, a las 00:00, «¡Feliz 2027!». Con cuenta, «Ver tu
// 2026»: tu año en historias (lo que añadiste, tu primera carta, tu racha, el
// foro, tus logros) y al final, la imagen para compartir con el marco de
// redes. Todo sale de lo que ya lee la web y de tus propias filas: no hay
// migración. Lo puro está en js/nochevieja-puro.js.
import { supabase } from './supabase.js'
import { getSession, getProfile, escapeHtml } from './app.js'
import { icons } from './icons.js'
import { hojaInyectada } from './hoja.js'
import { cadenaDeEscaneo, atributosDeEscaneo } from './escaneo-carta.js'
import { nivelDeXp } from './niveles.js'
import { cuentaAtras, anioDelResumen, diapositivas, resumenFinal } from './nochevieja-puro.js'

const ORO = '#f4c542'
const PASO_MS = 6000

const fuegosHtml = () => '<span class="nv-fuegos" aria-hidden="true"><i></i><i></i><i></i><i></i></span>'

function tarjetaHtml(c, anio, conCuenta) {
  const reloj = c.feliz
    ? `<b class="nv-feliz">¡Feliz ${c.anio}!</b>`
    : `<span class="nv-cuenta">Quedan <b data-nv-reloj>${c.texto}</b> para ${c.anio}</span>`
  return `${fuegosHtml()}
    <span class="nv-texto">
      <small>${c.feliz ? 'Año nuevo' : 'Nochevieja'}</small>
      ${reloj}
      ${conCuenta ? `<small>Y mientras: tu ${anio} en PokeDoc, en historias.</small>` : ''}
    </span>
    ${conCuenta ? `<button type="button" class="btn-primary nv-boton" data-nv-ver>Ver tu ${anio}</button>` : ''}`
}

// ── Los datos de tu año: cada uno por su lado, y lo que falle cuenta cero ──
const cero = (p) => p.then((x) => x ?? 0).catch(() => 0)

async function cartasDelAnio(uid, desde, hasta) {
  let total = 0
  for (let i = 0; i < 30; i++) {
    const { data, error } = await supabase.from('user_collection').select('cantidad')
      .eq('user_id', uid).gte('created_at', desde).lt('created_at', hasta).range(i * 1000, i * 1000 + 999)
    if (error) throw error
    for (const f of data || []) total += Number(f.cantidad) || 1
    if (!data || data.length < 1000) break
  }
  return total
}

async function primeraDelAnio(uid, desde, hasta) {
  const { data } = await supabase.from('user_collection').select('card_id,market')
    .eq('user_id', uid).gte('created_at', desde).lt('created_at', hasta).order('created_at').limit(1)
  const l = data?.[0]
  if (!l) return null
  const { data: c } = await supabase.from('tcg_cards')
    .select('id,market,name,name_es,local_id,set_id,image_path,image_tcggo,tcg_sets(name,serie_id,tcg_online_code)')
    .eq('id', l.card_id).eq('market', l.market || 'WEST').maybeSingle()
  return c || null
}

async function contar(tabla, columna, uid, campo, desde, hasta) {
  const { count, error } = await supabase.from(tabla).select(columna, { count: 'exact', head: true })
    .eq(campo, uid).gte(columna, desde).lt(columna, hasta)
  if (error) throw error
  return count || 0
}

export async function datosDelAnio(anio) {
  const s = await getSession().catch(() => null)
  const uid = s?.user?.id
  if (!uid) return null
  const desde = `${anio}-01-01T00:00:00+01:00`
  const hasta = `${anio + 1}-01-01T00:00:00+01:00`
  const [perfil, cartas, primera, numeros, mensajes, guias] = await Promise.all([
    getProfile(uid).catch(() => null),
    cero(cartasDelAnio(uid, desde, hasta)),
    primeraDelAnio(uid, desde, hasta).catch(() => null),
    import('./retos-datos.js').then((m) => m.misNumeros(366)).catch(() => null),
    cero(contar('forum_posts', 'created_at', uid, 'author_id', desde, hasta)),
    cero(contar('user_progress', 'read_at', uid, 'user_id', desde, hasta)),
  ])
  return {
    nombre: perfil?.display_name || perfil?.username || '',
    cartas, primera, mensajes, guias,
    mejorRacha: Number(numeros?.mejorRacha) || 0,
    retos: Number(numeros?.jugados) || 0,
    logros: Array.isArray(perfil?.achievements) ? perfil.achievements.length : 0,
    nivel: nivelDeXp(perfil?.total_xp).level,
  }
}

// ── Las historias ──
function diapoHtml(d, anio) {
  if (d.tipo === 'portada') return `${fuegosHtml()}<span class="nv-anio">${anio}</span><h2>${escapeHtml(d.titulo)}</h2><p>${escapeHtml(d.texto)}</p>`
  if (d.tipo === 'cifra') return `<span class="nv-icono" aria-hidden="true">${(icons[d.icono] || icons.sparkles)(32)}</span><b class="nv-grande">${escapeHtml(d.cifra)}</b><p>${escapeHtml(d.texto)}</p>`
  if (d.tipo === 'carta') {
    const c = d.carta
    const escaneo = atributosDeEscaneo(cadenaDeEscaneo(c))
    return `<p class="nv-antes">${escapeHtml(d.texto)}</p>
      <span class="nv-carta">${escaneo ? `<img ${escaneo} alt="" width="245" height="342" loading="lazy" decoding="async">` : ''}</span>
      <h2>${escapeHtml(c.name_es || c.name)}</h2>${c.tcg_sets?.name ? `<p>${escapeHtml(c.tcg_sets.name)}</p>` : ''}`
  }
  return `${fuegosHtml()}<h2>${escapeHtml(d.titulo)}</h2>
    <ul class="nv-cifras">${d.cifras.map(([n, t]) => `<li><b>${escapeHtml(n)}</b><small>${escapeHtml(t)}</small></li>`).join('')}</ul>
    <p>${escapeHtml(d.texto)}</p>
    <div class="nv-botones"><button type="button" class="btn-primary" data-nv-compartir>Compartir mi ${anio}</button><button type="button" class="btn-secondary" data-nv-cerrar>Cerrar</button></div>`
}

function abrirHistorias(anio, win = window) {
  const doc = win.document
  doc.body.insertAdjacentHTML('beforeend', `<dialog class="nv-historias" aria-label="Tu ${anio} en PokeDoc">
      <div class="nv-barras" data-nv-barras></div>
      <button type="button" class="nv-x" data-nv-cerrar aria-label="Cerrar">${icons.x(22)}</button>
      <div class="nv-diapo" data-nv-diapo><span class="nv-cargando">Juntando tu año…</span></div>
      <button type="button" class="nv-zona nv-atras" data-nv-atras aria-label="Anterior"></button>
      <button type="button" class="nv-zona nv-alante" data-nv-alante aria-label="Siguiente"></button>
    </dialog>`)
  const pop = doc.body.lastElementChild
  pop.showModal()
  let lista = []
  let i = 0
  let datos = null
  let reloj = null
  const quieto = win.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const pintar = () => {
    const d = lista[i]
    pop.querySelector('[data-nv-barras]').innerHTML = lista.map((_, n) => `<i class="${n < i ? 'nv-vista' : n === i ? 'nv-ahora' : ''}"${n === i && !quieto ? ` style="--nv-paso:${PASO_MS}ms"` : ''}></i>`).join('')
    const caja = pop.querySelector('[data-nv-diapo]')
    caja.dataset.tipo = d.tipo
    caja.innerHTML = diapoHtml(d, anio)
    pop.querySelector('[data-nv-alante]').hidden = i >= lista.length - 1
    pop.querySelector('[data-nv-atras]').hidden = i === 0
    win.clearTimeout(reloj)
    // Pasa sola (como una historia), menos la última y con «menos movimiento».
    if (!quieto && i < lista.length - 1) reloj = win.setTimeout(() => { i++; pintar() }, PASO_MS)
  }
  pop.addEventListener('click', (e) => {
    if (e.target.closest('[data-nv-cerrar]')) return pop.close()
    if (e.target.closest('[data-nv-compartir]')) return compartirAnio(anio, datos)
    if (e.target.closest('[data-nv-alante]') && i < lista.length - 1) { i++; pintar() }
    else if (e.target.closest('[data-nv-atras]') && i > 0) { i--; pintar() }
  })
  pop.addEventListener('close', () => { win.clearTimeout(reloj); pop.remove() })
  datosDelAnio(anio).then((d) => {
    if (!pop.isConnected) return
    datos = d || { cartas: 0, mensajes: 0, guias: 0, mejorRacha: 0, retos: 0, logros: 0 }
    lista = diapositivas(datos, anio)
    pintar()
  })
  return pop
}

// ── La imagen para compartir: el marco de redes con las cifras en baldosas ──
async function compartirAnio(anio, d) {
  if (!d) return
  const [{ abrirHojaCompartir }, marco, { redondeado }] = await Promise.all([
    import('./compartir-hoja.js'), import('./redes-marco.js'), import('./imagen-compartir.js'),
  ])
  const cifras = resumenFinal(d)
  const texto = `Mi ${anio} en PokeDoc: ${cifras.map(([n, t]) => `${n} ${t}`).join(', ') || 'un año de cartas'}. ¿Y el tuyo? https://pokedoc.es`
  return abrirHojaCompartir({
    titulo: `Compartir tu ${anio}`,
    texto,
    nombre: `mi-${anio}-pokedoc`,
    historiaPropia: true,
    imagen: async (formato) => {
      await marco.prepararMarco()
      const lienzo = document.createElement('canvas')
      const apaisada = formato === 'apaisada'
      const { ctx, caja } = marco.pintarMarco(lienzo, {
        formato,
        acento: ORO,
        chapa: `Tu ${anio}`,
        titulo: `Mi *${anio}* en PokeDoc`,
        entradilla: d.nivel ? `Termino el año en el nivel ${d.nivel}.` : '',
        enlace: 'pokedoc.es',
        linea: apaisada ? '' : formato === 'larga' ? 'Enlace en la bio' : '¿Y el tuyo?',
        maxLineas: 2,
      })
      if (cifras.length && caja.h > 80) baldosas(ctx, caja, cifras, redondeado, marco)
      return lienzo
    },
  })
}

function baldosas(ctx, caja, cifras, redondeado, marco) {
  const cols = cifras.length > 2 ? 2 : cifras.length
  const filas = Math.ceil(cifras.length / cols)
  const hueco = Math.round(caja.w * 0.04)
  const w = (caja.w - hueco * (cols - 1)) / cols
  const h = Math.min((caja.h - hueco * (filas - 1)) / filas, w * 0.75)
  const y0 = caja.y + (caja.h - (h * filas + hueco * (filas - 1))) / 2
  cifras.forEach(([n, t], k) => {
    const x = caja.x + (k % cols) * (w + hueco)
    const y = y0 + Math.floor(k / cols) * (h + hueco)
    ctx.fillStyle = 'rgba(255,255,255,0.08)'
    redondeado(ctx, x, y, w, h, Math.round(h * 0.16))
    ctx.fill()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = ORO
    ctx.font = `800 ${Math.round(h * 0.38)}px ${marco.TITULAR}`
    ctx.fillText(n, x + w / 2, y + h * 0.44)
    ctx.fillStyle = '#cfe3f1'
    ctx.font = `500 ${Math.round(h * 0.13)}px ${marco.TEXTO}`
    ctx.fillText(t, x + w / 2, y + h * 0.76)
  })
}

// ── La tarjeta de Inicio ──
export async function montarNochevieja({ caja = document.getElementById('nochevieja'), win = window } = {}) {
  if (!caja) return
  await hojaInyectada('css/nochevieja.css')
  const s = await getSession().catch(() => null)
  const anio = anioDelResumen()
  const pintar = () => { caja.innerHTML = tarjetaHtml(cuentaAtras(), anio, !!s) }
  pintar()
  const tic = win.setInterval(() => {
    const c = cuentaAtras()
    const r = caja.querySelector('[data-nv-reloj]')
    if (c.feliz || !r) { pintar(); if (c.feliz) win.clearInterval(tic) } else r.textContent = c.texto
  }, 1000)
  caja.addEventListener('click', (e) => { if (e.target.closest('[data-nv-ver]')) abrirHistorias(anio, win) })
}
