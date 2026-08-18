import { supabase } from './supabase.js'
import { checkAchievements } from './gamification.js'
import { icons } from './icons.js'

// Los primeros pasos de quien acaba de llegar.
//
// El problema que resuelve: alguien se registra desde el vídeo o desde un
// enlace, aterriza en la portada y ve una web con muchas cosas y ninguna
// primera. Se va sin hacer nada, y quien no hace nada el primer día no
// vuelve. Esto le pone delante TRES acciones concretas, en orden, con un
// trofeo al final.
//
// Las tres son a propósito una de cada pata de PokeDoc: leer, jugar y
// hablar. Quien las hace ya sabe lo que es esto.

export const LOGRO_PRIMEROS_PASOS = 'primeros_pasos'

export const PASOS = [
  {
    clave: 'leer',
    titulo: 'Lee una guía',
    texto: 'La que más te pique. Se leen enteras y gratis.',
    enlace: '/aprender.html',
    boton: 'Ver las guías',
  },
  {
    clave: 'curso',
    titulo: 'Haz un curso',
    texto: 'La misma guía, pero preguntándote. Con medalla al final.',
    enlace: '/aprender.html',
    boton: 'Empezar uno',
  },
  {
    clave: 'foro',
    titulo: 'Preséntate en el foro',
    texto: 'Di quién eres y qué coleccionas. Se contesta rápido.',
    enlace: '/foro.html',
    boton: 'Ir al foro',
  },
]

// Cuántos de los tres lleva. Son tres consultas de CONTAR (head: true), que
// no traen filas: solo el número.
export async function estadoPrimerosPasos(userId) {
  const [leidas, cursos, mensajes] = await Promise.all([
    supabase
      .from('user_progress')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .not('read_at', 'is', null),
    supabase
      .from('user_progress')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'completed'),
    supabase.from('forum_posts').select('*', { count: 'exact', head: true }).eq('author_id', userId),
  ])

  const hecho = {
    leer: (leidas.count || 0) > 0,
    curso: (cursos.count || 0) > 0,
    foro: (mensajes.count || 0) > 0,
  }
  return { hecho, hechos: PASOS.filter((p) => hecho[p.clave]).length }
}

// El siguiente paso es el primero SIN hacer. Es el único que lleva botón:
// tres botones a la vez es otra vez el problema de "por dónde empiezo".
export function siguientePaso(hecho) {
  return PASOS.find((p) => !hecho[p.clave]) || null
}

export function panelPrimerosPasosHtml(estado) {
  const siguiente = siguientePaso(estado.hecho)
  const filas = PASOS.map((paso) => {
    const listo = estado.hecho[paso.clave]
    const esSiguiente = siguiente?.clave === paso.clave
    return `<li class="paso ${listo ? 'paso-hecho' : ''} ${esSiguiente ? 'paso-siguiente' : ''}">
      <span class="paso-marca" aria-hidden="true">${listo ? icons.checkCircle(14) : ''}</span>
      <span class="paso-texto">
        <strong>${paso.titulo}</strong>
        <small>${paso.texto}</small>
      </span>
      ${esSiguiente ? `<a class="btn-primary paso-boton" href="${paso.enlace}">${paso.boton}</a>` : ''}
    </li>`
  }).join('')

  return `<div class="primeros-pasos">
    <div class="primeros-pasos-cabecera">
      <div>
        <span class="eyebrow">Para empezar</span>
        <h2>Tus primeros pasos</h2>
      </div>
      <span class="primeros-pasos-cuenta">${estado.hechos} de ${PASOS.length}</span>
    </div>
    <ul class="primeros-pasos-lista">${filas}</ul>
    <p class="subtext primeros-pasos-pie">Al completar los tres te llevas tu primer trofeo.</p>
  </div>`
}

// Pinta el panel si hace falta. No hace nada —ni una consulta— para quien ya
// tiene el trofeo, que es casi todo el mundo pasada la primera semana.
export async function montarPrimerosPasos(contenedor, session) {
  if (!contenedor || !session) return
  // "Ya he terminado", pase lo que pase: con panel, sin panel o habiendo
  // fallado. Lo pide el hueco de la portada, y sirve para saber desde fuera
  // que esto ya ha decidido — sin eso, mirar la portada a los dos segundos
  // es una carrera, y una carrera acaba dando por bueno lo que no lo es.
  const acabar = () => contenedor.setAttribute('data-pasos', 'listo')
  try {
    const { data: perfil } = await supabase
      .from('user_profiles')
      .select('achievements')
      .eq('id', session.user.id)
      .single()
    if ((perfil?.achievements || []).includes(LOGRO_PRIMEROS_PASOS)) return acabar()

    const estado = await estadoPrimerosPasos(session.user.id)
    if (estado.hechos >= PASOS.length) {
      // Ya están los tres: se le da el trofeo (con su modal) y el panel
      // desaparece para siempre.
      await checkAchievements(session.user.id)
      return acabar()
    }
    contenedor.innerHTML = panelPrimerosPasosHtml(estado)
    contenedor.classList.remove('hidden')
    acabar()
  } catch {
    // Esto es un extra de bienvenida: si algo falla, la portada se queda
    // como estaba. Nunca puede dejar la página a medias.
    acabar()
  }
}
