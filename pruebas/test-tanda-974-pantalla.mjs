// Tanda 974 — un solo «Me ha servido» en las guías (PINGU eligió la A).
//
// Al final de una guía había dos cosas que preguntaban lo mismo: el botón
// «Me ha servido» y la caja «¿Te ha servido esta guía? Sí / No tanto». Queda
// el botón, con su «ver quién»; la media de estrellas del perfil y de las
// filas de /usuarios pasa a ser «a cuántos les ha servido». Lo de la base
// (copiar los «Sí» sin dar XP) va en sql-tanda-974.sql.
import { readFileSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const AQUI = dirname(fileURLToPath(import.meta.url))
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const leer = (f) => readFileSync(`${RAIZ}/${f}`, 'utf8')

const guia = { id: 'g-1', slug: 'guia-charizard', title: 'Cómo jugar Charizard ex', description: 'Lista y consejos', kind: 'guide', author_id: 'admin-1', review_status: 'approved', published_at: '2026-10-01T10:00:00Z', blocks: [{ type: 'paragraph', text: 'Hola' }] }
const perfiles = [
  { id: 'u-ana', username: 'ana', display_name: 'Ana', hide_activity: false },
  { id: 'u-oculto', username: 'oculto', display_name: 'Oculto', hide_activity: true },
]
const servidos = [
  { guide_id: 'g-1', user_id: 'u-ana', created_at: '2026-10-21T10:00:00Z' },
  { guide_id: 'g-1', user_id: 'u-oculto', created_at: '2026-10-20T10:00:00Z' },
]

const browser = await chromium.launch()
async function abrir(ruta, sesion = 'none') {
  const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.addInitScript(([s, g, pf, sv]) => {
    window.__FAKE_SESSION__ = s
    window.__FAKE_GUIAS__ = [g]
    window.__FAKE_PERFILES__ = pf
    window.__FAKE_FILAS__ = { guide_helpful: sv, guide_reviews: [{ guide_id: 'g-1', reviewer_id: 'u-ana', rating: 5 }] }
  }, [sesion, guia, perfiles, servidos])
  await page.route(/\/\.netlify\/functions\//, (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  return { page, errores }
}

console.log('── 1. La guía: un solo control ──')
{
  const { page, errores } = await abrir('/guia/guia-charizard', 'user-2')
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('sin la caja «¿Te ha servido? Sí / No tanto»', (await page.locator('#guideRating, .rating-box, .sirve-boton').count()) === 0)
  check('un solo «Me ha servido»', (await page.locator('.helpful-btn').count()) === 1 && ((await page.textContent('.helpful-btn')) || '').trim() === 'Me ha servido')
  const cuenta = ((await page.textContent('[data-helpful-count]')) || '').replace(/\s+/g, ' ').trim()
  check('la cuenta: «A 2 personas les ha servido · ver quién»', cuenta === 'A 2 personas les ha servido · ver quién', cuenta)
  check('  …y mide 44 de alto', (await page.$eval('[data-helpful-count]', (b) => b.getBoundingClientRect().height)) >= 44)
  await page.click('[data-helpful-count]')
  await page.waitForTimeout(600)
  const filas = await page.$$eval('#helpfulQuien .rater-row', (fs) => fs.map((f) => ({ nombre: f.querySelector('.rater-name')?.textContent, href: f.querySelector('a.rater-name')?.getAttribute('href') || null })))
  check('«ver quién» despliega a quién le ha servido, la más nueva primero', filas.length === 2 && filas[0].nombre === 'Ana' && /ana/.test(filas[0].href || ''), JSON.stringify(filas))
  check('  …y quien esconde su actividad sale como «Un usuario», sin enlace', filas[1]?.nombre === 'Un usuario' && filas[1].href === null, JSON.stringify(filas[1]))
  check('  …con aria-expanded', (await page.getAttribute('[data-helpful-count]', 'aria-expanded')) === 'true')
  await page.click('.helpful-btn')
  await page.waitForTimeout(800)
  const tras = ((await page.textContent('[data-helpful-count]')) || '').replace(/\s+/g, ' ').trim()
  check('al pulsar: «Te ha servido», la cuenta sube y la lista se rehace', ((await page.textContent('.helpful-btn')) || '').trim() === 'Te ha servido' && /^A 3 personas/.test(tras) && (await page.locator('#helpfulQuien .rater-row').count()) === 3, tras)
  const aviso = await page.evaluate(() => window.__TABLAS__.user_notifications.at(-1))
  check('  …y avisa al autor («A alguien le ha servido tu guía»)', aviso?.type === 'guide_helpful' && aviso.title === 'A alguien le ha servido tu guía' && aviso.recipient_id === 'admin-1', JSON.stringify(aviso))
  await page.close()
}

console.log('\n── 2. El autor ve la cuenta y quién ──')
{
  const { page } = await abrir('/guia/guia-charizard', 'admin-1')
  check('sin botón para sí mismo', (await page.locator('.helpful-btn').count()) === 0)
  const cuenta = ((await page.textContent('[data-helpful-count]')) || '').replace(/\s+/g, ' ').trim()
  check('«A 2 personas les ha servido tu guía · ver quién»', cuenta === 'A 2 personas les ha servido tu guía · ver quién', cuenta)
  await page.click('[data-helpful-count]')
  await page.waitForTimeout(600)
  check('  …y despliega la lista', (await page.locator('#helpfulQuien .rater-row').count()) === 2)
  await page.close()
}

console.log('\n── 3. Lo que era una media de estrellas ──')
{
  const { cifrasHtml } = await import(`${RAIZ}/js/perfil-cifras.js`)
  const caja = cifrasHtml({ cartas: 10, guias: 3, servido: 13, torneos: 1 })
  check('el perfil: «Guías» con el brote y a cuántos les han servido', /perfil-cifra-nota[^>]*>.*13<\/small>/.test(caja) && /A 13 personas les han servido sus guías/.test(caja) && !/★|star/.test(caja), caja.slice(0, 300))
  check('  …sin nada si no les ha servido a nadie (o no se sabe)', !/perfil-cifra-nota/.test(cifrasHtml({ guias: 3, servido: 0 })) && !/perfil-cifra-nota/.test(cifrasHtml({ guias: 3, servido: null })))
  const { page, errores } = await abrir('/perfil', 'admin-1')
  check('/perfil sin errores', errores.length === 0, errores.join(' | '))
  const nota = ((await page.textContent('#profileStats .perfil-cifra-nota').catch(() => '')) || '').trim()
  check('  …y su cifra dice 2 (las de su guía publicada)', nota === '2', nota)
  await page.close()
}

console.log('\n── 4. Lo que ya no existe ──')
{
  check('guide-rating.js se fue', !existsSync(`${RAIZ}/js/guide-rating.js`))
  const { NOTIFICATION_TYPES } = await import(`${RAIZ}/js/notifications.js`).catch(() => ({}))
  const prefs = leer('js/avisos-prefs.js')
  check('Ajustes no ofrece «Valoraciones en tus guías»', NOTIFICATION_TYPES ? !('guide_rating' in NOTIFICATION_TYPES) : !/guide_rating:/.test(leer('js/notifications.js')))
  check('  …y su grupo lleva el «me ha servido»', /id: 'guias'[^}]*tipos: \['guide_comment', 'guide_helpful'\]/.test(prefs))
  const css = leer('css/components.css')
  check('el CSS de la caja de valoraciones salió de components.css (lo baja todo el mundo)', !/\.rating-box|\.rater-row|\.sirve-boton|\.star-pick/.test(css))
  check('  …y la lista de quién vive en guia.css', /\.rater-row \{/.test(leer('css/guia.css')))
}

console.log('\n── 5. La migración, contra PostgreSQL ──')
{
  const r = spawnSync('psql', ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-At', '-f', join(AQUI, 'sql-tanda-974.sql')], { encoding: 'utf8', timeout: 30000 })
  const salida = `${r.stdout || ''}${r.stderr || ''}`
  const lineas = salida.split('\n').filter((l) => /^(ok|FALLA)/.test(l))
  if (!lineas.length) check('hay un PostgreSQL en /var/tmp:5433 donde probar', false, salida.slice(0, 200))
  for (const l of lineas) check(l.replace(/^(ok|FALLA)\s+/, ''), l.startsWith('ok'))
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
