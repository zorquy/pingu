// Tanda 1419 — El color de cada ilustración, en el servidor.
//   · La migración contra PostgreSQL: la tabla se lee sin cuenta; solo el
//     equipo corrige (`admin_color_corregir`), con un grupo conocido; lo que
//     escribe la función (merge) no pisa la corrección; repetible y sin
//     tablas temporales. Y su lista de grupos es la de `GRUPOS`.
//   · La función: con la vuelta hecha hace UNA consulta y se va; recorre la
//     cola, deja fuera energías y cartas normales, apunta las que no se leen
//     con su intento, saca de la cola la expansión hecha y marca la vuelta;
//     sin la tabla, lo dice.
//   · `huellaDeFotos` con sharp de verdad: una foto verde sale verde, y si la
//     primera dirección falla prueba la siguiente.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
const REPO = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }
const F = await import(`${REPO}/netlify/functions/colores-cartas.mjs`)
const C = await import(`${REPO}/js/mi-coleccion/color-de-carta.js`)
const mig = readFileSync(`${REPO}/supabase-migration-1419-colores-de-cartas.sql`, 'utf8')

console.log('── la lista de grupos ──')
{
  const enLaBase = [...mig.matchAll(/\bin \(('rojo'[^)]*)\)/g)].map((m) => m[1].match(/'([^']+)'/g).map((x) => x.slice(1, -1)).join())
  check('los dos check de la tabla y el de la función dicen GRUPOS', enLaBase.length === 3 && enLaBase.every((l) => l === C.GRUPOS.join()), enLaBase.join(' | '))
  check('sin tablas temporales', !/create\s+temp(orary)?\s+table/i.test(mig))
}

console.log('── lo puro de la función ──')
{
  const carta = (id, rarity, extra = {}) => ({ id, market: 'WEST', set_id: 'sv8', local_id: id.split('-')[1], name: `C ${id}`, image_path: `sv/sv8/${id.split('-')[1]}`, rarity, category: 'Pokemon', ...extra })
  const cartas = [carta('sv8-1', 'Illustration Rare'), carta('sv8-2', 'Common'), carta('sv8-3', 'Hyper rare', { category: 'Energy', name: 'Fire Energy' }), carta('sv8-4', 'Special Illustration Rare'), carta('sv8-5', 'Ultra Rare'), carta('sv8-6', 'Illustration Rare')]
  const filas = [{ card_id: 'sv8-4', market: 'WEST', huella_ok: [1], intentos: 0 }, { card_id: 'sv8-5', market: 'WEST', huella_ok: null, intentos: 3 }, { card_id: 'sv8-6', market: 'WEST', huella_ok: null, intentos: 0 }]
  const p = F.pendientesDe(cartas, filas).map((x) => x.carta.id)
  check('pendientes: sin fila o sin huella con menos de 3 intentos; ni comunes ni energías', p.join() === 'sv8-1,sv8-6', p.join())
  const ahora = new Date('2026-11-23T12:00:00Z')
  check('vuelta hecha hace 3 días: no toca', !F.tocaVuelta({ vueltaAcabada: '2026-11-20T12:00:00Z' }, ahora))
  check('hace 8 días, o nunca: toca', F.tocaVuelta({ vueltaAcabada: '2026-11-15T12:00:00Z' }, ahora) && F.tocaVuelta({}, ahora))
}

console.log('── una pasada, con la base de mentira ──')
{
  const ahora = new Date('2026-11-23T12:00:00Z')
  const H = (color) => ({ labs: [[0.5, 0.1, 0.05]], pesos: [1], croma: 0.1, luz: 0.5, bordes: {}, colores: { color, paleta: [], luz: 0.5 } })
  const doble = (estado, { sinTabla = false } = {}) => {
    const llamadas = []
    const escrito = { estado: null, filas: [] }
    const rest = async (ruta, _c, op = {}) => {
      llamadas.push(`${op.method || 'GET'} ${ruta.split('?')[0]}`)
      if (ruta.startsWith('scrydex_estado') && op.method === 'POST') { escrito.estado = JSON.parse(op.body)[0].valor; return null }
      if (ruta.startsWith('scrydex_estado')) return [{ valor: estado }]
      if (ruta.startsWith('tcg_sets')) return [{ id: 'sv9', market: 'WEST' }, { id: 'sv8', market: 'WEST' }]
      if (ruta.startsWith('tcg_cards')) {
        const set = decodeURIComponent(ruta.match(/set_id=eq\.([^&]+)/)[1])
        if (set === 'sv9') return [{ id: 'sv9-1', market: 'WEST', set_id: 'sv9', local_id: '1', rarity: 'Illustration Rare', category: 'Pokemon', image_path: 'sv/sv9/1' }]
        return [1, 2, 3].map((n) => ({ id: `sv8-${n}`, market: 'WEST', set_id: 'sv8', local_id: String(n), rarity: n === 2 ? 'Common' : 'Illustration Rare', category: 'Pokemon', image_path: `sv/sv8/${n}` }))
      }
      if (ruta.startsWith('tcg_card_colores') && op.method === 'POST') { escrito.filas.push(...JSON.parse(op.body)); return null }
      if (ruta.startsWith('tcg_card_colores')) { if (sinTabla) throw new Error('Supabase 404: {"code":"42P01","message":"relation \\"public.tcg_card_colores\\" does not exist"}'); return [] }
      return []
    }
    return { rest, llamadas, escrito }
  }
  // Se lee todo menos la 3 de sv8 (sin foto legible).
  const pedidas = []
  const leer = async (urls) => { pedidas.push(urls[0]); return /sv8\/3/.test(urls.join()) ? null : { huella: H('verde'), foto: urls[0] } }
  const env = { SUPABASE_SERVICE_ROLE_KEY: 'k' }

  const hecha = doble({ vueltaAcabada: '2026-11-21T00:00:00Z', cola: [] })
  const r0 = await F.procesar({ env, rest: hecha.rest, leer, ahora })
  check('con la vuelta hecha: una consulta (el estado) y se va', r0.saltado && hecha.llamadas.length === 1, JSON.stringify({ r0, l: hecha.llamadas }))

  const d = doble({})
  const r = await F.procesar({ env, rest: d.rest, leer, ahora })
  check('recorre las dos expansiones', r.ok && r.expansiones === 2 && r.quedan === 0, JSON.stringify(r))
  const porId = Object.fromEntries(d.escrito.filas.map((f) => [f.card_id, f]))
  check('escribe las ilustraciones y no la común', Object.keys(porId).sort().join() === 'sv8-1,sv8-3,sv9-1', Object.keys(porId).join())
  check('la leída lleva su huella, su color y la foto', porId['sv8-1']?.huella?.colores?.color === 'verde' && porId['sv8-1'].color === 'verde' && /tcgdex/.test(porId['sv8-1'].foto) && porId['sv8-1'].intentos === 0, JSON.stringify(porId['sv8-1']))
  check('la que no se lee: huella nula y un intento', porId['sv8-3']?.huella === null && porId['sv8-3'].intentos === 1, JSON.stringify(porId['sv8-3']))
  check('no manda la corrección del equipo (no la pisa)', d.escrito.filas.every((f) => !('color_admin' in f)))
  check('pide la foto GRANDE', pedidas.length && pedidas.every((u) => /\/high\./.test(u)), pedidas.join(' '))
  check('marca la vuelta acabada y lo apunta en el estado', d.escrito.estado?.vueltaAcabada === ahora.toISOString() && d.escrito.estado.cola.length === 0 && d.escrito.estado.ultimaPasada?.leidas === 2 && d.escrito.estado.ultimaPasada?.fallidas === 1, JSON.stringify(d.escrito.estado))

  // Sin tiempo para acabar una expansión: se queda en la cola.
  let t = 0
  const lenta = doble({})
  const r2 = await F.procesar({ env, rest: lenta.rest, leer: async (u) => { t += 30_000; return leer(u) }, ahora, reloj: () => t })
  check('si se acaba el tiempo a mitad, la expansión sigue en la cola', r2.ok && lenta.escrito.estado.cola.length >= 1 && !lenta.escrito.estado.vueltaAcabada, JSON.stringify(lenta.escrito.estado))

  const sin = doble({}, { sinTabla: true })
  const r3 = await F.procesar({ env, rest: sin.rest, leer, ahora })
  check('sin la migración, lo dice y no falla', r3.ok && /1419/.test(r3.saltado || ''), JSON.stringify(r3))

  const una = doble({ vueltaAcabada: '2026-11-22T00:00:00Z', cola: [] })
  const r4 = await F.procesar({ env, rest: una.rest, leer, ahora, soloSet: { id: 'sv8', market: 'WEST' } })
  check('«Calcular ahora» de una expansión, aunque la vuelta esté hecha', r4.ok && r4.expansiones === 1 && una.escrito.filas.length === 2 && una.escrito.estado === null, JSON.stringify(r4))
}

console.log('── huellaDeFotos, con sharp ──')
{
  const sharp = (await import(`${REPO}/node_modules/sharp/lib/index.js`)).default
  const png = await sharp({ create: { width: 245, height: 342, channels: 3, background: { r: 46, g: 125, b: 50 } } }).png().toBuffer()
  const pedidas = []
  const fetchImpl = async (u) => { pedidas.push(u); return u.includes('mala') ? new Response('no', { status: 404 }) : new Response(png, { headers: { 'content-type': 'image/png' } }) }
  const r = await F.huellaDeFotos(['https://mala.example/1.png', 'https://buena.example/1.png'], { fetchImpl, sharp })
  check('una foto verde sale verde', r?.huella?.colores?.color === 'verde' && r.huella.labs.length === 3, JSON.stringify(r?.huella?.colores))
  check('prueba la siguiente si la primera falla, y dice cuál leyó', pedidas.length === 2 && r.foto === 'https://buena.example/1.png')
}

console.log('── la migración, contra PostgreSQL ──')
const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q']
const psql = (args, input) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 60000, input })
const BD = 'prueba_1419'
const ADMIN = '00000000-0000-0000-0000-000000000001'
const OTRO = '00000000-0000-0000-0000-000000000002'
const q = (s, { como = null, rol = null } = {}) => {
  const pre = `${como ? `set request.jwt.claim.sub = '${como}';` : 'reset request.jwt.claim.sub;'} ${rol ? `set role ${rol};` : ''}`
  const r = psql(['-At', '-d', BD, '-c', `${pre} ${s}`])
  return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() }
}
const hay = psql(['-c', 'select 1'])
check('hay un PostgreSQL en /var/tmp:5433', hay.status === 0, hay.stderr)
if (hay.status === 0) {
  psql(['-c', `drop database if exists ${BD}`]); psql(['-c', `create database ${BD}`])
  const base = psql(['-d', BD, '-f', '-'], `
    do $$ begin create role anon; exception when duplicate_object then null; end $$;
    do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
    grant usage on schema public to anon, authenticated;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create table public.user_profiles (id uuid primary key, is_admin boolean default false);
    insert into public.user_profiles values ('${ADMIN}', true), ('${OTRO}', false);
    create function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$ select coalesce((select is_admin from public.user_profiles where id = auth.uid()), false) $$;
    grant execute on function public.is_admin() to anon, authenticated;
  `)
  check('la base de mentira', base.status === 0, base.stderr)
  // Sentencia a sentencia, cada una en su conexión (la 631), y DOS veces.
  // Se parte por los «;» de fin de línea que no estén dentro de un $$ … $$.
  const sentencias = []
  let actual = '', dentro = false
  for (const linea of mig.split('\n')) {
    if (/^\s*--/.test(linea) && !dentro) continue
    actual += linea + '\n'
    if ((linea.match(/\$\$/g) || []).length % 2) dentro = !dentro
    if (!dentro && /;\s*$/.test(linea)) { if (actual.trim()) sentencias.push(actual.trim()); actual = '' }
  }
  let bien = true
  for (let v = 0; v < 2; v++) for (const s of sentencias) { const r = psql(['-d', BD, '-c', s.endsWith(';') ? s : `${s};`]); if (r.status !== 0) { bien = false; console.log(r.stderr.slice(0, 300)) } }
  check(`la migración corre sentencia a sentencia, dos veces (${sentencias.length} sentencias)`, bien)
  q(`insert into public.tcg_card_colores (card_id, market, huella, color) values ('sv8-1', 'WEST', '{"labs":[]}', 'verde')`)
  check('cualquiera la lee, también sin cuenta', q(`select color from public.tcg_card_colores where card_id = 'sv8-1'`, { rol: 'anon' }).out === 'verde')
  check('sin cuenta no se escribe', !q(`insert into public.tcg_card_colores (card_id) values ('x')`, { rol: 'anon' }).ok)
  const noAdmin = q(`select public.admin_color_corregir('sv8-1', 'WEST', 'rojo')`, { como: OTRO, rol: 'authenticated' })
  check('alguien que no es del equipo no corrige', !noAdmin.ok && /Solo el equipo/.test(noAdmin.err), noAdmin.err)
  check('anon ni siquiera puede llamarla', !q(`select public.admin_color_corregir('sv8-1', 'WEST', 'rojo')`, { rol: 'anon' }).ok)
  const si = q(`select public.admin_color_corregir('sv8-1', 'WEST', 'rojo')`, { como: ADMIN, rol: 'authenticated' })
  check('el equipo corrige', si.ok && q(`select color || '/' || color_admin from public.tcg_card_colores where card_id = 'sv8-1'`).out === 'verde/rojo', si.err)
  check('un grupo que no existe, no', !q(`select public.admin_color_corregir('sv8-1', 'WEST', 'fucsia')`, { como: ADMIN, rol: 'authenticated' }).ok)
  check('corregir una que aún no tiene fila la crea', q(`select public.admin_color_corregir('sv8-9', 'WEST', 'azul')`, { como: ADMIN, rol: 'authenticated' }).ok && q(`select color_admin from public.tcg_card_colores where card_id = 'sv8-9'`).out === 'azul')
  // La función escribe con merge: solo sus columnas.
  q(`insert into public.tcg_card_colores (card_id, market, huella, color, foto, intentos) values ('sv8-1', 'WEST', '{"labs":[1]}', 'amarillo', 'f', 0) on conflict (card_id, market) do update set huella = excluded.huella, color = excluded.color, foto = excluded.foto, intentos = excluded.intentos`)
  check('una pasada nueva no pisa la corrección', q(`select color || '/' || color_admin from public.tcg_card_colores where card_id = 'sv8-1'`).out === 'amarillo/rojo')
  check('quitarla con null', q(`select public.admin_color_corregir('sv8-1', 'WEST', null)`, { como: ADMIN, rol: 'authenticated' }).ok && q(`select coalesce(color_admin, '-') from public.tcg_card_colores where card_id = 'sv8-1'`).out === '-')
  psql(['-c', `drop database if exists ${BD}`])
}

console.log(fails ? `\n${fails} FALLAN` : '\n    ✅ todo en verde')
process.exit(fails ? 1 : 0)
