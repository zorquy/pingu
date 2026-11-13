// /sobre (tanda 1326, D1 del plan 2027), la parte PURA: las cuatro cifras, el
// equipo y la línea del tiempo. Sin DOM ni red: se prueba con node.
//
// Las cifras y el equipo salen de `sobre_cifras()` (migración 1326); la línea
// del tiempo, de `/novedades.json`, que es lo mismo que pinta /novedades, así
// que no hay una segunda historia que mantener.

import { escapeHtml } from './html.js'
import { entradasValidas, nombreDeMes } from './novedades-datos.js'

// Con punto de miles SIEMPRE: el es-ES de los navegadores no lo pone a las de
// cuatro cifras («1234 personas» al lado de «48.210 cartas»).
const numero = (n) => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')

// El orden es el de la frase de arriba: quién, qué tiene, de qué habla, a qué juega.
export const CIFRAS = [
  { clave: 'personas', uno: 'persona', varios: 'personas', enlace: '/usuarios' },
  { clave: 'cartas', uno: 'carta apuntada', varios: 'cartas apuntadas', enlace: '/cartas' },
  { clave: 'temas', uno: 'tema en el foro', varios: 'temas en el foro', enlace: '/foro' },
  { clave: 'torneos', uno: 'torneo jugado', varios: 'torneos jugados', enlace: '/torneos' },
]

// Sin datos (sin la migración, o sin red) no se pinta NADA: «0 personas» en la
// página que se enseña a la prensa sería mentir (la 319: no se sabe ≠ cero).
export function cifrasHtml(c) {
  if (!c || CIFRAS.some((x) => typeof c[x.clave] !== 'number' && typeof c[x.clave] !== 'string')) return ''
  return CIFRAS.map((x) => {
    const n = Number(c[x.clave]) || 0
    return `<a class="sobre-cifra" href="${x.enlace}"><strong>${numero(n)}</strong><span>${n === 1 ? x.uno : x.varios}</span></a>`
  }).join('')
}

// El rango que se enseña: el más alto, y Redacción aparte porque se puede ser
// moderador Y escribir noticias (y lo segundo también dice quién eres).
export function papelesDe(p) {
  const r = []
  if (p?.is_admin) r.push('Administración')
  else if (p?.is_moderator) r.push('Moderación')
  if (p?.is_writer) r.push('Redacción')
  return r
}

// `estilo(p)` y `enlace(p)` los da la página (avatarStyle y profileUrl de
// app.js, que importa Supabase y no entra en node).
export function equipoHtml(equipo, { estilo = () => '', enlace = (p) => `/usuario/${encodeURIComponent(p.username || '')}` } = {}) {
  const lista = (Array.isArray(equipo) ? equipo : []).filter((p) => p && p.username && papelesDe(p).length)
  if (!lista.length) return ''
  return lista.map((p) => {
    const nombre = p.display_name || p.username
    const inicial = escapeHtml(String(nombre).trim().charAt(0).toUpperCase())
    return `<a class="sobre-persona" href="${escapeHtml(enlace(p))}">
      <span class="sobre-avatar" style="${escapeHtml(estilo(p))}">${p.avatar_url ? '' : inicial}</span>
      <span class="sobre-persona-txt"><strong>${escapeHtml(nombre)}</strong><span>@${escapeHtml(p.username)}</span></span>
      <span class="sobre-papeles">${papelesDe(p).map((x) => `<span class="sobre-papel">${x}</span>`).join('')}</span>
    </a>`
  }).join('')
}

// Una entrada de /novedades es una frase larga; en la línea del tiempo va lo de
// antes de los dos puntos o la primera frase, recortada.
export function frasecorta(texto, tope = 90) {
  const t = String(texto || '').trim()
  const dos = t.indexOf(':')
  let f = dos > 12 && dos <= tope ? t.slice(0, dos) : t.split(/(?<=[.!?])\s/)[0]
  if (f.length > tope) f = f.slice(0, tope).replace(/\s+\S*$/, '') + '…'
  return f.replace(/[.]$/, '')
}

// Por meses, el más nuevo arriba: cuántos cambios y tres hitos (las destacadas
// de ese mes si las hay; si no, lo NUEVO de ese mes, en el orden del fichero).
export function lineaDelTiempo(novedades, { hitos = 3 } = {}) {
  const entradas = entradasValidas(novedades?.entradas)
  const destacadas = (Array.isArray(novedades?.destacadas) ? novedades.destacadas : []).filter((d) => d && d.titulo && /^\d{4}-\d{2}$/.test(String(d.mes)))
  const meses = new Map()
  for (const e of entradas) {
    const mes = e.fecha.slice(0, 7)
    if (!meses.has(mes)) meses.set(mes, [])
    meses.get(mes).push(e)
  }
  return [...meses.keys()].sort((a, b) => b.localeCompare(a)).map((mes) => {
    const es = meses.get(mes)
    const des = destacadas.filter((d) => d.mes === mes).slice(0, hitos).map((d) => ({ texto: d.titulo, enlace: d.enlace || null }))
    const lista = des.length ? des : es.filter((e) => e.tipo === 'nuevo').slice(0, hitos).map((e) => ({ texto: frasecorta(e.texto), enlace: e.enlace || null }))
    return { mes, rotulo: `${nombreDeMes(mes)} de ${mes.slice(0, 4)}`, cambios: es.length, hitos: lista }
  })
}

export function lineaDelTiempoHtml(meses) {
  if (!meses?.length) return ''
  return meses.map((m) => `<li class="sobre-mes">
      <p class="sobre-mes-cab"><strong>${escapeHtml(m.rotulo.charAt(0).toUpperCase() + m.rotulo.slice(1))}</strong> <span>${numero(m.cambios)} ${m.cambios === 1 ? 'cambio' : 'cambios'}</span></p>
      <ul>${m.hitos.map((h) => `<li>${h.enlace ? `<a href="${escapeHtml(h.enlace)}">${escapeHtml(h.texto)}</a>` : escapeHtml(h.texto)}</li>`).join('')}</ul>
    </li>`).join('')
}
