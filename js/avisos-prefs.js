// Los avisos agrupados para /ajustes (868). La campanita tiene veinticinco
// tipos y el correo catorce: en el editor del perfil eran casillas una por
// una, y la gente apaga TODO antes que leer veinticinco líneas. Aquí se
// enseñan por lo que significan para quien los recibe («lo de tus guías»,
// «tu torneo»), y cada interruptor escribe todos los tipos de su grupo en
// la misma columna de siempre (`notification_prefs_disabled`,
// `notification_email_disabled`): ni la base ni quien manda los avisos
// cambian. Puro: lo prueba node.

export const GRUPOS_CAMPANITA = [
  { id: 'guias', titulo: 'Comentarios en tus guías, y cuando le sirven a alguien', tipos: ['guide_comment', 'guide_helpful'] },
  { id: 'correcciones', titulo: 'Correcciones que te sugieren, y cuando aceptan la tuya', tipos: ['guide_suggestion', 'guide_suggestion_accepted'] },
  { id: 'revision', titulo: 'Cuando tu guía se aprueba o necesita cambios', tipos: ['guide_approved', 'guide_rejected'] },
  { id: 'peticion', titulo: 'Cuando se escribe una guía que pediste', tipos: ['guide_request_fulfilled'] },
  { id: 'respuestas', titulo: 'Respuestas a tus comentarios', tipos: ['comment_reply'] },
  { id: 'foro', titulo: 'Respuestas y reacciones en el foro', tipos: ['forum_reply', 'forum_reaction'] },
  { id: 'seguidores', titulo: 'Nuevos seguidores', tipos: ['new_follower'] },
  { id: 'seguidos', titulo: 'Guías nuevas de quien sigues', tipos: ['followed_guide_published'] },
  { id: 'torneo', titulo: 'Tu torneo: la ronda, tu partida, la plaza, la jornada de tu liga y el final', tipos: ['torneo_ronda', 'torneo_partida', 'torneo_final', 'torneo_cancelado', 'torneo_recordatorio', 'torneo_plaza', 'torneo_jornada'] },
  { id: 'torneo-apertura', titulo: 'Torneos nuevos con inscripciones abiertas', tipos: ['torneo_apertura'] },
  { id: 'torneo-juez', titulo: 'Cuando llaman a un juez en un torneo tuyo', tipos: ['torneo_juez'] },
  { id: 'cambios', titulo: 'Cuando alguien da una carta que buscas', tipos: ['trade_match', 'trade_match_seguido'] },
  { id: 'tiendas', titulo: 'Cuando una tienda tiene una carta que buscas', tipos: ['tienda_la_tiene'] },
  { id: 'compras', titulo: 'Tus compras a tiendas: ofertas, respuestas y envíos', tipos: ['tienda_oferta', 'tienda_fotos'] },
  { id: 'lunes', titulo: 'El resumen de tu semana, los lunes', tipos: ['resumen_lunes'] },
  { id: 'equipo', titulo: 'Novedades y avisos del equipo de PokeDoc', tipos: ['aviso_equipo'] },
]

export const GRUPOS_CORREO = [
  { id: 'mensajes', titulo: 'Mensajes privados', tipos: ['private_message'] },
  { id: 'respuestas', titulo: 'Respuestas a tus comentarios y en temas que sigues', tipos: ['comment_reply', 'forum_reply'] },
  { id: 'menciones', titulo: 'Cuando te mencionan con @tunombre', tipos: ['forum_mention'] },
  { id: 'seguidores', titulo: 'Seguidores nuevos', tipos: ['new_follower'] },
  { id: 'revision', titulo: 'Cuando tu guía se aprueba o necesita cambios', tipos: ['guide_approved', 'guide_rejected'] },
  { id: 'resumen', titulo: 'El resumen semanal de la comunidad', tipos: ['weekly_digest'] },
  { id: 'torneo', titulo: 'Tu torneo: la ronda, tu partida, la plaza, la jornada de tu liga y el final', tipos: ['torneo_partida', 'torneo_recordatorio', 'torneo_cancelado', 'torneo_plaza', 'torneo_jornada', 'torneo_ronda', 'torneo_final'] },
]

// Los grupos que tienen sentido para ESTA lista de tipos, y un grupo propio
// para cada tipo que no esté en ninguno: un aviso nuevo que nadie agrupó
// sale igual, con su texto, en vez de perderse.
export function gruposDe(tipos, grupos) {
  const hay = new Set(Object.keys(tipos || {}))
  const salida = []
  const vistos = new Set()
  for (const g of grupos) {
    const propios = g.tipos.filter((t) => hay.has(t))
    if (!propios.length) continue
    propios.forEach((t) => vistos.add(t))
    salida.push({ ...g, tipos: propios })
  }
  for (const t of hay) if (!vistos.has(t)) salida.push({ id: t, titulo: tipos[t], tipos: [t] })
  return salida
}

// Un grupo está activo mientras quede UN tipo suyo sin apagar: apagar a
// medias (desde el editor viejo) no se lee como apagado.
export function estaActivo(grupo, apagados) {
  const a = new Set(apagados || [])
  return grupo.tipos.some((t) => !a.has(t))
}

// La lista de apagados con el grupo entero puesto o quitado.
export function conGrupo(apagados, grupo, activo) {
  const a = new Set(apagados || [])
  for (const t of grupo.tipos) activo ? a.delete(t) : a.add(t)
  return [...a]
}

// ── La tabla de avisos (1149, C1 de «Cuatro pantallas más») ──
// Una FILA es una cosa que te puede pasar, y vale para los dos canales: la
// campanita y el correo guardan por TIPO, así que una fila toca en cada
// canal solo los tipos suyos que ese canal tiene (`tiposEn`). Si no tiene
// ninguno, la casilla no existe («—»), no se pinta apagada. El push no es
// por tipo: es un interruptor por dispositivo que manda lo de la campanita.
export const SECCIONES_AVISOS = [
  { id: 'mensajes', titulo: 'Mensajes y menciones', filas: [
    { id: 'mensajes', titulo: 'Mensajes privados', tipos: ['private_message'] },
    { id: 'menciones', titulo: 'Cuando te mencionan con @tunombre', tipos: ['forum_mention'] },
  ] },
  { id: 'foro', titulo: 'Foro y comentarios', filas: [
    { id: 'respuestas', titulo: 'Respuestas a tus comentarios', tipos: ['comment_reply'] },
    { id: 'foro', titulo: 'Respuestas y reacciones en el foro', tipos: ['forum_reply', 'forum_reaction'] },
  ] },
  { id: 'guias', titulo: 'Tus guías', filas: [
    { id: 'guias', titulo: 'Comentarios en tus guías, y cuando le sirven a alguien', tipos: ['guide_comment', 'guide_helpful'] },
    { id: 'correcciones', titulo: 'Correcciones que te sugieren, y cuando aceptan la tuya', tipos: ['guide_suggestion', 'guide_suggestion_accepted'] },
    { id: 'revision', titulo: 'Cuando tu guía se aprueba o necesita cambios', tipos: ['guide_approved', 'guide_rejected'] },
    { id: 'peticion', titulo: 'Cuando se escribe una guía que pediste', tipos: ['guide_request_fulfilled'] },
  ] },
  { id: 'gente', titulo: 'Gente', filas: [
    { id: 'seguidores', titulo: 'Nuevos seguidores', tipos: ['new_follower'] },
    { id: 'seguidos', titulo: 'Guías nuevas de quien sigues', tipos: ['followed_guide_published'] },
  ] },
  { id: 'torneos', titulo: 'Torneos', filas: [
    { id: 'torneo', titulo: 'Tu torneo: la ronda, tu partida, la plaza, la jornada de tu liga y el final', tipos: ['torneo_ronda', 'torneo_partida', 'torneo_final', 'torneo_cancelado', 'torneo_recordatorio', 'torneo_plaza', 'torneo_jornada'] },
    { id: 'torneo-aviso', titulo: 'Avisos del organizador durante un torneo', tipos: ['torneo_aviso'] },
    { id: 'torneo-apertura', titulo: 'Torneos nuevos con inscripciones abiertas', tipos: ['torneo_apertura'] },
    { id: 'torneo-juez', titulo: 'Cuando llaman a un juez en un torneo tuyo', tipos: ['torneo_juez'] },
  ] },
  { id: 'cambios', titulo: 'Cambios y tiendas', filas: [
    { id: 'cambios', titulo: 'Cuando alguien da una carta que buscas', tipos: ['trade_match', 'trade_match_seguido'] },
    { id: 'tiendas', titulo: 'Cuando una tienda tiene una carta que buscas', tipos: ['tienda_la_tiene'] },
    { id: 'compras', titulo: 'Tus compras a tiendas: ofertas, respuestas y envíos', tipos: ['tienda_oferta', 'tienda_fotos'] },
  ] },
  { id: 'pokedoc', titulo: 'De PokeDoc', filas: [
    { id: 'lunes', titulo: 'El resumen de tu semana, los lunes', tipos: ['resumen_lunes'] },
    { id: 'resumen', titulo: 'El resumen semanal de la comunidad', tipos: ['weekly_digest'] },
    { id: 'equipo', titulo: 'Novedades y avisos del equipo de PokeDoc', tipos: ['aviso_equipo'] },
  ] },
]

// Los tipos de una fila que tiene ESTE canal (sus `tipos`: el objeto de
// tipos de la campanita o del correo).
export const tiposEn = (fila, tipos) => fila.tipos.filter((t) => Object.hasOwn(tipos || {}, t))

// Las secciones para los canales dados (`{ campanita: TIPOS, correo: TIPOS }`):
// sin las filas que no tiene NINGUNO, y con un tipo que nadie colocó en su
// propia fila al final («Otros»), para que un aviso nuevo no se pierda.
export function seccionesDeAvisos(canales) {
  const todos = new Set(Object.values(canales).flatMap((t) => Object.keys(t || {})))
  const colocados = new Set()
  const salida = []
  for (const s of SECCIONES_AVISOS) {
    const filas = s.filas.filter((f) => Object.values(canales).some((t) => tiposEn(f, t).length))
    filas.forEach((f) => f.tipos.forEach((t) => colocados.add(t)))
    if (filas.length) salida.push({ ...s, filas })
  }
  const sueltos = [...todos].filter((t) => !colocados.has(t))
  if (sueltos.length) {
    const titulo = (t) => Object.values(canales).map((x) => x?.[t]).find(Boolean) || t
    salida.push({ id: 'otros', titulo: 'Otros', filas: sueltos.map((t) => ({ id: t, titulo: titulo(t), tipos: [t] })) })
  }
  return salida
}

// Cómo está una sección en un canal: 'si' (todo puesto), 'no' (todo
// quitado), 'medias', o null si ese canal no tiene nada de ella.
export function estadoDeSeccion(seccion, tipos, apagados) {
  const filas = seccion.filas.map((f) => tiposEn(f, tipos)).filter((t) => t.length)
  if (!filas.length) return null
  const puestas = filas.filter((t) => estaActivo({ tipos: t }, apagados)).length
  return puestas === filas.length ? 'si' : puestas ? 'medias' : 'no'
}
