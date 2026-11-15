// Tanda 1360 — «el registro está roto: me reenvía al home sin registrarme»
// (PINGU, 2026-11-15). Cuando entrar con Google o el enlace del correo sale
// mal, Supabase vuelve a /index.html con el motivo en la dirección
// (#error=…&error_description=…) y nadie lo leía: se acababa en Inicio sin
// cuenta. Ahora se lleva a Entrar, se explica y se apunta en /admin.
import { chromium, contexto, BASE } from './fixtures-app.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'

console.log('── 0. Lo puro ──')
{
  const { leerVuelta, explicarVuelta, vueltaDeEntrar } = await import(`${RAIZ}/js/auth-vuelta.js`)
  check('sin fallo en la dirección, nada', leerVuelta('#access_token=abc&type=signup') === null && leerVuelta('') === null)
  const db = leerVuelta('#error=server_error&error_code=unexpected_failure&error_description=Database+error+saving+new+user')
  check('lee el fallo del hash', db?.error === 'server_error' && db.texto === 'Database error saving new user', JSON.stringify(db))
  check('…y lo explica como un fallo nuestro', /fallo nuestro/.test(explicarVuelta(db)))
  check('el enlace del correo caducado', /ya no vale/.test(explicarVuelta(leerVuelta('#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired'))))
  check('Google cancelado o no permitido', /Google/.test(explicarVuelta(leerVuelta('?error=access_denied&error_description=The+user+denied'))))
  check('registros cerrados', /no se pueden crear cuentas/.test(explicarVuelta(leerVuelta('#error=access_denied&error_code=signup_disabled&error_description=Signups+not+allowed+for+this+instance'))))
  check('lo desconocido lleva el texto real', /«Algo raro»/.test(explicarVuelta(leerVuelta('#error=x&error_description=Algo+raro'))))
  check('Entrar lo recibe por ?vuelta=', vueltaDeEntrar('', '?vuelta=server_error%7Cunexpected_failure%7CDatabase%20error')?.texto === 'Database error')
}

const b = await chromium.launch()
const errores = []
async function abrir(ruta, movil = true) {
  const ctx = await contexto(b, movil, null)
  const page = await ctx.newPage()
  const apuntados = []
  // La transición entre páginas que el navegador corta al saltar a Entrar no es un fallo (910).
  page.on('pageerror', (e) => { if (!/ViewTransition|Transition was/.test(String(e))) errores.push(`${ruta}: ${String(e).slice(0, 160)}`) })
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  return { page, ctx }
}
const estado = (page) => page.evaluate(() => {
  const a = document.querySelector('.auth-vuelta')
  const paso = a?.closest('#stepLogin, #stepRegister')
  return { ruta: location.pathname, url: location.href, aviso: a?.textContent || '', paso: paso?.id || '', visible: !!paso && !paso.classList.contains('hidden'), arriba: a ? Math.round(a.getBoundingClientRect().top) : null }
})

console.log('── 1. Google falla al crear la cuenta: de Inicio a Entrar, con el porqué ──')
{
  const { page, ctx } = await abrir('/index.html#error=server_error&error_code=unexpected_failure&error_description=Database+error+saving+new+user')
  const s = await estado(page)
  check('acaba en Entrar, no en Inicio', /\/auth(\.html)?$/.test(s.ruta), s.url)
  check('en «Crea tu cuenta», con el aviso a la vista', s.paso === 'stepRegister' && s.visible && /fallo nuestro/.test(s.aviso), JSON.stringify(s))
  check('el aviso se ve sin bajar', s.arriba !== null && s.arriba < 500, s.arriba)
  check('la dirección queda limpia', !/vuelta=|error/.test(s.url), s.url)
  await ctx.close()
}

console.log('── 2. El enlace del correo caducado, directo en Entrar ──')
{
  const { page, ctx } = await abrir('/auth.html#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired')
  const s = await estado(page)
  check('en «Hola de nuevo», con «ya no vale»', s.paso === 'stepLogin' && s.visible && /ya no vale/.test(s.aviso), JSON.stringify(s))
  const apuntados = await page.evaluate(() => JSON.parse(sessionStorage.getItem('__escrituras__') || '[]').filter((e) => e.tabla === 'client_errors').map((e) => JSON.stringify(e.filas)))
  check('se apunta en los errores de /admin', apuntados.some((d) => /otp_expired/.test(d)), apuntados.join(' | '))
  await page.screenshot({ path: `${process.env.SC || '/tmp'}/1360-caducado.png` })
  await ctx.close()
}

console.log('── 3. Lo de siempre no cambia ──')
{
  const { page, ctx } = await abrir('/index.html')
  check('Inicio sin fallo en la dirección se queda en Inicio', await page.evaluate(() => !/auth/.test(location.pathname)))
  await ctx.close()
  const a = await abrir('/auth.html?registro=1')
  const s = await estado(a.page)
  check('Entrar sin fallo, sin aviso', !s.aviso)
  await a.ctx.close()
}

await b.close()
check('sin errores de página', !errores.length, errores.join(' | '))
console.log(fails ? `\n${fails} FALLA(N)` : '\nTodo en verde')
process.exit(fails ? 1 : 0)
