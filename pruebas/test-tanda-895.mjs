// Tanda 895 — Mi colección y la ficha de torneo, partidas por bloques (R4 de
// «Rápida y limpia»). El Panel y los deseos de Mi colección y el editor del
// torneo viven en módulos que entran por import(): /cartas (el catálogo
// público) y las colecciones ajenas no los bajan; la tuya los pide al
// arrancar y los puentes pintan en el mismo cuadro cuando ya están.
import { readFileSync, statSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const leer = (f) => readFileSync(`${RAIZ}/${f}`, 'utf8')
const gz = (f) => gzipSync(leer(f)).length
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

console.log('── 1. Lo estático ──')
{
  const main = leer('js/mi-coleccion.js')
  const panel = leer('js/mi-coleccion/panel.js')
  const deseos = leer('js/mi-coleccion/deseos.js')
  const torneo = leer('js/torneos/torneo.js')
  const editor = leer('js/torneos/torneo-editor.js')
  check('el Panel vive en mi-coleccion/panel.js (vistazos, movidas, cambio del mes, valor en el tiempo) y el principal solo lleva los puentes', /export async function pintarVistazos\(/.test(panel) && /async function pintarMovidas\(/.test(panel) && /export function pintarCambioDelMes\(/.test(panel) && !/function pintarMovidas\(/.test(main) && /function pintarVistazos\(\.\.\.a\) \{\n  return panelMod \? panelMod\.pintarVistazos\(\.\.\.a\) : panel\(\)\.then/.test(main))
  check('los deseos viven en mi-coleccion/deseos.js (La quiero, Las que doy, Cambios, Mercado)', /export async function abrirQuiero\(/.test(deseos) && /export async function abrirCambios\(/.test(deseos) && /export async function abrirMercado\(/.test(deseos) && !/function pintarQuiero\(/.test(main))
  check('lo que es síncrono para otros se queda en el principal (precioDeDeseo, iniciarMercadoSinCuenta)', /^function precioDeDeseo\(/m.test(main) && /^function iniciarMercadoSinCuenta\(/m.test(main) && !/function precioDeDeseo\(/.test(deseos))
  check('los módulos leen el estado por ctx (getters y setters), nunca por copia', /get lineas\(\) \{\n    return lineas\n  \},\n  set lineas\(x\)/.test(main) && /ctx\.lineas/.test(panel) && /ctx\.deseos/.test(deseos) && !/^let lineas\b/m.test(panel) && !/^let deseos\b/m.test(deseos))
  check('tu colección pide los dos módulos al arrancar y los espera antes del primer pintado (sin saltos)', /if \(esMia\) \{\n    void panel\(\)\.catch/.test(main) && /(\$\('mcCargando'\)\.classList\.add\('hidden'\)|coleccionCargada\(\))\n  if \(esMia(?: && !modoTienda)?\) await Promise\.all\(\[panel\(\), sesion \? deseosModulo\(\) : null\]\)/.test(main))
  check('el Panel no pisa la última vista (894) antes de que llegue la colección', /if \(!ctx\.panelFiable && caja\.dataset\.ultimaVista\) return/.test(panel) && /get panelFiable\(\)/.test(main))
  check('el editor del torneo vive en torneos/torneo-editor.js y entra al pulsar «Editar»', /export async function pintarEditor\(ctx\)/.test(editor) && /import\('\.\/torneo-editor\.js'\)\.then\(\(m\) => m\.pintarEditor\(contextoDelEditor\(\)\)\)/.test(torneo) && !/function guardarEdicion\(/.test(torneo))
  const kb = { main: gz('js/mi-coleccion.js'), panel: gz('js/mi-coleccion/panel.js'), deseos: gz('js/mi-coleccion/deseos.js'), torneo: gz('js/torneos/torneo.js'), editor: gz('js/torneos/torneo-editor.js') }
  check(`mi-coleccion.js baja de 130 KB gzip (era 146): ${Math.round(kb.main / 1024)} + panel ${Math.round(kb.panel / 1024)} + deseos ${Math.round(kb.deseos / 1024)}; torneo.js de 31 (era 36): ${Math.round(kb.torneo / 1024)} + editor ${Math.round(kb.editor / 1024)}`, kb.main < 130 * 1024 && kb.panel > 8000 && kb.deseos > 8000 && kb.torneo < 31 * 1024 && kb.editor > 5000, JSON.stringify(kb))
}

const b = await chromium.launch()
const descargas = async (ruta, init) => {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES', serviceWorkers: 'block' })
  if (init) await ctx.addInitScript(init)
  const p = await ctx.newPage()
  const js = new Set()
  const errores = []
  p.on('request', (r) => { const u = r.url(); if (u.endsWith('.js')) js.add(u.replace(BASE + '/', '')) })
  p.on('pageerror', (e) => errores.push(e.message))
  await p.goto(`${BASE}/${ruta}`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2500)
  return { p, ctx, js, errores }
}

console.log('\n── 2. Quién baja qué ──')
{
  const c = await descargas('cartas.html', "window.__FAKE_SESSION__ = 'none'")
  check('/cartas sin cuenta no baja ni el Panel ni los deseos', !c.js.has('js/mi-coleccion/panel.js') && !c.js.has('js/mi-coleccion/deseos.js') && c.js.has('js/mi-coleccion.js') && !c.errores.length, [...c.js].filter((x) => /panel|deseos/.test(x)).join() + ' ' + c.errores.join(' | '))
  await c.ctx.close()
  const m = await descargas('mi-coleccion.html?ver=album')
  check('tu colección sí los pide (al arrancar, para que estén cuando lleguen las líneas), y sin errores', m.js.has('js/mi-coleccion/panel.js') && m.js.has('js/mi-coleccion/deseos.js') && !m.errores.length, m.errores.join(' | '))
  const hero = await m.p.evaluate(() => document.getElementById('mcHero')?.textContent.replace(/\s+/g, ' ').trim().slice(0, 80))
  check('  …y la cabecera está pintada', typeof hero === 'string' && hero.length > 0, hero)
  await m.ctx.close()
  const a = await descargas('mi-coleccion.html?u=brock', "window.__FAKE_PERFILES__ = [{ id: 'user-1', username: 'brock', display_name: 'Brock', coleccion_publica: true }]")
  check('la colección de otra persona no baja los deseos', !a.js.has('js/mi-coleccion/deseos.js'), [...a.js].filter((x) => /deseos/.test(x)).join())
  await a.ctx.close()
}

console.log('\n── 3. El Panel y los deseos funcionan por los puentes ──')
{
  const c = await descargas('mi-coleccion.html?ver=resumen', "window.__FAKE_COLECCION__ = [{}, {}, {}]")
  await c.p.waitForTimeout(800)
  const r = await c.p.evaluate(() => ({ vistazos: document.querySelectorAll('#mcVistazos .mc-vistazo').length, resumen: (document.getElementById('mcResumenPanel')?.textContent || '').trim().length }))
  check('el Panel se pinta (vistazos y resumen) desde el módulo', r.vistazos >= 1 && r.resumen > 0 && !c.errores.length, JSON.stringify(r) + ' ' + c.errores.join(' | '))
  await c.ctx.close()
  const d = await descargas('mi-coleccion.html?ver=quiero')
  const q = await d.p.evaluate(() => ({ panel: !!document.getElementById('mcPanelQuiero') && !document.getElementById('mcPanelQuiero').classList.contains('hidden'), rejilla: !!document.getElementById('mcQuieroRejilla'), bajado: true }))
  check('«La quiero» se abre desde el módulo de deseos (?ver=quiero, como la 771)', q.panel && d.js.has('js/mi-coleccion/deseos.js') && !d.errores.length, JSON.stringify(q) + ' ' + d.errores.join(' | '))
  await d.ctx.close()
}

console.log('\n── 4. El editor del torneo entra al pulsar ──')
{
  // La misma ficha que abre la 302, con quien la lleva (admin-1).
  const c = await descargas('torneo?slug=pachanga', `window.__FAKE_TORNEOS__ = [{ id: 't1', slug: 'pachanga', name: 'Pachanga de inauguración', status: 'registration_open', admin_id: 'admin-1', max_players: null, swiss_rounds: 4, start_at: '${new Date(Date.now() + 5 * 86400e3).toISOString()}' }]`)
  check('al abrir la ficha no se baja el editor', !c.js.has('js/torneos/torneo-editor.js') && !c.errores.length, c.errores.join(' | '))
  const hayEditar = await c.p.locator('#btnEditarTorneo').count()
  if (hayEditar) {
    await c.p.click('#btnEditarTorneo')
    await c.p.waitForTimeout(1500)
    check('al pulsar «Editar» baja el editor y aparece el formulario', c.js.has('js/torneos/torneo-editor.js') && (await c.p.locator('#torneoEditor #editarNombre').count()) === 1 && !c.errores.length, [...c.js].filter((x) => /editor/.test(x)).join() + ' ' + c.errores.join(' | '))
  } else {
    check('hay botón «Editar» para quien lleva el torneo', false, 'no sale #btnEditarTorneo')
  }
  await c.ctx.close()
}
await b.close()

console.log(fails ? `\n❌ ${fails} fallos` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
