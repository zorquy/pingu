// Tanda 993 — los avisos: uno por respuesta en el foro, y los push que se ven.
//
// PINGU: «si me responden un tema que yo he abierto, me llegan dos
// notificaciones» y «las notificaciones push creo que no funcionan». La
// migración contra PostgreSQL de verdad (quien ya avisó la web no recibe el
// segundo), `enviar-push` y `push-prueba` ejecutados enteros con dobles (lo
// que falla queda en el estado, con su motivo), y las piezas de la web.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
const AQUI = new URL('.', import.meta.url).pathname
const REPO = '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const leer = (f) => readFileSync(join(REPO, f), 'utf8')

// ── 1. La migración ─────────────────────────────────────────────────────
console.log('· La migración 993 contra PostgreSQL')
const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q']
const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 60000 })
const BD = 'prueba_993'
const A = '00000000-0000-0000-0000-0000000000a1'
const B = '00000000-0000-0000-0000-0000000000b2'
const C = '00000000-0000-0000-0000-0000000000c3'
const D = '00000000-0000-0000-0000-0000000000d4'
const TEMA = '00000000-0000-0000-0000-00000000aaaa'
const POST = '00000000-0000-0000-0000-00000000bbbb'
const como = (uid, s) => {
  const r = psql(['-t', '-A', '-d', BD, '-c', `begin; set local role authenticated; set local prueba.uid = '${uid}'; ${s}; commit;`])
  return { ok: r.status === 0, out: (r.stdout || '').trim().split('\n').filter((l) => l !== 'BEGIN' && l !== 'COMMIT' && l !== 'SET').join('\n'), err: (r.stderr || '').trim() }
}
const sql = (s) => { const r = psql(['-t', '-A', '-d', BD, '-c', s]); return (r.stdout || '').trim() + (r.status ? ` ERROR ${r.stderr}` : '') }
if (psql(['-c', 'select 1']).status !== 0) {
  check('PostgreSQL en el 5433 (si no, se arranca con pg_ctl -D /var/tmp/pg364)', false)
} else {
  psql(['-c', `drop database if exists ${BD}`])
  psql(['-c', `create database ${BD}`])
  let r = psql(['-d', BD, '-f', join(AQUI, 'sql-tanda-993.sql')])
  check('el andamio se monta', r.status === 0, r.stderr)
  // Sentencia a sentencia, cada una en su conexión (la 631).
  const sentencias = leer('supabase-migration-993-avisos-sin-duplicar.sql')
  for (let vuelta = 1; vuelta <= 2; vuelta++) {
    r = psql(['-d', BD, '-f', join(REPO, 'supabase-migration-993-avisos-sin-duplicar.sql')])
    check(`la migración corre (vuelta ${vuelta}: se puede repetir)`, r.status === 0, r.stderr)
  }
  check('la firma vieja de tres argumentos ya no existe (si no, PostgREST no sabría a cuál llamar)',
    sql(`select count(*) from pg_proc where proname = 'forum_avisar_suscritos'`) === '1')
  check('authenticated puede ejecutarla', sql(`select has_function_privilege('authenticated', 'public.forum_avisar_suscritos(uuid,uuid,text,uuid[])', 'execute')`) === 't')
  check('el cuarto argumento lleva su comentario de por qué', /p_ya_avisados/.test(sentencias))

  // B responde. La web ya ha avisado a A (es su tema): la función solo avisa a C y D.
  let x = como(B, `select public.forum_avisar_suscritos('${TEMA}', '${POST}', 'Mi tema', array['${A}']::uuid[])`)
  check('con p_ya_avisados = [A] avisa a dos (C y D)', x.ok && x.out === '2', x.err || x.out)
  check('A no recibe «Nueva respuesta en un tema que sigues»', sql(`select count(*) from user_notifications where recipient_id = '${A}'`) === '0')
  check('B (quien escribe) tampoco', sql(`select count(*) from user_notifications where recipient_id = '${B}'`) === '0')
  check('C y D sí, una vez cada uno', sql(`select string_agg(recipient_id::text || ':' || n, ',' order by recipient_id) from (select recipient_id, count(*) n from user_notifications group by 1) q`) === `${C}:1,${D}:1`)
  sql('truncate user_notifications')

  // Llamada con la firma vieja (una pestaña con el JS de antes): sigue valiendo.
  x = como(B, `select public.forum_avisar_suscritos('${TEMA}', '${POST}', 'Mi tema')`)
  check('con tres argumentos avisa a todos los que siguen menos a quien escribe (3)', x.ok && x.out === '3', x.err || x.out)
  sql('truncate user_notifications')
  x = como(B, `select public.forum_avisar_suscritos('${TEMA}', '${POST}', 'Mi tema', null)`)
  check('p_ya_avisados a null no rompe (avisa a los 3)', x.ok && x.out === '3', x.err || x.out)
  sql('truncate user_notifications')

  // Que no se pueda usar para avisar en nombre de otro.
  x = como(C, `select public.forum_avisar_suscritos('${TEMA}', '${POST}', 'Mi tema', '{}')`)
  check('con un mensaje que no es tuyo no avisa a nadie', x.ok && x.out === '0', x.err || x.out)
  sql(`update user_profiles set notification_prefs_disabled = array['forum_reply'] where id = '${D}'`)
  x = como(B, `select public.forum_avisar_suscritos('${TEMA}', '${POST}', 'Mi tema', array['${A}']::uuid[])`)
  check('quien apagó los avisos de respuestas no recibe nada (queda C)', x.ok && x.out === '1', x.err || x.out)
  psql(['-c', `drop database if exists ${BD}`])
}

// ── 2. La web le pasa a quién ya avisó ──────────────────────────────────
console.log('· La web')
const tema = leer('js/tema.js')
check('tema.js le pasa los destinatarios a avisarSuscritos', /avisarSuscritos\(tema\.id, mio\.id, tema\.title, destinatarios\)/.test(tema))
const lecturas = leer('js/foro-lecturas.js')
check('avisarSuscritos manda p_ya_avisados', /p_ya_avisados: \[\.\.\.yaAvisados\]/.test(lecturas))
check('…y si la base aún no tiene la 993, llama con la firma vieja', /PGRST202[\s\S]{0,200}rpc\('forum_avisar_suscritos', base\)/.test(lecturas))
check('el semáforo de /admin tiene «Avisos push»', /\['enviar_push', 'Avisos push'\]/.test(leer('admin/js/semaforo.js')))
const ajustes = leer('js/ajustes.js')
check('/ajustes tiene «Enviarme un aviso de prueba»', /id="ajPushProbar"[^>]*>Enviarme un aviso de prueba</.test(ajustes))
check('/ajustes vuelve a dar de alta el dispositivo al pintar los avisos', /sincronizarPush\(/.test(ajustes))
const push = leer('js/push.js')
check('push.js exporta sincronizarPush y probarPush', /export async function sincronizarPush/.test(push) && /export async function probarPush/.test(push))

// ── 3. enviar-push: lo que pasa va al estado ────────────────────────────
console.log('· enviar-push')
const { procesar, CLAVE_ESTADO } = await import(`${REPO}/netlify/functions/enviar-push.mjs`)
check('la clave de estado es enviar_push', CLAVE_ESTADO === 'enviar_push')
const doble = (tablas = {}) => {
  const llamadas = []
  const estado = []
  const rest = async (ruta, _clave, op = {}) => {
    llamadas.push({ ruta, metodo: op.method || 'GET', cuerpo: op.body })
    if (ruta === 'scrydex_estado') { estado.push(JSON.parse(op.body)[0]); return null }
    if (tablas.falla && ruta.startsWith(tablas.falla)) throw new Error('Supabase 400: column user_notifications.pushed_at does not exist')
    if (ruta.startsWith('site_settings')) return tablas.publica ? [{ value: { clave: tablas.publica } }] : []
    if (ruta.startsWith('user_notifications?pushed_at')) return tablas.avisos || []
    if (ruta.startsWith('push_subscriptions?user_id')) return tablas.subs || []
    return null
  }
  return { rest, llamadas, estado }
}
const ENV = { SUPABASE_SERVICE_ROLE_KEY: 'srv', PUSH_VAPID_PRIVATE: 'priv' }
const ahora = new Date('2026-10-23T10:00:00Z')

let d = doble({ publica: 'pub' })
let res = await procesar({ env: { SUPABASE_SERVICE_ROLE_KEY: 'srv' }, rest: d.rest, ahora })
check('sin la clave privada se salta…', res.saltado && /PUSH_VAPID_PRIVATE/.test(res.saltado))
check('…y lo apunta como parado (el semáforo en rojo)', d.estado[0]?.clave === 'enviar_push' && /PUSH_VAPID_PRIVATE/.test(d.estado[0]?.valor?.parado?.motivo || ''), JSON.stringify(d.estado))

d = doble({})
res = await procesar({ env: ENV, rest: d.rest, ahora })
check('sin la clave pública, parado con «genérala en /admin»', /admin/.test(d.estado[0]?.valor?.parado?.motivo || ''), JSON.stringify(d.estado))

d = doble({ publica: 'pub', avisos: [] })
res = await procesar({ env: ENV, rest: d.rest, ahora })
check('sin avisos nuevos apunta la pasada (hecho, 0) y sin parado', d.estado[0]?.valor?.hecho === true && !d.estado[0]?.valor?.parado && d.estado[0]?.valor?.ultimaPasada === ahora.toISOString(), JSON.stringify(d.estado))

const avisos = [{ id: 1, recipient_id: 'u1', type: 'forum_reply', title: 'Hola', body: 'b', link: '/tema/x' }, { id: 2, recipient_id: 'u2', type: 'x', title: 'T', body: '', link: '/' }]
const subs = [{ endpoint: 'https://push/ok', user_id: 'u1', p256dh: 'p', auth: 'a' }, { endpoint: 'https://push/muerta', user_id: 'u1', p256dh: 'p', auth: 'a' }, { endpoint: 'https://push/clave', user_id: 'u2', p256dh: 'p', auth: 'a' }]
const enviados = []
const enviar = async (sub, cuerpo) => {
  if (sub.endpoint.endsWith('muerta')) throw Object.assign(new Error('gone'), { statusCode: 410 })
  if (sub.endpoint.endsWith('clave')) throw Object.assign(new Error('x'), { statusCode: 403, body: 'the VAPID credentials in the authorization header do not correspond' })
  enviados.push({ sub, cuerpo: JSON.parse(cuerpo) })
}
d = doble({ publica: 'pub', avisos, subs })
res = await procesar({ env: ENV, rest: d.rest, enviar, ahora })
check('envía a la buena', res.enviados === 1 && enviados[0]?.cuerpo?.title === 'Hola' && enviados[0]?.cuerpo?.link === 'https://pokedoc.es/tema/x', JSON.stringify(res))
check('la caducada (410) se borra', d.llamadas.some((l) => l.metodo === 'DELETE' && l.ruta.includes(encodeURIComponent('https://push/muerta'))) && res.caducadas === 1)
check('la que falla por otra cosa (403) NO se borra', !d.llamadas.some((l) => l.metodo === 'DELETE' && l.ruta.includes(encodeURIComponent('https://push/clave'))))
check('…cuenta como fallida', res.fallidos === 1, JSON.stringify(res))
const v = d.estado.at(-1)?.valor || {}
check('…y su motivo queda en el estado (ultimoError) con la fecha', /403/.test(v.ultimoError?.motivo || '') && /VAPID/.test(v.ultimoError?.motivo || '') && v.ultimoError?.fecha === ahora.toISOString(), JSON.stringify(v))
check('el estado cuenta enviados, fallidos, revisados y suscripciones', v.enviados === 1 && v.fallidos === 1 && v.revisados === 2 && v.suscripciones === 3, JSON.stringify(v))
check('los dos avisos quedan marcados como revisados', d.llamadas.some((l) => l.metodo === 'PATCH' && l.ruta === 'user_notifications?id=in.(1,2)'))

d = doble({ publica: 'pub', falla: 'user_notifications?pushed_at' })
res = await procesar({ env: ENV, rest: d.rest, enviar, ahora })
check('si la base falla, no se escapa: devuelve ok:false…', res.ok === false && /pushed_at/.test(res.error || ''), JSON.stringify(res))
check('…y lo apunta en el estado', /pushed_at/.test(d.estado.at(-1)?.valor?.ultimoError?.motivo || ''), JSON.stringify(d.estado))

// El semáforo lo pinta como toca (lo de rojo con `parado`).
const sem = await import(`${REPO}/admin/js/semaforo.js`).catch((e) => ({ error: e }))
const luz = sem.semaforoDe?.({ clave: 'enviar_push', valor: { parado: { motivo: 'x' } }, updated_at: ahora.toISOString() }, ahora)
check('semáforo: una pasada parada sale en rojo', JSON.stringify(luz || {}).includes('rojo'), JSON.stringify(luz || sem.error))

// ── 4. push-prueba ──────────────────────────────────────────────────────
console.log('· push-prueba')
const { probar } = await import(`${REPO}/netlify/functions/push-prueba.mjs`)
const fetchDoble = ({ usuario = 'u1', publica = 'pub', subs: s = [] } = {}) => {
  const borradas = []
  const urls = []
  const f = async (url, op = {}) => {
    urls.push(url)
    const r = (status, cuerpo) => ({ ok: status < 400, status, json: async () => cuerpo, text: async () => JSON.stringify(cuerpo) })
    if (url.includes('/auth/v1/user')) return usuario && /Bearer tk/.test(op.headers?.authorization || '') ? r(200, { id: usuario }) : r(401, {})
    if (url.includes('site_settings')) return r(200, publica ? [{ value: { clave: publica } }] : [])
    if (url.includes('push_subscriptions?user_id=eq.')) {
      if (!url.includes(`eq.${usuario}&`)) return r(200, [])
      return r(200, s)
    }
    if (op.method === 'DELETE') { borradas.push(url); return { ok: true, status: 204 } }
    return r(404, {})
  }
  f.borradas = borradas
  f.urls = urls
  return f
}
let p = await probar({ token: null, env: ENV, fetchImpl: fetchDoble() })
check('sin sesión: 401', p.ok === false && p.estado === 401)
p = await probar({ token: 'malo', env: ENV, fetchImpl: fetchDoble() })
check('con un token que Supabase no reconoce: 401 (no se le cree al cliente)', p.estado === 401)
p = await probar({ token: 'tk', env: { SUPABASE_SERVICE_ROLE_KEY: 'srv' }, fetchImpl: fetchDoble() })
check('sin la clave privada lo dice', p.ok === false && /PUSH_VAPID_PRIVATE/.test(p.motivo))
p = await probar({ token: 'tk', env: ENV, fetchImpl: fetchDoble({ publica: null }) })
check('sin la clave pública lo dice', p.ok === false && /admin/.test(p.motivo))
p = await probar({ token: 'tk', env: ENV, fetchImpl: fetchDoble({ subs: [] }) })
check('sin dispositivos lo dice', p.ok === false && /ningún dispositivo/.test(p.motivo))
const misSubs = [{ endpoint: 'https://push/ok', p256dh: 'p', auth: 'a' }, { endpoint: 'https://push/muerta', p256dh: 'p', auth: 'a' }]
const mandadas = []
const env2 = async (sub, cuerpo) => { if (sub.endpoint.endsWith('muerta')) throw Object.assign(new Error('gone'), { statusCode: 410 }); mandadas.push(JSON.parse(cuerpo)) }
let fd = fetchDoble({ subs: misSubs })
p = await probar({ token: 'tk', env: ENV, fetchImpl: fd, enviar: env2, endpoint: 'https://push/ok' })
check('con un dispositivo bueno: ok, enviados 1 de 2', p.ok && p.enviados === 1 && p.dispositivos === 2, JSON.stringify(p))
check('dice que ESTE dispositivo está dado de alta', p.deEste === true)
check('el aviso de prueba lleva a /ajustes', mandadas[0]?.link === 'https://pokedoc.es/ajustes' && mandadas[0]?.tag === 'prueba')
check('la caducada se borra', fd.borradas.some((u) => u.includes(encodeURIComponent('https://push/muerta'))))
p = await probar({ token: 'tk', env: ENV, fetchImpl: fetchDoble({ subs: misSubs }), enviar: env2, endpoint: 'https://push/otro' })
check('si este dispositivo no está en la lista, deEste es false', p.deEste === false)
p = await probar({ token: 'tk', env: ENV, fetchImpl: fetchDoble({ subs: [misSubs[0]] }), enviar: async () => { throw Object.assign(new Error('x'), { statusCode: 403, body: 'VAPID no casa' }) } })
check('si el servicio de push lo rechaza, el motivo va tal cual', p.ok === false && /403 VAPID no casa/.test(p.motivo), p.motivo)
fd = fetchDoble({ usuario: 'u7', subs: [misSubs[0]] })
await probar({ token: 'tk', env: ENV, fetchImpl: fd, enviar: env2 })
check('…y solo a TUS suscripciones (la consulta va por el id que da Supabase)', fd.urls.some((u) => u.includes('push_subscriptions?user_id=eq.u7&')) && !fd.urls.some((u) => /push_subscriptions\?(?!user_id=eq\.u7&)(?!endpoint=)/.test(u)), fd.urls.join(' '))

console.log(fails ? `\n${fails} FALLAN` : '\nTODO BIEN')
process.exit(fails ? 1 : 0)
