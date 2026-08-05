import { supabase } from './supabase.js'
import { escapeHtml, getInitial, profileUrl, avatarStyle } from './app.js'
import { icons } from './icons.js'
import { showToast } from './toast.js'
import { createNotification } from './notifications.js'

// Peticiones de guías.
//
// La pregunta que bloquea a la mayoría no es "¿me apetece escribir?", es
// "¿de qué escribo?". Alguien que sabe mucho de un tema no se pone
// porque no sabe si le interesa a alguien.
//
// Esto es una lista donde cualquiera pide un tema y los demás lo votan.
// Quien se anima ve CUÁNTA GENTE LO ESTÁ ESPERANDO antes de empezar, y
// al publicarla avisa de un clic a todos los que la pidieron.
//
// NO es un foro: no hay conversación, ni respuestas, ni temas sueltos.
// Es una lista de necesidades. La diferencia importa, porque un foro
// habría que moderarlo y esto se modera solo (o se vota, o no).
//
// Las tablas las crea supabase-migration-peticiones-guias.sql.

let sesion = null
let cache = []
let misGuias = []

function faltaLaTabla(error) {
  if (!error) return false
  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    /guide_request/.test(`${error.message || ''} ${error.details || ''}`)
  )
}

async function cargar() {
  const { data, error } = await supabase
    .from('guide_requests_con_votos')
    .select('*')
    .order('votos', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) return { error }

  const peticiones = data || []
  const ids = [...new Set(peticiones.map((p) => p.requester_id).filter(Boolean))]
  const guiaIds = [...new Set(peticiones.map((p) => p.fulfilled_guide_id).filter(Boolean))]

  const [{ data: perfiles }, { data: guias }, { data: misVotos }] = await Promise.all([
    ids.length ? supabase.from('user_profiles').select('id, username, display_name, avatar_url').in('id', ids) : Promise.resolve({ data: [] }),
    guiaIds.length ? supabase.from('guides').select('id, title, slug').in('id', guiaIds) : Promise.resolve({ data: [] }),
    sesion
      ? supabase.from('guide_request_votes').select('request_id').eq('user_id', sesion.user.id)
      : Promise.resolve({ data: [] }),
  ])

  const porId = Object.fromEntries((perfiles || []).map((p) => [p.id, p]))
  const guiaPorId = Object.fromEntries((guias || []).map((g) => [g.id, g]))
  const votadas = new Set((misVotos || []).map((v) => v.request_id))

  cache = peticiones.map((p) => ({
    ...p,
    quien: porId[p.requester_id] || null,
    guia: guiaPorId[p.fulfilled_guide_id] || null,
    votada: votadas.has(p.id),
  }))
  return { error: null }
}

function filaHtml(p) {
  const nombre = p.quien?.display_name || p.quien?.username || 'Alguien'
  const cumplida = !!p.guia
  const puedoCumplir = sesion && !cumplida && misGuias.length > 0
  const esMia = sesion && p.requester_id === sesion.user.id

  return `
  <div class="peticion ${cumplida ? 'peticion-cumplida' : ''}" data-peticion="${p.id}">
    <button type="button" class="peticion-voto ${p.votada ? 'peticion-voto-on' : ''}"
            data-votar="${p.id}" aria-pressed="${p.votada}"
            title="${cumplida ? 'Esta guía ya está escrita' : p.votada ? 'Quitar mi voto' : 'Yo también quiero esta guía'}"
            ${cumplida ? 'disabled' : ''}>
      <span class="peticion-voto-flecha" aria-hidden="true">▲</span>
      <span class="peticion-voto-num" data-votos>${p.votos}</span>
    </button>
    <div class="peticion-cuerpo">
      <h3>${escapeHtml(p.title)}</h3>
      ${p.detail ? `<p class="peticion-detalle">${escapeHtml(p.detail)}</p>` : ''}
      <p class="peticion-pie">
        ${
          p.quien
            ? `<a class="mini-avatar" href="${profileUrl(p.quien)}" style="width:20px; height:20px; font-size:10px; ${avatarStyle(p.quien)}">${p.quien.avatar_url ? '' : getInitial(nombre)}</a>
               <a href="${profileUrl(p.quien)}">${escapeHtml(nombre)}</a>`
            : `<span>${escapeHtml(nombre)}</span>`
        }
        <span class="peticion-fecha">${new Date(p.created_at).toLocaleDateString('es-ES')}</span>
      </p>
      ${
        cumplida
          ? `<p class="peticion-hecha">${icons.checkCircle(14)} Ya está escrita:
               <a href="/guia.html?slug=${encodeURIComponent(p.guia.slug)}">${escapeHtml(p.guia.title)}</a></p>`
          : `<div class="peticion-acciones">
               <a class="btn-secondary" href="/editor-guia.html?titulo=${encodeURIComponent(p.title)}&peticion=${p.id}">${icons.edit(13)} Escribir esta guía</a>
               ${puedoCumplir ? `<button type="button" class="btn-secondary" data-cumplir="${p.id}">Ya la he escrito</button>` : ''}
               ${esMia ? `<button type="button" class="peticion-borrar" data-borrar="${p.id}">Retirar</button>` : ''}
             </div>`
      }
    </div>
  </div>`
}

function pintar(contenedor) {
  const abiertas = cache.filter((p) => !p.guia)
  const hechas = cache.filter((p) => p.guia)

  contenedor.innerHTML = `
    ${
      cache.length === 0
        ? `<p class="empty-state">Todavía no hay ninguna petición. Si hay algo que te gustaría leer y no está, pídelo — a lo mejor alguien lo escribe.</p>`
        : ''
    }
    ${abiertas.map(filaHtml).join('')}
    ${
      hechas.length
        ? `<h3 class="peticiones-sub">Ya escritas</h3>${hechas.map(filaHtml).join('')}`
        : ''
    }`

  contenedor.querySelectorAll('[data-votar]').forEach((btn) => btn.addEventListener('click', () => votar(btn, contenedor)))
  contenedor.querySelectorAll('[data-cumplir]').forEach((btn) => btn.addEventListener('click', () => cumplir(btn.dataset.cumplir, contenedor)))
  contenedor.querySelectorAll('[data-borrar]').forEach((btn) => btn.addEventListener('click', () => borrar(btn.dataset.borrar, contenedor)))
}

async function votar(btn, contenedor) {
  if (!sesion) {
    showToast('Entra con tu cuenta para votar lo que quieres que se escriba.')
    return
  }
  const id = btn.dataset.votar
  const p = cache.find((x) => x.id === id)
  if (!p) return

  // Se pinta antes de que conteste la base: el voto tiene que responder
  // al instante. Si falla, se deshace.
  const antes = { votada: p.votada, votos: p.votos }
  p.votada = !p.votada
  p.votos += p.votada ? 1 : -1
  btn.classList.toggle('peticion-voto-on', p.votada)
  btn.setAttribute('aria-pressed', String(p.votada))
  btn.querySelector('[data-votos]').textContent = p.votos

  const { error } = p.votada
    ? await supabase.from('guide_request_votes').insert({ request_id: id, user_id: sesion.user.id })
    : await supabase.from('guide_request_votes').delete().eq('request_id', id).eq('user_id', sesion.user.id)

  if (error) {
    Object.assign(p, antes)
    pintar(contenedor)
    showToast('No se ha podido guardar el voto: ' + error.message)
  }
}

// "Ya la he escrito": el que se anima marca la petición y, de paso, avisa
// a todos los que la estaban esperando. Ese aviso es la mitad de la
// gracia de esto — es lo que hace que escribirla tenga público desde el
// primer minuto.
async function cumplir(id, contenedor) {
  const p = cache.find((x) => x.id === id)
  if (!p || misGuias.length === 0) return

  const opciones = misGuias.map((g, i) => `${i + 1}. ${g.title}`).join('\n')
  const elegido = window.prompt(`¿Cuál de tus guías responde a "${p.title}"?\n\n${opciones}\n\nEscribe el número:`)
  const idx = Number(elegido) - 1
  const guia = misGuias[idx]
  if (!guia) return

  const { error } = await supabase.from('guide_requests').update({ fulfilled_guide_id: guia.id }).eq('id', id)
  if (error) {
    showToast('No se ha podido marcar: ' + error.message)
    return
  }

  const { data: votantes } = await supabase.from('guide_request_votes').select('user_id').eq('request_id', id)
  const aAvisar = [...new Set([p.requester_id, ...(votantes || []).map((v) => v.user_id)])].filter(Boolean)
  await Promise.all(
    aAvisar.map((uid) =>
      createNotification({
        recipientId: uid,
        actorId: sesion.user.id,
        type: 'guide_request_fulfilled',
        title: 'Ya existe la guía que pediste',
        body: guia.title,
        link: `/guia.html?slug=${encodeURIComponent(guia.slug)}`,
      })
    )
  )

  showToast(`Marcada. Se ha avisado a ${aAvisar.length} ${aAvisar.length === 1 ? 'persona' : 'personas'}.`, 'success')
  await cargar()
  pintar(contenedor)
}

async function borrar(id, contenedor) {
  if (!confirm('¿Retirar esta petición?')) return
  const { error } = await supabase.from('guide_requests').delete().eq('id', id)
  if (error) {
    showToast('No se ha podido retirar: ' + error.message)
    return
  }
  await cargar()
  pintar(contenedor)
}

function formularioHtml() {
  if (!sesion) {
    return `<p class="subtext peticiones-aviso">${icons.helpCircle(14)} <a href="/auth.html">Entra con tu cuenta</a> para pedir una guía o votar las de los demás.</p>`
  }
  // Misma caja que el formulario de comentarios de una guía
  // (`.simple-card`): es la referencia visual del sitio para "escribe
  // algo aquí", y no tiene sentido que cada sitio invente la suya.
  return `
    <form class="simple-card peticion-form" id="peticionForm">
      <input type="text" id="peticionTitulo" maxlength="120" required
             placeholder="¿Qué te gustaría que alguien explicara?" />
      <textarea id="peticionDetalle" maxlength="500" rows="2"
                placeholder="Opcional: cuenta un poco qué te gustaría saber."></textarea>
      <button type="submit" class="btn-primary">Pedir esta guía</button>
    </form>`
}

export async function initPeticiones(contenedor, session) {
  if (!contenedor) return
  sesion = session || null

  contenedor.innerHTML = `<div class="skeleton" style="height:90px;"></div>`

  const { error } = await cargar()
  if (error) {
    // Sin la migración puesta no se enseña un error de base de datos a
    // nadie: se dice lo que pasa, en cristiano.
    contenedor.innerHTML = faltaLaTabla(error)
      ? `<p class="empty-state">Las peticiones de guías todavía no están activadas.</p>`
      : `<p class="empty-state">No se han podido cargar las peticiones.</p>`
    return
  }

  if (sesion) {
    const { data } = await supabase
      .from('guides')
      .select('id, title, slug')
      .eq('author_id', sesion.user.id)
      .not('published_at', 'is', null)
    misGuias = data || []
  }

  contenedor.innerHTML = `
    <p class="subtext" style="margin: -4px 0 16px;">
      Lo que la gente querría leer y todavía no está escrito. Vota lo que a ti también te interesa:
      cuantos más votos, más claro está que alguien lo está esperando.
    </p>
    ${formularioHtml()}
    <div id="peticionesLista"></div>`

  const lista = document.getElementById('peticionesLista')
  pintar(lista)

  document.getElementById('peticionForm')?.addEventListener('submit', async (e) => {
    e.preventDefault()
    const titulo = document.getElementById('peticionTitulo').value.trim()
    if (!titulo) return
    const detalle = document.getElementById('peticionDetalle').value.trim()

    const boton = e.target.querySelector('button')
    boton.disabled = true
    const { error: err } = await supabase
      .from('guide_requests')
      .insert({ title: titulo, detail: detalle || null, requester_id: sesion.user.id })
    boton.disabled = false

    if (err) {
      showToast('No se ha podido guardar: ' + err.message)
      return
    }
    e.target.reset()
    showToast('Pedida. Si alguien la escribe, te avisamos.', 'success')
    await cargar()
    pintar(lista)
  })
}
