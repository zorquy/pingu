// La portada del reto diario (tanda 907): qué se enseña en la imagen que
// se comparte, sacado de las cinco preguntas de hoy.
//
// PINGU: «no puedes sacar una imagen de uno de los retos para ponerlo como
// portada?». Las preguntas salen de los bloques de práctica de las guías
// (`preguntasDelDia`), y muchas llevan cartas —elegir la carta, el intruso,
// memoria, ordenar por precio— o una imagen —zonas, diferencias—. Se coge
// la PRIMERA que tenga carta; si ninguna tiene, la primera con imagen; si
// tampoco, nada, y la imagen sale con el marco y sin foto.
//
// LA CHAPA DICE EL TEMA, NO LA PREGUNTA: el reto es el mismo para todo el
// mundo ese día, y el enunciado le destriparía la partida a quien aún no
// la ha jugado. El tema es el título de la guía de donde sale.
//
// Sin dependencias: lo importan la página del reto y /admin → Redes.

// Los ids de carta que trae cada tipo de bloque, en su orden.
export function idsDeCartas(bloque) {
  if (!bloque || typeof bloque !== 'object') return []
  const ids = []
  for (const id of bloque.card_ids || []) if (id) ids.push(String(id))
  for (const c of bloque.cards || []) {
    const id = typeof c === 'string' ? c : c?.id
    if (id) ids.push(String(id))
  }
  return [...new Set(ids)]
}

// La imagen que trae un bloque (zonas, diferencias), si es una dirección.
export function imagenDeBloque(bloque) {
  const url = bloque?.image_url || bloque?.image_left_url || ''
  return /^https?:\/\//.test(url) ? url : null
}

// El tema de una pregunta: el título de su guía, recortado.
export function temaDe(pregunta, maximo = 28) {
  // «Pull rates: cómo funcionan…» → «Pull rates»: lo de antes de los dos
  // puntos (o de una raya) ya es el tema.
  const t = String(pregunta?.__guideTitle || '').replace(/\s+/g, ' ').trim().split(/\s*(?::|—|–| - )\s*/)[0]
  if (t.length <= maximo) return t
  const corte = t.slice(0, maximo + 1).lastIndexOf(' ')
  return `${t.slice(0, corte > 12 ? corte : maximo).replace(/[,.:;·—-]+$/, '')}…`
}

// { tipo: 'carta', id, indice, tema } | { tipo: 'imagen', url, indice, tema } | null
export function portadaDelReto(preguntas) {
  const lista = Array.isArray(preguntas) ? preguntas : []
  for (let i = 0; i < lista.length; i++) {
    const ids = idsDeCartas(lista[i])
    // En «elegir la carta» la buena es la que se pregunta: no se enseña esa.
    const correcta = lista[i]?.correct_id || lista[i]?.intruso_id || null
    const id = ids.find((x) => x !== correcta) || null
    if (id) return { tipo: 'carta', id, indice: i, tema: temaDe(lista[i]) }
  }
  for (let i = 0; i < lista.length; i++) {
    const url = imagenDeBloque(lista[i])
    if (url) return { tipo: 'imagen', url, indice: i, tema: temaDe(lista[i]) }
  }
  return null
}

// La chapa de la foto: «Pregunta 3 · Pull rates» (o solo el número).
export function chipDePortada(portada) {
  if (!portada) return ''
  const n = `Pregunta ${portada.indice + 1}`
  return portada.tema ? `${n} · ${portada.tema}` : n
}

// Los temas de hoy, sin repetir y en su orden (para la imagen de la cuenta).
export function temasDelReto(preguntas, maximo = 5) {
  const vistos = []
  for (const p of Array.isArray(preguntas) ? preguntas : []) {
    const t = temaDe(p, 22)
    if (t && !vistos.includes(t)) vistos.push(t)
    if (vistos.length >= maximo) break
  }
  return vistos
}

// El color del fondo según el tipo de la carta. El catálogo guarda el tipo
// en inglés o en español según quién lo engordara (la 889), así que se
// aceptan los dos; lo que no está, sin tono.
const TONOS = {
  fire: '#c4502a', fuego: '#c4502a',
  water: '#2f73b5', agua: '#2f73b5',
  grass: '#3f8f45', planta: '#3f8f45',
  lightning: '#b98f12', rayo: '#b98f12', 'eléctrico': '#b98f12', electrico: '#b98f12',
  psychic: '#8e4a8f', 'psíquico': '#8e4a8f', psiquico: '#8e4a8f',
  fighting: '#9a5a2e', lucha: '#9a5a2e',
  darkness: '#3e3a5c', oscura: '#3e3a5c', siniestro: '#3e3a5c',
  metal: '#5f7180', acero: '#5f7180',
  dragon: '#6a58c9', 'dragón': '#6a58c9',
  fairy: '#b0507d', hada: '#b0507d',
  colorless: '#6d6a60', incoloro: '#6d6a60', normal: '#6d6a60',
}
export function tonoDeCarta(carta) {
  const t = String((Array.isArray(carta?.types) && carta.types[0]) || '').toLowerCase().trim()
  return TONOS[t] || null
}

// El tuit de la cuenta por la mañana: que ya está, de qué va y que la
// gente conteste con su resultado (así su imagen y la de la cuenta se
// juntan en el mismo hilo).
export function textoDelAnuncio({ numero, temas = [], enlace = 'pokedoc.es/reto' }) {
  const de = temas.length ? ` sobre ${unir(temas.map((t) => t.toLowerCase()))}` : ''
  return [`Ya está el reto de hoy (#${numero}): 5 preguntas de Pokémon TCG${de}.`, '', '¿Cuántas aciertas tú? Contesta con tu resultado.', enlace].join('\n')
}

function unir(lista) {
  if (lista.length <= 1) return lista.join('')
  return `${lista.slice(0, -1).join(', ')} y ${lista[lista.length - 1]}`
}

// Lo de la noche: cuántos jugaron, la media, cuántos plenos y el reparto,
// de las filas de `daily_challenge_results` de ese día ({ correct, total }).
export function resumenDeResultados(filas) {
  const validas = (Array.isArray(filas) ? filas : []).filter((f) => Number.isFinite(Number(f?.total)) && Number(f.total) > 0)
  const jugadores = validas.length
  if (!jugadores) return { jugadores: 0, media: null, plenos: 0, reparto: [] }
  const total = Math.max(...validas.map((f) => Number(f.total)))
  const cuenta = new Map()
  let suma = 0
  let plenos = 0
  for (const f of validas) {
    const c = Math.max(0, Math.min(Number(f.correct) || 0, Number(f.total)))
    suma += c
    if (c === Number(f.total)) plenos++
    cuenta.set(c, (cuenta.get(c) || 0) + 1)
  }
  const reparto = []
  for (let k = total; k >= 0; k--) reparto.push({ aciertos: k, de: total, personas: cuenta.get(k) || 0, pct: Math.round(((cuenta.get(k) || 0) / jugadores) * 100) })
  return { jugadores, media: Math.round((suma / jugadores) * 10) / 10, plenos, pctPlenos: Math.round((plenos / jugadores) * 100), reparto }
}

// La pregunta que más se falla de las de hoy (de siempre, por question_stats),
// con al menos `minimo` respuestas para que un 0 de 1 no mande.
export function laMasDificil(preguntas, stats, claveDe, minimo = 5) {
  let peor = null
  ;(Array.isArray(preguntas) ? preguntas : []).forEach((p, i) => {
    const s = stats?.[`${p.__guideId}|${claveDe(p)}`]
    const n = Number(s?.respondida) || 0
    if (n < minimo) return
    const pct = Math.round(((Number(s.acertada) || 0) / n) * 100)
    if (!peor || pct < peor.pct) peor = { indice: i, pct, tema: temaDe(p), respuestas: n }
  })
  return peor
}

// El tuit de la noche, con los mismos números que la imagen.
export function textoDelResumen({ numero, resumen, dificil = null, enlace = 'pokedoc.es/reto' }) {
  if (!resumen?.jugadores) return `Hoy nadie ha jugado aún el reto #${numero}. ¿Te estrenas? ${enlace}`
  const media = String(resumen.media).replace('.', ',')
  const lineas = [`Así fue el reto #${numero}: ${resumen.jugadores.toLocaleString('es-ES')} ${resumen.jugadores === 1 ? 'persona' : 'personas'}, ${media} aciertos de media y un ${resumen.pctPlenos} % de plenos.`]
  if (dificil) lineas.push(`La más difícil, la pregunta ${dificil.indice + 1}${dificil.tema ? ` (${dificil.tema.toLowerCase()})` : ''}: solo la acierta el ${dificil.pct} %.`)
  lineas.push('', `Mañana, otro: ${enlace}`)
  return lineas.join('\n')
}
