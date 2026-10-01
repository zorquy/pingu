// Guardar en «Mis mazos» una lista que estás VIENDO (tanda 413).
//
// PINGU: «que tú siempre te puedas guardar el mazo que quieras». Hasta
// ahora una lista ajena —la de un jugador en la clasificación de un
// torneo, una de /meta— solo se podía copiar como texto o, desde /meta,
// abrir en el constructor y guardar desde allí. En un torneo ni eso.
//
// Se guarda tal cual, sin pasar por el constructor: las líneas se
// resuelven con el mismo camino que una lista pegada (resolverLineas, con
// su impresión de rareza más baja) y van a `user_decks` como mazo
// PRIVADO. Lo que no se encuentra no impide guardar: se dice cuántas
// faltan y el mazo se guarda con el resto, que se puede completar luego.
//
// El constructor (sus datos) se baja al pulsar, no antes: quien solo mira
// una clasificación no tiene por qué cargarlo.
import { getSession } from './app.js'

const SECCIONES = ['pokemon', 'trainer', 'energy']

// Las líneas de una lista con la forma de una decklist de torneo
// ({ quantity, name, set, number }) o de /meta ({ count, name, set, number }).
export function lineasDeLista(lista) {
  return SECCIONES.flatMap((s) =>
    (lista?.[s] || [])
      .map((l) => {
        const n = Number(l.quantity ?? l.count) || 0
        return { n, nombre: String(l.name || ''), set: String(l.set || '').toUpperCase() || null, numero: l.number != null ? String(l.number) : null, original: `${n} ${l.name || ''} ${l.set || ''} ${l.number || ''}`.trim() }
      })
      .filter((l) => l.n > 0 && (l.nombre || (l.set && l.numero)))
  )
}

// La portada: el Pokémon del que más copias hay, como hace el constructor.
function portadaDe(cartas) {
  const pokemon = cartas.filter((c) => /^pok/i.test(String(c.carta.category || '')))
  const mejor = [...(pokemon.length ? pokemon : cartas)].sort((a, b) => b.n - a.n)[0]
  return mejor?.carta.id || null
}

// Devuelve { mazo, faltan } o { entrar: true } si no hay sesión (quien
// llama lo manda a entrar). Los errores de la base suben tal cual.
export async function guardarListaEnMisMazos({ lista, nombre }) {
  const sesion = await getSession()
  if (!sesion) return { entrar: true }
  const { resolverLineas, guardarMazo } = await import('./constructor/datos.js')
  const lineas = lineasDeLista(lista)
  if (!lineas.length) throw new Error('Esta lista no tiene cartas que guardar.')
  const { resueltas, sinResolver } = await resolverLineas(lineas)
  if (!resueltas.length) throw new Error('No he encontrado ninguna carta de esta lista en el catálogo.')
  const cartas = resueltas.map((r) => ({ carta: r.carta, n: r.linea.n }))
  const mazo = await guardarMazo({
    name: String(nombre || 'Mazo guardado').slice(0, 80),
    format: 'standard',
    cards: cartas.map((c) => ({ id: c.carta.id, n: c.n })),
    cover_card: portadaDe(cartas),
    is_public: false,
  })
  return { mazo, faltan: sinResolver.reduce((s, l) => s + l.n, 0) }
}

// El enlace para entrar y volver aquí mismo.
export function enlaceParaEntrar() {
  return `/auth.html?volver=${encodeURIComponent(location.pathname + location.search)}`
}
