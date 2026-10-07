// Tanda 370 — las cartas que no salían con imagen.
//
// PINGU: «todavía hay cartas que no salen, hay cartas antiguas que no
// salen y hay cartas del 30 aniversario que no tienen imágenes, sobre
// todo la Classic Collection; un montón de cartas de la era de Sol y
// Luna que tampoco salen con imagen».
//
// No era del idioma ni de la importación: `image_path` sale del listado
// de TCGdex, que se pide en INGLÉS, y TCGdex sencillamente no tiene
// escaneo de esas cartas — es un catálogo comunitario y los sets viejos
// están a medias. En `carta-nucleo.js` había escrito un comentario que
// decía «el catálogo es inglés y tiene escaneo de todas las cartas»: esa
// suposición es lo que dejaba el hueco.
//
// El segundo sitio es la CDN de Limitless, que va por CÓDIGO DE TCG LIVE
// y número, o sea que no depende de que TCGdex conozca la carta. La
// cadena ya existía para las decklists (tanda 366); lo que hace esta
// tanda es llevarla al catálogo, que es donde se mira.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync } from 'node:fs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 220) : ''}`)
}
const leer = (f) => readFileSync(`/home/user/pingu/${f}`, 'utf8')
const BASE = process.env.PD_BASE || 'http://localhost:8892'

console.log('\n── 1. La dirección de Limitless, sin arrastrar el constructor ──')
{
  const { imagenDeLimitless, PROMOS_SIN_GUION, codigoDeSetDe } = await import('/home/user/pingu/js/escaneo-carta.js')
  // ── CÓMO SE ESCRIBE EL NÚMERO (corregido en la tanda 379) ──
  //
  // Limitless tiene DOS costumbres y hay que respetar las dos: el número
  // a secas va con TRES cifras, y el que lleva letras delante va SIN el
  // cero de relleno.
  //
  // La segunda faltaba, y el síntoma era tan raro que no lo habría
  // cazado nadie leyendo el código: en la Galarian Gallery `GG10` a
  // `GG70` se veían y `GG01` a `GG09` NO. La misma colección, unas sí y
  // otras no, sin un solo error por ninguna parte. Lo vio PINGU mirando
  // cartas a mano: «el GG10 carga, pero el GG1 no».
  //
  // Los casos de abajo están COMPROBADOS contra la CDN el 2026-09-30, no
  // deducidos: `CRZ_GG1` carga, `SHF_SV001` no y `SHF_SV1` sí. Dos
  // series distintas, que es lo que permite tratarlo como una regla y no
  // como una lista de excepciones.
  check('un número normal va a tres cifras', imagenDeLimitless('TWM', '130').endsWith('/TWM/TWM_130_R_EN_SM.png'),
    imagenDeLimitless('TWM', '130'))
  check('  …y uno de una cifra también', imagenDeLimitless('SUM', '7').endsWith('/SUM/SUM_007_R_EN_SM.png'),
    imagenDeLimitless('SUM', '7'))
  check('  …pero uno con letras PIERDE el cero de relleno',
    imagenDeLimitless('CRZ', 'GG01').endsWith('/CRZ/CRZ_GG1_R_EN_SM.png'), imagenDeLimitless('CRZ', 'GG01'))
  check('  …y lo mismo con tres cifras', imagenDeLimitless('SHF', 'SV001').endsWith('/SHF/SHF_SV1_R_EN_SM.png'),
    imagenDeLimitless('SHF', 'SV001'))
  // Y el que NO lleva cero de relleno no se toca: el cero de `GG10` es
  // parte del número, no relleno. Quitarlo dejaría `GG1` para DOS cartas
  // distintas, que es peor que el fallo que se venía a arreglar.
  check('  …y un cero que NO es relleno se queda',
    imagenDeLimitless('CRZ', 'GG10').endsWith('/CRZ/CRZ_GG10_R_EN_SM.png'), imagenDeLimitless('CRZ', 'GG10'))
  check('  …ni se toca el que no tiene ceros',
    imagenDeLimitless('PR-SM', 'SM125').endsWith('/SMP/SMP_SM125_R_EN_SM.png'), imagenDeLimitless('PR-SM', 'SM125'))

  // El tope del número: los promos de Espada y Escudo son `SWSH177`, que
  // son SIETE caracteres, y el guardia aceptaba hasta 6 — devolvía null
  // y esas 22 cartas no llegaban ni a intentarlo. Un corte elegido a ojo
  // es una afirmación sobre un ancho que nadie ha medido (lección 320).
  check('un número de siete caracteres ya no se tira',
    imagenDeLimitless('PR-SW', 'SWSH177') !== null, String(imagenDeLimitless('PR-SW', 'SWSH177')))
  check('  …y además pierde su cero', imagenDeLimitless('PR-SW', 'SWSH074').endsWith('/SP/SP_SWSH74_R_EN_SM.png'),
    imagenDeLimitless('PR-SW', 'SWSH074'))
  // Pero sigue sin inventarse: nueve caracteres no es un número de carta.
  check('  …y con nueve sigue sin montar nada', imagenDeLimitless('TWM', 'ABCDEFGHI') === null,
    String(imagenDeLimitless('TWM', 'ABCDEFGHI')))
  // Las promos llevan guion en TCG Live y no en la CDN.
  check('las promos se traducen', imagenDeLimitless('PR-SV', '92').includes('/SVP/SVP_092_'),
    imagenDeLimitless('PR-SV', '92'))
  check('  …y la tabla está entera', Object.keys(PROMOS_SIN_GUION).length === 6, Object.keys(PROMOS_SIN_GUION).join(' '))
  // Esto monta una dirección A PELO: una inventada es una imagen rota, y
  // es mejor no pintar nada — la caja ya tiene su estilo para eso.
  check('sin set o sin número no se inventa nada',
    imagenDeLimitless('', '12') === null && imagenDeLimitless('TWM', '') === null && imagenDeLimitless(null, null) === null)
  check('el código sale de donde venga', codigoDeSetDe({ tcg_sets: { tcg_online_code: 'SUM' } }) === 'SUM' &&
    codigoDeSetDe({ tcg_online_code: 'TWM' }) === 'TWM' && codigoDeSetDe({}, 'MEE') === 'MEE' && codigoDeSetDe({}) === null)

  // POR QUÉ ESTE FICHERO EXISTE: la tabla vivía en `constructor/nucleo.js`,
  // que son 26 KB de reglas de legalidad de mazos. Importarla desde el
  // catálogo se los llevaba puestos a /cartas y a /coleccion para montar
  // una dirección.
  const nucleo = leer('js/carta-nucleo.js')
  check('el catálogo no importa el constructor', !/from '\.\/constructor\//.test(nucleo),
    (nucleo.match(/from '\.\/constructor\/[^']*'/) || [])[0])
  // Y la cadena NO vive en `carta-nucleo.js`, que pinta la ficha entera:
  // en cuanto `cards-block.js` la importó de ahí, /foro y el editor de
  // guías «usaron» las clases de la ficha sin pintarlas nunca. Lo cazó
  // test-tanda-299, que es la misma lección de los imports.
  check('  …y quien solo quiere una imagen no arrastra la ficha',
    !/carta-nucleo/.test(leer('js/cards-block.js')), (leer('js/cards-block.js').match(/[^\n]*carta-nucleo[^\n]*/) || [])[0])
  check('  …y la tabla ya no se define en dos sitios',
    (leer('js/constructor/nucleo.js').match(/PROMOS_SIN_GUION = \{/g) || []).length === 0)
}

console.log('\n── 2. La suposición que dejaba el hueco ──')
{
  const cb = leer('js/cards-block.js')
  const nucleo = leer('js/carta-nucleo.js')
  // Donde se decide si hay imagen ya no se mira solo `image_path`: eso
  // era lo que mandaba a «Sin imagen» sin probar el segundo sitio.
  //
  // (Aquí había una comprobación de que la frase «tiene escaneo de todas
  // las cartas» ya no estaba escrita en ninguna parte. Salía roja porque
  // el comentario que la corrige la CITA. Es la trampa de siempre: al
  // barrer código en busca de una cadena, todo lo que la CONTIENE cuenta.
  // Se comprueba el comportamiento, que es lo que importa.)
  check('la ficha decide por la CADENA, no por image_path',
    /const escaneo = atributosDeEscaneo\(\n?\s*cadenaDeEscaneo\(/.test(nucleo) && /\(escaneo\n/.test(nucleo))
  // Y al agotarse la cadena, la ficha no QUITA la imagen: pone el hueco
  // de «Sin imagen». Quitarla dejaría el `figure` vacío y la columna se
  // encogería de golpe — aquí la imagen ocupa media pantalla.
  check('  …y al agotarse deja el hueco, no un vacío', /carta-scan-vacio'/.test(nucleo))
  // Y las cartas de una guía, igual: tenían la misma suposición escrita.
  check('las cartas de una guía también usan la cadena',
    /cadenaDeEscaneo\(carta, null, 'low'/.test(cb))
  // Sin perder lo que tenían: al agotarse la cadena, ahí se pone el
  // NOMBRE de la carta, no un hueco.
  check('  …y al agotarse ponen el nombre', /deck-card-noimg/.test(cb))
  // Y en el idioma de su mercado: una carta japonesa se enseña en
  // japonés, no en inglés.
  check('  …en el idioma de su mercado', /cardImageUrl\(ruta, calidad, carta\.market\)/.test(cb))
}

const browser = await chromium.launch()

// El espejo NO contesta —que es lo que pasa con estas cartas— y
// Limitless sí. Así se ve si la cadena salta de verdad.
async function abrir(ruta, semillas, opciones = {}) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } })
  const errores = []
  const pedidas = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.route('**/assets.tcgdex.net/**', (r) => {
    pedidas.push('tcgdex')
    if (opciones.espejoVale) {
      r.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="337"><rect width="245" height="337" fill="#333"/></svg>' })
    } else r.fulfill({ status: 404, body: '' })
  })
  await page.route('**/limitlesstcg.nyc3.cdn.digitaloceanspaces.com/**', (r) => {
    pedidas.push('limitless')
    r.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="337"><rect width="245" height="337" fill="#3aa05a"/></svg>' })
  })
  await page.addInitScript((s) => {
    window.__FAKE_SESSION__ = s.sesion || 'admin-1'
    for (const [k, v] of Object.entries(s.tablas || {})) window[k] = v
  }, semillas)
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  return { page, errores, pedidas }
}

// Un set de la era de Sol y Luna, que es justo el caso: TCGdex sin
// escaneo, pero con código de TCG Live y por tanto en Limitless.
const SET = { id: 'sm1', name: 'Sol y Luna', market: 'WEST', serie_id: 'sm', serie_name: 'Sol y Luna', card_count_total: 6, release_date: '2017-02-03', tcg_online_code: 'SUM' }
const CARTAS = (imagen = null) =>
  Array.from({ length: 6 }, (_, i) => ({
    id: `sm1-${i + 1}`, set_id: 'sm1', local_id: String(i + 1),
    name: `Carta ${i + 1}`, name_es: `Carta ${i + 1}`, image_path: imagen, market: 'WEST',
  }))

console.log('\n── 3. El catálogo de una colección ──')
{
  const { page, errores, pedidas } = await abrir('/coleccion/SUM', {
    sesion: 'none',
    tablas: { __FAKE_SETS__: [SET], __FAKE_CARTAS__: CARTAS(null) },
  })
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('salen las seis cartas', (await page.locator('.coleccion-carta').count()) === 6)
  // Lo que se rompía: sin `image_path` no se pintaba NINGUNA imagen.
  check('  …y todas con imagen', (await page.locator('.coleccion-carta img').count()) === 6,
    String(await page.locator('.coleccion-carta img').count()))
  check('  …traída de Limitless', pedidas.includes('limitless'), pedidas.join(', '))
  await page.close()
}

console.log('\n── 4. Y cuando el espejo SÍ la tiene, no se pide a nadie más ──')
{
  // Limitless es el respaldo, no el primer sitio: pedirle una carta que
  // ya tenemos sería cargarle trabajo a un tercero por gusto.
  const { page, pedidas } = await abrir('/coleccion/SUM', {
    sesion: 'none',
    tablas: { __FAKE_SETS__: [SET], __FAKE_CARTAS__: CARTAS('sm/sm1/1') },
  }, { espejoVale: true })
  check('se pide al espejo', pedidas.includes('tcgdex'))
  check('  …y NO a Limitless', !pedidas.includes('limitless'), pedidas.join(', '))
  check('  …y las cartas salen igual', (await page.locator('.coleccion-carta img').count()) === 6)
  await page.close()
}

console.log('\n── 5. El álbum y la ficha de la carta ──')
{
  const { page, errores, pedidas } = await abrir('/mi-coleccion.html', {
    tablas: {
      __FAKE_SETS__: [SET],
      __FAKE_CARTAS__: CARTAS(null),
      __FAKE_COLECCION__: [{ id: 'c1', card_id: 'sm1-1', cantidad: 1 }],
    },
  })
  await page.locator('[data-pestania="album"]').click()
  await page.waitForTimeout(1800)
  // Desde la 372 la pestaña «Álbum» abre la ESTANTERÍA, no un
  // archivador: hay que entrar en una colección. La prueba se quedó
  // escrita contra el desplegable de antes.
  await page.locator('.mc-set-tarjeta').first().click()
  await page.waitForTimeout(1500)
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('los bolsillos salen con carta', (await page.locator('.mc-bolsillo img').count()) === 6,
    String(await page.locator('.mc-bolsillo img').count()))
  check('  …de Limitless', pedidas.includes('limitless'))
  await page.close()

  const ficha = await abrir('/carta?id=sm1-3', {
    sesion: 'none',
    tablas: { __FAKE_SETS__: [SET], __FAKE_CARTAS__: CARTAS(null) },
  })
  check('la ficha de la carta también', (await ficha.page.locator('.carta-scan img').count()) === 1)
  // Y ya no cae en «Sin imagen», que era lo que decidía mirando solo
  // `image_path`.
  check('  …y no dice «Sin imagen»', (await ficha.page.locator('.carta-scan-vacio').count()) === 0)
  await ficha.page.close()
}

console.log('\n── 6. Un set sin código de TCG Live no se inventa una imagen ──')
{
  // Si no hay por dónde, no se pinta: mejor la caja vacía que el icono
  // roto del navegador o una dirección inventada que da 404 a todo el
  // mundo.
  const { page, errores, pedidas } = await abrir('/coleccion/sm1', {
    sesion: 'none',
    tablas: { __FAKE_SETS__: [{ ...SET, tcg_online_code: null }], __FAKE_CARTAS__: CARTAS(null) },
  })
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('salen las cartas, sin imagen', (await page.locator('.coleccion-carta').count()) === 6 &&
    (await page.locator('.coleccion-carta img').count()) === 0)
  check('  …y no se le pide nada a nadie', !pedidas.includes('limitless'), pedidas.join(', '))
  await page.close()
}

console.log('\n── 7. Una carta que NO es occidental no coge el arte inglés ──')
{
  // Los ficheros de Limitless son el arte inglés (`_R_EN_`). Enseñar la
  // impresión inglesa de una carta japonesa sería contar otra cosa, así
  // que ahí la cadena se queda sin segundo sitio a propósito.
  const { cadenaDeEscaneo } = await import('/home/user/pingu/js/escaneo-carta.js')
  const jp = cadenaDeEscaneo({ id: 'sv1-1', local_id: '1', image_path: null, market: 'JP' }, 'SUM')
  const west = cadenaDeEscaneo({ id: 'sv1-1', local_id: '1', image_path: null, market: 'WEST' }, 'SUM')
  check('la japonesa se queda sin respaldo', jp.length === 0, JSON.stringify(jp))
  check('  …y la occidental sí lo tiene', west.length === 1 && west[0].includes('/SUM/SUM_001_'), JSON.stringify(west))
}

await browser.close()
console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
