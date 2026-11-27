// Tandas 1484 y 1485 — Dos cosas de un torneo en persona (PINGU, con el
// Tradeitto 2):
//   1484 · «Lo apunto yo según vayan llegando… y sin querer le di a abrir
//          inscripciones… lo que quiero es que nadie se pueda apuntar hasta
//          que el día del evento»: con «Solo tú los apuntas» el borrador se
//          PUBLICA (no se «abren inscripciones»), y después no hay «Cerrar» ni
//          «Reabrir»; y en Editar se puede cambiar cómo se apunta la gente
//          (antes solo al crearlo).
//   1485 · «Es un PNG redondo. ¿Por qué sale el recuadro cuadrado?»: un logo
//          con las esquinas transparentes se marca al subirlo y se pinta sin la
//          caja, como en los eventos.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const dentroDe = (dias) => new Date(Date.now() + dias * 86400e3).toISOString()
const T = (extra = {}) => ({ id: 'torneo-1', slug: 'copa', name: 'Tradeitto 2', status: 'draft', admin_id: 'admin-1', swiss_rounds: 4, top_cut_size: 0, max_players: 16, start_at: dentroDe(3), format: 'standard', checkin_minutes: 0, round_time_minutes: 50, modalidad: 'presencial', lugar: 'Cartas Bilbao', direccion: 'Calle Ercilla 12, Bilbao', inscripcion: 'organizador', ...extra })

const browser = await chromium.launch()
async function abrir(ruta, { sesion = 'admin-1', torneos = [T()] } = {}) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.route(/\/sprite\/|limitlesstcg|jsdelivr|githubusercontent/, (r) => r.fulfill({ status: 404, body: '' }))
  await page.route(/supabase\.co\/storage\/.*\.png/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><circle cx="5" cy="5" r="5" fill="#c84"/></svg>' }))
  await page.addInitScript(([s, t]) => {
    window.__FAKE_SESSION__ = s
    window.__FAKE_TORNEOS__ = t
    window.__FAKE_INSCRIPCIONES__ = []
    window.__FAKE_PERFILES__ = [{ id: 'user-1', username: 'pingu', display_name: 'pingu' }, { id: 'admin-1', username: 'tienda', display_name: 'tienda' }]
    try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())) } catch {}
  }, [sesion, torneos])
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  return { page, errores }
}
const botones = (page) => page.evaluate(() => [...document.querySelectorAll('#torneoAdminAcciones button')].map((b) => b.textContent.trim()).join('|'))

console.log('── 1484 · Solo tú los apuntas ──')
{
  const { page, errores } = await abrir('/torneo?slug=copa&ver=torneo')
  check('en borrador, «Publicar el torneo» (no «Abrir inscripciones»)', (await botones(page)) === 'Publicar el torneo', await botones(page))
  await page.click('#btnAbrirInscripciones')
  await page.waitForTimeout(1500)
  const estado = await page.evaluate(() => (window.__TABLAS__?.tournaments || []).find((t) => t.id === 'torneo-1')?.status)
  check('…y publicarlo lo deja a la vista (sale del borrador)', estado === 'registration_open', estado)
  check('…sin «Cerrar inscripciones» después', !/Cerrar inscripciones|Reabrir/.test(await botones(page)), await botones(page))
  check('sin errores', !errores.length, errores.join(' | '))
  await page.close()
}
for (const status of ['registration_open', 'registration_closed']) {
  const { page } = await abrir('/torneo?slug=copa&ver=torneo', { torneos: [T({ status })] })
  check(`${status}: ni «Cerrar» ni «Reabrir»`, !/Cerrar inscripciones|Reabrir/.test(await botones(page)), await botones(page))
  await page.close()
}
{
  // Con «Piden plaza», lo de siempre.
  const { page } = await abrir('/torneo?slug=copa&ver=torneo', { torneos: [T({ inscripcion: 'pedir' })] })
  check('con «Piden plaza», «Abrir inscripciones» como siempre', (await botones(page)) === 'Abrir inscripciones', await botones(page))
  await page.close()
}
{
  // Editar: cambiar cómo se apunta la gente.
  const { page, errores } = await abrir('/torneo?slug=copa&ver=torneo', { torneos: [T({ inscripcion: 'pedir', status: 'registration_open' })] })
  await page.evaluate(() => document.getElementById('btnEditarTorneo')?.click())
  await page.waitForSelector('#editarInscripcion', { timeout: 6000 }).catch(() => {})
  const ops = await page.evaluate(() => [...document.querySelectorAll('#editarInscripcion option')].map((o) => `${o.value}${o.selected ? '*' : ''}`).join())
  check('Editar enseña «Se apunta» con las tres maneras y la suya elegida', ops === 'pedir*,organizador,libre', ops)
  await page.selectOption('#editarInscripcion', 'organizador')
  await page.evaluate(() => document.querySelector('#torneoEditor button[type="submit"], #btnGuardarEdicion, #torneoEditor .btn-primary')?.click())
  await page.waitForTimeout(1500)
  const ins = await page.evaluate(() => (window.__TABLAS__?.tournaments || []).find((t) => t.id === 'torneo-1')?.inscripcion)
  check('…y guardar lo cambia a «Solo tú los apuntas»', ins === 'organizador', ins)
  check('sin errores', !errores.length, errores.join(' | '))
  await page.close()
}
{
  // Uno online no lleva el campo.
  const { page } = await abrir('/torneo?slug=copa&ver=torneo', { torneos: [T({ modalidad: 'online', inscripcion: 'libre', status: 'registration_open' })] })
  await page.evaluate(() => document.getElementById('btnEditarTorneo')?.click())
  await page.waitForTimeout(800)
  check('uno online no lleva «Se apunta» en Editar', !(await page.$('#editarInscripcion')))
  await page.close()
}

console.log('── 1485 · Un logo redondo, sin caja ──')
{
  const { esImagenSinFondo } = await import(`${RAIZ}/js/torneos/arena-lista.js`)
  check('la marca se lee del nombre del fichero', esImagenSinFondo('https://x.supabase.co/storage/v1/object/public/avatars/u/torneo-sinfondo-1764200000000.png') && !esImagenSinFondo('https://x/avatars/u/torneo-1764200000000.png') && !esImagenSinFondo(null))
  const { page, errores } = await abrir('/torneo?slug=copa&ver=torneo', { torneos: [T({ status: 'registration_open', image_url: 'https://zqamujmfavwrsqlgbead.supabase.co/storage/v1/object/public/avatars/admin-1/torneo-sinfondo-1764200000000.png' })] })
  // Lo que decide la subida, con dos PNG de verdad hechos en el navegador.
  const tipos = await page.evaluate(async () => {
    const { tipoDeSubida } = await import('/js/torneos/imagen-torneo.js')
    const hacer = (redondo) => new Promise((res) => {
      const c = document.createElement('canvas'); c.width = 64; c.height = 64
      const x = c.getContext('2d'); x.fillStyle = '#c84'
      if (redondo) { x.beginPath(); x.arc(32, 32, 30, 0, Math.PI * 2); x.fill() } else x.fillRect(0, 0, 64, 64)
      c.toBlob((b) => res(new File([b], 'logo.png', { type: 'image/png' })), 'image/png')
    })
    return [await tipoDeSubida(await hacer(true)), await tipoDeSubida(await hacer(false)), await tipoDeSubida(new File([new Uint8Array(4)], 'x.jpg', { type: 'image/jpeg' }))].join()
  })
  check('al subirla: redondo → sin fondo; cuadrado y JPG → con su caja', tipos === 'torneo-sinfondo,torneo,torneo', tipos)
  const a = await page.evaluate(() => { const e = document.getElementById('torneoAvatar'); const cs = getComputedStyle(e); return { clase: e.classList.contains('sin-fondo'), fondo: cs.backgroundColor, sombra: cs.boxShadow } })
  check('la ficha: el logo marcado va sin caja ni aro', a.clase && a.fondo === 'rgba(0, 0, 0, 0)' && a.sombra === 'none', JSON.stringify(a))
  check('sin errores', !errores.length, errores.join(' | '))
  await page.close()
  const { page: p2 } = await abrir('/torneo?slug=copa&ver=torneo', { torneos: [T({ status: 'registration_open', image_url: 'https://zqamujmfavwrsqlgbead.supabase.co/storage/v1/object/public/avatars/admin-1/torneo-1764200000000.png' })] })
  check('una imagen sin la marca sigue con su caja', await p2.evaluate(() => !document.getElementById('torneoAvatar').classList.contains('sin-fondo')))
  await p2.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
