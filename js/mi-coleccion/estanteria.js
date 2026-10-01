// Cómo se ordenan las 220 expansiones (tanda 409).
//
// PINGU, mirando la estantería al lado de la app: «deberían estar
// ordenadas por eras, y dentro por año, de las más nuevas a las más
// viejas hacia abajo. Y los sets especiales como los Trainer Kits, los
// POP Series y estas cosas, abajo del todo porque son especiales».
//
// Y una cosa que se QUITA: hasta ahora las que tenías empezadas subían
// solas arriba del todo. PINGU: «arriba solo si la pones como favorito;
// si no, se van a agrupar arriba y no tiene sentido». Tiene razón — con
// cien colecciones empezadas, «arriba» deja de significar nada.
//
// Módulo suelto y sin dependencias: así se puede probar la colocación
// con datos a mano, que es donde están los casos raros (un set sin
// fecha, una serie sin nombre, un set sin serie).

// ── Qué es un set ESPECIAL ──
//
// La lista es de lo ESPECIAL y no de lo normal, y eso es a propósito: lo
// que se queda viejo es la lista, y conviene que al quedarse vieja falle
// por el lado bueno. Si mañana sale una era nueva y la lista fuera de
// «eras de verdad», esa era entera caería al fondo —justo lo más
// buscado—; siendo de especiales, lo que pasa es que una colección de
// promos nueva se cuela en medio, que molesta mucho menos.
const SERIES_ESPECIALES = ['tk', 'pop', 'np']
// Y por el nombre, para los que no traen serie. `\b` a los dos lados y no
// «contiene»: la trampa de siempre es que al barrer por una cadena cuenta
// todo lo que la CONTIENE, y aquí buscamos la PALABRA.
//
// La lista creció en la 415 con lo que PINGU fue viendo: «has metido
// McDonald's Collection entre Espada y Escudo y Escarlata y Púrpura;
// McDonald's también debería ir para abajo porque no es un set como tal.
// Pokémon Futsal también, porque no es un set de Espada y Escudo. Solo
// los sets principales y las promos deberían ir ahí».
//
// Son colaboraciones y productos sueltos: salen con el número de una era
// pero no son de su línea. Y sí, es una lista a mano y se quedará vieja
// —el día que salga otra colaboración se colará en medio—, pero el error
// por ese lado es que una colección rara aparezca entre las buenas, no
// que una ERA entera caiga al fondo.
const NOMBRES_ESPECIALES =
  /\btrainer kit\b|\bpop series\b|\bprerelease\b|\bmcdonald'?s\b|\bfutsal\b|\bbattle academy\b|\btrick or trade\b|\bmy first battle\b|\bholiday calendar\b|\btheme deck\b/i

export function esEspecial(set) {
  if (SERIES_ESPECIALES.includes(String(set?.serie_id || '').toLowerCase())) return true
  return NOMBRES_ESPECIALES.test(String(set?.name || ''))
}

// Los PROMOS de una era no son especiales: son de su era (PINGU, al ver
// la primera versión: «las Black Star Promo de cada era tienen que ir en
// cada era, la primera»). Lo que hacen es irse al FONDO de la suya, que
// es donde cae lo primero que salió. Y se fuerza en vez de confiarlo a la
// fecha porque una colección de promos sigue recibiendo cartas durante
// años: su fecha dice cuándo EMPEZÓ, no dónde va.
const ES_PROMO = /\bpromos?\b/i

export function esPromoDeEra(set) {
  return !esEspecial(set) && ES_PROMO.test(String(set?.name || ''))
}

// El año de un set, para ordenar. Sin fecha no se inventa uno: se va al
// final de su grupo, que es donde menos estorba.
function cuando(set) {
  const d = Date.parse(set?.release_date || '')
  return Number.isNaN(d) ? -Infinity : d
}

const porFecha = (a, b) => cuando(b) - cuando(a)

// Los grupos de la estantería, en el orden en que se pintan.
//
// `favoritos` es un Set de identificadores. Si no hay ninguno, no hay
// grupo de favoritos: un rótulo encima de nada es ruido.
export function gruposDeEstanteria(sets, favoritos = new Set()) {
  const grupos = []
  const favs = sets.filter((s) => favoritos.has(s.id)).sort(porFecha)
  if (favs.length) grupos.push({ id: 'favoritos', titulo: 'Tus favoritas', sets: favs })

  const resto = sets.filter((s) => !favoritos.has(s.id))
  const especiales = resto.filter(esEspecial).sort(porFecha)
  const normales = resto.filter((s) => !esEspecial(s))

  // Por era. El nombre de la serie manda sobre el identificador, pero el
  // identificador es la CLAVE: dos series pueden llamarse igual en dos
  // idiomas y no se pueden juntar por el nombre.
  const porEra = new Map()
  for (const s of normales) {
    const clave = s.serie_id || ''
    if (!porEra.has(clave)) porEra.set(clave, { id: clave, titulo: s.serie_name || s.serie_id || 'Sin serie', sets: [] })
    porEra.get(clave).sets.push(s)
  }
  const eras = [...porEra.values()]
  // Los promos de la era, al fondo; el resto por fecha, lo nuevo arriba.
  for (const e of eras) {
    e.sets.sort((a, b) => (esPromoDeEra(a) ? 1 : 0) - (esPromoDeEra(b) ? 1 : 0) || porFecha(a, b))
  }
  // Una era vale lo que vale su set más nuevo: así «Mega Evolución» sale
  // antes que «Escarlata y Púrpura» sin tener que saberse el orden de las
  // eras de memoria, que es otra lista que se queda vieja.
  // Una era vale lo que vale su set MÁS NUEVO, mirando todos y no el
  // primero de la lista: desde que los promos se van al fondo, el primero
  // ya no es el más nuevo si la era SOLO tiene promos.
  const masNuevo = (sets) => Math.max(...sets.map(cuando))
  eras.sort((a, b) => masNuevo(b.sets) - masNuevo(a.sets))
  grupos.push(...eras)

  if (especiales.length) {
    grupos.push({ id: 'especiales', titulo: 'Sets especiales', sets: especiales })
  }
  return grupos
}
