// Tanda 296: quien crea un torneo, lo lleva.
//
// PINGU: «sí, que quien crea un torneo pueda llevarlo, es lo suyo».
//
// Crear está abierto a todo el mundo desde la tanda 266 y la base ya
// dejaba al creador llevar el ciclo, pero la pantalla solo enseñaba las
// herramientas a los admin — y las políticas de alrededor (bajas,
// decklists, jueces, llamadas, chats) seguían siendo del admin del
// sitio.
//
// Lo que de verdad manda son las políticas, y eso se prueba contra
// PostgreSQL en sql-dueno.sql. Aquí va lo demás: que la pantalla diga
// EXACTAMENTE lo mismo que la base, y que lo que no se abre siga
// cerrado.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync } from 'node:fs'
import { puedeLlevar, puedeOrganizar, puedeBorrarTorneo } from '/home/user/pingu/js/torneos/comun.js'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 200) : ''}`)
}

const R = (f) => readFileSync('/home/user/pingu/' + f, 'utf8')
const SQL = R('supabase-migration-torneos-dueno.sql')
const LISTAS = R('supabase-migration-torneos-listas.sql')
const TORNEO = R('js/torneos/torneo.js')
const RONDA = R('js/torneos/ronda.js')
const JUECES = R('js/torneos/jueces.js')

const MIO = { id: 't1', admin_id: 'yo' }
const DE_OTRO = { id: 't2', admin_id: 'otro' }

console.log('\n── 1. Quién lleva ESTE torneo ──')
{
  check('quien lo creó', puedeLlevar({}, MIO, 'yo'))
  check('el admin del sitio, sea suyo o no', puedeLlevar({ is_admin: true }, DE_OTRO, 'yo'))
  check('el organizador de torneos, también', puedeLlevar({ is_tournament_admin: true }, DE_OTRO, 'yo'))
  check('un jugador normal en el torneo de otro NO', !puedeLlevar({}, DE_OTRO, 'yo'))
  check('y sin sesión tampoco', !puedeLlevar({}, MIO, null) && !puedeLlevar(null, MIO, undefined))
  // El caso que se cuela si se compara con `==` o sin comprobar nulos:
  // un torneo sin admin_id y alguien sin id no son «la misma persona».
  check('un torneo sin dueño no es de nadie', !puedeLlevar({}, { id: 't3' }, 'yo'))
  check('y sin id de usuario, menos', !puedeLlevar({}, { id: 't3', admin_id: null }, null))
  // Borrar es el MISMO criterio: que lo diga una vez y no dos.
  check('borrar dice lo mismo que llevar',
    puedeBorrarTorneo({}, MIO, 'yo') === puedeLlevar({}, MIO, 'yo') &&
    puedeBorrarTorneo({}, DE_OTRO, 'yo') === puedeLlevar({}, DE_OTRO, 'yo'))
  // Y el rol sigue existiendo por separado: es lo que mira el panel.
  check('el rol, aparte, sigue siendo el rol', puedeOrganizar({ is_tournament_admin: true }) && !puedeOrganizar({}))
}

console.log('\n── 2. La función de la base, y que la pantalla la copie ──')
{
  const fn = SQL.match(/create or replace function public\.torneos_mando\(p_torneo uuid\)[\s\S]*?\$\$;/)?.[0] || ''
  check('hay torneos_mando(uuid)', Boolean(fn))
  check('  …que es admin O dueño', /torneos_soy_admin\(\)/.test(fn) && /t\.admin_id = auth\.uid\(\)/.test(fn), fn.slice(0, 200))
  // Sin `security definer` la función vería lo que ve quien pregunta, y
  // con RLS por medio diría que no a casi todo.
  check('  …y es security definer', /security definer/.test(fn))
  check('  …y la puede llamar cualquiera', /grant execute on function public\.torneos_mando\(uuid\) to anon, authenticated/.test(SQL))

  // Las tablas que el día del torneo hacen falta. Si una se queda sin
  // torneos_mando, su botón sale pintado y no hace nada: un UPDATE que
  // la política rechaza NO da error.
  // Se miran las DOS MITADES por separado. Mirar la política entera no
  // vale: cambiando solo el `using` para que vuelva a pedir admin, el
  // `with check` seguiría teniendo torneos_mando y la comprobación
  // pasaría — que es justo lo que el rigor pilló.
  for (const [politica, tabla] of [
    ['inscripciones_baja', 'tournament_registrations'],
    ['inscripciones_admin', 'tournament_registrations'],
    ['decklists_ver', 'tournament_decklists'],
    ['decklists_editar', 'tournament_decklists'],
    ['jueces_decidir', 'judge_applications'],
    ['llamadas_ver', 'judge_calls'],
    ['llamadas_resolver', 'judge_calls'],
    ['mensajes_mesa', 'match_messages'],
    ['mensajes_llamada', 'judge_messages'],
    ['reportes_ver', 'match_reports'],
    ['torneos_escribir', 'rounds'],
    ['torneos_escribir', 'tournament_matches'],
    ['torneos_escribir', 'match_results'],
    ['torneos_escribir', 'pairing_history'],
  ]) {
    const re = new RegExp(`create policy ${politica} on public\\.${tabla} for [\\s\\S]*?;`)
    const cuerpo = SQL.match(re)?.[0] || ''
    const [usando, escribiendo] = cuerpo.split(/\bwith check\b/)
    check(`  ${tabla}/${politica}: el using pasa por torneos_mando`,
      /torneos_mando\(/.test(usando || ''), cuerpo ? (usando || '').slice(0, 90) : 'NO ESTÁ')
    // Solo las que escriben tienen `with check`; una de SELECT o DELETE
    // no lo lleva, y exigirlo sería exigir lo que no existe.
    if (escribiendo !== undefined) {
      check(`  ${tabla}/${politica}: y el with check también`,
        /torneos_mando\(/.test(escribiendo), escribiendo.slice(0, 90))
    }
  }

  // Y lo que NO se abre: el sello de oficial sigue siendo del admin del
  // SITIO, así que esta migración no toca su disparador.
  check('el sello de OFICIAL no se toca aquí', !/torneos_solo_admin_marca_oficial/.test(SQL.replace(/^--.*$/gm, '')))
  check('  …ni la función del admin del sitio', !/create or replace function public\.torneos_soy_admin_del_sitio/.test(SQL))
}

console.log('\n── 3. La regla de visibilidad de las decklists, intacta ──')
{
  // La parte «para todos los demás» tiene que ser la MISMA que la de
  // torneos-listas.sql. Si se desalinea, se ven mazos que no tocan y el
  // fallo no da la cara: se ve bien en pantalla, solo que de más.
  const trozo = (txt) => {
    // Del CUERPO de decklists_ver, la parte que va desde «or exists» —el
    // resto de la política (quién manda, los jueces, cada cual la suya)
    // sí cambia aquí a propósito.
    const pol = txt.match(/create policy decklists_ver on public\.tournament_decklists for select[\s\S]*?\n\s*\);/)?.[0] || ''
    const plano = pol.replace(/\s+/g, ' ').trim()
    const desde = plano.indexOf('or exists ( select 1 from public.tournaments t')
    return desde < 0 ? '' : plano.slice(desde).replace(/[\s)]+;?$/, '')
  }
  const aqui = trozo(SQL)
  const alli = trozo(LISTAS)
  check('la regla existe en los dos sitios', Boolean(aqui) && Boolean(alli))
  check('  …y dice lo mismo, carácter a carácter', aqui === alli, aqui.slice(0, 150) + ' ≠ ' + alli.slice(0, 150))
  // Y quien lleva el torneo entra por su puerta, no por esa.
  const ver = SQL.match(/create policy decklists_ver [\s\S]*?;\n/)?.[0] || ''
  check('quien lleva el torneo ve las listas', /torneos_mando\(tournament_id\)/.test(ver))
  check('  …y los jueces siguen viéndolas', /torneos_soy_juez\(tournament_id\)/.test(ver))
  check('  …y cada cual la suya', /user_id = auth\.uid\(\)/.test(ver))
}

console.log('\n── 4. El arreglo de los chats (tanda 294) va incorporado ──')
{
  // Esta migración vuelve a escribir las dos políticas de chat. Si al
  // hacerlo se dejara el `with check` flojo, se reabriría la puerta de
  // atrás: en Postgres un INSERT no mira el `using`.
  for (const tabla of ['match_messages', 'judge_messages']) {
    const pol = SQL.match(new RegExp(`create policy \\w+ on public\\.${tabla} for all[\\s\\S]*?\\n  \\);`))?.[0] || ''
    const using = pol.split('with check')[0] || ''
    const conCheck = pol.split('with check')[1] || ''
    check(`${tabla}: el with check firma`, /sender_id = auth\.uid\(\)/.test(conCheck))
    const pertenencia = (t) => (t.match(/torneos_mando\(|torneos_soy_juez\(|player_a_id|created_by/g) || []).length
    check(`  …y repite la pertenencia del using`, pertenencia(conCheck) >= pertenencia(using) && pertenencia(using) > 0,
      `using ${pertenencia(using)} / check ${pertenencia(conCheck)}`)
    // Y las dos con `and`, no con `or`. Contar las condiciones no basta:
    // «firma O pertenece» las tiene todas y deja entrar a cualquiera que
    // firme con su nombre, que es el agujero de la tanda 294 otra vez.
    check(`  …y las une con AND, no con OR`,
      /sender_id = auth\.uid\(\)\s*\n\s*and exists/.test(conCheck), conCheck.slice(0, 80))
  }
}

console.log('\n── 5. La ficha ya no pregunta por el rol, sino por el mando ──')
{
  for (const [nombre, txt] of [['torneo.js', TORNEO], ['ronda.js', RONDA], ['jueces.js', JUECES]]) {
    check(`${nombre} define mando()`, /const mando = \(\) => puedeLlevar\(/.test(txt))
    // Ninguna puerta de la ficha puede volver a mirar solo el rol: eso
    // dejaría fuera al que montó el torneo.
    check(`  …y no queda ningún puedeOrganizar(`, !/puedeOrganizar\(/.test(txt))
  }
  // La casilla de OFICIAL es la excepción, y se queda en is_admin a
  // secas: no es «llevar el torneo», es el sello de la casa.
  check('la casilla de oficial sigue siendo del admin del sitio',
    /torneoOficialCampo'\)\?\.classList\.toggle\('hidden', !perfil\?\.is_admin\)/.test(R('js/torneos/torneos.js')))
}

console.log('\n── 6. Los rechazos en silencio, a la vista ──')
{
  // Los dos UPDATE de inscripciones que hace quien lleva el torneo. Sin
  // `.select()`, una política que rechaza devuelve cero filas SIN error
  // y la pantalla canta victoria.
  const expulsar = TORNEO.match(/\[data-expulsar\][\s\S]*?\n  \)\n\}/)?.[0] || ''
  check('expulsar mira cuántas filas volvieron', /\.select\('id'\)/.test(expulsar) && /!data\?\.length/.test(expulsar), expulsar.slice(0, 120))
  check('  …y avisa de qué SQL falta', /avisoDeMigracion\('supabase-migration-torneos-dueno\.sql'\)/.test(expulsar))

  const retirar = RONDA.match(/async function retirarNoConfirmados\(\)[\s\S]*?\n\}/)?.[0] || ''
  check('retirar no-confirmados, igual', /\.select\('id'\)/.test(retirar) && /!data\?\.length/.test(retirar))
  // Y lo que devuelve tiene que ser lo que DE VERDAD se retiró: si
  // devolviera la lista de intención, el aviso nombraría a gente que
  // sigue en el torneo y el pareo contaría mal.
  check('  …y devuelve solo a quien se retiró de verdad', /return retirados/.test(retirar) && !/return fuera/.test(retirar))
}

console.log('\n── 7. En pantalla: el torneo es MÍO ──')
{
  const BASE = 'http://localhost:8892'
  const browser = await chromium.launch()
  const abrir = async (perfil, adminId) => {
    const page = await browser.newPage({ viewport: { width: 1150, height: 1000 } })
    const errores = []
    page.on('pageerror', (e) => errores.push(String(e).slice(0, 170)))
    await page.addInitScript(([p, dueno]) => {
      window.__FAKE_SESSION__ = 'user-1'
      window.__FAKE_PERFIL__ = p
      window.__FAKE_TORNEOS__ = [{
        id: 'torneo-1', slug: 'copa', name: 'La pachanga', status: 'registration_open',
        admin_id: dueno, max_players: 8, swiss_rounds: 3, swiss_bo: 1,
      }]
    }, [perfil, adminId])
    await page.goto(`${BASE}/torneo?slug=copa`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2400)
    return { page, errores }
  }
  const DE_MANDO = '#btnCerrarInscripciones, #btnAbrirInscripciones, #btnReabrirInscripciones, #btnEditarTorneo, #btnCancelarTorneo, #btnBorrarTorneo'

  // El caso de PINGU: un miembro normal que montó su pachanga.
  const mia = await abrir({ is_admin: false, is_tournament_admin: false }, 'user-1')
  const cuales = await mia.page.locator(DE_MANDO).evaluateAll((n) => n.map((b) => b.id))
  check('quien montó el torneo ve las herramientas', cuales.length >= 3, cuales.join(', '))
  check('  …incluida cerrar inscripciones', cuales.includes('btnCerrarInscripciones'), cuales.join(', '))
  check('  …y editar', cuales.includes('btnEditarTorneo'), cuales.join(', '))
  check('sin errores', mia.errores.length === 0, mia.errores.join(' | '))
  await mia.page.close()

  // Y el de al lado: el mismo perfil, en el torneo de otro.
  const ajena = await abrir({ is_admin: false, is_tournament_admin: false }, 'otra-persona')
  const ningunos = await ajena.page.locator(DE_MANDO).evaluateAll((n) => n.map((b) => b.id))
  check('y en el torneo de otro, ninguna', ningunos.length === 0, ningunos.join(', '))
  await ajena.page.close()
  await browser.close()
}

console.log('\n── 8. La prueba contra PostgreSQL ──')
{
  const proof = readFileSync('/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad/sql-dueno.sql', 'utf8')
  check('aplica el fichero de migración de verdad',
    /\\i \/home\/user\/pingu\/supabase-migration-torneos-dueno\.sql/.test(proof))
  check('prueba la baja en su torneo', /da de baja a Misty en SU torneo/.test(proof))
  check('prueba el deck check', /ve la decklist de Misty/.test(proof))
  check('prueba que nombra jueces', /aprueba a Brock como juez/.test(proof))
  check('prueba que NO manda en el de otro', /NO manda en el torneo de PINGU/.test(proof))
  check('prueba que no se sella oficial', /NO puede ponerle el sello de OFICIAL/.test(proof))
  check('y que la puerta de los chats sigue cerrada', /GARY sigue sin poder escribir/.test(proof))
}

console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
