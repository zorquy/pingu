// Tu LISTA asociada a una repetición (tanda 519): lo que no necesita la
// página. PINGU, de la lista de ideas: «asociar tu lista de /mazos a la
// partida: las probabilidades reales en cada jugada, qué tenías en los
// premios, y "Jugar desde aquí" sin "Carta sin ver"».
//
// El registro solo enseña lo que pasa por la mesa; con la lista entera se
// sabe además lo que NO ha salido: lo que queda entre el mazo y los
// premios. Sin DOM: se prueba en Node.
import { plano } from '../constructor/nucleo.js'
import { SIN_VER } from './posicion.js'
import { nombreDeCarta } from '../catalogo-series.js'

const nombresDe = (c) => [c?.name_es, c?.name].filter(Boolean).map(plano)

// El mazo de la mesa con la lista: las entradas de la lista, y si en la
// partida se vio algo que la lista NO tiene (o más copias de las que
// tiene), eso también, para que la mesa cuadre — y se cuenta en `fuera`,
// que es la manera de darse cuenta de que la lista no es la de esa partida.
// `idDe(nombre)` dice de qué entrada es cada nombre del registro.
export function mazoConLista(lista, vistas, cartaDe = () => null) {
  const entradas = lista.map((e) => ({ carta: e.carta, n: e.n }))
  const porNombre = new Map()
  for (const e of entradas) for (const n of nombresDe(e.carta)) if (!porNombre.has(n)) porNombre.set(n, e)
  const fuera = []
  for (const v of vistas || []) {
    const e = porNombre.get(plano(v.nombre))
    if (e && e.n >= v.copias) continue
    const faltan = v.copias - (e?.n || 0)
    fuera.push({ nombre: v.nombre, copias: faltan })
    if (e) e.n += faltan
    else {
      const carta = cartaDe(v.nombre) || { id: `suelta:${plano(v.nombre)}`, name: v.nombre, name_es: v.nombre, category: v.tipo === 'pokemon' ? 'Pokemon' : v.tipo === 'energia' ? 'Energy' : 'Trainer' }
      const nueva = { carta, n: faltan }
      entradas.push(nueva)
      porNombre.set(plano(v.nombre), nueva)
    }
  }
  // Una lista de menos de 60 (a medias) se completa con «sin ver»: la mesa
  // necesita las 60, y lo que falta es justo lo que no se sabe.
  const total = entradas.reduce((k, e) => k + e.n, 0)
  if (total < 60) entradas.push({ carta: SIN_VER, n: 60 - total })
  return { entradas, idDe: (nombre) => porNombre.get(plano(nombre))?.carta.id ?? null, fuera }
}

// Lo que de la lista NO se ha visto en la foto `s` (está en el mazo, en los
// premios o en la parte de la mano que el registro no enseña), carta a
// carta. `n` es la cuenta; `nombre`, el de la lista.
export function sinVerEnLaFoto(lista, s, jugador) {
  const p = s?.jugadores?.[jugador]
  const cuenta = new Map()
  const porNombre = new Map()
  for (const e of lista) {
    const fila = { carta: e.carta, nombre: nombreDeCarta(e.carta), n: e.n }
    cuenta.set(e.carta.id, fila)
    for (const n of nombresDe(e.carta)) if (!porNombre.has(n)) porNombre.set(n, fila)
  }
  if (!p) return { cartas: [...cuenta.values()], total: lista.reduce((k, e) => k + e.n, 0) }
  const vistas = [
    ...[p.activo, ...p.banca].filter(Boolean).flatMap((x) => [...x.cartas, ...x.energias, ...(x.herramienta ? [x.herramienta] : [])]),
    ...p.descarte,
    ...p.manoConocida.slice(0, p.mano),
    ...(s.estadio?.dueno === jugador ? [s.estadio.carta] : []),
  ]
  for (const nombre of vistas) {
    const fila = porNombre.get(plano(nombre))
    if (fila && fila.n > 0) fila.n--
  }
  const cartas = [...cuenta.values()].filter((f) => f.n > 0).sort((a, b) => b.n - a.n || a.nombre.localeCompare(b.nombre, 'es'))
  return { cartas, total: cartas.reduce((k, f) => k + f.n, 0) }
}

// Lo que salió de TUS premios: las cartas que el registro enseña al
// cogerlos («Se ha añadido X a la mano de Rojo» justo después de «Rojo ha
// cogido 2 cartas de Premio»). Las de «Una carta» no se saben.
export function premiosCogidos(eventos, jugador) {
  const cartas = []
  let ocultas = 0
  for (let i = 0; i < eventos.length; i++) {
    const e = eventos[i]
    if (e.tipo !== 'premio' || e.jugador !== jugador) continue
    let faltan = e.n
    for (let k = i + 1; k < eventos.length && faltan > 0 && eventos[k].tipo === 'llegaAMano' && eventos[k].jugador === jugador; k++) {
      const c = eventos[k].cartas || []
      if (c.length) cartas.push(...c)
      else ocultas++
      faltan--
    }
    ocultas += faltan
  }
  return { cartas, ocultas }
}

// La probabilidad de que la PRÓXIMA carta que robes sea esta: lo que queda
// de ella entre todo lo que no has visto. Mazo y premios están barajados
// juntos desde el principio, así que cuentan igual.
export const probabilidadDeRobar = (n, total) => (total > 0 ? n / total : 0)
