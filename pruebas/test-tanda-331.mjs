// Tanda 331 — la ficha se completa sola.
//
// PINGU: «entro al Mew ex y solo me sale Mew y su número, colección y
// cuándo salió. No me sale nada más».
//
// Y era verdad: esa carta todavía no la había engordado la tarea
// programada, así que no teníamos ni ataques, ni PS, ni debilidad. Sin
// ataques tampoco hay huella, así que tampoco salían sus reimpresiones.
// Con 23.000 cartas y el engorde yendo de lo más nuevo a lo más viejo,
// eso son días de fichas a medias.
//
// Ahora, si la carta no está engordada, la ficha se la pide a TCGdex EN
// EL MOMENTO. Una petición, y solo para la carta que alguien ha abierto
// de verdad — que es la excepción que la norma de la casa admite: lo
// caro es pedir las 23.000, no pedir la que se está mirando.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync } from 'node:fs'
import { detalleDeCarta, detalleEnEspanol } from '/home/user/pingu/js/carta-detalle.js'
import { nucleoDeCarta } from '/home/user/pingu/js/carta-nucleo.js'
import { inyectarMeta } from '/home/user/pingu/netlify/edge-functions/meta-social.js'
import { writeFileSync } from 'node:fs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 220) : ''}`)
}
const RAIZ = '/home/user/pingu'
const BASE = 'http://localhost:8892'
const limpio = (t) => String(t || '').replace(/\s+/g, ' ').trim()
const browser = await chromium.launch()

const MEW_ES = {
  id: '30c-25', name: 'Mew ex', category: 'Pokemon', hp: 180, types: ['Psychic'], stage: 'Basic',
  retreat: 1, rarity: 'Double rare', illustrator: 'PLANETA', regulationMark: 'J',
  weaknesses: [{ type: 'Darkness', value: '×2' }],
  attacks: [
    { name: 'Búsqueda Genética', cost: ['Psychic'], effect: 'Busca una carta.' },
    { name: 'Impulso Psíquico', cost: ['Psychic', 'Colorless'], damage: '180', effect: 'Descarta 2 Energías.' },
  ],
}
// Tal y como está HOY en la base: el listado del set y nada más.
// Con TODAS las columnas del detalle a null, que es como llegan de
// verdad: la consulta las PIDE por su nombre, así que Supabase las
// devuelve vacías en vez de no devolverlas. Sin ellas en el fixture, el
// relleno de huecos parecía que sobraba — y no sobra: sin él, esos null
// pisarían lo que acaba de llegar de TCGdex.
const EN_LA_BASE = {
  id: '30c-25', set_id: '30c', market: 'WEST', local_id: '25', name: 'Mew ex',
  image_path: 'sv/30c/25', detalle_at: null, regulation_mark: 'J',
  category: null, rarity: null, types: null, hp: null, illustrator: null,
  stage: null, evolve_from: null, retreat: null, attacks: null, abilities: null,
  weaknesses: null, resistances: null, trainer_type: null, energy_type: null,
  suffix: null, description: null,
}
const SET = { id: '30c', name: '30th Celebration', market: 'WEST', serie_name: 'Mega',
  release_date: '2026-09-16', card_count_official: 128 }

// TCGdex está bloqueado desde aquí, así que se contesta en el navegador.
const conTCGdex = async (page, { hayEspanol = true, cae = false } = {}) => {
  const pedidas = []
  await page.route('**/api.tcgdex.net/**', async (ruta) => {
    const url = ruta.request().url()
    pedidas.push(url.includes('/es/') ? 'es' : 'en')
    if (cae) return ruta.abort()
    if (url.includes('/es/') && !hayEspanol) return ruta.fulfill({ status: 404, body: '' })
    const cuerpo = url.includes('/es/')
      ? MEW_ES
      : { ...MEW_ES, name: 'Mew ex', attacks: [{ name: 'Genome Hacking', cost: ['Psychic'] }] }
    await ruta.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(cuerpo) })
  })
  return pedidas
}

const abrir = async (opciones = {}, cartas = [EN_LA_BASE]) => {
  const page = await browser.newPage({ viewport: { width: 1150, height: 1100 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  const pedidas = await conTCGdex(page, opciones)
  await page.addInitScript((c) => {
    window.__FAKE_SETS__ = [{ id: '30c', name: '30th Celebration', market: 'WEST', serie_name: 'Mega',
      release_date: '2026-09-16', card_count_official: 128 }]
    window.__FAKE_CARTAS__ = c
  }, cartas)
  await page.goto(`${BASE}/carta/mew-ex-30c-25`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  return { page, errores, pedidas }
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. Una carta sin engordar se pinta ENTERA ──')
{
  const { page, errores, pedidas } = await abrir()
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('el subtítulo ya dice lo que es',
    limpio(await page.locator('.carta-sub').textContent()) === 'Básico · 180 PS · Tipo Psíquico',
    await page.locator('.carta-sub').textContent())
  const movs = (await page.locator('.carta-mov-nombre').allTextContents()).map(limpio)
  check('salen sus dos ataques', movs.length === 2, movs.join(' | '))
  check('…y EN ESPAÑOL', movs[0].includes('Búsqueda Genética'), movs.join(' | '))
  check('…con su daño', movs[1].includes('180'), movs.join(' | '))
  check('sale la debilidad, con su icono',
    (await page.locator('.carta-combate div').first().locator('.carta-energia').count()) === 1)
  const ficha = limpio((await page.locator('.carta-ficha div').allTextContents()).join(' | '))
  check('y la rareza y el ilustrador, que tampoco estaban', /Doble rara/.test(ficha) && /PLANETA/.test(ficha), ficha)
  // Español primero, y sin pedir el inglés de más.
  check('solo se pide el español', pedidas.join(',') === 'es', pedidas.join(','))
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. Lo de la base MANDA sobre lo que llega ──')
{
  // La marca de regulación y el número los curamos nosotros y son más
  // de fiar que lo que conteste una API comunitaria. Lo de fuera solo
  // rellena huecos: si pisara, una respuesta rara cambiaría la
  // legalidad de una carta en la lista de un mazo.
  const { page } = await abrir({}, [{ ...EN_LA_BASE, regulation_mark: 'H', local_id: '999' }])
  const ficha = limpio((await page.locator('.carta-ficha div').allTextContents()).join(' | '))
  check('la marca de la base gana', /Marca de regulaciónH/.test(ficha), ficha)
  check('…y el número también', /999/.test(ficha), ficha)
  check('pero lo que faltaba se rellena', /PLANETA/.test(ficha), ficha)
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. Si TCGdex no contesta, la página va igual ──')
{
  // Es la regla de siempre: peor ficha, nunca página en blanco.
  const { page, errores } = await abrir({ cae: true })
  check('sin errores aunque falle la red', errores.length === 0, errores.join(' | '))
  check('el nombre sigue ahí', limpio(await page.locator('#cartaNucleo h1').textContent()) === 'Mew ex')
  check('y su número también',
    /25/.test(limpio((await page.locator('.carta-ficha div').allTextContents()).join(' | '))))
  check('…sin inventarse ataques', (await page.locator('.carta-ataques').count()) === 0)
  await page.close()

  // Y una carta vieja sin traducir: cae al inglés y se pinta igual.
  const { page: p2, pedidas } = await abrir({ hayEspanol: false })
  check('una sin traducir pide los dos idiomas', pedidas.join(',') === 'es,en', pedidas.join(','))
  check('…y se pinta con el inglés',
    (await p2.locator('.carta-mov-nombre').allTextContents()).some((t) => /Genome Hacking/.test(t)),
    (await p2.locator('.carta-mov-nombre').allTextContents()).join(' | '))
  await p2.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 4. Una carta ya engordada NO se vuelve a pedir ──')
{
  // 23.000 cartas y un catálogo comunitario y gratuito: pedir lo que ya
  // tenemos guardado sería portarse como un abusón por nada.
  const { page, pedidas } = await abrir({}, [{
    ...EN_LA_BASE, detalle_at: '2026-09-22T10:00:00Z', category: 'Pokemon', hp: 180,
    stage: 'Basic', types: ['Psychic'], attacks: [{ name: 'Impulso Psíquico', cost: ['Psychic'], damage: '180' }],
  }])
  check('no se pide nada a TCGdex', pedidas.length === 0, pedidas.join(','))
  check('y la ficha sale igual de completa',
    (await page.locator('.carta-mov-nombre').count()) === 1)
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 5. El módulo mudado no arrastra nada ──')
{
  // Vive en js/ para que lo use el navegador, y la función de Netlify lo
  // reexporta. Si algún día alguien le mete un import, deja de poder
  // vivir en los dos sitios.
  const fuente = readFileSync(`${RAIZ}/js/carta-detalle.js`, 'utf8')
  check('js/carta-detalle.js no importa nada', !/^import /m.test(fuente))
  check('…ni toca el DOM', !/document\.|window\./.test(fuente))
  const srv = readFileSync(`${RAIZ}/netlify/lib/carta-detalle.mjs`, 'utf8')
  check('el servidor lo importa Y lo reexporta',
    /import \{[^}]*detalleDeCarta[^}]*\} from '\.\.\/\.\.\/js\/carta-detalle\.js'/.test(srv) &&
    /export \{[^}]*detalleDeCarta/.test(srv),
    'un `export … from` no crearía el enlace local y aquí se usa por dentro')
  check('y sigue mapeando lo mismo', detalleDeCarta(MEW_ES).hp === 180)
  check('…y el español sigue primero', (await detalleEnEspanol('x', async (u) => (u.includes('/es/') ? MEW_ES : null))).idioma === 'es')
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 6. Y cuando el BORDE ya ha pintado (que es producción) ──')
{
  // Aquí es donde se me escapó, y PINGU lo vio en dos minutos: «ya ves
  // que no».
  //
  // En producción la ficha la pinta primero la función del borde, con
  // lo que hay en la BASE. Si la carta no está engordada, eso es el
  // nombre, la foto y el número — y como el borde deja la caja marcada
  // con `data-servidor="1"`, el cliente NO la repintaba nunca. Así que
  // el detalle que acababa de pedirle a TCGdex se quedaba en una
  // variable y no llegaba a la pantalla.
  //
  // El servidor de pruebas no ejecuta la función del borde, así que
  // esta situación no existía en local. Se construye a mano, igual que
  // hace el bloque 3 de la 324: se pasa el HTML por `inyectarMeta` y se
  // sirve el resultado.
  const SC = '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad'
  const html = readFileSync(`${RAIZ}/carta.html`, 'utf8')
  const desdeElBorde = inyectarMeta(html, {
    url: 'u', titulo: 'Mew ex', descripcion: 'd', imagen: 'i', imagenCuadrada: true,
    // Lo que el borde puede pintar de una carta SIN engordar.
    nucleo: nucleoDeCarta(EN_LA_BASE, SET),
  })
  writeFileSync(`${SC}/test-forum/t331-borde.html`, desdeElBorde)
  check('el borde marca la caja como pintada', /data-servidor="1"/.test(desdeElBorde))
  check('…y lo que pinta va SIN ataques, porque no los tiene',
    !/carta-ataques/.test(desdeElBorde))

  const page = await browser.newPage({ viewport: { width: 1150, height: 1100 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await conTCGdex(page)
  await page.addInitScript((c) => {
    window.__FAKE_SETS__ = [{ id: '30c', name: '30th Celebration', market: 'WEST', serie_name: 'Mega',
      release_date: '2026-09-16', card_count_official: 128 }]
    window.__FAKE_CARTAS__ = [c]
  }, EN_LA_BASE)
  await page.goto(`${BASE}/t331-borde.html?id=30c-25`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)

  check('sin errores', errores.length === 0, errores.join(' | '))
  const movs = (await page.locator('.carta-mov-nombre').allTextContents()).map(limpio)
  check('el cliente REPINTA y los ataques llegan a la pantalla', movs.length === 2, movs.join(' | '))
  check('…en español', movs[0].includes('Búsqueda Genética'), movs.join(' | '))
  check('…y el subtítulo también',
    limpio(await page.locator('.carta-sub').textContent()) === 'Básico · 180 PS · Tipo Psíquico',
    await page.locator('.carta-sub').textContent())
  check('sigue habiendo un solo h1', (await page.locator('#cartaNucleo h1').count()) === 1)
  await page.close()

  // Y el contrario, que es la regla que NO se puede romper: si la carta
  // YA está engordada, el borde pinta bien y el cliente no toca nada.
  const completa = { ...EN_LA_BASE, detalle_at: '2026-09-22T10:00:00Z', category: 'Pokemon',
    hp: 180, stage: 'Basic', types: ['Psychic'],
    attacks: [{ name: 'Impulso Psíquico', cost: ['Psychic'], damage: '180' }] }
  writeFileSync(`${SC}/test-forum/t331-borde-ok.html`, inyectarMeta(html, {
    url: 'u', titulo: 'Mew ex', descripcion: 'd', imagen: 'i', imagenCuadrada: true,
    nucleo: nucleoDeCarta(completa, SET),
  }))
  const p2 = await browser.newPage()
  const pedidas2 = await conTCGdex(p2)
  // Se CUENTAN los repintados con un observador puesto antes de que
  // cargue nada.
  //
  // Antes esto marcaba un nodo con `data-testigo` justo después del
  // `goto` y miraba si sobrevivía. Era una CARRERA y la perdía: el
  // cliente ya había repintado para cuando llegaba la marca, así que se
  // ponía sobre el núcleo nuevo y sobrevivía siempre. El rigor lo cazó
  // —dos mutaciones que fuerzan el repintado pasaban desapercibidas— y
  // tenía razón: una prueba que depende de quién llega antes no prueba
  // nada.
  await p2.addInitScript(() => {
    // Un repintado se distingue por su FORMA, no por cuándo pasa.
    //
    // Aquí me equivoqué dos veces seguidas. Primero marcaba un nodo
    // después del `goto` y miraba si sobrevivía: una carrera que perdía
    // siempre. Después conté los cambios y salían seis, que era el
    // navegador construyendo la página; puse el contador a cero en
    // DOMContentLoaded y entonces se comía el repintado de verdad,
    // porque js/carta.js es un módulo y corre ANTES de ese evento.
    //
    // Lo que no depende del reloj: `caja.innerHTML = …` BORRA los hijos
    // que había, y el navegador al parsear solo los AÑADE. Un repintado
    // es, por definición, un cambio con `removedNodes`.
    window.__repintados = 0
    new MutationObserver((cambios) => {
      for (const c of cambios) {
        if (c.target?.id === 'cartaNucleo' && c.removedNodes.length) window.__repintados++
      }
    }).observe(document, { childList: true, subtree: true })
  })
  await p2.addInitScript((c) => {
    window.__FAKE_SETS__ = [{ id: '30c', name: '30th Celebration', market: 'WEST' }]
    window.__FAKE_CARTAS__ = [c]
  }, completa)
  await p2.goto(`${BASE}/t331-borde-ok.html?id=30c-25`, { waitUntil: 'domcontentloaded' })
  await p2.waitForTimeout(2400)
  check('una carta engordada NO se repinta',
    (await p2.evaluate(() => window.__repintados)) === 0,
    `el cliente repintó ${await p2.evaluate(() => window.__repintados)} veces lo que el borde ya tenía bien`)
  check('…ni se le pide nada a TCGdex', pedidas2.length === 0, pedidas2.join(','))
  await p2.close()

  // Y el contrario, con el mismo contador: la que NO está engordada sí
  // se repinta, y una sola vez.
  const p3 = await browser.newPage()
  await conTCGdex(p3)
  await p3.addInitScript(() => {
    // Un repintado se distingue por su FORMA, no por cuándo pasa.
    //
    // Aquí me equivoqué dos veces seguidas. Primero marcaba un nodo
    // después del `goto` y miraba si sobrevivía: una carrera que perdía
    // siempre. Después conté los cambios y salían seis, que era el
    // navegador construyendo la página; puse el contador a cero en
    // DOMContentLoaded y entonces se comía el repintado de verdad,
    // porque js/carta.js es un módulo y corre ANTES de ese evento.
    //
    // Lo que no depende del reloj: `caja.innerHTML = …` BORRA los hijos
    // que había, y el navegador al parsear solo los AÑADE. Un repintado
    // es, por definición, un cambio con `removedNodes`.
    window.__repintados = 0
    new MutationObserver((cambios) => {
      for (const c of cambios) {
        if (c.target?.id === 'cartaNucleo' && c.removedNodes.length) window.__repintados++
      }
    }).observe(document, { childList: true, subtree: true })
  })
  await p3.addInitScript((c) => {
    window.__FAKE_SETS__ = [{ id: '30c', name: '30th Celebration', market: 'WEST' }]
    window.__FAKE_CARTAS__ = [c]
  }, EN_LA_BASE)
  await p3.goto(`${BASE}/t331-borde.html?id=30c-25`, { waitUntil: 'domcontentloaded' })
  await p3.waitForTimeout(2600)
  check('la que no lo está SÍ se repinta', (await p3.evaluate(() => window.__repintados)) >= 1)
  await p3.close()
}

console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
await browser.close()
process.exit(fails === 0 ? 0 : 1)
