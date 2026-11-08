// Las cifras del perfil (743, J4; desde la 867, cinco iguales): cartas,
// guías y torneos aquí, y seguidores y siguiendo ya escritos en el HTML. Las
// mismas en tu perfil y en el que ven los demás, y con UNA definición (la
// 628: si dos pantallas cuentan lo mismo, lo cuenta una función). Pegado a
// «Guías», a cuántos les han servido (974; antes era la media de estrellas):
// es lo que escribes, no una nota puesta a ti. La racha ya no es una cifra: es un estado, y va en la línea
// de la cabecera con el nivel y el rango.
//
// Cada cifra lleva a un sitio: Cartas a tu colección (y a la de otro si la
// tiene pública, 944: `coleccion`), Guías y Torneos a su pestaña. Lo que no se ha
// podido contar sale «—», no un cero (la 319): la RLS de otra persona puede
// no dejar contar su colección o sus torneos, y un cero diría que no tiene
// ninguno.
import { escapeHtml } from './html.js'
import { icons } from './icons.js'

// La colección entera de alguien, en la vista con buscador y filtros (944).
export const urlDeColeccion = (username) => `/mi-coleccion?u=${encodeURIComponent(username)}&ver=cartas`

const n = (v) => (typeof v === 'number' && Number.isFinite(v) ? v.toLocaleString('es-ES', { useGrouping: 'always' }) : '—')

// Puro: lo prueba node.
// DESDE LA 1270, TRES LOSAS (PINGU eligió lo recomendado: «cartas, guías y
// torneos es muy importante mostrarlo»): cada una con su dibujo, la cifra
// grande y una línea debajo, del color de su sección. Siguen siendo
// `.perfil-cifra` con `.valor` y `.rotulo` (lo que las pruebas y la caché de
// la 984 conocen); seguidores y siguiendo ya no van aquí, van en caras
// (`pintarSocial`, perfil-cabecera.js). En el PC la de la colección se llena
// con tres cartas de la vitrina (`ponerCartasEnLosa`).
export function cifrasHtml({ cartas = null, guias = null, servido = null, torneos = null, propia = false, coleccion = '' } = {}) {
  const conServido = typeof servido === 'number' && servido > 0
  const losa = (seccion, icono, valor, rotulo, { href = '', ver = '', title = '', nota = '' } = {}) => {
    const dentro = `<span class="perfil-losa-dib" aria-hidden="true">${icono}</span><span class="perfil-losa-t"><span class="rotulo">${rotulo}</span><span class="valor">${valor}</span>${nota}</span>`
    const t = title ? ` title="${escapeHtml(title)}"` : ''
    const attrs = `class="perfil-cifra perfil-losa" data-losa="${seccion}"${t}`
    if (href) return `<a ${attrs} href="${escapeHtml(href)}">${dentro}</a>`
    if (ver) return `<button type="button" ${attrs} data-ver="${ver}">${dentro}</button>`
    return `<div ${attrs}>${dentro}</div>`
  }
  const notaServido = conServido ? `<small class="perfil-cifra-nota">${icons.sprout(12)} le han servido a ${n(servido)}</small>` : ''
  return (
    losa('cartas', icons.cards(20), n(cartas), 'Cartas', { href: propia ? '/mi-coleccion' : coleccion, nota: `<small class="perfil-losa-sub">en ${propia ? 'tu' : 'su'} colección</small>` }) +
    losa('aprender', icons.bookOpen(20), n(guias), 'Guías', {
      ver: 'guides',
      title: conServido ? (servido === 1 ? 'A 1 persona le han servido sus guías' : `A ${n(servido)} personas les han servido sus guías`) : '',
      nota: notaServido || '<small class="perfil-losa-sub">publicadas</small>',
    }) +
    losa('jugar', icons.trophy(20), n(torneos), 'Torneos', { ver: 'torneos', nota: '<small class="perfil-losa-sub">jugados</small>' })
  )
}

// La losa de la colección con tres cartas de la vitrina en abanico, en vez del
// icono (1270): «es más visual». Se copian las fotos ya cargadas; sin vitrina,
// se queda el icono.
export function ponerCartasEnLosa(lote, vitrina) {
  const dib = lote?.querySelector('[data-losa="cartas"] .perfil-losa-dib')
  const fotos = [...(vitrina?.querySelectorAll('img') || [])].map((i) => i.currentSrc || i.src).filter(Boolean).slice(0, 3)
  if (!dib || !fotos.length) return
  dib.classList.add('perfil-losa-abanico')
  dib.innerHTML = fotos.map((src) => `<img src="${escapeHtml(src)}" alt="" width="28" height="39" loading="lazy" decoding="async">`).join('')
}

// Cuántas cartas distintas tiene en su colección y en cuántos torneos se ha
// apuntado. `null` si no se ha podido preguntar.
export async function contarCartasYTorneos(supabase, userId) {
  const cuenta = async (consulta) => {
    try {
      const { count, error } = await consulta
      return error ? null : count ?? null
    } catch {
      return null
    }
  }
  const [cartas, torneos] = await Promise.all([
    cuenta(supabase.from('user_collection').select('id', { count: 'exact', head: true }).eq('user_id', userId)),
    cuenta(supabase.from('tournament_registrations').select('tournament_id', { count: 'exact', head: true }).eq('user_id', userId)),
  ])
  return { cartas, torneos }
}
