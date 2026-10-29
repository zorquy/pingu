// Tanda 1110 — la etiqueta del envío (PINGU: «podría generar una etiqueta de
// envío, con los datos que da y con los datos que yo tengo»).
//
// Lo que se mira:
//   · lo puro: destinatario, remitente (o hueco), cómo va y qué lleva;
//   · un cambio por certificado: Lucía ve «Etiqueta» al lado de Copiar en
//     «Envía a Admin», y baja un PDF A4 con la etiqueta dibujada;
//   · una venta ordinaria con Admin sin dirección guardada: la etiqueta sale
//     igual, con el remitente para escribir a mano, y lo dice;
//   · en el móvil el botón cabe.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 280) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const CAPS = process.env.PD_CAPS || ''

const SETS = [
  { id: 'swsh7', name: 'Cielos Evolutivos', serie_id: 'swsh', market: 'WEST', release_date: '2021-08-27', card_count_official: 203 },
  { id: 'sv3pt5', name: '151', serie_id: 'sv', market: 'WEST', release_date: '2023-09-22', card_count_official: 165, tcg_online_code: 'MEW' },
  { id: 'sv8', name: 'Chispas Fulgurantes', serie_id: 'sv', market: 'WEST', release_date: '2024-11-08', card_count_official: 191 },
  { id: 'sv2', name: 'Evoluciones en Paldea', serie_id: 'sv', market: 'WEST', release_date: '2023-06-09', card_count_official: 193 },
  { id: 'SV2a', name: 'ポケモンカード151', name_en: 'Pokémon Card 151', serie_id: 'sv', market: 'JP', release_date: '2023-06-16', card_count_official: 165 },
]
const setDe = (id) => SETS.find((s) => s.id === id)
const carta = (id, set, n, nombre, extra = {}) => ({ id, market: setDe(set).market, set_id: set, local_id: String(n), name: nombre, name_es: nombre, image_path: `x/${id}`, rarity: 'Rare', category: 'Pokemon', variants: { normal: true }, tcg_sets: { id: set, name: setDe(set).name, serie_id: setDe(set).serie_id, release_date: setDe(set).release_date }, ...extra })
const CARTAS = [carta('swsh7-215', 'swsh7', 215, 'Umbreon VMAX'), carta('sv3pt5-199', 'sv3pt5', 199, 'Charizard ex'), carta('sv8-238', 'sv8', 238, 'Pikachu ex'), carta('sv2-269', 'sv2', 269, 'Iono'), carta('sv3pt5-151', 'sv3pt5', 151, 'Mew ex'), carta('swsh7-1', 'swsh7', 1, 'Mew'), carta('SV2a-201', 'SV2a', 201, 'リザードン', { name_en: 'Charizard' })]
const U = (n) => `user-${n}`
const PERFILES = [{ id: 'admin-1', username: 'pingu' }, { id: U(1), username: 'lucia_tcg', display_name: 'Lucía' }, { id: U(2), username: 'danipoke', display_name: 'Dani' }, { id: U(3), username: 'marta.jp', display_name: 'Marta' }, { id: U(4), username: 'iker_ex', display_name: 'Íker' }, { id: U(5), username: 'malo', is_banned: true }]
const hace = (h) => new Date(Date.now() - h * 3600e3).toISOString()
const linea = (id, user, card, idioma, cambio, h, o = {}) => ({ id, user_id: user, card_id: card, market: card.startsWith('SV2a') ? 'JP' : 'WEST', cantidad: Math.max(1, cambio), cambio, idioma, estado: 'NM', variante: 'normal', created_at: '2026-10-01T10:00:00Z', updated_at: hace(h), ...o })
// Yo (admin-1) doy Mew ex; Lucía busca Mew ex, así que con ella hay cruce.
const COLECCION = [
  linea('m1', 'admin-1', 'sv3pt5-151', 'es', 1, 1),
  linea('o1', U(1), 'swsh7-215', 'es', 1, 2), linea('o2', U(4), 'swsh7-215', 'en', 1, 3), linea('o3', U(2), 'sv3pt5-199', 'es', 1, 5),
  linea('o4', U(2), 'sv2-269', 'es', 1, 6), linea('o5', U(3), 'sv2-269', 'fr', 2, 7), linea('o6', U(1), 'sv2-269', 'es', 1, 8),
  linea('o7', U(4), 'sv8-238', 'es', 1, 9), linea('o8', U(3), 'SV2a-201', 'ja', 1, 1),
  // La da un baneado y otra con cambio 0: ninguna de las dos sale.
  linea('o9', U(5), 'swsh7-1', 'es', 1, 1), linea('o10', U(4), 'swsh7-1', 'es', 0, 1),
]
const DESEOS = [{ id: 'd1', user_id: 'admin-1', card_id: 'swsh7-215', idioma: null, prioridad: 1, created_at: '2026-10-05T10:00:00Z' }, { id: 'd2', user_id: U(1), card_id: 'sv3pt5-151', idioma: null, prioridad: 1, created_at: '2026-10-05T10:00:00Z' }]
const PRECIOS = [{ card_id: 'sv3pt5-151', cm_low: 38 }, { card_id: 'swsh7-215', cm_low: 612 }, { card_id: 'sv3pt5-199', cm_low: 118.5 }, { card_id: 'sv8-238', cm_low: 84.9 }, { card_id: 'sv2-269', cm_low: 42 }]

const browser = await chromium.launch()
async function abrir({ movil = false, sesion = true, ancho = 1440, extra = {} } = {}) {
  // Sin service worker: el de la web (745) contesta antes que `route` y la
  // prueba no vería a dónde se va al escribir.
  const ctx = await browser.newContext({ ...(movil ? { ...devices['iPhone 13'] } : { viewport: { width: ancho, height: 900 } }), locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript((d) => {
    window.__FAKE_SESSION__ = d.sesion ? 'admin-1' : 'none'
    window.__FAKE_SETS__ = d.SETS
    window.__FAKE_CARTAS__ = d.CARTAS
    window.__FAKE_COLECCION__ = d.COLECCION
    window.__FAKE_DESEOS__ = d.DESEOS
    window.__FAKE_PERFILES__ = d.PERFILES
    window.__FAKE_PRECIOS__ = d.PRECIOS
    Object.assign(window, d.extra)
    window.__FAKE_FILAS__ = { user_direcciones: [['admin-1', 'Pingu Admin', 'Av. Libertad 3', '41002', 'Sevilla'], ['user-1', 'Lucía Pérez Gil', 'C/ Mayor 12, 3.º B', '28013', 'Madrid']].map(([user_id, nombre, calle, cp, ciudad]) => ({ user_id, nombre, calle, cp, ciudad })), ...(window.__FAKE_FILAS__ || {}) }
  }, { SETS, CARTAS, COLECCION, DESEOS, PERFILES, PRECIOS, sesion, extra })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|jsdelivr|githubusercontent|scrydex/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#5b8fd1"/></svg>' }))
  await ctx.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  // A dónde se va al escribir o al registrarse, sin irse de verdad.
  await ctx.route(/\/(mensajes|auth)\.html/, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>fuera</title>' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  return { ctx, page, errores }
}
const ir = async (page, ruta = '/mi-coleccion.html?ver=mercado') => {
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
}
const baldosas = (page) => page.$$eval('#mcMercadoRejilla .mc-merc', (as) => as.map((a) => a.dataset.merc))
const textoDe = (page, id) => page.$eval(`#mcMercadoRejilla [data-merc="${id}"]`, (a) => a.innerText.replace(/\s+/g, ' ').trim())
const visible = (page, sel) => page.evaluate((sel) => { const e = document.querySelector(sel); return !!e && !e.closest('.hidden') && e.getBoundingClientRect().height > 0 }, sel)


const TABLAS_DEL_CAMBIO = ['trade_offers', 'trade_offer_items', 'conversations', 'conversation_participants', 'private_messages', 'user_collection', 'user_wants', 'user_notifications', 'trade_confirmations', 'trade_offer_direcciones', 'user_direcciones']
const foto = (page) => page.evaluate((ts) => Object.fromEntries(ts.map((t) => [t, window.__TABLAS__[t] || []])), TABLAS_DEL_CAMBIO)
// Abrir como otra persona con lo que dejó la anterior: el doble vive en la página.
async function abrirCon(tablas, sesion, opciones = {}) {
  const { user_collection: col, user_wants: des, ...resto } = tablas
  return abrir({ ...opciones, sesion: true, extra: { __FAKE_SESSION__: sesion, __FAKE_COLECCION__: col, __FAKE_DESEOS__: des, __FAKE_FILAS__: resto, ...(opciones.extra || {}) } })
}







const OUT = process.env.PD_CAPS || ''
const texto = (loc) => loc.textContent().then((t) => t.replace(/\s+/g, ' ')).catch(() => '')
// Desde la 1108 el envío se calcula: «correo» pulsa el de correo (sea cual
// sea) y `venta20` lo hace una venta de 20 € (ordinaria).
async function proponerYAceptar(envio, extra = {}, venta20 = false) {
  let t
  {
    const { ctx, page } = await abrir({ ancho: 1280, extra })
    await ir(page, '/mi-coleccion.html?ver=cambios')
    await page.locator('#mcCambiosPanel [data-cruce="user-1"] [data-proponer]').click()
    await page.waitForTimeout(1800)
    if (venta20) {
      await page.click('#cpDialogo [data-cp-modo="vendo"]')
      await page.locator('#cpTotal').fill('20')
      await page.locator('#cpTotal').dispatchEvent('change')
      await page.waitForTimeout(300)
    }
    await page.click('#cpEnviar')
    await page.waitForTimeout(1500)
    t = await foto(page)
    await ctx.close()
  }
  const { ctx, page } = await abrirCon(t, 'user-1', { ancho: 1280, extra })
  await ir(page, '/mi-coleccion.html?ver=cambios')
  const tj = page.locator('#mcMisCambios .cp-tarjeta').first()
  await tj.locator(envio === 'mano' ? '[data-cp-envio-elegir="mano"]' : '[data-cp-envio-elegir]:not([data-cp-envio-elegir="mano"])').click()
  await tj.locator('[data-cp-accion="aceptar"]').click()
  await page.waitForTimeout(1800)
  t = await foto(page)
  await ctx.close()
  return t
}

// Pulsar «Etiqueta» y quedarse con el PDF y el aviso.
async function bajarEtiqueta(page) {
  const [descarga] = await Promise.all([page.waitForEvent('download', { timeout: 8000 }), page.locator('#mcMisCambios .cp-t-envia [data-cp-etiqueta]').first().click()])
  const ruta = await descarga.path()
  const pdf = readFileSync(ruta)
  await page.waitForTimeout(400)
  const aviso = await page.locator('.toast').last().textContent().catch(() => '')
  return { nombre: descarga.suggestedFilename(), pdf, texto: pdf.toString('latin1'), aviso }
}

console.log('── 1. Lo puro ──')
{
  const m = await import(`${RAIZ}/js/cambio-etiqueta.js`)
  const para = { nombre: 'Lucía Pérez Gil', calle: 'C/ Mayor 12, 3.º B', cp: '28013', ciudad: 'Madrid', provincia: 'Madrid', telefono: '600111222' }
  const t = m.textosDeEtiqueta({ para, de: { nombre: 'Pingu', calle: 'Av. Libertad 3', cp: '41002', ciudad: 'Sevilla' }, envio: { tipo: 'certificado' }, cartas: 3, seguimiento: 'PK1' })
  check('certificado, con el nombre del destinatario primero', t.tipo === 'CERTIFICADO' && t.destinatario[0] === 'Lucía Pérez Gil' && t.destinatario.some((l) => /28013 Madrid/.test(l)), JSON.stringify(t.destinatario))
  check('el remitente y lo que lleva', t.remitente[0] === 'Pingu' && t.contenido === 'Contiene: 3 cartas coleccionables. No doblar.' && t.seguimiento === 'Seguimiento: PK1')
  const s = m.textosDeEtiqueta({ para, envio: { tipo: 'normal' }, cartas: 1 })
  check('sin remitente, hueco; ordinario; una carta en singular', s.remitente.length === 0 && s.tipo === 'ORDINARIO' && /1 carta coleccionable\./.test(s.contenido) && s.seguimiento === '')
}

console.log('── 2. Un cambio por certificado ──')
let tablas = await proponerYAceptar('correo')
{
  const { ctx, page, errores } = await abrirCon(tablas, 'user-1', { ancho: 1280 })
  await ir(page, '/mi-coleccion.html?ver=cambios')
  const envia = page.locator('#mcMisCambios .cp-t-envia').first()
  check('«Etiqueta» al lado de Copiar en «Envía a Admin»', /Envía a Admin/.test(await texto(envia)) && (await envia.locator('.cp-t-envia-botones [data-cp-copiar]').count()) === 1 && (await envia.locator('.cp-t-envia-botones [data-cp-etiqueta]').count()) === 1)
  if (OUT) await page.screenshot({ path: `${OUT}/etq-boton.jpg`, type: 'jpeg', quality: 72 })
  const e = await bajarEtiqueta(page)
  check('baja un PDF con nombre del destinatario', e.nombre === 'etiqueta-envio-pingu-admin.pdf' && e.pdf.subarray(0, 5).toString() === '%PDF-', e.nombre)
  check('una página A4 con la imagen a 8 px/mm', /\/MediaBox \[0 0 595\.2\d? 841\.8\d?\]/.test(e.texto) && /\/Width 1680 \/Height 2376/.test(e.texto) && (e.texto.match(/\/Type \/Page\b/g) || []).length === 1, (e.texto.match(/\/MediaBox[^\]]*\]/) || [''])[0])
  check('aviso de «imprímela y recórtala»', /imprímela y recórtala/.test(e.aviso), e.aviso)
  // Lo dibujado: el lienzo de esa etiqueta lleva tinta arriba (destinatario) y abajo (remitente).
  const tinta = await page.evaluate(async () => {
    const m = await import('/js/cambio-etiqueta.js')
    const c = await m.lienzoDeEtiqueta({ para: { nombre: 'Pingu Admin', calle: 'Av. Libertad 3', cp: '41002', ciudad: 'Sevilla' }, de: { nombre: 'Lucía', calle: 'C/ Mayor 12', cp: '28013', ciudad: 'Madrid' }, envio: { tipo: 'certificado' }, cartas: 1 })
    const ctx = c.getContext('2d')
    const oscuros = (y0, y1) => { const d = ctx.getImageData(88, y0, 664, y1 - y0).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] < 120) n++; return n }
    return { destino: oscuros(220, 330), remite: oscuros(760, 860), fuera: oscuros(1300, 2300) }
  })
  check('el destinatario y el remitente están dibujados, y fuera de la etiqueta nada', tinta.destino > 500 && tinta.remite > 200 && tinta.fuera === 0, JSON.stringify(tinta))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}
{
  const { ctx, page } = await abrirCon(tablas, 'admin-1', { movil: true })
  await ir(page, '/mi-coleccion.html?ver=cambios')
  const linea = page.locator('#mcMisCambios details.cp-linea').first()
  if (!(await linea.evaluate((d) => d.open))) await linea.locator('summary').click()
  const b = page.locator('#mcMisCambios .cp-t-envia [data-cp-etiqueta]').first()
  const caja = await b.boundingBox()
  const tarjeta = await page.locator('#mcMisCambios .cp-tarjeta').first().boundingBox()
  check('en el móvil cabe dentro de la tarjeta', caja && tarjeta && caja.x >= tarjeta.x && caja.x + caja.width <= tarjeta.x + tarjeta.width + 1 && caja.height >= 36, JSON.stringify({ caja, tarjeta }))
  if (OUT) await page.screenshot({ path: `${OUT}/etq-movil.jpg`, type: 'jpeg', quality: 72, fullPage: true })
  await ctx.close()
}

console.log('── 3. Venta ordinaria, sin dirección guardada ──')
{
  const t = await proponerYAceptar('correo', {}, true)
  t.user_direcciones = t.user_direcciones.filter((d) => d.user_id !== 'admin-1')
  const { ctx, page, errores } = await abrirCon(t, 'admin-1', { ancho: 1280 })
  await ir(page, '/mi-coleccion.html?ver=cambios')
  const e = await bajarEtiqueta(page)
  check('sale igual, con el nombre de Lucía', e.nombre === 'etiqueta-envio-lucia-perez-gil.pdf' && e.pdf.subarray(0, 5).toString() === '%PDF-', e.nombre)
  check('y avisa de escribir el remitente a mano', /escríbela a mano en «Remitente»/.test(e.aviso), e.aviso)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
