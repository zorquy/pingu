// Tanda 430 — la lista de lo que te falta, para pegarla en un chat.
//
// Es la otra mitad de un intercambio. Desde la 374 el Panel dice lo que te
// SOBRA —«tienes 3 · te sobran 2»—, que es lo que puedes ofrecer; lo que
// te falta había que ir leyéndolo de la rejilla hueco por hueco.
//
// Sale como TEXTO y no como enlace a propósito: esto se pega en un grupo
// de WhatsApp o en un mensaje del foro, y un enlace obliga a la otra
// persona a salir a mirarlo.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 240) : ''}`)
}

// ── LOS MANDOS DE LA CABECERA VIVEN DETRÁS DEL ⋮ (tanda 475) ──
// Encontrar un elemento no es poder pulsarlo, así que hay que abrir el menú
// primero. Y se cierra solo al elegir, así que cada pulsación abre otra vez.
const porElMenu = async (page, sel) => {
  await page.click('#mcAlbumMenu > summary')
  await page.waitForTimeout(250)
  await page.click(sel)
  await page.waitForTimeout(350)
}
const RAIZ = '/home/user/pingu'
const BASE = process.env.BASE || 'http://localhost:8892'
const { textoDeLoQueFalta } = await import(`${RAIZ}/js/mi-coleccion/lo-que-falta.js`)

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. El texto, en Node ──')
{
  const c = (local_id, name, extra = {}) => ({ local_id, name, ...extra })
  const dos = [c('004', 'Rayquaza EX'), c('017', 'Mega Rayquaza EX')]

  const t = textoDeLoQueFalta(dos, { nombreDelSet: 'Roaring Skies', codigo: 'ROS', total: 108 })
  check('dice cuántas faltan y de cuántas', /Me faltan 2 de las 108 de Roaring Skies \(ROS\)/.test(t), t.split('\n')[0])
  check('  …y las lista con número y nombre', /004 · Rayquaza EX/.test(t) && /017 · Mega Rayquaza EX/.test(t), t)
  // Un guion se confundiría con los que llevan los nombres: «Ho-Oh».
  check('  …separadas con «·» y no con un guion', !/004 - /.test(t), t)

  // Lo importante: si hay filtros puestos, el texto lo DICE. Sin eso,
  // quien filtró por «ultra raras» pega una lista de cinco y la otra
  // persona entiende que le faltan cinco del set entero.
  const f = textoDeLoQueFalta(dos, { nombreDelSet: 'Roaring Skies', codigo: 'ROS', total: 108, filtrando: true })
  check('con filtros puestos, lo avisa', /filtros puestos/.test(f), f.split('\n')[0])
  check('  …y no dice un total que no es', !/de las 108/.test(f), f.split('\n')[0])

  // Y sin total —que es lo que pasa con las versiones separadas— no se
  // inventa uno: lo que hay en pantalla son huecos de versión y no cartas.
  const sinTotal = textoDeLoQueFalta(dos, { nombreDelSet: 'Roaring Skies', codigo: 'ROS', total: null })
  check('sin total, no se inventa un denominador', /^Me faltan 2 de Roaring Skies \(ROS\):/.test(sinTotal), sinTotal.split('\n')[0])
  check('  …y no repite el número de las que faltan', !/de las 2 de/.test(sinTotal), sinTotal.split('\n')[0])

  // En «separar variantes» cada hueco es una VERSIÓN: decir solo el número
  // pediría la carta equivocada.
  const v = textoDeLoQueFalta([c('004', 'Rayquaza EX', { __variante: { nombre: 'Reverse holo' } })], {})
  check('con las versiones separadas, dice cuál', /004 · Rayquaza EX \(Reverse holo\)/.test(v), v)

  check('el nombre en español manda sobre el inglés',
    /Pikachu de fiesta/.test(textoDeLoQueFalta([c('1', 'Party Pikachu', { name_es: 'Pikachu de fiesta' })], {})))
  check('sin set, no se inventa el nombre',
    /esta colección/.test(textoDeLoQueFalta(dos, {})), textoDeLoQueFalta(dos, {}).split('\n')[0])
  check('sin código no queda un paréntesis vacío',
    !/\(\)/.test(textoDeLoQueFalta(dos, { nombreDelSet: 'X' })), textoDeLoQueFalta(dos, { nombreDelSet: 'X' }).split('\n')[0])
  // Sin nada que copiar no hay texto: un encabezado solo, sin lista
  // debajo, se pega igual y no dice nada.
  check('sin nada que falte, no hay texto', textoDeLoQueFalta([], { nombreDelSet: 'X' }) === '')
  check('  …ni con `null`', textoDeLoQueFalta(null, {}) === '')
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. En la pantalla ──')
const browser = await chromium.launch()
const ctx = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] })
const abrir = async () => {
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.addInitScript(() => {
    window.__FAKE_SETS__ = [{ id: 'sv1', name: 'Roaring Skies', market: 'WEST', card_count_official: 6,
      card_count_total: 6, release_date: '2015-05-06', logo_path: 'x/l', tcg_online_code: 'ROS' }]
    const r = ['Common', 'Ultra Rare', 'Common', 'Ultra Rare', 'Common', 'Common']
    window.__FAKE_CARTAS__ = [1, 2, 3, 4, 5, 6].map((n, i) => ({ id: `sv1-10${n}`, set_id: 'sv1',
      local_id: `10${n}`, name: `Carta ${n}`, image_path: `x/${n}`, market: 'WEST', rarity: r[i],
      category: 'Pokemon', variants: { normal: true } }))
    window.__FAKE_COLECCION__ = [{ id: 'l1', card_id: 'sv1-101', cantidad: 1, idioma: 'es',
      estado: 'NM', variante: 'normal' }]
  })
  await page.goto(`${BASE}/mi-coleccion.html?ver=album`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  await page.locator('.mc-set-tarjeta').first().click()
  await page.waitForTimeout(1500)
  return { page, errores }
}
const pegado = (page) => page.evaluate(() => navigator.clipboard.readText())
// DESDE LA 461 ES UN ICONO en la cabecera de la expansión, con el reparto
// de Dex (marcar varias · favorita · compartir). Lo que cuenta cuántas
// faltan ya no es su TEXTO sino su rótulo accesible, que es también el
// globo al pasar por encima: un icono que cambiara de dibujo según el
// número no se entendería, pero un globo que dice «Copiar las 5 que me
// faltan» sí. La prueba sigue mirando lo mismo, en el sitio donde ahora se
// lee.
const dice = async (boton) => (await boton.getAttribute('aria-label') || '').trim()
{
  const { page, errores } = await abrir()
  const boton = page.locator('#mcFaltanCopiar')
  check('el botón dice cuántas son', (await dice(boton)) === 'Copiar las 5 que me faltan', await dice(boton))
  await porElMenu(page, '#mcFaltanCopiar')
  await page.waitForTimeout(600)
  const t = await pegado(page)
  check('copia la lista', /Me faltan 5 de las 6 de Roaring Skies \(ROS\)/.test(t), t.split('\n')[0])
  check('  …sin la que SÍ tienes', !/101 ·/.test(t), t)
  check('  …y con las otras cinco', (t.match(/· Carta/g) || []).length === 5, t)
  check('  …y lo dice al copiar', /Copiadas 5/.test(await page.locator('body').textContent()))

  // Es EXACTAMENTE lo que hay en pantalla: así se lleva bien con los
  // filtros y el orden sin saber nada de ellos.
  // El control vive DENTRO del panel de «Filtros» desde la tanda 473,
  // así que hay que abrirlo: encontrar un elemento no es poder pulsarlo.
  await page.click('#mcAlbumAbrirFiltros')
  await page.waitForTimeout(400)
  await page.selectOption('#mcAlbumRareza', { index: 1 })
  await page.click('#mcAlbumFiltrosVer')
  await page.waitForTimeout(400)
  await page.waitForTimeout(700)
  check('con un filtro, el botón cuenta otra cosa', (await dice(boton)) === 'Copiar las 3 que me faltan', await dice(boton))
  await porElMenu(page, '#mcFaltanCopiar')
  await page.waitForTimeout(600)
  const f = await pegado(page)
  check('  …y el texto AVISA de que hay filtros', /filtros puestos/.test(f), f.split('\n')[0])
  check('  …sin decir un total que no es', !/de las 6 de/.test(f), f.split('\n')[0])
  check('sin errores', !errores.length, errores[0])
  await page.close()
}
{
  // Con las versiones SEPARADAS. Es el caso que faltaba, y cubre dos
  // cosas: que la lista mire la VERSIÓN y no solo la carta (si no, teniendo
  // la normal desaparecería también el reverse holo, que sí te falta) y
  // que no se diga un total del set que no cuadra con lo que se lista.
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.addInitScript(() => {
    window.__FAKE_SETS__ = [{ id: 'sv1', name: 'Roaring Skies', market: 'WEST', card_count_official: 2,
      card_count_total: 2, release_date: '2015-05-06', logo_path: 'x/l', tcg_online_code: 'ROS' }]
    window.__FAKE_CARTAS__ = [1, 2].map((n) => ({ id: `sv1-10${n}`, set_id: 'sv1', local_id: `10${n}`,
      name: `Carta ${n}`, image_path: `x/${n}`, market: 'WEST', rarity: 'Common', category: 'Pokemon',
      variants: { normal: true, reverse: true } }))
    // Tienes la NORMAL de la 101. El reverse holo de la 101 te sigue faltando.
    window.__FAKE_COLECCION__ = [{ id: 'l1', card_id: 'sv1-101', cantidad: 1, idioma: 'es',
      estado: 'NM', variante: 'normal' }]
  })
  await page.goto(`${BASE}/mi-coleccion.html?ver=album`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  await page.locator('.mc-set-tarjeta').first().click()
  await page.waitForTimeout(1500)
  await page.click('#mcVistaVariantes')
  await page.waitForTimeout(900)
  const boton = page.locator('#mcFaltanCopiar')
  check('con las versiones separadas cuenta huecos, no cartas',
    (await dice(boton)) === 'Copiar las 3 que me faltan', await dice(boton))
  await porElMenu(page, '#mcFaltanCopiar')
  await page.waitForTimeout(600)
  const t = await pegado(page)
  check('  …el reverse de la que tienes SIGUE faltando', /101 · Carta 1 \(/.test(t), t)
  check('  …y la normal de esa no está', !/101 · Carta 1\n/.test(t) && !/101 · Carta 1$/.test(t), t)
  // Y sin filtros puestos no se avisa de filtros, aunque haya más huecos
  // que cartas: deducirlo comparando tamaños daría un aviso falso.
  check('  …sin avisar de filtros que no hay', !/filtros puestos/.test(t), t.split('\n')[0])
  check('  …ni decir un total del set que no cuadra', !/de las 2 de/.test(t), t.split('\n')[0])
  check('sin errores', !errores.length, errores[0])
  await page.close()
}
{
  // Sin nada que falte: el botón se apaga y lo dice. Un botón que no lleva
  // a ninguna parte miente.
  const { page } = await abrir()
  await page.fill('#mcAlbumBuscar', 'Carta 1')
  await page.waitForTimeout(900)
  const boton = page.locator('#mcFaltanCopiar')
  check('sin nada que falte, el botón se apaga', await boton.isDisabled())
  check('  …y lo dice', /No te falta ninguna/.test(await dice(boton)), await dice(boton))
  await page.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
