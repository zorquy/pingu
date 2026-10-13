import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Tanda 803: el rol de redactor de noticias (`is_news_writer`). PINGU:
// «un rol para una persona que quiero darle permisos pero solo para
// escribir las noticias».
//
// Dos mitades, y la que manda es la primera: la BASE (contra PostgreSQL
// de verdad, con las migraciones que la 803 reescribe puestas antes) y
// luego la web, que solo enseña los mandos a quien los puede usar.

const AQUI = dirname(fileURLToPath(import.meta.url))
const REPO = '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + extra : ''}`)
}

console.log('\n── 1. La base ──')
{
  const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q']
  const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 60000 })
  const hay = psql(['-c', 'select 1'])
  check('hay un PostgreSQL en /var/tmp:5433 donde probar', hay.status === 0, (hay.stderr || '').slice(0, 120))
  if (hay.status === 0) {
    psql(['-c', 'drop database if exists prueba_803'])
    psql(['-c', 'create database prueba_803'])
    const orden = [
      join(AQUI, 'sql-tanda-803.sql'),
      join(REPO, 'supabase-migration-noticias.sql'),
      join(REPO, 'supabase-migration-noticias-arreglo.sql'),
      join(REPO, 'supabase-migration-editar-publicada.sql'),
      join(REPO, 'supabase-migration-redactor-noticias.sql'),
      // Dos veces: la migración se puede repetir entera.
      join(REPO, 'supabase-migration-redactor-noticias.sql'),
    ]
    for (const f of orden) {
      const r = psql(['-d', 'prueba_803', '-f', f])
      check(`carga ${f.split('/').pop()}`, r.status === 0, (r.stderr || '').split('\n').find((l) => /ERROR/.test(l)) || '')
    }
    const r = psql(['-t', '-A', '-d', 'prueba_803', '-f', join(AQUI, 'sql-tanda-803-casos.sql')])
    const lineas = (r.stdout || '').split('\n').filter((l) => /^(ok|MAL) /.test(l))
    check('los casos se ejecutan', r.status === 0 && lineas.length >= 14, (r.stderr || '').slice(0, 200))
    for (const l of lineas) check(l.slice(4), l.startsWith('ok'))
    psql(['-c', 'drop database if exists prueba_803'])
  }
}

console.log('\n── 2. Lo que dice el código ──')
{
  const editor = readFileSync(join(REPO, 'js/editor-guia.js'), 'utf8')
  // `profiles` no existe en esta base (lo dice la 274): preguntar ahí
  // dejaba el interruptor de noticia escondido hasta para el admin.
  check('el editor no pregunta a `profiles`, que no existe', !/from\('profiles'\)/.test(editor))
  const mig = readFileSync(join(REPO, 'supabase-migration-redactor-noticias.sql'), 'utf8')
  check('la migración no usa tablas temporales entre sentencias (631)', !/create\s+temp/i.test(mig))
}

console.log('\n── 3. La web ──')
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const browser = await chromium.launch()
const abrir = async (ruta, { sesion = 'none', semillas = {} } = {}) => {
  const page = await browser.newPage({ viewport: { width: 1100, height: 1000 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.addInitScript((s) => {
    for (const [k, v] of Object.entries(s)) window[k] = v
  }, { __FAKE_SESSION__: sesion, ...semillas })
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  return { page, errores }
}
const REDACTORA = { __FAKE_PERFIL__: { is_news_writer: true } }

{
  const { page, errores } = await abrir('/noticias', { sesion: 'user-1', semillas: REDACTORA })
  check('/noticias sin errores de JavaScript', errores.length === 0, errores[0] || '')
  const href = await page.locator('#noticiasEscribir a').getAttribute('href').catch(() => null)
  check('la redactora ve «Escribir noticia»…', Boolean(href))
  check('  …y va al editor de la comunidad (no al panel, donde no entra) ya puesto en noticia',
    /^\/editor-guia\.html\?tipo=noticia$/.test(href || ''), String(href))
  await page.close()
}
{
  const { page } = await abrir('/noticias', { sesion: 'admin-1' })
  const href = await page.locator('#noticiasEscribir a').getAttribute('href').catch(() => null)
  check('el admin sigue yendo a su editor', /^\/admin\/editor-guia\.html\?tipo=noticia$/.test(href || ''), String(href))
  await page.close()
}
{
  const { page, errores } = await abrir('/editor-guia.html?tipo=noticia', { sesion: 'user-1', semillas: REDACTORA })
  check('el editor sin errores de JavaScript', errores.length === 0, errores[0] || '')
  check('la redactora ve el tipo de artículo', await page.locator('#mgKindCampo').isVisible())
  check('  …puesto en noticia', (await page.locator('#mgKind').inputValue()) === 'news')
  check('  …el título dice «Nueva noticia»', (await page.locator('#editorTitle').textContent()) === 'Nueva noticia')
  check('  …y el botón «Publicar noticia», no «Enviar a revisión»',
    (await page.locator('#btnSubmit').textContent()) === 'Publicar noticia', await page.locator('#btnSubmit').textContent())
  await page.selectOption('#mgKind', 'guide')
  check('si la pasa a guía, el botón vuelve a «Enviar a revisión»',
    (await page.locator('#btnSubmit').textContent()) === 'Enviar a revisión', await page.locator('#btnSubmit').textContent())
  check('  …y el título a «Nueva guía»', (await page.locator('#editorTitle').textContent()) === 'Nueva guía')
  await page.close()
}
{
  const { page } = await abrir('/editor-guia.html?tipo=noticia', { sesion: 'user-1' })
  check('alguien normal no ve el tipo de artículo', !(await page.locator('#mgKindCampo').isVisible()))
  check('  …y su botón es «Enviar a revisión» aunque el enlace diga noticia',
    (await page.locator('#btnSubmit').textContent()) === 'Enviar a revisión')
  await page.close()
}
{
  // El admin escribiendo en el editor de la comunidad: antes no veía el
  // interruptor (preguntaba a `profiles`).
  const { page } = await abrir('/editor-guia.html', { sesion: 'admin-1' })
  check('el admin ve el tipo de artículo también en el editor de la comunidad', await page.locator('#mgKindCampo').isVisible())
  await page.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
