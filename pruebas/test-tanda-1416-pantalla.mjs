// Tanda 1416 — Los enlaces de PokeDoc con su vista previa (PINGU, con la
// propuesta: «esto sí me gusta, hazlo recomendado»).
//   · Lo puro: qué dirección es de qué tipo (con y sin «https://», .html,
//     ?slug=…), un enlace con texto propio no se toca, cuándo va «solo en su
//     línea» y que las páginas dicen lo mismo que su tarjeta para redes.
//   · En un tema del foro: guía, página, perfil, expansión, torneo y tema solos
//     en su línea salen GRANDES; la carta y el evento dentro de una frase, en
//     PASTILLA; un enlace ajeno, uno con texto propio y una guía que no existe
//     se quedan como están. La carta grande dice su precio y cuántos la dan.
//   · En Mensajes, un enlace pegado sin «https://» sale como tarjeta.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { TARJETAS_FIJAS, PAGINA_DE_FIJA } from '/home/user/pingu/netlify/lib/tarjetas-fijas.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

const ahora = Date.now()
const CUERPO = [
  '<p>Leed esto antes de comprar:</p>',
  '<p><a href="https://pokedoc.es/guia/como-detectar-cartas-falsas">https://pokedoc.es/guia/como-detectar-cartas-falsas</a></p>',
  '<p>pokedoc.es/aprender</p>',
  '<p>Busco la https://pokedoc.es/carta/pikachu-ex-sv08-238 y voy al https://pokedoc.es/eventos/iberian-card-show, ¿alguien?</p>',
  '<p>https://pokedoc.es/usuario/ash</p>',
  '<p>https://pokedoc.es/coleccion/ssp</p>',
  '<p>https://pokedoc.es/torneo?slug=liga-jueves</p>',
  '<p>https://pokedoc.es/tema/tema-2</p>',
  '<p>https://pokedoc.es/carta/pikachu-ex-sv08-238</p>',
  '<p><a href="https://pokedoc.es/aprender">míralo aquí</a>, https://www.google.com y https://pokedoc.es/guia/no-existe</p>',
].join('')
const MUNDO = {
  __FAKE_SESSION__: 'user-1',
  __FAKE_SECCIONES__: [{ id: 'sec-1', name: 'General', slug: 'general' }],
  __FAKE_FOROS__: [{ id: 'foro-1', section_id: 'sec-1', name: 'Coleccionismo', slug: 'coleccionismo' }, { id: 'foro-2', section_id: 'sec-1', name: 'Cambios', slug: 'cambios' }],
  __FAKE_TEMAS__: [
    { id: 'tema-1', board_id: 'foro-1', title: 'Antes de comprar en Wallapop', author_id: 'user-2', post_count: 1 },
    { id: 'tema-2', board_id: 'foro-2', title: 'Busco Umbreon VMAX alternativo', author_id: 'user-3', post_count: 15 },
  ],
  __FAKE_MENSAJES__: [
    { id: 'post-1', thread_id: 'tema-1', author_id: 'user-2', body_html: CUERPO, created_at: new Date(ahora - 3600e3).toISOString() },
    { id: 'post-2', thread_id: 'tema-2', author_id: 'user-3', body_html: '<p>Tengo el Charizard ex de 151 y cambio por el Umbreon alt.</p>', created_at: new Date(ahora - 7200e3).toISOString() },
  ],
  __FAKE_GUIAS__: [{ id: 'g1', slug: 'como-detectar-cartas-falsas', title: 'Cómo detectar cartas falsas', description: 'Las cinco comprobaciones que hacemos antes de comprar una carta suelta.', estimated_mins: 8, author_id: 'user-2', category_id: 'cat-1', kind: 'guide', cover_image: 'https://fotos.test/portada.png', status: 'published' }],
  __FAKE_CATEGORIAS__: [{ id: 'cat-1', name: 'Coleccionismo', slug: 'coleccionismo' }],
  __FAKE_SETS__: [{ id: 'sv08', name: 'Chispas Fulgurantes', serie_id: 'sv', serie_name: 'Escarlata y Púrpura', market: 'WEST', tcg_online_code: 'SSP', card_count_official: 191, card_count_total: 252, release_date: '2024-11-08', logo_tcggo: 'https://images.tcggo.com/sv08.png' }],
  __FAKE_CARTAS__: [{ id: 'sv08-238', market: 'WEST', set_id: 'sv08', local_id: '238', name: 'Pikachu ex', name_es: 'Pikachu ex', image_path: 'sv/sv08/238', rarity: 'Special illustration rare' }],
  __FAKE_PRECIOS__: [{ card_id: 'sv08-238', cm_trend: 312.4, cm_low: 290 }],
  __FAKE_PERFILES__: [{ id: 'ash-1', username: 'ash', display_name: 'Ash Ketchum' }, { id: 'dan-1', username: 'dan1', display_name: 'Dan', coleccion_publica: false }, { id: 'dan-2', username: 'dan2', display_name: 'Dos' }],
  __FAKE_TORNEOS__: [{ id: 't-1', slug: 'liga-jueves', name: 'Liga de los jueves', status: 'registration_open', format: 'standard', max_players: 24, start_at: new Date(ahora + 5 * 86400e3).toISOString() }],
  __FAKE_INSCRIPCIONES__: [{ id: 'r1', tournament_id: 't-1', user_id: 'user-2', status: 'active', tcg_live_username: 'a' }, { id: 'r2', tournament_id: 't-1', user_id: 'user-3', status: 'active', tcg_live_username: 'b' }],
  __FAKE_EVENTOS__: [{ id: 'ev-1', slug: 'iberian-card-show', nombre: 'Iberian Card Show', tipo: 'card_show', publicado: true, color: '#3a5fb8', ciudad: 'Madrid', sitio: 'Pabellón de Cristal', empieza: new Date(ahora + 20 * 86400e3).toISOString(), asistentes: [{ user_id: 'user-2' }, { user_id: 'user-3' }] }],
  __FAKE_FILAS__: {
    user_collection: [
      { id: 'uc1', user_id: 'dan-1', card_id: 'sv08-238', market: 'WEST', cantidad: 2, cambio: 1, idioma: 'es' },
      { id: 'uc2', user_id: 'dan-2', card_id: 'sv08-238', market: 'WEST', cantidad: 1, cambio: 1, idioma: 'es' },
    ],
    conversations: [{ id: 'c1' }],
    conversation_participants: [{ conversation_id: 'c1', user_id: 'user-1' }, { conversation_id: 'c1', user_id: 'user-2' }],
    private_messages: [
      { id: 'pm1', conversation_id: 'c1', sender_id: 'user-2', body: 'Mira esta guía', created_at: new Date(ahora - 600e3).toISOString(), deleted_at: null, adjuntos: [] },
      { id: 'pm2', conversation_id: 'c1', sender_id: 'user-2', body: 'pokedoc.es/guia/como-detectar-cartas-falsas', created_at: new Date(ahora - 500e3).toISOString(), deleted_at: null, adjuntos: [] },
    ],
  },
}
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')
const browser = await chromium.launch()
async function abrir(ruta, { movil = false, tema = 'light' } = {}) {
  const ctx = await browser.newContext(movil ? { viewport: { width: 390, height: 2400 }, isMobile: true, hasTouch: true, locale: 'es-ES', serviceWorkers: 'block' } : { viewport: { width: 1440, height: 2000 }, locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript(([m, tema]) => { for (const [k, v] of Object.entries(m)) window[k] = v; localStorage.setItem('pokedoc-theme', tema); localStorage.setItem('pokedoc-instalar-no', String(Date.now())) }, [MUNDO, tema])
  await ctx.route(/fotos\.test|assets\.tcgdex\.net|images\.tcggo\.com|scrydex/, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }))
  await ctx.route(/\/\.netlify\/functions\/|api\.tcgdex\.net/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => { if (!/ViewTransition|Transition was/.test(String(e))) errores.push(String(e).slice(0, 200)) })
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3500)
  return { ctx, page, errores }
}

console.log('── Lo puro ──')
{
  const { ctx, page } = await abrir('/tema?t=tema-1')
  const r = await page.evaluate(async (fijas) => {
    const m = await import('/js/enlaces-internos.js')
    const O = 'https://pokedoc.es'
    const t = (u) => { const d = m.destinoDe(u, O); return d ? `${d.tipo}:${d.clave}` : 'null' }
    const div = document.createElement('div')
    div.innerHTML = '<p><a id="a1" href="/x">/x</a></p><p>hola <a id="a2" href="/y">/y</a></p><p>texto<br><a id="a3" href="/z">/z</a><br>más</p>'
    const distintas = Object.entries(fijas).filter(([ruta, f]) => { const p = m.PAGINAS[ruta]; return !p || p.titulo !== f.titulo || (p.texto !== f.entradilla && !f.recortada) })
    return {
      tipos: [
        t('https://pokedoc.es/guia/abc'), t('/guia?slug=abc'), t('/noticias/xyz'), t('/curso?slug=c1'), t('https://pokedoc.es/tema/t1'), t('/tema?t=t2'),
        t('/eventos/iberian'), t('/carta/pikachu-ex-sv08-238'), t('/coleccion/ssp'), t('/usuario/ash'), t('/tiendas/rincon'), t('/torneo?slug=liga'),
        t('/aprender'), t('/aprender.html'), t('/'), t('https://www.google.com/aprender'), t('/aprender?x=1'), t('/ajustes'),
      ].join(' | '),
      desnudo: [m.esEnlaceDesnudo('https://pokedoc.es/aprender', 'https://pokedoc.es/aprender', O), m.esEnlaceDesnudo('pokedoc.es/aprender', 'https://pokedoc.es/aprender', O), m.esEnlaceDesnudo('míralo aquí', 'https://pokedoc.es/aprender', O), m.esEnlaceDesnudo('www.pokedoc.es/aprender/', '/aprender', O)].join(),
      solo: ['a1', 'a2', 'a3'].map((id) => m.vaSolo(div.querySelector(`#${id}`))).join(),
      final: m.limpiarFinal('https://pokedoc.es/aprender.'),
      distintas: distintas.map(([r]) => r).join(','),
    }
  }, Object.fromEntries(Object.entries(TARJETAS_FIJAS).map(([k, v]) => {
    const html = PAGINA_DE_FIJA[k]
    const ruta = html === 'index.html' ? '/' : `/${html.replace(/\.html$/, '')}`
    const limpio = (s) => s.replace(/\*/g, '')
    // Para tiendas: su entradilla lleva «Descarga el dossier», que en el foro sobra.
    return [ruta, { titulo: limpio(v.titulo), entradilla: limpio(v.entradilla), recortada: k === 'para-tiendas' }]
  })))
  check('cada dirección, su tipo', r.tipos === 'guia:abc | guia:abc | guia:xyz | guia:c1 | tema:t1 | tema:t2 | evento:iberian | carta:/carta/pikachu-ex-sv08-238 | expansion:ssp | perfil:ash | perfil:rincon | torneo:liga | pagina:/aprender | pagina:/aprender | pagina:/ | null | null | null', r.tipos)
  check('un enlace con texto propio no se toca; sin «https://» o con «www» sí', r.desnudo === 'true,true,false,true', r.desnudo)
  check('«solo en su línea»: solo en su párrafo o entre dos saltos, no en una frase', r.solo === 'true,false,true', r.solo)
  check('el punto final de una frase no es de la dirección', r.final === 'https://pokedoc.es/aprender', r.final)
  check('las 17 páginas dicen lo mismo que su tarjeta para redes', r.distintas === '', r.distintas)
  await ctx.close()
}

console.log('── En un tema del foro ──')
for (const [movil, tema] of [[false, 'light'], [true, 'dark']]) {
  const { ctx, page, errores } = await abrir('/tema?t=tema-1', { movil, tema })
  await page.waitForSelector('.ep-grande', { timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(800)
  const r = await page.evaluate(() => {
    const as = [...document.querySelectorAll('a.ep')].map((a) => ({ tipo: a.dataset.enlace, forma: a.classList.contains('ep-grande') ? 'G' : 'P', sec: [...a.classList].find((c) => /^ep-(inicio|comunidad|cartas|aprender|jugar)$/.test(c)), chapa: a.querySelector('.ep-chapa')?.textContent.trim() || '', titulo: (a.querySelector('.ep-titulo, .ep-pastilla-texto')?.textContent || '').trim(), texto: a.querySelector('.ep-texto')?.textContent.trim() || '', pie: a.querySelector('.ep-pie')?.textContent.replace(/\s+/g, ' ').trim() || '', img: !!a.querySelector('img') }))
    const sueltos = [...document.querySelectorAll('a:not(.ep)')].filter((a) => /google|no-existe|míralo/.test(a.href + a.textContent)).map((a) => a.textContent.trim())
    const google = [...document.querySelectorAll('p')].some((p) => /https:\/\/www\.google\.com/.test(p.textContent) && !p.querySelector('a[href*="google"]'))
    return { as, sueltos, google, ancho: document.documentElement.scrollWidth - innerWidth }
  })
  const de = (tipo, forma) => r.as.find((x) => x.tipo === tipo && (!forma || x.forma === forma))
  const nombre = movil ? 'móvil oscuro' : 'PC claro'
  check(`(${nombre}) la guía, grande: portada, «Guía · Coleccionismo», autor y minutos`, de('guia')?.forma === 'G' && de('guia').img && de('guia').chapa === 'Guía · Coleccionismo' && /8 min de lectura/.test(de('guia').pie), JSON.stringify(de('guia')))
  check(`(${nombre}) pokedoc.es/aprender sin «https://», grande y en verde`, de('pagina')?.forma === 'G' && de('pagina').sec === 'ep-aprender' && de('pagina').titulo === 'Aprende de Pokémon TCG', JSON.stringify(de('pagina')))
  check(`(${nombre}) la carta y el evento en una frase, en pastilla`, de('carta', 'P')?.titulo === 'Pikachu ex' && de('evento')?.forma === 'P' && de('evento').titulo === 'Iberian Card Show', JSON.stringify([de('carta', 'P'), de('evento')]))
  check(`(${nombre}) la carta sola: número, rareza, precio y cuántos la dan`, de('carta', 'G') && /^238\/191/.test(de('carta', 'G').texto) && /312,40/.test(de('carta', 'G').pie) && /la dan 2 de PokeDoc/.test(de('carta', 'G').pie), JSON.stringify(de('carta', 'G')))
  check(`(${nombre}) el perfil, con su @`, de('perfil')?.titulo === 'Ash Ketchum' && de('perfil').texto === '@ash', JSON.stringify(de('perfil')))
  check(`(${nombre}) la expansión por su código: cartas y fecha`, de('expansion')?.titulo === 'Chispas Fulgurantes' && /252 cartas/.test(de('expansion').texto) && /2024/.test(de('expansion').texto), JSON.stringify(de('expansion')))
  check(`(${nombre}) el torneo: plazas y estado, en morado`, de('torneo')?.sec === 'ep-jugar' && /2 de 24 plazas/.test(de('torneo').pie) && /Inscripciones abiertas/.test(de('torneo').pie) && /Estándar/.test(de('torneo').chapa), JSON.stringify(de('torneo')))
  check(`(${nombre}) el tema: su foro, el principio del mensaje y las respuestas`, de('tema')?.chapa === 'Foro · Cambios' && /Charizard ex de 151/.test(de('tema').texto) && /14 respuestas/.test(de('tema').pie), JSON.stringify(de('tema')))
  check(`(${nombre}) uno con texto propio y una guía que no existe, como estaban; la web ajena, sin enlazar`, r.sueltos.length === 2 && r.google, r.sueltos.join(' | '))
  check(`(${nombre}) nada se sale de lado`, r.ancho <= 1, r.ancho)
  if (process.env.CAPTURAS) await page.locator('#post-1, [data-post-id="post-1"], .foro-mensaje').first().screenshot({ path: `${process.env.CAPTURAS}/1416-${movil ? 'movil' : 'pc'}.png` }).catch(() => {})
  check(`(${nombre}) sin errores`, !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('── En Mensajes ──')
{
  const { ctx, page, errores } = await abrir('/mensajes.html?with=user-2')
  await page.waitForSelector('.msg-burbuja .ep', { timeout: 8000 }).catch(() => {})
  const r = await page.evaluate(() => [...document.querySelectorAll('.msg-burbuja a.ep')].map((a) => `${a.dataset.enlace}:${a.classList.contains('ep-grande') ? 'G' : 'P'}`).join(','))
  check('un enlace pegado sin «https://» sale como tarjeta grande', r === 'guia:G', r)
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} fallos` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
