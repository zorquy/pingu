// Tanda 557 — el escáner no reconocía el japonés… y la búsqueda tampoco.
//
// PINGU, con la web ya abierta al público: «el escáner de cartas no
// reconoce el japonés, pero los occidentales parece que sí».
//
// Y no era el escáner: era `normalizeSearch`, o sea **toda la búsqueda
// japonesa**, tecleada o escaneada.
//
// ── QUÉ PASABA ──
//
// `normalizeSearch` hace `NFD` para separar «letra + tilde» y poder tirar
// la tilde (sin eso, quien escribe «pomez» no encuentra «Piedra Pómez»).
// Pero **NFD también descompone el kana**: ギ se parte en キ + ゙ (U+3099)
// y ダ en タ + ゙. Y ese signo NO está en el rango ̀-ͯ que se
// tira, así que se queda: la consulta salía con SIETE puntos de código
// donde la base tiene CINCO.
//
// La base no descompone nada —`unaccent()` no toca el kana—, así que
// `like '%フシギダネ%'` contra «フシギダネ» no casa JAMÁS. Sin error: cero
// resultados. Y como casi todos los nombres japoneses llevan una sonora
// (ギ, ダ, ピ, ベ, ゾ…), no se encontraba prácticamente NINGUNO.
//
// Se arregla recomponiendo al final (`NFC`), que es exactamente lo que
// tiene la base. NFC y no NFKC: esto tiene que hacer lo mismo que Postgres
// y nada más.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { normalizeSearch } from '/home/user/pingu/js/texto.js'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 250) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const puntos = (s) => [...s].map((c) => c.codePointAt(0).toString(16)).join(' ')

console.log('── 1. Un nombre japonés sale COMO ENTRÓ ──')
{
  // Los cinco primeros de la Pokédex en japonés, más las sonoras que
  // rompían: todos llevan dakuten o handakuten.
  const NOMBRES = ['フシギダネ', 'フシギソウ', 'フシギバナ', 'ヒトカゲ', 'ゼニガメ', 'ピカチュウ', 'リザードン', 'ゾロアーク', 'イーブイ']
  for (const n of NOMBRES) {
    const salida = normalizeSearch(n)
    check(`«${n}» no se descompone`, salida === n, `${puntos(n)} → ${puntos(salida)}`)
  }
  // Y la comprobación que de verdad dice la regla: lo que sale es lo que
  // guarda la base, que es `lower()` sobre la forma COMPUESTA.
  for (const n of NOMBRES) {
    if (normalizeSearch(n) !== n.normalize('NFC').toLowerCase()) {
      check(`«${n}» coincide con lo que guardaría Postgres`, false, puntos(normalizeSearch(n)))
    }
  }
  check('todos coinciden con lo que guardaría Postgres', NOMBRES.every((n) => normalizeSearch(n) === n.normalize('NFC').toLowerCase()))
}

console.log('── 2. Y el español sigue perdiendo la tilde ──')
{
  // La otra mitad: si al recomponer se perdiera esto, quien escribe
  // «pomez» dejaría de encontrar «Piedra Pómez» — y son 1.159 cartas
  // acentuadas. Una guarda que solo se prueba por un lado no se prueba.
  check('«Pómez» → «pomez»', normalizeSearch('Piedra Pómez') === 'piedra pomez', normalizeSearch('Piedra Pómez'))
  // La ñ SÍ se pierde, y está bien: `unaccent()` de Postgres la convierte
  // en «n», así que `name_search` guarda «manana» y la consulta tiene que
  // decir lo mismo. (Lo escribí al revés en la primera versión de esta
  // prueba y lo cazó ella: la regla no es «qué me parece a mí una tilde»,
  // es «qué hace Postgres».)
  check('la ñ también se pierde, como en unaccent()', normalizeSearch('Mañana') === 'manana', normalizeSearch('Mañana'))
  check('el apóstrofo curvo se endereza', normalizeSearch('Farfetch’d') === "farfetch'd", normalizeSearch('Farfetch’d'))
  check('la ligadura se abre', normalizeSearch('Æther') === 'aether', normalizeSearch('Æther'))
  check('y sigue bajando a minúsculas', normalizeSearch('CHARIZARD') === 'charizard')
}

console.log('── 3. La vuelta entera: se busca y SE ENCUENTRA ──')
{
  // Esto es lo que de verdad falla o pasa, porque el doble genera
  // `name_search` con ESTA MISMA función —igual que Postgres— y la
  // consulta la normaliza otra vez. Si las dos no acaban en la misma
  // forma, aquí salen cero resultados con la carta delante.
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.addInitScript(() => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_SETS__ = [{ id: 'mf_ja', name: '30th セレブレーション', name_en: '30th Celebration', serie_id: 'mega-evolution', serie_name_en: 'Mega Evolution', market: 'JP', card_count_official: 2, card_count_total: 2, release_date: '2026-09-16' }]
    window.__FAKE_CARTAS__ = [
      { id: 'mf_ja-1', market: 'JP', set_id: 'mf_ja', local_id: '001', name: 'フシギダネ', name_en: 'Bulbasaur', image_scrydex: 'https://images.scrydex.com/pokemon/mf_ja-1-front', rarity: 'Common', category: 'Pokemon', variants: { normal: true } },
      { id: 'mf_ja-2', market: 'JP', set_id: 'mf_ja', local_id: '002', name: 'ピカチュウ', name_en: 'Pikachu', image_scrydex: 'https://images.scrydex.com/pokemon/mf_ja-2-front', rarity: 'Common', category: 'Pokemon', variants: { normal: true } },
    ]
    window.__FAKE_COLECCION__ = []
  })
  await page.route('**assets.tcgdex.net/**', (r) => r.abort())
  await page.route('**images.scrydex.com/**', (r) => r.abort())
  await page.goto(`${BASE}/mi-coleccion.html?ver=buscar`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  // Al catálogo japonés, que es donde vive esa carta.
  await page.locator('.mc-mercado:visible').first().selectOption('ja')
  await page.waitForTimeout(2000)

  const buscar = async (texto) => {
    await page.fill('#mcBuscarTodo', texto)
    await page.waitForTimeout(1500)
    return (await page.locator('#mcBuscarResultados').innerText()).trim()
  }
  const conDakuten = await buscar('フシギダネ')
  check('se encuentra un nombre con dakuten', /フシギダネ|Bulbasaur/.test(conDakuten), conDakuten.slice(0, 160))
  const conHandakuten = await buscar('ピカチュウ')
  check('  …y uno con handakuten', /ピカチュウ|Pikachu/.test(conHandakuten), conHandakuten.slice(0, 160))
  // Y por el nombre OCCIDENTAL, que es lo que la 546 y su migración
  // pusieron en `name_search`: la pantalla rotula «Bulbasaur», así que
  // escribir «Bulbasaur» tiene que encontrarla (la lección de la 447).
  const porOccidental = await buscar('Bulbasaur')
  check('y también por el nombre occidental que se enseña', /フシギダネ|Bulbasaur/.test(porOccidental), porOccidental.slice(0, 160))
  check('sin errores de JavaScript', errores.length === 0, errores.join(' | '))
  await browser.close()
}

console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
