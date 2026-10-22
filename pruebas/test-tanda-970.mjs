// Tanda 970 — un juez aprobado lleva su torneo como el organizador.
//
// PINGU, la víspera de un torneo con dos jueces y un organizador: «los
// jueces no tienen la opción de generar pareos ni de saltar ronda; tienen
// que tener los mismos permisos que el organizador».
//
// Lo de la base va en sql-tanda-970.sql (con la migración de verdad). Aquí,
// el espejo de la pantalla: `puedeLlevar` con el juez, y que TODAS las
// pantallas de torneos se lo pasen (si una no, el juez ve allí lo de antes
// y no hay error que lo cante).
import { readFileSync, readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const RAIZ = '/home/user/pingu'
const AQUI = dirname(fileURLToPath(import.meta.url))
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const { puedeLlevar, puedeBorrarTorneo } = await import(`${RAIZ}/js/torneos/comun.js`)

console.log('── 1. El criterio ──')
{
  const t = { admin_id: 'creador' }
  check('un juez aprobado lleva el torneo', puedeLlevar({}, t, 'juez', true))
  check('  …sin serlo, no', !puedeLlevar({}, t, 'juez', false) && !puedeLlevar({}, t, 'juez'))
  check('  …ni sin sesión aunque se diga juez', !puedeLlevar({}, t, null, true))
  check('quien lo creó y un organizador, como siempre', puedeLlevar({}, t, 'creador') && puedeLlevar({ is_tournament_admin: true }, t, 'x'))
  check('borrar el torneo NO es de un juez', !puedeBorrarTorneo({}, t, 'juez') && puedeBorrarTorneo({}, t, 'creador'))
}

console.log('\n── 2. Cada pantalla de torneos le pasa el juez ──')
{
  const dir = join(RAIZ, 'js/torneos')
  const sinJuez = []
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.js'))) {
    const s = readFileSync(join(dir, f), 'utf8')
    // Con un nivel de paréntesis dentro (`yo()`, `miId()`). Un `false`
    // explícito vale: es «sin contar al juez» A PROPÓSITO (la baja y la mesa
    // viva van por las funciones de la 394).
    for (const m of s.matchAll(/puedeLlevar\(((?:[^()]|\([^()]*\))*)\)/g)) {
      if (f === 'comun.js') continue
      const args = m[1].split(',').map((x) => x.trim())
      if (args.length < 4 || !/esJuez|^false$/.test(args[3])) sinJuez.push(`${f}: ${m[0]}`)
    }
  }
  check('ninguna llamada a puedeLlevar sin el juez (fuera de comun.js)', sinJuez.length === 0, sinJuez.join(' | '))
  const torneo = readFileSync(join(dir, 'torneo.js'), 'utf8')
  const ronda = readFileSync(join(dir, 'ronda.js'), 'utf8')
  check('un juez resuelve una mesa VIVA por torneos_resolver_como_juez (vale con y sin la 970)', /if \(!organiza\(\) && !TERMINALES\.has\(partida\.status\)\) \{\s*const \{ error \} = await supabase\.rpc\('torneos_resolver_como_juez'/.test(ronda))
  check('la ficha carga los jueces ANTES que las jornadas (que preguntan por el mando)', torneo.indexOf('await cargarJueces()') < torneo.indexOf('jornadas = await cargarJornadas('), `${torneo.indexOf('await cargarJueces()')} < ${torneo.indexOf('jornadas = await cargarJornadas(')}`)
}

console.log('\n── 3. La migración ──')
{
  const sql = readFileSync(join(RAIZ, 'supabase-migration-970-jueces-como-organizador.sql'), 'utf8')
  check('torneos_mando cuenta al juez aprobado', /create or replace function public\.torneos_mando[\s\S]*or public\.torneos_soy_juez\(p_torneo\);/.test(sql))
  check('  …el juez edita su torneo (solo UPDATE: borrar sigue siendo de quien lo creó)', /create policy torneos_juez_edita on public\.tournaments for update/.test(sql) && !/for (delete|all)/.test(sql))
  check('  …sin tablas temporales (la 631)', !/temp(orary)? table/i.test(sql))
  const r = spawnSync('psql', ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-f', join(AQUI, 'sql-tanda-970.sql')], { encoding: 'utf8', timeout: 30000 })
  const salida = `${r.stdout}\n${r.stderr}`
  if (/could not connect|No such file|Connection refused/.test(salida)) {
    check('hay un PostgreSQL en /var/tmp:5433 donde probar', false, salida.slice(0, 200))
  } else {
    const oks = (salida.match(/NOTICE:\s+ok/g) || []).length
    const fallas = salida.split('\n').filter((l) => /FALLA|ERROR/.test(l))
    check(`contra PostgreSQL: ${oks} comprobaciones en verde, ninguna roja`, oks === 13 && fallas.length === 0, fallas.join(' | '))
  }
}

console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
