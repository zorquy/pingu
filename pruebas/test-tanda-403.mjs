// Tanda 403 — quién de los tuyos tiene esta carta.
//
// PINGU, enseñando Dex: su ficha lleva un bloque «FRIENDS» con los amigos
// que tienen esa carta. Aquí no hay amigos, hay SEGUIDOS.
//
// Lo que esta prueba mira y no supone:
//   · Que la colección de otra persona NO se abre para esto. Va por una
//     función que contesta esa pregunta y ninguna otra.
//   · Que se respeta `coleccion_publica`: seguir a alguien no es permiso
//     para mirarle los cajones.
//   · Que el nombre lleva el color de su rango, porque va con enlace al
//     perfil (la regla de la 386).
//   · Y que el bloque se esconde si no hay nadie: un rótulo «La tienen»
//     encima de un hueco vacío dice «no tienes amigos» sin querer.
import { readFileSync } from 'node:fs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 220) : ''}`)
}
const leer = (f) => readFileSync(`/home/user/pingu/${f}`, 'utf8')

console.log('\n── 1. Lo que la función deja ver, y lo que no ──')
{
  const sql = leer('supabase-migration-quien-la-tiene.sql')
  // Solo a quien sigues: la pregunta es «quién de los MÍOS», no «quién en
  // toda la web». Lo segundo sería un directorio de colecciones ajenas.
  check('solo sale quien sigues',
    /from public\.user_follows f[\s\S]{0,120}f\.follower_id = auth\.uid\(\)/.test(sql))
  // Y solo si tiene la colección en público.
  check('y solo si su colección es pública', /coalesce\(p\.coleccion_publica, false\)/.test(sql))
  check('el baneado no sale', /not coalesce\(p\.is_banned, false\)/.test(sql))
  check('tú no sales en tu propia lista', /c\.user_id <> auth\.uid\(\)/.test(sql))
  // Sin sesión no hay «a quién sigues», así que no hay nada que contestar.
  check('sin sesión no se puede llamar',
    /revoke all on function public\.coleccion_quien_la_tiene\(text\) from public, anon/.test(sql))
  check('  …y con sesión sí', /grant execute on function public\.coleccion_quien_la_tiene\(text\) to authenticated/.test(sql))
  // Un tope: de una carta común la pueden tener doscientos.
  check('hay tope', /limit 20/.test(sql))
  // Y el rango, porque el nombre va con enlace (regla de la 386).
  check('trae el rango, que el nombre va enlazado',
    /is_admin boolean, is_moderator boolean/.test(sql))
}

console.log('\n── 2. Lo que hace la pantalla ──')
{
  const js = leer('js/mi-coleccion.js')
  const fn = js.slice(js.indexOf('async function pintarQuienLaTiene'))
  const cuerpo = fn.slice(0, fn.indexOf('\nasync function '))
  // El bloque empieza ESCONDIDO y solo se enseña si hay alguien.
  check('el bloque nace escondido', /bloque\.classList\.add\('hidden'\)/.test(cuerpo))
  check('  …y solo se enseña si hay alguien',
    /if \(!gente\.length\) return[\s\S]{0,80}classList\.remove\('hidden'\)/.test(cuerpo), cuerpo.slice(0, 200))
  // Una respuesta que llega tarde no puede pintar la gente de OTRA carta:
  // la ficha se abre y se cierra más rápido que la consulta.
  check('una respuesta que llega tarde no pinta la carta equivocada',
    /l\.card_id !== cardId/.test(cuerpo), cuerpo.slice(0, 260))
  // Y el nombre, con el color de su rango.
  check('el nombre lleva el color de su rango', /atributosDeRango\(g\)/.test(cuerpo))
  // Sin la migración no se grita en mitad de una ficha.
  const datos = leer('js/mi-coleccion/datos.js')
  check('sin la migración, el bloque calla',
    /quienLaTiene[\s\S]{0,400}sinMigracion\) return \[\]/.test(datos))
}

console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
