// Tanda 447: el menú nuevo (Panel · Expansiones · Pokédex · Carpetas ·
// Buscar), la pantalla de Buscar y el escáner de cartas.
//
// Lo que esta prueba vigila de verdad es el CAMINO COMPLETO del escáner,
// porque es donde ya se cayó una vez: el OCR devuelve «Charizard ex» y
// «SSP 125», y meter eso tal cual en un buscador de subcadenas daba CERO
// resultados con la carta correcta delante. Aquí el OCR se falsea —la red
// está cerrada en el contenedor y además la función necesita una clave—,
// pero el reparto del texto entre BUSCAR y AFINAR es nuestro, y es lo que
// se prueba.
import { readFileSync } from 'node:fs'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = 'http://localhost:8892'
let fallos = 0
const ok = (b, msg, extra = '') => {
  console.log(`  ${b ? 'ok  ' : 'FALLA'} ${msg}${extra ? `  ${extra}` : ''}`)
  if (!b) fallos++
}

// La cámara de mentira de Chromium: sin esto `getUserMedia` pide permiso y
// se queda esperando a un humano.
const navegador = await chromium.launch({
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
})

// Varias Charizard con números DISTINTOS: con una sola, afinar por número
// no tendría nada que ordenar y la prueba pasaría sin probar nada.
const semilla = () => {
  window.__FAKE_SETS__ = [
    { id: 'sv8', name: 'Chispas Centelleantes', serie_id: 'sv', market: 'WEST', logo_path: 'x/sv8/logo', card_count_official: 191, release_date: '2024-11-08', tcg_online_code: 'SSP' },
  ]
  const cartas = [
    ['sv8-125', '125', 'Charizard ex'],
    ['sv8-12', '12', 'Charizard ex'],
    ['sv8-223', '223', 'Charizard ex'],
    ['sv8-40', '40', 'Charmander'],
    ['sv8-41', '41', 'Charmeleon'],
  ]
  window.__FAKE_CARTAS__ = cartas.map(([id, local, name]) => ({
    id, market: 'WEST', set_id: 'sv8', local_id: local, name, name_es: name,
    image_path: `x/sv8/${local}`, rarity: 'Double Rare', category: 'Pokemon', dex_ids: [6],
    variants: { normal: true },
  }))
  window.__FAKE_COLECCION__ = []
}

const pagina = async (ancho = 1280, alto = 1000) => {
  const p = await navegador.newPage({ viewport: { width: ancho, height: alto } })
  // Las imágenes de TCGdex no se pueden pedir desde este contenedor. Se
  // abortan a propósito: lo que se mira aquí es texto y orden, no dibujos.
  await p.route('**assets.tcgdex.net/**', (r) => r.abort())
  await p.route('**limitlesstcg**', (r) => r.abort())
  await p.addInitScript(semilla)
  return p
}

// ── 1. El menú, en su orden ──
{
  const p = await pagina()
  await p.goto(`${BASE}/mi-coleccion.html`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2500)
  const pestanas = await p.$$eval('#mcMenu [role="tab"]', (ns) => ns.map((n) => n.textContent.trim()))
  ok(
    JSON.stringify(pestanas) === JSON.stringify(['Panel', 'Expansiones', 'Pokédex', 'Carpetas', 'Buscar']),
    'el menú es Panel · Expansiones · Pokédex · Carpetas · Buscar',
    JSON.stringify(pestanas),
  )
  // «Mi colección» solo en el Panel: en las demás pestañas ese hueco está
  // desperdiciado, que es lo que PINGU pidió quitar.
  const heroEnPanel = await p.$eval('.mc-hero', (n) => !n.classList.contains('mc-hero-mini')).catch(() => null)
  ok(heroEnPanel === true, 'en el Panel la cabecera va entera')
  await p.click('#mcMenu button[data-pestania="buscar"]')
  await p.waitForTimeout(400)
  const heroEnBuscar = await p.$eval('.mc-hero', (n) => n.classList.contains('mc-hero-mini'))
  ok(heroEnBuscar === true, 'fuera del Panel la cabecera se encoge')
  const h1 = await p.$eval('#mcTitulo', (n) => n.className.includes('sr-only'))
  ok(h1 === true, 'el h1 sigue existiendo para quien lo lee en voz alta')
  await p.close()
}

// ── 2. La pantalla de Buscar: el vacío lleva el escáner ──
{
  const p = await pagina()
  await p.goto(`${BASE}/mi-coleccion.html?ver=buscar`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2500)
  ok(await p.isVisible('#mcBuscarVacio'), 'sin buscar nada sale el estado vacío')
  ok(await p.isVisible('#mcEscanear'), 'y dentro, el botón de escanear')
  await p.fill('#mcBuscarTodo', 'Charizard')
  await p.waitForTimeout(900)
  ok(!(await p.isVisible('#mcBuscarVacio')), 'al buscar, el vacío se va')
  const cuantas = await p.$$eval('#mcBuscarResultados > *', (ns) => ns.length)
  ok(cuantas === 3, 'salen las tres Charizard', String(cuantas))
  ok(!(await p.isVisible('#mcEscanear')), 'y el escáner ya no estorba')
  await p.close()
}

// ── 2 bis. Las sugerencias ──
// La guarda de que TODA sugerencia devuelve algo vive en
// `test-tanda-450.mjs` desde que el buscador entiende números e
// ilustradores: la de aquí sembraba una carta POR NOMBRE, y «Mewtwo 64»
// ya no se busca por nombre. Dos pruebas de lo mismo con fixtures
// distintos acaban contradiciéndose, así que esta se va y queda la que
// sabe de qué va la búsqueda.

// ── 3. El escáner se abre, con su marco en proporción de carta ──
{
  const p = await pagina(420, 900)
  await p.goto(`${BASE}/mi-coleccion.html?ver=buscar`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2500)
  await p.click('#mcEscanear')
  await p.waitForTimeout(1500)
  const estado = await p.evaluate(() => {
    const v = document.getElementById('mcEscanerVideo')
    const m = document.getElementById('mcEscanerMarco')
    const c = m.getBoundingClientRect()
    return {
      abierto: document.getElementById('mcEscanerCaja').open,
      hayVideo: !!v.srcObject,
      prop: +(c.width / c.height).toFixed(3),
      idiomas: [...document.getElementById('mcEscanerIdioma').options].map((o) => o.value).join(','),
      disparoActivo: !document.getElementById('mcEscanerDisparo').disabled,
      guias: document.querySelectorAll('.mc-escaner-guia').length,
    }
  })
  ok(estado.abierto && estado.hayVideo, 'la cámara se abre dentro del diálogo')
  // 63 × 88 mm es una carta de Pokémon: 0,716. Si el marco deja de tener
  // esa forma, las dos franjas se recortan donde no hay texto.
  ok(Math.abs(estado.prop - 63 / 88) < 0.02, 'el marco tiene la proporción de una carta', String(estado.prop))
  ok(estado.guias === 2, 'y las dos guías, la del nombre y la del código')
  ok(estado.idiomas === 'es,en,ja,zh,de,fr,it', 'los siete idiomas de carta', estado.idiomas)
  ok(estado.disparoActivo, 'el disparo está activo')

  // APAGAR LA CÁMARA AL CERRAR no es limpieza opcional: una pista viva
  // deja el piloto del móvil encendido y se come la batería.
  await p.click('#mcEscanerCerrar')
  await p.waitForTimeout(400)
  const apagada = await p.evaluate(() => {
    const v = document.getElementById('mcEscanerVideo')
    return { cerrado: !document.getElementById('mcEscanerCaja').open, sinVideo: !v.srcObject }
  })
  ok(apagada.cerrado && apagada.sinVideo, 'al cerrar, la cámara se apaga')
  await p.close()
}

// ── 4. EL CAMINO COMPLETO, que es por lo que existe esta prueba ──
{
  const p = await pagina(420, 900)
  let pedido = null
  // El OCR falseado. Devuelve lo que devolvería de verdad: el nombre
  // arriba y «SSP 125 / illus. Nombre» abajo.
  await p.route('**/.netlify/functions/leer-carta', async (ruta) => {
    pedido = JSON.parse(ruta.request().postData() || '{}')
    await ruta.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ textos: { nombre: 'Charizard ex', codigo: 'SSP 125/191  illus. Kodama' }, idioma: 'es' }),
    })
  })
  await p.goto(`${BASE}/mi-coleccion.html?ver=buscar`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2500)
  await p.click('#mcEscanear')
  await p.waitForTimeout(1500)
  await p.click('#mcEscanerDisparo')
  await p.waitForTimeout(1800)

  // Lo que se manda: dos franjas en JPEG, no una foto. Una foto de cámara
  // son dos o tres megas para leer cuatro palabras.
  ok(/^data:image\/jpeg;base64,/.test(pedido?.nombre || ''), 'se manda la franja del nombre en JPEG')
  ok(/^data:image\/jpeg;base64,/.test(pedido?.codigo || ''), 'y la del código')
  const pesoKB = Math.round(((pedido?.nombre || '').length + (pedido?.codigo || '').length) / 1024)
  ok(pesoKB < 300, 'las dos juntas pesan poco', `${pesoKB} KB`)
  ok(pedido?.idioma === 'es', 'y el idioma elegido')

  const tras = await p.evaluate(() => {
    const filas = [...document.querySelectorAll('#mcBuscarResultados > *')]
    return {
      cerrado: !document.getElementById('mcEscanerCaja').open,
      campo: document.getElementById('mcBuscarTodo').value,
      cuantas: filas.length,
      orden: filas.map((n) => n.querySelector('.mc-resultado-set')?.textContent.split('·').pop().trim()),
      casa: filas.findIndex((n) => n.classList.contains('mc-resultado-casa')),
      cuenta: document.getElementById('mcBuscarCuantas').textContent,
    }
  })
  ok(tras.cerrado, 'al leer, el escáner se cierra y deja ver el resultado')
  // SOLO el nombre va al buscador. Con el texto entero («Charizard ex SSP
  // 125») el buscador exige que «SSP» esté en el nombre y da CERO.
  ok(tras.campo === 'Charizard ex', 'en el buscador queda el NOMBRE, no el texto entero', tras.campo)
  ok(tras.cuantas === 3, 'y salen las tres Charizard', String(tras.cuantas))
  // Y el número de la franja de abajo AFINA: la 125 arriba.
  ok(tras.orden[0] === '125', 'la n.º 125 queda primera', JSON.stringify(tras.orden))
  ok(tras.casa === 0, 'y marcada')
  ok(/125/.test(tras.cuenta), 'la cuenta lo dice', tras.cuenta)
  await p.close()
}

// ── 5. El número se compara ENTERO, no por trozos ──
// «· 12» está dentro de «· 125»: con un `includes` la 12 subiría también
// la 125 y la 223 se quedaría abajo por el motivo equivocado.
{
  const p = await pagina(420, 900)
  await p.route('**/.netlify/functions/leer-carta', (ruta) => ruta.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ textos: { nombre: 'Charizard ex', codigo: 'SSP 12/191' }, idioma: 'es' }),
  }))
  await p.goto(`${BASE}/mi-coleccion.html?ver=buscar`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2500)
  await p.click('#mcEscanear')
  await p.waitForTimeout(1500)
  await p.click('#mcEscanerDisparo')
  await p.waitForTimeout(1800)
  const orden = await p.$$eval('#mcBuscarResultados > *', (ns) => ns.map((n) => n.querySelector('.mc-resultado-set')?.textContent.split('·').pop().trim()))
  ok(orden[0] === '12', 'leyendo la 12 sube la 12 y no la 125', JSON.stringify(orden))
  const casan = await p.$$eval('.mc-resultado-casa', (ns) => ns.length)
  ok(casan === 1, 'y solo una va marcada', String(casan))
  await p.close()
}

// ── 6. Sin clave de OCR, el mensaje lo dice; no se cae en silencio ──
{
  const p = await pagina(420, 900)
  await p.route('**/.netlify/functions/leer-carta', (ruta) => ruta.fulfill({
    status: 503,
    contentType: 'application/json',
    body: JSON.stringify({ sinConfigurar: true, error: 'El lector de cartas no está configurado todavía.' }),
  }))
  await p.goto(`${BASE}/mi-coleccion.html?ver=buscar`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2500)
  await p.click('#mcEscanear')
  await p.waitForTimeout(1500)
  await p.click('#mcEscanerDisparo')
  await p.waitForTimeout(1500)
  const estado = await p.evaluate(() => ({
    ayuda: document.getElementById('mcEscanerAyuda').textContent,
    sigueAbierto: document.getElementById('mcEscanerCaja').open,
    puedeReintentar: !document.getElementById('mcEscanerDisparo').disabled,
  }))
  ok(/no está configurado/.test(estado.ayuda), 'sale el mensaje del servidor', estado.ayuda)
  ok(estado.sigueAbierto, 'y el escáner no se cierra: la carta sigue encuadrada')
  ok(estado.puedeReintentar, 'y se puede volver a disparar')
  await p.close()
}

await navegador.close()
console.log(fallos ? `\n❌ ${fallos} FALLOS` : '\n✅ TODO BIEN')
process.exit(fallos ? 1 : 0)
