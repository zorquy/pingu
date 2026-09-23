// Tanda 337 — el check-in de una mesa que sigue viva.
//
// Reportado en un torneo de verdad: sin que hubieran pasado los 5
// minutos de check-in, una mesa no dejaba marcarse listo y soltaba
// «Esta mesa ya no admite check-in.»
//
// El camino, que no tiene nada que ver con el tiempo: el rival reporta
// antes de que tú hagas check-in, la mesa pasa a
// `awaiting_confirmation`, y el botón SIGUE ahí porque el cliente lo
// pintaba mirando solo si tú estabas listo. Lo pulsas y el servidor lo
// rechaza, porque solo admitía `pending` y `active`.
//
// El mensaje mentía dos veces: ni era «ya», ni tenía que ver con la
// ventana de tiempo que la persona estaba mirando.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync } from 'node:fs'
import { forfeitPorCheckin } from '/home/user/pingu/netlify/functions/torneos-barredor.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 200) : ''}`)
}
const BASE = 'http://localhost:8892'
const leer = (f) => readFileSync(`/home/user/pingu/${f}`, 'utf8')
const browser = await chromium.launch()

const TORNEO = {
  id: 'torneo-1', slug: 'copa', name: 'Copa de Prueba', status: 'in_progress',
  admin_id: 'admin-1', max_players: 8, swiss_rounds: 3, checkin_minutes: 5,
  current_round_id: 'ronda-1',
}
const INSCRIPCIONES = [
  { id: 'ins-1', tournament_id: 'torneo-1', user_id: 'user-1', status: 'active', tcg_live_username: 'AshKetchum' },
  { id: 'ins-2', tournament_id: 'torneo-1', user_id: 'user-2', status: 'active', tcg_live_username: 'MistyW' },
]
// La ronda acaba de empezar: la ventana de check-in está ABIERTA. Esa
// es la mitad del fallo — el error hablaba de una ventana cerrada que
// no lo estaba.
const RONDA = {
  id: 'ronda-1', tournament_id: 'torneo-1', round_number: 1, phase: 'swiss', status: 'active',
  started_at: new Date().toISOString(), ends_at: new Date(Date.now() + 50 * 60000).toISOString(),
}
const mesa = (status) => [{
  id: 'mesa-1', round_id: 'ronda-1', tournament_id: 'torneo-1', table_number: 1,
  player_a_id: 'user-1', player_b_id: 'user-2', status,
  // El rival SÍ hizo check-in; yo no. Es el reparto del caso real.
  check_in_a_at: null, check_in_b_at: new Date().toISOString(),
}]

async function abrir(status) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 170)))
  await page.addInitScript((s) => {
    window.__FAKE_SESSION__ = 'user-1'
    window.__FAKE_TORNEOS__ = s.torneos
    window.__FAKE_INSCRIPCIONES__ = s.inscripciones
    window.__FAKE_RONDAS__ = s.rondas
    window.__FAKE_MESAS__ = s.mesas
  }, { torneos: [TORNEO], inscripciones: INSCRIPCIONES, rondas: [RONDA], mesas: mesa(status) })
  await page.goto(`${BASE}/torneo?slug=copa`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  return { page, errores }
}

// Los nueve estados que puede tener una mesa, sacados de la propia
// tabla: si mañana alguien añade uno, esta prueba lo recorre solo.
const ESTADOS = (leer('supabase-migration-torneos.sql')
  .match(/check \(status in \(('pending','active','awaiting_confirmation'[^)]*)\)\)/)?.[1] || '')
  .split(',').map((x) => x.trim().replace(/'/g, '')).filter(Boolean)

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. En qué estados ofrece el botón la pantalla ──')
const ofrecen = []
{
  check('se conocen los nueve estados de una mesa', ESTADOS.length === 9, ESTADOS.join(','))
  for (const status of ESTADOS) {
    const { page, errores } = await abrir(status)
    const hay = (await page.locator('#btnCheckin').count()) === 1
    if (hay) ofrecen.push(status)
    check(`${status}: ${hay ? 'se ofrece' : 'no se ofrece'} el check-in`, errores.length === 0, errores.join(' | '))
    await page.close()
  }
  console.log(`     → lo ofrece en: ${ofrecen.join(', ') || '(ninguno)'}`)
  // El del fallo tiene que estar: el rival ha reportado, yo aún no me he
  // marcado, y la ventana de check-in sigue abierta.
  check('lo ofrece en `awaiting_confirmation`, que es el caso del fallo',
    ofrecen.includes('awaiting_confirmation'), ofrecen.join(','))
  check('…y también en `active`, que es lo normal', ofrecen.includes('active'))
  // Y no en una mesa acabada, donde no tendría sentido.
  for (const cerrado of ['finished', 'bye', 'forfeit_a', 'forfeit_b', 'forfeit_both']) {
    check(`…y no en \`${cerrado}\``, !ofrecen.includes(cerrado))
  }
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. Y el servidor acepta TODOS los que ofrece ──')
{
  // Este es el invariante, y es el que faltaba. No que las dos listas
  // sean idénticas —el servidor puede ser más permisivo sin que pase
  // nada— sino que **la pantalla no ofrezca nada que el servidor vaya a
  // rechazar**. Con la lista vieja (`pending`, `active`),
  // `awaiting_confirmation` se ofrecía y se rechazaba: ese era el fallo.
  const sql = leer('supabase-migration-checkin-mesa-viva.sql')
  const guardia = sql.match(/v_m\.status not in \(([^)]*)\)/)
  check('la función tiene su guarda', Boolean(guardia))
  const acepta = (guardia?.[1] || '').split(',').map((x) => x.trim().replace(/'/g, '')).filter(Boolean)
  for (const status of ofrecen) {
    check(`el servidor acepta \`${status}\``, acepta.includes(status),
      `acepta: ${acepta.join(',')}`)
  }
  // Y al revés no hace falta: que acepte alguno que la pantalla no
  // ofrezca no rompe nada. Pero que acepte una mesa ACABADA sí sería un
  // fallo, porque el check-in ya no significaría nada.
  for (const cerrado of ['finished', 'bye', 'forfeit_a', 'forfeit_b', 'forfeit_both']) {
    check(`…y no acepta \`${cerrado}\``, !acepta.includes(cerrado), acepta.join(','))
  }

  // Y el mensaje ya no habla de una ventana de tiempo que no se ha
  // cerrado, que era la mitad de la confusión. Se mira la línea del
  // `raise`, no el fichero: los comentarios citan el mensaje viejo al
  // contar el fallo.
  const raise = sql.match(/raise exception '([^']*check-in[^']*)'/g) || []
  check('ya no se dice «ya no admite check-in»',
    !raise.some((r) => /ya no admite check-in/.test(r)), raise.join(' | '))
  check('…sino que la mesa está cerrada',
    raise.some((r) => /ya está cerrada/.test(r)), raise.join(' | '))
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. Abrirlo no reabre ninguna puerta ──')
{
  // La duda razonable: ¿un check-in tardío puede cambiar un resultado?
  // No: el barredor que da la ronda por perdida a quien no aparece solo
  // mira las mesas en `active`, así que una que ya espera confirmación
  // no pasa por ahí.
  const barredor = leer('netlify/functions/torneos-barredor.mjs')
  check('el barredor solo cae sobre las mesas activas',
    /const activas = \(partidas \|\| \[\]\)\.filter\(\(m\) => m\.status === 'active'\)/.test(barredor))

  // Y la regla de quién pierde no cambia: se sigue decidiendo por quién
  // hizo check-in, no por el estado.
  check('con los dos, no cae nadie',
    forfeitPorCheckin({ check_in_a_at: 'x', check_in_b_at: 'x' }) === null)
  check('sin el de A, cae A',
    forfeitPorCheckin({ check_in_a_at: null, check_in_b_at: 'x', player_b_id: 'u2' })?.status === 'forfeit_a')
  check('sin ninguno, caen los dos',
    forfeitPorCheckin({ check_in_a_at: null, check_in_b_at: null })?.status === 'forfeit_both')
}

console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
await browser.close()
process.exit(fails === 0 ? 0 : 1)
