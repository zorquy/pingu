// Tanda 292: torneos privados, con código.
//
// Lo pidió PINGU: hay gente que quiere montar una pachanga sin que salga
// en la lista, y que solo entre quien tenga el código.
//
// Lo que de verdad protege es la POLÍTICA de la base, no la pantalla
// (CLAUDE.md lo dice y aquí se comprueba): un `if` en el cliente no
// serviría de nada, porque la respuesta de la API llegaría igual.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync } from 'node:fs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 160) : ''}`)
}

const SQL = readFileSync('/home/user/pingu/supabase-migration-torneos-privados.sql', 'utf8')

console.log('\n── 1. La migración: quién puede leer un torneo privado ──')
{
  check('hay columna de privado', /add column if not exists is_private boolean/.test(SQL))
  check('y de código', /add column if not exists join_code text/.test(SQL))

  const politica = SQL.match(/create policy torneos_leer on public\.tournaments for select\s+using \(([\s\S]*?)\);/)
  check('la política de lectura se rehace', Boolean(politica))
  const cuerpo = politica?.[1] || ''
  // Los tres que SÍ pueden verlo.
  check('lo ve quien lo organiza', /admin_id = auth\.uid\(\)/.test(cuerpo))
  check('lo ven los admins del sitio', /torneos_soy_admin\(\)/.test(cuerpo))
  check('y lo ve quien está inscrito', /torneos_estoy_inscrito\(id\)/.test(cuerpo))
  check('y la condición de privado está', /not coalesce\(is_private, false\)/.test(cuerpo))
  // Lo de antes no se puede perder por el camino.
  check('los borradores siguen siendo de su organizador', /status <> 'draft'/.test(cuerpo))
}

console.log('\n── 2. La recursión que se evita ──')
{
  // Metida a pelo en la política de `tournaments`, la consulta a
  // `tournament_registrations` dispararía la política de ESA tabla, que
  // mira `tournaments`: recursión infinita y las dos tablas dejarían de
  // leerse. Por eso va en una función SECURITY DEFINER.
  const fn = SQL.match(/create or replace function public\.torneos_estoy_inscrito[\s\S]*?\$\$;/)
  check('la comprobación va en su función', Boolean(fn))
  check('y es SECURITY DEFINER', /security definer/.test(fn?.[0] || ''))
  check('con search_path fijado', /set search_path = public/.test(fn?.[0] || ''))
}

console.log('\n── 3. Entrar con el código ──')
{
  const fn = SQL.match(/create or replace function public\.torneos_entrar_con_codigo[\s\S]*?\$\$;/)?.[0] || ''
  check('hay RPC para entrar por el slug', Boolean(fn))
  check('pide sesión', /auth\.uid\(\) is null then raise exception/.test(fn))
  // Un código se copia y se pega, y se pega mal.
  check('el código no distingue mayúsculas ni espacios', /lower\(trim\(coalesce\(p_codigo/.test(fn))
  check('respeta que las inscripciones estén abiertas', /status <> 'registration_open'/.test(fn))
  check('y el aforo', /Torneo lleno/.test(fn))

  // Decir «existe pero el código está mal» ya confirma que ese torneo
  // está ahí, que es justo lo que un torneo privado no quiere contar.
  const noEncontrado = (fn.match(/Torneo no encontrado o código incorrecto/g) || []).length
  check('no existe y código incorrecto dan el MISMO mensaje', noEncontrado === 2, `${noEncontrado} veces`)
}

console.log('\n── 4. Lo que NO hay que hacer: esconder la columna ──')
{
  // En Postgres, un `select *` de un rol sin permiso sobre UNA columna
  // no devuelve esa columna vacía: falla la consulta entera. El cliente
  // pide `tournaments` con `*`, así que un grant por columnas aquí
  // dejaría la sección de torneos sin cargar para todo el mundo.
  check('no se revoca el select de tournaments', !/revoke select on public\.tournaments/.test(SQL))
  check('y está razonado por qué', /falla la consulta[\s\S]{0,20}entera/.test(SQL))
}

console.log('\n── 5. El canal de Telegram no puede cantar un torneo privado ──')
{
  // Esta función usa la clave de SERVICIO, que se salta la RLS: lo que
  // hace invisible a un torneo privado en la web no lo protege aquí.
  const fn = readFileSync('/home/user/pingu/netlify/functions/telegram-torneos.mjs', 'utf8')
  check('la consulta excluye los privados', /is_private\.is\.false/.test(fn), fn.match(/or=\([^)]*\)/)?.[0])
  // Las filas anteriores a la migración lo tienen a null, no a false.
  check('y cuenta las de antes de la migración', /is_private\.is\.null/.test(fn))
}

const BASE = 'http://localhost:8892'
const browser = await chromium.launch()
const abrir = async (ruta, semillas = {}) => {
  const page = await browser.newPage({ viewport: { width: 1150, height: 1000 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 170)))
  await page.addInitScript((s) => {
    window.__FAKE_SESSION__ = s.sesion || 'user-1'
    if (s.torneos) window.__FAKE_TORNEOS__ = s.torneos
    if (s.inscripciones) window.__FAKE_INSCRIPCIONES__ = s.inscripciones
    window.__RPC_RESPUESTAS__ = { torneos_entrar_con_codigo: 'ins-9' }
    if (s.rpcError) window.__RPC_ERROR__ = s.rpcError

  }, semillas)
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  return { page, errores }
}

const PRIVADO = {
  id: 'torneo-1', slug: 'pachanga', name: 'La Pachanga', status: 'registration_open',
  admin_id: 'admin-1', max_players: 8, swiss_rounds: 3, swiss_bo: 3, is_private: true, join_code: 'PACHA',
}

console.log('\n── 6. La chapa de «Privado» ──')
{
  // A quien SÍ lo ve —quien lo organiza, quien está dentro— hay que
  // decirle que el resto no lo ve.
  const { page, errores } = await abrir('/torneos', { torneos: [PRIVADO] })
  check('la tarjeta lo dice', (await page.locator('.torneo-privado').count()) >= 1)
  check('con la palabra', (await page.locator('.torneo-privado').first().textContent())?.includes('Privado'))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await page.close()

  const publico = await abrir('/torneos', { torneos: [{ ...PRIVADO, is_private: false }] })
  check('y un torneo normal NO la lleva', (await publico.page.locator('.torneo-privado').count()) === 0)
  await publico.page.close()
}

console.log('\n── 7. El formulario del código ──')
{
  // Se ofrece SIEMPRE que haya sesión, exista el torneo o no: si solo
  // apareciera cuando el torneo existe, el propio formulario estaría
  // confirmando que ese torneo está ahí.
  // Con la RPC contestando que no —código malo—, no hay recarga y se
  // puede mirar con qué se la llamó.
  const { page } = await abrir('/torneo?slug=no-existe', {
    torneos: [],
    rpcError: { torneos_entrar_con_codigo: 'Torneo no encontrado o código incorrecto.' },
  })
  const form = page.locator('#torneoCodigo')
  check('sale en la pantalla de «no disponible»', await form.isVisible())

  // Una marca puesta desde fuera: no sobrevive a una recarga, y eso es
  // lo que se mira (doblar location.reload no se puede, Chromium no deja
  // redefinirla).
  await page.evaluate(() => { window.__MARCA__ = 1 })
  await page.fill('#torneoCodigoValor', '  pacha  ')
  await page.fill('#torneoCodigoTcg', 'AshKetchum')
  await page.locator('#torneoCodigo button[type="submit"]').click()
  await page.waitForTimeout(700)
  const llamadas = await page.evaluate(() => window.__RPCS__.filter((r) => r.nombre === 'torneos_entrar_con_codigo'))
  check('se llama a la RPC', llamadas.length === 1, JSON.stringify(llamadas))
  check('con el slug del enlace', llamadas[0]?.args?.p_slug === 'no-existe', JSON.stringify(llamadas[0]?.args))
  // Un código se copia y se pega con espacios de sobra.
  check('el código, sin los espacios de pegarlo', llamadas[0]?.args?.p_codigo === 'pacha')
  check('y el usuario de TCG Live', llamadas[0]?.args?.p_tcg_live === 'AshKetchum')
  check('el error se enseña tal cual', (await page.locator('.toast, #toast, [class*="toast"]').first().textContent().catch(() => ''))?.includes('código incorrecto'))
  check('y NO se recarga tras un fallo', await page.evaluate(() => window.__MARCA__ === 1))
  await page.close()

  // Y con la RPC diciendo que sí, la ficha se recarga sola: ya estás
  // dentro, así que la política deja leer el torneo.
  const bien = await abrir('/torneo?slug=no-existe', { torneos: [] })
  await bien.page.evaluate(() => { window.__MARCA__ = 1 })
  await bien.page.fill('#torneoCodigoValor', 'pacha')
  await bien.page.fill('#torneoCodigoTcg', 'AshKetchum')
  await bien.page.locator('#torneoCodigo button[type="submit"]').click()
  await bien.page.waitForTimeout(900)
  check('al acertar, la página se recarga', await bien.page.evaluate(() => window.__MARCA__ === undefined))
  await bien.page.close()
}

console.log('\n── 8. Sin cuenta no se pide el código ──')
{
  // Entrar a un torneo te INSCRIBE, y para eso hace falta cuenta:
  // enseñar el formulario sería mandar a alguien a un callejón.
  const { page } = await abrir('/torneo?slug=no-existe', { sesion: 'none', torneos: [] })
  check('el formulario no sale', !(await page.locator('#torneoCodigo').isVisible()))
  check('y se ofrece entrar en PokeDoc', await page.locator('#torneoEntrar').isVisible())
  await page.close()
}

console.log('\n── 9. El código solo se pide si el torneo es privado ──')
{
  const { page } = await abrir('/torneos', { torneos: [] })
  // La casilla vive en el paso 2 del formulario, que empieza oculto: se
  // comprueba el comportamiento, no la visibilidad de un paso que esta
  // prueba no recorre.
  const r = await page.evaluate(() => {
    const casilla = document.getElementById('torneoPrivado')
    const campo = document.getElementById('torneoCodigoCampo')
    if (!casilla || !campo) return { falta: true }
    const antes = campo.classList.contains('hidden')
    casilla.checked = true
    casilla.dispatchEvent(new Event('change'))
    const conPrivado = campo.classList.contains('hidden')
    casilla.checked = false
    casilla.dispatchEvent(new Event('change'))
    return { falta: false, antes, conPrivado, alQuitarlo: campo.classList.contains('hidden') }
  })
  check('hay casilla de privado al crear', !r.falta)
  check('el campo del código empieza escondido', r.antes === true)
  check('sale al marcar privado', r.conPrivado === false)
  check('y se vuelve a esconder al desmarcar', r.alQuitarlo === true)

  // Que la fila que se inserta lleve de verdad lo privado y el código.
  // El doble no guarda lo que se inserta con las columnas que se le
  // pasan, así que esto se vigila en el fuente: sin ello, la casilla
  // sería un adorno y el torneo saldría público igualmente.
  const fuente = readFileSync('/home/user/pingu/js/torneos/torneos.js', 'utf8')
  check('crear manda is_private', /is_private: Boolean\(\$\('torneoPrivado'\)\?\.checked\)/.test(fuente))
  check('y el código solo si es privado', /join_code: \$\('torneoPrivado'\)\?\.checked \?/.test(fuente))
  // Entre el despliegue y el SQL pueden pasar horas: crear torneos tiene
  // que seguir yendo aunque la base no conozca las columnas nuevas.
  check('con vuelta atrás si falta la migración', /'banner_url', 'is_private', 'join_code'/.test(fuente))

  // Y al editar: quitar «privado» tiene que BORRAR el código. Dejarlo
  // guardado sería tener una llave suelta de una puerta que ya no está.
  const ficha = readFileSync('/home/user/pingu/js/torneos/torneo.js', 'utf8')
  check('editar guarda lo privado', /cambios\.is_private = \$\('editarPrivado'\)\.checked/.test(ficha))
  check('y al quitarlo borra el código', /cambios\.join_code = \$\('editarPrivado'\)\.checked \? [^\n]*: null/.test(ficha))
  await page.close()
}

await browser.close()
console.log(`\n${fails === 0 ? '✅ TODO BIEN' : `❌ ${fails} FALLOS`}`)
process.exit(fails ? 1 : 0)
