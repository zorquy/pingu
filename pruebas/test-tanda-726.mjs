// Tanda 726 — el aviso de «¡sale hoy!» también para los sets del CATÁLOGO
// (X10 de la lista: la cuenta atrás y el aviso ya existían, pero el aviso
// solo leía la lista a mano de /admin, y desde la 656 el calendario sale
// sobre todo de `tcg_sets`).
//
// Lo que se mira: que un set del catálogo que sale hoy se avise; que el
// mismo set en la lista y en el catálogo se avise UNA vez; que lo ya
// avisado no se repita; que se apunte ANTES de mandar (la 665); y que si
// el catálogo no contesta, la lista se avise igual.
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const { procesar, setsDeHoy } = await import(`${RAIZ}/netlify/functions/lanzamiento-push.mjs`)

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 260) : ''}`)
}
const HOY = '2026-11-07'
const ahora = new Date(`${HOY}T07:15:00Z`)

console.log('── 1. La regla ──')
const lista = [{ nombre: 'Fuerzas Temporales', fecha: HOY, notas: 'preventa' }, { nombre: 'Otro', fecha: '2026-12-01' }]
const catalogo = [{ name: 'Fuerzas Temporales', release_date: HOY }, { name: 'Llamas Fantasmales', release_date: `${HOY}T00:00:00` }, { name: 'Viejo', release_date: '2020-01-01' }]
const hoy = setsDeHoy({ lista, catalogo, hoy: HOY })
check('los de hoy de las dos fuentes, sin repetir el que está en las dos', JSON.stringify(hoy.map((s) => s.nombre)) === JSON.stringify(['Fuerzas Temporales', 'Llamas Fantasmales']), JSON.stringify(hoy))
check('  …y la nota de la lista se conserva', hoy[0].notas === 'preventa')
check('lo ya avisado no vuelve', setsDeHoy({ lista, catalogo, hoy: HOY, avisados: new Set([`${HOY}|Llamas Fantasmales`]) }).map((s) => s.nombre).join() === 'Fuerzas Temporales')

console.log('── 2. La pasada entera ──')
const ENV = { SUPABASE_SERVICE_ROLE_KEY: 'x', PUSH_VAPID_PRIVATE: 'y' }
const montar = ({ catalogoFalla = false } = {}) => {
  const llamadas = []
  const rest = async (ruta, _c, op = {}) => {
    llamadas.push(`${op.method || 'GET'} ${ruta.split('?')[0]}`)
    if (ruta.startsWith('site_settings?key=')) return [{ key: 'push_vapid_public', value: { clave: 'pub' } }, { key: 'lanzamientos', value: { sets: lista } }, { key: 'lanzamientos_avisados', value: { claves: [] } }]
    if (ruta.startsWith('tcg_sets')) { if (catalogoFalla) throw new Error('500'); return catalogo.filter((c) => c.release_date.startsWith(HOY)) }
    if (ruta.startsWith('push_subscriptions')) return [{ endpoint: 'e1', p256dh: 'p', auth: 'a' }]
    return null
  }
  const enviados = []
  const enviar = async (_s, cuerpo) => { llamadas.push('PUSH'); enviados.push(JSON.parse(cuerpo).title) }
  return { rest, enviar, llamadas, enviados }
}
{
  const m = montar()
  const r = await procesar({ env: ENV, rest: m.rest, enviar: m.enviar, ahora })
  check('se avisan los dos (uno de la lista, uno solo del catálogo)', r.sets === 2 && m.enviados.join() === '¡Fuerzas Temporales ya está aquí!,¡Llamas Fantasmales ya está aquí!', JSON.stringify(m.enviados))
  const apunta = m.llamadas.indexOf('POST site_settings')
  check('se apuntan como avisados ANTES del primer envío', apunta >= 0 && apunta < m.llamadas.indexOf('PUSH'), m.llamadas.join(' → '))
}
{
  const m = montar({ catalogoFalla: true })
  const r = await procesar({ env: ENV, rest: m.rest, enviar: m.enviar, ahora })
  check('si el catálogo no contesta, la lista se avisa igual', r.sets === 1 && m.enviados.join() === '¡Fuerzas Temporales ya está aquí!', JSON.stringify(m.enviados))
}

console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
