import { supabase } from './supabase.js'
import { icons } from './icons.js'
import { showToast } from './toast.js'
import { createNotification } from './notifications.js'

// "Me ha servido": el agradecimiento de un clic.
//
// Es distinto de las estrellas A PROPÓSITO. Una valoración es un juicio
// ("te pongo un 4"), cuesta pensarla y mucha gente no la deja porque no
// se ve con derecho a puntuar a nadie. Esto no juzga: dice gracias. Por
// eso cuesta un clic y no pide escribir nada.
//
// Y es el número que de verdad quiere ver quien escribe una guía.
//
// La tabla la crea supabase-migration-recompensas-autor.sql. Ahí está
// también el disparador que le da XP al autor: no se suma desde aquí a
// propósito, porque el XP que te dan OTROS no se puede dejar en manos
// del navegador de quien te lo da.

const TEXTO_SIN_MARCAR = 'Me ha servido'
const TEXTO_MARCADO = 'Te ha servido'

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

function pintar(boton, contador, estado) {
  boton.classList.toggle('helpful-on', estado.mio)
  boton.setAttribute('aria-pressed', String(estado.mio))
  boton.querySelector('[data-helpful-texto]').textContent = estado.mio ? TEXTO_MARCADO : TEXTO_SIN_MARCAR
  // Con cero, no se enseña un "0" pelado: un contador a cero en una guía
  // recién publicada desanima al autor más que no poner nada.
  contador.textContent =
    estado.total === 0 ? '' : estado.total === 1 ? 'A 1 persona le ha servido' : `A ${estado.total} personas les ha servido`
}

// `contenedor` es donde se pinta. `guide` necesita id, title, slug y
// author_id. `session` puede ser null (visitante sin cuenta).
export async function montarBotonHelpful(contenedor, guide, session) {
  if (!contenedor || !guide?.id) return

  const esMia = !!session && guide.author_id === session.user.id
  const estado = await leerEstado(guide.id, session?.user?.id)

  // Sin migración no hay botón. La guía se sirve igual.
  if (!estado) return

  // El autor no puede agradecerse a sí mismo (la base tampoco le deja),
  // pero sí tiene que ver el número: es justo el dato que le interesa.
  if (esMia) {
    if (estado.total === 0) return
    contenedor.innerHTML = `<p class="helpful-solo-contador">${
      estado.total === 1 ? 'A 1 persona le ha servido tu guía' : `A ${estado.total} personas les ha servido tu guía`
    }</p>`
    return
  }

  contenedor.innerHTML = `
    <div class="helpful-wrap">
      <button type="button" class="helpful-btn" aria-pressed="false">
        ${icons.sprout(16)}<span data-helpful-texto>${TEXTO_SIN_MARCAR}</span>
      </button>
      <span class="helpful-count" data-helpful-count></span>
    </div>`

  const boton = contenedor.querySelector('.helpful-btn')
  const contador = contenedor.querySelector('[data-helpful-count]')
  pintar(boton, contador, estado)

  let enCurso = false
  boton.addEventListener('click', async () => {
    if (enCurso) return
    if (!session) {
      showToast('Entra con tu cuenta para decirle al autor que su guía te ha servido.')
      return
    }
    enCurso = true
    boton.disabled = true

    // Se pinta antes de que conteste la base: el clic tiene que
    // responder al instante. Si falla, se deshace.
    const antes = { ...estado }
    estado.mio = !estado.mio
    estado.total += estado.mio ? 1 : -1
    pintar(boton, contador, estado)

    const { error } = estado.mio
      ? await supabase.from('guide_helpful').insert({ guide_id: guide.id, user_id: session.user.id })
      : await supabase.from('guide_helpful').delete().eq('guide_id', guide.id).eq('user_id', session.user.id)

    if (error) {
      Object.assign(estado, antes)
      pintar(boton, contador, estado)
      showToast('No se ha podido guardar: ' + error.message)
    } else if (estado.mio) {
      // El aviso al autor es el objetivo de todo esto. Va una sola vez
      // por persona y guía, porque la clave primaria de la tabla no deja
      // insertar dos veces.
      await createNotification({
        recipientId: guide.author_id,
        actorId: session.user.id,
        type: 'guide_helpful',
        title: 'A alguien le ha servido tu guía',
        body: guide.title,
        link: `/guia.html?slug=${encodeURIComponent(guide.slug)}`,
      })
    }

    boton.disabled = false
    enCurso = false
  })
}
