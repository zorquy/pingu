// Tanda 321 — los sprites sobreviven a que se caiga la CDN.
//
// El 2026-09-20 r2.limitlesstcg.net dejó de responder y TODOS los
// sprites del sitio se apagaron a la vez: en /mis-partidas se veían los
// huecos reservados y nada dentro, porque el manejador de error esconde
// lo que no llega.
//
// La prueba se escribe contra LA FORMA del fallo, no contra el caso:
// «un origen deja de contestar», no «Limitless está caído». Por eso el
// bloque 3 apaga los dos primeros peldaños desde el navegador en vez de
// confiar en que uno esté realmente caído.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import {
  urlDeSprite, dexDeCarta, respaldoDeSprite, cadenaDeRespaldos, atributosDeRespaldo,
} from '/home/user/pingu/js/torneos/sprites-pokemon.js'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 220) : ''}`)
}

const LIMITLESS = 'https://r2.limitlesstcg.net/'
// Un PNG de verdad, para que el navegador tenga algo que pintar cuando
// se le sirve el tercer peldaño sin salir a la red.
const PNG = '/tmp/pk887.png'

// El navegador de Playwright no hereda el proxy del contenedor, así que
// para mirar la red se usa curl, que sí. (Lo de arriba es por lo que el
// bloque 3 no sale a internet: no por gusto, es que no puede.)
// Devuelve `bloqueado` cuando el que dice que no es NUESTRA red, no el
// origen. Los dos se parecen (un cero y ninguna respuesta) y confundirlos
// es lo que hace que una prueba afirme que un sitio está caído cuando lo
// único que pasa es que desde aquí no se sale.
const cabecera = async (url) => {
  try {
    const salida = execFileSync('curl', ['-sS', '-o', '/dev/null', '--max-time', '25',
      '-w', '%{http_code} %{content_type}', url], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    const [status, tipo] = salida.trim().split(' ')
    return { status: Number(status), tipo }
  } catch (e) {
    const texto = `${e.stderr || ''} ${e.message || ''}`
    const bloqueado = /CONNECT tunnel failed|403|Received HTTP code 403 from proxy/.test(texto)
    return { status: 0, tipo: texto.replace(/\s+/g, ' ').slice(0, 70), bloqueado }
  }
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. Todo sprite tiene a dónde caer, y acaba fuera de Limitless ──')
{
  // Si la cadena se queda dentro del mismo origen, no sirve para nada
  // en el caso que la motivó: el origen entero no contesta.
  const CASOS = ['Dragapult ex', 'Raging Bolt ex', 'Gholdengo', 'Pikachu', 'Charizard ex',
    'Mega Lopunny ex', 'Ogerpon', 'Iron Valiant', 'Bulbasaur', 'Pecharunt']
  const sinSalida = []
  const sinDex = []
  for (const nombre of CASOS) {
    const u = urlDeSprite(dexDeCarta(nombre))
    const cadena = cadenaDeRespaldos(u)
    if (!cadena.some((x) => !x.startsWith(LIMITLESS))) sinSalida.push(nombre)
    // El último peldaño tiene que llevar el número de Pokédex de VERDAD:
    // un desplazamiento de uno daría el Pokémon de al lado y no canta.
    const dex = dexDeCarta(nombre)
    const esperado = `/${/^Mega /.test(nombre) ? '428' : dex}.png`
    if (cadena.length && !cadena[cadena.length - 1].endsWith(esperado)) sinDex.push(`${nombre}: ${cadena.at(-1)}`)
  }
  check('todos salen del origen caído', sinSalida.length === 0, sinSalida.join(', '))
  check('  …y con su número de Pokédex', sinDex.length === 0, sinDex.join(' | '))

  // Una mega baja primero a su especie base DENTRO de Limitless (se
  // conserva el estilo) y solo después cambia de origen. Si se salta ese
  // peldaño, una mega que la CDN aún no tiene pierde calidad sin motivo.
  const mega = cadenaDeRespaldos(urlDeSprite(dexDeCarta('Mega Lopunny ex')))
  check('una mega prueba antes su especie base', mega[0] === 'https://r2.limitlesstcg.net/pokemon/gen9/lopunny.png', mega[0])

  // Los dos peldaños de salida son EL MISMO fichero por dos puertas
  // distintas (jsDelivr sirve el repo de GitHub), así que tienen que
  // pedir la misma ruta. Cambiar uno y no el otro es lo que pasa cuando
  // alguien «mejora» el respaldo a medias, y no da error: simplemente
  // uno de los dos deja de existir para media Pokédex.
  //
  // Esta comprobación va aquí, sin red, a propósito: el bloque 4 no
  // puede pedirlos todos en cualquier entorno, y una invariante que
  // solo se comprueba cuando hay salida a internet no se comprueba.
  {
    const fuera = cadenaDeRespaldos(urlDeSprite(1021)).filter((u) => !u.startsWith(LIMITLESS))
    const rutas = fuera.map((u) => u.slice(u.indexOf('/sprites/pokemon/')))
    check('los dos peldaños de salida piden el mismo fichero',
      fuera.length === 2 && rutas[0] === rutas[1], fuera.join(' | '))
  }

  // Y la cadena termina: sin esto un manejador que la recorre en bucle
  // cuelga la pestaña.
  check('la cadena acaba', respaldoDeSprite(cadenaDeRespaldos(urlDeSprite(887)).at(-1)) === null)
  check('  …y no da vueltas', new Set(cadenaDeRespaldos(urlDeSprite(887))).size === cadenaDeRespaldos(urlDeSprite(887)).length)
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. El atributo no rompe el HTML que lo lleva ──')
{
  // El manejador va DENTRO de un atributo entre comillas dobles, y una
  // sola comilla doble dentro lo cerraría a media función: el resto se
  // leería como atributos sueltos y el onerror no existiría. No daría
  // error en ninguna parte.
  const attr = atributosDeRespaldo(urlDeSprite(887))
  const manejador = attr.match(/onerror="([^"]*)"/)?.[1] ?? ''
  check('el onerror está entero', manejador.includes('display') && manejador.includes('respaldos'), manejador.slice(0, 60))
  check('  …sin comillas dobles dentro', !/["]/.test(manejador))
  check('la cadena viaja en el atributo', /data-respaldos="[^"]+"/.test(attr))
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. Con el origen caído, el sprite aparece igual ──')
{
  // Aquí está la prueba de verdad, y se hace en un navegador porque lo
  // que se afirma es «se ve», no «el código lo intenta». Se cortan los
  // DOS primeros peldaños a nivel de red: es la forma del fallo (un
  // origen que no contesta), sin depender de que hoy esté caído.
  //
  // El tercero se SIRVE desde aquí en vez de ir a por él de verdad. No
  // es por comodidad: una prueba que necesita que un tercero esté en pie
  // se pone roja el día que se cae, y entonces dice «nuestro encadenado
  // está roto» cuando lo que pasa es justo lo contrario — que hace
  // falta. Que esas URLs existan se comprueba aparte, en el bloque 4.
  const browser = await chromium.launch()
  const page = await browser.newPage()
  const pedidas = []
  await page.route('**/*', async (ruta) => {
    const u = ruta.request().url()
    pedidas.push(u)
    if (u.startsWith(LIMITLESS) || u.startsWith('https://cdn.jsdelivr.net/')) return ruta.abort()
    if (u.startsWith('https://raw.githubusercontent.com/')) {
      return ruta.fulfill({ status: 200, contentType: 'image/png', body: readFileSync(PNG) })
    }
    return ruta.continue()
  })
  const attr = atributosDeRespaldo(urlDeSprite(887))
  await page.setContent(`<img id="s" src="${urlDeSprite(887)}"${attr} />`)
  await page.waitForFunction(
    () => { const i = document.getElementById('s'); return i.complete && (i.naturalWidth > 0 || i.style.display === 'none') },
    null, { timeout: 30000 }
  ).catch(() => {})
  const r = await page.evaluate(() => {
    const i = document.getElementById('s')
    return { src: i.src, ancho: i.naturalWidth, escondida: i.style.display === 'none' }
  })
  check('el sprite acaba viéndose', r.ancho > 0 && !r.escondida, JSON.stringify(r))
  check('  …desde el tercer origen', r.src.startsWith('https://raw.githubusercontent.com/'), r.src)
  check('  …y se intentó Limitless primero', pedidas.some((u) => u.startsWith(LIMITLESS)))
  check('  …y jsDelivr por el camino', pedidas.some((u) => u.startsWith('https://cdn.jsdelivr.net/')))

  // Y el otro lado: si NO queda ninguno, se esconde. Un icono roto es
  // peor que un hueco, y esa decisión también hay que sostenerla.
  //
  // En un CONTEXTO nuevo, no en la misma pestaña: el navegador ya se ha
  // traído el tercer peldaño ahí arriba y lo sirve de su caché aunque la
  // red esté cortada, así que la imagen se veía y la prueba decía que no
  // se esconde. El fallo era de la prueba, y de los que dan verde por el
  // motivo equivocado si el orden de los bloques cambia.
  const limpio = await browser.newContext()
  const otra = await limpio.newPage()
  await otra.route('**/*', (ruta) => ruta.abort())
  await otra.setContent(`<img id="t" src="${urlDeSprite(887)}"${attr} />`)
  await otra.waitForFunction(() => document.getElementById('t').style.display === 'none', null, { timeout: 30000 }).catch(() => {})
  const escondida = await otra.evaluate(() => document.getElementById('t').style.display === 'none')
  check('sin ningún origen, la imagen se esconde', escondida)
  await limpio.close()

  await browser.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 4. Y esas URLs de respaldo existen de verdad ──')
{
  // Lo que el bloque 3 finge, aquí se comprueba contra la red. Va
  // aparte a propósito: si este sale rojo, el mensaje es «el respaldo ya
  // no vale, busca otro», que es una noticia distinta de «el encadenado
  // está roto». Se piden por NÚMERO, que es lo que el respaldo usa, y se
  // cubren las nueve generaciones porque el corte de la novena es justo
  // lo que descartó al candidato anterior (los iconos de caja de octava
  // se acaban en el 898 y la novena es la que se juega).
  // Y se piden TODOS los peldaños de cada cadena, no solo el último.
  // Mirar solo el final dejaba pasar que el segundo origen apuntara a
  // una ruta que no cubre la novena generación: el rigor cambió esa
  // ruta, el tercer peldaño seguía bien y la prueba se quedó en verde.
  // Un respaldo que no se comprueba no es un respaldo.
  const DEX = [1, 25, 150, 384, 493, 649, 721, 809, 898, 1000, 1006, 1017, 1021, 1025]
  const malos = []
  const bloqueados = new Set()
  let pedidos = 0
  let comprobados = 0
  for (const d of DEX) {
    for (const u of cadenaDeRespaldos(urlDeSprite(d))) {
      // Los peldaños que siguen dentro de Limitless no se piden: hoy
      // está caída, y lo que este bloque comprueba es la SALIDA.
      if (u.startsWith(LIMITLESS)) continue
      pedidos++
      const { status, tipo, bloqueado } = await cabecera(u)
      if (bloqueado) { bloqueados.add(new URL(u).host); continue }
      comprobados++
      if (status !== 200 || !String(tipo).startsWith('image/')) malos.push(`${d} → ${u}: ${status} ${tipo}`)
    }
  }
  check(`los peldaños de salida contestan una imagen (${comprobados} de ${pedidos})`,
    malos.length === 0, malos.join(' | '))
  // Un bloque que no llega a comprobar NADA sale verde igual y no
  // significa nada — la lección de la tanda 307. Al menos un origen de
  // salida tiene que haberse podido pedir de verdad.
  check('  …y se ha podido comprobar al menos un origen', comprobados > 0,
    `todo bloqueado: ${[...bloqueados].join(', ')}`)
  if (bloqueados.size) {
    console.log(`  ·· sin comprobar (la red de ESTE entorno los bloquea, que no dice nada del origen): ${[...bloqueados].join(', ')}`)
  }
}

console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
