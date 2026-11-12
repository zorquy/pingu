// Tandas 1270 y 1271 — el perfil nuevo (PINGU: «dale a todo lo recomendado»).
//
// 1270, la cabecera: los seguidores en caras («entre ellos…»), tres losas
// (colección, guías, torneos), la tarjeta de cambios (reputación + da/busca)
// en vez del sello y la chapa, dos columnas en el PC y, en el móvil, quién es,
// losas, tarjeta y lo demás.
// 1271, las pestañas: «Resumen» primera y abierta, «Colección» (la Vitrina),
// el logro destacado arriba de Logros, Torneos con tres cifras y las guías de
// otra persona en portadas.
import { chromium, contexto, BASE } from './fixtures-app.mjs'
import { readFileSync } from 'node:fs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const OUT = process.env.PD_CAPS || ''
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const b = await chromium.launch()
const abrir = async (ruta, movil) => {
  const ctx = await contexto(b, movil, 'user-1')
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  if (!movil) await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3200)
  return { ctx, page, errores }
}
const texto = (page, sel) => page.locator(sel).first().innerText().then((t) => t.replace(/\s+/g, ' ').trim()).catch(() => '')

console.log('── 1. Tu perfil en el PC ──')
{
  const { ctx, page, errores } = await abrir('/perfil.html', false)
  check('sin errores', errores.length === 0, errores.join(' | '))
  const losas = await page.$$eval('#profileStats .perfil-losa', (ls) => ls.map((l) => ({ q: l.dataset.losa, r: l.querySelector('.rotulo').textContent, top: Math.round(l.getBoundingClientRect().top) })))
  check('tres losas en una fila: Cartas, Guías y Torneos, cada una de su sección', losas.map((l) => `${l.q}:${l.r}`).join('|') === 'cartas:Cartas|aprender:Guías|jugar:Torneos' && new Set(losas.map((l) => l.top)).size === 1, JSON.stringify(losas))
  check('  …la de la colección, con las cartas de tu vitrina en abanico', (await page.locator('[data-losa="cartas"] .perfil-losa-abanico img').count()) >= 1)
  const social = await texto(page, '#perfilSocial')
  const seguidores = await texto(page, '#perfilSeguidores')
  check('los seguidores en caras: «3 seguidores» y «Sigues a 3» en la franja; «entre ellos Misty y Lance» en su tarjeta (1273)', /3 seguidores/.test(social) && /Sigues a 3/.test(social) && (await page.locator('#seguidoresCaras .mini-avatar').count()) === 3 && /Entre ellos Misty y Lance/.test(seguidores) && (await page.locator('#perfilSeguidores .ps-caras a').count()) === 3, `${social} || ${seguidores}`)
  const tarjeta = await texto(page, '#perfilTrueque')
  check('la tarjeta de cambios: reputación, 2 que das y 3 que buscas, y «Tus cambios»', /Nuevo en los cambios/.test(tarjeta) && /2 cartas que das/.test(tarjeta) && /3 cartas que buscas/.test(tarjeta) && /Tus cambios/.test(tarjeta), tarjeta)
  check('  …y ya no hay sello ni chapa sueltos en la cabecera', (await page.locator('.perfil-confianza, .perfil-chapa-cambia').count()) === 0)
  // 1273: la cabecera ancha, con la franja de progreso, y la columna de la derecha.
  const col = await page.evaluate(() => {
    const r = (s) => document.querySelector(s).getBoundingClientRect()
    return { hero: Math.round(r('#profileHero').width), tabsR: r('#profileTabs').right, trL: r('#perfilTrueque').left, segTop: r('#perfilSeguidores').top, trBottom: r('#perfilTrueque').bottom, pegada: getComputedStyle(document.querySelector('.perfil-lado')).position }
  })
  check('1273: la cabecera a lo ancho; cambios y seguidores en la columna de la derecha, quieta', col.hero > 1000 && col.trL > col.tabsR && col.segTop > col.trBottom - 1 && col.pegada === 'sticky', JSON.stringify(col))
  const franja = await page.evaluate(() => ({
    nivel: document.querySelector('#franjaNivel .pf-nivel-l')?.textContent.replace(/\s+/g, ' ').trim(),
    barra: document.querySelector('#franjaNivel .pf-barra i')?.style.getPropertyValue('--pct'),
    racha: document.getElementById('franjaRacha')?.textContent.replace(/\s+/g, ' ').trim(),
    logros: document.getElementById('franjaLogros')?.textContent.replace(/\s+/g, ' ').trim(),
    arroba: document.querySelector('#heroInfo .perfil-arroba')?.textContent.replace(/\s+/g, ' ').trim(),
    una: new Set([...document.querySelectorAll('#franjaNivel .pf-nivel-l > *')].map((e) => Math.round(e.getBoundingClientRect().top + e.getBoundingClientRect().height / 2))).size === 1,
  }))
  check('  …la franja: «Experto · 4.820 / 6.000 XP · 1.180 XP para As» en UNA línea, con su barra', /Experto/.test(franja.nivel) && /4\.820 \/ 6\.000 XP/.test(franja.nivel) && /1\.180 XP para As/.test(franja.nivel) && franja.una && Number(franja.barra) > 0, JSON.stringify(franja))
  check('  …racha (12 días) y logros (4 de N)', /12 días/.test(franja.racha) && /^Logros\s*4 de \d+/.test(franja.logros), JSON.stringify(franja))
  check('  …y «En PokeDoc desde marzo de 2026» al lado del @', /@Ash · En PokeDoc desde marzo de 2026/.test(franja.arroba), franja.arroba)
  const letra = await page.evaluate(() => ({ tab: parseFloat(getComputedStyle(document.querySelector('#profileTabs .tab-btn')).fontSize), titulo: parseFloat(getComputedStyle(document.querySelector('#perfilResumen .pr-cab h3')).fontSize), nombre: parseFloat(getComputedStyle(document.querySelector('#heroInfo h1')).fontSize) }))
  check('  …a tamaño de PC: pestañas a 13 (en su cápsula, 1299), títulos del Resumen a 20 y el nombre a 34', letra.tab === 13 && letra.titulo === 20 && letra.nombre === 34, JSON.stringify(letra))
  // 1271: se entra por el Resumen.
  const pest = await page.$$eval('#profileTabs .tab-btn:not([hidden])', (bs) => bs.map((x) => `${x.dataset.ptab}:${[...x.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim()}${x.classList.contains('active') ? '*' : ''}`))
  check('1271: las pestañas empiezan por «Resumen» (abierta) y la Vitrina se llama «Colección»', pest[0] === 'resumen:Resumen*' && pest[1] === 'vitrina:Colección', pest.join(' | '))
  const resumen = await texto(page, '#perfilResumen')
  check('  …el Resumen: tu vitrina, tu último torneo, lo último del foro y tus logros', /Vitrina/.test(resumen) && /Tu último torneo/.test(resumen) && /En el foro/.test(resumen) && /Logros/.test(resumen) && (await page.locator('#perfilResumen .pr-cartas img').count()) >= 1, resumen)
  await page.locator('#perfilResumen [data-pr-ver="torneos"]').click()
  await page.waitForTimeout(800)
  check('  …y su «Torneos ›» abre la pestaña, con tres cifras arriba', (await page.locator('[data-ptab="torneos"]').getAttribute('class')).includes('active') && /torneos?/.test(await texto(page, '#misTorneos .perfil-tres-cifras')) && /mejor puesto/.test(await texto(page, '#misTorneos .perfil-tres-cifras')), await texto(page, '#misTorneos .perfil-tres-cifras'))
  if (OUT) await page.screenshot({ path: `${OUT}/1270-perfil-pc.png` })
  await ctx.close()
}

console.log('── 2. Tu perfil en el móvil ──')
{
  const { ctx, page, errores } = await abrir('/perfil.html', true)
  check('sin errores', errores.length === 0, errores.join(' | '))
  const orden = await page.evaluate(() => ['#profileHero', '#profileStats', '#perfilTrueque', '#profileTabs'].map((s) => Math.round(document.querySelector(s).getBoundingClientRect().top)))
  check('en una columna: quién es, las losas, la tarjeta de cambios y las pestañas', orden.every((y, i) => i === 0 || y > orden[i - 1]), orden.join(' < '))
  check('  …sin desbordar de lado', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
  const fila = await page.evaluate(() => { const a = document.getElementById('franjaRacha').getBoundingClientRect(), b = document.getElementById('btnShowFollowing').getBoundingClientRect(); return Math.abs((a.top + a.height / 2) - (b.top + b.height / 2)) < 8 && !document.getElementById('perfilSeguidores').getBoundingClientRect().height })
  check('  …1273: la racha y los seguidores en UNA fila, y sin la tarjeta de seguidores', fila)
  if (OUT) await page.screenshot({ path: `${OUT}/1270-perfil-movil.png` })
  await ctx.close()
}

console.log('── 3. El perfil de otra persona ──')
{
  const { ctx, page, errores } = await abrir('/usuario/Misty', false)
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('su resumen: su último torneo, el foro y sus logros', /Su último torneo/.test(await texto(page, '#perfilResumen')) && /En el foro/.test(await texto(page, '#perfilResumen')))
  check('1273: Seguir, Mensaje y Proponer arriba; la tarjeta de cambios sin su Proponer', (await page.locator('#btnProponerCambio').isVisible()) && !(await page.locator('#perfilTrueque [data-pt-proponer]').isVisible().catch(() => false)))
  check('el logro destacado ya no va en la cabecera', (await page.locator('#heroInfo .perfil-logro-chapa').count()) === 0)
  await page.click('#profileTabs [data-ptab="logros"]')
  await page.waitForTimeout(400)
  check('  …va arriba de Logros, en grande, si lo tiene', (await page.locator('#logroDestacado').isHidden()) || /Su logro destacado/.test(await texto(page, '#logroDestacado')))
  await page.click('#profileTabs [data-ptab="guides"]')
  await page.waitForTimeout(400)
  check('sus guías, en portadas (o su frase si no tiene)', (await page.locator('#publishedGuides .guia-tarjeta').count()) > 0 || /Todavía no tiene guías/.test(await texto(page, '#publishedGuides')))
  check('los títulos que repetían la pestaña, solo para el lector', await page.$eval('#ptab-foro .section-title', (h) => h.classList.contains('sr-only')))
  await ctx.close()
}

console.log('── 4. Lo de fuera ──')
{
  const sql = readFileSync(`${RAIZ}/js/perfil-trueque.js`, 'utf8')
  check('la tarjeta usa la reputación de siempre (reputacionDe, nivelDe, textoDeConfianza)', /reputacionDe/.test(sql) && /nivelDe/.test(sql) && /textoDeConfianza/.test(sql))
  check('ponerSello y ponerChapa ya no existen', !/export async function ponerSello/.test(readFileSync(`${RAIZ}/js/cambios-hechos.js`, 'utf8')) && !/function ponerChapa/.test(readFileSync(`${RAIZ}/js/perfil-cambios.js`, 'utf8')))
}

await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
