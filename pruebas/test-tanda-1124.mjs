// Tanda 1124 — diez niveles de XP y los rangos de colaborador cortos: lo puro
// (js/niveles.js, la misma tabla para la web y la insignia), la migración
// contra PostgreSQL (nivel_de_xp y el recálculo de todo el mundo, dos veces
// encima) y la ventana «Niveles» del perfil en el PC y el móvil.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
const REPO = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

console.log('── Lo puro ──')
const { NIVELES, nivelDeXp, RANGOS_COLABORADOR, rangoDeColaborador, milesXp } = await import(`${REPO}/js/niveles.js`)
{
  check('diez niveles, de Novato a Maestro, sin Coleccionista', NIVELES.length === 10 && NIVELES[0].level === 'Novato' && NIVELES.at(-1).level === 'Maestro' && !NIVELES.some((n) => n.level === 'Coleccionista'))
  check('cada uno cuesta más que el anterior, y `next` es el siguiente', NIVELES.every((n, i) => i === 0 || n.min > NIVELES[i - 1].min) && NIVELES.every((n, i) => n.next === (NIVELES[i + 1]?.min ?? null)))
  check('8.029 XP es As; 25.000, Maestro; 149, Novato', nivelDeXp(8029).level === 'As' && nivelDeXp(25000).level === 'Maestro' && nivelDeXp(149).level === 'Novato' && nivelDeXp(null).level === 'Novato')
  check('solo Maestro es especial (el degradado)', NIVELES.filter((n) => n.especial).map((n) => n.level).join() === 'Maestro')
  check('los colores, distintos de uno a otro', NIVELES.every((n, i) => i === 0 || n.color !== NIVELES[i - 1].color || n.especial))
  check('rangos: Miembro, Colaborador, Destacado y Leyenda (1, 5, 10)', RANGOS_COLABORADOR.map((r) => `${r.title}:${r.min}`).join() === 'Miembro:0,Colaborador:1,Destacado:5,Leyenda:10' && rangoDeColaborador(12).title === 'Leyenda')
  check('las cifras con su punto de miles', milesXp(8029) === '8.029' && milesXp(150) === '150' && milesXp(25000) === '25.000')
  const { dibujar } = await import(`${REPO}/netlify/functions/insignia.mjs`)
  const svg = dibujar({ nombre: 'PINGU', xp: 8029, aprobadas: 12 })
  check('la insignia de las firmas dice lo mismo (As, Leyenda, su color)', /As/.test(svg) && /Leyenda/.test(svg) && /#ec4899/.test(svg) && !/Coleccionista|Leyenda de la comunidad/.test(svg))
  const fuentes = ['js/gamification.js', 'netlify/functions/insignia.mjs', 'sobre.html'].map((f) => readFileSync(`${REPO}/${f}`, 'utf8')).join('\n')
  check('ya no quedan los nombres viejos', !/Coleccionista|Colaborador destacado|Leyenda de la comunidad/.test(fuentes))
}

console.log('── La migración, contra PostgreSQL ──')
{
  const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q']
  const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 60000 })
  const BD = 'prueba_1124'
  const q = (s) => { const r = psql(['-At', '-d', BD, '-c', s]); return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() } }
  const mig = readFileSync(`${REPO}/supabase-migration-1124-niveles.sql`, 'utf8')
  check('la migración no usa tablas temporales', !/create\s+temp(orary)?\s+table/i.test(mig))
  const hay = psql(['-c', 'select 1'])
  check('hay un PostgreSQL en /var/tmp:5433', hay.status === 0, hay.stderr)
  if (hay.status === 0) {
    psql(['-c', `drop database if exists ${BD}`]); psql(['-c', `create database ${BD}`])
    let r = psql(['-d', BD, '-c', `create table user_profiles (id int primary key, total_xp int, level text);
      insert into user_profiles values (1, 8029, 'Maestro'), (2, 1200, 'Coleccionista'), (3, 0, 'Novato'), (4, null, 'Novato'), (5, 30000, 'Maestro'), (6, 160, 'Novato');`])
    check('el andamio carga', r.status === 0, r.stderr)
    const sinNotify = mig.replace(/notify pgrst[^;]*;/, '')
    r = psql(['-d', BD, '-c', sinNotify])
    check('la 1124 entra', r.status === 0, r.stderr)
    check('  …y otra vez encima', psql(['-d', BD, '-c', sinNotify]).status === 0)
    check('recalcula a todo el mundo con la tabla nueva', q(`select string_agg(id || ':' || level, ',' order by id) from user_profiles`).out === '1:As,2:Rival,3:Novato,4:Novato,5:Maestro,6:Aprendiz', q(`select string_agg(id || ':' || level, ',' order by id) from user_profiles`).out)
    check('nadie pierde XP', q(`select string_agg(coalesce(total_xp::text, 'null'), ',' order by id) from user_profiles`).out === '8029,1200,0,null,30000,160')
    // La base y la web, umbral a umbral, con un punto justo antes y otro en el umbral.
    const malos = []
    for (const n of NIVELES) {
      for (const xp of [n.min, n.min - 1].filter((x) => x >= 0)) {
        const enBase = q(`select nivel_de_xp(${xp})`).out
        if (enBase !== nivelDeXp(xp).level) malos.push(`${xp}: base ${enBase}, web ${nivelDeXp(xp).level}`)
      }
    }
    check('la base y la web dicen el mismo nivel en cada umbral', !malos.length, malos.join(' | '))
    psql(['-c', `drop database if exists ${BD}`])
  }
}

console.log('── La ventana «Niveles» del perfil ──')
{
  const browser = await chromium.launch()
  const errores = []
  const abrir = async (viewport) => {
    const ctx = await browser.newContext({ viewport, locale: 'es-ES', serviceWorkers: 'block' })
    await ctx.addInitScript(() => { window.__FAKE_SESSION__ = 'admin-1'; window.__FAKE_PERFIL__ = { total_xp: 8029 } })
    await ctx.route(/\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
    const p = await ctx.newPage()
    p.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
    await p.goto(`${BASE}/perfil`, { waitUntil: 'domcontentloaded' })
    await p.waitForSelector('#btnLevelInfo', { timeout: 15000 }).catch(() => {})
    await p.waitForTimeout(600)
    await p.click('#btnLevelInfo')
    await p.waitForSelector('.ladder-niveles', { timeout: 5000 }).catch(() => {})
    return p
  }
  const pc = await abrir({ width: 1280, height: 900 })
  const items = await pc.$$eval('.ladder-niveles .ladder-item', (els) => els.map((e) => ({ t: e.innerText.replace(/\s+/g, ' '), cls: e.className, x: Math.round(e.getBoundingClientRect().left) })))
  check('los diez niveles en la ventana', items.length === 10, items.length)
  const tuyo = items.find((i) => /ladder-item-current/.test(i.cls))
  check('el tuyo es As, con lo que te falta (y las cifras con su punto)', /As/.test(tuyo?.t) && /8\.0\d\d \/ 10\.000 XP — te faltan 1\.9\d\d para Alto Mando/.test(tuyo?.t), tuyo?.t)
  check('los que ya pasaste, apagados', items.slice(0, 6).every((i) => /ladder-item-pasado/.test(i.cls)) && !items.slice(7).some((i) => /ladder-item-pasado/.test(i.cls)))
  check('en el PC, a dos columnas', new Set(items.filter((i) => !/current/.test(i.cls)).map((i) => i.x)).size === 2)
  check('Maestro lleva el degradado', (await pc.$('.ladder-niveles .nivel-chapa-especial')) !== null && /gradient/.test(await pc.$eval('.ladder-niveles .nivel-chapa-especial', (e) => getComputedStyle(e).backgroundImage)))
  await pc.screenshot({ path: '/tmp/1124-pc.png' })
  const movil = await abrir({ width: 390, height: 844 })
  const xs = await movil.$$eval('.ladder-niveles .ladder-item', (els) => els.map((e) => Math.round(e.getBoundingClientRect().left)))
  check('en el móvil, a una columna y sin desbordar', new Set(xs).size === 1 && (await movil.evaluate(() => document.documentElement.scrollWidth)) <= 392)
  await movil.screenshot({ path: '/tmp/1124-movil.png' })
  check('sin errores en la página', !errores.length, errores.join(' | '))
  await browser.close()
}

console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
