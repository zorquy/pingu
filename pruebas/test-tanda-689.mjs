// Tanda 689 — lo que cuentan las variantes de la imagen, en Node. La
// pantalla (test-tanda-689-pantalla) mira el carrusel; esto mira los
// NÚMEROS con una colección de mentira donde cada cuenta se sabe a mano.
import { cartasDistintas, masRepetido, resumenDelMes, resumenDePokedex, equipoDe6, viajeEnElTiempo, perfilDeColeccionista, PERFILES, REGIONES, TOTAL_POKEDEX } from '/home/user/pingu/js/mi-coleccion/imagen-datos.js'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 220) : ''}`)
}
const AHORA = new Date('2026-10-06T12:00:00Z')
const hace = (d) => new Date(AHORA.getTime() - d * 86_400_000).toISOString()
const CARTAS = {
  a: { id: 'a', set_id: 's1', name: 'Pikachu', dex_ids: [25], types: ['Lightning'], category: 'Pokemon', rarity: 'Rare Holo', tcg_sets: { name: 'Set 1', serie_id: 'base', release_date: '1999-01-09' } },
  b: { id: 'b', set_id: 's2', name: 'Pikachu V', dex_ids: [25], types: ['Lightning'], category: 'Pokemon', rarity: 'Rare Holo V', tcg_sets: { name: 'Set 2', serie_id: 'swsh', release_date: '2021-01-01' } },
  c: { id: 'c', set_id: 's2', name: 'Bill', category: 'Trainer', rarity: 'Common', tcg_sets: { name: 'Set 2', serie_id: 'swsh', release_date: '2021-01-01' } },
  d: { id: 'd', set_id: 's3', name: 'Miraidon ex', dex_ids: [1008], types: ['Lightning'], category: 'Pokemon', rarity: 'Double Rare', tcg_sets: { name: 'Set 3', serie_id: 'sv', release_date: '2023-03-31' } },
  // Sin dex_ids: la especie sale del nombre (la 483).
  e: { id: 'e', set_id: 's3', name: 'Charizard', types: ['Fire'], category: 'Pokemon', rarity: 'Common', tcg_sets: { name: 'Set 3', serie_id: 'sv', release_date: '2023-03-31' } },
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

console.log('── 5. El equipo de 6 (691) ──')
const eq = equipoDe6(d)
check('tres especies, Pikachu el líder con sus dos cartas, dos expansiones y desde 1999', eq.length === 3 && eq[0].nombre === 'Pikachu' && eq[0].cartas === 2 && eq[0].expansiones === 2 && eq[0].desde === 1999 && eq[0].ejemplos.length === 2 && eq[1].ejemplos.length === 0, JSON.stringify(eq.map((m) => [m.nombre, m.cartas])))
check('  …los demás a empate por el número de Pokédex: Charizard (6) antes que Miraidon (1008)', eq[1].nombre === 'Charizard' && eq[2].nombre === 'Miraidon')

console.log('── 6. El viaje en el tiempo (691) ──')
const v = viajeEnElTiempo(d)
check('de 1999 a 2023: 24 años, la más antigua el Pikachu y la más nueva una de Set 3', v.antigua.carta.id === 'a' && v.antigua.anio === 1999 && v.nueva.anio === 2023 && v.anios === 24, JSON.stringify([v.antigua.anio, v.nueva.anio, v.anios]))
check('  …las épocas en orden de fecha, con su rótulo y sus años: Base 1, SWSH 2, SV 2; mi época la que más tiene (a empate, la primera)', v.epocas.map((e) => `${e.nombre}:${e.cuenta}:${e.anios}`).join() === 'Base:1:1999,SWSH:2:2021,SV:2:2023' && v.miEpoca === 'SWSH', JSON.stringify(v.epocas))
check('  …sin fechas no hay viaje', viajeEnElTiempo([{ carta: { id: 'x' } }]) === null)

console.log('── 7. El perfil (691) ──')
const pf = perfilDeColeccionista(d)
check('brillo 3 de 5, 4 Pokémon y 1 entrenador, Kanto, Rayo, Pikachu de fetiche', Math.round(pf.brillo * 100) === 60 && pf.pokemon === 4 && pf.entrenadores === 1 && pf.energias === 0 && pf.region.nombre === 'Kanto' && pf.tipo.nombre === 'Rayo' && pf.fetiche.nombre === 'Pikachu', JSON.stringify(pf))
check('  …y con eso es «Cazador de holos» (el brillo pasa del 50 %)', pf.perfil.id === 'holos' && pf.perfil.nombre === 'Cazador de holos' && /60 %/.test(pf.perfil.frase), JSON.stringify(pf.perfil))
check('  …con una expansión al 100 % manda Completista', perfilDeColeccionista(d, { alCien: 1 }).perfil.id === 'completista')
check('  …y la última regla siempre se cumple: nadie se queda sin perfil', PERFILES[PERFILES.length - 1].cuando({}) === true && perfilDeColeccionista([]) === null)

console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
