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

// ── Cada imagen que se comparte invita (1327, G1 del plan 2027) ──
// La hoja de compartir sabe qué imagen es por el nombre de su fichero; con eso,
// su QR lleva a /r/<tú>/<qué> y la llegada enseña lo que viste («Su reto de
// hoy: ¿Le ganas?»). Lo que no se reconoce invita igual, a /r/<tú> a secas.
// Las rutas de los retos son las de RETOS (js/retos-xp.js): si cambian allí,
// aquí.
export const COMPARTIDO = {
  carta: { prefijo: 'carta-del-dia', frase: 'Su reto de hoy: ¿Qué carta es?', boton: 'Jugar el reto', ruta: () => '/carta-del-dia', reto: true },
  caro: { prefijo: 'mas-caro', frase: 'Su reto de hoy: ¿Más caro o más barato?', boton: 'Jugar el reto', ruta: () => '/mas-caro', reto: true },
  silueta: { prefijo: 'quien-es', frase: 'Su reto de hoy: ¿Quién es ese Pokémon?', boton: 'Jugar el reto', ruta: () => '/quien-es', reto: true },
  ordena: { prefijo: 'ordena-precio', frase: 'Su reto de hoy: Ordena por precio', boton: 'Jugar el reto', ruta: () => '/ordena-precio', reto: true },
  expansion: { prefijo: 'que-expansion', frase: 'Su reto de hoy: ¿De qué expansión es?', boton: 'Jugar el reto', ruta: () => '/que-expansion', reto: true },
  parejas: { prefijo: 'parejas', frase: 'Su reto de hoy: Parejas', boton: 'Jugar el reto', ruta: () => '/parejas', reto: true },
  vitrina: { prefijo: 'vitrina', frase: 'Te ha enseñado su colección', boton: 'Ver su colección', ruta: (u) => `/usuario/${encodeURIComponent(u)}?ver=coleccion` },
  set: { prefijo: 'expansion-', frase: 'Te ha enseñado cómo lleva una expansión', boton: 'Ver su colección', ruta: (u) => `/usuario/${encodeURIComponent(u)}?ver=coleccion` },
  partida: { prefijo: 'partida-', frase: 'Te ha enseñado una partida suya', boton: 'Ver su perfil', ruta: (u) => `/usuario/${encodeURIComponent(u)}?ver=torneos` },
  torneo: { prefijo: 'torneo-', frase: 'Te ha enseñado cómo le fue en un torneo', boton: 'Ver los torneos', ruta: () => '/torneos' },
  logro: { prefijo: 'logro-', frase: 'Te ha enseñado un logro suyo', boton: 'Ver sus logros', ruta: (u) => `/usuario/${encodeURIComponent(u)}?ver=logros` },
}

// Qué es una imagen, por el nombre de su fichero. `expansion-` (una expansión
// de tu colección) no es `que-expansion-` (el reto): el más largo gana.
export function compartidoDeNombre(nombre) {
  const n = String(nombre || '').toLowerCase()
  let mejor = null
  for (const [clave, c] of Object.entries(COMPARTIDO)) {
    if (n.startsWith(c.prefijo) && (!mejor || c.prefijo.length > COMPARTIDO[mejor].prefijo.length)) mejor = clave
  }
  return mejor
}

// La dirección que lleva la imagen (sin «https://») y la del QR (con ella).
export function enlaceDeImagen(usuario, de = null, origen = 'https://pokedoc.es') {
  const base = enlaceDeInvitacion(usuario, origen)
  if (!base) return null
  const largo = COMPARTIDO[de] ? `${base}/${de}` : base
  return { largo, corto: enlaceCorto(base), qr: largo }
}

// Lo que dice la llegada (auth.js) de lo compartido; null si no se sabe.
export function llegadaDeCompartido(usuario, de) {
  const c = COMPARTIDO[de]
  if (!c || !usuarioValido(usuario)) return null
  return { frase: c.frase, boton: c.boton, ruta: c.ruta(usuario), reto: Boolean(c.reto) }
}
