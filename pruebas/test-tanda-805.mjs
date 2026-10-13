import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { spawnSync } from 'node:child_process'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Tanda 805: el informe de seguridad de Luisfe.
//  1. La base: lo que cada uno NO puede escribirse en su fila (baneo,
//     silencio, Pro, XP, nivel, una foto que no es una dirección limpia),
//     sin romper lo que sí (su nombre, su foto buena, su racha) ni el XP que
//     reparten las funciones de la casa; y el tope diario de `xp_sumar`.
//  2. `urlParaCss`: lo que pasa y lo que no.
//  3. Ningún `url('${…}')` montado a mano sin pasar por ella.
//  4. Una página de verdad con un avatar malicioso no ejecuta nada.

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
    psql(['-c', 'drop database if exists prueba_805'])
    psql(['-c', 'create database prueba_805'])
    for (const f of [join(AQUI, 'sql-tanda-805.sql'), join(REPO, 'supabase-migration-redactor-noticias.sql'), join(REPO, 'supabase-migration-seguridad-perfil.sql'), join(REPO, 'supabase-migration-seguridad-perfil.sql')]) {
      const r = psql(['-d', 'prueba_805', '-f', f])
      check(`carga ${f.split('/').pop()}`, r.status === 0, (r.stderr || '').split('\n').find((l) => /ERROR/.test(l)) || '')
    }
    const r = psql(['-t', '-A', '-d', 'prueba_805', '-f', join(AQUI, 'sql-tanda-805-casos.sql')])
    const lineas = (r.stdout || '').split('\n').filter((l) => /^(ok|MAL) /.test(l))
    check('los casos se ejecutan', r.status === 0 && lineas.length >= 12, (r.stderr || '').slice(0, 200))
    for (const l of lineas) check(l.slice(4), l.startsWith('ok'))
    psql(['-c', 'drop database if exists prueba_805'])
  }
}

console.log('\n── 2. urlParaCss ──')
{
  const { urlParaCss } = await import(`${REPO}/js/html.js`)
  const buena = 'https://zqamujmfavwrsqlgbead.supabase.co/storage/v1/object/public/avatars/u/avatar-1.png'
  check('una dirección buena pasa igual', urlParaCss(buena) === buena)
  check('una comilla doble no rompe nada', !/"/.test(urlParaCss('https://x.com/a" onmouseover="alert(1)')), urlParaCss('https://x.com/a" onmouseover="alert(1)'))
  check('  …ni la simple, ni paréntesis, ni espacios', !/['() ]/.test(urlParaCss("https://x.com/a') ; background:url(x")))
  check('javascript:, http: y // no pasan', ['javascript:alert(1)', 'http://x.com/a.png', '//x.com/a.png', 'foo'].every((u) => urlParaCss(u) === ''))
  check('una ruta nuestra y un blob, sí', urlParaCss('/assets/a.png') === '/assets/a.png' && urlParaCss('blob:https://pokedoc.es/1-2') === 'blob:https://pokedoc.es/1-2')
  check('una imagen data: en base64, sí; con otra cosa, no', urlParaCss('data:image/png;base64,iVBORw0K') !== '' && urlParaCss('data:text/html;base64,PHNjcmlwdD4=') === '')
  check('nada → vacío', urlParaCss(null) === '' && urlParaCss(undefined) === '' && urlParaCss('') === '')
}

console.log('\n── 3. Nadie monta un url() a mano ──')
{
  const malos = []
  const recorrer = (dir) => {
    for (const n of readdirSync(dir)) {
      const p = join(dir, n)
      if (statSync(p).isDirectory()) { recorrer(p); continue }
      if (!/\.(m?js)$/.test(n)) continue
      readFileSync(p, 'utf8').split('\n').forEach((l, i) => {
        // Un url( con una interpolación dentro que no pasa por urlParaCss,
        // salvo lo que ya sale de ella en la línea de antes (foto, imagen).
        if (/url\(['"]?\$\{/.test(l) && !/urlParaCss|\$\{(foto|imagen)\}/.test(l)) malos.push(`${p.replace(REPO + '/', '')}:${i + 1}`)
      })
    }
  }
  for (const d of ['js', 'admin/js']) recorrer(join(REPO, d))
  // Las fotos de las CARTAS (catálogo, no las escribe nadie) se quedan con lo
  // suyo: carta-movil codifica la comilla de su `url("…")`.
  const dejados = malos.filter((m) => !/^js\/carta-movil\.js:/.test(m))
  check('cada url(${…}) pasa por urlParaCss', dejados.length === 0, dejados.join(', '))
  const subida = readFileSync(join(REPO, 'js/app.js'), 'utf8')
  check('la foto de perfil saca la extensión del tipo, no del nombre', /uploadProfileImage[\s\S]{0,400}extensionDeImagen\(file\)/.test(subida))
}

console.log('\n── 4. Un avatar malicioso en una página de verdad ──')
{
  const BASE = process.env.PD_BASE || 'http://localhost:8892'
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  page.on('dialog', (d) => { errores.push('saltó un diálogo: ' + d.message()); d.dismiss() })
  await page.addInitScript(() => {
    window.__FAKE_SESSION__ = 'user-1'
    window.__FAKE_PERFIL__ = { avatar_url: 'https://x.com/a.png" onmouseover="window.__pwn=1" data-x="' }
  })
  await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  await page.hover('#navUserBtn').catch(() => {})
  await page.click('#navUserBtn').catch(() => {})
  await page.waitForTimeout(800)
  await page.hover('.tu-avatar').catch(() => {})
  const r = await page.evaluate(() => ({
    pwn: window.__pwn === 1,
    atributos: [...document.querySelectorAll('[onmouseover]')].length,
    avatares: document.querySelectorAll('#navUserBtn, .tu-avatar').length,
  }))
  check('no se cuela ningún atributo nuevo', r.atributos === 0, JSON.stringify(r))
  check('  …ni se ejecuta nada al pasar por encima', !r.pwn)
  check('  …y los avatares siguen ahí, sin errores', r.avatares >= 2 && errores.length === 0, errores.join(' | '))
  await browser.close()
}

console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
