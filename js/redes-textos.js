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

export const SITIO = 'https://pokedoc.es'

// Los tipos, en el orden de los filtros del panel. Las tandas que añadan
// piezas (eventos, lanzamientos, meta…) añaden su tipo aquí.
export const TIPOS = {
  noticia: { nombre: 'Noticias', chapa: 'Noticia' },
  guia: { nombre: 'Guías', chapa: 'Guía' },
  torneo: { nombre: 'Torneos', chapa: 'Torneo' },
}
export const REDES = { x: 'X', instagram: 'Instagram' }

// Las etiquetas de Instagram: pocas y las que se buscan de verdad. Las de
// siempre van en todas; cada tipo suma las suyas.
const ETIQUETAS_BASE = ['#PokemonTCG', '#PokémonTCG', '#PokeDoc']
const ETIQUETAS = {
  noticia: ['#NoticiasPokémon', '#Pokémon'],
  guia: ['#GuíaPokémon', '#AprendeAJugar'],
  torneo: ['#TorneoPokémon', '#PokémonEspaña'],
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
  const c = { todo: piezas.length, sin: piezas.filter((p) => faltaAlgo(p, hechos)).length }
  for (const k of Object.keys(TIPOS)) c[k] = piezas.filter((p) => p.tipo === k).length
  return c
}
