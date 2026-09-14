// Tanda 294: la puerta de atrás de los chats.
//
// PINGU pidió seguir buscando por decklists, jueces y chats de mesa.
// Ahí estaba, y no es del tipo «no escribe»: es del tipo «escribe quien
// no debería».
//
// En PostgreSQL, un INSERT NO mira el `using` de la política: SOLO el
// `with check`. Las dos políticas de chat pedían pertenecer a la mesa
// para LEER… y solo firmar con tu nombre para ESCRIBIR. Y los ids de
// las mesas son de lectura pública (es lo que hace que un enlace de
// torneo enseñe el directo), así que cualquiera con cuenta podía meter
// mensajes en la partida de dos desconocidos.
//
// La prueba de que esto era así —y de que ya no— está en sql-chats.sql,
// contra PostgreSQL de verdad. Aquí se vigila que no vuelva.
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 170) : ''}`)
}

// Sin los comentarios: la cabecera de la migración lleva un EJEMPLO de
// cómo estaba la política antes, y leerlo daría por malo el arreglo.
const sinComentarios = (t) => t.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n')
const SQL = sinComentarios(readFileSync('/home/user/pingu/supabase-migration-torneos-chats.sql', 'utf8'))

console.log('\n── 1. Las dos políticas piden pertenecer TAMBIÉN para escribir ──')
{
  // Un `with check` con solo la firma es «vale con que firmes con tu
  // nombre»: eso es lo que dejaba entrar a cualquiera.
  for (const [nombre, tabla] of [
    ['mensajes_mesa', 'match_messages'],
    ['mensajes_llamada', 'judge_messages'],
  ]) {
    const trozo = SQL.split(`create policy ${nombre} `)[1] || ''
    const check1 = trozo.split('with check')[1] || ''
    check(`${nombre} se rehace`, trozo.length > 50)
    check(`  …y su with check exige pertenecer`, /exists\s*\(/.test(check1), check1.slice(0, 90))
    check(`  …sin soltar la firma`, /sender_id = auth\.uid\(\)/.test(check1))
    check(`  …sobre ${tabla}`, new RegExp(`create policy ${nombre} on public\\.${tabla}`).test(SQL))
  }
}

console.log('\n── 2. El barrido: ninguna política floja en TODO el proyecto ──')
{
  // Lo que de verdad guarda esto: una política `for all` cuyo
  // `with check` sea más flojo que su `using`. Se miran TODAS las
  // migraciones, quedándose con la última definición de cada política —
  // que es la que acaba aplicada.
  let salida = ''
  let codigo = 0
  try {
    salida = execFileSync('python3', ['/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad/barrido-politicas.py'], { encoding: 'utf8' })
  } catch (e) {
    salida = `${e.stdout || ''}${e.stderr || ''}`
    codigo = e.status ?? 1
  }
  check('el barrido pasa', codigo === 0, salida.slice(0, 400))
  check('y lo dice', /SIN POLÍTICAS FLOJAS/.test(salida), salida.slice(0, 200))

  // CONTROL POSITIVO. Sin esto, la comprobación de arriba la pasaría
  // también un barrido que no mirase nada — que es justo lo que pilló el
  // rigor. Se le da una política mala a posta y tiene que cantarla.
  const { mkdtempSync, writeFileSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const dir = mkdtempSync(join(tmpdir(), 'barrido-'))
  writeFileSync(join(dir, 'supabase-migration-trampa.sql'), `
create policy chat_falso on public.match_messages for all
  using (
    exists (select 1 from tournament_matches m where m.id = match_id and m.player_a_id = auth.uid())
  )
  with check (sender_id = auth.uid());
`)
  let salidaMala = ''
  let codigoMalo = 0
  try {
    salidaMala = execFileSync('python3', ['/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad/barrido-politicas.py', dir], { encoding: 'utf8' })
  } catch (e) {
    salidaMala = `${e.stdout || ''}${e.stderr || ''}`
    codigoMalo = e.status ?? 1
  }
  check('el barrido SABE detectar una política floja', codigoMalo !== 0, salidaMala.slice(0, 200))
  check('y dice cuál es', /chat_falso/.test(salidaMala), salidaMala.slice(0, 200))
}

console.log('\n── 3. El cliente sigue firmando ──')
{
  // La mitad de la firma no se toca: sin ella se podría escribir en
  // nombre de otro. Si el cliente dejara de mandar `sender_id`, ahora
  // la RLS le cerraría el chat a todo el mundo.
  const jueces = readFileSync('/home/user/pingu/js/torneos/jueces.js', 'utf8')
  check('el chat manda sender_id', /\.insert\(\{ \[columna\]: id, sender_id: yo\(\), message: texto \}\)/.test(jueces))
  // Y los dos chats van por el mismo sitio, así que basta con ese.
  check('el chat de la mesa usa ese camino', /tabla: 'match_messages'/.test(jueces))
  check('y el del juez también', /tabla: 'judge_messages'/.test(jueces))
}

console.log('\n── 4. La prueba contra PostgreSQL existe y prueba lo que dice ──')
{
  const proof = readFileSync('/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad/sql-chats.sql', 'utf8')
  // Aplica el fichero de migración DE VERDAD, no una copia a mano: si
  // se copiara, podría probar algo que no es lo que se despliega.
  check('aplica la migración de verdad', /\\i \/home\/user\/pingu\/supabase-migration-torneos-chats\.sql/.test(proof))
  check('prueba el chat de la mesa', /insert into public\.match_messages/.test(proof))
  check('y el del juez', /insert into public\.judge_messages/.test(proof))
  check('con un desconocido', /cotilla/.test(proof))
  // Y que lo legítimo siga pasando: un arreglo que cierre a todo el
  // mundo no es un arreglo.
  check('y comprueba que el legítimo SÍ escribe', /voy con Pikachu/.test(proof))
  check('y que firmar por otro no cuela', /soy Misty, en serio/.test(proof))
}

console.log(`\n${fails === 0 ? '✅ TODO BIEN' : `❌ ${fails} FALLOS`}`)
process.exit(fails ? 1 : 0)
