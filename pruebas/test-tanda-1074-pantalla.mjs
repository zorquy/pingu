// Tanda 1074 — una tienda no tiene por qué tener local, en el navegador
// (PINGU: «la ubicación tiene que ser opcional… la web por un lado y el
// Instagram, por si tienen»). /tiendas se pide sin ciudad y con el Instagram
// aparte; en Datos todo es opcional menos el nombre y el Instagram se guarda
// como usuario; el escaparate enlaza la web y el Instagram; el alta trae el
// de la solicitud. Y el panel se llama Panel, sin primeros pasos.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const TOKEN = '6f1d2c0a-1111-2222-3333-444455556666'
const b = await chromium.launch()
async function abrir(ruta, { sesion = 'user-2', perfil = null, rpc = {}, filas = null, perfiles = null } = {}) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' })
  await ctx.addInitScript(([s, p, r, f, g]) => {
    window.__FAKE_SESSION__ = s
    if (p) window.__FAKE_PERFIL__ = p
    window.__RPC_RESPUESTAS__ = r
    if (f) window.__FAKE_FILAS__ = f
    if (g) window.__FAKE_PERFILES__ = g
  }, [sesion, perfil, rpc, filas, perfiles])
  const p = await ctx.newPage()
  const errs = []
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)))
  await p.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(1500)
  return { p, ctx, errs }
}
const rpcs = (p, nombre) => p.evaluate((n) => (window.__RPCS__ || []).filter((r) => (r.nombre || r.name || r[0]) === n).map((r) => r.args || r[1]), nombre)
const TIENDA = { tipo: 'tienda', display_name: 'Cartas de Ane', username: 'cartas-ane' }

console.log('── 1. /tiendas: sin ciudad y con su Instagram ──')
{
  const { p, ctx, errs } = await abrir('/tiendas.html', { sesion: 'none' })
  check('sin errores', !errs.length, errs.join(' | '))
  check('la ciudad dice que es opcional y que no hace falta local', /Ciudad \(opcional\)/.test(await p.textContent('label:has(#tiendasCiudad)')) && !(await p.getAttribute('#tiendasCiudad', 'required') !== null) && /vendes desde casa/.test(await p.textContent('label:has(#tiendasCiudad)')))
  check('  …la web y el Instagram, cada uno en su campo', (await p.locator('#tiendasWeb').count()) === 1 && (await p.locator('#tiendasInstagram').count()) === 1)
  check('  …y arriba, que también es para quien vende desde casa', /compraventa desde casa/.test(await p.textContent('.page-header')))
  await p.fill('#tiendasNombre', 'Cartas de Ane')
  await p.fill('#tiendasEmail', 'ane@ejemplo.es')
  await p.fill('#tiendasInstagram', 'mi tienda guay')
  await p.click('#tiendasEnviar'); await p.waitForTimeout(300)
  check('un Instagram que no es un usuario: lo dice y no manda nada', /no parece un usuario/.test(await p.textContent('#tiendasError')) && !(await rpcs(p, 'tienda_pedir')).length)
  await p.fill('#tiendasInstagram', 'https://instagram.com/cartas.ane/')
  await p.click('#tiendasEnviar'); await p.waitForTimeout(500)
  const a = (await rpcs(p, 'tienda_pedir'))[0] || {}
  check('sin ciudad se pide, con el Instagram como usuario', a.p_ciudad === null && a.p_instagram === 'cartas.ane' && a.p_web === null && a.p_nombre === 'Cartas de Ane', JSON.stringify(a))
  check('  …y da las gracias', await p.isVisible('#tiendasGracias'))
  await ctx.close()
}

console.log('── 2. Datos: todo opcional menos el nombre ──')
{
  const filas = { tiendas: [{ user_id: 'user-2', ciudad: null, direccion: null, horario: null, web: '@cartas.ane', instagram: null, precio_visible: true }] }
  const { p, ctx, errs } = await abrir('/tienda.html?ver=datos', { perfil: TIENDA, filas })
  check('sin errores', !errs.length, errs.join(' | '))
  check('sin ciudad ni dirección, la cabecera dice su @ (no «Sin dirección»)', (await p.textContent('#tdDonde')) === '@cartas-ane')
  const rotulos = await p.$$eval('#tdDatos .td-campo', (ls) => ls.map((l) => l.querySelector('span')?.textContent.trim() || l.firstChild.textContent.trim()))
  check('Ciudad, Dirección, Horario, Web e Instagram dicen «opcional»', ['Ciudad', 'Dirección', 'Horario', 'Web', 'Instagram'].every((n) => rotulos.some((r) => r.startsWith(n) && /opcional/.test(r))) && rotulos[0] === 'Nombre', rotulos.join(' | '))
  check('el @ que estaba en la web sale en Instagram, y la web vacía', (await p.inputValue('#tdDatoInstagram')) === '@cartas.ane' && (await p.inputValue('#tdDatoWeb')) === '')
  await p.fill('#tdDatoInstagram', 'no vale esto')
  await p.click('#tdDatosGuardar'); await p.waitForTimeout(400)
  check('un Instagram que no es un usuario no se guarda', /no parece un usuario/.test(await p.textContent('#tdDatosError')))
  await p.fill('#tdDatoInstagram', 'instagram.com/ane.cartas')
  await p.fill('#tdDatoWeb', 'cartasdeane.es')
  await p.click('#tdDatosGuardar'); await p.waitForTimeout(600)
  const fila = await p.evaluate(() => window.__TABLAS__.tiendas.find((t) => t.user_id === 'user-2'))
  check('guarda la web y el Instagram como usuario, sin ciudad', fila.instagram === 'ane.cartas' && fila.web === 'cartasdeane.es' && fila.ciudad === null, JSON.stringify(fila))
  await ctx.close()
}
{
  const { p, ctx } = await abrir('/tienda.html?ver=datos', { perfil: TIENDA, filas: { tiendas: [{ user_id: 'user-2', ciudad: 'Bilbao', web: '@viejo', precio_visible: true }] } })
  check('sin la migración (la fila no trae `instagram`): el campo no sale y la web se queda como estaba', (await p.isHidden('#tdDatoInstagram')) && (await p.inputValue('#tdDatoWeb')) === '@viejo')
  await p.click('#tdDatosGuardar'); await p.waitForTimeout(600)
  const fila = await p.evaluate(() => window.__TABLAS__.tiendas.find((t) => t.user_id === 'user-2'))
  check('  …y guardar no manda `instagram` ni borra la web', !('instagram' in fila) && fila.web === '@viejo', JSON.stringify(fila))
  await ctx.close()
}

console.log('── 3. El escaparate enlaza la web y el Instagram ──')
{
  const PERFIL = { id: 'tienda-1', username: 'cartas-ane', display_name: 'Cartas de Ane', tipo: 'tienda' }
  const { p, ctx, errs } = await abrir('/usuario.html?u=cartas-ane', { sesion: 'none', perfiles: [PERFIL], filas: { tiendas: [{ user_id: 'tienda-1', ciudad: null, direccion: null, horario: null, web: 'cartasdeane.es', instagram: 'ane.cartas', precio_visible: true }] }, rpc: { tienda_escaparate: { total: 0, en_escaparate: 0, de_tu_lista: 0, precios: true, facetas: {}, filas: [] } } })
  check('sin errores', !errs.length, errs.join(' | '))
  const enlaces = await p.$$eval('.pt-datos a', (as) => as.map((a) => `${a.closest('div').querySelector('dt').textContent}:${a.textContent}:${a.getAttribute('href')}:${a.target}`))
  check('la web y el Instagram, con su enlace en otra pestaña', enlaces.join(' | ') === 'Web:cartasdeane.es:https://cartasdeane.es/:_blank | Instagram:@ane.cartas:https://www.instagram.com/ane.cartas/:_blank', enlaces.join(' | '))
  check('  …sin dirección: sin «Cómo llegar» y sin ciudad junto al @', (await p.locator('.pt-botones a', { hasText: 'Cómo llegar' }).count()) === 0 && (await p.textContent('.pt-quien small')) === '@cartas-ane')
  await ctx.close()
}

console.log('── 4. El alta trae el Instagram de la solicitud ──')
{
  const INV = { valida: true, nombre: 'Cartas de Ane', ciudad: null, email: 'user-2@pruebas.test', web: null, instagram: 'cartas.ane', caduca: '2026-11-11T00:00:00Z' }
  const { p, ctx, errs } = await abrir(`/alta-tienda.html?i=${TOKEN}`, { rpc: { tienda_invitacion: INV, tienda_alta: { ok: true, username: 'cartas-ane' } }, filas: { tiendas: [{ user_id: 'user-2', ciudad: null, web: null, instagram: 'cartas.ane' }] } })
  await p.waitForTimeout(500)
  check('sin errores, con el Instagram puesto y la ciudad «(opcional)»', !errs.length && (await p.inputValue('#altaInstagram')) === '@cartas.ane' && (await p.inputValue('#altaCiudad')) === '' && /opcional/.test(await p.textContent('label[for="altaCiudad"]')), errs.join(' | '))
  await p.fill('#altaUsuario', 'cartas-ane')
  await p.fill('#altaInstagram', '@ane.cartas')
  await p.click('#altaGuardar'); await p.waitForTimeout(800)
  const a = (await rpcs(p, 'tienda_alta'))[0] || {}
  check('el alta sin ciudad', a.p_ciudad === null && a.p_web === null, JSON.stringify(a))
  const fila = await p.evaluate(() => window.__TABLAS__.tiendas.find((t) => t.user_id === 'user-2'))
  check('  …y el Instagram cambiado se escribe en su fila', fila?.instagram === 'ane.cartas', JSON.stringify(fila))
  await ctx.close()
}

await b.close()
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
