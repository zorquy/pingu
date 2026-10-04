// Tanda 428 — lo que te costó contra lo que vale.
//
// La cabecera llevaba desde la 374 un «Pagado» al lado de «Valor
// estimado», y esa pareja MIENTE: lo pagado solo se sabe de las cartas en
// las que lo has apuntado —pueden ser tres de cuatrocientas— y el valor es
// el de TODAS. Leídas juntas parecen un balance y dicen «has ganado 280 €»
// cuando lo único cierto es que te costaron 20.
//
// Un balance solo se puede hacer sobre las MISMAS cartas en los dos
// lados. Eso es lo que se prueba aquí, casi todo en Node: son cuentas de
// dinero, y una cuenta mal hecha no da error nunca.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 220) : ''}`)
}
const RAIZ = '/home/user/pingu'
const BASE = process.env.BASE || 'http://localhost:8892'
const { balanceDeCompra } = await import(`${RAIZ}/js/mi-coleccion/balance.js`)

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. El balance, en Node ──')
{
  // `valorDe` devuelve lo que vale la línea ENTERA, copias incluidas.
  const valor = (l) => (l.vale === undefined ? null : l.vale * (l.cantidad || 1))
  const l = (id, cantidad, precio_compra, vale) => ({ id, cantidad, precio_compra, vale })

  const b = balanceDeCompra([
    l('a', 2, 5, 9),      // pagaste 10, valen 18
    l('b', 1, 20, 12),    // pagaste 20, valen 12
    l('c', 1, null, 50),  // sin precio de compra: NO entra en ningún lado
  ], valor)
  check('solo entran las que tienen precio de compra', b.copias === 3, JSON.stringify(b))
  check('  …pagado, de esas', b.pagado === 30, String(b.pagado))
  check('  …y lo que valen, de ESAS MISMAS', b.valor === 30, String(b.valor))
  // La que vale 50 y no tiene precio de compra se queda fuera de los DOS
  // lados: meterla solo en el de «valen» es justo el error que arregla
  // esta tanda.
  check('  …la de 50 € sin compra no se cuela en «valen»', b.valor === 30, String(b.valor))
  check('  …y la diferencia sale de los dos lados iguales', b.diferencia === 0, String(b.diferencia))

  const g = balanceDeCompra([l('a', 1, 10, 25)], valor)
  check('ganando, la diferencia es positiva', g.diferencia === 15, String(g.diferencia))
  const p = balanceDeCompra([l('a', 1, 40, 25)], valor)
  check('perdiendo, negativa', p.diferencia === -15, String(p.diferencia))

  // Las copias multiplican los DOS lados, no uno.
  const c = balanceDeCompra([l('a', 4, 3, 5)], valor)
  check('las copias cuentan en los dos lados', c.pagado === 12 && c.valor === 20, JSON.stringify(c))
  check('  …y «copias» dice cuántas son', c.copias === 4, String(c.copias))

  // Tres estados (la regla de la 319): una carta con precio de compra pero
  // SIN precio de mercado no vale cero — no se sabe lo que vale. Contarla
  // como cero inventaría una pérdida.
  const s = balanceDeCompra([l('a', 1, 10, 25), l('b', 3, 2, undefined)], valor)
  check('sin precio de mercado no se cuenta como cero', s.pagado === 10 && s.valor === 25, JSON.stringify(s))
  check('  …y se dice cuántas son', s.sinValorar === 3, String(s.sinValorar))
  check('  …sin meterlas en «copias»', s.copias === 1, String(s.copias))

  // Sin nada comparable no hay balance: un «0 €» diría que estás en
  // tablas, y lo que pasa es que no has apuntado nada.
  const v = balanceDeCompra([l('a', 1, null, 10)], valor)
  check('sin ninguna apuntada, no hay balance', v.hayBalance === false, JSON.stringify(v))
  check('  …y con una, sí', balanceDeCompra([l('a', 1, 1, 1)], valor).hayBalance === true)
  check('una colección vacía no revienta', balanceDeCompra([], valor).hayBalance === false)
  check('sin `valorDe` tampoco', balanceDeCompra([l('a', 1, 5, 9)]).hayBalance === false)
  // Un precio de compra de 0 no es «lo compré por nada»: es que no está.
  check('un precio de compra de 0 no cuenta', balanceDeCompra([l('a', 1, 0, 9)], valor).hayBalance === false)
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. En la pantalla ──')
const browser = await chromium.launch()
const abrir = async (coleccion, { tema = 'light' } = {}) => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.addInitScript(([t, col]) => {
    try { localStorage.setItem('theme', t) } catch {}
    addEventListener('DOMContentLoaded', () => document.documentElement.setAttribute('data-theme', t))
    window.__FAKE_SETS__ = [{ id: 'sv1', name: 'Roaring Skies', market: 'WEST', card_count_official: 10,
      card_count_total: 10, release_date: '2015-05-06', logo_path: 'x/l', tcg_online_code: 'ROS' }]
    window.__FAKE_CARTAS__ = [1, 2, 3, 4].map((n) => ({ id: `sv1-10${n}`, set_id: 'sv1', local_id: `10${n}`,
      name: `Carta ${n}`, image_path: `x/${n}`, market: 'WEST', rarity: 'Common', category: 'Pokemon',
      variants: { normal: true } }))
    window.__FAKE_COLECCION__ = col
  }, [tema, coleccion])
  await page.goto(`${BASE}/mi-coleccion.html?ver=resumen`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2800)
  return { page, errores }
}
const linea = (id, card, cantidad, extra = {}) => ({ id, card_id: card, cantidad, idioma: 'es',
  estado: 'NM', variante: 'normal', ...extra })
const diapo = (page) => page.locator('.mc-diapo').filter({ hasText: 'Lo que te costó' })
const limpio = async (loc) => (await loc.textContent()).replace(/\s+/g, ' ').trim()

{
  // Ganando: pagaste 10 por una que vale 25.
  const { page, errores } = await abrir([
    linea('l1', 'sv1-101', 1, { precio_compra: 10, valor_manual: 25 }),
    linea('l2', 'sv1-102', 1, { valor_manual: 500 }),
  ])
  check('la tarjeta está', (await diapo(page).count()) === 1)
  const t = await limpio(diapo(page))
  check('  …y dice la diferencia con su signo', /\+15,00/.test(t), t.slice(0, 120))
  // La de 500 € no tiene precio de compra: si se colara en «valen», la
  // ganancia diría +515 y sería mentira.
  check('  …sin colar la que no tiene precio de compra', /Valen\s*25,00/.test(t) && !/515/.test(t), t.slice(0, 200))
  // Y con UNA se dice de otra manera: «en las 1 carta» no lo escribe nadie.
  check('  …y sobre cuántas cartas es', /en la única carta en la que apuntaste/.test(t), t.slice(0, 200))
  // El color se compara con el TOKEN y no solo con la clase: con la clase
  // puesta pero pintando de rojo, un `/mc-gana/` sale verde igual.
  const color = await diapo(page).locator('.mc-diapo-cifra').evaluate((n) => {
    const comoColor = (token) => {
      const d = document.createElement('span')
      d.style.color = `var(${token})`
      document.body.appendChild(d)
      const c = getComputedStyle(d).color
      d.remove()
      return c
    }
    return { clase: n.className, color: getComputedStyle(n).color,
      exito: comoColor('--success'), peligro: comoColor('--danger') }
  })
  check('  …en verde', /mc-gana/.test(color.clase), JSON.stringify(color))
  check('  …y verde DE VERDAD, no la clase a secas', color.color === color.exito, JSON.stringify(color))
  check('  …que no es el rojo', color.exito !== color.peligro, JSON.stringify(color))
  // El color nunca va solo: delante va el signo, que es lo que lee quien
  // no distingue el verde del rojo.
  check('  …y con el signo delante, que el color no vale solo', (await limpio(diapo(page).locator('.mc-diapo-cifra'))).startsWith('+'))
  check('sin errores', !errores.length, errores[0])
  await page.close()
}
{
  // Perdiendo.
  const { page } = await abrir([linea('l1', 'sv1-101', 2, { precio_compra: 30, valor_manual: 10 })])
  const t = await limpio(diapo(page))
  check('perdiendo, lo dice en rojo y con el menos', /−40,00/.test(t), t.slice(0, 120))
  check('  …y la clase es la de perder',
    /mc-pierde/.test(await diapo(page).locator('.mc-diapo-cifra').getAttribute('class')))
  const rojo = await diapo(page).locator('.mc-diapo-cifra').evaluate((n) => {
    const d = document.createElement('span')
    d.style.color = 'var(--danger)'
    document.body.appendChild(d)
    const c = getComputedStyle(d).color
    d.remove()
    return { pintado: getComputedStyle(n).color, peligro: c }
  })
  check('  …y rojo de verdad', rojo.pintado === rojo.peligro, JSON.stringify(rojo))
  check('  …contando las dos copias en los dos lados', /Pagaste\s*60,00/.test(t) && /Valen\s*20,00/.test(t), t.slice(0, 200))
  await page.close()
}
{
  // Empatado: pagaste exactamente lo que vale. Ni signo ni color — un
  // «+0,00 €» en verde se lee como una ganancia que no existe.
  const { page } = await abrir([linea('l1', 'sv1-101', 2, { precio_compra: 10, valor_manual: 10 })])
  const cifra = await limpio(diapo(page).locator('.mc-diapo-cifra'))
  check('empatado, el cero va sin signo', cifra === '0,00 €', cifra)
  check('  …y sin color de ganar ni de perder',
    !/mc-gana|mc-pierde/.test(await diapo(page).locator('.mc-diapo-cifra').getAttribute('class')),
    await diapo(page).locator('.mc-diapo-cifra').getAttribute('class'))
  check('  …y lo dice con palabras', /ni ganas ni pierdes/.test(await limpio(diapo(page))))
  await page.close()
}
{
  // Sin nada apuntado: se invita a apuntarlo, no se enseña un 0 €.
  const { page } = await abrir([linea('l1', 'sv1-101', 1, { valor_manual: 25 })])
  const t = await limpio(diapo(page))
  check('sin nada apuntado no sale un 0 €', !/0,00/.test(t), t.slice(0, 160))
  // DECÍA «Precio de compra» Y ESE CAMPO NO EXISTE (lo cambió la 524): se
  // llama «Lo que pagaste (€)». O sea que esta comprobación llevaba desde
  // la 428 congelando un nombre equivocado — una prueba puede sujetar un
  // fallo igual que lo sujeta el código.
  check('  …sino que se explica dónde se apunta', /Lo que pagaste/.test(t), t.slice(0, 160))
  await page.close()
}
{
  // Con precio de compra pero sin precio de mercado: se dice aparte.
  const { page } = await abrir([
    linea('l1', 'sv1-101', 1, { precio_compra: 10, valor_manual: 25 }),
    linea('l2', 'sv1-102', 3, { precio_compra: 2 }),
  ])
  const t = await limpio(diapo(page))
  check('las que no se pueden valorar se dicen aparte', /3 cartas más tienen precio de compra/.test(t), t.slice(0, 240))
  check('  …y no se cuentan como cero', /\+15,00/.test(t), t.slice(0, 120))
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. Y la cifra de arriba ya no engaña ──')
{
  // «Pagado» al lado de «Valor estimado» se lee como un balance. Ahora
  // dice EN CUÁNTAS cartas, que es lo que lo convierte en un dato.
  // Con TRES copias en una línea: la cuenta es de CARTAS, no de líneas.
  // Con una sola copia las dos formas dan lo mismo y el fallo no asoma.
  const { page } = await abrir([
    linea('l1', 'sv1-101', 3, { precio_compra: 10, valor_manual: 25 }),
    linea('l2', 'sv1-102', 1, { valor_manual: 500 }),
  ])
  // «Pagado» SALIÓ DE LA CABECERA en la tanda 440 —eran cinco cifras donde
  // caben cuatro— y vive en la tarjeta «Lo que te costó» del Panel, que es
  // donde se mira ahora. Lo que esta tanda defiende no es DÓNDE está, sino
  // que la cuenta sea de CARTAS y no de líneas: con tres copias en una
  // línea las dos formas dan números distintos, y con una sola copia el
  // fallo no asoma. Así que se mira donde esté.
  const cab = await limpio(page.locator('#mcResumen'))
  const costo = await limpio(diapo(page))
  check('«Pagado» dice sobre cuántas CARTAS es, no cuántas líneas', /\b3 cartas\b/.test(costo), costo)
  check('  …y suma las tres copias', /30,00/.test(costo), costo)
  check('  …y el valor estimado sigue siendo el de todas', /575,00/.test(cab), cab)
  await page.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
