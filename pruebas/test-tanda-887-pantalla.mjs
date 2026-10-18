// Tanda 887 — la pestaña «Cambios» del perfil: lo que da y lo que busca.
//
// soyfedeegb (foro): «visualizar las cartas buscadas y disponibles para
// trade por los demás usuarios en su perfil». PINGU: «adelante con la A,
// con cifras». Lo que se mira:
//   1. Lo puro: una baldosa por carta, la chapa, los sellos.
//   2. La base: intercambios_de_persona sobre el fixture del Mercado.
//   3. La pantalla: en la ficha de otra persona la pestaña sale con su
//      cuenta y la chapa «Cambia · da N · busca M»; las dos rejillas con sus
//      sellos («La buscas», «La das», «La tienes»); vuestro cruce arriba con
//      «Escribir» y el mensaje redactado; sin cuenta, las rejillas y la
//      invitación; sin nada, ni pestaña ni chapa; en tu perfil, vacía con
//      sus dos caminos; sin la migración, lo que busca y el aviso.
//   4. «Su perfil» desde el Mercado y Cruces abre ?ver=cambios.
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const AQUI = dirname(fileURLToPath(import.meta.url))
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const leer = (p) => readFileSync(`${RAIZ}/${p}`, 'utf8')

console.log('── 1. Lo puro ──')
{
  const m = await import(`${RAIZ}/js/perfil-cambios-puro.js`)
  const filas = m.porCarta([
    { card_id: 'a', market: 'WEST', idioma: 'es', estado: 'NM', cambio: 1 },
    { card_id: 'a', market: 'WEST', idioma: 'en', estado: 'NM', cambio: 2 },
    { card_id: 'b', market: 'JP', idioma: 'ja', estado: 'LP', cambio: 1 },
  ])
  check('dos copias de la misma carta son UNA baldosa con la suma y los dos idiomas', filas.length === 2 && filas[0].total === 3 && filas[0].idiomas.join() === 'es,en', JSON.stringify(filas))
  check('  …y la japonesa conserva su mercado', filas[1].market === 'JP')
  check('la chapa: «Cambia · da 12 · busca 30»', m.textoDeChapa({ da: 12, busca: 30 }) === 'Cambia · da 12 · busca 30')
  check('  …solo una de las dos si la otra es cero', m.textoDeChapa({ da: 0, busca: 3 }) === 'Cambia · busca 3' && m.textoDeChapa({ da: 2, busca: 0 }) === 'Cambia · da 2')
  check('  …y nada con nada', m.textoDeChapa({ da: 0, busca: 0 }) === '')
  const da = { card_id: 'a', idiomas: ['es'] }
  check('«La buscas» si está en tu lista en cualquier idioma o en uno que dé', m.selloDeLoQueDa(da, [{ card_id: 'a', idioma: null }]) === 'La buscas' && m.selloDeLoQueDa(da, [{ card_id: 'a', idioma: 'es' }]) === 'La buscas')
  check('  …pero no si la buscas en otro idioma', m.selloDeLoQueDa(da, [{ card_id: 'a', idioma: 'en' }]) === null && m.selloDeLoQueDa(da, []) === null)
  const busca = { card_id: 'b', idiomas: [] }
  check('«La das» si la das; «La tienes» si solo la tienes', m.selloDeLoQueBusca(busca, [{ card_id: 'b', idioma: 'es', cambio: 1 }]) === 'La das' && m.selloDeLoQueBusca(busca, [{ card_id: 'b', idioma: 'es', cambio: 0 }]) === 'La tienes' && m.selloDeLoQueBusca(busca, []) === null)
  check('  …y si busca en inglés y tú das la española, solo «La tienes»', m.selloDeLoQueBusca({ card_id: 'b', idiomas: ['en'] }, [{ card_id: 'b', idioma: 'es', cambio: 1 }]) === 'La tienes')
}

console.log('\n── 2. La base ──')
{
  const SQL = leer('supabase-migration-887-cambios-perfil.sql')
  check('sin tablas temporales (631)', !/create\s+temp/i.test(SQL))
  check('la ve anon (el escaparate) y es security definer', /to anon, authenticated/.test(SQL) && /security definer/.test(SQL))
  const cuerpo = (SQL.match(/as \$\$([\s\S]*?)\$\$;/) || [])[1] || ''
  check('solo las columnas que se enseñan: nada de precio_compra, valor_manual ni notas', cuerpo.length > 50 && !/precio_compra|valor_manual|notas/.test(cuerpo))
  const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-q']
  const hay = spawnSync('psql', [...PG, '-c', 'select 1'], { encoding: 'utf8' })
  if (hay.status !== 0) console.log('   (no hay PostgreSQL en /var/tmp:5433 — la prueba de la base NO se ha corrido aquí)')
  else {
    spawnSync('psql', [...PG, '-f', join(AQUI, 'sql-mercado.sql')], { encoding: 'utf8', timeout: 60000 })
    const r = spawnSync('psql', [...PG, '-t', '-A', '-f', join(AQUI, 'sql-tanda-887-casos.sql')], { encoding: 'utf8', timeout: 60000 })
    const lineas = `${r.stdout}${r.stderr}`.split('\n').filter((l) => /^887 /.test(l))
    check('los casos se ejecutan', r.status === 0 && lineas.length === 6, (r.stderr || '').slice(0, 200))
    for (const l of lineas) check(l.slice(8), /^887 ok/.test(l))
  }
}

console.log('\n── 3. La pantalla ──')
// user-2 (otra persona) da dos cartas (una en dos idiomas) y busca tres;
// user-1 (quien mira) busca xy5-1 (que user-2 da) y da xy5-3 (que user-2
// busca) y tiene xy5-4 sin darla.
const semilla = ({ sesion, conCambios, sinRpc, propia }) => {
  window.__FAKE_SESSION__ = sesion
  window.__FAKE_PERFILES__ = [{ id: 'user-2', username: 'fede', display_name: 'soyfedeegb' }]
  window.__FAKE_SETS__ = [{ id: 'xy5', name: 'Duelos Primigenios', serie_id: 'xy', market: 'WEST' }]
  window.__FAKE_CARTAS__ = Array.from({ length: 5 }, (_, i) => ({ id: `xy5-${i + 1}`, market: 'WEST', set_id: 'xy5', local_id: String(i + 1), name: `Carta ${i + 1}`, name_es: `Carta ${i + 1}`, image_path: `x/${i}` }))
  const quien = propia ? 'user-1' : 'user-2'
  window.__FAKE_COLECCION__ = conCambios ? [
    { id: 'l1', user_id: quien, card_id: 'xy5-1', market: 'WEST', cantidad: 2, idioma: 'es', estado: 'NM', variante: 'normal', cambio: 1 },
    { id: 'l2', user_id: quien, card_id: 'xy5-1', market: 'WEST', cantidad: 1, idioma: 'en', estado: 'NM', variante: 'normal', cambio: 1 },
    { id: 'l3', user_id: quien, card_id: 'xy5-2', market: 'WEST', cantidad: 1, idioma: 'es', estado: 'LP', variante: 'normal', cambio: 1 },
    { id: 'l4', user_id: quien, card_id: 'xy5-5', market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', cambio: 0 },
    ...(propia ? [] : [
      { id: 'm1', user_id: 'user-1', card_id: 'xy5-3', market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', cambio: 1 },
      { id: 'm2', user_id: 'user-1', card_id: 'xy5-4', market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', cambio: 0 },
    ]),
  ] : []
  window.__FAKE_DESEOS__ = conCambios ? [
    { id: 'd1', user_id: quien, card_id: 'xy5-3', idioma: null },
    { id: 'd2', user_id: quien, card_id: 'xy5-4', idioma: 'es' },
    { id: 'd3', user_id: quien, card_id: 'xy5-5', idioma: 'en' },
    ...(propia ? [] : [{ id: 'd4', user_id: 'user-1', card_id: 'xy5-1', idioma: null }]),
  ] : []
  if (sinRpc) window.__RPC_ERRORES__ = { intercambios_de_persona: { code: 'PGRST202', message: 'Could not find the function public.intercambios_de_persona' } }
}
const browser = await chromium.launch()
async function abrir(ruta, { sesion = 'user-1', conCambios = true, sinRpc = false, propia = false, movil = false } = {}) {
  const ctx = await browser.newContext(movil ? { ...devices['iPhone 13'], locale: 'es-ES' } : { viewport: { width: 1280, height: 1000 }, locale: 'es-ES' })
  await ctx.addInitScript(semilla, { sesion, conCambios, sinRpc, propia })
  const page = await ctx.newPage()
  await page.route(/assets\.tcgdex\.net/, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64') }))
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  return { page, ctx, errores }
}
const ve = (page, sel) => page.locator(sel).first().isVisible().catch(() => false)

{
  const { page, ctx, errores } = await abrir('/usuario.html?id=user-2')
  check('sin errores de JavaScript', !errores.length, errores.join(' | '))
  check('la pestaña Cambios sale, con su cuenta (2 da + 3 busca = 5)', await ve(page, '[data-ptab="cambios"]') && (await page.locator('[data-ptab="cambios"] .pest-cuenta').innerText()) === '5', await page.locator('[data-ptab="cambios"]').innerText().catch(() => ''))
  check('  …y es la que se abre: sin vitrina, lo que da y busca es lo que más dice', await page.locator('[data-ptab="cambios"]').evaluate((b) => b.classList.contains('active')))
  check('la chapa de la cabecera: «Cambia · da 2 · busca 3»', /Cambia · da 2 · busca 3/.test(await page.locator('.perfil-chapa-cambia').innerText().catch(() => '')), await page.locator('.perfil-chapa-cambia').innerText().catch(() => 'sin chapa'))
  check('«Da 2 cartas» con dos baldosas', /Da 2 cartas/.test(await page.locator('#perfilCambios').innerText()) && (await page.locator('#pcRejillaDa .pc-carta').count()) === 2)
  const primera = await page.locator('#pcRejillaDa .pc-carta').first().innerText()
  check('  …la de dos idiomas dice «Da 2 · Español, Inglés · Near Mint»', /Da 2 · Español, Inglés · Near Mint/.test(primera), primera)
  check('  …con el sello «La buscas» (está en mi lista)', /La buscas/.test(primera))
  check('  …y la foto enlaza a la ficha de la carta', /\/carta/.test(await page.locator('#pcRejillaDa .pc-carta-foto').first().getAttribute('href')))
  check('«Busca 3 cartas» con tres baldosas', /Busca 3 cartas/.test(await page.locator('#perfilCambios').innerText()) && (await page.locator('#pcRejillaBusca .pc-carta').count()) === 3)
  const sellos = await page.locator('#pcRejillaBusca .pc-sello').allInnerTexts()
  check('  …«La das» en la que doy y «La tienes» en la que solo tengo; nada en la otra', sellos.join() === 'La das,La tienes', sellos.join())
  check('  …y la que busca en un idioma lo dice', /Inglés/.test(await page.locator('#pcRejillaBusca .pc-carta').nth(2).innerText()))
  await page.waitForTimeout(800)
  const cruce = await page.locator('#pcCruce').innerText().catch(() => '')
  check('arriba, vuestro cruce: te puede dar 1 y le puedes dar 1', /Te puede dar · 1/.test(cruce) && /Le puedes dar · 1/.test(cruce), cruce.slice(0, 200))
  const escribir = await page.locator('#pcCruce a.btn-primary').getAttribute('href').catch(() => '')
  check('  …con «Escribir» a la conversación y el mensaje redactado (las dos listas)', /mensajes\.html\?with=user-2&texto=/.test(escribir || '') && /Das%20estas%20cartas/.test(escribir || '') && /que%20tengo%20para%20cambio/.test(escribir || ''), escribir)
  // La chapa abre la pestaña.
  await page.locator('[data-ptab="guides"]').click()
  await page.locator('.perfil-chapa-cambia').click()
  await page.waitForTimeout(200)
  check('la chapa de arriba abre la pestaña', await page.locator('[data-ptab="cambios"]').evaluate((b) => b.classList.contains('active')))
  await ctx.close()
}
{
  const { page, ctx } = await abrir('/usuario.html?id=user-2&ver=cambios', { sesion: 'none' })
  check('sin cuenta: la pestaña y las rejillas se ven igual', (await page.locator('#pcRejillaDa .pc-carta').count()) === 2 && (await page.locator('#pcRejillaBusca .pc-carta').count()) === 3)
  check('  …sin sellos ni cruce, con la invitación a entrar', (await page.locator('#perfilCambios .pc-sello').count()) === 0 && (await page.locator('#pcCruce').count()) === 0 && /Entra/.test(await page.locator('.pc-entra').innerText().catch(() => '')), `${await page.locator('#perfilCambios .pc-sello').count()} sellos · ${await page.locator('#pcCruce').count()} cruce · ${(await page.locator('#perfilCambios').innerText()).slice(0, 120)}`)
  check('  …y ?ver=cambios la abre', await page.locator('[data-ptab="cambios"]').evaluate((b) => b.classList.contains('active')))
  await ctx.close()
}
{
  const { page, ctx } = await abrir('/usuario.html?id=user-2', { conCambios: false })
  check('sin nada que cambiar: ni pestaña ni chapa', (await page.locator('[data-ptab="cambios"]').evaluate((b) => b.hidden)) && (await page.locator('.perfil-chapa-cambia').count()) === 0)
  check('  …y se abre otra', !(await page.locator('[data-ptab="cambios"]').evaluate((b) => b.classList.contains('active'))))
  await ctx.close()
}
{
  const { page, ctx } = await abrir('/usuario.html?id=user-2&ver=cambios', { sinRpc: true })
  check('sin la migración: lo que busca sí, y lo que da avisa con el nombre del fichero', (await page.locator('#pcRejillaBusca .pc-carta').count()) === 3 && /supabase-migration-887-cambios-perfil\.sql/.test(await page.locator('#perfilCambios').innerText()))
  check('  …y la cuenta solo cuenta lo que se ve (3)', (await page.locator('[data-ptab="cambios"] .pest-cuenta').innerText()) === '3')
  await ctx.close()
}
{
  const { page, ctx, errores } = await abrir('/perfil.html?ver=cambios', { propia: true, conCambios: false })
  check('tu perfil sin nada: la pestaña sale igual, vacía, con sus dos caminos', !errores.length && await ve(page, '[data-ptab="cambios"]') && (await page.locator('#perfilCambios a[href="/mi-coleccion?ver=cambios"]').count()) === 1 && (await page.locator('#perfilCambios a[href="/mi-coleccion?ver=quiero"]').count()) === 1, errores.join(' | '))
  await ctx.close()
}
{
  const { page, ctx } = await abrir('/perfil.html?ver=cambios', { propia: true })
  check('tu perfil con cambios: «Das 2 cartas» y «Buscas 3 cartas», sin sellos', /Das 2 cartas/.test(await page.locator('#perfilCambios').innerText()) && /Buscas 3 cartas/.test(await page.locator('#perfilCambios').innerText()) && (await page.locator('#perfilCambios .pc-sello').count()) === 0)
  await ctx.close()
}
{
  const { page, ctx } = await abrir('/usuario.html?id=user-2&ver=cambios', { movil: true })
  const ancho = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)
  check('en el móvil, tres por fila y sin desbordar', ancho && (await page.locator('#pcRejillaDa .pc-carta').first().boundingBox())?.width < 140)
  await ctx.close()
}
await browser.close()

console.log('\n── 4. Los caminos ──')
{
  check('«Su perfil» del Mercado abre la pestaña', /profileUrl\(p\)\)\}\?ver=cambios">Su perfil/.test(leer('js/mi-coleccion/mercado.js')))
  check('  …y el de Cruces también', /profileUrl\(p\)\)\}\?ver=cambios">Su perfil/.test(leer('js/mi-coleccion/tablon.js')))
  check('la pestaña está en las dos fichas, escondida hasta que haya algo', /data-ptab="cambios"[^>]*hidden/.test(leer('usuario.html')) && /data-ptab="cambios"[^>]*hidden/.test(leer('perfil.html')))
  check('la hoja entra inyectada (no la baja la portada)', /hojaInyectada\('css\/perfil-cambios\.css'\)/.test(leer('js/perfil-cambios.js')))
}

console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
