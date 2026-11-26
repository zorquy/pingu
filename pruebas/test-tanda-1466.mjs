// Tanda 1466 — Los arquetipos de Limitless, al día solos
// (netlify/functions/arquetipos-limitless.mjs).
//   · Lo puro: las listas como las mira la web (sin energías), las cartas que
//     llevan casi todas, la carta de cada icono, y que el cruce rápido del
//     catálogo da lo MISMO que `arquetipoDelCatalogo` de la web.
//   · La regla de un arquetipo nuevo: entra si mejora lo que se acierta, no se
//     come los de otro, y se queda fuera (con su motivo) si no.
//   · El plan del día: renombrar, retirar y encender solo lo nuestro que nadie
//     ha tocado; nada se retira con el meta parado; lo borrado no vuelve.
//   · Una pasada entera contra una base de mentira, y la segunda del día.
import { readFileSync } from 'node:fs'
const REPO = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }
const F = await import(`${REPO}/netlify/functions/arquetipos-limitless.mjs`)
const W = await import(`${REPO}/js/torneos/arquetipos.js`)

// Una lista de Limitless: [nombre, copias, set, número].
const L = (pokemon, trainer = [], energy = [['Psychic Energy', 6, 'SVE', '5']]) => {
  const fila = ([name, count, set = 'XXX', number = '1']) => ({ name, count, set, number })
  return { pokemon: pokemon.map(fila), trainer: trainer.map(fila), energy: energy.map(fila) }
}
const T = [["Boss's Orders", 2], ['Ultra Ball', 4], ['Iono', 3]]
const DRAGAPULT = () => L([['Dragapult ex', 3, 'TWM', '130'], ['Drakloak', 3], ['Dreepy', 4]], T)
const PULT_BLAZ = () => L([['Dragapult ex', 2, 'TWM', '130'], ['Drakloak', 2], ['Dreepy', 3], ['Blaziken ex', 2, 'SSP', '28'], ['Combusken', 2], ['Torchic', 2]], T)
const PULT_NOIR = () => L([['Dragapult ex', 3, 'TWM', '130'], ['Dusknoir', 2, 'PRE', '37'], ['Dusclops', 2], ['Duskull', 3]], T)
const GARDE = () => L([['Gardevoir ex', 2, 'SVI', '86'], ['Kirlia', 3], ['Ralts', 4]], [...T, ['Night Stretcher', 2]])

console.log('── lo puro ──')
{
  const x = F.prepararLista('pult', L([['Dragapult ex', 2], ['Dragapult ex', 1, 'PRE', '73']], [["Boss’s Orders", 2]], [['Jet Energy', 2]]))
  check('las copias de las dos impresiones se suman', x.copias.get('dragapult ex') === 3, JSON.stringify([...x.copias]))
  check('  …el apóstrofo curvo es el recto, como en la web', x.copias.get("boss's orders") === 2)
  check('  …y las energías no cuentan (la web no las mira)', !x.copias.has('jet energy'))
  const propias = Array.from({ length: 10 }, (_, i) => F.prepararLista('pb', i < 9 ? PULT_BLAZ() : DRAGAPULT()))
  const c = F.candidatas(propias)
  check('candidatas: lo que lleva el 85 % de sus listas', c.some((x) => x.k === 'blaziken ex' && x.m === 1) && c.some((x) => x.k === 'dragapult ex'), JSON.stringify(c.slice(0, 6)))
  check('  …y con las copias que llevan casi todas (2 Blaziken ex, no 3)', c.some((x) => x.k === 'blaziken ex' && x.m === 2) && !c.some((x) => x.k === 'blaziken ex' && x.m === 3))
  check('la carta de un icono: «blaziken» es Blaziken ex', F.cartaDeIcono('blaziken', propias) === 'blaziken ex')
  check('  …«iron-thorns» casa con las dos palabras', F.cartaDeIcono('iron-thorns', [F.prepararLista('t', L([['Iron Thorns ex', 4]]))]) === 'iron thorns ex')
  check('  …y «mega-lucario» sin mega en la lista cae a la especie', F.cartaDeIcono('mega-lucario', [F.prepararLista('t', L([['Lucario ex', 2], ['Riolu', 3]]))]) === 'lucario ex')
  check('fuera: other, basic-box y las jornadas de PokeDoc', ['other', 'basic-box-lucario', 'pokedoc-12-j3', ''].every(F.esDeFuera) && !F.esDeFuera('dragapult'))
}

console.log('── el cruce rápido es el de la web ──')
{
  const cat = [
    { id: 'dragapult', requiere: [{ nombres: ['Dragapult ex', 'Dragapult ex ES'] }] },
    { id: 'dragapult-dusknoir', requiere: [{ nombres: ['Dragapult ex'] }, { nombres: ['Dusknoir'], minimo: 2 }] },
    { id: 'gardevoir', requiere: [{ nombres: ['Gardevoir ex'] }] },
    { id: 'apagado', activo: false, requiere: [{ nombres: ['Dreepy'] }, { nombres: ['Drakloak'] }, { nombres: ['Iono'] }] },
    { id: 'por-numero', requiere: [{ nombres: ['Otra'], set: 'PRE', numero: '37' }, { nombres: ['Dragapult ex'] }] },
    { id: 'aaa-empate', requiere: [{ nombres: ['Gardevoir ex'] }] },
  ]
  const listas = [DRAGAPULT(), PULT_NOIR(), GARDE(), PULT_BLAZ(), L([['Dragapult ex', 1], ['Dusknoir', 1]]), L([['Pikachu ex', 4]])]
  const reglas = F.prepararCatalogo(cat)
  const iguales = listas.every((l) => (F.ganadorDelCatalogo(F.prepararLista('?', l), reglas)?.id ?? null) === (W.arquetipoDelCatalogo(l, cat)?.id ?? null))
  check('seis listas, el mismo arquetipo que arquetipoDelCatalogo (mínimos, apagados, set+número, empates)', iguales, listas.map((l) => `${F.ganadorDelCatalogo(F.prepararLista('?', l), reglas)?.id}/${W.arquetipoDelCatalogo(l, cat)?.id}`).join(' '))
}

console.log('── la regla de un arquetipo nuevo ──')
const CATALOGO = [
  { id: 'dragapult', nombre: 'Dragapult', requiere: [{ nombres: ['Dragapult ex'] }], activo: true },
  { id: 'dragapult-dusknoir', nombre: 'Dragapult Dusknoir', requiere: [{ nombres: ['Dragapult ex'] }, { nombres: ['Dusknoir'] }], activo: true },
  { id: 'gardevoir', nombre: 'Gardevoir', requiere: [{ nombres: ['Gardevoir ex'] }], activo: true },
]
const listas = (n, fab, a) => Array.from({ length: n }, () => F.prepararLista(a, fab()))
{
  const propias = listas(8, PULT_BLAZ, 'dragapult-blaziken')
  const ajenas = [...listas(20, DRAGAPULT, 'dragapult'), ...listas(10, PULT_NOIR, 'dragapult-dusknoir')]
  const r = F.reglaDeArquetipo({ id: 'dragapult-blaziken', iconos: ['dragapult', 'blaziken'], propias, ajenas, catalogo: CATALOGO })
  const nombres = (r.regla || []).map((x) => x.nombre)
  check('Dragapult Blaziken entra: pide Dragapult ex y Blaziken ex', nombres.includes('Dragapult ex') && nombres.includes('Blaziken ex'), JSON.stringify(r))
  check('  …se queda con sus 8 listas y no se come ninguna de los demás', r.suyas === 8 && r.robadas === 0, JSON.stringify({ suyas: r.suyas, robadas: r.robadas }))
  check('  …iconos con su impresión más jugada y el nombre de la carta', JSON.stringify(r.iconos) === JSON.stringify([{ set: 'TWM', numero: '130', nombre: 'Dragapult ex' }, { set: 'SSP', numero: '28', nombre: 'Blaziken ex' }]), JSON.stringify(r.iconos))
  check('  …con dos requisitos le gana a Dragapult (uno) y empata con Dragapult Dusknoir solo si lleva Dusknoir', r.regla.length >= 2)
}
{
  // Mismas cartas que Dragapult: no hay manera de distinguirlo.
  const r = F.reglaDeArquetipo({ id: 'dragapult-otro', iconos: ['dragapult'], propias: listas(5, DRAGAPULT, 'dragapult-otro'), ajenas: listas(20, DRAGAPULT, 'dragapult'), catalogo: CATALOGO })
  check('el que no se distingue de uno que ya está se queda fuera, con su motivo', !r.regla && /no mejora|misma regla|reconoce/.test(r.motivo), JSON.stringify(r))
}
{
  // Pierde contra uno de tres requisitos: le hacen falta varias de una vez.
  const cat = [...CATALOGO, { id: 'garde-tres', nombre: 'G3', requiere: [{ nombres: ['Gardevoir ex'] }, { nombres: ['Kirlia'] }, { nombres: ['Ralts'] }], activo: true }]
  const conMunki = () => L([['Gardevoir ex', 2, 'SVI', '86'], ['Kirlia', 3], ['Ralts', 4], ['Munkidori', 1], ['Drifloon', 2]], [...T, ['Night Stretcher', 2], ['Counter Catcher', 1]])
  const r = F.reglaDeArquetipo({ id: 'gardevoir-munkidori', iconos: ['gardevoir', 'munkidori'], propias: listas(10, conMunki, 'gardevoir-munkidori'), ajenas: listas(12, GARDE, 'garde-tres'), catalogo: cat })
  check('contra uno de 3 requisitos gana con los que le falten, y deja los del otro', r.regla?.length >= 3 && r.suyas === 10 && r.robadas === 0, JSON.stringify(r))
  check('  …y los que le faltan son Pokémon suyos, no un Boss\'s Orders que lleva todo el mundo', r.regla?.every((x) => !['Boss\'s Orders', 'Ultra Ball', 'Iono', 'Night Stretcher', 'Counter Catcher'].includes(x.nombre)), JSON.stringify(r.regla))
}
check('con menos de 3 listas, no', /solo 2 listas/.test(F.reglaDeArquetipo({ id: 'x', propias: listas(2, GARDE, 'x') }).motivo))
{
  const es = F.nombresEnEspanol(["Boss's Orders", 'Dragapult ex'], [
    { name: 'Órdenes de Jefes', name_en: "Boss's Orders", name_es: 'Órdenes de Jefes' },
    { name: "Boss's Orders", name_en: null, name_es: 'Órdenes de jefes.' },
    { name: 'Dragapult ex', name_en: 'Dragapult ex', name_es: 'Dragapult ex' },
    { name: 'Rx', name_en: 'Dragapult ex', name_es: '' },
  ])
  check('los nombres en español, sin repetir el inglés ni de menos de 3 letras', JSON.stringify([...es.get("Boss's Orders")]) === JSON.stringify(['Órdenes de Jefes', 'Órdenes de jefes']) && es.get('Dragapult ex').size === 0, JSON.stringify([...es].map(([k, v]) => [k, [...v]])))
}

console.log('── el plan del día ──')
{
  const ahora = new Date('2026-12-01T05:23:00Z')
  const hora = '2026-11-26T12:00:00.123456+00:00'
  const catalogo = [
    { id: 'pult', nombre: 'Dragapult', activo: true, updated_at: hora },
    { id: 'viejo', nombre: 'Viejo', activo: true, updated_at: hora },
    { id: 'tocado', nombre: 'Tocado a mano', activo: true, updated_at: '2026-11-30T10:00:00+00:00' },
    { id: 'mio-a-mano', nombre: 'Mío', activo: true, updated_at: hora },
    { id: 'dormido', nombre: 'Dormido', activo: false, updated_at: hora },
    { id: 'apagado-a-mano', nombre: 'Apagado', activo: false, updated_at: hora },
  ]
  const propios = { pult: '2026-11-26T12:00:00.123Z', viejo: hora, tocado: hora, dormido: hora, 'apagado-a-mano': hora }
  const vivos = new Map([
    ['pult', { nombre: 'Dragapult ex', mazos: 300, listas: 80 }],
    ['tocado', { nombre: 'Otro nombre', mazos: 10, listas: 5 }],
    ['dormido', { nombre: 'Dormido', mazos: 3, listas: 1 }],
    ['apagado-a-mano', { nombre: 'Apagado', mazos: 3, listas: 1 }],
    ['nuevo-a', { nombre: 'Nuevo A', mazos: 20, listas: 9 }],
    ['nuevo-b', { nombre: 'Nuevo B', mazos: 50, listas: 3 }],
    ['pocas', { nombre: 'Pocas', mazos: 40, listas: 2 }],
    ['borrado', { nombre: 'Borrado', mazos: 40, listas: 9 }],
    ['other', { nombre: 'Other', mazos: 900, listas: 90 }],
    ['probado', { nombre: 'Probado', mazos: 30, listas: 9 }],
    ['probado-hace', { nombre: 'Probado hace', mazos: 30, listas: 9 }],
    ...Array.from({ length: 30 }, (_, i) => [`relleno-${i}`, { nombre: 'R', mazos: 1, listas: 0 }]),
  ])
  const base = { catalogo, vivos, propios, conocidos: new Set(['borrado', ...catalogo.map((f) => f.id)]), retirados: { dormido: '2026-10-01' }, pendientes: { probado: { fecha: '2026-11-28T05:23:00Z' }, 'probado-hace': { fecha: '2026-11-20T05:23:00Z' } }, ahora }
  const p = F.planDelDia({ ...base, datosFrescos: true })
  check('renombra lo nuestro (la misma hora con o sin microsegundos)', JSON.stringify(p.renombrar) === JSON.stringify([{ id: 'pult', nombre: 'Dragapult ex' }]), JSON.stringify(p.renombrar))
  check('  …y no lo que se ha guardado a mano en /admin', !p.renombrar.some((r) => r.id === 'tocado'))
  check('retira lo nuestro sin mazos en 60 días; no lo que no es nuestro', p.retirar.join() === 'viejo', p.retirar.join())
  check('enciende lo que retiró y vuelve a jugarse; no lo que alguien apagó', p.encender.join() === 'dormido', p.encender.join())
  check('nuevos: no conocidos, con 3 listas, de más a menos mazos; lo descartado, a la semana', p.nuevos.join() === 'nuevo-b,probado-hace,nuevo-a', p.nuevos.join())
  check('con el meta parado no se retira nada', F.planDelDia({ ...base, datosFrescos: false }).retirar.length === 0)
  check('  …ni con pocos arquetipos vivos', F.planDelDia({ ...base, vivos: new Map([...vivos].slice(0, 12)), datosFrescos: true }).retirar.length === 0)
  const muchos = Array.from({ length: 14 }, (_, i) => ({ id: `r${i}`, nombre: 'x', activo: true, updated_at: hora }))
  check('como mucho 10 retiros al día', F.planDelDia({ ...base, catalogo: muchos, propios: Object.fromEntries(muchos.map((f) => [f.id, hora])), datosFrescos: true }).retirar.length === 10)
}

console.log('── una pasada, con la base de mentira ──')
function baseDeMentira({ catalogo, resultados, resumen, metaIds, ultimoTorneo, cartas = [], estado = null }) {
  const T = { tcg_archetypes: catalogo.map((f) => ({ ...f })), estado, llamadas: [] }
  const filtros = (q) => Object.fromEntries([...new URLSearchParams(q)].filter(([k]) => !['select', 'limit', 'order'].includes(k)))
  const contiene = (lista, patron) => Object.entries(patron).every(([s, cs]) => cs.every((c) => (lista?.[s] || []).some((x) => x.name === c.name)))
  async function rest(ruta, _clave, op = {}) {
    const metodo = op.method || 'GET'
    T.llamadas.push(`${metodo} ${ruta.split('?')[0]}`)
    const [tabla, q = ''] = ruta.split('?')
    const f = filtros(q)
    if (tabla === 'scrydex_estado') {
      if (metodo === 'POST') { T.estado = JSON.parse(op.body)[0].valor; return null }
      return T.estado ? [{ valor: JSON.parse(JSON.stringify(T.estado)) }] : []
    }
    if (tabla === 'rpc/meta_resumen') return resumen
    if (tabla === 'meta_arquetipos') return metaIds.map((id) => ({ id }))
    if (tabla === 'meta_torneos') return [{ fecha: ultimoTorneo }]
    if (tabla === 'tcg_archetypes' && metodo === 'GET') return JSON.parse(JSON.stringify(T.tcg_archetypes))
    if (tabla === 'tcg_archetypes' && metodo === 'PATCH') {
      const id = f.id.replace(/^eq\./, '')
      Object.assign(T.tcg_archetypes.find((x) => x.id === id), JSON.parse(op.body))
      return null
    }
    if (tabla === 'tcg_archetypes' && metodo === 'POST') {
      T.cabeceraAlta = op.headers?.prefer
      for (const fila of JSON.parse(op.body)) if (!T.tcg_archetypes.some((x) => x.id === fila.id)) T.tcg_archetypes.push(fila)
      return null
    }
    if (tabla === 'meta_resultados') {
      T.consultasListas = (T.consultasListas || []).concat(q)
      return resultados
        .filter((r) => !f.arquetipo.startsWith('eq.') || r.arquetipo === f.arquetipo.slice(3))
        .filter((r) => !f.arquetipo.startsWith('neq.') || r.arquetipo !== f.arquetipo.slice(4))
        .filter((r) => !String(r.torneo_id).startsWith('pokedoc-'))
        .filter((r) => !f.lista || contiene(r.lista, JSON.parse(f.lista.replace(/^cs\./, ''))))
    }
    if (tabla === 'tcg_cards') {
      const campo = f.name_en ? 'name_en' : 'name'
      T.consultasCartas = (T.consultasCartas || []).concat(f[campo])
      const lista = JSON.parse(`[${f[campo].replace(/^in\.\(/, '').replace(/\)$/, '')}]`)
      return cartas.filter((c) => lista.includes(c[campo]))
    }
    throw new Error(`ruta sin doble: ${metodo} ${ruta}`)
  }
  return { T, rest }
}
const HORA = '2026-11-26T12:00:00.123456+00:00'
const resultado = (arquetipo, lista, torneo_id = 'lt-1') => ({ arquetipo, lista, torneo_id })
const datos = () => ({
  catalogo: [
    { ...CATALOGO[0], iconos: [], updated_at: HORA },
    { ...CATALOGO[1], iconos: [], updated_at: HORA },
    { ...CATALOGO[2], iconos: [], updated_at: HORA },
    { id: 'viejo', nombre: 'Viejo', iconos: [], requiere: [{ nombres: ['Pidgeot ex'] }], activo: true, updated_at: HORA },
    { id: 'a-mano', nombre: 'Martillos', iconos: [], requiere: [{ nombres: ['Crushing Hammer'] }], activo: true, updated_at: HORA },
  ],
  resultados: [
    ...Array.from({ length: 8 }, () => resultado('dragapult-blaziken', PULT_BLAZ())),
    // Una lista de una jornada de PokeDoc no cuenta.
    resultado('dragapult-blaziken', GARDE(), 'pokedoc-4'),
    ...Array.from({ length: 20 }, () => resultado('dragapult', DRAGAPULT())),
    ...Array.from({ length: 10 }, () => resultado('dragapult-dusknoir', PULT_NOIR())),
    ...Array.from({ length: 6 }, () => resultado('gardevoir', GARDE())),
  ],
  resumen: [
    { arquetipo: 'dragapult', nombre: 'Dragapult', iconos: ['dragapult'], mazos: 200, listas: 20 },
    { arquetipo: 'dragapult-dusknoir', nombre: 'Dragapult Dusknoir', iconos: ['dragapult', 'dusknoir'], mazos: 150, listas: 10 },
    { arquetipo: 'gardevoir', nombre: 'Gardevoir ex', iconos: ['gardevoir'], mazos: 90, listas: 6 },
    { arquetipo: 'dragapult-blaziken', nombre: 'Dragapult Blaziken', iconos: ['dragapult', 'blaziken'], mazos: 40, listas: 8 },
    { arquetipo: 'other', nombre: 'Other', iconos: [], mazos: 999, listas: 99 },
    ...Array.from({ length: 30 }, (_, i) => ({ arquetipo: `relleno-${i}`, nombre: 'R', iconos: [], mazos: 1, listas: 0 })),
  ],
  metaIds: ['dragapult', 'dragapult-dusknoir', 'gardevoir', 'viejo', 'dragapult-blaziken', 'other'],
  ultimoTorneo: '2026-11-30T20:00:00Z',
  cartas: [{ name: 'Blaziken ex', name_en: 'Blaziken ex', name_es: 'Blaziken ex' }, { name: 'Órdenes de Jefes', name_en: "Boss's Orders", name_es: 'Órdenes de Jefes' }],
})
const env = { SUPABASE_SERVICE_ROLE_KEY: 'x' }
{
  const { T, rest } = baseDeMentira(datos())
  const ahora = new Date('2026-12-01T05:23:00Z')
  const r = await F.procesar({ env, rest, ahora })
  const nueva = T.tcg_archetypes.find((f) => f.id === 'dragapult-blaziken')
  check('la primera pasada añade Dragapult Blaziken', r.ok && nueva?.activo === true && nueva.nombre === 'Dragapult Blaziken', JSON.stringify(r))
  check('  …con sus requisitos (y el español si lo hay) y sus iconos', nueva?.requiere.some((q) => q.nombres[0] === 'Blaziken ex') && nueva.iconos.length === 2, JSON.stringify(nueva))
  check('  …sin pisar uno que alguien cree a la vez (ignore-duplicates)', /ignore-duplicates/.test(T.cabeceraAlta || ''), T.cabeceraAlta)
  check('  …y la lista de la jornada de PokeDoc no ha contado', (T.consultasListas || []).every((q) => /torneo_id=not\.like\.pokedoc-/.test(q)))
  check('las de los demás se piden por lo que lleva su ancla (cs.)', (T.consultasListas || []).some((q) => /lista=cs\./.test(q) && /arquetipo=neq\.dragapult-blaziken/.test(q)), (T.consultasListas || []).join(' | '))
  check('el nombre con apóstrofo va entre comillas en el in.()', (T.consultasCartas || []).every((q) => /^in\.\(".*"\)$/.test(q)), (T.consultasCartas || []).join(' | '))
  check('retira «viejo» (de Limitless, sin mazos) y no «a-mano» (no es de Limitless)', T.tcg_archetypes.find((f) => f.id === 'viejo').activo === false && T.tcg_archetypes.find((f) => f.id === 'a-mano').activo === true)
  check('renombra Gardevoir como Limitless («Gardevoir ex»)', T.tcg_archetypes.find((f) => f.id === 'gardevoir').nombre === 'Gardevoir ex')
  check('el estado: día hecho, lo nuestro con su hora, lo conocido, lo retirado', T.estado.dia === '2026-12-01' && T.estado.propios['dragapult-blaziken'] && T.estado.conocidos.includes('a-mano') && T.estado.retirados.viejo === '2026-12-01' && T.estado.ultimaPasada.nuevos === 1 && !T.estado.ultimoError, JSON.stringify(T.estado.ultimaPasada))
  const n = T.llamadas.length
  const r2 = await F.procesar({ env, rest, ahora: new Date('2026-12-01T17:23:00Z') })
  check('la segunda del día solo mira: lee y apunta el estado', r2.saltado && T.llamadas.length - n === 2 && T.estado.ultimaMirada, JSON.stringify(T.llamadas.slice(n)))

  // Al día siguiente: alguien edita Dragapult en /admin y borra Dragapult Blaziken.
  T.tcg_archetypes.find((f) => f.id === 'dragapult').updated_at = '2026-12-01T19:00:00+00:00'
  T.tcg_archetypes.find((f) => f.id === 'dragapult').activo = false
  T.tcg_archetypes = T.tcg_archetypes.filter((f) => f.id !== 'dragapult-blaziken')
  const r3 = await F.procesar({ env, rest, ahora: new Date('2026-12-02T05:23:00Z') })
  check('lo borrado en /admin no vuelve', r3.ok && !T.tcg_archetypes.some((f) => f.id === 'dragapult-blaziken'), JSON.stringify(r3))
  check('  …y lo apagado a mano sigue apagado (no lo retiró la pasada)', T.tcg_archetypes.find((f) => f.id === 'dragapult').activo === false)
}
{
  const d = datos()
  const { T, rest } = baseDeMentira({ ...d, ultimoTorneo: '2026-11-20T20:00:00Z' })
  const r = await F.procesar({ env, rest, ahora: new Date('2026-12-01T05:23:00Z') })
  check('con el meta parado (último torneo hace 11 días) no retira nada y lo dice', r.ok && T.tcg_archetypes.find((f) => f.id === 'viejo').activo === true && /no está al día/.test(T.estado.ultimaPasada.retirarBloqueado), JSON.stringify(T.estado.ultimaPasada))
}
{
  const { T, rest } = baseDeMentira(datos())
  const roto = async (ruta, c, op) => { if (ruta.startsWith('rpc/')) throw new Error('Supabase 500: se cayó'); return rest(ruta, c, op) }
  const r = await F.procesar({ env, rest: roto, ahora: new Date('2026-12-01T05:23:00Z') })
  check('si la base falla, al estado (ultimoError con fecha, para el semáforo) y sin día hecho', !r.ok && /se cayó/.test(T.estado.ultimoError?.motivo) && T.estado.ultimoError.fecha && !T.estado.dia, JSON.stringify(T.estado))
  check('sin la clave, ni lo intenta', (await F.procesar({ env: {}, rest })).error === 'Falta SUPABASE_SERVICE_ROLE_KEY')
}

console.log('── la programación y /admin ──')
{
  const fuente = readFileSync(`${REPO}/netlify/functions/arquetipos-limitless.mjs`, 'utf8')
  check('dos veces al día', /schedule: '23 5,17 \* \* \*'/.test(fuente))
  const S = await import(`${REPO}/admin/js/semaforo.js`)
  check('el semáforo de /admin la mira', S.PASADAS.some(([k]) => k === F.CLAVE_ESTADO))
  const admin = readFileSync(`${REPO}/admin/js/admin.js`, 'utf8')
  check('/admin enseña el estado en Arquetipos', admin.includes(`'${F.CLAVE_ESTADO}'`))
}

console.log(fails ? `\n${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
