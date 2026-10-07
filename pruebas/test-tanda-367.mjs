// Tanda 367 — un torneo «privado» pasa a ser un torneo CON CÓDIGO.
//
// PINGU: «los torneos privados sí deberían ser públicos y visibles, pero
// que te puedas apuntar eso debería ir con el código o contraseña».
//
// Lo de antes (tanda 292) escondía la fila entera con la política: el
// torneo no existía para quien no estuviera dentro. Eso resolvía la
// entrada de rebote —sin poder leer el id, no te inscribes— pero se
// llevaba por delante el escaparate.
//
// Ahora hay una sola regla: SE VE como cualquier otro, SE ENTRA con el
// código. Y eso mueve el candado de sitio: lo que antes protegía la
// política de lectura ahora tiene que protegerlo la función de
// inscripción, porque el id ya lo sabe cualquiera. Un `if` en el
// navegador NO valdría — la API contesta igual.
//
// Esta prueba sustituye a test-tanda-292.mjs, que probaba justo lo
// contrario.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync } from 'node:fs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 200) : ''}`)
}
const leer = (f) => readFileSync(`/home/user/pingu/${f}`, 'utf8')
const SQL = leer('supabase-migration-torneos-codigo.sql')

console.log('\n── 1. El código se muda a su propia tabla ──')
{
  // En cuanto la fila del torneo es pública, CUALQUIER columna suya es
  // pública. Dejar el código ahí sería repartir la llave con la puerta.
  check('hay tabla para el código', /create table if not exists public\.tournament_join_codes/.test(SQL))
  check('con RLS encendida', /alter table public\.tournament_join_codes enable row level security/.test(SQL))
  const pol = SQL.match(/create policy codigos_mando on public\.tournament_join_codes for all\s+using \(([\s\S]*?)\)\s+with check \(([\s\S]*?)\);/)
  check('y una política que la cierra', Boolean(pol))
  // El criterio de quién lleva un torneo tiene nombre y es UNO
  // (CLAUDE.md): no se reparte `is_admin` a mano.
  check('quien lee es quien LLEVA el torneo', /torneos_mando\(tournament_id\)/.test(pol?.[1] || ''))
  check('y quien escribe, también', /torneos_mando\(tournament_id\)/.test(pol?.[2] || ''))
  check('sin cuenta ni se toca', /revoke all on table public\.tournament_join_codes from anon/.test(SQL))

  // Los que ya había: sin copiarlos, los torneos en marcha se quedan sin
  // llave el día que se ejecuta esto.
  check('los códigos de antes se copian', /insert into public\.tournament_join_codes[\s\S]{0,200}from public\.tournaments/.test(SQL))
  // Y la copia va detrás de un guarda porque al final la columna ya no
  // está: sin él, ejecutarla dos veces reventaría a la mitad.
  check('la copia se salta si la columna ya no está', /information_schema\.columns[\s\S]{0,200}column_name = 'join_code'/.test(SQL))

  // Lo que de verdad cierra la puerta: la columna DESAPARECE. Mientras
  // exista, la lee cualquiera.
  check('y la columna vieja se quita', /alter table public\.tournaments drop column if exists join_code/.test(SQL))
  check('…la última, cuando ya nadie la lee',
    SQL.indexOf('drop column if exists join_code') > SQL.lastIndexOf('tournament_join_codes where tournament_id'))

  // La trampa que ya estaba razonada en la 292 y sigue valiendo: un
  // `select *` de un rol sin permiso sobre UNA columna no la devuelve
  // vacía, falla la consulta entera. Por eso se MUDA en vez de esconderse.
  check('no se esconde columna a columna', !/revoke select\s*\(\s*join_code/.test(SQL))
}

console.log('\n── 2. La política de lectura suelta el escondite ──')
{
  const pol = SQL.match(/create policy torneos_leer on public\.tournaments for select\s+using \(([\s\S]*?)\);/)
  check('la política se rehace', Boolean(pol))
  const cuerpo = pol?.[1] || ''
  check('ya no mira si es privado', !/is_private/.test(cuerpo), cuerpo)
  check('ni si estás inscrito', !/torneos_estoy_inscrito/.test(cuerpo))
  // Y lo que NO cambia: un borrador sigue siendo de quien lo monta.
  check('los borradores siguen siendo de su organizador', /status <> 'draft'/.test(cuerpo))
  check('…y de los admins', /torneos_soy_admin\(\)/.test(cuerpo))
}

console.log('\n── 3. El candado nuevo: inscribirse ──')
{
  const fn = SQL.match(/create or replace function public\.torneos_inscribirse\(([\s\S]*?)\$\$;/)?.[0] || ''
  check('la RPC de inscribirse se rehace', Boolean(fn))
  check('acepta el código', /p_codigo text default null/.test(fn))
  check('y lo pide cuando el torneo lo pide', /coalesce\(v_torneo\.is_private, false\)/.test(fn))
  // De la tabla nueva, no de la fila.
  check('lo lee de su tabla', /from tournament_join_codes where tournament_id = p_torneo/.test(fn))
  // Un código se copia y se pega, y se pega mal.
  check('no distingue mayúsculas ni espacios', /lower\(trim\(p_codigo\)\) <> lower\(v_codigo\)/.test(fn))
  // Falta el código y código equivocado son cosas distintas: el torneo
  // se VE, así que decirlo no cuenta nada que no estuviera en pantalla.
  check('distingue «no lo has puesto» de «está mal»',
    /Este torneo pide un código para entrar\./.test(fn) && /El código no es correcto\./.test(fn))
  // Un torneo marcado con código y sin ninguno guardado sería una puerta
  // sin llave: se dice, en vez de dejar entrar a todo el mundo.
  check('y un torneo sin código guardado no se abre', /todavía no tiene ninguno/.test(fn))

  // Antes se comprobaba, después se cuenta: si el código no encaja, no
  // se toca nada.
  check('el código va ANTES que las plazas',
    fn.indexOf('El código no es correcto') < fn.indexOf('select count(*) into v_ocupadas'))

  // PostgREST casa la RPC por los NOMBRES de los parámetros, así que dos
  // funciones que aceptan los mismos tres nombres son una llamada
  // ambigua: Postgres la rechaza en vez de elegir.
  check('la de tres parámetros se borra, no se deja al lado',
    /drop function if exists public\.torneos_inscribirse\(uuid, text, boolean\);/.test(SQL))
}

console.log('\n── 4. El navegador manda el código, y no decide él ──')
{
  const js = leer('js/torneos/torneo.js')
  check('la inscripción manda p_codigo', /p_codigo: codigo \|\| null/.test(js))
  // Mandarlo solo «cuando parece que toca» sería fiarse de lo que cree
  // el navegador sobre una fila que puede haber cambiado hace un rato.
  check('…siempre, no solo si el torneo parece privado',
    !/is_private \? \{[\s\S]{0,80}p_codigo/.test(js))
  // El puente: mientras la migración no esté, la función de cuatro no
  // existe y esto sería un «no encuentro esa función» para TODO EL
  // MUNDO, torneos normales incluidos.
  check('con vuelta atrás a los tres de antes', /const \{ p_codigo: _, \.\.\.tresDeAntes \} = argumentos/.test(js))

  // El código ya no viaja en la fila del torneo por ningún lado.
  check('la ficha no guarda join_code en tournaments', !/cambios\.join_code/.test(js))
  check('lo guarda en su tabla', /\.from\('tournament_join_codes'\)[\s\S]{0,120}\.upsert/.test(js))
  const crear = leer('js/torneos/torneos.js')
  check('crear tampoco lo mete en la fila', !/join_code: \$\('torneoPrivado'\)/.test(crear))
  check('y ya no está en la lista de columnas que pueden faltar',
    !/'is_private', 'join_code'/.test(crear) && !/'is_private', 'join_code'/.test(js))

  // Marcar «con código» sin escribir ninguno dejaría un torneo A LA
  // VISTA al que no se puede entrar, y sin que nada diera error.
  check('no se crea con la casilla marcada y el código vacío',
    /Escribe el código: sin él nadie podría inscribirse\./.test(crear))
  check('ni se guarda así al editar',
    /Escribe el código: sin él nadie podría inscribirse\./.test(js))

  // Y /admin tiene que avisar si falta la migración: sin la tabla, el
  // torneo se ve y no entra nadie.
  check('/admin vigila la tabla nueva',
    /tournament_join_codes'[\s\S]{0,140}supabase-migration-torneos-codigo\.sql/.test(leer('js/schema-check.js')))
}

console.log('\n── 5. Dónde se anuncia (y dónde no) ──')
{
  // El RSS es el espejo de lo que la web enseña: si la web lo enseña y
  // el canal lo esconde, el canal miente.
  const rss = leer('netlify/functions/rss.mjs')
  check('el RSS ya no filtra los de código', !/is_private=is\.false/.test(rss))
  check('…pero lo dice en la entrada', /con el código que da quien lo organiza/.test(rss))

  // El canal de Telegram es otra cosa: es un aviso a todo el mundo de
  // algo a lo que no entra todo el mundo. La pasada AUTOMÁTICA no los
  // coge; el botón de la ficha, que pulsa una persona, sí.
  const auto = leer('netlify/functions/telegram-torneos.mjs')
  check('la pasada automática sigue sin cogerlos', /is_private\.is\.false/.test(auto))
  const manual = leer('netlify/functions/telegram-mandar.mjs')
  check('pero el botón ya no los rechaza', !/Este torneo es privado/.test(manual))
  check('…y el botón sale para un torneo con código',
    /const procede = Boolean\(perfil\?\.is_admin\) && torneo\.status === 'registration_open'/.test(leer('js/torneos/torneo.js')))
}

const BASE = process.env.PD_BASE || 'http://localhost:8892'
const browser = await chromium.launch()
const CON_CODIGO = {
  id: 'torneo-1', slug: 'pachanga', name: 'La Pachanga', status: 'registration_open',
  admin_id: 'admin-1', max_players: 8, swiss_rounds: 3, swiss_bo: 1, format: 'standard',
  round_time_minutes: 50, top_cut_size: 0, is_private: true,
}
async function abrir(ruta, semillas = {}) {
  const page = await browser.newPage({ viewport: { width: 1150, height: 1200 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.addInitScript((s) => {
    window.__FAKE_SESSION__ = s.sesion || 'user-1'
    window.__FAKE_PERFIL__ = s.perfil || { is_admin: false, is_tournament_admin: false }
    window.__FAKE_TORNEOS__ = s.torneos || []
    if (s.codigos) window.__FAKE_CODIGOS__ = s.codigos
    window.__RPC_RESPUESTAS__ = { torneos_inscribirse: 'ins-9' }
  }, semillas)
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2400)
  return { page, errores }
}

console.log('\n── 6. En la lista lo ve TODO EL MUNDO, y sin cuenta ──')
{
  const { page, errores } = await abrir('/torneos', { sesion: 'none', torneos: [CON_CODIGO] })
  check('el torneo con código sale en la lista', (await page.getByText('La Pachanga').count()) >= 1)
  check('con su chapa', (await page.locator('.torneo-privado').count()) >= 1)
  // La chapa ya no dice «Privado»: no lo está. Dice lo que hace falta
  // saber antes de pulsar.
  const chapa = (await page.locator('.torneo-privado').first().textContent()) || ''
  check('y la chapa dice que va con código', /código/i.test(chapa), chapa)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await page.close()

  const normal = await abrir('/torneos', { sesion: 'none', torneos: [{ ...CON_CODIGO, is_private: false }] })
  check('un torneo normal no la lleva', (await normal.page.locator('.torneo-privado').count()) === 0)
  await normal.page.close()
}

console.log('\n── 7. La ficha pide el código al inscribirse ──')
{
  const { page, errores } = await abrir('/torneo?slug=pachanga', { torneos: [CON_CODIGO] })
  check('la ficha se ve entera', (await page.locator('#torneoContenido').isVisible()))
  check('y dice que se entra con código', /código/i.test((await page.locator('#torneoFormato').textContent()) || ''))
  check('el formulario pide el código', (await page.locator('#inscripcionCodigo').count()) === 1)

  // Sin código no se llama a nada: no es una protección —la de verdad
  // está en la base— sino no hacerle perder el viaje a nadie.
  await page.fill('#inscripcionTcgLive', 'AshKetchum')
  await page.click('#btnInscribirme')
  await page.waitForTimeout(500)
  let llamadas = await page.evaluate(() => window.__RPCS__.filter((r) => r.nombre === 'torneos_inscribirse'))
  check('sin el código no se llama a la RPC', llamadas.length === 0, JSON.stringify(llamadas))

  await page.fill('#inscripcionCodigo', '  pacha  ')
  await page.click('#btnInscribirme')
  await page.waitForTimeout(800)
  llamadas = await page.evaluate(() => window.__RPCS__.filter((r) => r.nombre === 'torneos_inscribirse'))
  check('con el código se llama una vez', llamadas.length === 1, JSON.stringify(llamadas))
  // Un código se copia y se pega con espacios de sobra.
  check('va sin los espacios de pegarlo', llamadas[0]?.args?.p_codigo === 'pacha', JSON.stringify(llamadas[0]?.args))
  check('y con el torneo y el usuario de TCG Live',
    llamadas[0]?.args?.p_torneo === 'torneo-1' && llamadas[0]?.args?.p_tcg_live === 'AshKetchum')
  check('sin errores', errores.length === 0, errores.join(' | '))
  await page.close()
}

console.log('\n── 8. Un torneo normal no pide nada ──')
{
  const { page } = await abrir('/torneo?slug=pachanga', { torneos: [{ ...CON_CODIGO, is_private: false }] })
  check('no hay campo de código', (await page.locator('#inscripcionCodigo').count()) === 0)
  await page.fill('#inscripcionTcgLive', 'AshKetchum')
  await page.click('#btnInscribirme')
  await page.waitForTimeout(800)
  const llamadas = await page.evaluate(() => window.__RPCS__.filter((r) => r.nombre === 'torneos_inscribirse'))
  check('se inscribe igual que siempre', llamadas.length === 1, JSON.stringify(llamadas))
  check('y el código va vacío', llamadas[0]?.args?.p_codigo === null, JSON.stringify(llamadas[0]?.args))
  await page.close()
}

console.log('\n── 9. Quien lleva el torneo ve su código en el editor ──')
{
  // Y lo ve desde la TABLA, no desde la fila del torneo: si se leyera de
  // la fila, es que la fila lo lleva — y la lee cualquiera.
  const { page, errores } = await abrir('/torneo?slug=pachanga', {
    sesion: 'admin-1',
    perfil: { is_admin: true },
    torneos: [CON_CODIGO],
    codigos: [{ tournament_id: 'torneo-1', code: 'PACHA' }],
  })
  await page.click('#btnEditarTorneo')
  await page.waitForTimeout(900)
  check('el editor sale', (await page.locator('#torneoEditor').count()) === 1)
  check('con el código puesto', (await page.locator('#editarCodigo').inputValue()) === 'PACHA')
  check('sin errores', errores.length === 0, errores.join(' | '))
  await page.close()
}

console.log('\n── 10. Y al guardar, el código va a su tabla ──')
{
  // Pulsando de verdad, no leyendo el fuente: una prueba que mira si se
  // LLAMA a algo no prueba lo que ese algo hace (lección de la 313).
  const { page, errores } = await abrir('/torneo?slug=pachanga', {
    sesion: 'admin-1',
    perfil: { is_admin: true },
    torneos: [CON_CODIGO],
    codigos: [{ tournament_id: 'torneo-1', code: 'PACHA' }],
  })
  await page.click('#btnEditarTorneo')
  await page.waitForTimeout(900)
  await page.fill('#editarCodigo', 'OTRA-LLAVE')
  await page.click('#btnGuardarEdicion')
  await page.waitForTimeout(1600)
  const escrituras = await page.evaluate(() => JSON.parse(sessionStorage.getItem('__escrituras__') || '[]'))
  const codigo = escrituras.filter((e) => e.tabla === 'tournament_join_codes')
  check('se escribe en tournament_join_codes', codigo.length === 1, JSON.stringify(escrituras.map((e) => e.tabla)))
  check('…con el código nuevo', JSON.stringify(codigo[0]?.filas || '').includes('OTRA-LLAVE'), JSON.stringify(codigo[0]))
  // Y la fila del torneo NO lo lleva: si lo llevara, lo leería cualquiera.
  const torneo = escrituras.filter((e) => e.tabla === 'tournaments')
  check('y la fila del torneo no lo lleva', !JSON.stringify(torneo).includes('join_code'), JSON.stringify(torneo).slice(0, 200))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await page.close()

  // Quitar «entrada con código» BORRA el código: una llave suelta de una
  // puerta que ya no existe es una llave que algún día abre algo.
  const otro = await abrir('/torneo?slug=pachanga', {
    sesion: 'admin-1',
    perfil: { is_admin: true },
    torneos: [CON_CODIGO],
    codigos: [{ tournament_id: 'torneo-1', code: 'PACHA' }],
  })
  await otro.page.click('#btnEditarTorneo')
  await otro.page.waitForTimeout(900)
  await otro.page.uncheck('#editarPrivado')
  await otro.page.click('#btnGuardarEdicion')
  await otro.page.waitForTimeout(1600)
  const esc = await otro.page.evaluate(() => JSON.parse(sessionStorage.getItem('__escrituras__') || '[]'))
  const borrado = esc.filter((e) => e.tabla === 'tournament_join_codes' && e.tipo === 'delete')
  check('al quitar la casilla, el código se borra', borrado.length === 1,
    JSON.stringify(esc.filter((e) => e.tabla === 'tournament_join_codes')))
  await otro.page.close()

  // Y marcarla sin escribir código no guarda nada: dejaría un torneo a la
  // vista al que no se puede entrar.
  const vacio = await abrir('/torneo?slug=pachanga', {
    sesion: 'admin-1',
    perfil: { is_admin: true },
    torneos: [{ ...CON_CODIGO, is_private: false }],
  })
  await vacio.page.click('#btnEditarTorneo')
  await vacio.page.waitForTimeout(900)
  await vacio.page.check('#editarPrivado')
  await vacio.page.click('#btnGuardarEdicion')
  await vacio.page.waitForTimeout(1200)
  // Solo las tablas del torneo: el perfil y la analítica escriben siempre,
  // y contarlas haría que esta comprobación fallara por lo que no mira.
  const nada = (await vacio.page.evaluate(() => JSON.parse(sessionStorage.getItem('__escrituras__') || '[]')))
    .filter((e) => e.tabla === 'tournaments' || e.tabla === 'tournament_join_codes')
  check('marcarla sin código no guarda nada', nada.length === 0, JSON.stringify(nada))
  check('…y el editor sigue abierto', (await vacio.page.locator('#torneoEditor').count()) === 1)
  await vacio.page.close()
}

await browser.close()
console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
