// Tanda 293: el puente que mentía.
//
// PINGU preguntó qué más podía fallar en un torneo, porque lo de los
// pareos lo descubrieron JUGANDO. Buscando salió esto, y es peor que lo
// de los pareos porque no se ve:
//
// Desde la apertura (tanda 252), un jugador NO escribe en las tablas del
// torneo: la única puerta son las RPC. Pero el cliente guardaba un
// «camino viejo» para cuando la RPC no estuviera — y ese camino escribe
// a pelo, la política lo rechaza, y un INSERT rechazado por RLS **NO DA
// ERROR**: no toca nada y vuelve como si todo hubiera ido bien.
//
// Resultado: la web decía «Reportado» en verde y no se había reportado
// nada. Dos casos en vivo:
//
//   · Entre desplegar la tanda 291 y ejecutar su SQL, NADIE podía
//     reportar un resultado (esa migración quita la RPC vieja).
//   · Y desde que un torneo se llena, nadie podía apuntarse a la cola,
//     porque eso SIEMPRE iba por el camino viejo.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync } from 'node:fs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 170) : ''}`)
}

const RONDA = readFileSync('/home/user/pingu/js/torneos/ronda.js', 'utf8')
const FICHA = readFileSync('/home/user/pingu/js/torneos/torneo.js', 'utf8')
const COMUN = readFileSync('/home/user/pingu/js/torneos/comun.js', 'utf8')

// El cuerpo de una función, para mirar SOLO lo que hace ella.
const cuerpoDe = (fuente, firma) => {
  const i = fuente.indexOf(firma)
  if (i < 0) return ''
  const fin = fuente.indexOf('\n}\n', i)
  return fuente.slice(i, fin > 0 ? fin : i + 4000)
}

console.log('\n── 1. Ningún camino de jugador escribe a pelo ──')
{
  // Estas tres tablas son de escritura solo por RPC. Un `.insert` o un
  // `.update` del cliente aquí no escribe nada Y NO AVISA.
  const PROHIBIDO = /\.from\('(match_reports|tournament_registrations|tournament_matches)'\)[\s\S]{0,120}?\.(insert|update)\(/

  const reportar = cuerpoDe(RONDA, 'async function reportar(partida, resultado, juego = 0)')
  check('reportar existe', reportar.length > 100)
  check('reportar no escribe a pelo', !PROHIBIDO.test(reportar), reportar.match(PROHIBIDO)?.[0])

  const checkin = cuerpoDe(RONDA, 'const res = await supabase.rpc(\'torneos_checkin\'')
  check('el check-in tampoco', !PROHIBIDO.test(checkin), checkin.match(PROHIBIDO)?.[0])

  const inscribir = cuerpoDe(FICHA, 'function engancharInscripcion(')
  check('y la inscripción tampoco', !PROHIBIDO.test(inscribir), inscribir.match(PROHIBIDO)?.[0])
}

console.log('\n── 2. Cuando falta la RPC, se DICE ──')
{
  check('hay un aviso con el nombre del fichero', /export function avisoDeMigracion/.test(COMUN))
  check('y dice que así no se puede hacer', /no se puede hacer/.test(COMUN))

  for (const [que, cuerpo, fichero] of [
    ['reportar', cuerpoDe(RONDA, 'async function reportar(partida, resultado, juego = 0)'), 'torneos-bo3'],
    ['el check-in', cuerpoDe(RONDA, "const res = await supabase.rpc('torneos_checkin'"), 'torneos-publico'],
    ['la inscripción', cuerpoDe(FICHA, 'function engancharInscripcion('), 'torneos-cola'],
  ]) {
    check(`${que} avisa de la migración`, new RegExp(`avisoDeMigracion\\('supabase-migration-${fichero}`).test(cuerpo), cuerpo.match(/avisoDeMigracion\([^)]*\)/)?.[0])
    check(`  …y se para ahí`, /faltaLaRpc\(res\.error\)\) \{[\s\S]{0,400}?return/.test(cuerpo))
  }
}

console.log('\n── 3. La cola de espera va por la RPC ──')
{
  const inscribir = cuerpoDe(FICHA, 'function engancharInscripcion(')
  check('se manda si es para la cola', /p_cola: Boolean\(aLaCola\)/.test(inscribir), inscribir.match(/p_cola[^,\n]*/)?.[0])
  // El recuento del navegador sobraba: lo hace la RPC bajo candado, que
  // además cierra la carrera de dos inscripciones a la vez.
  check('y ya no se cuenta desde el navegador', !/count: 'exact', head: true/.test(inscribir))
}

console.log('\n── 4. La migración de la cola ──')
{
  const sql = readFileSync('/home/user/pingu/supabase-migration-torneos-cola.sql', 'utf8')
  // Misma trampa que en la del BO3: `create or replace` con otra firma
  // crea una SOBRECARGA, y con el parámetro por defecto la llamada de
  // dos argumentos quedaría ambigua y rompería TODAS las inscripciones.
  check('quita la RPC vieja', /drop function if exists public\.torneos_inscribirse\(uuid, text\)/.test(sql))
  check('y crea la nueva con la cola', /torneos_inscribirse\(\s*p_torneo uuid, p_tcg_live text, p_cola boolean default false/.test(sql))
  check('a la cola se va si se pide', /if p_cola or v_lleno then/.test(sql))
  // Si se llenó mientras rellenaba el formulario, no se le echa.
  check('o si el torneo se llenó por el camino', /v_lleno := v_torneo\.max_players is not null/.test(sql))
  check('sigue contando bajo candado', /for update/.test(sql))
  check('y sin aforo no hay cupo que mirar', /max_players is not null/.test(sql))
}

const BASE = 'http://localhost:8892'
const browser = await chromium.launch()

console.log('\n── 5. En pantalla: se avisa y NO se escribe nada ──')
{
  const page = await browser.newPage({ viewport: { width: 1150, height: 1000 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 170)))
  await page.addInitScript(() => {
    window.__FAKE_SESSION__ = 'user-1'
    window.__FAKE_TORNEOS__ = [{ id: 'torneo-1', slug: 'copa', name: 'Copa', status: 'in_progress', admin_id: 'admin-1', max_players: 8, swiss_rounds: 3, swiss_bo: 1, top_cut_bo: 1 }]
    window.__FAKE_INSCRIPCIONES__ = [
      { id: 'ins-1', tournament_id: 'torneo-1', user_id: 'user-1', status: 'active', tcg_live_username: 'Ash' },
      { id: 'ins-2', tournament_id: 'torneo-1', user_id: 'user-2', status: 'active', tcg_live_username: 'Misty' },
    ]
    window.__FAKE_RONDAS__ = [{ id: 'ronda-1', tournament_id: 'torneo-1', round_number: 1, phase: 'swiss', status: 'active', ends_at: null }]
    window.__FAKE_MESAS__ = [{ id: 'mesa-1', round_id: 'ronda-1', table_number: 1, player_a_id: 'user-1', player_b_id: 'user-2', status: 'active', check_in_a_at: new Date().toISOString(), check_in_b_at: new Date().toISOString() }]
    window.__FAKE_REPORTES__ = []
    // La base todavía sin la migración: la función no existe.
    window.__RPC_ERROR__ = {
      torneos_reportar: { code: 'PGRST202', message: 'Could not find the function public.torneos_reportar' },
    }
  })
  await page.goto(`${BASE}/torneo?slug=copa`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)

  const antes = await page.evaluate(() => window.__TABLAS__.match_reports.length)
  await page.locator('[data-reporte="win"]').first().click()
  await page.waitForTimeout(700)
  const despues = await page.evaluate(() => window.__TABLAS__.match_reports.length)

  // ESTO es el fallo: antes se escribía (o se creía escribir) y la
  // pantalla daba la enhorabuena.
  check('no se apunta nada', antes === despues, `${antes} → ${despues}`)
  const aviso = await page.locator('[class*="toast"]').first().textContent().catch(() => '')
  check('y se dice qué falta', /supabase-migration-torneos-bo3\.sql/.test(aviso || ''), aviso)
  check('no se le dice que ha ido bien', !/Reportado/.test(aviso || ''), aviso)
  check('sin errores de página', errores.length === 0, errores.join(' | '))
  await page.close()
}

await browser.close()
console.log(`\n${fails === 0 ? '✅ TODO BIEN' : `❌ ${fails} FALLOS`}`)
process.exit(fails ? 1 : 0)
