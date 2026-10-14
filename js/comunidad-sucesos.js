// Lo que pasa en la comunidad, en una línea por suceso (tanda 845). Lo usan
// la portada («En la comunidad», seis) y la pestaña Actividad de /usuarios
// (con filtros y «Ver más»): PINGU vio que en la portada salían más cosas que
// en Actividad, y es porque cada una tenía su lista. Ahora es una.
//
// Junta dos orígenes: lo de siempre (`loadActivity`, js/activity.js: guías,
// cursos, lecturas, comentarios, temas, altas, peticiones y noticias) y lo que
// apunta `portada_comunidad` (supabase-migration-portada.sql: días perfectos,
// mazos, campeones, colecciones completas, inscripciones a torneos, a quién
// sigue cada uno, respuestas en el foro y cartas para cambiar). Sin esa
// función, lo de siempre.
//
// Entra por `import()` con su hoja.
import { supabase } from './supabase.js'
import { escapeHtml, avatarStyle, getInitial, profileUrl } from './app.js'
import { icons } from './icons.js'
import { hojaInyectada } from './hoja.js'
import { rutaDeArticulo } from './articulos.js'
import { haceCuanto } from './foro-comun.js'
import { atributosDeRango } from './rangos.js'

export const hoja = typeof document !== 'undefined' ? hojaInyectada('css/comunidad-sucesos.css') : Promise.resolve()

const ic = (n, t = 16) => icons[n]?.(t) || ''
const nombre = (p) => p?.display_name || p?.username || 'Alguien'
const enlace = (href, texto) => `<a href="${href}">${escapeHtml(texto || '')}</a>`

// Qué dice cada suceso y con qué icono y color. `grupo` es el filtro de
// /usuarios en el que cae.
export const SUCESOS = {
  perfecto: { grupo: 'retos', icono: 'crown', tono: 'verde', texto: () => `hizo los seis ${enlace('/retos', 'retos')} del día` },
  campeon: { grupo: 'torneos', icono: 'trophy', tono: 'ambar', texto: (d) => `ganó el torneo ${enlace(`/torneo?slug=${encodeURIComponent(d.slug)}`, d.nombre)}` },
  inscripcion: { grupo: 'torneos', icono: 'trophy', tono: 'cian', texto: (d) => `se apuntó a ${enlace(`/torneo?slug=${encodeURIComponent(d.slug)}`, d.nombre)}` },
  mazo: { grupo: 'mazos', icono: 'layers', tono: 'morado', texto: (d) => `compartió su mazo ${enlace(`/constructor.html?mazo=${encodeURIComponent(d.id)}`, d.nombre || 'sin nombre')}` },
  coleccion: { grupo: 'coleccion', icono: 'cards', tono: 'rosa', texto: (d) => `completó ${enlace(`/cartas.html?ver=album&set=${encodeURIComponent(d.set)}&catalogo=${encodeURIComponent(d.market || 'WEST')}`, d.nombre)}` },
  cambio: { grupo: 'coleccion', icono: 'refreshCw', tono: 'rosa', texto: (d) => `tiene ${d.cartas === 1 ? 'una carta' : `${d.cartas} cartas`} para ${enlace('/mi-coleccion.html?ver=mercado', 'cambiar')}` },
  tema: { grupo: 'foro', icono: 'messageSquare', tono: 'cian', texto: (d) => `abrió el tema ${d.enlace}` },
  respuesta: { grupo: 'foro', icono: 'messageSquare', tono: 'azul', texto: (d) => `respondió en ${enlace(`/tema/${encodeURIComponent(d.id)}`, d.titulo)}` },
  guia: { grupo: 'guias', icono: 'bookOpen', tono: 'azul', texto: (d) => `publicó la guía ${d.enlace}` },
  guia_enviada: { grupo: 'guias', icono: 'edit', tono: 'azul', texto: (d) => `envió a revisión ${d.enlace}` },
  curso: { grupo: 'guias', icono: 'graduationCap', tono: 'verde', texto: (d) => `terminó el curso ${d.enlace}` },
  lectura: { grupo: 'guias', icono: 'bookOpen', tono: 'azul', texto: (d) => `se leyó ${d.enlace}` },
  comentario: { grupo: 'guias', icono: 'messageSquare', tono: 'cian', texto: (d) => `comentó en ${d.enlace}` },
  peticion: { grupo: 'guias', icono: 'helpCircle', tono: 'ambar', texto: (d) => `pidió una guía sobre ${d.enlace}` },
  alta: { grupo: 'gente', icono: 'user', tono: 'morado', texto: () => 'se unió a PokeDoc' },
  sigue: { grupo: 'gente', icono: 'users', tono: 'morado', texto: (d) => `empezó a seguir a ${d.username ? `<a href="${profileUrl(d)}"${atributosDeRango(d)}>${escapeHtml(d.display_name || d.username)}</a>` : 'alguien'}` },
  // Una noticia es del SITIO, no de quien la teclea (la 289): sin cara ni
  // nombre, con la chapa «Noticia».
  noticia: { grupo: 'guias', icono: 'newspaper', tono: 'azul', casa: 'Noticia', texto: (d) => d.enlace },
}

// Los filtros de /usuarios, en este orden.
export const FILTROS = [
  ['', 'Todo'],
  ['retos', 'Retos'],
  ['torneos', 'Torneos'],
  ['coleccion', 'Colección'],
  ['mazos', 'Mazos'],
  ['foro', 'Foro'],
  ['guias', 'Guías'],
  ['gente', 'Gente'],
]

// Los dos orígenes en una lista de { tipo, fecha, perfil, datos }, lo más
// nuevo primero. Puro.
export function sucesosDeLaComunidad(actividad = [], nuevos = []) {
  const deSiempre = (actividad || [])
    .filter((e) => SUCESOS[e.tipo] && (e.perfil || SUCESOS[e.tipo].casa))
    .map((e) => ({
      tipo: e.tipo,
      fecha: e.fecha,
      perfil: e.perfil || null,
      datos: {
        enlace: e.guia
          ? enlace(rutaDeArticulo(e.guia.kind, e.guia.slug), e.guia.title)
          : e.enlace && e.texto
            ? enlace(e.enlace, e.texto)
            : e.texto
              ? enlace('/usuarios.html#peticiones', e.texto)
              : '',
      },
    }))
  const deLaBase = (nuevos || [])
    .filter((e) => SUCESOS[e.tipo] && !SUCESOS[e.tipo].casa)
    .map((e) => ({ tipo: e.tipo, fecha: e.fecha, perfil: { username: e.username, display_name: e.display_name, avatar_url: e.avatar_url, is_admin: e.is_admin, is_moderator: e.is_moderator }, datos: e.datos || {} }))
  return [...deLaBase, ...deSiempre].sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)))
}

// La cara, sin enlace: al lado va el nombre, que sí lo lleva (la 312).
const caraHtml = (p) => `<span class="suc-cara" style="${avatarStyle(p)}" aria-hidden="true">${p?.avatar_url ? '' : escapeHtml(getInitial(nombre(p)))}</span>`
const quienHtml = (p) =>
  p?.username ? `<b class="suc-quien"><a href="${profileUrl(p)}"${atributosDeRango(p)}>${escapeHtml(nombre(p))}</a></b>` : `<b class="suc-quien">${escapeHtml(nombre(p))}</b>`

export function sucesoHtml(s) {
  const t = SUCESOS[s.tipo]
  const cuando = `<small class="suc-cuando">· ${escapeHtml(haceCuanto(s.fecha))}</small>`
  if (t.casa) {
    return `<li class="suc suc-de-la-casa"><span class="suc-cara suc-cara-casa" aria-hidden="true">${ic(t.icono, 16)}</span><p><span class="suc-chapa">${escapeHtml(t.casa)}</span> ${t.texto(s.datos)} ${cuando}</p></li>`
  }
  return `<li class="suc"><span class="suc-cara-caja">${caraHtml(s.perfil)}<span class="suc-ic tono-${t.tono}" aria-hidden="true">${ic(t.icono, 10)}</span></span><p>${quienHtml(s.perfil)} ${t.texto(s.datos)} ${cuando}</p></li>`
}

export const listaHtml = (sucesos, { dos = false } = {}) => `<ul class="suc-lista${dos ? ' dos' : ''}">${sucesos.map(sucesoHtml).join('')}</ul>`

// Lo pide todo a la vez. `fallos` dice si alguna fuente no contestó: con eso
// quien pinta distingue «no hay nada» de «no se ha podido mirar» (la 510).
export async function cargarSucesos(limite = 12) {
  const [{ loadActivity }, nuevos] = await Promise.all([
    import('./activity.js'),
    supabase.rpc('portada_comunidad', { p_limite: limite }).then(({ data, error }) => (error ? null : data || [])),
  ])
  const actividad = await loadActivity(limite)
  return { actividad: actividad.eventos, nuevos: nuevos || [], fallos: actividad.fallos || [] }
}

// La pestaña Actividad de /usuarios: filtros por tipo, 20 cada vez y «Ver más».
const POR_VEZ = 20
export async function montarActividad(caja) {
  if (!caja) return
  const [{ actividad, nuevos, fallos }] = await Promise.all([cargarSucesos(60), hoja])
  const todos = sucesosDeLaComunidad(actividad, nuevos)
  if (!todos.length) {
    caja.innerHTML = `<p class="empty-state">${fallos.length ? 'No se ha podido cargar la actividad ahora mismo. Inténtalo en un momento.' : 'Todavía no hay actividad. ¡Sé el primero!'}</p>`
    return
  }
  let filtro = ''
  let cuantos = POR_VEZ
  const hay = new Set(todos.map((s) => SUCESOS[s.tipo].grupo))
  const pintar = () => {
    const visibles = todos.filter((s) => !filtro || SUCESOS[s.tipo].grupo === filtro)
    caja.innerHTML = `
      <div class="suc-filtros" role="group" aria-label="Qué ver">${FILTROS.filter(([g]) => !g || hay.has(g))
        .map(([g, n]) => `<button type="button" class="suc-filtro${g === filtro ? ' activo' : ''}" data-suc-filtro="${g}" aria-pressed="${g === filtro}">${n}</button>`)
        .join('')}</div>
      ${listaHtml(visibles.slice(0, cuantos), { dos: true })}
      ${visibles.length > cuantos ? `<button type="button" class="btn-secondary suc-mas" data-suc-mas>Ver más (${visibles.length - cuantos})</button>` : ''}`
  }
  pintar()
  caja.addEventListener('click', (e) => {
    const f = e.target.closest('[data-suc-filtro]')
    if (f) {
      filtro = f.dataset.sucFiltro
      cuantos = POR_VEZ
      pintar()
      caja.querySelector(`[data-suc-filtro="${filtro}"]`)?.focus()
      return
    }
    if (e.target.closest('[data-suc-mas]')) {
      cuantos += POR_VEZ
      pintar()
    }
  })
}

// «Lo que acaba de pasar», la caja de la lateral de /usuarios: los cinco
// últimos, con el mismo molde.
export async function montarUltimo(caja, cuantos = 5) {
  if (!caja) return
  try {
    const [{ actividad, nuevos, fallos }] = await Promise.all([cargarSucesos(12), hoja])
    const s = sucesosDeLaComunidad(actividad, nuevos).slice(0, cuantos)
    caja.innerHTML = s.length
      ? listaHtml(s)
      : `<p class="subtext" style="margin:0">${fallos.length ? 'No hemos podido cargar la actividad.' : 'Todavía no ha pasado nada por aquí.'}</p>`
  } catch {
    caja.innerHTML = '<p class="subtext" style="margin:0">No hemos podido cargar la actividad.</p>'
  }
}
