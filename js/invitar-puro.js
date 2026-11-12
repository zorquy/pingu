// El enlace de invitación (1298) sin tocar la base ni la página: así se prueba
// en Node. El enlace, los logros de Embajador y lo que dice la tarjeta.
//
// Los logros son los de supabase-migration-referidos.sql: «Embajador» con el
// primer invitado y «Embajador de oro» con cinco. Si algún día cambian sus
// cuentas, cambian aquí y allí.
export const EMBAJADOR = [
  { id: 'embajador', titulo: 'Embajador', cuantos: 1, xp: 50 },
  { id: 'embajador-oro', titulo: 'Embajador de oro', cuantos: 5, xp: 150 },
]

// Solo lo que deja pasar el registro (auth.js guarda el padrino si casa con
// esto); un usuario raro no da enlace, y la tarjeta manda a ponerse uno.
export const usuarioValido = (u) => /^[a-z0-9_-]{1,40}$/i.test(String(u || ''))

export const enlaceDeInvitacion = (usuario, origen = 'https://pokedoc.es') =>
  usuarioValido(usuario) ? `${String(origen).replace(/\/$/, '')}/r/${encodeURIComponent(usuario)}` : null

// El enlace sin «https://» para enseñarlo (cabe en la tarjeta).
export const enlaceCorto = (enlace) => String(enlace || '').replace(/^https?:\/\/(www\.)?/, '')

// Cuál es el siguiente logro y cuánto falta. Con todos ganados, `siguiente`
// es null y la barra va llena.
export function progresoEmbajador(traidos) {
  const n = Math.max(0, Number(traidos) || 0)
  const siguiente = EMBAJADOR.find((l) => n < l.cuantos) || null
  const ganados = EMBAJADOR.filter((l) => n >= l.cuantos)
  if (!siguiente) return { n, siguiente: null, faltan: 0, pct: 100, ganados }
  return { n, siguiente, faltan: siguiente.cuantos - n, pct: Math.round((n / siguiente.cuantos) * 100), ganados }
}

export const textoDeTraidos = (n) =>
  n > 0 ? `Has traído a ${n} ${n === 1 ? 'persona' : 'personas'}` : 'Todavía no ha llegado nadie con tu enlace'

export function textoDeFalta(p) {
  if (!p.siguiente) return '¡Tienes los dos logros de Embajador!'
  return `${p.faltan === 1 ? 'Una más' : `${p.faltan} más`} para «${p.siguiente.titulo}» · +${p.siguiente.xp} XP`
}

// Lo que se comparte con la imagen: corto, con el enlace al final.
export const textoDeInvitacion = ({ nombre, enlace }) =>
  `${nombre ? `${nombre} te invita a PokeDoc` : 'Te invito a PokeDoc'}: tu colección y lo que vale, cambios con gente de confianza, guías, retos diarios y torneos. Todo gratis.\n${enlace}`
