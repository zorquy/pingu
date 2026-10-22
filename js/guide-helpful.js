import { supabase } from './supabase.js'
import { icons } from './icons.js'
import { showToast } from './toast.js'
import { createNotification } from './notifications.js'
import { rutaDeArticulo } from './articulos.js'
import { escapeHtml, getInitial, profileUrl, avatarStyle } from './app.js'
import { atributosDeRango, COLUMNAS_RANGO } from './rangos.js'
import { frasePersonas } from './guias-servido.js'

// "Me ha servido": el agradecimiento de un clic, y desde la 974 la ÚNICA
// señal de una guía (PINGU eligió la A: la caja «¿Te ha servido? Sí / No
// tanto» preguntaba lo mismo justo debajo). Lo negativo va por «Sugerir
// una corrección», que le dice al autor QUÉ falla.
//
// No juzga: dice gracias. Por eso cuesta un clic y no pide escribir nada.
// Y es el número que de verdad quiere ver quien escribe una guía.
//
// La tabla la crea supabase-migration-recompensas-autor.sql, con el
// disparador que le da XP al autor: no se suma desde aquí a propósito,
// porque el XP que te dan OTROS no se puede dejar en manos del navegador
// de quien te lo da.

// En una NOTICIA es «Me gusta» (973): de una noticia no se dice que te ha
// servido, y el aviso decía «tu guía» de algo que no lo es.
const TEXTOS = {
  guide: { sin: 'Me ha servido', con: 'Te ha servido', verbo: 'servido', aviso: 'A alguien le ha servido tu guía', tuyo: 'tu guía' },
  news: { sin: 'Me gusta', con: 'Te gusta', verbo: 'gustado', aviso: 'A alguien le ha gustado tu noticia', tuyo: 'tu noticia' },
}
const textosDe = (guide) => TEXTOS[guide?.kind === 'news' ? 'news' : 'guide']

// La columna no existe hasta que se ejecuta la migración. Igual que en
// el buscador: mejor esconder el botón que dejar la guía con un error a
// medio pintar.
function faltaLaTabla(error) {
  if (!error) return false
  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    /guide_helpful/.test(`${error.message || ''} ${error.details || ''}`)
  )
}

async function leerEstado(guideId, userId) {
  const { count, error } = await supabase
    .from('guide_helpful')
    .select('*', { count: 'exact', head: true })
    .eq('guide_id', guideId)

  if (faltaLaTabla(error)) return null

  let mio = false
  if (userId) {
    const { data } = await supabase
      .from('guide_helpful')
      .select('user_id')
      .eq('guide_id', guideId)
      .eq('user_id', userId)
      .maybeSingle()
    mio = !!data
  }
  return { total: count || 0, mio }
}

function haceCuanto(iso) {
  const seg = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (seg < 60) return 'ahora mismo'
  const min = Math.floor(seg / 60)
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `hace ${h} h`
  const d = Math.floor(h / 24)
  if (d === 1) return 'ayer'
  if (d < 30) return `hace ${d} días`
  const m = Math.floor(d / 30)
  return m === 1 ? 'hace un mes' : `hace ${m} meses`
}

// Quién ha dicho que le ha servido: se despliega al pinchar la cuenta,
// como la lista de la caja de valoraciones que había. Ya era público (la
// política de `guide_helpful` es `select using (true)`), pero hacerlo
// VISIBLE no es lo mismo: quien tiene `hide_activity` sale como «Un
// usuario», sin enlace, y sigue contando, así que la cuenta y la lista
// cuadran siempre.
async function listaDeQuienHtml(guideId) {
  const { data, error } = await supabase.from('guide_helpful').select('user_id, created_at').eq('guide_id', guideId).order('created_at', { ascending: false }).limit(200)
  if (error) return '<p class="subtext">No se ha podido cargar la lista.</p>'
  const filas = data || []
  const ids = [...new Set(filas.map((f) => f.user_id).filter(Boolean))]
  const { data: perfiles } = ids.length
    ? await supabase.from('user_profiles').select(`id, username, display_name, avatar_url, hide_activity, ${COLUMNAS_RANGO}`).in('id', ids)
    : { data: [] }
  const porId = Object.fromEntries((perfiles || []).map((p) => [p.id, p]))
  return `<ul class="rater-list">${filas
    .map((f) => {
      const p = porId[f.user_id]
      const oculto = !p || p.hide_activity
      const nombre = oculto ? 'Un usuario' : p.display_name || p.username || 'Un usuario'
      const avatar = `<span class="rater-avatar" style="${oculto ? '' : avatarStyle(p)}">${oculto ? '' : escapeHtml(getInitial(nombre))}</span>`
      const quien = oculto
        ? `<span class="rater-name">${escapeHtml(nombre)}</span>`
        : `<a class="rater-name" href="${profileUrl(p)}"${atributosDeRango(p)}>${escapeHtml(nombre)}</a>`
      return `<li class="rater-row">${avatar}${quien}<span class="rater-date">${f.created_at ? haceCuanto(f.created_at) : ''}</span></li>`
    })
    .join('')}</ul>`
}

// La cuenta es el botón que despliega la lista. Con cero no se enseña
// nada: un «0» pelado en una guía recién publicada desanima al autor más
// que no poner nada.
function pintarCuenta(contador, panel, estado, t, sufijo = '') {
  contador.hidden = estado.total === 0
  contador.querySelector('[data-helpful-frase]').textContent = estado.total ? `${frasePersonas(estado.total, t.verbo)}${sufijo}` : ''
  if (!estado.total) {
    panel.hidden = true
    contador.setAttribute('aria-expanded', 'false')
  }
}

function engancharLista(contador, panel, guideId) {
  contador.addEventListener('click', async () => {
    const abrir = panel.hidden
    contador.setAttribute('aria-expanded', String(abrir))
    panel.hidden = !abrir
    if (abrir) panel.innerHTML = await listaDeQuienHtml(guideId)
  })
}

const cuentaHtml = () => `<button type="button" class="helpful-count" data-helpful-count aria-expanded="false" aria-controls="helpfulQuien" hidden>
    <span data-helpful-frase></span> · <span class="helpful-ver">ver quién</span>
  </button>
  <div class="rater-panel" id="helpfulQuien" hidden></div>`

function pintar(boton, estado, t) {
  boton.classList.toggle('helpful-on', estado.mio)
  boton.setAttribute('aria-pressed', String(estado.mio))
  boton.querySelector('[data-helpful-texto]').textContent = estado.mio ? t.con : t.sin
}

// `contenedor` es donde se pinta. `guide` necesita id, title, slug, kind y
// author_id. `session` puede ser null (visitante sin cuenta).
export async function montarBotonHelpful(contenedor, guide, session) {
  if (!contenedor || !guide?.id) return

  const t = textosDe(guide)
  const esMia = !!session && guide.author_id === session.user.id
  const estado = await leerEstado(guide.id, session?.user?.id)

  // Sin migración no hay botón. La guía se sirve igual.
  if (!estado) return

  // El autor no puede agradecerse a sí mismo (la base tampoco le deja),
  // pero sí tiene que ver el número y quién: es justo lo que le interesa.
  if (esMia) {
    if (estado.total === 0) return
    contenedor.innerHTML = `<div class="helpful-wrap">${cuentaHtml()}</div>`
    const contador = contenedor.querySelector('[data-helpful-count]')
    const panel = contenedor.querySelector('.rater-panel')
    pintarCuenta(contador, panel, estado, t, ` ${t.tuyo}`)
    engancharLista(contador, panel, guide.id)
    return
  }

  contenedor.innerHTML = `
    <div class="helpful-wrap">
      <button type="button" class="helpful-btn" aria-pressed="false">
        ${guide.kind === 'news' ? icons.thumbsUp(16) : icons.sprout(16)}<span data-helpful-texto>${t.sin}</span>
      </button>
      ${cuentaHtml()}
    </div>`

  const boton = contenedor.querySelector('.helpful-btn')
  const contador = contenedor.querySelector('[data-helpful-count]')
  const panel = contenedor.querySelector('.rater-panel')
  pintar(boton, estado, t)
  pintarCuenta(contador, panel, estado, t)
  engancharLista(contador, panel, guide.id)

  let enCurso = false
  boton.addEventListener('click', async () => {
    if (enCurso) return
    if (!session) {
      showToast(guide.kind === 'news' ? 'Entra con tu cuenta para decir que te gusta.' : 'Entra con tu cuenta para decirle al autor que su guía te ha servido.')
      return
    }
    enCurso = true
    boton.disabled = true

    // Se pinta antes de que conteste la base: el clic tiene que
    // responder al instante. Si falla, se deshace.
    const antes = { ...estado }
    estado.mio = !estado.mio
    estado.total += estado.mio ? 1 : -1
    pintar(boton, estado, t)
    pintarCuenta(contador, panel, estado, t)

    const { error } = estado.mio
      ? await supabase.from('guide_helpful').insert({ guide_id: guide.id, user_id: session.user.id })
      : await supabase.from('guide_helpful').delete().eq('guide_id', guide.id).eq('user_id', session.user.id)

    if (error) {
      Object.assign(estado, antes)
      pintar(boton, estado, t)
      pintarCuenta(contador, panel, estado, t)
      showToast('No se ha podido guardar: ' + error.message)
    } else {
      // La lista abierta se rehace para que salga (o se vaya) quien pulsa.
      if (!panel.hidden) panel.innerHTML = await listaDeQuienHtml(guide.id)
      if (estado.mio) {
        // El aviso al autor es el objetivo de todo esto. Va una sola vez
        // por persona y guía: la clave primaria no deja insertar dos.
        await createNotification({
          recipientId: guide.author_id,
          actorId: session.user.id,
          type: 'guide_helpful',
          title: t.aviso,
          body: guide.title,
          link: rutaDeArticulo(guide.kind, guide.slug),
        })
      }
    }

    boton.disabled = false
    enCurso = false
  })
}
