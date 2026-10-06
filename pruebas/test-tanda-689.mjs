// Tanda 689 — lo que cuentan las variantes de la imagen, en Node. La
// pantalla (test-tanda-689-pantalla) mira el carrusel; esto mira los
// NÚMEROS con una colección de mentira donde cada cuenta se sabe a mano.
import { cartasDistintas, masRepetido, resumenDelMes, resumenDePokedex, REGIONES, TOTAL_POKEDEX } from '/home/user/pingu/js/mi-coleccion/imagen-datos.js'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 220) : ''}`)
}
const AHORA = new Date('2026-10-06T12:00:00Z')
const hace = (d) => new Date(AHORA.getTime() - d * 86_400_000).toISOString()
const CARTAS = {
  a: { id: 'a', set_id: 's1', name: 'Pikachu', dex_ids: [25], types: ['Lightning'], category: 'Pokemon', tcg_sets: { name: 'Set 1', release_date: '1999-01-09' } },
  b: { id: 'b', set_id: 's2', name: 'Pikachu V', dex_ids: [25], types: ['Lightning'], category: 'Pokemon', tcg_sets: { name: 'Set 2', release_date: '2021-01-01' } },
  c: { id: 'c', set_id: 's2', name: 'Bill', category: 'Trainer', tcg_sets: { name: 'Set 2', release_date: '2021-01-01' } },
  d: { id: 'd', set_id: 's3', name: 'Miraidon ex', dex_ids: [1008], types: ['Lightning'], category: 'Pokemon', tcg_sets: { name: 'Set 3', release_date: '2023-03-31' } },
  // Sin dex_ids: la especie sale del nombre (la 483).
  e: { id: 'e', set_id: 's3', name: 'Charizard', types: ['Fire'], category: 'Pokemon', tcg_sets: { name: 'Set 3', release_date: '2023-03-31' } },
}
const LINEAS = [
  { card_id: 'a', cantidad: 2, created_at: hace(80) },
  { card_id: 'a', cantidad: 1, created_at: hace(2) }, // la misma carta otra vez: no es nueva, entró hace 80
  { card_id: 'b', cantidad: 1, created_at: hace(10) },
  { card_id: 'c', cantidad: 3, created_at: hace(3) },
  { card_id: 'd', cantidad: 1, created_at: hace(1) },
  { card_id: 'e', cantidad: 1, created_at: null },
  { card_id: 'zzz', cantidad: 1, created_at: hace(1) }, // sin carta en el catálogo: no cuenta
]
const busca = (l) => CARTAS[l.card_id] || null

console.log('── 1. Las cartas distintas ──')
const d = cartasDistintas(LINEAS, busca)
check('cinco distintas (la repetida se funde, la huérfana no cuenta), con copias sumadas y la PRIMERA entrada', d.length === 5 && d.find((x) => x.carta.id === 'a').copias === 3 && d.find((x) => x.carta.id === 'a').entro.toISOString() === hace(80) && d.find((x) => x.carta.id === 'e').entro === null, JSON.stringify(d.map((x) => [x.carta.id, x.copias])))

console.log('── 2. El más repetido ──')
const f = masRepetido(d)
check('Pikachu ×2, en dos expansiones', f?.nombre === 'Pikachu' && f.dex === 25 && f.veces === 2 && f.expansiones === 2, JSON.stringify(f))
check('con una sola carta por especie no hay favorito', masRepetido(d.filter((x) => x.carta.id !== 'a')) === null)

console.log('── 3. El mes ──')
const m = resumenDelMes(d, { ahora: AHORA, nombreDeSet: (c) => c.tcg_sets.name })
check('tres nuevas en 30 días (Pikachu entró hace 80 aunque tenga una línea de hace 2)', m.nuevas === 3, JSON.stringify(m))
check('  …las últimas, la más reciente primero', m.ultimas.map((c) => c.id).join() === 'd,c,b', m.ultimas.map((c) => c.id).join())
check('  …y las expansiones nuevas: Set 3 (hace 1) y Set 2 (hace 10); Set 1 no', m.expansionesNuevas.join() === 'Set 3,Set 2', m.expansionesNuevas.join())

console.log('── 4. La Pokédex ──')
const p = resumenDePokedex(d)
check('tres especies de 1.025 (Pikachu, Miraidon y Charizard por el nombre), con el tanto por ciento a un decimal', p.especies === 3 && p.total === TOTAL_POKEDEX && p.pct === 0.3, JSON.stringify([p.especies, p.pct]))
check('los tipos: Rayo 3, y a empate por nombre: Entrenador 1, Fuego 1', JSON.stringify(p.tipos) === JSON.stringify([{ nombre: 'Rayo', cuenta: 3 }, { nombre: 'Entrenador', cuenta: 1 }, { nombre: 'Fuego', cuenta: 1 }]), JSON.stringify(p.tipos))
check('las regiones: Kanto 3, Paldea 1, nueve casillas', p.regiones.length === 9 && p.regiones[0].cuenta === 3 && p.regiones[8].cuenta === 1 && p.regiones.slice(1, 8).every((r) => r.cuenta === 0), JSON.stringify(p.regiones))
check('la más antigua, por la fecha de su expansión: el Pikachu de 1999', p.masAntigua?.carta.id === 'a' && p.masAntigua.anio === 1999, JSON.stringify(p.masAntigua))
check('las regiones no tienen huecos y la última no tiene final', REGIONES.every((r, i) => i === 0 || r.desde === REGIONES[i - 1].hasta + 1) && REGIONES[8].hasta === Infinity)

console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
