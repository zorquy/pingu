// /eventos (tanda 1192): la agenda de card shows, trade days y quedadas, y la
// ficha de cada uno en /eventos/<slug> (netlify.toml la sirve con este mismo
// HTML). Lo que se pinta sale de `eventos_lista` y `evento_ficha`
// (supabase-migration-1192-eventos.sql); «Voy» pasa por `evento_voy`. Sin la
// migración, la página lo dice con calma y no se rompe.
//
// Desde la 1194 (PINGU eligió la A de «Eventos con cartel»: «cada evento
// vamos a ponerlo como que es más especial»): la agenda son CARTELES por mes
// (la imagen del evento o su color con el logo, la fecha en una pastilla y la
// cuenta atrás), y la ficha lleva todo lo que se lee arriba, en la cabecera al
// lado del logo (PINGU: «como en las tiendas… que no tengas que bajar para ver
// sobre el evento»); debajo, las entradas, los días, quién va y dónde.
import { supabase } from './supabase.js'
import { escapeHtml, urlParaCss } from './html.js'
import { avatarStyle, getInitial, getSession, profileUrl } from './app.js'
import { icons } from './icons.js'
import { sinMigracion } from './sin-migracion.js'
import { showToast } from './toast.js'
import {
  TIPOS, fechaLarga, siglasDe, filtrar, separar, webSegura, instagramDe, mapaDe, vanTexto,
  horarioDe, mismoHorario, icsDeEvento, fechaDeDia, entradasDe, precioTexto, desdePrecio, pastillaDe, cuentaAtras, mesDe, esEntradaVip, horasDe,
} from './eventos-puro.js'

const $ = (id) => document.getElementById(id)
const ic = (n, t = 16) => icons[n]?.(t) || ''
const caja = $('eventos')
const nombre = (p) => p?.display_name || p?.username || 'Alguien'
const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
// Para lo pasado: una fecha tan lejana que no queda cuenta atrás.
const NUNCA = new Date(8.64e15)

const slugDeLaDireccion = () => {
  const p = new URLSearchParams(location.search).get('e')
  if (p) return p
  const m = location.pathname.match(/^\/eventos\/([^/]+)\/?$/)
  return m ? decodeURIComponent(m[1]) : ''
}
const rutaDe = (e) => `/eventos/${encodeURIComponent(e.slug)}`
const colorDe = (e) => (/^#[0-9a-f]{6}$/i.test(e.color || '') ? e.color : '')

function logoHtml(e, clase = 'ev-logo') {
  const color = colorDe(e)
  const foto = webSegura(e.logo_url)
  return `<span class="${clase}"${color ? ` style="--ev-color:${color}"` : ''} aria-hidden="true">${foto ? `<img src="${escapeHtml(foto)}" alt="" loading="lazy" decoding="async" onerror="this.remove()">` : ''}<b>${escapeHtml(siglasDe(e))}</b></span>`
}

// El cartel: una franja baja (1196, PINGU: «¿para qué queremos tanto
// amarillo?»). Con imagen subida, la imagen; si no, el ambiente sale del
// LOGO, muy difuminado (`.ev-ambiente`), o del color del evento si no hay
// logo; y el logo nítido en medio. La pastilla de la fecha y la cuenta atrás
// van encima.
function cartelHtml(e, { ahora = new Date(), conPastilla = true, conTipo = true, clase = 'ev-cartel', etiqueta = '' } = {}) {
  const color = colorDe(e)
  const foto = urlParaCss(webSegura(e.cartel_url))
  const logo = urlParaCss(webSegura(e.logo_url))
  const p = pastillaDe(e)
  const cuenta = cuentaAtras(e, ahora)
  const estilo = [color ? `--ev-color:${color}` : '', foto ? `background-image:url('${foto}')` : ''].filter(Boolean).join(';')
  return `<span class="${clase}${foto ? ' con-imagen' : ''}"${estilo ? ` style="${estilo}"` : ''}${etiqueta ? ` role="img" aria-label="${escapeHtml(etiqueta)}"` : ''}>
      ${!foto && logo ? `<span class="ev-ambiente" style="background-image:url('${logo}')" aria-hidden="true"></span>` : ''}
      ${conTipo ? `<span class="ev-tipo">${escapeHtml(TIPOS[e.tipo] || 'Evento')}</span>` : ''}
      ${conPastilla && p.dia ? `<span class="ev-pastilla"><small>${escapeHtml(p.arriba)}</small><b>${escapeHtml(p.dia)}</b></span>` : ''}
      ${cuenta ? `<span class="ev-cuenta">${escapeHtml(cuenta)}</span>` : ''}
      ${foto || !conPastilla ? '' : logoHtml(e, 'ev-logo ev-logo-cartel')}
    </span>`
}

const caraHtml = (p, t = 24) => `<span class="ev-cara" style="width:${t}px;height:${t}px;${avatarStyle(p)}" title="${escapeHtml(nombre(p))}" aria-hidden="true">${p?.avatar_url ? '' : escapeHtml(getInitial(nombre(p)))}</span>`

// «Voy» es una ENTRADA (1197, PINGU eligió la 2 de «Botones del Voy»): con
// muescas a los lados y un talón con cuántos van. Ya marcado, «Vas» en verde.
function voyHtml(e, sesion, { pasado = false, peq = false } = {}) {
  if (pasado) return ''
  const clase = `ev-voy${peq ? ' peq' : ''}`
  // Sin nadie todavía, sin talón: un «0» no anima a nadie.
  const talon = e.van ? `<span class="ev-voy-talon" aria-label="${escapeHtml(vanTexto(e.van))}">${e.van}</span>` : ''
  if (!sesion) return `<a class="${clase}" href="/auth.html?registro=1&volver=${encodeURIComponent(rutaDe(e))}"><span class="ev-voy-cuerpo">¡Voy!</span>${talon}</a>`
  return `<button type="button" class="${clase}" data-voy="${escapeHtml(e.id)}" aria-pressed="${e.voy ? 'true' : 'false'}"><span class="ev-voy-cuerpo">${e.voy ? `${ic('checkCircle', 16)} Vas` : '¡Voy!'}</span>${talon}</button>`
}

// Los atajos de la ficha (1197): círculos con la palabra debajo, como en una app.
const atajo = (icono, texto, attrs) => `<${attrs.href ? 'a' : 'button type="button"'} class="ev-atajo" ${Object.entries(attrs).map(([k, v]) => `${k}="${escapeHtml(v)}"`).join(' ')}><span class="ev-atajo-ic">${ic(icono, 20)}</span><span>${escapeHtml(texto)}</span></${attrs.href ? 'a' : 'button'}>`

// El .ics del evento, para el calendario del móvil.
function descargarCalendario(e) {
  const blob = new Blob([icsDeEvento(e, `${location.origin}${rutaDe(e)}`)], { type: 'text/calendar;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${e.slug || 'evento'}.ics`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 4000)
}

// ── La agenda: un cartel por evento ──
function tarjetaHtml(e, sesion, ahora) {
  const pasado = new Date(e.termina || e.empieza) < new Date(ahora).setHours(0, 0, 0, 0)
  const donde = [e.sitio, e.ciudad].filter(Boolean).join(' · ')
  const horas = horasDe(e)
  const caras = (e.caras || []).slice(0, 3)
  const desde = desdePrecio(entradasDe(e))
  return `<li class="ev-tarjeta${pasado ? ' pasado' : ''}" data-ev="${escapeHtml(e.slug)}">
    <a class="ev-tarjeta-enlace" href="${rutaDe(e)}">
      ${cartelHtml(e, { ahora: pasado ? NUNCA : ahora })}
      <span class="ev-tarjeta-texto"><strong>${escapeHtml(e.nombre)}</strong><small>${escapeHtml([donde, horas].filter(Boolean).join(' · '))}</small></span>
    </a>
    <div class="ev-tarjeta-pie">
      <span class="ev-van">${caras.length ? `<span class="ev-caras">${caras.map((p) => caraHtml(p, 22)).join('')}</span>` : ''}<span data-van>${e.van ? escapeHtml(vanTexto(e.van, pasado)) : pasado ? '' : 'Sé el primero'}</span></span>
      ${desde ? `<span class="ev-desde">${escapeHtml(desde)}</span>` : ''}
      ${voyHtml(e, sesion, { pasado, peq: true })}
    </div>
  </li>`
}

// Por meses: «Noviembre 2026» y sus carteles.
function porMeses(eventos, sesion, ahora) {
  const grupos = []
  for (const e of eventos) {
    const m = mesDe(e)
    if (grupos.at(-1)?.mes !== m) grupos.push({ mes: m, eventos: [] })
    grupos.at(-1).eventos.push(e)
  }
  return grupos.map((g) => `<h3 class="ev-mes">${escapeHtml(g.mes)}</h3><ul class="ev-carteles">${g.eventos.map((e) => tarjetaHtml(e, sesion, ahora)).join('')}</ul>`).join('')
}

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
        <h2 class="sr-only" id="evProximosT">Próximos</h2>
        ${proximos.length ? porMeses(proximos, sesion, ahora) : `<p class="empty-state">${estado.soloVoy ? 'Todavía no has marcado «Voy» en ningún evento.' : 'Con estos filtros no hay ningún evento próximo.'}</p>`}
      </section>
      ${pasados.length ? `<section class="ev-pasados" aria-labelledby="evPasadosT"><h2 class="ev-mes" id="evPasadosT">Pasados</h2><ul class="ev-carteles">${pasados.map((e) => tarjetaHtml(e, sesion, ahora)).join('')}</ul></section>` : ''}`
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
// Las entradas como entradas (1194): la VIP en dorado, la gratis en verde, y
// «Comprar ›» si tiene dónde.
function entradaHtml(x) {
  const clase = esEntradaVip(x) ? ' vip' : x.precio === 0 ? ' gratis' : ''
  return `<li class="ev-entrada${clase}">
      <b>${escapeHtml(x.nombre)}</b>
      <span class="ev-entrada-precio">${escapeHtml(precioTexto(x.precio) || 'Consultar')}</span>
      ${x.nota ? `<small>${escapeHtml(x.nota)}</small>` : ''}
      ${x.url ? `<a class="ev-comprar" href="${escapeHtml(x.url)}" target="_blank" rel="noopener nofollow">Comprar ›</a>` : ''}
    </li>`
}

function diaHtml(x) {
  const d = fechaDeDia(x.dia)
  const horas = x.desde ? `${x.desde}${x.hasta ? ` – ${x.hasta}` : ''}` : 'Horario por confirmar'
  return `<li class="ev-dia"><b>${d.getDate()}</b><span><em>${DIAS_SEMANA[d.getDay()]}</em>${escapeHtml(horas)}</span></li>`
}

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
  const lugar = [e.sitio, e.ciudad].filter(Boolean).join(', ')
  const desc = [fechaLarga(e), lugar].filter(Boolean).join(' · ')
  const web = webSegura(e.web)
  const insta = instagramDe(e.instagram)
  const mapa = mapaDe(e)
  const tcgmap = webSegura(e.tcgmap_url)
  const entradas = entradasDe(e)
  const dias = horarioDe(e)
  // Los mensajes del hilo del foro (1197), si tiene: se piden aparte y
  // repintan; sin la migración no hay `hilo_id` y no se pide nada.
  let mensajes = null
  if (e.hilo_id) {
    supabase.from('forum_threads').select('post_count').eq('id', e.hilo_id).maybeSingle()
      .then(({ data: h }) => { if (h) { mensajes = h.post_count || 0; pintar() } }).catch(() => {})
  }
  const pintar = () => {
    const visibles = e.caras || []
    const ocultos = Math.max(0, (e.van || 0) - visibles.length)
    const quien = e.van
      ? `<p class="ev-cuantos"><b>${e.van}</b> ${e.van === 1 ? (pasado ? 'persona fue' : 'persona va') : pasado ? 'personas fueron' : 'personas van'}${ocultos ? ` <small>(${ocultos} sin decirlo)</small>` : ''}</p>
         ${visibles.length ? `<ul class="ev-gente">${visibles.map((p) => `<li><a href="${profileUrl(p)}">${caraHtml(p, 32)}<span>${escapeHtml(nombre(p))}</span></a></li>`).join('')}</ul>` : ''}`
      : `<p class="ev-cuantos">${pasado ? 'Nadie de PokeDoc marcó que iba.' : 'Todavía no ha marcado nadie que va. ¡Sé el primero!'}</p>`
    // Lo de leer, en chapas como las de una tienda: dónde, juegos y enlaces.
    const datos = [
      // La dirección ya va en «Dónde» con su «Cómo llegar» (1199, PINGU: «la
      // hace más ancha y más fea»): aquí solo si no hay caja de «Dónde».
      lugar && !mapa ? `<li>${ic('pin', 16)}<span>${escapeHtml([e.sitio, e.direccion, e.ciudad, e.provincia && e.provincia !== e.ciudad ? e.provincia : ''].filter(Boolean).join(', '))}</span></li>` : '',
      e.juegos ? `<li>${ic('cards', 16)}<span>${escapeHtml(e.juegos)}</span></li>` : '',
      web ? `<li>${ic('link', 16)}<a href="${escapeHtml(web)}" target="_blank" rel="noopener nofollow">${escapeHtml(web.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''))}</a></li>` : '',
      insta ? `<li>${ic('camera', 16)}<a href="${escapeHtml(insta.url)}" target="_blank" rel="noopener nofollow">@${escapeHtml(insta.usuario)}</a></li>` : '',
      tcgmap ? `<li class="ev-dato-tcgmap">${ic('pin', 16)}<a href="${escapeHtml(tcgmap)}" target="_blank" rel="noopener">Ver en TCG Map Spain</a></li>` : '',
    ].filter(Boolean).join('')
    caja.innerHTML = `
      <a class="ev-volver" href="/eventos">${ic('chevronLeft', 16)} Eventos</a>
      ${cartelHtml(e, { ahora: pasado ? NUNCA : ahora, conPastilla: false, conTipo: false, clase: 'ev-cartel ev-cartel-ficha', etiqueta: `Cartel de ${e.nombre}` })}
      <header class="ev-cab">
        ${logoHtml(e, 'ev-logo grande')}
        <div class="ev-cab-texto">
          <span class="ev-chips"><span class="ev-chapa">${escapeHtml(TIPOS[e.tipo] || 'Evento')}</span>${pasado ? '<span class="ev-chapa">Ya pasó</span>' : ''}</span>
          <h1>${escapeHtml(e.nombre)}</h1>
          <p class="ev-cuando-largo">${escapeHtml(fechaLarga(e))}</p>
          ${e.descripcion ? `<p class="ev-desc">${escapeHtml(e.descripcion)}</p>` : ''}
        </div>
        <div class="ev-acciones">
          ${voyHtml(e, sesion, { pasado })}
          ${sesion && e.voy && !pasado ? `<label class="ev-oculto"><input type="checkbox" id="evOculto"${e.oculto ? ' checked' : ''}> Ir sin decirlo</label>` : ''}
        </div>
        <div class="ev-cab-pie">
          ${datos ? `<ul class="ev-datos">${datos}</ul>` : '<span></span>'}
          <div class="ev-atajos">
            ${atajo('share', 'Compartir', { id: 'evCompartir' })}
            ${!pasado && dias.length ? atajo('calendar', 'Calendario', { id: 'evCalendario', 'aria-label': 'Añadir al calendario' }) : ''}
            ${mapa ? atajo('pin', 'Cómo llegar', { href: mapa, target: '_blank', rel: 'noopener' }) : ''}
            ${e.hilo_id ? atajo('messageSquare', mensajes ? `Foro · ${mensajes}` : 'Foro', { href: `/tema/${e.hilo_id}`, id: 'evForo' }) : ''}
            ${e.voy && !pasado ? atajo('cards', 'Modo evento', { href: '/evento', 'aria-label': 'Abrir mi modo evento' }) : ''}
          </div>
        </div>
      </header>
      <div class="ev-rejilla">
        ${entradas.length || e.entrada ? `<section class="ev-caja" aria-labelledby="evEntradasT"><h2 id="evEntradasT">${entradas.length > 1 ? 'Entradas' : 'Entrada'}</h2>${entradas.length ? `<ul class="ev-entradas">${entradas.map(entradaHtml).join('')}</ul>` : `<p class="ev-desc">${escapeHtml(e.entrada)}</p>`}</section>` : ''}
        <div class="ev-r-lado${entradas.length || e.entrada ? '' : ' ev-r-ancha'}">
          <section class="ev-caja" aria-labelledby="evQuienT"><h2 id="evQuienT">Quién va de PokeDoc</h2>${quien}</section>
          ${dias.length && !mismoHorario(dias) ? `<section class="ev-caja" aria-labelledby="evCuandoT"><h2 id="evCuandoT">Cuándo</h2><ul class="ev-dias">${dias.map(diaHtml).join('')}</ul></section>` : ''}
        </div>
        ${mapa ? `<section class="ev-caja ev-r-ancha ev-donde" aria-labelledby="evDondeT">
          <a class="ev-mapa" href="${escapeHtml(mapa)}" target="_blank" rel="noopener" aria-label="Ver ${escapeHtml(lugar || 'el sitio')} en el mapa"><span class="ev-mapa-pin">${ic('pin', 22)}</span></a>
          <div class="ev-donde-texto">
            <h2 id="evDondeT">Dónde</h2>
            <p class="ev-desc">${escapeHtml([e.sitio, e.direccion, e.ciudad].filter(Boolean).join(', '))}</p>
            <a class="ev-llegar" href="${escapeHtml(mapa)}" target="_blank" rel="noopener"><span class="ev-llegar-ic">${ic('pin', 20)}</span><span>Cómo llegar<small>Abrir en Google Maps</small></span>${ic('chevronRight', 18)}</a>
          </div>
        </section>` : ''}
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
    if (ev.target.closest('#evCalendario')) { descargarCalendario(e); return }
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
