// LAS PIEZAS PARA LAS REDES DE POKEDOC (tanda 1335), sin DOM: lo prueba Node.
//
// PINGU: «esto es para mí, para yo compartir en las redes oficiales de
// Pokedoc… Yo para postear en Twitter le doy compartir en X y me pone todo el
// texto con el enlace y la imagen. Y para Instagram me descargo la imagen…
// en el formato de publicación, y luego copio el caption que me das tú». Así
// que nada se publica solo: /admin → Redes junta lo que se puede sacar
// (noticias, guías, torneos; eventos, lanzamientos y el meta en las tandas
// siguientes) y de cada cosa arma una PIEZA: el texto para X, el texto para
// Instagram y las imágenes (una, o un carrusel), descritas aquí como datos.
// Las dibuja `redes-piezas.js` con el marco común (`redes-marco.js`).
//
// La `clave` de cada pieza es la que apunta la tabla `redes_compartido`
// (migración 1335) para saber qué está ya compartido y en qué red.
import { textoParaX, recortarPalabras } from './compartir-x.js'
import { rutaDeArticulo } from './articulos.js'
import { TIPOS as TIPOS_DE_EVENTO, fechaLarga, fechaCorta as fechaCortaDeEvento, entradasDe, desdePrecio, siglasDe, esPasado } from './eventos-puro.js'

export const SITIO = 'https://pokedoc.es'

// Los tipos, en el orden de los filtros del panel. Las tandas que añadan
// piezas (eventos, lanzamientos, meta…) añaden su tipo aquí.
export const TIPOS = {
  noticia: { nombre: 'Noticias', chapa: 'Noticia' },
  guia: { nombre: 'Guías', chapa: 'Guía' },
  torneo: { nombre: 'Torneos', chapa: 'Torneo' },
  evento: { nombre: 'Eventos', chapa: 'Evento' },
  lanzamiento: { nombre: 'Lanzamientos', chapa: 'Lanzamiento' },
  novedades: { nombre: 'Novedades', chapa: 'Novedades' },
  meta: { nombre: 'Meta', chapa: 'Meta' },
  precios: { nombre: 'Precios', chapa: 'Precios' },
  hito: { nombre: 'Hitos', chapa: 'Hito' },
}
export const REDES = { x: 'X', instagram: 'Instagram' }

// Las etiquetas de Instagram: pocas y las que se buscan de verdad. Las de
// siempre van en todas; cada tipo suma las suyas.
const ETIQUETAS_BASE = ['#PokemonTCG', '#PokémonTCG', '#PokeDoc']
const ETIQUETAS = {
  noticia: ['#NoticiasPokémon', '#Pokémon'],
  guia: ['#GuíaPokémon', '#AprendeAJugar'],
  torneo: ['#TorneoPokémon', '#PokémonEspaña'],
  evento: ['#PokémonEspaña', '#CardShow'],
  lanzamiento: ['#NuevaExpansión', '#PokémonCartas'],
  novedades: ['#Novedades'],
  meta: ['#MetaPokémon', '#PokémonTCGLive'],
  precios: ['#Cardmarket', '#PokémonCartas'],
  hito: ['#ComunidadPokémon'],
}
export const etiquetasDe = (tipo) => [...ETIQUETAS_BASE, ...(ETIQUETAS[tipo] || [])].join(' ')

export const claveDe = (tipo, id, variante = '') => `${tipo}:${id}${variante ? `:${variante}` : ''}`

const limpio = (t) => String(t ?? '').replace(/\s+/g, ' ').trim()
const ENTIDADES = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", apos: "'", nbsp: ' ' }
// Las etiquetas se cambian por un espacio (un </p><p> no puede pegar dos
// palabras) y luego se quita el que queda delante de un signo: «<b>siempre</b>.».
const sinEtiquetas = (html) => limpio(String(html || '').replace(/<[^>]*>/g, ' ').replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (_, e) => ENTIDADES[e])).replace(/\s+([.,;:!?)»])/g, '$1')

// El texto de Instagram: título, la entradilla, lo importante en puntos, la
// llamada (Instagram no deja enlaces en el texto: «enlace en la bio») y las
// etiquetas al final, separadas, que es como se leen mejor.
export function captionDe({ titulo, cuerpo = '', puntos = [], cierre = '', tipo = '' }) {
  const partes = [limpio(titulo)]
  if (limpio(cuerpo)) partes.push(limpio(cuerpo))
  if (puntos.length) partes.push(puntos.map((p) => `· ${limpio(p)}`).join('\n'))
  if (limpio(cierre)) partes.push(limpio(cierre))
  partes.push(etiquetasDe(tipo))
  return partes.join('\n\n')
}

// Los títulos que no dicen nada fuera de la guía («Introducción»,
// «Conclusión»…) no van como «lo importante».
const DE_RELLENO = /^(introducci[oó]n|conclusi[oó]n|conclusiones|resumen|[íi]ndice|para terminar|para acabar|antes de empezar|fuentes|referencias|enlaces|despedida|y ahora qu[ée]|preguntas frecuentes)\b/i

// Los apartados de una guía: cada <h2> (el índice que ya ve quien la lee) con
// la primera frase o dos de lo que va debajo, que es lo que se lee en la
// diapositiva. Valen los dos formatos de bloques: el `richtext` del editor de
// ahora y los `heading` + `paragraph` de las guías viejas.
export function apartadosDeGuia(guia) {
  const apartados = []
  const anadirTexto = (t) => {
    const ultimo = apartados[apartados.length - 1]
    if (ultimo && ultimo.texto.length < 220) ultimo.texto = limpio(`${ultimo.texto} ${t}`)
  }
  for (const b of guia?.reference_blocks || []) {
    if (b?.type === 'heading' && b.text) apartados.push({ titulo: limpio(b.text), texto: '' })
    else if ((b?.type === 'paragraph' || b?.type === 'highlight') && b.text) anadirTexto(String(b.text).replace(/\[\/?[a-z]+(=[^\]]*)?\]/gi, ''))
    else if (b?.type === 'richtext' && b.html) {
      // Se trocea por los <h2>: lo de antes del primero no es de ningún apartado.
      const trozos = String(b.html).split(/<h2\b[^>]*>/i)
      anadirTexto(sinEtiquetas(trozos[0].replace(/<h3\b[\s\S]*?<\/h3>/gi, ' ')))
      for (const trozo of trozos.slice(1)) {
        const [titulo, resto = ''] = trozo.split(/<\/h2>/i)
        apartados.push({ titulo: sinEtiquetas(titulo), texto: '' })
        anadirTexto(sinEtiquetas(resto.replace(/<h3\b[\s\S]*?<\/h3>/gi, ' ')))
      }
    }
  }
  return apartados
    .map((a) => ({ titulo: a.titulo.replace(/^\d+[.)\-–—:]\s*/, ''), texto: primerasFrases(a.texto, 170) }))
    .filter((a) => a.titulo.length > 3 && !DE_RELLENO.test(a.titulo))
}

// Lo que quepa de las primeras frases enteras; si la primera ya es larga, recortada.
function primerasFrases(texto, maximo) {
  let salida = ''
  for (const f of frasesDe(texto)) {
    if (`${salida} ${f}`.trim().length > maximo) break
    salida = `${salida} ${f}`.trim()
  }
  return salida || recortarPalabras(texto, maximo)
}

// Lo importante de una guía, para el carrusel: sus tres primeros apartados y,
// si no tiene, las frases de la entradilla. Con menos de dos, no hay
// carrusel: una imagen.
export function puntosDeGuia(guia, maximo = 3) {
  return clavesDeGuia(guia, maximo).map((c) => c.titulo)
}

export function clavesDeGuia(guia, maximo = 3) {
  const apartados = apartadosDeGuia(guia)
  const claves = apartados.length >= 2 ? apartados : frasesDe(guia?.description).map((f) => ({ titulo: f, texto: '' }))
  return claves.length >= 2 ? claves.slice(0, maximo).map((c) => ({ titulo: recortarPalabras(c.titulo, 90), texto: c.texto })) : []
}

function frasesDe(texto) {
  return String(texto || '')
    .split(/(?<=[.!?])\s+|\n+/)
    .map((f) => limpio(f))
    .filter((f) => f.length > 3)
}

// ── Noticias ──
export function piezaDeNoticia(g) {
  const url = `${SITIO}${rutaDeArticulo('news', g.slug)}`
  const datos = { titulo: limpio(g.title), descripcion: limpio(g.description) }
  return {
    clave: claveDe('noticia', g.slug),
    tipo: 'noticia',
    titulo: datos.titulo,
    linea: 'Noticia',
    fecha: g.published_at || g.created_at || null,
    url,
    miniatura: g.cover_image || null,
    x: { texto: textoParaX(datos), url },
    caption: captionDe({ ...datos, cuerpo: datos.descripcion, cierre: 'La noticia entera, en español: enlace en la bio (pokedoc.es).', tipo: 'noticia' }),
    diapositivas: [{ pintor: 'noticia', datos: { titulo: datos.titulo, descripcion: datos.descripcion, fecha: g.published_at || '', portada: g.cover_image || null } }],
  }
}

// ── Guías ── (el carrusel: portada, lo importante y «léela entera»)
export function piezaDeGuia(g) {
  const url = `${SITIO}${rutaDeArticulo('guide', g.slug)}`
  const datos = { titulo: limpio(g.title), descripcion: limpio(g.description) }
  const claves = clavesDeGuia(g)
  const puntos = claves.map((c) => c.titulo)
  const minutos = Number(g.estimated_mins) > 0 ? Number(g.estimated_mins) : null
  const comun = { titulo: datos.titulo, descripcion: datos.descripcion, portada: g.cover_image || null, minutos }
  const diapositivas = puntos.length
    ? [
        { pintor: 'guia-portada', datos: comun },
        ...claves.map((c, i) => ({ pintor: 'guia-clave', datos: { ...comun, punto: c.titulo, detalle: c.texto, numero: i + 1 } })),
        { pintor: 'guia-cierre', datos: comun },
      ]
    : [{ pintor: 'guia-portada', datos: comun }]
  return {
    clave: claveDe('guia', g.slug),
    tipo: 'guia',
    titulo: datos.titulo,
    linea: `Guía${minutos ? ` · ${minutos} min` : ''}${puntos.length ? ` · carrusel de ${diapositivas.length}` : ''}`,
    fecha: g.published_at || g.created_at || null,
    url,
    miniatura: g.cover_image || null,
    x: { texto: textoParaX(datos), url },
    caption: captionDe({ ...datos, cuerpo: datos.descripcion, puntos, cierre: `La guía entera${minutos ? ` (${minutos} min)` : ''}, gratis y en español: enlace en la bio (pokedoc.es).`, tipo: 'guia' }),
    diapositivas,
  }
}

// ── Torneos ──
const ZONA = 'Europe/Madrid'
export function cuandoDeTorneo(iso) {
  const d = new Date(iso || '')
  if (Number.isNaN(d.getTime())) return ''
  const dia = new Intl.DateTimeFormat('es-ES', { timeZone: ZONA, weekday: 'long', day: 'numeric', month: 'long' }).format(d)
  const hora = new Intl.DateTimeFormat('es-ES', { timeZone: ZONA, hour: '2-digit', minute: '2-digit' }).format(d)
  // «sábado, 21 de noviembre» → «Sábado 21 de noviembre»: sin la coma se lee de un tirón.
  const limpioDia = dia.replace(/^([^\s,]+),/, '$1')
  return `${limpioDia.charAt(0).toUpperCase()}${limpioDia.slice(1)} · ${hora}`
}

export function formatoDeTorneo(t) {
  if (t?.format === 'league') return 'Liga por jornadas'
  const rondas = Number(t?.swiss_rounds) || 0
  const corte = Number(t?.top_cut_size) || 0
  return `Suizo${rondas ? ` a ${rondas} rondas` : ''}${corte ? ` y top ${corte}` : ''}`
}

const precioDe = (t) => {
  const p = t?.precio_entrada
  if (p === null || p === undefined || p === '') return null
  const n = Number(p)
  if (!Number.isFinite(n)) return null
  return n === 0 ? 'Gratis' : `${String(n).replace('.', ',')} €`
}

// Las plazas que quedan, o null si el torneo no tiene tope.
export function plazasQueQuedan(t, inscritos = 0) {
  const max = Number(t?.max_players) || 0
  return max ? Math.max(0, max - (Number(inscritos) || 0)) : null
}

const ABIERTOS = ['registration_open', 'registration_closed', 'in_progress']

// Un torneo da hasta dos piezas: el ANUNCIO mientras se juega o se apunta la
// gente, y los RESULTADOS cuando hay podio. Los privados y los borradores, ninguna.
export function piezasDeTorneo(t, { inscritos = 0, nombres = {}, ahora = new Date() } = {}) {
  if (!t || t.is_private || t.status === 'draft' || t.status === 'cancelled') return []
  const url = `${SITIO}/torneo?slug=${encodeURIComponent(t.slug || '')}`
  const piezas = []
  const nombre = limpio(t.name)
  if (ABIERTOS.includes(t.status) && new Date(t.start_at || 0).getTime() > ahora.getTime() - 86400e3) {
    const quedan = plazasQueQuedan(t, inscritos)
    const cuando = cuandoDeTorneo(t.start_at)
    const formato = formatoDeTorneo(t)
    const precio = precioDe(t)
    const plazasTxt = quedan === null ? '' : quedan === 0 ? 'Plazas completas' : `Quedan ${quedan} ${quedan === 1 ? 'plaza' : 'plazas'}`
    const frase = [cuando, formato, plazasTxt].filter(Boolean).join(' · ')
    piezas.push({
      clave: claveDe('torneo', t.id, 'anuncio'),
      tipo: 'torneo',
      titulo: nombre,
      linea: `Anuncio · ${frase}`,
      fecha: t.created_at || t.start_at || null,
      url,
      miniatura: t.banner_url || t.image_url || null,
      x: { texto: textoParaX({ titulo: `Torneo en PokeDoc: ${nombre}`, descripcion: `${frase}. Apúntate:` }), url },
      caption: captionDe({ titulo: `Torneo: ${nombre}`, cuerpo: limpio(t.description), puntos: [cuando, formato, plazasTxt, precio ? `Inscripción: ${precio}` : ''].filter(Boolean), cierre: 'Te apuntas desde la web: enlace en la bio (pokedoc.es/torneos).', tipo: 'torneo' }),
      diapositivas: [{ pintor: 'torneo-anuncio', datos: { titulo: nombre, cuando, formato, quedan, maximo: Number(t.max_players) || null, inscritos, precio, imagen: t.banner_url || t.image_url || null, oficial: Boolean(t.is_official), liga: t.format === 'league' } }],
    })
  }
  const podio = Array.isArray(t.podium) ? t.podium.filter(Boolean) : []
  if (t.status === 'finished' && podio.length) {
    const quien = (id) => limpio(nombres[id]) || 'Alguien'
    const campeon = quien(podio[0])
    const puestos = podio.slice(0, 3).map(quien)
    const jugadores = Number(inscritos) || 0
    const lineaPodio = puestos.map((n, i) => `${i + 1}. ${n}`).join(' · ')
    piezas.push({
      clave: claveDe('torneo', t.id, 'resultados'),
      tipo: 'torneo',
      titulo: `${campeon} gana ${nombre}`,
      linea: `Resultados · ${lineaPodio}`,
      fecha: t.result_announced_at || t.finish_notified_at || t.updated_at || t.start_at || null,
      url,
      miniatura: null,
      x: { texto: textoParaX({ titulo: `${campeon} gana ${nombre}`, descripcion: `Podio: ${lineaPodio}.${jugadores ? ` ${jugadores} jugadores.` : ''} ¡Enhorabuena!` }), url },
      caption: captionDe({ titulo: `${campeon} gana ${nombre}`, cuerpo: `${jugadores ? `${jugadores} jugadores y ` : ''}un podio que se lo ha ganado:`, puntos: puestos.map((n, i) => `${['Campeón', 'Segundo', 'Tercero'][i]}: ${n}`), cierre: 'Las partidas y el próximo torneo, en la web: enlace en la bio (pokedoc.es/torneos).', tipo: 'torneo' }),
      diapositivas: [{ pintor: 'torneo-resultados', datos: { titulo: nombre, campeon, puestos, jugadores, torneoId: t.id, campeonId: podio[0] } }],
    })
  }
  return piezas
}

// ── Eventos ── (1336)
const SITIO_EVENTO = (e) => `${SITIO}/eventos/${encodeURIComponent(e.slug || '')}`
const dondeDe = (e) => [e.sitio, e.ciudad].filter(Boolean).join(', ') || e.provincia || ''

// Uno por evento publicado que no ha pasado. La imagen es el cartel si lo
// hay; si no, el logo; si no, las siglas en su color (como en la agenda).
export function piezaDeEvento(e, { ahora = new Date() } = {}) {
  if (!e || e.publicado === false || esPasado(e, ahora)) return null
  const url = SITIO_EVENTO(e)
  const cuando = fechaLarga(e) || ''
  const donde = dondeDe(e)
  const precio = desdePrecio(entradasDe(e)) || (e.entrada ? limpio(e.entrada) : '')
  // «Entrada: desde 5 €» (en la imagen va sola, con su mayúscula).
  const precioEnFrase = precio.replace(/^Desde /, 'desde ')
  const tipo = TIPOS_DE_EVENTO[e.tipo] || 'Evento'
  const frase = [cuando, donde].filter(Boolean).join(' · ')
  return {
    clave: claveDe('evento', e.slug || e.id),
    tipo: 'evento',
    titulo: limpio(e.nombre),
    linea: `${tipo} · ${frase}`,
    fecha: e.created_at || e.empieza || null,
    url,
    miniatura: e.cartel_url || e.logo_url || null,
    x: { texto: textoParaX({ titulo: `${limpio(e.nombre)} (${tipo})`, descripcion: `${frase}.${precio ? ` Entrada: ${precioEnFrase}.` : ''} ¿Vas? Apúntate y mira quién va:` }), url },
    caption: captionDe({ titulo: limpio(e.nombre), cuerpo: limpio(e.descripcion), puntos: [cuando, donde, precio ? `Entrada: ${precioEnFrase}` : ''].filter(Boolean), cierre: 'Dale a «Voy» en la web y mira quién más va: enlace en la bio (pokedoc.es/eventos).', tipo: 'evento' }),
    diapositivas: [{ pintor: 'evento', datos: { titulo: limpio(e.nombre), tipo, cuando, donde, precio, cartel: e.cartel_url || null, logo: e.logo_url || null, logoSinFondo: Boolean(e.logo_sin_fondo), siglas: siglasDe(e), color: /^#[0-9a-f]{6}$/i.test(e.color || '') ? e.color : null } }],
  }
}

// El lunes de la semana de `d` (en España), como AAAA-MM-DD: la clave de
// «Esta semana» cambia cada lunes.
export function lunesDe(d = new Date()) {
  const x = new Date(new Intl.DateTimeFormat('en-CA', { timeZone: ZONA }).format(d) + 'T12:00:00Z')
  x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7))
  return x.toISOString().slice(0, 10)
}

// «Esta semana»: los eventos que empiezan de hoy a siete días, si son dos o más.
export function piezaSemanaDeEventos(eventos, { ahora = new Date() } = {}) {
  const fin = ahora.getTime() + 7 * 86400e3
  const lista = (eventos || [])
    .filter((e) => e && e.publicado !== false && !esPasado(e, ahora) && new Date(e.empieza).getTime() <= fin)
    .sort((a, b) => new Date(a.empieza) - new Date(b.empieza))
  if (lista.length < 2) return null
  const filas = lista.slice(0, 5).map((e) => ({ dia: fechaCortaDeEvento(e), nombre: limpio(e.nombre), donde: e.ciudad || e.provincia || '' }))
  const lunes = lunesDe(ahora)
  const url = `${SITIO}/eventos`
  return {
    clave: claveDe('eventos', 'semana', lunes),
    tipo: 'evento',
    titulo: `Esta semana, ${lista.length} eventos`,
    linea: `Resumen · ${filas.map((f) => f.nombre).join(' · ')}`,
    fecha: `${lunes}T06:00:00Z`,
    url,
    miniatura: null,
    x: { texto: textoParaX({ titulo: `Esta semana hay ${lista.length} eventos Pokémon TCG`, descripcion: filas.map((f) => `${f.dia}: ${f.nombre}${f.donde ? ` (${f.donde})` : ''}`).join('. ') }), url },
    caption: captionDe({ titulo: `Esta semana, ${lista.length} eventos`, cuerpo: '¿Te vemos en alguno?', puntos: filas.map((f) => `${f.dia} · ${f.nombre}${f.donde ? `, ${f.donde}` : ''}`), cierre: 'Toda la agenda, en la web: enlace en la bio (pokedoc.es/eventos).', tipo: 'evento' }),
    diapositivas: [{ pintor: 'eventos-semana', datos: { total: lista.length, filas } }],
  }
}

// ── Lanzamientos ── (1336)
const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const hoyEnEspana = (ahora) => new Intl.DateTimeFormat('en-CA', { timeZone: ZONA }).format(ahora)
const diasEntre = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400e3)

// «¡Sale hoy!», «Sale mañana», «Sale el viernes» (esta semana), «Sale el 3 de
// diciembre»; y lo que ya salió, «En tiendas desde el 7 de noviembre».
export function cuandoSale(fecha, ahora = new Date()) {
  const f = String(fecha || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) return ''
  const d = new Date(`${f}T12:00:00Z`)
  const n = diasEntre(hoyEnEspana(ahora), f)
  const largo = `${d.getUTCDate()} de ${MESES_LARGOS[d.getUTCMonth()]}`
  if (n === 0) return '¡Sale hoy!'
  if (n === 1) return 'Sale mañana'
  if (n > 1 && n < 7) return `Sale el ${DIAS_SEMANA[d.getUTCDay()]}`
  if (n >= 7) return `Sale el ${largo}`
  return `En tiendas desde el ${largo}`
}

// «8,50 €», «40 €», «121 €»: céntimos solo por debajo de cien y si los hay.
const eurosDe = (n) => {
  const v = Number(n) >= 100 ? Math.round(Number(n)) : Math.round(Number(n) * 100) / 100
  return `${v.toLocaleString('es-ES', { minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 })} €`
}

// Un set que sale en los próximos 45 días o salió hace menos de 15. `caras`:
// las cartas más caras ya con precio ({ nombre, imagen, precio }); con tres o
// más, el carrusel lleva «Las más caras».
// `todos`: sin la ventana (lo pide «Compartir» en /lanzamientos, que comparte
// el siguiente aunque falten dos meses).
export function piezaDeLanzamiento(set, { caras = [], ahora = new Date(), todos = false } = {}) {
  if (!set?.nombre || !set.fecha) return null
  const n = diasEntre(hoyEnEspana(ahora), String(set.fecha).slice(0, 10))
  if (!todos && (n > 45 || n < -14)) return null
  const ya = n <= 0
  const cuando = cuandoSale(set.fecha, ahora)
  const url = `${SITIO}${set.href ? set.href.replace(/^\/cartas\.html/, '/cartas') : '/lanzamientos'}`
  const top = (caras || []).filter((c) => c && c.nombre && Number(c.precio) > 0).slice(0, 3)
  const diapositivas = [{ pintor: 'lanzamiento', datos: { titulo: set.nombre, cuando, cartas: set.cartas || null, logo: set.imagen || null, ya, fecha: String(set.fecha).slice(0, 10) } }]
  if (ya && top.length >= 3) diapositivas.push({ pintor: 'lanzamiento-caras', datos: { titulo: set.nombre, cartas: top.map((c) => ({ ...c, precioTexto: eurosDe(c.precio) })) } })
  const puntos = [cuando, set.cartas ? `${set.cartas} cartas` : '', ...(ya && top.length >= 3 ? top.map((c, i) => `${i + 1}. ${c.nombre}: ${eurosDe(c.precio)}`) : [])].filter(Boolean)
  return {
    clave: claveDe('lanzamiento', set.id || set.nombre, ya ? 'salio' : 'sale'),
    tipo: 'lanzamiento',
    titulo: set.nombre,
    linea: `${ya ? 'Ya en tiendas' : 'Lo que viene'} · ${cuando}${diapositivas.length > 1 ? ` · carrusel de ${diapositivas.length}` : ''}`,
    fecha: ya ? `${String(set.fecha).slice(0, 10)}T08:00:00Z` : new Date(ahora.getTime() - 86400e3 * Math.min(n, 30) / 30).toISOString(),
    url,
    miniatura: set.imagen || null,
    x: { texto: textoParaX({ titulo: ya ? `${set.nombre} ya está en tiendas` : `${set.nombre}: ${cuando.charAt(0).toLowerCase()}${cuando.slice(1)}`, descripcion: ya && top.length >= 3 ? `Lo más caro ahora: ${top.map((c) => `${c.nombre} (${eurosDe(c.precio)})`).join(', ')}.` : `${set.cartas ? `${set.cartas} cartas. ` : ''}Todas las cartas y sus precios, en PokeDoc:` }), url },
    caption: captionDe({ titulo: ya ? `${set.nombre} ya está en tiendas` : set.nombre, cuerpo: ya ? 'Así está el mercado de la nueva expansión:' : '¿Qué sobres vas a abrir?', puntos, cierre: 'Todas las cartas, con su precio en Cardmarket: enlace en la bio (pokedoc.es).', tipo: 'lanzamiento' }),
    diapositivas,
  }
}

// ── Lo nuevo del mes ── (1336), de novedades.json: lo que se ha hecho en la
// web ese mes y sus tres destacadas.
export const nombreDeMes = (mes) => MESES_LARGOS[Number(String(mes).slice(5, 7)) - 1] || ''

export function piezaDeNovedadesDelMes(novedades, mes) {
  const entradas = (novedades?.entradas || []).filter((e) => String(e.fecha || '').startsWith(mes))
  const destacadas = (novedades?.destacadas || []).filter((d) => d.mes === mes).slice(0, 3)
  if (!entradas.length && !destacadas.length) return null
  const nombre = nombreDeMes(mes)
  const url = `${SITIO}/novedades`
  const nuevas = entradas.filter((e) => e.tipo === 'nuevo').length
  const resumen = [`${entradas.length} ${entradas.length === 1 ? 'cambio' : 'cambios'}`, nuevas ? `${nuevas} ${nuevas === 1 ? 'cosa nueva' : 'cosas nuevas'}` : ''].filter(Boolean).join(', ')
  const ultima = entradas.map((e) => e.fecha).sort().pop() || `${mes}-28`
  return {
    clave: claveDe('novedades', mes),
    tipo: 'novedades',
    titulo: `Lo nuevo de ${nombre} en PokeDoc`,
    linea: `Novedades · ${resumen}${destacadas.length ? ` · carrusel de ${destacadas.length + 1}` : ''}`,
    fecha: `${ultima}T20:00:00Z`,
    url,
    miniatura: null,
    x: { texto: textoParaX({ titulo: `Lo nuevo de ${nombre} en PokeDoc`, descripcion: destacadas.length ? destacadas.map((d) => d.titulo).join('. ') + '.' : `${resumen}.` }), url },
    caption: captionDe({ titulo: `Lo nuevo de ${nombre} en PokeDoc`, cuerpo: `Este mes, ${resumen}. Lo que más nos gusta:`, puntos: destacadas.map((d) => d.titulo), cierre: 'Todo lo que ha cambiado, en pokedoc.es/novedades (enlace en la bio).', tipo: 'novedades' }),
    diapositivas: [
      // Sin destacadas todavía (el mes en curso), las tres últimas cosas nuevas.
      { pintor: 'novedades-portada', datos: { mes: nombre, resumen, titulos: destacadas.length ? destacadas.map((d) => d.titulo) : entradas.filter((e) => e.tipo === 'nuevo').slice(0, 3).map((e) => recortarPalabras(String(e.texto || '').split(/[:.]/)[0], 52)) } },
      ...destacadas.map((d, i) => ({ pintor: 'novedades-destacada', datos: { titulo: d.titulo, texto: d.texto || '', enlace: `pokedoc.es${d.enlace || '/novedades'}`, numero: i + 1 } })),
    ],
  }
}

// ── El meta de la semana ── (1337), de `meta_resumen(7)`: los cinco
// arquetipos con más cuota, con lo que suben o bajan respecto a la semana de
// antes. `iconos` es una función que da la URL de un icono (la pone quien
// llama: aquí no hay CDN).
const pct = (n) => `${(Math.round(Number(n) * 10) / 10).toLocaleString('es-ES', { maximumFractionDigits: 1 })} %`

export function piezaDelMeta(filas, { ahora = new Date(), iconos = () => null } = {}) {
  const top = [...(filas || [])].filter((f) => f && Number(f.cuota) > 0).sort((a, b) => Number(b.cuota) - Number(a.cuota)).slice(0, 5)
  if (top.length < 3) return null
  const lunes = lunesDe(ahora)
  const filasPieza = top.map((f) => {
    const antes = f.cuota_anterior == null ? null : Number(f.cuota_anterior)
    const cambio = antes == null ? null : Math.round((Number(f.cuota) - antes) * 10) / 10
    return { nombre: limpio(f.nombre || f.arquetipo), cuota: Number(f.cuota), cuotaTexto: pct(f.cuota), cambio, iconos: (f.iconos || []).slice(0, 2).map(iconos).filter(Boolean) }
  })
  const url = `${SITIO}/meta`
  // «↑3,3» y «↓1»: puntos de cuota respecto a la semana de antes.
  const flecha = (c) => (c == null || c === 0 ? '' : c > 0 ? ` ↑${pct(c).replace(' %', '')}` : ` ↓${pct(-c).replace(' %', '')}`)
  return {
    clave: claveDe('meta', lunes),
    tipo: 'meta',
    titulo: `El meta de la semana: ${filasPieza[0].nombre} manda`,
    linea: `Meta · ${filasPieza.slice(0, 3).map((f) => `${f.nombre} ${f.cuotaTexto}`).join(' · ')}`,
    fecha: `${lunes}T07:00:00Z`,
    url,
    miniatura: null,
    x: { texto: textoParaX({ titulo: 'El meta de esta semana en Pokémon TCG', descripcion: filasPieza.map((f, i) => `${i + 1}. ${f.nombre} ${f.cuotaTexto}${flecha(f.cambio)}`).join(' · ') }), url },
    caption: captionDe({ titulo: 'El meta de esta semana', cuerpo: 'Los mazos que más se están jugando en los torneos de los últimos siete días:', puntos: filasPieza.map((f, i) => `${i + 1}. ${f.nombre}: ${f.cuotaTexto}${flecha(f.cambio)}`), cierre: 'Las listas y cómo les va, en la web: enlace en la bio (pokedoc.es/meta).', tipo: 'meta' }),
    diapositivas: [{ pintor: 'meta', datos: { filas: filasPieza } }],
  }
}

// ── Las que más suben ── (1337): `lista` = [{ nombre, imagen, precio, sube }]
// (sube: 0,23 = +23 %), de la media de 7 días contra la de 30 de Cardmarket.
export function piezaQueMasSuben(lista, { ahora = new Date() } = {}) {
  const tres = (lista || []).filter((c) => c && c.nombre && Number(c.sube) > 0).slice(0, 3)
  if (tres.length < 3) return null
  const lunes = lunesDe(ahora)
  const cartas = tres.map((c) => ({ nombre: limpio(c.nombre), imagen: c.imagen || null, precio: Number(c.precio) || 0, precioTexto: `+${Math.round(Number(c.sube) * 100)} %`, debajo: Number(c.precio) > 0 ? eurosDe(c.precio) : '' }))
  const url = `${SITIO}/cartas`
  return {
    clave: claveDe('suben', lunes),
    tipo: 'precios',
    titulo: `Las que más suben: ${cartas[0].nombre} ${cartas[0].precioTexto}`,
    linea: `Precios · ${cartas.map((c) => `${c.nombre} ${c.precioTexto}`).join(' · ')}`,
    fecha: `${lunes}T07:30:00Z`,
    url,
    miniatura: cartas[0].imagen,
    x: { texto: textoParaX({ titulo: 'Las cartas que más suben esta semana en Cardmarket', descripcion: cartas.map((c, i) => `${i + 1}. ${c.nombre}: ${c.precioTexto}${c.debajo ? ` (${c.debajo})` : ''}`).join(' · ') }), url },
    caption: captionDe({ titulo: 'Las que más suben esta semana', cuerpo: 'La media de siete días en Cardmarket, contra la del mes:', puntos: cartas.map((c, i) => `${i + 1}. ${c.nombre}: ${c.precioTexto}${c.debajo ? `, ahora ${c.debajo}` : ''}`), cierre: '¿La tienes? Apúntala en tu colección y mira lo que vale: enlace en la bio.', tipo: 'precios' }),
    diapositivas: [{ pintor: 'lanzamiento-caras', datos: { titulo: 'esta semana', cabecera: 'Las que más *suben*', chapa: 'Precios', entradilla: 'Media de 7 días contra la del mes, en Cardmarket', enlace: 'pokedoc.es/cartas', cartas } }],
  }
}

// ── Hitos ── (1337), de `sobre_cifras()`: la cifra redonda más alta a la que
// ha llegado cada cosa. La clave lleva el hito: compartido el de 1.000, el
// siguiente que sale es el de 2.500.
export const ESCALONES = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000, 2500000, 5000000, 10000000]
const QUE_ES = {
  personas: { varios: 'personas en PokeDoc', frase: 'Ya somos', enlace: '/usuarios' },
  cartas: { varios: 'cartas apuntadas en colecciones', frase: 'Ya hay', enlace: '/cartas' },
  temas: { varios: 'temas en el foro', frase: 'Ya hay', enlace: '/foro' },
  torneos: { varios: 'torneos jugados en PokeDoc', frase: 'Ya van', enlace: '/torneos' },
}
export const miles = (n) => Number(n).toLocaleString('es-ES', { useGrouping: 'always' })

export function hitoDe(valor) {
  const v = Number(valor) || 0
  return [...ESCALONES].reverse().find((e) => v >= e) || null
}

export function piezasDeHitos(cifras) {
  const salen = []
  for (const [clave, que] of Object.entries(QUE_ES)) {
    const hito = hitoDe(cifras?.[clave])
    // Por debajo de 100 no es un hito que contar en público.
    if (!hito || hito < 100) continue
    const url = `${SITIO}${que.enlace}`
    const numero = miles(hito)
    salen.push({
      clave: claveDe('hito', clave, hito),
      tipo: 'hito',
      titulo: `${que.frase} ${numero} ${que.varios}`,
      linea: `Hito · ahora mismo, ${miles(cifras[clave])}`,
      // Sin fecha: un hito no es «lo último», va al final de la lista.
      fecha: null,
      url,
      miniatura: null,
      x: { texto: textoParaX({ titulo: `${que.frase} ${numero} ${que.varios}`, descripcion: '¡Gracias por estar! Esto lo hacemos entre todos.' }), url },
      caption: captionDe({ titulo: `${que.frase} ${numero} ${que.varios}`, cuerpo: 'Gracias a cada uno de vosotros. Esto lo hacemos entre todos.', cierre: 'Si aún no estás, te esperamos: enlace en la bio (pokedoc.es).', tipo: 'hito' }),
      diapositivas: [{ pintor: 'hito', datos: { numero, frase: que.frase, que: que.varios } }],
    })
  }
  return salen
}

// ── «Hoy toca» ── (1337): un plan para cada día de la semana, para no
// pensar qué sacar. Lo que hay ese día en «Sin compartir» de ese tipo es lo
// que se propone.
export const PLAN_SEMANA = [
  { dia: 'domingo', tipos: ['novedades', 'hito'], texto: 'lo nuevo de la web o un hito' },
  { dia: 'lunes', tipos: ['meta'], texto: 'el meta de la semana' },
  { dia: 'martes', tipos: ['guia'], texto: 'una guía (en carrusel)' },
  { dia: 'miércoles', tipos: ['precios'], texto: 'las cartas que más suben' },
  { dia: 'jueves', tipos: ['evento'], texto: 'los eventos del finde' },
  { dia: 'viernes', tipos: ['lanzamiento', 'torneo'], texto: 'un lanzamiento o un torneo' },
  { dia: 'sábado', tipos: ['torneo', 'noticia'], texto: 'resultados de torneos o una noticia' },
]

export function hoyToca(ahora = new Date()) {
  const d = new Date(`${hoyEnEspana(ahora)}T12:00:00Z`).getUTCDay()
  return PLAN_SEMANA[d]
}

// ── Lo compartido ──
// Las filas de `redes_compartido` en un mapa clave → { x, instagram } (la
// fecha de cada red, o nada).
export function hechosDe(filas = []) {
  const m = new Map()
  for (const f of filas || []) {
    if (!f?.clave || !REDES[f.red]) continue
    m.set(f.clave, { ...(m.get(f.clave) || {}), [f.red]: f.hecho_at || true })
  }
  return m
}

// «Sin compartir» es que le falta ALGUNA de las dos redes: PINGU saca cada
// cosa en X y en Instagram, y una que solo salió en X sigue pendiente.
export const faltaAlgo = (pieza, hechos) => {
  const h = hechos?.get(pieza.clave) || {}
  return !h.x || !h.instagram
}

export function filtrarPiezas(piezas, filtro = 'todo', hechos = new Map()) {
  if (filtro === 'sin') return piezas.filter((p) => faltaAlgo(p, hechos))
  // «Hoy toca» (1337): lo de los tipos del día que aún falta.
  if (filtro === 'hoy') {
    const tipos = hoyToca().tipos
    return piezas.filter((p) => tipos.includes(p.tipo) && faltaAlgo(p, hechos))
  }
  if (TIPOS[filtro]) return piezas.filter((p) => p.tipo === filtro)
  return piezas
}

// Lo más nuevo arriba; lo que no tiene fecha, al final.
export function ordenarPiezas(piezas) {
  const t = (p) => {
    const n = new Date(p.fecha || 0).getTime()
    return Number.isNaN(n) ? 0 : n
  }
  return [...piezas].sort((a, b) => t(b) - t(a))
}

// Cuántas hay en cada filtro, para los números de las pestañas.
export function cuentasDe(piezas, hechos) {
  const c = { todo: piezas.length, sin: piezas.filter((p) => faltaAlgo(p, hechos)).length, hoy: filtrarPiezas(piezas, 'hoy', hechos).length }
  for (const k of Object.keys(TIPOS)) c[k] = piezas.filter((p) => p.tipo === k).length
  return c
}
