// En qué estado está una guía, dicho sin mentir.
//
// Había un estado que la web contaba mal, y lo pilló él usándolo: una guía
// del panel de administración nace con `review_status = 'approved'` (es el
// valor por defecto de la columna) y con `published_at` a null si no se
// marca "Publicada". Resultado: en "Mis guías" ponía **"Publicada"** y no
// aparecía en ningún sitio de la web. Ni estaba publicada, ni había forma
// de verla.
//
// La lección: `review_status` NO dice si algo se ve. Lo que decide que una
// guía esté en la web es `published_at` — con la excepción de las
// `pending`, que se ven en Comunidad a propósito mientras la comunidad las
// escribe. Así que el estado que hay que enseñar sale de LOS DOS campos, y
// se calcula en un solo sitio para que el perfil, la guía y el panel no
// puedan volver a decir tres cosas distintas.

export const ESTADOS = {
  draft: { texto: 'Borrador', clase: 'badge-progress' },
  pending: { texto: 'Pendiente de revisión', clase: 'badge-pro' },
  rejected: { texto: 'Rechazada', clase: 'badge-danger' },
  // El que faltaba. "Aprobada" a secas volvería a sugerir que está en la
  // web, que es justo el malentendido que hubo.
  aprobada_sin_publicar: { texto: 'Aprobada, sin publicar', clase: 'badge-progress' },
  publicada: { texto: 'Publicada', clase: 'badge-completed' },
}

export function estadoDeGuia(guia) {
  if (!guia) return ESTADOS.draft
  if (guia.review_status === 'rejected') return ESTADOS.rejected
  if (guia.review_status === 'pending') return ESTADOS.pending
  if (guia.review_status === 'approved') {
    return guia.published_at ? ESTADOS.publicada : ESTADOS.aprobada_sin_publicar
  }
  // Un borrador con fecha de publicación no debería existir, pero si lo
  // hay, lo que manda es que se ve: decir "borrador" de algo que está en
  // la web sería el mismo error del revés.
  return guia.published_at ? ESTADOS.publicada : ESTADOS.draft
}

// ¿La ve alguien más que su autor y el equipo?
//
// Publicada, o pendiente de revisión (esas salen en Comunidad). Lo demás
// es privado, y por eso hace falta avisar de que lo que estás mirando no
// lo ve nadie más — si no, se confunde con una guía viva.
export const laVeLaGente = (guia) => !!guia?.published_at || guia?.review_status === 'pending'
