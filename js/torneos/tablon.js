// EL TABLÓN DEL TORNEO (878). PINGU: «hay gente que cuando hay torneo y no
// lo retransmito en twitch, pierden un poco el hilo de cuando se cierra
// ronda, de qué está pasando... un chat para que los organizadores pongan
// updates?». No es un chat: una lista de avisos cortos del organizador y
// sus jueces, con hora, que ve todo el mundo (sin cuenta también). En la
// misma lista van los sucesos que la web apunta sola —ronda en marcha,
// ronda cerrada, top cut, final—, en gris: así se lee como una sola
// historia y quien organiza solo escribe lo que la web no sabe. El último
// aviso humano se queda pegado en la barra de estado (877).
//
// Escribir pasa SIEMPRE por la función `torneos_tablon_escribir`
// (supabase-migration-878-tablon-torneo.sql): es la que decide quién puede
// (organizador o juez aprobado) y la que avisa a los inscritos. Leer es una
// consulta normal: la tabla es pública.
import { supabase } from '../supabase.js'
import { escapeHtml, avatarStyle, getInitial } from '../app.js'
import { icons } from '../icons.js'
import { showToast } from '../toast.js'
import { haceCuanto, fechaLarga } from '../foro-comun.js'
import { puedeLlevar, avisoDeMigracion, faltaLaRpc } from './comun.js'
import { avisoPegado } from './tablon-pegado.js'
export { avisoPegado }

const CUANTOS = 30
const A_LA_VISTA = 5
const LARGO = 500
let avisos = []
const perfiles = {}
let ctx = null
let todas = false
let ultimoListaHtml = ''
let ultimoBarraHtml = ''

// Lee el tablón. `null` = no se ha podido (sin migración, sin red): la
// caja no se enseña y no se dice nada, que no es un fallo de quien mira.
export async function cargarTablon(torneoId) {
  const { data, error } = await supabase
    .from('tournament_updates')
    .select('id, author_id, kind, body, created_at')
    .eq('tournament_id', torneoId)
    .order('created_at', { ascending: false })
    .limit(CUANTOS)
  if (error) return null
  avisos = data || []
  const ids = [...new Set(avisos.map((a) => a.author_id).filter(Boolean))].filter((id) => !perfiles[id])
  if (ids.length) {
    const { data: ps } = await supabase.from('user_profiles').select('id, username, display_name, avatar_url').in('id', ids)
    for (const p of ps || []) perfiles[p.id] = p
  }
  return avisos
}

// Apunta un suceso de la web (ronda en marcha, cerrada, top cut, final).
// Lo llama quien acaba de hacerlo —el organizador—, así que la función del
// servidor le deja. Nunca lanza: lo que se acaba de hacer ya está hecho, y
// un tablón que no se pudo escribir no puede parecer un cierre que falló.
export async function apuntarEnTablon(torneoId, texto) {
  try {
    await supabase.rpc('torneos_tablon_escribir', { p_torneo: torneoId, p_texto: texto, p_avisar: false, p_auto: true })
  } catch {}
}

const nombreDe = (id) => {
  const p = perfiles[id]
  return p ? p.display_name || p.username || 'Alguien' : 'Alguien'
}

function caraHtml(id) {
  const p = perfiles[id]
  if (!p) return ''
  const n = nombreDe(id)
  return `<span class="torneo-tablon-cara" style="${avatarStyle(p)}" aria-hidden="true">${p.avatar_url ? '' : escapeHtml(getInitial(n))}</span>`
}

const hora = (iso) => new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })

function papelDe(id) {
  if (!ctx) return ''
  if (id === ctx.torneo.admin_id) return 'organizador'
  if (ctx.solicitudes?.some((s) => s.user_id === id && s.status === 'approved')) return 'juez'
  return 'organización'
}

function filaHtml(a, puedoBorrar) {
  const auto = a.kind === 'auto'
  return `<li class="torneo-tablon-fila${auto ? ' auto' : ''}">
    <time datetime="${escapeHtml(a.created_at)}" title="${escapeHtml(fechaLarga(a.created_at))}">${escapeHtml(hora(a.created_at))}</time>
    <div class="torneo-tablon-cuerpo">
      ${auto
        ? `<span class="torneo-tablon-auto">${icons.zap(13)} ${escapeHtml(a.body)}</span>`
        : `<span class="torneo-tablon-quien">${caraHtml(a.author_id)}<b>${escapeHtml(nombreDe(a.author_id))}</b><span class="torneo-chapa torneo-chapa-neutra">${papelDe(a.author_id)}</span>${puedoBorrar ? `<button type="button" class="link-btn torneo-tablon-borrar" data-borrar-aviso="${escapeHtml(a.id)}">Borrar</button>` : ''}</span>
           <span class="torneo-tablon-texto">${escapeHtml(a.body)}</span>`}
    </div>
  </li>`
}

function puedoEscribir() {
  if (!ctx?.session) return false
  if (['draft', 'cancelled'].includes(ctx.torneo.status)) return false
  return puedeLlevar(ctx.perfil, ctx.torneo, ctx.session.user.id, ctx.esJuez)
}

function pintarLista() {
  const lista = document.getElementById('torneoTablonLista')
  if (!lista) return
  const yo = ctx?.session?.user?.id
  const mando = yo ? puedeLlevar(ctx.perfil, ctx.torneo, yo, ctx.esJuez) : false
  const visibles = todas ? avisos : avisos.slice(0, A_LA_VISTA)
  const html = avisos.length
    ? `<ul class="torneo-tablon-items">${visibles.map((a) => filaHtml(a, a.kind === 'aviso' && (a.author_id === yo || mando))).join('')}</ul>
       ${avisos.length > A_LA_VISTA ? `<button type="button" class="link-btn" id="torneoTablonMas">${todas ? 'Ver solo los últimos' : `Ver los ${avisos.length}`}</button>` : ''}`
    : `<p class="subtext torneo-tablon-vacio">${puedoEscribir() ? 'Todavía no hay avisos. Lo que escribas aquí lo ve todo el mundo, y la web apunta sola las rondas.' : 'Todavía no hay avisos.'}</p>`
  if (html === ultimoListaHtml) return
  ultimoListaHtml = html
  lista.innerHTML = html
  document.getElementById('torneoTablonMas')?.addEventListener('click', () => {
    todas = !todas
    pintarLista()
  })
  for (const b of lista.querySelectorAll('[data-borrar-aviso]')) b.addEventListener('click', () => borrar(b.dataset.borrarAviso))
  const cuenta = document.getElementById('torneoTablonCuenta')
  if (cuenta) cuenta.textContent = avisos.length ? `${avisos.length} ${avisos.length === 1 ? 'aviso' : 'avisos'}` : ''
}

// El último aviso humano, en la barra de estado (877). Si la barra está
// escondida (torneo sin empezar o acabado) no se ve, y bien.
function pintarEnBarra() {
  const caja = document.getElementById('torneoVivaAviso')
  if (!caja) return
  const a = avisoPegado(avisos)
  const html = a
    ? `${caraHtml(a.author_id)}<b>${escapeHtml(nombreDe(a.author_id))}</b> <span class="torneo-viva-aviso-cuando">${escapeHtml(haceCuanto(a.created_at))}:</span> <span class="torneo-viva-aviso-texto">«${escapeHtml(a.body)}»</span>`
    : ''
  if (html === ultimoBarraHtml) return
  ultimoBarraHtml = html
  caja.innerHTML = html
  caja.classList.toggle('hidden', !html)
}

async function publicar(form) {
  const campo = form.querySelector('input[name="texto"]')
  const texto = campo.value.trim()
  if (!texto) return
  const avisar = form.querySelector('input[name="avisar"]').checked
  const boton = form.querySelector('button[type="submit"]')
  boton.disabled = true
  try {
    const { error } = await supabase.rpc('torneos_tablon_escribir', { p_torneo: ctx.torneo.id, p_texto: texto, p_avisar: avisar, p_auto: false })
    if (error) {
      showToast(faltaLaRpc(error) ? avisoDeMigracion('supabase-migration-878-tablon-torneo.sql') : `No se ha podido publicar: ${error.message}`, 'error')
      return
    }
    campo.value = ''
    showToast(avisar ? 'Publicado, y avisados los inscritos.' : 'Publicado.', 'success')
    await cargarTablon(ctx.torneo.id)
    pintarLista()
    pintarEnBarra()
  } finally {
    boton.disabled = false
  }
}

async function borrar(id) {
  const { error } = await supabase.from('tournament_updates').delete().eq('id', id)
  if (error) {
    showToast(`No se ha podido borrar: ${error.message}`, 'error')
    return
  }
  await cargarTablon(ctx.torneo.id)
  pintarLista()
  pintarEnBarra()
}

// Monta (una vez) y repinta (en cada refresco de la ficha). La caja de
// escribir se monta una sola vez: repintarla con cada refresco borraría lo
// que alguien está tecleando.
export async function montarTablon(contexto) {
  ctx = contexto
  const caja = document.getElementById('torneoTablon')
  if (!caja) return
  const lista = await cargarTablon(ctx.torneo.id)
  if (lista === null) {
    caja.classList.add('hidden')
    return
  }
  const escribe = puedoEscribir()
  // Sin nada que decir y sin poder escribir, ni ocupa: un torneo abierto a
  // inscripciones no necesita un tablón vacío.
  if (!avisos.length && !escribe) {
    caja.classList.add('hidden')
    pintarEnBarra()
    return
  }
  if (!caja.dataset.montado) {
    caja.dataset.montado = '1'
    caja.innerHTML = `
      <div class="torneo-tablon-cab">
        <h3 id="torneoTablonTitulo">${icons.megaphone ? icons.megaphone(16) : icons.messageSquare(16)} Tablón del torneo</h3>
        <span class="torneo-chapa torneo-chapa-neutra" id="torneoTablonCuenta"></span>
      </div>
      <form class="torneo-tablon-escribir hidden" id="torneoTablonForm" autocomplete="off">
        <input type="text" name="texto" maxlength="${LARGO}" placeholder="Escribe un aviso para todos los inscritos…" aria-label="Aviso para los inscritos" required />
        <label class="torneo-tablon-push"><input type="checkbox" name="avisar" checked /> avisar también por push</label>
        <button type="submit" class="btn-primary">Publicar</button>
      </form>
      <div id="torneoTablonLista"></div>
      <p class="subtext torneo-tablon-pie">Lo automático lo escribe la web; lo demás, quien organiza y los jueces. Se ve sin cuenta.</p>`
    caja.querySelector('#torneoTablonForm').addEventListener('submit', (e) => {
      e.preventDefault()
      publicar(e.currentTarget)
    })
  }
  caja.querySelector('#torneoTablonForm').classList.toggle('hidden', !escribe)
  caja.classList.remove('hidden')
  pintarLista()
  pintarEnBarra()
}
