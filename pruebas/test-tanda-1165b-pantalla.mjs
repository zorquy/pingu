// Tanda 1165b — aviso del foro (Sergio): dentro de un Pokémon de la Pokédex,
// los botones «Pokémon / Pokémon Japón» no hacían nada, en PC y en móvil. El
// selector de una especie es HTML nuevo en cada pintado y el `change` solo
// estaba enganchado a los selectores que existían al arrancar. Ahora va
// delegado al documento: cambiar ahí cambia el catálogo (se recuerda) y la
// especie se vuelve a pintar en el otro catálogo.
import { chromium, contexto, BASE } from './fixtures-app.mjs'

let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }
const b = await chromium.launch()
for (const movil of [false, true]) {
  // Una Bulbasaur japonesa: es lo que tiene que salir al cambiar de catálogo.
  const ctx = await contexto(b, movil, 'user-1', () => {
    window.__FAKE_SETS__.push({ id: 'sv1a', market: 'JP', name: 'トリプレットビート', name_en: 'Triplet Beat', serie_id: 'sv', tcg_online_code: 'SV1a', card_count_official: 73, card_count_total: 73, release_date: '2023-03-10' })
    window.__FAKE_CARTAS__.push({ id: 'tcggo-9001', set_id: 'sv1a', market: 'JP', local_id: '1', name: 'フシギダネ', name_en: 'Bulbasaur', name_es: 'Bulbasaur', image_path: null, dex_ids: [1], rarity: 'Common', rarity_en: 'Common', category: 'Pokemon', origen: 'tcggo' })
  })
  const p = await ctx.newPage()
  if (!movil) await p.setViewportSize({ width: 1280, height: 800 })
  const errores = []
  p.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  // Lo que pide la especie: la segunda vez tiene que ir al catálogo japonés.
  await p.goto(`${BASE}/mi-coleccion?ver=pokedex&dex=1`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2500)
  const que = movil ? 'móvil' : 'PC'
  check(`${que}: sin errores`, errores.length === 0, errores.join(' | '))
  const antes = await p.evaluate(() => ({ sel: document.querySelector('#mcPokedexPanel .mc-mercado')?.value, japon: Boolean(document.querySelector('#mcPokedexPanel [data-vista="ja"]')) }))
  check(`${que}: dentro de la especie hay selector de catálogo, en «Pokémon»`, antes.sel === 'es' && antes.japon, JSON.stringify(antes))
  await p.click('#mcPokedexPanel [data-vista="ja"]')
  await p.waitForTimeout(2500)
  const despues = await p.evaluate(() => ({ sel: document.querySelector('#mcPokedexPanel .mc-mercado')?.value, pulsado: document.querySelector('#mcPokedexPanel [data-vista="ja"]')?.getAttribute('aria-pressed'), guardado: localStorage.getItem('mc-vista'), url: location.search, especie: /Bulbasaur/.test(document.getElementById('mcPokedexPanel').innerText), japonesa: Boolean(document.querySelector('#mcPokedexPanel [data-carta="tcggo-9001"]')) }))
  check(`${que}: tocar «Pokémon Japón» cambia el catálogo (y se recuerda)`, despues.sel === 'ja' && despues.pulsado === 'true' && despues.guardado === 'ja', JSON.stringify(despues))
  check(`${que}: …y la misma especie se vuelve a pintar en el japonés, con su carta`, /dex=1/.test(despues.url) && despues.especie && despues.japonesa, JSON.stringify(despues))
  await ctx.close()
}
await b.close()
console.log(fails ? `\n${fails} FALLOS` : '\nTODO OK')
process.exit(fails ? 1 : 0)
