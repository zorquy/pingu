// /eventos (tanda 1192): la agenda de card shows, trade days y quedadas, y la
// ficha de cada uno en /eventos/<slug> (netlify.toml la sirve con este mismo
// HTML). Lo que se pinta sale de `eventos_lista` y `evento_ficha`
// (supabase-migration-1192-eventos.sql); «Voy» pasa por `evento_voy`. Sin la
// migración, la página lo dice con calma y no se rompe.
//
// La propuesta (PINGU, «como me propusiste, me parece bien»): en Comunidad, lo
// próximo arriba y lo pasado apagado debajo; quién va se ve (con la opción de
// ir «sin decirlo»); los da de alta el equipo desde /admin → Eventos; y cada
// ficha enlaza a TCG Map Spain, que es quien tiene el mapa de tiendas.
import { supabase } from './supabase.js'
import { escapeHtml } from './html.js'
import { avatarStyle, getInitial, getSession, profileUrl } from './app.js'
import { icons } from './icons.js'
import { sinMigracion } from './sin-migracion.js'
import { showToast } from './toast.js'
import { TIPOS, MESES, cuandoEs, fechaLarga, siglasDe, filtrar, separar, webSegura, instagramDe, mapaDe, vanTexto, horarioDe, mismoHorario, diasConHora, entradasDe, precioTexto } from './eventos-puro.js'

const $ = (id) => document.getElementById(id)
const ic = (n, t = 16) => icons[n]?.(t) || ''
const caja = $('eventos')
const nombre = (p) => p?.display_name || p?.username || 'Alguien'

const slugDeLaDireccion = () => {
  const p = new URLSearchParams(location.search).get('e')
  if (p) return p
  const m = location.pathname.match(/^\/eventos\/([^/]+)\/?$/)
  return m ? decodeURIComponent(m[1]) : ''
}
const rutaDe = (e) => `/eventos/${encodeURIComponent(e.slug)}`

function logoHtml(e, grande = false) {
  const color = /^#[0-9a-f]{6}$/i.test(e.color || '') ? e.color : ''
  const foto = webSegura(e.logo_url)
  return `<span class="ev-logo${grande ? ' grande' : ''}"${color ? ` style="--ev-color:${color}"` : ''} aria-hidden="true">${foto ? `<img src="${escapeHtml(foto)}" alt="" loading="lazy" decoding="async" onerror="this.remove()">` : ''}<b>${escapeHtml(siglasDe(e))}</b></span>`
}

const caraHtml = (p, t = 24) => `<span class="ev-cara" style="width:${t}px;height:${t}px;${avatarStyle(p)}" title="${escapeHtml(nombre(p))}" aria-hidden="true">${p?.avatar_url ? '' : escapeHtml(getInitial(nombre(p)))}</span>`

function voyHtml(e, sesion, { pasado = false } = {}) {
  if (pasado) return ''
  if (!sesion) return `<a class="btn-secondary ev-voy" href="/auth.html?registro=1&volver=${encodeURIComponent(rutaDe(e))}">Voy</a>`
  return `<button type="button" class="${e.voy ? 'btn-primary' : 'btn-secondary'} ev-voy" data-voy="${escapeHtml(e.id)}" aria-pressed="${e.voy ? 'true' : 'false'}">${e.voy ? `${ic('checkCircle', 16)} Voy` : 'Voy'}</button>`
}

// «7» o, si dura varios días del mismo mes, «7–8» (1193).
function diasDeFila(e, d) {
  const h = horarioDe(e)
  if (h.length < 2) return String(d.getDate())
  const [a, b] = [h[0].dia, h[h.length - 1].dia]
  return a.slice(0, 7) === b.slice(0, 7) ? `${Number(a.slice(8))}–${Number(b.slice(8))}` : String(d.getDate())
}

function filaHtml(e, sesion, ahora) {
  const d = new Date(e.empieza)
  const pasado = new Date(e.termina || e.empieza) < new Date(ahora).setHours(0, 0, 0, 0)
  const donde = [e.sitio, e.ciudad].filter(Boolean).join(' · ')
  const cuando = pasado ? '' : cuandoEs(e.empieza, ahora)
  const caras = (e.caras || []).slice(0, 3)
  return `<li class="ev-fila${pasado ? ' pasado' : ''}" data-ev="${escapeHtml(e.slug)}">
    <a class="ev-enlace" href="${rutaDe(e)}">
      <span class="ev-fecha"><b>${escapeHtml(diasDeFila(e, d))}</b><small>${MESES[d.getMonth()]}</small></span>
      ${logoHtml(e)}
      <span class="ev-cuerpo">
        <strong>${escapeHtml(e.nombre)}</strong>
        ${donde ? `<small>${escapeHtml(donde)}</small>` : ''}
        <span class="ev-chips"><span class="ev-tipo">${escapeHtml(TIPOS[e.tipo] || 'Evento')}</span>${cuando ? `<span class="ev-cuando">${escapeHtml(cuando)}</span>` : ''}</span>
      </span>
    </a>
    <span class="ev-van">${caras.length ? `<span class="ev-caras">${caras.map((p) => caraHtml(p, 22)).join('')}</span>` : ''}<span data-van>${e.van ? escapeHtml(vanTexto(e.van, pasado)) : pasado ? '' : 'Sé el primero'}</span></span>
    ${voyHtml(e, sesion, { pasado })}
  </li>`
}

// ── La agenda ──
async function pintarAgenda(sesion) {
  const { data, error } = await supabase.rpc('eventos_lista')
  if (error) {
    caja.innerHTML = sinMigracion(error)
      ? '<p class="empty-state">La agenda de eventos llega muy pronto.</p>'
      : '<p class="empty-state">No se ha podido cargar la agenda. Vuelve a intentarlo en un momento.</p>'
    return
  }
  const todos = data || []
  if (!todos.length) {
    caja.innerHTML = '<p class="empty-state">Todavía no hay eventos en la agenda. El equipo los irá añadiendo; si conoces uno, <a href="/foro.html">cuéntalo en el foro</a>.</p>'
    return
  }
  const ahora = new Date()
  const estado = { tipo: '', provincia: '', soloVoy: false }
  const tipos = Object.keys(TIPOS).filter((t) => todos.some((e) => e.tipo === t))
  const provincias = [...new Set(todos.map((e) => e.provincia || e.ciudad).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'))
  const pintar = () => {
    const { proximos, pasados } = separar(filtrar(todos, estado), ahora)
    const chips = [['', 'Todos'], ...tipos.map((t) => [t, TIPOS[t]])]
      .map(([t, n]) => `<button type="button" class="chip-filtro" data-tipo="${t}" aria-pressed="${estado.tipo === t}">${escapeHtml(n)}</button>`).join('')
    const prov = provincias.length > 1
      ? `<select class="ev-provincia" id="evProvincia" aria-label="Provincia"><option value="">Toda España</option>${provincias.map((p) => `<option${estado.provincia === p ? ' selected' : ''}>${escapeHtml(p)}</option>`).join('')}</select>`
      : ''
    const mios = sesion ? `<button type="button" class="chip-filtro" id="evSoloVoy" aria-pressed="${estado.soloVoy}">${ic('checkCircle', 14)} Solo a los que voy</button>` : ''
    caja.innerHTML = `
      <div class="ev-mandos">${chips}${prov}${mios}</div>
      <section aria-labelledby="evProximosT">
        <h2 class="section-title" id="evProximosT">Próximos</h2>
        ${proximos.length ? `<ul class="ev-lista">${proximos.map((e) => filaHtml(e, sesion, ahora)).join('')}</ul>` : `<p class="empty-state">${estado.soloVoy ? 'Todavía no has marcado «Voy» en ningún evento.' : 'Con estos filtros no hay ningún evento próximo.'}</p>`}
      </section>
      ${pasados.length ? `<section aria-labelledby="evPasadosT"><h2 class="section-title" id="evPasadosT">Pasados</h2><ul class="ev-lista">${pasados.map((e) => filaHtml(e, sesion, ahora)).join('')}</ul></section>` : ''}`
  }
  pintar()
  caja.addEventListener('click', async (ev) => {
    const t = ev.target.closest('[data-tipo]')
    if (t) { estado.tipo = t.dataset.tipo; pintar(); return }
    if (ev.target.closest('#evSoloVoy')) { estado.soloVoy = !estado.soloVoy; pintar(); return }
    const b = ev.target.closest('[data-voy]')
    if (b) {
      const e = todos.find((x) => x.id === b.dataset.voy)
      if (e) await alternarVoy(e, !e.voy, false, pintar)
    }
  })
  caja.addEventListener('change', (ev) => {
    if (ev.target.id === 'evProvincia') { estado.provincia = ev.target.value; pintar() }
  })
}

// «Voy» cambia YA, confirma después y deshace si falla (la 896).
async function alternarVoy(e, voy, oculto, repintar, alDia = null) {
  const antes = { voy: e.voy, oculto: e.oculto, van: e.van }
  e.voy = voy
  e.oculto = voy && oculto
  e.van = Math.max(0, (e.van || 0) + (voy && !antes.voy ? 1 : !voy && antes.voy ? -1 : 0))
  repintar()
  const { data, error } = await supabase.rpc('evento_voy', { p_evento: e.id, p_voy: voy, p_oculto: !!oculto })
  if (error) {
    Object.assign(e, antes)
    repintar()
    showToast(/ya pasó/.test(error.message || '') ? 'Ese evento ya pasó.' : 'No se ha podido guardar. Vuelve a intentarlo.')
    return
  }
  if (data) { e.van = data.van; e.voy = data.voy; e.oculto = data.oculto }
  if (alDia) await alDia().catch(() => {})
  repintar()
}

// ── La ficha ──
async function pintarFicha(slug, sesion) {
  $('eventosCabecera')?.classList.add('hidden')
  const { data, error } = await supabase.rpc('evento_ficha', { p_slug: slug })
  if (error && !sinMigracion(error)) {
    caja.innerHTML = '<p class="empty-state">No se ha podido cargar este evento. Vuelve a intentarlo en un momento.</p>'
    return
  }
  if (!data) {
    caja.innerHTML = `<p class="empty-state">Este evento no existe o ya no está publicado. <a href="/eventos">Ver la agenda</a></p>`
    return
  }
  const e = data
  const ahora = new Date()
  const pasado = new Date(e.termina || e.empieza) < new Date(ahora).setHours(0, 0, 0, 0)
  document.title = `${e.nombre} — Eventos — PokeDoc`
  const desc = [fechaLarga(e), e.sitio, e.ciudad].filter(Boolean).join(' · ')
  const web = webSegura(e.web)
  const insta = instagramDe(e.instagram)
  const mapa = mapaDe(e)
  const tcgmap = webSegura(e.tcgmap_url)
  const entradas = entradasDe(e)
  const pintar = () => {
    const visibles = e.caras || []
    const ocultos = Math.max(0, (e.van || 0) - visibles.length)
    const quien = e.van
      ? `<p class="ev-cuantos"><b>${e.van}</b> ${e.van === 1 ? (pasado ? 'persona fue' : 'persona va') : pasado ? 'personas fueron' : 'personas van'}${ocultos ? ` <small>(${ocultos} sin decirlo)</small>` : ''}</p>
         ${visibles.length ? `<ul class="ev-gente">${visibles.map((p) => `<li><a href="${profileUrl(p)}">${caraHtml(p, 32)}<span>${escapeHtml(nombre(p))}</span></a></li>`).join('')}</ul>` : ''}`
      : `<p class="ev-cuantos">${pasado ? 'Nadie de PokeDoc marcó que iba.' : 'Todavía no ha marcado nadie que va. ¡Sé el primero!'}</p>`
    const fila = (icono, titulo, valor) => (valor ? `<div class="ev-dato">${ic(icono, 18)}<span><b>${titulo}</b>${valor}</span></div>` : '')
    caja.innerHTML = `
      <a class="ev-volver" href="/eventos">${ic('chevronLeft', 16)} Eventos</a>
      <header class="ev-cab">
        ${logoHtml(e, true)}
        <div class="ev-cab-texto">
          <span class="ev-chips"><span class="ev-tipo">${escapeHtml(TIPOS[e.tipo] || 'Evento')}</span>${!pasado && cuandoEs(e.empieza, ahora) ? `<span class="ev-cuando">${escapeHtml(cuandoEs(e.empieza, ahora))}</span>` : ''}${pasado ? '<span class="ev-cuando">Ya pasó</span>' : ''}</span>
          <h1>${escapeHtml(e.nombre)}</h1>
          <p>${escapeHtml(desc)}</p>
        </div>
      </header>
      <div class="ev-acciones">
        ${voyHtml(e, sesion, { pasado })}
        ${sesion && e.voy && !pasado ? `<label class="ev-oculto"><input type="checkbox" id="evOculto"${e.oculto ? ' checked' : ''}> Ir sin decirlo <small>(solo cuentas en el número)</small></label>` : ''}
        <button type="button" class="btn-secondary" id="evCompartir">${ic('share', 16)} Compartir</button>
        ${e.voy && !pasado ? `<a class="btn-secondary" href="/evento">${ic('cards', 16)} Abrir mi modo evento</a>` : ''}
      </div>
      <div class="ev-ficha-cols">
        <section class="ev-caja" aria-labelledby="evQuienT"><h2 id="evQuienT">Quién va de PokeDoc</h2>${quien}</section>
        <section class="ev-caja" aria-labelledby="evSobreT">
          <h2 id="evSobreT">Sobre el evento</h2>
          ${fila('calendar', 'Cuándo', escapeHtml(fechaLarga(e)) + (mismoHorario(horarioDe(e)) ? '' : `<ul class="ev-dias">${diasConHora(e).map((d) => `<li>${escapeHtml(d.texto)} <span>${escapeHtml(d.horas)}</span></li>`).join('')}</ul>`))}
          ${fila('pin', 'Dónde', `${escapeHtml([e.sitio, e.direccion, e.ciudad, e.provincia && e.provincia !== e.ciudad ? e.provincia : ''].filter(Boolean).join(', '))}${mapa ? ` · <a href="${escapeHtml(mapa)}" target="_blank" rel="noopener">Ver en el mapa</a>` : ''}`)}
          ${entradas.length ? fila('receipt', entradas.length > 1 ? 'Entradas' : 'Entrada', `<ul class="ev-entradas">${entradas.map((x) => `<li><span>${escapeHtml(x.nombre)}${x.nota ? `<small>${escapeHtml(x.nota)}</small>` : ''}</span><b>${escapeHtml(precioTexto(x.precio) || 'Consultar')}</b></li>`).join('')}</ul>`) : fila('receipt', 'Entrada', escapeHtml(e.entrada || ''))}
          ${fila('cards', 'Juegos', escapeHtml(e.juegos || ''))}
          ${e.descripcion ? `<p class="ev-desc">${escapeHtml(e.descripcion)}</p>` : ''}
          <div class="ev-enlaces">
            ${web ? `<a class="btn-secondary" href="${escapeHtml(web)}" target="_blank" rel="noopener">${ic('link', 16)} Web</a>` : ''}
            ${insta ? `<a class="btn-secondary" href="${escapeHtml(insta.url)}" target="_blank" rel="noopener">${ic('camera', 16)} @${escapeHtml(insta.usuario)}</a>` : ''}
            ${tcgmap ? `<a class="btn-secondary" href="${escapeHtml(tcgmap)}" target="_blank" rel="noopener">${ic('pin', 16)} Ver en TCG Map Spain</a>` : ''}
          </div>
        </section>
      </div>`
  }
  pintar()
  // En la ficha, la lista de quién va sale de la base: tras «Voy» o «sin
  // decirlo» se vuelve a pedir, para que salgas (o no) donde toca.
  const alDia = async () => {
    const { data: nuevo } = await supabase.rpc('evento_ficha', { p_slug: slug })
    if (nuevo) { e.caras = nuevo.caras; e.van = nuevo.van }
  }
  caja.addEventListener('click', async (ev) => {
    if (ev.target.closest('[data-voy]')) await alternarVoy(e, !e.voy, false, pintar, alDia)
    if (ev.target.closest('#evCompartir')) {
      const url = `${location.origin}${rutaDe(e)}`
      try {
        if (navigator.share) await navigator.share({ title: e.nombre, text: `${e.nombre} · ${desc}`, url })
        else { await navigator.clipboard.writeText(url); showToast('Enlace copiado.', 'success') }
      } catch {}
    }
  })
  caja.addEventListener('change', async (ev) => {
    if (ev.target.id === 'evOculto') await alternarVoy(e, true, ev.target.checked, pintar, alDia)
  })
}

async function arrancar() {
  if (!caja) return
  const sesion = await getSession().catch(() => null)
  const slug = slugDeLaDireccion()
  if (slug) await pintarFicha(slug, sesion)
  else await pintarAgenda(sesion)
}

arrancar()
