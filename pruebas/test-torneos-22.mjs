import {
  normalizarNombre,
  llevaLaCarta,
  arquetipoDelCatalogo,
  deducirIconos,
  arquetipoDeMazo,
  claveDeArquetipo,
} from '/home/user/pingu/js/torneos/arquetipos.js'
import { readFileSync } from 'node:fs'

// Tanda 230: qué mazo es este, en dos iconos. La regla vive en un módulo
// sin DOM ni red a propósito, así que se prueba entera aquí, sin
// navegador y sin doble de Supabase.

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + extra : ''}`)
}

const DRAGAPULT = {
  pokemon: [
    { quantity: 3, name: 'Dragapult ex', set: 'TWM', number: '130' },
    { quantity: 4, name: 'Dreepy', set: 'TWM', number: '128' },
    { quantity: 2, name: 'Dusknoir', set: 'SFA', number: '20' },
    { quantity: 3, name: 'Duskull', set: 'SFA', number: '18' },
  ],
  trainer: [{ quantity: 4, name: 'Crushing Hammer', set: 'SVI', number: '168' }],
  energy: [{ quantity: 6, name: 'Basic Psychic Energy', set: 'SVE', number: '5' }],
}

const CATALOGO = [
  {
    id: 'dragapult',
    nombre: 'Dragapult',
    activo: true,
    iconos: [{ set: 'TWM', numero: '130' }],
    requiere: [{ nombres: ['Dragapult ex'] }],
  },
  {
    id: 'dragapult-dusknoir',
    nombre: 'Dragapult Dusknoir',
    activo: true,
    iconos: [{ set: 'TWM', numero: '130' }, { set: 'SFA', numero: '20' }],
    requiere: [{ nombres: ['Dragapult ex'] }, { nombres: ['Dusknoir'] }],
  },
  {
    id: 'martillos',
    nombre: 'Martillos',
    activo: true,
    iconos: [{ set: 'SVI', numero: '168' }],
    // Un arquetipo que se nombra por un OBJETO, no por un Pokémon.
    requiere: [{ nombres: ['Crushing Hammer', 'Martillo aplastante'] }],
  },
]

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. Normalizar nombres ──')
check('quita tildes y mayúsculas', normalizarNombre('Órdenes del Jefe') === 'ordenes del jefe')
check('aplasta los espacios de más', normalizarNombre('  Dragapult   ex ') === 'dragapult ex')
check('aguanta un nulo', normalizarNombre(null) === '')

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. Reconocer una carta ──')
{
  const lineas = [...DRAGAPULT.pokemon, ...DRAGAPULT.trainer]
  check('por nombre', llevaLaCarta(lineas, { nombres: ['Dragapult ex'] }))
  check('por set y número, sin nombre', llevaLaCarta(lineas, { set: 'TWM', numero: '130' }))
  check('en minúsculas y con espacios raros', llevaLaCarta(lineas, { nombres: ['  dragapult   EX '] }))
  check('una que no está, no', !llevaLaCarta(lineas, { nombres: ['Charizard ex'] }))
  // La razón de que un requisito lleve VARIOS nombres: el export de TCG
  // Live viene en el idioma del jugador.
  check('vale cualquiera de los nombres', llevaLaCarta(lineas, { nombres: ['Martillo aplastante', 'Crushing Hammer'] }))
  check('las energías NO cuentan', !llevaLaCarta(lineas, { nombres: ['Basic Psychic Energy'] }))
  // Y por el camino de verdad: un arquetipo que pidiera una energía
  // básica casaría con media web. lineasDelMazo() las deja fuera.
  const porEnergia = [{ id: 'psiquico', nombre: 'Psíquico', activo: true, iconos: [], requiere: [{ nombres: ['Basic Psychic Energy'] }] }]
  check('un arquetipo no puede identificarse por una energía',
    arquetipoDelCatalogo(DRAGAPULT, porEnergia) === null,
    String(arquetipoDelCatalogo(DRAGAPULT, porEnergia)?.id))
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. Gana el arquetipo más específico ──')
{
  const a = arquetipoDelCatalogo(DRAGAPULT, CATALOGO)
  check('«Dragapult Dusknoir» por encima de «Dragapult»', a?.id === 'dragapult-dusknoir', a?.id)

  // Sin Dusknoir, el mismo mazo tiene que caer en el general.
  const soloPult = { ...DRAGAPULT, pokemon: DRAGAPULT.pokemon.filter((l) => !/dusk/i.test(l.name)) }
  check('sin Dusknoir cae en «Dragapult»', arquetipoDelCatalogo(soloPult, CATALOGO)?.id === 'dragapult')
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 4. Lo que NO puede pasar ──')
{
  const conVacio = [...CATALOGO, { id: 'todo', nombre: 'Todo', activo: true, iconos: [], requiere: [] }]
  check('un arquetipo sin requisitos no gana al específico',
    arquetipoDelCatalogo(DRAGAPULT, conVacio)?.id === 'dragapult-dusknoir')
  // Y aquí está lo que de verdad importa: un mazo que NO casa con nada.
  // Sin el guardia, el arquetipo vacío se lo lleva —.every() sobre una
  // lista vacía es true— y renombraría de golpe todos los mazos que el
  // catálogo no conoce.
  const otroMazo = { pokemon: [{ quantity: 4, name: 'Miraidon ex', set: 'SVI', number: '81' }], trainer: [] }
  check('y un mazo que no casa con nada se queda SIN arquetipo',
    arquetipoDelCatalogo(otroMazo, conVacio) === null,
    String(arquetipoDelCatalogo(otroMazo, conVacio)?.id))

  const desactivado = CATALOGO.map((a) => (a.id === 'dragapult-dusknoir' ? { ...a, activo: false } : a))
  check('uno desactivado no identifica', arquetipoDelCatalogo(DRAGAPULT, desactivado)?.id === 'dragapult')

  check('un mazo vacío no casa con nada', arquetipoDelCatalogo({ pokemon: [], trainer: [] }, CATALOGO) === null)
  check('sin catálogo tampoco', arquetipoDelCatalogo(DRAGAPULT, []) === null)
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 5. La deducción, para lo que el catálogo no conoce ──')
{
  const iconos = deducirIconos(DRAGAPULT)
  const nombres = iconos.map((i) => i.nombre)
  check('coge dos', iconos.length === 2, JSON.stringify(nombres))
  // Lo que esto evita: que un mazo se llame «Dreepy Duskull». Nadie
  // nombra un mazo por sus básicos, por muchas copias que lleven.
  check('el ex primero', nombres[0] === 'Dragapult ex', JSON.stringify(nombres))
  check('y NO los básicos de la línea', !nombres.some((n) => /Dreepy|Duskull/.test(n)), JSON.stringify(nombres))
  check('trae set y número para la imagen', iconos.every((i) => i.set && i.numero), JSON.stringify(iconos))

  // El mismo mazo con las líneas en otro orden tiene que dar lo mismo:
  // si no, dos refrescos seguidos pintarían iconos distintos.
  const revuelto = { ...DRAGAPULT, pokemon: [...DRAGAPULT.pokemon].reverse() }
  check('el resultado no depende del orden del export',
    JSON.stringify(deducirIconos(revuelto)) === JSON.stringify(iconos))

  check('un mazo sin Pokémon no revienta', JSON.stringify(deducirIconos({ trainer: [] })) === '[]')

  // El ex manda sobre el número de copias. Sin esto, un mazo se
  // llamaría por su motor (4 Bibarel) y no por lo que lo gana.
  const conMotor = {
    pokemon: [
      { quantity: 4, name: 'Bibarel', set: 'BRS', number: '121' },
      { quantity: 2, name: 'Charizard ex', set: 'OBF', number: '125' },
    ],
    trainer: [],
  }
  check('el ex manda aunque lleve menos copias',
    deducirIconos(conMotor)[0]?.nombre === 'Charizard ex',
    JSON.stringify(deducirIconos(conMotor).map((i) => i.nombre)))

  // Dos líneas con la MISMA puntuación: sin desempate estable, el orden
  // lo decidiría el del export y dos refrescos pintarían distinto.
  const empatadas = {
    pokemon: [
      { quantity: 2, name: 'Zoroark', set: 'SFA', number: '97' },
      { quantity: 2, name: 'Amarys', set: 'PAR', number: '93' },
    ],
    trainer: [],
  }
  check('dos líneas empatadas se ordenan por nombre',
    deducirIconos(empatadas)[0]?.nombre === 'Amarys',
    JSON.stringify(deducirIconos(empatadas).map((i) => i.nombre)))
  check('y al revés dan lo mismo',
    JSON.stringify(deducirIconos({ ...empatadas, pokemon: [...empatadas.pokemon].reverse() })) ===
      JSON.stringify(deducirIconos(empatadas)))
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 6. Siempre devuelve algo ──')
{
  const conCatalogo = arquetipoDeMazo(DRAGAPULT, CATALOGO)
  check('catalogado se marca como curado', conCatalogo.curado === true)
  check('y con su nombre bonito', conCatalogo.nombre === 'Dragapult Dusknoir')

  const sinCatalogo = arquetipoDeMazo(DRAGAPULT, [])
  check('sin catálogo NO se queda en blanco', sinCatalogo.nombre.length > 0, sinCatalogo.nombre)
  check('y se marca como no curado', sinCatalogo.curado === false)
  check('sin id, que no lo tiene', sinCatalogo.id === null)

  const vacio = arquetipoDeMazo({ pokemon: [], trainer: [] }, [])
  check('un mazo vacío dice «Sin identificar»', vacio.nombre === 'Sin identificar', vacio.nombre)
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 7. La clave que agrupa enfrentamientos ──')
{
  // Renombrar un arquetipo NO puede partir el histórico en dos.
  const a = arquetipoDeMazo(DRAGAPULT, CATALOGO)
  const renombrado = CATALOGO.map((x) => (x.id === 'dragapult-dusknoir' ? { ...x, nombre: 'Pult Noir' } : x))
  const b = arquetipoDeMazo(DRAGAPULT, renombrado)
  check('la clave aguanta un cambio de nombre', claveDeArquetipo(a) === claveDeArquetipo(b), claveDeArquetipo(b))

  // Y dos mazos deducidos iguales tienen que agruparse juntos.
  const d1 = arquetipoDeMazo(DRAGAPULT, [])
  const d2 = arquetipoDeMazo({ ...DRAGAPULT, pokemon: [...DRAGAPULT.pokemon].reverse() }, [])
  check('dos deducidos iguales van juntos', claveDeArquetipo(d1) === claveDeArquetipo(d2))
  check('un catalogado y uno deducido NO se mezclan', claveDeArquetipo(a) !== claveDeArquetipo(d1))
  check('sin mazo tiene su propia clave', claveDeArquetipo(null) === 'sin-mazo')
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 8. La migración dice lo que el código da por hecho ──')
{
  const sql = readFileSync('/home/user/pingu/supabase-migration-arquetipos.sql', 'utf8')
  check('la tabla se llama tcg_archetypes', /create table if not exists public\.tcg_archetypes/.test(sql))
  check('el catálogo se lee sin cuenta', /arquetipos_leer[\s\S]*?for select using \(true\)/.test(sql))
  check('y solo lo escribe un admin', /arquetipos_escribir[\s\S]*?is_admin/.test(sql))
  // Sin este check, un arquetipo sin requisitos casaría con TODOS los
  // mazos y los renombraría a todos de golpe.
  check('la base impide un arquetipo sin requisitos', /jsonb_array_length\(requiere\) > 0/.test(sql))
  check('y más de dos iconos', /jsonb_array_length\(iconos\) <= 2/.test(sql))
  check('se entrega VACÍA, sin meta inventado', !/^\s*insert into public\.tcg_archetypes/m.test(sql))
}

console.log(fails ? `\n${fails} FALLOS\n` : '\nTodo en verde\n')
process.exit(fails ? 1 : 0)
