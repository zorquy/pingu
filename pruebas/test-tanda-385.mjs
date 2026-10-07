// Tanda 385 — la ficha de una carta, atada al resto.
//
// La última de las cuatro. Dos cosas, y la primera es una copia que YA
// había empezado a separarse:
//
//   · Las versiones de una carta se calculaban en DOS sitios, y ya
//     discrepaban: la ficha suponía normal + reverse cuando no se sabía
//     y el bolsillo del álbum solo normal.
//   · Y desde una carta no se podía llegar a su Pokédex: había que ir a
//     /mi-coleccion y buscarla otra vez entre 1.025.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync } from 'node:fs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 200) : ''}`)
}
const leer = (f) => readFileSync(`/home/user/pingu/${f}`, 'utf8')
const BASE = process.env.PD_BASE || 'http://localhost:8892'

console.log('\n── 1. Una sola cuenta de las versiones ──')
{
  const { variantesDeCarta, TODAS } = await import('/home/user/pingu/js/mi-coleccion/variantes.js')
  const cortos = (c, d) => variantesDeCarta(c, d).map((x) => x.corto).join('+')

  // Cuando SE SABE, las dos pantallas dan lo mismo pase lo que pase.
  const sabida = { variants: { normal: true, holo: true } }
  check('sabiendo cuáles hay, el respaldo no se usa',
    cortos(sabida) === 'N+H' && cortos(sabida, TODAS) === 'N+H', cortos(sabida, TODAS))

  // Cuando NO se sabe, cada pantalla dice qué prefiere. No hay un valor
  // «obvio»: son respuestas opuestas y las dos razonables.
  check('sin datos, el álbum ofrece una', cortos({}) === 'N', cortos({}))
  check('  …y la ficha, todas', cortos({}, TODAS) === 'N+RH+H+1.ª', cortos({}, TODAS))

  // Y la copia de la ficha se fue: era la que discrepaba.
  const mercado = leer('js/carta-mercado.js')
  check('la ficha ya no calcula las versiones por su cuenta',
    !/if \(v\.normal\) lista\.push/.test(mercado))
  // Desde la 688 el segundo argumento es «qué ofrecer si no se sabe»
  // (`siNoSeSabe`), y cambia por pantalla: lo que se vigila es que pida al
  // módulo común, no cómo se llame la variable.
  check('  …sino que las pide al módulo común', /variantesDeCarta\(\{ variants: v \}, \w+\)/.test(mercado))
  // Las dos llamadas dicen en voz alta qué quieren: un valor por
  // defecto habría enterrado la diferencia otra vez.
  // Desde la 564 la ficha de /mi-coleccion también pide «todas» (para
  // guardar la versión que tienes en la mano), en `variantesParaEditar`;
  // lo que no puede pedirlas es el ÁLBUM, que marca.
  const mc = leer('js/mi-coleccion.js')
  check('  …y el álbum no pide «todas»', /variantesDeCarta\(c\)\.map\(/.test(mc) && !/variantesDeCarta\(c, TODAS/.test(mc))
  check('  …mientras la ficha sí, en su ayudante', /variantesDeCarta\(carta, TODAS_LAS_VARIANTES\)/.test(mc))
}

console.log('\n── 2. De una carta a su Pokédex ──')
const browser = await chromium.launch()
const VACIO = '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"/>'

async function ficha(nombre) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1400 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.route('**/assets.tcgdex.net/**', (r) => r.fulfill({ contentType: 'image/svg+xml', body: VACIO }))
  await page.route('**/r2.limitlesstcg.net/**', (r) => r.fulfill({ contentType: 'image/svg+xml', body: VACIO }))
  await page.route('**/api.tcgdex.net/**', (r) =>
    r.fulfill({ contentType: 'application/json', body: JSON.stringify({ id: 'sv1-25', variants: { normal: true, reverse: true } }) })
  )
  await page.addInitScript((n) => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_SETS__ = [{ id: 'sv1', name: 'SV', market: 'WEST', tcg_online_code: 'SVI', release_date: '2023-03-31' }]
    window.__FAKE_CARTAS__ = [{
      id: 'sv1-25', set_id: 'sv1', local_id: '25', name: n, name_es: n, image_path: 'x/25',
      market: 'WEST', category: 'Pokémon', hp: 60, types: ['Rayo'], rarity: 'Ultra Rare', dex_ids: [25],
    }]
    window.__FAKE_COLECCION__ = []
  }, nombre)
  await page.goto(`${BASE}/carta?id=sv1-25`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2800)
  return { page, errores }
}

{
  const { page, errores } = await ficha('Pikachu ex')
  check('sin errores', errores.length === 0, errores.join(' | '))
  const enlace = page.locator('a[href*="ver=pokedex"]')
  check('hay enlace a su Pokédex', (await enlace.count()) === 1)
  check('  …con el nombre de la especie', /Todas las cartas de Pikachu/.test((await enlace.textContent()) || ''),
    (await enlace.textContent())?.trim())
  check('  …y va a la especie, no a la rejilla', (await enlace.getAttribute('href')) === '/mi-coleccion?ver=pokedex&dex=25',
    await enlace.getAttribute('href'))
  // La ficha ofrece SOLO las versiones que la API dice que existen.
  const vs = await page.locator('#cmVariante option').allTextContents()
  check('  …y las versiones son las que existen', vs.join('+') === 'Normal+Reverse holo', vs.join('+'))
  await page.close()
}

{
  // Una TAG TEAM tiene DOS especies: un enlace que elige por ti manda a
  // medio sitio, así que no se pone ninguno.
  const { page } = await ficha('Pikachu & Zekrom-GX')
  check('una TAG TEAM no lleva enlace', (await page.locator('a[href*="ver=pokedex"]').count()) === 0)
  await page.close()
}

{
  // Y un Entrenador tampoco: no tiene especie.
  const { page } = await ficha("Boss's Orders")
  check('un Entrenador tampoco', (await page.locator('a[href*="ver=pokedex"]').count()) === 0)
  await page.close()
}

console.log('\n── 3. `?dex=` entra directo a la especie ──')
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 1100 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.route('**/assets.tcgdex.net/**', (r) => r.fulfill({ contentType: 'image/svg+xml', body: VACIO }))
  await page.route('**/r2.limitlesstcg.net/**', (r) => r.fulfill({ contentType: 'image/svg+xml', body: VACIO }))
  await page.addInitScript(() => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_SETS__ = [{ id: 'sv1', name: 'SV', market: 'WEST', release_date: '2023-03-31' }]
    window.__FAKE_CARTAS__ = [1, 2].map((n) => ({
      id: `sv1-${n}`, set_id: 'sv1', local_id: String(n), name: 'Pikachu', name_es: 'Pikachu',
      image_path: `x/${n}`, market: 'WEST', dex_ids: [25],
    }))
    window.__FAKE_COLECCION__ = []
  })
  await page.goto(`${BASE}/mi-coleccion.html?ver=pokedex&dex=25`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('abre la especie, no la rejilla', (await page.locator('.pdx-cabecera').count()) === 1 &&
    (await page.locator('.pdx-especie').count()) === 0)
  check('  …y es la que se pidió', /Pikachu/.test((await page.locator('.pdx-cabecera h3').textContent()) || ''),
    await page.locator('.pdx-cabecera h3').textContent())

  await page.locator('#pdxVolver').click()
  await page.waitForTimeout(700)
  check('al volver sale la rejilla (una región, 748)', (await page.locator('.pdx-especie').count()) === 151 && (await page.locator('.pdx-region').count()) === 9)
  // Y `dex` se va de la dirección: si se queda, recargar vuelve a abrir
  // la especie que acabas de cerrar.
  check('  …y la dirección se limpia', !/dex=/.test(page.url()), page.url())

  // Un número que no es un Pokémon no abre nada raro.
  await page.goto(`${BASE}/mi-coleccion.html?ver=pokedex&dex=99999`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2800)
  check('un número inventado deja la rejilla (una región, 748)', (await page.locator('.pdx-especie').count()) === 151 && (await page.locator('.pdx-region').count()) === 9,
    String(await page.locator('.pdx-especie').count()))
  await page.close()
}

await browser.close()
console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
