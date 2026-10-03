// Los mazos de una repetición, por lo que se VIO (tanda 494).
//
// PINGU, de la lista de ideas: «con las cartas que enseñó cada jugador saco
// su arquetipo ("Dragapult contra Zoroark"), etiqueto con él "Tus
// repeticiones" y añado un botón "Abrir en el constructor"».
//
// Un registro no trae las listas: trae lo que pasa. De cada jugador se ve lo
// que pone en juego, lo que une, lo que juega y descarta, lo que roba con
// nombre y lo que coge de premio. Así que cada cuenta es un MÍNIMO: «al
// menos 4 Zorua de N». Y se cuenta con el MÁXIMO de copias que se vieron A
// LA VEZ —en juego, en el descarte y en la mano que se conoce—, que es lo
// único que no cuenta dos veces la misma carta cuando va y vuelve (un
// Zorua que cae y se recupera con Camilla Nocturna sigue siendo uno).
//
// Sin DOM y sin Supabase: se prueba en Node.

const esEnergia = (n) => /^energ[ií]a\b|\benergy$/i.test(String(n || ''))

function tipoDe(nombre, enJuego, carta) {
  if (enJuego.has(nombre)) return 'pokemon'
  const cat = String(carta?.category || '').toLowerCase()
  if (/pok[eé]mon/.test(cat)) return 'pokemon'
  if (/energ/.test(cat) || esEnergia(nombre)) return 'energia'
  return 'entrenador'
}

// { [jugador]: [{ nombre, copias, tipo: 'pokemon' | 'entrenador' | 'energia' }] }
// en el orden de la lista de TCG Live: Pokémon, Entrenadores y Energías, y
// dentro de cada uno de más copias a menos. `cartaDe(nombre)`, si se sabe,
// da la fila del catálogo: un Darumaka que se descarta con Ultra Ball no
// llega a estar en juego, y solo el catálogo sabe que es un Pokémon.
export function cartasVistas(fotos, cartaDe = () => null) {
  const orden = fotos?.[0]?.orden || []
  const max = Object.fromEntries(orden.map((n) => [n, new Map()]))
  const pokemon = Object.fromEntries(orden.map((n) => [n, new Set()]))
  for (const s of fotos || []) {
    for (const n of orden) {
      const p = s.jugadores[n]
      if (!p) continue
      const ahora = new Map()
      const suma = (c) => c && c !== '?' && ahora.set(c, (ahora.get(c) || 0) + 1)
      for (const slot of [p.activo, ...p.banca].filter(Boolean)) {
        // Lo que está en juego como Pokémon (la de arriba y las de debajo
        // de una evolución) es Pokémon: es lo único que se sabe seguro del
        // tipo de una carta sin el catálogo.
        for (const c of slot.cartas) {
          suma(c)
          pokemon[n].add(c)
        }
        slot.energias.forEach(suma)
        suma(slot.herramienta)
      }
      p.descarte.forEach(suma)
      p.manoConocida.slice(0, p.mano).forEach(suma)
      // La mano que se ENSEÑA al hacer mulligan también es información: es
      // de antes de poner nada, así que no se pisa con lo demás.
      if (s.foco?.tipo === 'mostrar' && s.foco.jugador === n) (s.foco.cartas || []).forEach(suma)
      if (s.estadio?.dueno === n) suma(s.estadio.carta)
      for (const [c, k] of ahora) if (k > (max[n].get(c) || 0)) max[n].set(c, k)
    }
  }
  const PESO = { pokemon: 0, entrenador: 1, energia: 2 }
  const fuera = {}
  for (const n of orden) {
    fuera[n] = [...max[n].entries()]
      .map(([nombre, copias]) => ({ nombre, copias: Math.min(copias, esEnergia(nombre) ? 60 : 4), tipo: tipoDe(nombre, pokemon[n], cartaDe(nombre)) }))
      .sort((a, b) => PESO[a.tipo] - PESO[b.tipo] || b.copias - a.copias || a.nombre.localeCompare(b.nombre, 'es'))
  }
  return fuera
}

// Lo que js/torneos/arquetipos.js espera de una decklist: tres secciones
// con { quantity, name, set, number }. `cartaDe(nombre)` (si se sabe) da la
// fila del catálogo, y con ella van su colección, su número y su nombre
// INGLÉS: el registro viene en el idioma de quien juega («Órdenes del
// jefe»), y el catálogo de arquetipos y la Pokédex de los sprites cruzan
// por la clave canónica, que es la inglesa (tanda 334).
export function listaParaArquetipo(vistas, cartaDe = () => null, codigoDeSet = () => null) {
  const seccion = { pokemon: [], trainer: [], energy: [] }
  const DONDE = { pokemon: 'pokemon', entrenador: 'trainer', energia: 'energy' }
  for (const v of vistas || []) {
    const c = cartaDe(v.nombre)
    seccion[DONDE[v.tipo]].push({
      quantity: v.copias,
      name: c?.name || v.nombre,
      set: c ? codigoDeSet(c.set_id) || undefined : undefined,
      number: c?.local_id ? String(c.local_id).replace(/^0+(?=\d)/, '') : undefined,
    })
  }
  return seccion
}

// Las cartas con su fila del catálogo, para el enlace del constructor
// (`codificarMazo`): las que no se han resuelto no pueden ir.
export function entradasDelConstructor(vistas, cartaDe = () => null) {
  const porId = new Map()
  for (const v of vistas || []) {
    const c = cartaDe(v.nombre)
    if (!c?.id) continue
    const ya = porId.get(c.id)
    porId.set(c.id, { carta: c, n: Math.min(60, (ya?.n || 0) + v.copias) })
  }
  return [...porId.values()]
}

// Cuántas cartas se han visto de un mazo (de 60).
export const totalVisto = (vistas) => (vistas || []).reduce((n, v) => n + v.copias, 0)
