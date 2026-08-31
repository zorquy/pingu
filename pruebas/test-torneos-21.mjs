import { COLUMNAS_PUBLICAS_INSCRIPCION } from '/home/user/pingu/js/torneos/comun.js'
import { readFileSync } from 'node:fs'

// Tanda 228: la lista de columnas que pide un visitante SIN cuenta y el
// `grant select (...)` de la migración de apertura tienen que decir
// EXACTAMENTE lo mismo.
//
// Por qué esto merece una prueba propia: en Postgres, un `select *` de
// un rol que no tiene permiso sobre una columna NO devuelve esa columna
// vacía — falla la consulta entera. Si las dos listas se separan, la
// ficha del torneo deja de cargar para cualquiera que no haya entrado, y
// no hay forma de verlo hasta que pasa en producción.
//
// El doble de Supabase no puede pillarlo: ignora las columnas del
// select, así que en las pruebas de navegador pedir `*` o pedir una
// lista concreta da exactamente lo mismo.

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + extra : ''}`)
}

const SQL = readFileSync('/home/user/pingu/supabase-migration-torneos-publico.sql', 'utf8')

console.log('\n── 1. El grant existe y es de columnas ──')
const bloque = SQL.match(
  /grant select \(([^)]*)\) on public\.tournament_registrations to anon/s
)
check('hay un grant select por columnas para anon', Boolean(bloque))
check('y antes se le quita el select de la tabla entera',
  /revoke select on public\.tournament_registrations from anon/.test(SQL))

if (!bloque) {
  console.log('\n1 FALLOS\n')
  process.exit(1)
}

const delSql = bloque[1]
  .split(',')
  .map((c) => c.trim())
  .filter(Boolean)
  .sort()
const delCliente = [...COLUMNAS_PUBLICAS_INSCRIPCION].sort()

console.log('\n── 2. Las dos listas dicen lo mismo ──')
check('mismo número de columnas', delSql.length === delCliente.length, `sql ${delSql.length} / js ${delCliente.length}`)
check('mismas columnas', JSON.stringify(delSql) === JSON.stringify(delCliente),
  `sql=${JSON.stringify(delSql)} js=${JSON.stringify(delCliente)}`)

console.log('\n── 3. Y lo privado NO está en ninguna de las dos ──')
for (const prohibida of ['tcg_live_username', 'participation_confirmed_at']) {
  check(`${prohibida} no la ve un anónimo (sql)`, !delSql.includes(prohibida))
  check(`${prohibida} no la pide el cliente (js)`, !delCliente.includes(prohibida))
}

console.log('\n── 4. Lo que el escaparate necesita sí está ──')
for (const necesaria of ['user_id', 'status', 'tournament_id']) {
  check(`${necesaria} está en la lista`, delCliente.includes(necesaria))
}

console.log(fails ? `\n${fails} FALLOS\n` : '\nTodo en verde\n')
process.exit(fails ? 1 : 0)
