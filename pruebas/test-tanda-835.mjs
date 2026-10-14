// Tanda 835 — los retos diarios dan XP, y la base es quien la cuenta.
//
// PINGU: «deberían dar experiencia, y tener logros por completar retos
// diarios, retos diarios seguidos». La migración contra PostgreSQL de
// verdad: XP una vez por juego y día, el día perfecto, la racha de siete,
// que nadie escriba sin pasar por la función, lo de todos sin nombres, y
// que js/retos-xp.js y `retos_xp` digan lo mismo.
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
const AQUI = new URL('.', import.meta.url).pathname
const REPO = '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const { xpDe, RETOS } = await import(`${REPO}/js/retos-xp.js`)
const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q']
const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 60000 })
const BD = 'prueba_835'
const A = '00000000-0000-0000-0000-0000000000a1'
const B = '00000000-0000-0000-0000-0000000000b2'
// Una consulta como `authenticated` con la sesión de `uid` (o como anon).
const como = (uid, sql, rol = 'authenticated') => {
  const r = psql(['-t', '-A', '-d', BD, '-c', `begin; set local role ${rol}; ${uid ? `set local prueba.uid = '${uid}';` : ''} ${sql}; commit;`])
  return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() }
}
const sql = (s) => { const r = psql(['-t', '-A', '-d', BD, '-c', s]); return (r.stdout || '').trim() + (r.status ? ` ERROR ${r.stderr}` : '') }

const hay = psql(['-c', 'select 1'])
check('hay un PostgreSQL en /var/tmp:5433 donde probar', hay.status === 0, (hay.stderr || '').slice(0, 120))
if (hay.status === 0) {
  psql(['-c', `drop database if exists ${BD}`])
  psql(['-c', `create database ${BD}`])
  let r = psql(['-d', BD, '-f', join(AQUI, 'sql-tanda-835.sql')])
  check('el andamio carga', r.status === 0, r.stderr)
  r = psql(['-d', BD, '-f', join(REPO, 'supabase-migration-retos-xp.sql')])
  check('la migración carga', r.status === 0, r.stderr)
  r = psql(['-d', BD, '-f', join(REPO, 'supabase-migration-retos-xp.sql')])
  check('  …y se puede ejecutar otra vez', r.status === 0, r.stderr)

  console.log('\n── 1. La XP sale de la base, una vez por juego y día ──')
  const hoy = sql('select current_date')
  let g = como(A, `select public.retos_guardar('carta', current_date, 0, 0, 3, true, null)`)
  check('acertar la carta en 3 da 40 XP', g.ok && JSON.parse(g.out.split('\n').find((l) => l.startsWith('{'))).xp === 40 && sql(`select total_xp from user_profiles where id = '${A}'`) === '40', g.out + g.err)
  g = como(A, `select public.retos_guardar('carta', current_date, 0, 0, 1, true, null)`)
  check('  …y volver a mandarla (aunque diga «a la primera») no da nada ni cambia la fila', g.ok && /"nuevo": false/.test(g.out) && sql(`select total_xp from user_profiles where id = '${A}'`) === '40' && sql(`select intentos from retos_resultados where user_id = '${A}' and juego = 'carta'`) === '3', g.out)
  g = como(A, `insert into public.retos_resultados (user_id, juego, day, xp) values ('${A}', 'caro', current_date, 100)`)
  check('nadie escribe un resultado a pelo (sin pasar por la función)', !g.ok && /permission denied|row-level security/.test(g.err), g.err)
  g = como(null, `select public.retos_guardar('carta', current_date, 0, 0, 1, true, null)`, 'anon')
  check('sin sesión no se guarda (anon no puede ni llamarla)', !g.ok, g.err)
  g = como(A, `select public.retos_guardar('carta', current_date - 5, 0, 0, 1, true, null)`)
  check('un día que no es el de hoy no se acepta', !g.ok && /no es el de hoy/.test(g.err), g.err)
  g = como(A, `select public.retos_guardar('trampa', current_date, 0, 0, 1, true, null)`)
  check('un juego que no existe no se acepta', !g.ok, g.err)

  console.log('\n── 2. El día perfecto y la racha ──')
  for (const [j, a, t, i, ac, tira] of [['caro', 5, 5, null, false, "array[true,true,true,true,true]"], ['silueta', 0, 0, 1, true, 'null'], ['ordena', 0, 0, 2, true, 'null']]) {
    como(A, `select public.retos_guardar('${j}', current_date, ${a}, ${t}, ${i ?? 'null'}, ${ac}, ${tira})`)
  }
  check('con cinco de seis, aún no hay día perfecto', sql(`select count(*) from retos_bonos where user_id = '${A}' and tipo = 'perfecto'`) === '0')
  // El de preguntas lo guarda curso.js en daily_challenge_results: cuenta igual.
  sql(`insert into daily_challenge_results (user_id, day, correct, total) values ('${A}', current_date, 4, 5)`)
  g = como(A, `select public.retos_guardar('expansion', current_date, 3, 5, null, false, null)`)
  const res = JSON.parse(g.out.split('\n').find((l) => l.startsWith('{')) || '{}')
  check('el sexto (con el de preguntas de la tabla de siempre) da el día perfecto: +25', res.perfecto === true && res.xpPerfecto === 25 && res.xp === 12, g.out + g.err)
  const total = Number(sql(`select total_xp from user_profiles where id = '${A}'`))
  check('  …y la XP total cuadra: 40 + 30 + 20 + 15 + 12 + 25', total === 40 + 30 + 20 + 15 + 12 + 25, total)
  // Seis días antes jugando: hoy es el séptimo seguido.
  sql(`insert into retos_resultados (user_id, juego, day) select '${B}', 'carta', current_date - g from generate_series(1, 6) g`)
  g = como(B, `select public.retos_guardar('silueta', current_date, 0, 0, 3, true, null)`)
  const rb = JSON.parse(g.out.split('\n').find((l) => l.startsWith('{')) || '{}')
  check('siete días seguidos: +50 de la racha, una vez', rb.racha === 7 && rb.bonoRacha === true && sql(`select total_xp from user_profiles where id = '${B}'`) === String(5 + 50), g.out + g.err)

  console.log('\n── 3. Lo de todos y lo tuyo ──')
  g = como(null, `select public.retos_estadisticas('carta', current_date)`, 'anon')
  check('las estadísticas del día se ven sin cuenta, sin nombres', g.ok && /"jugadores": 1/.test(g.out) && /"porIntentos": \{"3": 1\}/.test(g.out) && !/0000-0000/.test(g.out), g.out + g.err)
  g = como(A, `select public.retos_mis_numeros(60)`)
  const n = JSON.parse(g.out.split('\n').find((l) => l.startsWith('{')) || '{}')
  check('tus números: los seis de hoy, un día perfecto, la carta en 3', n.dias?.[hoy] === 6 && n.diasPerfectos === 1 && n.cartaAciertos === 1 && n.cartaPrimera === 0 && n.caroPerfectos === 1 && n.jugados === 6 && n.hoy?.carta?.intentos === 3, g.out + g.err)
  const nb = JSON.parse((como(B, `select public.retos_mis_numeros(60)`).out.split('\n').find((l) => l.startsWith('{'))) || '{}')
  check('  …y la racha y la mejor racha de quien lleva siete', nb.racha === 7 && nb.mejorRacha === 7, JSON.stringify(nb))
  g = como(B, `select count(*) from public.retos_resultados where user_id = '${A}'`)
  check('cada uno ve solo sus filas', g.ok && g.out.split('\n').includes('0'), g.out + g.err)
  g = como(A, `select public.retos_racha_de('${A}', current_date)`)
  check('los ayudantes internos no se pueden llamar desde fuera', !g.ok, g.err)
  check('los diez logros, activos y con un tipo que el cliente sabe contar', sql(`select count(*) from achievement_definitions where is_active and condition->>'type' in ('retos_racha','retos_perfectos','carta_primera','carta_aciertos','caro_perfectos','retos_jugados')`) === '10')

  console.log('\n── 4. La XP de js/retos-xp.js es la de la base ──')
  const casos = []
  for (let i = 1; i <= 7; i++) for (const ac of [true, false]) { casos.push(['carta', 0, 0, i, ac, null]); casos.push(['silueta', 0, 0, i, ac, null]); casos.push(['ordena', 0, 0, i, ac, null]) }
  for (let a = 0; a <= 6; a++) casos.push(['expansion', a, 5, null, false, null], ['caro', a, 5, null, false, null])
  for (let m = 0; m < 32; m++) casos.push(['caro', 0, 5, null, false, [0, 1, 2, 3, 4].map((b) => Boolean(m & (1 << b)))])
  casos.push(['caro', 0, 5, null, false, [true, true, true]], ['reto', 5, 5, null, true, null])
  const consulta = casos.map(([j, a, t, i, ac, tira]) => `select public.retos_xp('${j}', ${a}, ${t}, ${i ?? 'null'}, ${ac}, ${tira ? `array[${tira.join(',')}]::boolean[]` : 'null'})`).join(' union all ')
  const deLaBase = sql(consulta).split('\n').map(Number)
  const distintos = casos.filter(([j, a, t, i, ac, tira], k) => xpDe(j, { aciertos: a, total: t, intentos: i, acertada: ac, tira }) !== deLaBase[k])
  check(`los ${casos.length} casos dan lo mismo en las dos`, deLaBase.length === casos.length && !distintos.length, JSON.stringify(distintos.slice(0, 4)))
  check('los seis retos del menú son los seis juegos que acepta la base', RETOS.map((x) => x.juego).join() === 'reto,carta,caro,silueta,ordena,expansion' && /'reto', 'carta', 'caro', 'silueta', 'ordena', 'expansion'/.test(sql(`select pg_get_constraintdef(oid) from pg_constraint where conname = 'retos_resultados_juego'`).replace(/::text/g, '')), '')
  psql(['-c', `drop database if exists ${BD}`])
}
console.log(fails ? `\n${fails} FALLOS` : '\nTODO OK')
process.exit(fails ? 1 : 0)
