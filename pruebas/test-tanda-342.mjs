// Tanda 342 — TCGdex declina los tipos en femenino.
//
// La debilidad del Mew ex de 30th Celebration salía sin traducir. El
// valor guardado era «Oscura» —con A— porque TCGdex concuerda los tipos
// con «energía», y la tabla tenía la forma masculina.
//
// El arreglo es una línea. Lo que costó fue ENTERARSE: hizo falta que
// PINGU lo viera en pantalla, me lo dijera, yo probara once grafías a
// ciegas y al final saliera de un `select`. Por eso la mitad de esta
// tanda no es la traducción: es que la web lo cuente sola la próxima vez.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { canonizarCarta } from '/home/user/pingu/js/carta-detalle.js'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 200) : ''}`)
}
const BASE = 'http://localhost:8892'
const browser = await chromium.launch()
const tipoDe = (t) => canonizarCarta({ weaknesses: [{ type: t, value: '×2' }] }).weaknesses[0].type

const MEW = (debilidad) => ({
  id: '30th-066', set_id: '30th', market: 'WEST', local_id: '066',
  name: 'Mew ex', name_es: 'Mew ex', image_path: 'sv/30th/66',
  category: 'Pokémon', hp: 160, types: ['Psíquica'], stage: 'Básico', retreat: 0,
  regulation_mark: 'J', detalle_at: 'x', detalle_lang: 'es',
  weaknesses: [{ type: debilidad, value: '×2' }],
  resistances: [{ type: 'Lucha', value: '-30' }],
  attacks: [{ name: 'Explosión Teleportadora', cost: ['Psíquica'], damage: '30' }],
})

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. Las dos formas de cada tipo que tiene género ──')
{
  // La del fallo, tal y como está guardada en la base.
  check('«Oscura» es Darkness', tipoDe('Oscura') === 'Darkness', tipoDe('Oscura'))
  // Y la masculina sigue valiendo: hay 3.596 fichas en inglés y unas
  // cuantas que ya se guardaron con la otra forma.
  check('…y «Oscuro» también', tipoDe('Oscuro') === 'Darkness')
  for (const [escrito, esperado] of [
    ['Psíquica', 'Psychic'], ['Psíquico', 'Psychic'],
    ['Metálica', 'Metal'], ['Metal', 'Metal'],
    ['Eléctrica', 'Lightning'], ['Rayo', 'Lightning'],
    ['Incolora', 'Colorless'], ['Incoloro', 'Colorless'],
    ['Siniestra', 'Darkness'], ['Siniestro', 'Darkness'],
  ]) {
    check(`«${escrito}» es ${esperado}`, tipoDe(escrito) === esperado, tipoDe(escrito))
  }
  // Los que son nombres y no varían, por si alguien los toca.
  for (const [escrito, esperado] of [['Agua', 'Water'], ['Fuego', 'Fire'],
    ['Lucha', 'Fighting'], ['Hada', 'Fairy'], ['Dragón', 'Dragon'], ['Planta', 'Grass']]) {
    check(`«${escrito}» sigue siendo ${esperado}`, tipoDe(escrito) === esperado, tipoDe(escrito))
  }
  // Y lo que NO se reconoce sigue sin reconocerse: la tabla no adivina.
  check('una palabra que no es un tipo se queda como está', tipoDe('Tinieblas') === 'Tinieblas')
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. En la ficha, el punto vuelve a tener color ──')
{
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } })
  await page.addInitScript((c) => {
    window.__FAKE_SETS__ = [{ id: '30th', name: '30th Celebration', market: 'WEST', card_count_official: 128 }]
    window.__FAKE_CARTAS__ = [c]
  }, MEW('Oscura'))
  await page.goto(`${BASE}/carta/mew-ex-30th-066`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2400)
  const punto = await page.locator('.carta-combate .carta-energia').first().evaluate((n) => ({
    tipo: n.dataset.tipo, fondo: getComputedStyle(n).backgroundColor, titulo: n.getAttribute('title'),
  }))
  check('la debilidad se reconoce', punto.tipo === 'Darkness', JSON.stringify(punto))
  check('…y se pinta con su color', punto.fondo === 'rgb(61, 74, 87)', JSON.stringify(punto))
  check('…y el título ya no dice «sin traducir»', punto.titulo === 'Oscuro', JSON.stringify(punto))
  // Y el tipo de la carta y el coste del ataque, que venían igual.
  check('el subtítulo traduce el tipo de la carta',
    /Tipo Psíquico/.test(await page.locator('.carta-sub').textContent()),
    await page.locator('.carta-sub').textContent())
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. Y la próxima vez lo cuenta la web, no una persona ──')
{
  // Esta es la mitad que importa. Una lista curada se queda vieja (la
  // 323) y lo normal es que nadie lo note: un punto de un color raro no
  // llama la atención de quien no sabe de qué color tenía que ser.
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } })
  await page.addInitScript((c) => {
    window.__FAKE_SETS__ = [{ id: '30th', name: '30th Celebration', market: 'WEST', card_count_official: 128 }]
    window.__FAKE_CARTAS__ = [c]
  }, MEW('Tinieblas'))
  await page.goto(`${BASE}/carta/mew-ex-30th-066`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)

  const avisos = await page.evaluate(() =>
    JSON.parse(sessionStorage.getItem('__escrituras__') || '[]').filter((e) => e.tabla === 'client_errors')
  )
  const fila = avisos.map((e) => (Array.isArray(e.filas) ? e.filas[0] : e.filas)).at(-1)
  check('se registra el aviso', Boolean(fila), JSON.stringify(avisos))
  check('…con el valor CRUDO dentro, que es lo único que hacía falta saber',
    /Tinieblas/.test(fila?.message || ''), fila?.message)
  check('…y diciendo de dónde sale', /\/carta/.test(fila?.message || ''), fila?.message)
  await page.close()

  // Y cuando NO falta ninguna traducción, no se avisa de nada: un canal
  // que suena siempre deja de escucharse.
  const p2 = await browser.newPage({ viewport: { width: 1200, height: 900 } })
  await p2.addInitScript((c) => {
    window.__FAKE_SETS__ = [{ id: '30th', name: '30th Celebration', market: 'WEST', card_count_official: 128 }]
    window.__FAKE_CARTAS__ = [c]
  }, MEW('Oscura'))
  await p2.goto(`${BASE}/carta/mew-ex-30th-066`, { waitUntil: 'domcontentloaded' })
  await p2.waitForTimeout(2600)
  const callado = await p2.evaluate(() =>
    JSON.parse(sessionStorage.getItem('__escrituras__') || '[]').filter((e) => e.tabla === 'client_errors')
  )
  check('con todo traducido no se avisa de nada', callado.length === 0, JSON.stringify(callado))
  await p2.close()
}

console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
await browser.close()
process.exit(fails === 0 ? 0 : 1)
