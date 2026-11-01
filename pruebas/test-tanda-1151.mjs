// Tanda 1151 — las promos MEP se repasan cada semana.
//
// Asier, en el foro: «faltan ciertas MEP, por ejemplo la de Mega Darkrai, MEP
// 90». La 1000 trajo la expansión de TCGGO UNA vez (el 25 de octubre) y las
// promos siguen saliendo. Ahora `mep-promos` lleva `cadaDias: 7` y
// `rehacerDesde` (que la vuelve a pasar ya), y una entrada hecha SIN
// `cadaDias` no se repite nunca, como antes.
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const R = await import(`${RAIZ}/netlify/functions/tcggo-reemplazar-set.mjs`)
const ENV = { SUPABASE_SERVICE_ROLE_KEY: 'k', TCGGO_API_KEY: 't' }

console.log('── 1. La entrada y la regla ──')
const mep = R.REEMPLAZOS.find((x) => x.clave === 'mep-promos')
check('MEP se repasa cada 7 días y sigue sin borrar', mep?.cadaDias === 7 && mep.sinBorrar && mep.conservarPorNumero && !mep.entero, JSON.stringify(mep))
check('  …y se vuelve a pasar desde el 1 de noviembre', Date.parse(mep?.rehacerDesde) === Date.parse('2026-11-01T00:00:00Z'))
check('solo MEP se repasa (las demás son de una vez)', R.REEMPLAZOS.filter((x) => x.cadaDias).map((x) => x.clave).join() === 'mep-promos')
const T = R.tocaRepasar
const d = (s) => new Date(s)
check('sin hacer, toca', T(mep, undefined, d('2026-11-01T10:00:00Z')) === true)
check('hecha el 25 de octubre: toca ya (de antes de «rehacerDesde»)', T(mep, { fecha: '2026-10-25T06:00:00Z' }, d('2026-11-01T10:00:00Z')) === true)
check('hecha hoy: no toca hasta dentro de 7 días', T(mep, { fecha: '2026-11-01T10:05:00Z' }, d('2026-11-05T10:00:00Z')) === false)
check('  …y a los 7 días, sí', T(mep, { fecha: '2026-11-01T10:05:00Z' }, d('2026-11-08T10:06:00Z')) === true)
check('una fecha que no se lee no se repite (sería cada cinco minutos)', T(mep, { fecha: 'x' }, d('2027-01-01T00:00:00Z')) === false)
check('una entrada de una vez, hecha, no vuelve nunca', T({ clave: 'a' }, { fecha: '2020-01-01T00:00:00Z' }, d('2027-01-01T00:00:00Z')) === false)
check('«rehacerDesde» en el futuro no adelanta nada', T({ cadaDias: 7, rehacerDesde: '2026-12-01T00:00:00Z' }, { fecha: '2026-11-01T00:00:00Z' }, d('2026-11-03T00:00:00Z')) === false)

console.log('\n── 2. La pasada ──')
const pasar = async (estados, ahora) => {
  let opciones = null
  const r = await R.pasada({
    env: ENV, ahora,
    restImpl: async (ruta) => (/^tcg_sets\?.*id=eq\.mep/.test(ruta) ? [{ id: 'mep', name: 'MEP Black Star Promos', tcggo_id: 777 }] : []),
    estadoImpl: async (k) => estados[k] || {},
    guardarEstadoImpl: async (k, v) => { estados[k] = JSON.parse(JSON.stringify(v)) },
    procesarImpl: async (o) => { opciones = o; return { ok: true, suyas: 91, nuevas: 4, fueraDeSuLista: 0 } },
  })
  return { r, opciones }
}
{
  // Todo hecho con fechas de verdad; MEP el 25 de octubre, con un fallo suelto apuntado.
  const hechos = Object.fromEntries(R.REEMPLAZOS.map((x) => [x.clave, { fecha: '2026-10-25T06:00:00Z', episodio: 1 }]))
  const estados = { tcggo_reemplazos: { hechos, intentos: { 'mep-promos': 2 } }, tcggo_pares: {} }
  const { opciones } = await pasar(estados, d('2026-11-01T10:00:00Z'))
  check('el 1 de noviembre se vuelve a pasar MEP (y nada más)', opciones?.destino === 'mep' && opciones.sinBorrar === true, JSON.stringify(opciones))
  const h = estados.tcggo_reemplazos.hechos['mep-promos']
  check('  …queda hecha con la fecha de hoy y lo nuevo en el resumen', h?.fecha === '2026-11-01T10:00:00.000Z' && h.resumen?.nuevas === 4, JSON.stringify(h))
  check('  …y sus intentos vuelven a cero', !estados.tcggo_reemplazos.intentos['mep-promos'], JSON.stringify(estados.tcggo_reemplazos.intentos))
  const otra = await pasar(estados, d('2026-11-01T10:05:00Z'))
  check('cinco minutos después no se repite', otra.opciones === null && otra.r.ok, JSON.stringify(otra.r).slice(0, 160))
  const semana = await pasar(estados, d('2026-11-08T10:01:00Z'))
  check('a la semana, otra vez', semana.opciones?.destino === 'mep', JSON.stringify(semana.opciones))
}

console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
