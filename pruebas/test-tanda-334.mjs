// Tanda 334 — TCGdex no traduce solo los ataques.
//
// PINGU, tres veces en dos días: no sale el subtítulo, no sale la
// debilidad, no salen los otros prints. Yo los traté como tres cosas y
// eran UNA.
//
// Al empezar a engordar en español (tanda 330) se nos pasó lo obvio:
// TCGdex traduce TAMBIÉN los campos que el código compara con cadenas
// inglesas. `category` llega como «Pokémon», `stage` como «Básico», los
// tipos como «Psíquico». Y `category === 'Pokemon'` era la puerta del
// subtítulo, del cuadro de combate Y de la huella — así que una carta
// engordada en español se quedaba sin las tres a la vez, y sin huella
// tampoco salían sus reimpresiones.
//
// Estaba a la vista y no lo vi: donde nuestra tabla dice «Doble rara»,
// la ficha de PINGU ponía «Rara Doble». Eso no lo escribió PokeDoc.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { canonizarCarta, esPokemon, detalleDeCarta } from '/home/user/pingu/js/carta-detalle.js'
import { huellaDeCarta, esLaMismaCarta, subtituloDeCarta, nucleoDeCarta } from '/home/user/pingu/js/carta-nucleo.js'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 220) : ''}`)
}
const BASE = 'http://localhost:8892'
const limpio = (t) => String(t || '').replace(/\s+/g, ' ').trim()
const browser = await chromium.launch()

// Tal y como está GUARDADA hoy en la base de PokeDoc.
const EN_ES = (id, local) => ({
  id, set_id: '30c', market: 'WEST', local_id: local, name: 'Mew ex', image_path: 'sv/30c/66',
  category: 'Pokémon', hp: 160, types: ['Psíquico'], stage: 'Básico', retreat: 0,
  rarity: 'Rara Doble', illustrator: 'aky CG Works', detalle_at: 'x', detalle_lang: 'es',
  regulation_mark: 'J', weaknesses: [{ type: 'Oscuro', value: '×2' }],
  resistances: [{ type: 'Lucha', value: '-30' }],
  abilities: [{ type: 'Habilidad', name: 'Hélice Recuerdo', effect: 'Puede usar los ataques de tu Banca.' }],
  attacks: [{ name: 'Explosión Teleportadora', cost: ['Psíquico'], damage: '30', effect: 'Puedes cambiar.' }],
})

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. Los enums vuelven a su forma canónica ──')
{
  const c = canonizarCarta(EN_ES('30c-66', '066'))
  check('la categoría', c.category === 'Pokemon', c.category)
  check('la fase', c.stage === 'Basic', c.stage)
  check('los tipos', JSON.stringify(c.types) === '["Psychic"]', JSON.stringify(c.types))
  check('el tipo de la debilidad', c.weaknesses[0].type === 'Darkness', c.weaknesses[0].type)
  check('…y el de la resistencia', c.resistances[0].type === 'Fighting', c.resistances[0].type)
  check('el coste de cada ataque', JSON.stringify(c.attacks[0].cost) === '["Psychic"]', JSON.stringify(c.attacks[0].cost))

  // Lo que ya venía en inglés no se toca: son 3.596 fichas así.
  const ingles = { category: 'Pokemon', stage: 'Basic', types: ['Grass'], weaknesses: [{ type: 'Fire', value: '×2' }] }
  check('lo que ya estaba en inglés se queda igual',
    JSON.stringify(canonizarCarta(ingles)) === JSON.stringify(ingles))
  // Y lo que no se reconoce NO se pierde: se deja tal cual y lo salva
  // la comprobación por estructura de abajo.
  check('una palabra desconocida no se borra', canonizarCarta({ stage: 'Fase Ñ' }).stage === 'Fase Ñ')

  // Y el mapeo de la respuesta ya guarda canónico, para que las que
  // vengan a partir de ahora no necesiten nada de esto.
  check('el engorde ya guarda en canónico',
    detalleDeCarta({ category: 'Pokémon', hp: 60, types: ['Psíquico'] }).category === 'Pokemon')
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. Y si la palabra no la conocemos, la ESTRUCTURA ──')
{
  // Esta es la red que evita que vuelva a pasar. Adivinar cómo escribe
  // TCGdex cada palabra es una lista curada, y una lista curada se queda
  // vieja (la lección de la 323). Los PS solo los tiene un Pokémon.
  check('una categoría que no conocemos, pero con PS, es un Pokémon',
    esPokemon({ category: 'Pokémon-Ex-Lo-Que-Sea', hp: 160 }))
  check('…y sin PS ni categoría conocida, no se afirma que lo sea',
    !esPokemon({ category: 'Vete a saber' }))
  check('un Entrenador en español NO es un Pokémon', !esPokemon({ category: 'Entrenador' }))
  check('una Energía tampoco', !esPokemon({ category: 'Energía' }))
  // Y el caso que importa: un Entrenador no tiene PS, así que la vía de
  // la estructura no puede confundirlo.
  check('un Entrenador con palabra rara sigue sin ser Pokémon',
    !esPokemon({ category: 'Entrenador de Apoyo', hp: null }))
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. Las tres puertas que se cerraban a la vez ──')
{
  const es = EN_ES('30c-66', '066')
  check('el subtítulo vuelve',
    subtituloDeCarta(es) === 'Básico · 160 PS · Tipo Psíquico', subtituloDeCarta(es))
  const html = nucleoDeCarta(es, { name: '30th Celebration', card_count_official: 128 })
  check('el cuadro de combate vuelve', /carta-combate/.test(html))
  check('…y el punto de energía sale de su color', /data-tipo="Psychic"/.test(html))
  check('la huella vuelve', Boolean(huellaDeCarta(es)))

  // Y lo que de verdad importaba: la misma carta engordada en español y
  // en inglés tiene que seguir siendo la misma.
  const en = { ...es, category: 'Pokemon', stage: 'Basic', types: ['Psychic'], detalle_lang: 'en',
    weaknesses: [{ type: 'Darkness', value: '×2' }], resistances: [{ type: 'Fighting', value: '-30' }],
    attacks: [{ name: 'Teleportation Burst', cost: ['Psychic'], damage: '30' }] }
  check('español e inglés siguen siendo la misma carta', esLaMismaCarta(es, en))
  // Sin pasarse: una carta distinta sigue siendo distinta.
  check('…pero otra carta no', !esLaMismaCarta(es, { ...en, hp: 60 }))
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 4. En la página, con los datos de la base ──')
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 1100 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await page.addInitScript((c) => {
    window.__FAKE_SETS__ = [{ id: '30c', name: '30th Celebration', market: 'WEST', serie_name: 'Mega',
      release_date: '2026-09-16', card_count_official: 128 }]
    window.__FAKE_CARTAS__ = c
  }, [EN_ES('30c-66', '066'), EN_ES('30c-118', '118')])
  await page.goto(`${BASE}/carta/mew-ex-30c-66`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2400)

  check('sin errores', errores.length === 0, errores.join(' | '))
  check('sale el subtítulo',
    limpio(await page.locator('.carta-sub').textContent()) === 'Básico · 160 PS · Tipo Psíquico',
    await page.locator('.carta-sub').textContent().catch(() => '(no sale)'))
  const combate = limpio((await page.locator('.carta-combate div').allTextContents()).join(' | '))
  check('sale la debilidad', /×2/.test(combate), combate || '(no sale)')
  check('…la resistencia', /-30/.test(combate), combate)
  check('…y la retirada a cero, que es «Gratis» y no una raya', /Gratis/.test(combate), combate)
  check('el punto del coste sale de su color',
    (await page.locator('.carta-mov .carta-energia').first().getAttribute('data-tipo')) === 'Psychic')
  check('y salen las otras versiones', (await page.locator('.carta-version').count()) === 1,
    (await page.locator('.carta-version').allTextContents()).join(' | ') || '(no salen)')
  await page.close()
}

console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
await browser.close()
process.exit(fails === 0 ? 0 : 1)
