import { supabase } from './supabase.js'
import { escapeHtml, avatarStyle, getInitial } from './app.js'
import { icons } from './icons.js'
import { hojaInyectada } from './hoja.js'
import { TIPOS, fechaLarga, siglasDe, vanTexto, webSegura } from './eventos-puro.js'
import { candidatosDeRuta, elegirCartaDeRuta, mercadoDeRuta, idDeRutaDeColeccion, filtroDeColeccion, urlDeLogo } from './carta-ruta.js'
import { cadenaDeEscaneo, atributosDeEscaneo } from './escaneo-carta.js'
import { nombreDeCarta, nombreDeSet } from './catalogo-series.js'
import { rarezaDeCarta } from './carta-traducciones.js'
import { euros } from './cardmarket.js'

// Los enlaces INTERNOS pegados "a pelo" en un mensaje o una guía se
// convierten al leerlos en una tarjeta con lo que hay al otro lado — el
// "unfurl" de Discord/Slack, casero y solo para lo nuestro.
//
// Desde la 1416 (PINGU, con la propuesta «Los enlaces de PokeDoc, con su
// vista previa»: «esto sí me gusta, hazlo recomendado»), cualquier cosa de
// PokeDoc: guía o noticia, tema, evento, carta, expansión, perfil, torneo y
// las páginas de la web (/aprender, /foro…). Y de dos formas:
//   · GRANDE si el enlace va solo en su línea: imagen, chapa en el color de
//     su sección, título, entradilla y un pie con el dato útil;
//   · PASTILLA si va en medio de una frase: miniatura y nombre, para no
//     partir el párrafo.
//
// Es DECORACIÓN de lectura, como pintar las listas de cartas: lo guardado
// no cambia (el saneador ni se entera), y solo se toca el enlace cuyo
// TEXTO es la propia dirección — si el autor escribió "míralo aquí", ese
// texto es suyo y se respeta. Lo que no se encuentra se queda como enlace.

// ── Lo puro ──

// Las páginas de la web (las de la tarjeta para redes de la 1201, y tres
// más): su sección, su icono y su frase. Si cambia el texto de una tarjeta
// en netlify/lib/tarjetas-fijas.mjs, cambia aquí (lo mira la prueba 1416).
export const PAGINAS = {
  '/': { sec: 'inicio', icono: 'home', chapa: 'PokeDoc', titulo: 'La comunidad española de Pokémon TCG', texto: 'Tu colección con precios, el foro, torneos, guías y un reto cada día.' },
  '/eventos': { sec: 'comunidad', icono: 'calendar', chapa: 'Eventos', titulo: 'Card shows, trade days y quedadas en España', texto: 'La agenda de Pokémon TCG, y quién de PokeDoc va a cada uno.' },
  '/foro': { sec: 'comunidad', icono: 'messageSquare', chapa: 'Foro', titulo: 'El foro de Pokémon TCG en español', texto: 'Mazos, colecciones, cambios, dudas de reglas y lo que salga.' },
  '/cartas': { sec: 'cartas', icono: 'cards', chapa: 'Cartas', titulo: 'Todas las cartas de Pokémon TCG, con su precio', texto: 'Cada expansión, en español y japonés, con el precio de Cardmarket por idioma.' },
  '/aprender': { sec: 'aprender', icono: 'graduationCap', chapa: 'Aprender', titulo: 'Aprende de Pokémon TCG', texto: 'Guías y cursos de la comunidad para jugar y coleccionar, desde cero.' },
  '/noticias': { sec: 'inicio', icono: 'newspaper', chapa: 'Noticias', titulo: 'Noticias de Pokémon TCG en español', texto: 'Lanzamientos, torneos y todo lo que pasa en el juego.' },
  '/usuarios': { sec: 'comunidad', icono: 'users', chapa: 'Gente', titulo: 'La gente de PokeDoc', texto: 'Coleccionistas y jugadores: qué buscan, qué cambian y qué guías escriben.' },
  '/lanzamientos': { sec: 'inicio', icono: 'calendar', chapa: 'Calendario', titulo: 'Lo que sale de Pokémon TCG', texto: 'El calendario de lanzamientos, en España y en Japón.' },
  '/glosario': { sec: 'aprender', icono: 'bookOpen', chapa: 'Glosario', titulo: 'El diccionario de Pokémon TCG', texto: 'Qué significa cada palabra que se oye en una mesa de juego.' },
  '/constructor': { sec: 'jugar', icono: 'layers', chapa: 'Constructor', titulo: 'Monta tu mazo de Pokémon TCG', texto: 'Con las cartas legales, sus precios y lo que juega el meta.' },
  '/meta': { sec: 'jugar', icono: 'trendingUp', chapa: 'Meta', titulo: 'Los mazos que ganan ahora', texto: 'El meta de Pokémon TCG, con las listas de los torneos.' },
  '/laboratorio': { sec: 'jugar', icono: 'target', chapa: 'Laboratorio', titulo: 'Prueba tu mazo antes del torneo', texto: 'Roba manos, mira las probabilidades y juega turnos de prueba.' },
  '/novedades': { sec: 'inicio', icono: 'sparkles', chapa: 'Novedades', titulo: 'Lo nuevo de PokeDoc', texto: 'Cada cosa que añadimos o arreglamos, mes a mes.' },
  '/tiendas': { sec: 'comunidad', icono: 'store', chapa: 'Tiendas', titulo: 'Las tiendas de PokeDoc', texto: 'Su escaparate, sus precios y cuáles tienen lo que buscas.' },
  '/para-tiendas': { sec: 'comunidad', icono: 'store', chapa: 'Para tiendas', titulo: 'Tu inventario, ordenado y a mano', texto: 'Tu stock carta a carta, el mostrador en el móvil y tu escaparate.' },
  '/colabora': { sec: 'comunidad', icono: 'heart', chapa: 'Colabora', titulo: 'Ayúdanos a hacer PokeDoc', texto: 'Escribe guías, corrige cartas o cuéntanos qué falta.' },
  '/sobre': { sec: 'inicio', icono: 'info', chapa: 'PokeDoc', titulo: 'Qué es PokeDoc', texto: 'La comunidad en español de Pokémon TCG: colección, foro, torneos y guías.' },
  '/torneos': { sec: 'jugar', icono: 'trophy', chapa: 'Torneos', titulo: 'Torneos de Pokémon TCG en PokeDoc', texto: 'Apúntate, juega tus rondas y mira la clasificación en directo.' },
  '/retos': { sec: 'aprender', icono: 'flame', chapa: 'Retos', titulo: 'Un reto de Pokémon TCG cada día', texto: 'Adivina la carta, la silueta o la más cara, y sube en la liga.' },
  '/mi-coleccion': { sec: 'cartas', icono: 'cards', chapa: 'Mi colección', titulo: 'Tu colección de Pokémon TCG, con su precio', texto: 'Apunta tus cartas, monta tus álbumes y mira lo que vale.' },
}

// Qué es una dirección nuestra: `{ tipo, clave }` o null.
export function destinoDe(href, origen = typeof location !== 'undefined' ? location.origin : 'https://pokedoc.es') {
  let url
  try {
    url = new URL(href, origen)
  } catch {
    return null
  }
  const propio = url.host === new URL(origen).host || /(^|\.)pokedoc\.es$/.test(url.host)
  if (!propio) return null
  const ruta = url.pathname.replace(/\.html$/, '').replace(/\/index$/, '/').replace(/(.)\/$/, '$1')
  let m
  if ((m = ruta.match(/^\/tema\/([^/]+)$/))) return { tipo: 'tema', clave: decodeURIComponent(m[1]) }
  if (ruta === '/tema' && url.searchParams.get('t')) return { tipo: 'tema', clave: url.searchParams.get('t') }
  if ((m = ruta.match(/^\/eventos\/([a-z0-9-]+)$/))) return { tipo: 'evento', clave: m[1] }
  if ((m = ruta.match(/^\/(?:guia|noticias|curso)\/([^/]+)$/))) return { tipo: 'guia', clave: decodeURIComponent(m[1]) }
  if (/^\/(?:guia|curso)$/.test(ruta) && url.searchParams.get('slug')) return { tipo: 'guia', clave: url.searchParams.get('slug') }
  if (/^\/carta\/[^/]+$/.test(ruta)) return { tipo: 'carta', clave: ruta, mercado: mercadoDeRuta(url.search) }
  if ((m = ruta.match(/^\/coleccion\/([^/]+)$/))) return { tipo: 'expansion', clave: idDeRutaDeColeccion(ruta) || m[1] }
  if ((m = ruta.match(/^\/(?:usuario|tiendas)\/([^/]+)$/))) return { tipo: 'perfil', clave: decodeURIComponent(m[1]) }
  if (ruta === '/usuario' && url.searchParams.get('u')) return { tipo: 'perfil', clave: url.searchParams.get('u') }
  if (ruta === '/torneo' && url.searchParams.get('slug')) return { tipo: 'torneo', clave: url.searchParams.get('slug') }
  if (PAGINAS[ruta] && !url.search) return { tipo: 'pagina', clave: ruta }
  return null
}

// ¿El texto del enlace es la propia dirección? Un enlace con texto puesto
// por el autor no se toca.
export function esEnlaceDesnudo(texto, href, origen) {
  const t = String(texto || '').trim()
  if (!t) return false
  const h = String(href || '').trim()
  if (t === h) return true
  const pelar = (s) => {
    try {
      const conProto = /^[a-z]+:\/\//i.test(s) || s.startsWith('/') ? s : `https://${s}`
      return new URL(conProto, origen).href.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')
    } catch {
      return s
    }
  }
  if (!/^(https?:\/\/|\/|(www\.)?pokedoc\.es)/i.test(t)) return false
  return pelar(t) === pelar(h)
}

// Una dirección nuestra suelta en el texto: con o sin «https://».
export const URL_EN_TEXTO = /(?:https?:\/\/[^\s<>"')]+|\b(?:www\.)?pokedoc\.es(?:\/[^\s<>"')]*)?)/gi
// Lo que se lleva el punto o la coma final de una frase no es de la dirección.
export const limpiarFinal = (u) => u.replace(/[.,;:!?»]+$/, '')

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`
const fechaCorta = (iso) => new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })

// ── El dibujo ──
// `d` = { sec, icono, chapa, titulo, texto, pie, img }; img = { tipo, … }.

const SECCIONES = ['inicio', 'comunidad', 'cartas', 'aprender', 'jugar']
const ic = (n, t) => (icons[n] || icons.link)(t)

function imagenHtml(d) {
  const i = d.img || { tipo: 'icono' }
  if (i.tipo === 'portada') return `<span class="ep-img ep-img-portada"><img src="${escapeHtml(i.src)}" alt="" loading="lazy" decoding="async"></span>`
  if (i.tipo === 'emoji') return `<span class="ep-img ep-img-icono"><b class="ep-emoji">${escapeHtml(i.emoji)}</b></span>`
  if (i.tipo === 'carta') return `<span class="ep-img ep-img-carta">${i.attrs ? `<img ${i.attrs} alt="" loading="lazy">` : ''}</span>`
  if (i.tipo === 'logo') return `<span class="ep-img ep-img-logo"${i.color ? ` style="--ev-color:${i.color}"` : ''}>${i.src ? `<img src="${escapeHtml(i.src)}" alt="" loading="lazy" onerror="this.remove()">` : ''}<b>${escapeHtml(i.siglas || '')}</b></span>`
  if (i.tipo === 'set') return `<span class="ep-img ep-img-set">${i.src ? `<img src="${escapeHtml(i.src)}" alt="" loading="lazy" onerror="this.remove()">` : `<b>${escapeHtml(i.nombre || '')}</b>`}</span>`
  if (i.tipo === 'avatar') return `<span class="ep-img ep-img-avatar"><span style="${avatarStyle(i.perfil)}">${i.perfil?.avatar_url ? '' : escapeHtml(getInitial(i.perfil?.display_name || i.perfil?.username || '?'))}</span></span>`
  return `<span class="ep-img ep-img-icono">${ic(d.icono, 52)}<i>PokeDoc</i></span>`
}

export function grandeHtml(d) {
  return `${imagenHtml(d)}<span class="ep-cuerpo"><span class="ep-chapa">${ic(d.icono, 14)}${escapeHtml(d.chapa)}</span><b class="ep-titulo">${escapeHtml(d.titulo)}</b>${d.texto ? `<span class="ep-texto">${escapeHtml(d.texto)}</span>` : ''}${d.pie ? `<span class="ep-pie">${d.pie}</span>` : ''}</span>`
}

export function pastillaHtml(d) {
  const i = d.img || {}
  const mini = i.tipo === 'carta' && i.attrs ? `<img ${i.attrs} alt="">`
    : i.tipo === 'avatar' ? `<span class="ep-mini-av" style="${avatarStyle(i.perfil)}">${i.perfil?.avatar_url ? '' : escapeHtml(getInitial(i.perfil?.display_name || i.perfil?.username || '?'))}</span>`
      : i.tipo === 'logo' ? `<b class="ep-mini-logo"${i.color ? ` style="--ev-color:${i.color}"` : ''}>${escapeHtml((i.siglas || '').slice(0, 2))}</b>`
        : `<span class="ep-mini-ic">${ic(d.icono, 13)}</span>`
  return `${mini}<span class="ep-pastilla-texto">${escapeHtml(d.titulo)}</span>`
}

const cara = (p) => `<span class="ep-av" style="${avatarStyle(p)}">${p?.avatar_url ? '' : escapeHtml(getInitial(p?.display_name || p?.username || '?'))}</span>`
const nombreDe = (p) => p?.display_name || p?.username || ''

// ── Lo que se pregunta (con memoria: el hilo de Mensajes se repinta) ──

const memoria = new Map()
const pedido = (k, f) => {
  if (!memoria.has(k)) memoria.set(k, f().catch(() => undefined))
  return memoria.get(k)
}
const datos = (r) => (r && !r.error ? r.data || [] : [])

async function perfiles(ids) {
  const sin = [...new Set(ids.filter(Boolean))]
  if (!sin.length) return new Map()
  const r = await supabase.from('user_profiles').select('id,username,display_name,avatar_url').in('id', sin)
  return new Map(datos(r).map((p) => [p.id, p]))
}

async function deGuias(slugs) {
  const r = await supabase.from('guides').select('slug,title,description,cover_image,cover_emoji,estimated_mins,kind,author_id,category_id').in('slug', slugs)
  const gs = datos(r)
  const cats = [...new Set(gs.map((g) => g.category_id).filter(Boolean))]
  const [autores, cs] = await Promise.all([
    perfiles(gs.map((g) => g.author_id)),
    cats.length ? supabase.from('categories').select('id,name').in('id', cats).then(datos, () => []) : [],
  ])
  const cat = new Map(cs.map((c) => [c.id, c.name]))
  return new Map(gs.map((g) => {
    const noticia = g.kind === 'news'
    const autor = autores.get(g.author_id)
    const pie = [autor ? `${cara(autor)} ${escapeHtml(nombreDe(autor))}` : '', g.estimated_mins ? `${g.estimated_mins} min de lectura` : ''].filter(Boolean).join(' · ')
    return [g.slug, {
      sec: noticia ? 'inicio' : 'aprender', icono: noticia ? 'newspaper' : 'bookOpen',
      chapa: [noticia ? 'Noticia' : 'Guía', cat.get(g.category_id)].filter(Boolean).join(' · '),
      titulo: g.title, texto: g.description || '', pie,
      img: webSegura(g.cover_image) ? { tipo: 'portada', src: webSegura(g.cover_image) } : g.cover_emoji ? { tipo: 'emoji', emoji: g.cover_emoji } : { tipo: 'icono' },
    }]
  }))
}

async function deTemas(ids) {
  const r = await supabase.from('forum_threads').select('id,title,post_count,author_id,board_id,last_post_at').in('id', ids)
  const ts = datos(r)
  const foros = [...new Set(ts.map((t) => t.board_id).filter(Boolean))]
  const [autores, fs] = await Promise.all([
    perfiles(ts.map((t) => t.author_id)),
    foros.length ? supabase.from('forum_boards').select('id,name').in('id', foros).then(datos, () => []) : [],
  ])
  const foro = new Map(fs.map((f) => [f.id, f.name]))
  return new Map(ts.map((t) => {
    const autor = autores.get(t.author_id)
    const respuestas = Math.max(0, (t.post_count || 1) - 1)
    return [t.id, {
      sec: 'comunidad', icono: 'messageSquare', chapa: ['Foro', foro.get(t.board_id)].filter(Boolean).join(' · '),
      titulo: t.title, texto: '',
      pie: [autor ? `${cara(autor)} ${escapeHtml(nombreDe(autor))}` : '', plural(respuestas, 'respuesta', 'respuestas')].filter(Boolean).join(' · '),
      img: autor ? { tipo: 'avatar', perfil: autor } : { tipo: 'icono' }, imgGrande: { tipo: 'icono' },
    }]
  }))
}

// El principio del primer mensaje de un tema, solo para la tarjeta grande.
async function entradillaDeTema(id) {
  const { data } = await supabase.from('forum_posts').select('body_html').eq('thread_id', id).order('created_at', { ascending: true }).limit(1)
  const html = data?.[0]?.body_html || ''
  const texto = html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim()
  return texto ? `«${texto.slice(0, 180)}${texto.length > 180 ? '…' : ''}»` : ''
}

async function deEvento(slug) {
  const { data, error } = await supabase.rpc('evento_ficha', { p_slug: slug })
  if (error) return null
  // Un evento borrado o sin publicar lo dice (1197): el primer mensaje de su
  // hilo sigue apuntando a él.
  if (!data) return { sec: 'comunidad', icono: 'calendar', chapa: 'Eventos', titulo: 'Este evento ya no está en la agenda', texto: '', pie: '', img: { tipo: 'icono' } }
  const e = data
  const color = /^#[0-9a-f]{6}$/i.test(e.color || '') ? e.color : ''
  const caras = (e.caras || []).slice(0, 3)
  return {
    sec: 'comunidad', icono: 'calendar', chapa: ['Evento', TIPOS[e.tipo]].filter(Boolean).join(' · '),
    titulo: e.nombre, texto: [fechaLarga(e), [e.sitio, e.ciudad].filter(Boolean).join(', ')].filter(Boolean).join(' · '),
    pie: e.van ? `${caras.length ? `<span class="ep-caras">${caras.map(cara).join('')}</span>` : ''} ${escapeHtml(vanTexto(e.van))}` : 'Sé el primero en marcar que vas',
    img: { tipo: 'logo', src: webSegura(e.logo_url), siglas: siglasDe(e), color },
  }
}

const COLUMNAS_CARTA = 'id,market,set_id,local_id,name,name_es,name_en,image_path,image_scrydex,image_tcggo,rarity,rarity_en,tcg_sets(id,name,name_en,serie_id,card_count_official)'
async function deCarta(ruta, mercado) {
  const ids = candidatosDeRuta(ruta)
  if (!ids.length) return null
  const { data } = await supabase.from('tcg_cards').select(COLUMNAS_CARTA).in('id', ids).limit(10)
  const c = elegirCartaDeRuta(data || [], mercado)
  if (!c) return null
  const { data: p } = await supabase.from('tcg_card_prices').select('card_id,cm_trend,cm_low').eq('card_id', c.id).maybeSingle().then((r) => r, () => ({}))
  const precio = Number(p?.cm_trend || p?.cm_low) || 0
  const oficial = Number(c.tcg_sets?.card_count_official) || 0
  return {
    sec: 'cartas', icono: 'cards', chapa: ['Carta', nombreDeSet(c.tcg_sets) || c.set_id].filter(Boolean).join(' · '),
    titulo: nombreDeCarta(c), texto: [oficial && /^\d+$/.test(String(c.local_id)) ? `${c.local_id}/${oficial}` : c.local_id, rarezaDeCarta(c)].filter(Boolean).join(' · '),
    pie: precio ? `<b class="ep-precio">${escapeHtml(euros(precio))}</b> en Cardmarket` : '',
    img: { tipo: 'carta', attrs: atributosDeEscaneo(cadenaDeEscaneo(c, null, 'low')) },
    id: c.id,
  }
}

// Cuántos de PokeDoc la dan para cambio: solo para la tarjeta grande.
async function laDan(id) {
  const { data, error } = await supabase.rpc('coleccion_quien_la_tiene_todos', { p_card_id: id, p_limite: 50 })
  if (error) return 0
  return (data || []).filter((f) => Number(f.da) > 0).length
}

async function deExpansion(clave) {
  const { data } = await supabase.from('tcg_sets').select('id,name,name_en,serie_name,logo_path,logo_tcggo,logo_scrydex,release_date,card_count_total,card_count_official,tcg_online_code')
    .or(filtroDeColeccion(clave)).eq('market', 'WEST').limit(1)
  const s = data?.[0]
  if (!s) return null
  const total = s.card_count_total || s.card_count_official
  return {
    sec: 'cartas', icono: 'layers', chapa: ['Expansión', s.serie_name].filter(Boolean).join(' · '),
    titulo: nombreDeSet(s) || s.name, texto: [total ? plural(total, 'carta', 'cartas') : '', s.release_date ? `salió el ${fechaCorta(s.release_date)}` : ''].filter(Boolean).join(' · '),
    pie: 'Mira cuáles tienes y lo que vale entera',
    img: { tipo: 'set', src: s.logo_tcggo || s.logo_scrydex || urlDeLogo(s.logo_path, 'WEST'), nombre: s.name },
  }
}

async function dePerfil(usuario) {
  const { data } = await supabase.from('user_profiles').select('id,username,display_name,avatar_url,tipo').eq('username', usuario).limit(1)
  const p = data?.[0]
  if (!p) return null
  const tienda = p.tipo === 'tienda'
  return {
    sec: 'comunidad', icono: tienda ? 'store' : 'user', chapa: tienda ? 'Tienda' : 'Perfil',
    titulo: nombreDe(p), texto: `@${p.username}`, pie: tienda ? 'Su escaparate, sus precios y lo que acaba de llegar' : 'Su colección, sus cambios y sus guías',
    img: { tipo: 'avatar', perfil: p },
  }
}

const ESTADO_TORNEO = { registration_open: 'Inscripciones abiertas', registration_closed: 'Inscripciones cerradas', in_progress: 'En juego', running: 'En juego', finished: 'Terminado', cancelled: 'Cancelado' }
async function deTorneo(slug) {
  const { data } = await supabase.from('tournaments').select('id,slug,name,start_at,status,max_players,format').eq('slug', slug).maybeSingle()
  if (!data) return null
  const t = data
  const { count } = await supabase.from('tournament_registrations').select('id', { count: 'exact', head: true }).eq('tournament_id', t.id).eq('status', 'active').then((r) => r, () => ({}))
  const cuando = t.start_at ? new Date(t.start_at).toLocaleString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).replace(/^./, (x) => x.toUpperCase()) : ''
  return {
    sec: 'jugar', icono: 'trophy', chapa: ['Torneo', { standard: 'Estándar', league: 'Liga' }[t.format] || ''].filter(Boolean).join(' · '),
    titulo: t.name, texto: cuando,
    pie: [Number.isFinite(count) && count !== null ? (t.max_players ? `${count} de ${t.max_players} plazas` : plural(count, 'jugador', 'jugadores')) : '', ESTADO_TORNEO[t.status] || ''].filter(Boolean).join(' · '),
    img: { tipo: 'icono' },
  }
}

// Todo lo que hay que saber de unos enlaces, de una vez por tipo.
async function resolver(candidatos) {
  const fuera = new Map()
  const porTipo = (t) => [...new Set(candidatos.filter((c) => c.tipo === t).map((c) => c.clave))]
  const nuevos = (t) => porTipo(t).filter((k) => !memoria.has(`${t}:${k}`))
  // Guías y temas van en lote; lo demás, uno a uno (son pocos por mensaje).
  const lotes = []
  for (const [tipo, f] of [['guia', deGuias], ['tema', deTemas]]) {
    const faltan = nuevos(tipo)
    if (!faltan.length) continue
    const todo = f(faltan).catch(() => new Map())
    for (const k of faltan) memoria.set(`${tipo}:${k}`, todo.then((m) => m.get(k) || null))
    lotes.push(todo)
  }
  await Promise.all(lotes)
  await Promise.all(candidatos.map(async (c) => {
    const k = `${c.tipo}:${c.clave}`
    const f = { evento: () => deEvento(c.clave), carta: () => deCarta(c.clave, c.mercado), expansion: () => deExpansion(c.clave), perfil: () => dePerfil(c.clave), torneo: () => deTorneo(c.clave), pagina: async () => (PAGINAS[c.clave] ? { ...PAGINAS[c.clave], pie: `pokedoc.es${c.clave === '/' ? '' : c.clave}` } : null) }[c.tipo]
    const d = f ? await pedido(k, f) : await memoria.get(k)
    fuera.set(k, d)
  }))
  return fuera
}

// ¿Va solo en su línea? El enlace es lo único que hay en su párrafo (o en el
// trozo entre dos saltos de línea).
export function vaSolo(a) {
  const p = a.parentElement
  if (!p || !/^(P|DIV|LI|BLOCKQUOTE)$/.test(p.tagName)) return false
  const hermanos = [...p.childNodes].filter((n) => n !== a && !(n.nodeType === 3 && !n.nodeValue.trim()) && n.nodeName !== 'BR')
  if (!hermanos.length) return true
  // Entre dos <br>: el texto de antes y el de después acaban en salto.
  const antes = a.previousSibling
  const despues = a.nextSibling
  const limite = (n, lado) => {
    while (n && n.nodeType === 3 && !n.nodeValue.trim()) n = n[lado]
    return !n || n.nodeName === 'BR'
  }
  return limite(antes, 'previousSibling') && limite(despues, 'nextSibling')
}

// ── Montar ──

// Primero: las direcciones internas pegadas como TEXTO plano (sin enlace
// siquiera) se convierten en <a>. Es lo que deja el editor al pegar una URL
// sin enlazarla, y lo que llega de un mensaje privado.
function enlazarTextoPlano(raiz) {
  const paseo = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      if (!n.nodeValue || !/https?:|pokedoc\.es/i.test(n.nodeValue)) return NodeFilter.FILTER_REJECT
      if (n.parentElement?.closest('a, tcg-deck, yt-video, code, pre, button')) return NodeFilter.FILTER_REJECT
      return NodeFilter.FILTER_ACCEPT
    },
  })
  const nodos = []
  while (paseo.nextNode()) nodos.push(paseo.currentNode)
  for (const nodo of nodos) {
    const texto = nodo.nodeValue
    let hubo = false
    const caja = document.createDocumentFragment()
    let desde = 0
    for (const m of texto.matchAll(URL_EN_TEXTO)) {
      const crudo = limpiarFinal(m[0])
      const href = /^https?:\/\//i.test(crudo) ? crudo : `https://${crudo}`
      // Solo direcciones NUESTRAS: enlazar webs ajenas por su cuenta es
      // decisión del autor, no de este módulo.
      if (!destinoDe(href)) continue
      hubo = true
      caja.appendChild(document.createTextNode(texto.slice(desde, m.index)))
      const a = document.createElement('a')
      a.href = href
      a.textContent = crudo
      caja.appendChild(a)
      desde = m.index + crudo.length
    }
    if (!hubo) continue
    caja.appendChild(document.createTextNode(texto.slice(desde)))
    nodo.replaceWith(caja)
  }
}

export async function enriquecerEnlacesInternos(raiz) {
  if (!raiz) return
  enlazarTextoPlano(raiz)
  const candidatos = []
  for (const a of raiz.querySelectorAll('a[href]')) {
    if (a.classList.contains('enlace-tarjeta') || a.closest('.enlace-tarjeta') || !esEnlaceDesnudo(a.textContent, a.getAttribute('href'), location.origin)) continue
    const destino = destinoDe(a.getAttribute('href'))
    if (destino) candidatos.push({ a, ...destino, grande: vaSolo(a) })
  }
  if (!candidatos.length) return
  const [hechos] = await Promise.all([resolver(candidatos), hojaInyectada('css/enlaces.css')])

  // Lo que solo dice la tarjeta grande (una consulta más): la entradilla de
  // un tema y cuántos dan una carta.
  await Promise.all(candidatos.filter((c) => c.grande).map(async (c) => {
    const d = hechos.get(`${c.tipo}:${c.clave}`)
    if (!d) return
    if (c.tipo === 'tema' && d.texto === '') d.texto = await pedido(`tema-texto:${c.clave}`, () => entradillaDeTema(c.clave)) || ''
    if (c.tipo === 'carta' && d.id && !d.contados) {
      d.contados = true
      const n = await pedido(`dan:${d.id}`, () => laDan(d.id)) || 0
      if (n) d.pie = `${d.pie}${d.pie ? ' · ' : ''}${n === 1 ? 'la da 1 de PokeDoc' : `la dan ${n} de PokeDoc`}`
    }
  }))

  for (const c of candidatos) {
    const d = hechos.get(`${c.tipo}:${c.clave}`)
    // Sin datos (borrado, sin permiso o sin red) se queda el enlace como
    // estaba: una tarjeta que dice "no sé qué es" es peor que nada.
    if (!d) continue
    const sec = SECCIONES.includes(d.sec) ? d.sec : 'inicio'
    c.a.classList.add('enlace-tarjeta', 'ep', c.grande ? 'ep-grande' : 'ep-pastilla', `ep-${sec}`, `enlace-${c.tipo}`)
    c.a.dataset.enlace = c.tipo
    c.a.setAttribute('aria-label', `${d.chapa}: ${d.titulo}`)
    c.a.innerHTML = c.grande ? grandeHtml(c.tipo === 'tema' ? { ...d, img: d.imgGrande } : d) : pastillaHtml(d)
  }
}
