// Tanda 500 — la sonda de Scrydex: que la clave no se escape y que nadie
// más pueda gastarla.
//
// PINGU ya tiene `SCRYDEX_API_KEY` y `SCRYDEX_TEAM_ID` en Netlify. Antes de
// pedir una sola carta, lo que hay que probar no es que funcione: es que
// NO pueda salir mal de las dos formas caras.
import { cabecerasDe, urlDeSonda, BASE } from '/home/user/pingu/netlify/lib/scrydex.mjs'
import { idDeAdmin, tokenDe } from '/home/user/pingu/netlify/lib/admin.mjs'
import { procesar } from '/home/user/pingu/netlify/functions/scrydex-sonda.mjs'
import { readFileSync } from 'node:fs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const ENV = { SCRYDEX_API_KEY: 'CLAVE-SECRETA', SCRYDEX_TEAM_ID: 'EQUIPO-SECRETO' }

console.log('── 1. Las DOS cabeceras, o no se sale de casa ──')
//
// Según sus docs, una petición SIN autenticar NO falla: pasa con el límite
// «muy reducido». O sea que olvidar una variable no da un error que cante,
// da una API que parece ir mal. Por eso se exigen las dos antes de pedir.
{
  const { cabeceras } = cabecerasDe(ENV)
  check('manda X-Api-Key y X-Team-ID', cabeceras['X-Api-Key'] === 'CLAVE-SECRETA' && cabeceras['X-Team-ID'] === 'EQUIPO-SECRETO')
  check('sin la clave, se dice CUÁL falta', cabecerasDe({ SCRYDEX_TEAM_ID: 'x' }).faltan?.join() === 'SCRYDEX_API_KEY')
  check('sin el equipo, también', cabecerasDe({ SCRYDEX_API_KEY: 'x' }).faltan?.join() === 'SCRYDEX_TEAM_ID')
  check('sin ninguna, las dos', cabecerasDe({}).faltan?.length === 2)
  check('y sin cabeceras cuando falta algo', !cabecerasDe({}).cabeceras)
}

console.log('\n── 2. La ruta, acotada: a esta petición se le enganchan NUESTRAS CLAVES ──')
//
// Una `ruta` sin validar mandaría las dos claves adonde diga quien llame.
// Que solo pueda llamar un admin reduce el riesgo, no lo quita: un admin
// con la sesión robada, o un enlace que alguien le pase, bastan.
{
  check('una ruta normal vale', urlDeSonda('en/expansions') === `${BASE}/en/expansions`)
  check('  …con parámetros escapados', urlDeSonda('cards', { q: 'a b&c=d', page_size: 100 }) === `${BASE}/cards?q=a+b%26c%3Dd&page_size=100`)
  check('  …y sin los vacíos', urlDeSonda('cards', { a: '', b: null, c: undefined, d: 1 }) === `${BASE}/cards?d=1`)
  // LOS QUE IMPORTAN: ninguno de éstos puede salir de su dominio.
  for (const malo of [
    'https://evil.example/robar',
    '//evil.example/robar',
    '../../../etc/passwd',
    'en/../../otro',
    'http://evil.example',
    '/\\evil.example',
    'en/expansions?x=1',
    'en expansions',
  ]) {
    check(`«${malo}» se rechaza`, urlDeSonda(malo) === null, String(urlDeSonda(malo)))
  }
  check('vacío también', urlDeSonda('') === null && urlDeSonda(null) === null)
  // Y lo que SÍ sale, sale siempre a su dominio y por HTTPS.
  for (const buena of ['cards', 'en/expansions', 'ja/expansions/sv1a', 'cards_v2']) {
    check(`«${buena}» va a su dominio por https`, (urlDeSonda(buena) || '').startsWith('https://api.scrydex.com/pokemon/v1/'))
  }
}

console.log('\n── 3. La sonda no filtra la clave ni escribe nada ──')
{
  let pedido = null
  const falso = async (url, o) => {
    pedido = { url, cabeceras: o?.headers, metodo: o?.method }
    return { status: 200, text: async () => '{"data":[{"id":"sv8-1"}]}' }
  }
  const r = await procesar({ cuerpo: { ruta: 'en/expansions', params: { page_size: 1 } }, env: ENV, fetchImpl: falso })
  check('contesta 200', r.estado === 200, JSON.stringify(r.estado))
  check('devuelve la respuesta CRUDA, no un resumen', /"data"/.test(r.cuerpo.respuesta), r.cuerpo.respuesta)
  check('y el estado HTTP de ellos', r.cuerpo.estadoHttp === 200)
  // LO QUE MÁS IMPORTA: esto se pega en un cuadro de texto y se copia por
  // ahí. Ni la clave ni el equipo pueden aparecer en lo que devuelve.
  const todo = JSON.stringify(r.cuerpo)
  check('la CLAVE no aparece en la respuesta', !todo.includes('CLAVE-SECRETA'), todo.slice(0, 120))
  check('el EQUIPO tampoco', !todo.includes('EQUIPO-SECRETO'))
  check('  …y la url que devuelve tampoco las lleva', !r.cuerpo.url.includes('CLAVE') && !r.cuerpo.url.includes('EQUIPO'), r.cuerpo.url)
  // Las claves SÍ van en la petición de verdad, en cabeceras.
  check('pero sí viajan en las cabeceras', pedido.cabeceras['X-Api-Key'] === 'CLAVE-SECRETA')
  // No escribe: una sonda que escribe no es una sonda.
  check('la petición es de LECTURA', !pedido.metodo || pedido.metodo === 'GET', String(pedido.metodo))
}
{
  // Sin variables no se pide NADA: no se gasta un crédito para descubrir
  // que falta una variable.
  let pedidas = 0
  const r = await procesar({ cuerpo: { ruta: 'cards' }, env: {}, fetchImpl: async () => { pedidas++; return { status: 200, text: async () => '' } } })
  check('sin variables no se pide nada', pedidas === 0 && r.estado === 500, JSON.stringify(r.cuerpo))
  check('  …y dice qué falta, por su nombre', /SCRYDEX_API_KEY/.test(r.cuerpo.error) && /SCRYDEX_TEAM_ID/.test(r.cuerpo.error), r.cuerpo.error)
}
{
  // Una ruta mala tampoco gasta crédito.
  let pedidas = 0
  const r = await procesar({ cuerpo: { ruta: 'https://evil.example' }, env: ENV, fetchImpl: async () => { pedidas++ } })
  check('una ruta rechazada no gasta crédito', pedidas === 0 && r.estado === 400, JSON.stringify(r.cuerpo))
}
{
  // Si su API se cae, se dice; no se revienta la función.
  const r = await procesar({ cuerpo: { ruta: 'cards' }, env: ENV, fetchImpl: async () => { throw new Error('ECONNRESET') } })
  check('un corte se cuenta, no revienta', r.estado === 502 && /ECONNRESET/.test(r.cuerpo.error), JSON.stringify(r.cuerpo))
}
{
  // Una respuesta enorme se recorta y SE DICE que se ha recortado: un
  // JSON cortado a la mitad sin avisar parece un JSON mal formado suyo.
  const r = await procesar({ cuerpo: { ruta: 'cards' }, env: ENV, fetchImpl: async () => ({ status: 200, text: async () => 'x'.repeat(50000) }) })
  check('lo muy largo se recorta', r.cuerpo.respuesta.length === 20000, String(r.cuerpo.respuesta.length))
  check('  …y lo dice', r.cuerpo.recortado === true)
}

console.log('\n── 4. La guarda de admin ──')
//
// Una función de Netlify es una URL PÚBLICA. Sin esto, cualquiera que la
// descubra tiene una API de pago gratis a costa de la cuenta — y con 5.000
// créditos al mes, eso se agota en una tarde.
{
  const resp = (ok, cuerpo) => ({ ok, json: async () => cuerpo })
  const admin = async (url) => (url.includes('/auth/v1/user') ? resp(true, { id: 'u1' }) : resp(true, [{ is_admin: true }]))
  const normal = async (url) => (url.includes('/auth/v1/user') ? resp(true, { id: 'u2' }) : resp(true, [{ is_admin: false }]))
  check('un admin pasa, y devuelve su id', (await idDeAdmin('tok', admin)) === 'u1')
  check('alguien normal NO pasa', (await idDeAdmin('tok', normal)) === null)
  check('sin token, no', (await idDeAdmin('', admin)) === null && (await idDeAdmin(null, admin)) === null)
  check('un token que Supabase rechaza, no', (await idDeAdmin('tok', async () => resp(false, {}))) === null)
  check('un perfil que no existe, no', (await idDeAdmin('tok', async (u) => (u.includes('/auth/') ? resp(true, { id: 'u' }) : resp(true, [])))) === null)
  // UN CORTE DE RED NO ES UN PERMISO: si Supabase no contesta, no se pasa.
  // Lo contrario convertiría su caída en barra libre con nuestra clave.
  check('si Supabase no contesta, NO se pasa', (await idDeAdmin('tok', async () => { throw new Error('caído') })) === null)
  check('«Bearer x» y «x» son el mismo token', (await idDeAdmin('Bearer tok', admin)) === 'u1')
  check('tokenDe saca el de la cabecera', tokenDe({ headers: { get: () => 'Bearer abc' } }) === 'abc')
  check('  …y aguanta una petición sin cabeceras', tokenDe({}) === '' && tokenDe(null) === '')
}

console.log('\n── 5. Y la función exige las dos cosas ──')
{
  const js = readFileSync('/home/user/pingu/netlify/functions/scrydex-sonda.mjs', 'utf8')
  check('solo POST', /req\.method !== 'POST'/.test(js))
  check('  …y comprueba que es admin ANTES de pedir', js.indexOf('idDeAdmin') < js.indexOf('procesar({ cuerpo })'))
  check('la clave no está escrita en el código', !/SCRYDEX_API_KEY\s*=\s*['"]/.test(js))
  check('  …sale del entorno', /env/.test(readFileSync('/home/user/pingu/netlify/lib/scrydex.mjs', 'utf8')))
}

// console.log('\n── 6. Y el panel la llama con la sesión, no con la clave ──')
// (sección retirada: el panel de admin se limpió en la 550 y estos botones
// —y sus textos— ya no existen; lo que probaban del SERVIDOR sigue arriba.)

console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
