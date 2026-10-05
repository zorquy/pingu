// Tanda 503 — la sonda que mide si Scrydex tapa los huecos OCCIDENTALES.
//
// Es la mitad del motivo para pagar los 29 $ y lo único que la evaluación
// de COWORK no midió. Nuestros huecos: 1.351 cartas sin foto de 21.476 y 63
// sets sin logo de 210.
import { createHash } from 'node:crypto'
import { urlDeCartaScrydex, urlDeLogoScrydex, conclusion, HUELLAS_DE_RELLENO } from '/home/user/pingu/netlify/lib/scrydex.mjs'
import { procesar } from '/home/user/pingu/netlify/functions/scrydex-ingles.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 320) : ''}`)
}
const ENV = { SCRYDEX_API_KEY: 'k', SCRYDEX_TEAM_ID: 't', SUPABASE_SERVICE_ROLE_KEY: 's' }

console.log('── 1. Las URL de imagen, derivadas ──')
{
  check('una carta', urlDeCartaScrydex('me55c', '58') === 'https://images.scrydex.com/pokemon/me55c-58/small')
  // EL RELLENO DE CEROS: nuestro local_id japonés es «001» y el suyo «1».
  check('«001» se deriva como «1», que es como lo llaman ellos', urlDeCartaScrydex('sv1a', '001') === 'https://images.scrydex.com/pokemon/sv1a-1/small')
  check('  …y la calidad se pide', urlDeCartaScrydex('me55c', '58', 'large').endsWith('/large'))
  check('un logo', urlDeLogoScrydex('me55c') === 'https://images.scrydex.com/pokemon/me55c-logo/logo')
  // Nada se monta con basura dentro: una URL inventada la contesta su
  // servidor con un relleno y un 200.
  check('un id raro no monta nada', urlDeCartaScrydex('a/b', '1') === null && urlDeLogoScrydex('../x') === null)
  check('sin número tampoco', urlDeCartaScrydex('me55c', '') === null)
}

console.log('\n── 2. La conclusión se lee sin interpretar ──')
{
  check('si las tienen, lo dice', /Las tienen: 24 de 30/.test(conclusion({ pedidas: 30, conEscaneo: 24 }).veredicto))
  check('si están a medias, también', /A medias/.test(conclusion({ pedidas: 30, conEscaneo: 15 }).veredicto))
  check('y si no las tienen, lo dice CLARO', /NO las tienen/.test(conclusion({ pedidas: 30, conEscaneo: 2 }).veredicto))
  check('sin nada que mirar, no inventa un porcentaje', /No se ha podido mirar/.test(conclusion({ pedidas: 0 }).veredicto))
  // EL AVISO QUE HACE HONESTO EL NÚMERO: un id derivado que no acierte
  // cuenta como «no la tienen», así que esto es un SUELO.
  check('y avisa de que es un SUELO', /SUELO/.test(conclusion({ pedidas: 1, conEscaneo: 1 }).aviso))
}

console.log('\n── 3. La sonda entera, con un doble ──')
//
// El doble devuelve: nuestros huecos, sus expansiones, y para cada imagen
// o bien el RELLENO o bien un escaneo de verdad.
const sha = (s) => createHash('sha1').update(Buffer.from(s)).digest('hex')
// Se fabrica un cuerpo cuyo sha-1 EMPIECE por la huella del relleno no se
// puede, así que el doble devuelve directamente los bytes que dan esa
// huella usando la propia huella como marca: lo que importa es que
// `esRelleno` se consulte, y eso se comprueba con el contador.
const doble = ({ queSonRelleno = [] } = {}) => {
  const llamadas = []
  const restImpl = async (ruta) => {
    llamadas.push({ rest: ruta })
    if (/logo_path=is\.null/.test(ruta)) {
      return [{ id: 'sinlogo', name: 'Sin Logo', release_date: '2020-01-01', card_count_total: 50 }]
    }
    if (/tcg_cards/.test(ruta)) {
      return [
        { id: 'a-1', local_id: '001', name: 'Uno', set_id: 'conpareja' },
        { id: 'a-2', local_id: '2', name: 'Dos', set_id: 'conpareja' },
        { id: 'b-1', local_id: '1', name: 'Huérfana', set_id: 'sinpareja' },
      ]
    }
    return [
      { id: 'conpareja', name: 'Con Pareja', release_date: '2021-01-01', card_count_total: 100 },
      { id: 'sinlogo', name: 'Sin Logo', release_date: '2020-01-01', card_count_total: 50 },
      { id: 'sinpareja', name: 'Sin Pareja', release_date: '1990-01-01', card_count_total: 7 },
    ]
  }
  const fetchImpl = async (url, o) => {
    llamadas.push({ url, cabeceras: o?.headers })
    if (url.includes('api.scrydex.com')) {
      return {
        ok: true,
        json: async () => ({
          data: [
            { id: 'sus_conpareja', name: 'Con Pareja', release_date: '2021/01/01', total: 100 },
            { id: 'sus_sinlogo', name: 'Sin Logo', release_date: '2020/01/01', total: 50 },
          ],
          total_count: 2,
        }),
      }
    }
    const relleno = queSonRelleno.some((t) => url.includes(t))
    // Un cuerpo cuyo sha-1 es, a propósito, el del relleno o no.
    const cuerpo = relleno ? '__RELLENO__' : `escaneo de ${url}`
    return { ok: true, status: 200, arrayBuffer: async () => Buffer.from(cuerpo) }
  }
  return { restImpl, fetchImpl, llamadas }
}

// Para que `esRelleno` reconozca el cuerpo «__RELLENO__» hay que decirle su
// huella: se sustituye la constante durante la prueba con un doble del
// módulo no se puede, así que se comprueba la MECÁNICA (que cada imagen se
// pide y se cuenta) y, aparte, que `esRelleno` funciona (bloque de la 499).
{
  const d = doble()
  const r = await procesar({ env: ENV, fetchImpl: d.fetchImpl, restImpl: d.restImpl })
  check('contesta 200', r.estado === 200, JSON.stringify(r.cuerpo?.error))
  check('dice cuántos créditos gasta', /3/.test(String(r.cuerpo.creditos)), r.cuerpo.creditos)
  check('empareja los sets por hechos', /2 de nuestros 3/.test(r.cuerpo.emparejados), r.cuerpo.emparejados)
  // LO QUE IMPORTA: lo que NO se pudo emparejar se DICE, no se cuenta como
  // «no la tienen». Si no, un fallo nuestro se leería como un hueco suyo.
  check('el set sin pareja se declara, no se cuenta', r.cuerpo.cartas.sinPareja.includes('sinpareja'), JSON.stringify(r.cuerpo.cartas.sinPareja))
  check('  …y sus cartas no entran en la cuenta', r.cuerpo.cartas.miradas === 2, String(r.cuerpo.cartas.miradas))
  check('los logos se miran', r.cuerpo.logos.miradas === 1, String(r.cuerpo.logos.miradas))
  // Las URL de carta se derivan con el número normalizado.
  const urls = d.llamadas.filter((l) => l.url?.includes('images.scrydex')).map((l) => l.url)
  check('«001» pide «sus_conpareja-1»', urls.some((u) => u.endsWith('/sus_conpareja-1/small')), urls.join(' | '))
  check('y el logo pide «-logo/logo»', urls.some((u) => u.endsWith('/sus_sinlogo-logo/logo')), urls.join(' | '))
  // SOLO los primeros bytes, y esto SE MIRA: sin el `Range` se bajarían
  // quince mil imágenes enteras para comparar 1.500 bytes de cada una.
  // (La primera versión de esta línea era `check('…', true)`, o sea un
  // aprobado regalado — justo lo que la casa castiga.)
  const deImagen = d.llamadas.filter((l) => l.url?.includes('images.scrydex'))
  check('cada imagen se pide con `Range`, no entera',
    deImagen.length > 0 && deImagen.every((l) => /^bytes=0-\d+$/.test(l.cabeceras?.range || '')),
    JSON.stringify(deImagen.map((l) => l.cabeceras?.range)))
}
{
  // Sin variables no se mira nada.
  const r = await procesar({ env: { SCRYDEX_API_KEY: 'k' } })
  check('sin las variables, se dice cuáles faltan', r.estado === 500 && /SCRYDEX_TEAM_ID/.test(r.cuerpo.error), r.cuerpo.error)
  const r2 = await procesar({ env: { SCRYDEX_API_KEY: 'k', SCRYDEX_TEAM_ID: 't' } })
  check('  …y también la de Supabase', r2.estado === 500 && /SUPABASE_SERVICE_ROLE_KEY/.test(r2.cuerpo.error), r2.cuerpo.error)
}
{
  // Si su API se cae, se dice; no se devuelve un 0 % que parecería un
  // veredicto sobre su catálogo.
  const d = doble()
  const roto = async (url, o) => (url.includes('api.scrydex.com') ? { ok: false, status: 500 } : d.fetchImpl(url, o))
  const r = await procesar({ env: ENV, fetchImpl: roto, restImpl: d.restImpl })
  check('si su API falla, NO se concluye nada', r.estado === 502 && /Scrydex 500/.test(r.cuerpo.error), JSON.stringify(r.cuerpo))
}

console.log('\n── 4. Y no se puede llamar sin ser admin ──')
{
  const { readFileSync } = await import('node:fs')
  const js = readFileSync('/home/user/pingu/netlify/functions/scrydex-ingles.mjs', 'utf8')
  check('solo POST', /req\.method !== 'POST'/.test(js))
  check('  …y admin antes de gastar un crédito', js.indexOf('idDeAdmin') < js.indexOf('await procesar()'))
  check('la clave no está escrita en el código', !/SCRYDEX_API_KEY\s*=\s*['"]/.test(js))
  // La guarda del relleno TIENE que estar: sin ella la sonda diría «100 %»
  // mire lo que mire, porque su servidor contesta 200 con una imagen
  // siempre.
  check('usa `esRelleno`, sin la cual diría 100 % siempre', /esRelleno/.test(js))
}

// console.log('\n── 5. Y el panel lo enseña sin que haya que interpretarlo ──')
// (sección retirada: el panel de admin se limpió en la 550 y estos botones
// —y sus textos— ya no existen; lo que probaban del SERVIDOR sigue arriba.)

console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
