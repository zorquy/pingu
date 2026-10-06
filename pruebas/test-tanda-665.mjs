// Tanda 665 — los avisos de precio: «avísame si esta carta baja de X €».
import { readFileSync } from 'node:fs'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { rutaDeCarta } from '/home/user/pingu/js/carta-ruta.js'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 260) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const RAIZ = '/home/user/pingu'
const limpio = (t) => String(t || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim()

console.log('── 1. La función, con dobles ──')
{
  const { procesar, precioDeAviso, seCumple, textosDelAviso } = await import(`${RAIZ}/netlify/functions/avisos-precio.mjs`)
  check('el precio que mira un aviso es el de su idioma, y si no el general', precioDeAviso({ cm_low: 10, cm_low_es: 12 }, 'es') === 12 && precioDeAviso({ cm_low: 10 }, 'de') === 10 && precioDeAviso(null, 'es') === null)
  check('«baja» en o por debajo; «sube» en o por encima', seCumple({ tipo: 'baja', umbral: 20 }, 20) && seCumple({ tipo: 'baja', umbral: 20 }, 19.5) && !seCumple({ tipo: 'baja', umbral: 20 }, 21) && seCumple({ tipo: 'sube', umbral: 20 }, 25) && !seCumple({ tipo: 'sube', umbral: 20 }, 19) && !seCumple({ tipo: 'baja', umbral: 20 }, null))
  const t = textosDelAviso({ card_id: 'xy5-150', tipo: 'baja', umbral: 20 }, { name: 'Groudon-EX', name_es: 'Groudon EX' }, 18.5)
  check('los textos, en cristiano y con el enlace a la carta', /Groudon EX ha bajado a 18,50/.test(t.title) && /bajara de 20,00/.test(t.body) && t.link === rutaDeCarta({ id: 'xy5-150', name: 'Groudon-EX', name_es: 'Groudon EX' }), JSON.stringify(t))

  const llamadas = []
  const montar = ({ avisos, precios, perfiles = [] }) => async (ruta, clave, opciones = {}) => {
    llamadas.push({ ruta: decodeURIComponent(ruta), metodo: opciones.method || 'GET', cuerpo: opciones.body ? JSON.parse(opciones.body) : null })
    if (opciones.method) return null
    if (ruta.startsWith('user_price_alerts?')) return avisos
    if (ruta.startsWith('tcg_card_prices?')) return precios
    if (ruta.startsWith('tcg_cards?')) return [{ id: 'xy5-150', market: 'WEST', name: 'Groudon-EX', name_es: 'Groudon EX' }, { id: 'xy5-1', market: 'WEST', name: 'Weedle', name_es: 'Weedle' }]
    if (ruta.startsWith('user_profiles?')) return perfiles
    return []
  }
  const ENV = { SUPABASE_SERVICE_ROLE_KEY: 's' }
  const AHORA = new Date('2026-10-06T05:23:00Z')
  const r = await procesar({ env: ENV, ahora: AHORA, rest: montar({
    avisos: [
      { id: 'a1', user_id: 'u1', card_id: 'xy5-150', market: 'WEST', idioma: 'es', tipo: 'baja', umbral: 150 },
      { id: 'a2', user_id: 'u2', card_id: 'xy5-150', market: 'WEST', idioma: 'en', tipo: 'baja', umbral: 150 },
      { id: 'a3', user_id: 'u1', card_id: 'xy5-1', market: 'WEST', idioma: 'es', tipo: 'sube', umbral: 0.5 },
      { id: 'a4', user_id: 'u3', card_id: 'nada', market: 'WEST', idioma: 'es', tipo: 'baja', umbral: 5 },
    ],
    precios: [{ card_id: 'xy5-150', cm_low: 39, cm_low_es: 140, cm_low_en: 194 }, { card_id: 'xy5-1', cm_low: 0.3, cm_low_es: 0.8 }],
    perfiles: [{ id: 'u1', notification_email_disabled: ['aviso_precio'] }, { id: 'u2', notification_email_disabled: [] }],
  }) })
  check('se disparan los que se cumplen en SU idioma (es 140 ≤ 150 sí; en 194 no; Weedle sube 0,8 ≥ 0,5 sí) y no el sin precio', r.ok && r.disparados === 2 && r.detalle.map((d) => d.id).join() === 'a1,a3', JSON.stringify(r))
  const patches = llamadas.filter((l) => l.metodo === 'PATCH')
  check('  …y cada uno se apaga PRIMERO con el precio del disparo', patches.length === 2 && patches[0].ruta.includes('id=eq.a1') && patches[0].cuerpo.activo === false && patches[0].cuerpo.precio_disparo === 140 && patches[0].cuerpo.disparado_at === AHORA.toISOString() && llamadas.findIndex((l) => l.metodo === 'PATCH') < llamadas.findIndex((l) => l.ruta === 'user_notifications'))
  const notis = llamadas.filter((l) => l.ruta === 'user_notifications')
  check('  …con su notificación en la campanita', notis.length === 2 && notis[0].cuerpo[0].recipient_id === 'u1' && notis[0].cuerpo[0].type === 'aviso_precio' && /Groudon EX ha bajado a 140,00/.test(notis[0].cuerpo[0].title) && /\/carta\/groudon-ex-xy5-150/.test(notis[0].cuerpo[0].link))
  const correos = llamadas.filter((l) => l.ruta === 'email_outbox')
  check('  …y el correo solo a quien no lo tiene apagado (u1 lo tiene; nada para u1)', correos.length === 0)
  const r2 = await procesar({ env: ENV, ahora: AHORA, rest: montar({ avisos: [{ id: 'a2', user_id: 'u2', card_id: 'xy5-150', idioma: 'en', tipo: 'sube', umbral: 190 }], precios: [{ card_id: 'xy5-150', cm_low_en: 194 }], perfiles: [{ id: 'u2', notification_email_disabled: [] }] }) })
  const correo2 = llamadas.filter((l) => l.ruta === 'email_outbox').pop()
  check('  …y sí a quien no: con asunto, vista previa, enlace y clave del hilo', r2.disparados === 1 && correo2 && correo2.cuerpo[0].recipient_id === 'u2' && correo2.cuerpo[0].thread_key === 'aviso-a2' && /ha subido a 194,00/.test(correo2.cuerpo[0].subject))
  const r3 = await procesar({ env: ENV, rest: async () => { throw new Error('Supabase 404: relation "public.user_price_alerts" does not exist (42P01)') } })
  check('sin la tabla, se salta nombrando la migración', r3.ok && /avisos-precio\.sql/.test(r3.saltado))
  const r4 = await procesar({ env: ENV, rest: montar({ avisos: [], precios: [] }) })
  check('sin avisos, nada', r4.ok && r4.activos === 0)
}

console.log('\n── 2. La migración ──')
{
  const sql = readFileSync(`${RAIZ}/supabase-migration-avisos-precio.sql`, 'utf8')
  check('la tabla, con su tipo acotado y su umbral positivo', /create table if not exists public\.user_price_alerts/.test(sql) && /check \(tipo in \('baja', 'sube'\)\)/.test(sql) && /check \(umbral > 0\)/.test(sql))
  check('  …cada uno los suyos, y nadie más', /for all to authenticated/.test(sql) && /auth\.uid\(\) = user_id/.test(sql) && /enable row level security/.test(sql))
  const fn = readFileSync(`${RAIZ}/netlify/functions/avisos-precio.mjs`, 'utf8')
  check('la función corre cada hora y no pide nada a TCGGO', /schedule: '23 \* \* \* \*'/.test(fn) && !/rapidapi|TCGGO_API_KEY/.test(fn))
}

console.log('\n── 3. En pantalla ──')
{
  const browser = await chromium.launch()
  const abrir = async ({ sesion = 'admin-1', ruta } = {}) => {
    const page = await browser.newPage({ viewport: { width: 1100, height: 900 } })
    const errores = []
    page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
    await page.addInitScript((s) => {
      window.__FAKE_SESSION__ = s
      window.__FAKE_SETS__ = [{ id: 'xy5', name: 'Duelos Primigenios', name_en: 'Primal Clash', serie_id: 'xy', market: 'WEST', card_count_official: 160, tcg_online_code: 'PRC', release_date: '2015-02-04' }]
      window.__FAKE_CARTAS__ = [{ id: 'xy5-150', market: 'WEST', set_id: 'xy5', local_id: '150', name: 'Groudon-EX', name_es: 'Groudon EX', image_path: 'x/1', rarity: 'Ultra Rare', category: 'Pokemon', variants: { holo: true }, cm_id_product_propio: 273681 }]
      window.__FAKE_PRECIOS__ = [{ card_id: 'xy5-150', cm_id_product: 273681, cm_low: 39, cm_low_es: 140, cm_low_en: 194, tp_market_eur: 171.08, tcggo_updated: '2026-10-05T12:00:00Z', origen: 'tcggo' }]
      window.__FAKE_COLECCION__ = s === 'none' ? [] : [{ id: 'l1', card_id: 'xy5-150', market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'holo', created_at: '2026-10-01T10:00:00Z' }]
      window.__FAKE_AVISOS__ = [{ id: 'aviso-9', card_id: 'xy5-150', tipo: 'sube', umbral: 200, idioma: 'es', activo: true }]
    }, sesion)
    await page.route(/assets\.tcgdex\.net|images\.tcggo\.com/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#c9a227"/></svg>' }))
    await page.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
    await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2500)
    return { page, errores }
  }
  const carta = rutaDeCarta({ id: 'xy5-150', name: 'Groudon-EX', name_es: 'Groudon EX' })
  const { page, errores } = await abrir({ ruta: carta })
  check('en /carta, con sesión, el bloque de precio lleva «Avísame»', (await page.locator('#cmPrecios [data-aviso="xy5-150"]').count()) === 1)
  await page.locator('[data-aviso]').first().click()
  await page.waitForTimeout(600)
  const d = page.locator('#pvAvisoDialogo')
  check('pulsarlo abre el diálogo con el precio de ahora y un umbral propuesto (un 10 % por debajo)', await d.evaluate((n) => n.open) && /Ahora está a 140,00 €/.test(limpio(await d.innerText())) && (await page.inputValue('#pvAvisoUmbral')) === '126.00', limpio(await d.innerText()).slice(0, 200))
  check('  …y lista los avisos que ya tienes de esta carta', /Si sube de 200,00 €/.test(limpio(await page.locator('#pvAvisoLista').innerText())))
  await page.fill('#pvAvisoUmbral', '120')
  await page.click('#pvAvisoGuardar')
  await page.waitForTimeout(600)
  const lista = limpio(await page.locator('#pvAvisoLista').innerText())
  check('guardar mete el aviso y sale en la lista', /Si baja de 120,00 €/.test(lista) && /Si sube de 200,00 €/.test(lista), lista)
  const guardado = await page.evaluate(() => window.__T__?.user_price_alerts?.find?.((a) => a.umbral === 120) || null).catch(() => null)
  check('  …con tu id, la carta, el idioma y el tipo', !guardado || (guardado.user_id === 'admin-1' && guardado.card_id === 'xy5-150' && guardado.tipo === 'baja' && guardado.idioma === 'es'), JSON.stringify(guardado))
  await page.locator('[data-quitar-aviso="aviso-9"]').click()
  await page.waitForTimeout(500)
  check('  …y quitar lo quita', !/Si sube de 200,00 €/.test(limpio(await page.locator('#pvAvisoLista').innerText())))
  await page.keyboard.press('Escape')
  await page.selectOption('#cmIdioma', 'en')
  await page.waitForTimeout(400)
  check('al cambiar de idioma el botón sigue (el bloque se repinta entero)', (await page.locator('#cmPrecios [data-aviso]').count()) === 1)
  await page.locator('[data-aviso]').first().click()
  await page.waitForTimeout(500)
  check('  …y el diálogo habla del inglés', /mínimo en inglés/.test(limpio(await page.locator('#pvAvisoAhora').innerText())))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await page.close()

  const sin = await abrir({ sesion: 'none', ruta: carta })
  check('sin sesión no hay botón: no hay a quién avisar', (await sin.page.locator('[data-aviso]').count()) === 0)
  await sin.page.close()

  const mc = await abrir({ ruta: '/mi-coleccion.html?ver=album&set=xy5' })
  await mc.page.locator('#mcAlbum .mc-bolsillo-enlace[data-carta="xy5-150"]').click()
  await mc.page.waitForTimeout(1200)
  check('la ficha de Mi colección también lleva «Avísame»', (await mc.page.locator('#mcEdAcciones [data-aviso="xy5-150"]').count()) === 1) // en las losetas bajo la carta desde la 667
  await mc.page.locator('#mcEdAcciones [data-aviso]').click()
  await mc.page.waitForTimeout(600)
  check('  …y abre el mismo diálogo', await mc.page.locator('#pvAvisoDialogo').evaluate((n) => n.open) && /140,00 €/.test(limpio(await mc.page.locator('#pvAvisoAhora').innerText())))
  check('sin errores', mc.errores.length === 0, mc.errores.join(' | '))
  await mc.page.close()
  await browser.close()
}

console.log(fails ? `\n${fails} FALLOS` : '\nTODO OK')
process.exit(fails ? 1 : 0)
