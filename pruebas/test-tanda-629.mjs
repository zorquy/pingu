// Tanda 629 — las energías especiales, bien traducidas; y la lista de una
// repetición con dos impresiones de la misma carta.
//
// PINGU, con una repetición delante: «4 cartas de la partida no están en
// esta lista (Alakazam, Energía Psíquica Telepática): ¿es la lista de esta
// partida? Hay problemas de traducción con la energía telepática, repasa
// las energías especiales y pon todas las cartas en el mismo idioma bien
// traducidas».
//
// Eran DOS fallos con la misma cara:
//   · TCGdex nombra en español «Energía Psychic Telepática» (el tipo sin
//     traducir) y TCG Live escribe «Energía Psíquica Telepática»: no
//     casaban (comprobado en la base el 2026-10-05: once energías así).
//   · Su lista llevaba 3 Alakazam de Megaevolución y 1 de Mascarada
//     Crepuscular: el registro solo dice «Alakazam», y se miraba solo la
//     PRIMERA impresión, así que la cuarta copia «no estaba en la lista».
//
//   1. corregirNombreEs y lo que se enseña (nombreDeCarta), en Node.
//   2. La lista de una repetición: varias impresiones con un nombre, y los
//      dos nombres de la telepática.
//   3. El motor: las energías con el nombre corregido siguen haciendo lo
//      suyo, y las dos de me04 que faltaban (Metálica Magnética y Fuego
//      Nitro).
//   4. Lo que llega de TCGdex entra ya corregido.
//   5. La migración, contra PostgreSQL.
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const RAIZ = process.env.RAIZ || '/home/user/pingu'
const { corregirNombreEs } = await import(`${RAIZ}/js/texto.js`)
const { nombreDeCarta } = await import(`${RAIZ}/js/catalogo-series.js`)
const { mazoConLista, sinVerEnLaFoto } = await import(`${RAIZ}/js/repeticiones/lista.js`)
const M = await import(`${RAIZ}/js/constructor/partida.js`)
const { EFECTOS } = await import(`${RAIZ}/js/constructor/efectos.js`)
const { nombreEspanolDe } = await import(`${RAIZ}/netlify/lib/carta-detalle.mjs`)

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. El nombre, en español de verdad ──')
{
  const casos = [
    ['Energía Psychic Telepática', 'Energía Psíquica Telepática'],
    ['Energía Water Burbujeante', 'Energía Agua Burbujeante'],
    ['Energía Metal Magnética', 'Energía Metálica Magnética'],
    ['Energía Fire Nitro', 'Energía Fuego Nitro'],
    ['Energía Darkness Sombría', 'Energía Oscura Sombría'],
    ['Energía Lightning Voltaica', 'Energía Rayo Voltaica'],
    ['Energía Grass Creciente', 'Energía Planta Creciente'],
    ['Energía Fighting Rocosa', 'Energía Lucha Rocosa'],
    ['Energía Colorless Poderosa', 'Energía Incolora Poderosa'],
    ['Amuleto Hada Psychic', 'Amuleto Hada Psíquico'],
  ]
  const mal = casos.filter(([a, b]) => corregirNombreEs(a) !== b).map(([a]) => `${a} → ${corregirNombreEs(a)}`)
  check('las once formas de la base, como en la carta impresa', !mal.length, mal.join(' | '))
  const quietos = ['Telepathic Psychic Energy', 'Energía Psíquica', 'Platillo Metal', 'Alakazam', 'Energía Metálica', 'Gong de Lucha']
  check('lo que ya está bien no se toca (inglés, básicas, otras palabras)', quietos.every((n) => corregirNombreEs(n) === n), quietos.map(corregirNombreEs).join(' | '))
  check('sin nombre, sin nombre', corregirNombreEs(null) === null && corregirNombreEs('') === '')
  check('la ficha, el mazo y la mesa lo enseñan corregido (nombreDeCarta)', nombreDeCarta({ name: 'Energía Psychic Telepática', name_es: 'Energía Psychic Telepática' }) === 'Energía Psíquica Telepática')
  check('  …también cuando el español solo está en `name`', nombreDeCarta({ name: 'Energía Water Burbujeante', name_es: null }) === 'Energía Agua Burbujeante')
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. La lista de una repetición ──')
{
  const ALA_ME = { id: 'me01-056', name: 'Alakazam', name_es: 'Alakazam', category: 'Pokémon' }
  const ALA_SV = { id: 'sv06-082', name: 'Alakazam', name_es: 'Alakazam', category: 'Pokémon' }
  const TELE = { id: 'me03-088', name: 'Energía Psychic Telepática', name_es: 'Energía Psychic Telepática', category: 'Energía' }
  const lista = [{ carta: ALA_ME, n: 3 }, { carta: ALA_SV, n: 1 }, { carta: TELE, n: 4 }]
  const vistas = [
    { nombre: 'Alakazam', copias: 4, tipo: 'pokemon' },
    { nombre: 'Energía Psíquica Telepática', copias: 3, tipo: 'energia' },
  ]
  const r = mazoConLista(lista, vistas)
  check('cuatro Alakazam vistos con 3 + 1 en la lista: no sobra ninguno', !r.fuera.some((f) => f.nombre === 'Alakazam'), JSON.stringify(r.fuera))
  check('«Energía Psíquica Telepática» del registro ES la «Energía Psychic Telepática» de la lista', !r.fuera.length, JSON.stringify(r.fuera))
  check('  …y la mesa la reconoce por los dos nombres', r.idDe('Energía Psíquica Telepática') === 'me03-088' && r.idDe('Energía Psychic Telepática') === 'me03-088')
  check('  …y la lista no se inventa copias (sigue en 60 con las «sin ver»)', r.entradas.filter((e) => e.carta.id !== 'sin-ver').reduce((k, e) => k + e.n, 0) === 8)
  const cinco = mazoConLista(lista, [{ nombre: 'Alakazam', copias: 5, tipo: 'pokemon' }])
  check('con CINCO Alakazam vistos, sobra uno (y solo uno)', cinco.fuera.length === 1 && cinco.fuera[0].copias === 1, JSON.stringify(cinco.fuera))

  // Lo que no se ha visto al acabar: con 4 Alakazam en la mesa, ninguno.
  const foto = {
    jugadores: {
      Yo: {
        activo: { cartas: ['Abra', 'Kadabra', 'Alakazam'], energias: ['Energía Psíquica Telepática'], herramienta: null },
        banca: [{ cartas: ['Alakazam'], energias: [], herramienta: null }],
        descarte: ['Alakazam', 'Alakazam', 'Energía Psíquica Telepática'],
        manoConocida: [],
        mano: 0,
      },
    },
  }
  const sinVer = sinVerEnLaFoto(lista, foto, 'Yo')
  const nombres = sinVer.cartas.map((c) => `${c.n} ${c.nombre}`)
  check('«sin ver al acabar»: los 4 Alakazam vistos descuentan de las DOS impresiones', !sinVer.cartas.some((c) => /Alakazam/.test(c.nombre)), nombres.join(', '))
  check('  …y de la telepática quedan 2, con su nombre bien escrito', nombres.includes('2 Energía Psíquica Telepática'), nombres.join(', '))
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. El motor ──')
{
  const { claveDeEfecto, unidadesDeEnergia } = M
  const formas = ['Energía Psíquica Telepática', 'Energía Psychic Telepática', 'Telepathic Psychic Energy']
  check('la telepática se reconoce con sus tres nombres', formas.every((n) => claveDeEfecto({ name: n }) === 'telepathic psychic energy'), formas.map((n) => claveDeEfecto({ name: n })).join(' | '))
  const otras = { 'Energía Agua Burbujeante': 'bubbly water energy', 'Energía Lucha Rocosa': 'rocky fighting energy', 'Energía Planta Creciente': 'growing grass energy', 'Energía Rayo Voltaica': 'voltaic lightning energy', 'Energía Oscura Sombría': 'shadowy darkness energy', 'Energía Metálica Magnética': 'magnetic metal energy', 'Energía Fuego Nitro': 'nitro fire energy' }
  const malas = Object.entries(otras).filter(([es, en]) => claveDeEfecto({ name: es }) !== en)
  check('y las demás con el tipo ya traducido', !malas.length, malas.map(([es]) => `${es} → ${claveDeEfecto({ name: es })}`).join(' | '))
  const mag = { id: 'me04-085', name: 'Energía Metálica Magnética', category: 'Energía' }
  const nitro = { id: 'me04-086', name: 'Energía Fuego Nitro', category: 'Energía' }
  check('la Metálica Magnética da {M} y la Fuego Nitro da {R}', JSON.stringify(unidadesDeEnergia(mag, null)) === '[["M"]]' && JSON.stringify(unidadesDeEnergia(nitro, null)) === '[["R"]]', `${JSON.stringify(unidadesDeEnergia(mag, null))} ${JSON.stringify(unidadesDeEnergia(nitro, null))}`)
  check('  …y las dos tienen su texto en el laboratorio', Boolean(EFECTOS.energias?.['magnetic metal energy']?.texto || EFECTOS['magnetic metal energy']?.texto || JSON.stringify(EFECTOS).includes('magnetic metal energy')) && JSON.stringify(EFECTOS).includes('nitro fire energy'))

  // Una mesa: un Pokémon {M} con la Magnética no paga retirada; uno {R} que
  // descarta la Nitro con su ataque la recupera en la mano.
  const { Mesa, esPokemon, faseDe } = M
  const FILAS = JSON.parse(readFileSync(new URL('./cartas-laboratorio.json', import.meta.url), 'utf8'))
  const fila = (n) => FILAS.find((x) => x.name === n)
  let ids = 0
  const poke = (name, extra = {}) => ({ id: `t629-${++ids}`, set_id: 't629', local_id: String(ids), name, name_es: name, category: 'Pokemon', stage: 'Basic', hp: 200, types: ['Colorless'], retreat: 2, attacks: [], abilities: [], weaknesses: [], resistances: [], regulation_mark: 'J', ...extra })
  const acero = poke('Acero', { types: ['Metal'] })
  const fuego = poke('Llama', { types: ['Fire'], attacks: [{ name: 'Quemar', effect: 'Descarta 1 Energía de este Pokémon.', damage: '100', cost: [] }] })
  const relleno = [[20, fila('Poké Pad')], [10, fila('Fire Energy')], [10, fila('Psychic Energy')]]
  const mazo = (l) => [...l, ...relleno].map(([n, carta]) => ({ carta, n }))
  const ui = { async cartas(x) { return (x.elegibles || x.opciones).slice(0, x.max) }, async pokemon(x) { return x.opciones.slice(0, 1) }, async confirmar() { return true }, async opcion(x) { return x.opciones[0].id }, async numero(x) { return x.valor }, async repartir(x) { return { [x.opciones[0]]: x.total } } }
  const mesa = new Mesa({ mazos: [mazo([[4, acero], [4, fuego], [2, mag], [2, nitro]]), mazo([[4, poke('Muro', { hp: 500 })]])], efectos: EFECTOS, semilla: 5, empieza: 0 })
  ui.premios = async (x) => (x.partida || mesa.actual).s.premios.slice(0, x.n)
  mesa.repartir()
  for (let k = 0; k < 2; k++) {
    const p = mesa.actual
    let b = p.s.mano.filter((x) => esPokemon(p.carta(x)) && faseDe(p.carta(x)) === 0)
    if (!b.length) { const x = p.s.mazo.find((y) => esPokemon(p.carta(y)) && faseDe(p.carta(y)) === 0); p.sacarDelMazo(x); p.s.mano.push(x); b = [x] }
    p.colocar(b[0], 'activo')
    await mesa.accion(() => mesa.listo(ui), ui)
  }
  await mesa.accion(() => mesa.pasarTurno(ui), ui)
  await mesa.accion(() => mesa.pasarTurno(ui), ui)
  const a = mesa.jugadores[0]
  const sacar = (nombre) => {
    for (const z of ['mazo', 'mano', 'premios', 'descarte']) {
      const u = a.s[z].find((x) => a.carta(x).name === nombre)
      if (u) { if (z === 'mazo') a.sacarDelMazo(u); else a.s[z] = a.s[z].filter((x) => x !== u); return u }
    }
    throw new Error(`no hay ${nombre}`)
  }
  const ponerActivo = (nombre) => {
    const slot = a.nuevoSlot(sacar(nombre))
    slot.entroTurno = -5
    if (a.s.activo) a.s.banca.push(a.s.activo)
    a.s.activo = slot
    return slot
  }
  const s1 = ponerActivo('Acero')
  check('un Pokémon {M} sin la Magnética paga su retirada (2)', a.costeDeRetirada(s1) === 2, a.costeDeRetirada(s1))
  s1.energias.push(sacar('Energía Metálica Magnética'))
  check('  …y con ella unida, no paga nada', a.costeDeRetirada(s1) === 0, a.costeDeRetirada(s1))
  const s2 = ponerActivo('Llama')
  s2.energias.push(sacar('Energía Metálica Magnética'))
  check('  …pero en uno que no es {M}, la Magnética no quita la retirada', a.costeDeRetirada(s2) === 2, a.costeDeRetirada(s2))
  s2.energias = [sacar('Energía Fuego Nitro')]
  const n = sacar('Energía Fuego Nitro')
  a.s.mano.push(n)
  const enMano = () => a.s.mano.filter((u) => a.carta(u).name === 'Energía Fuego Nitro').length
  const antes = enMano()
  await mesa.accion(() => a.atacar(a.s.activo, 0, ui), ui)
  check('la Fuego Nitro que descarta el ataque de su Pokémon {R} vuelve a la MANO', enMano() === antes + 1 && !a.s.descarte.some((u) => a.carta(u).name === 'Energía Fuego Nitro'), `${antes} → ${enMano()}`)
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 4. Lo que llega de TCGdex entra corregido ──')
{
  check('el nombre español que se guarda en `name_es` ya va bien', nombreEspanolDe({ nombre: 'Energía Psychic Telepática', idioma: 'es' }) === 'Energía Psíquica Telepática')
  check('  …y si llegó en inglés, a `name_es` no va nada', nombreEspanolDe({ nombre: 'Telepathic Psychic Energy', idioma: 'en' }) === null)
  const funcion = readFileSync(`${RAIZ}/netlify/functions/cartas-detalle.mjs`, 'utf8')
  check('  …y es lo que usa el engorde al escribir', /const nombreEs = nombreEspanolDe\(encontrado\)/.test(funcion) && /if \(nombreEs\) detalle\.name_es = nombreEs/.test(funcion))
  check('  …sin meterle un import a js/carta-detalle.js (tanda 331)', !/^import /m.test(readFileSync(`${RAIZ}/js/carta-detalle.js`, 'utf8')))
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 5. La migración, contra PostgreSQL ──')
{
  const SQL = readFileSync(`${RAIZ}/supabase-migration-nombres-energias.sql`, 'utf8')
  check('toca `name_es`, `name` y `name_en`, y lo comprueba al final', /set name_es = regexp_replace/.test(SQL) && /set name = regexp_replace/.test(SQL) && /set name_en = regexp_replace/.test(SQL) && /Tiene que devolver CERO filas/.test(SQL))
  const r = spawnSync('psql', ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-v', `raiz=${RAIZ}`, '-f', new URL('./sql-nombres-energias.sql', import.meta.url).pathname], { encoding: 'utf8', timeout: 60000 })
  const salida = r.error ? null : `${r.stdout || ''}${r.stderr || ''}`
  if (salida === null || /could not connect|No such file|connection to server/.test(salida)) {
    console.log('   (no hay PostgreSQL en /var/tmp:5433 — la prueba de la base NO se ha corrido aquí)')
  } else {
    const oks = (salida.match(/ {2}ok {2}/g) || []).length
    const fallos = salida.split('\n').filter((l) => /FALLA|ERROR/.test(l))
    check(`PostgreSQL: ${oks} comprobaciones, ninguna falla`, oks >= 8 && !fallos.length, fallos.slice(0, 3).join(' | '))
  }
}

console.log(fails ? `\n${fails} FALLAS` : '\nTodo en verde.')
process.exit(fails ? 1 : 0)
