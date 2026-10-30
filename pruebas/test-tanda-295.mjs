// Tanda 295: un rol para organizar torneos, y solo torneos.
//
// PINGU: una comunidad de fuera se ha organizado —hasta con presidente—
// y quiere llevar los torneos de PokeDoc. Les da el mando de la sección
// «Jugar» y de nada más: ni panel de administración, ni foro, ni guías.
//
// Lo que de verdad manda son las políticas, y eso se prueba contra
// PostgreSQL de verdad en sql-organizadores.sql. Aquí va lo demás: que
// la pantalla diga lo mismo que la base, y que las dos puertas que NO se
// abren sigan cerradas.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync } from 'node:fs'
import { puedeOrganizar, puedeBorrarTorneo } from '/home/user/pingu/js/torneos/comun.js'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 170) : ''}`)
}

const SQL = readFileSync('/home/user/pingu/supabase-migration-torneos-organizadores.sql', 'utf8')
const ADMIN = readFileSync('/home/user/pingu/admin/js/admin.js', 'utf8')

console.log('\n── 1. Quién manda en los torneos ──')
{
  check('el admin del sitio', puedeOrganizar({ is_admin: true }))
  check('el organizador', puedeOrganizar({ is_tournament_admin: true }))
  check('un jugador normal no', !puedeOrganizar({ is_admin: false, is_tournament_admin: false }))
  check('y sin perfil tampoco', !puedeOrganizar(null) && !puedeOrganizar(undefined))
  // Borrar el torneo de otro es de quien manda; el suyo, de cualquiera.
  check('el organizador puede borrar el torneo de otro', puedeBorrarTorneo({ is_tournament_admin: true }, { admin_id: 'otro' }, 'yo'))
  check('y un jugador solo el suyo',
    puedeBorrarTorneo({}, { admin_id: 'yo' }, 'yo') && !puedeBorrarTorneo({}, { admin_id: 'otro' }, 'yo'))
}

console.log('\n── 2. La migración: una sola función para cuarenta políticas ──')
{
  check('hay columna del rol', /add column if not exists is_tournament_admin boolean/.test(SQL))
  const fn = SQL.match(/create or replace function public\.torneos_soy_admin\(\)[\s\S]*?\$\$;/)?.[0] || ''
  check('torneos_soy_admin mira las dos columnas', /p\.is_admin or coalesce\(p\.is_tournament_admin, false\)/.test(fn), fn.slice(0, 120))
  // Todos los permisos de la sección cuelgan de esa función, así que
  // tocarla en un sitio es lo que evita dejarse una política.
  const sitio = SQL.match(/create or replace function public\.torneos_soy_admin_del_sitio\(\)[\s\S]*?\$\$;/)?.[0] || ''
  check('y hay otra solo para el admin del SITIO', Boolean(sitio))
  check('  …que mira solo is_admin', /p\.is_admin\b/.test(sitio) && !/is_tournament_admin/.test(sitio), sitio.slice(0, 140))
}

console.log('\n── 3. Las dos puertas que NO se abren ──')
{
  // (a) La chapa de OFICIAL dice «lo organiza el equipo de la casa». Si
  // la pudiera poner un organizador, dejaría de querer decir nada.
  const trg = SQL.match(/create or replace function public\.torneos_solo_admin_marca_oficial\(\)[\s\S]*?\$\$;/)?.[0] || ''
  check('el disparador de OFICIAL mira al admin del sitio', /torneos_soy_admin_del_sitio\(\)/.test(trg), trg.slice(0, 160))
  check('  …y no a la función ampliada', !/not public\.torneos_soy_admin\(\)/.test(trg))
  const torneos = readFileSync('/home/user/pingu/js/torneos/torneos.js', 'utf8')
  check('y la casilla tampoco se le enseña', /torneoOficialCampo'\)\?\.classList\.toggle\('hidden', !perfil\?\.is_admin\)/.test(torneos))

  // (b) El panel de administración. PINGU fue explícito: nada de eso.
  const puerta = ADMIN.match(/async function checkAccess\(\)[\s\S]*?\n\}/)?.[0] || ''
  check('el panel sigue pidiendo is_admin', /select\('is_admin[,']/.test(puerta) && /!profile\?\.is_admin/.test(puerta), puerta.slice(0, 200))
  check('  …y NO deja pasar al organizador', !/is_tournament_admin/.test(puerta), puerta.slice(0, 200))
}

console.log('\n── 4. Que nadie se dé el rol a sí mismo ──')
{
  // El disparador que ya había devolvía a su sitio el título de foro y
  // la moderación, pero NO is_admin. Desde el repositorio no se puede
  // saber si la política de user_profiles deja editarse la propia fila
  // —esas políticas se pusieron a mano en Supabase—, así que se cierra
  // por el lado que sí se controla.
  const trg = SQL.match(/create or replace function public\.solo_admin_da_titulos\(\)[\s\S]*?\$\$;/)?.[0] || ''
  check('el disparador del perfil se rehace', Boolean(trg))
  check('  …y ahora protege is_admin', /new\.is_admin := old\.is_admin/.test(trg))
  check('  …y el rol de torneos', /new\.is_tournament_admin := coalesce\(old\.is_tournament_admin, false\)/.test(trg))
  check('  …sin perder lo de antes', /new\.forum_title := old\.forum_title/.test(trg) && /new\.is_moderator := old\.is_moderator/.test(trg))
}

console.log('\n── 5. El interruptor, en el panel ──')
{
  // Desde la 1121 los roles son interruptores en la ficha de cada persona
  // (admin/js/usuarios-admin.js), no un botón por fila.
  const US = readFileSync(`/home/user/pingu/admin/js/usuarios-admin.js`, 'utf8')
  const rol = US.match(/\{ col: 'is_tournament_admin'[^\n]*\}/)?.[0] || ''
  check('el rol de torneos es un interruptor de la ficha', Boolean(rol) && /data-us-rol="\$\{r\.col\}"/.test(US), rol.slice(0, 120))
  check('escribe la columna del rol', /\.update\(\{ \[col\]: valor \}\)/.test(US))
  check('y avisa si falta la migración', /migracion: 'supabase-migration-torneos-organizadores\.sql'/.test(rol))
  check('el panel dice qué da el rol', /Crea y lleva cualquier torneo/.test(rol))
  check('  …hasta dónde llega', /y de nada más: ni este panel/.test(rol))
  check('  …y lo único que se le queda fuera', /Lo único que no puede es marcar/.test(rol))
  // En Postgres, pedir una columna que no existe tumba la consulta ENTERA.
  // La escalera de escalones se cambió por quitar las opcionales de UNA en
  // una según lo que diga la base: el rol y el color, cada uno por su lado.
  check('faltar el rol o el color no tumba la lista (opcionales, de una en una)', /const OPCIONALES = new Set\([^)]*'forum_title_color'[^)]*'is_tournament_admin'/.test(US) && /cols\.splice\(cols\.indexOf\(falta\), 1\)/.test(US))
  check('sin la columna, el interruptor sale apagado y dice qué migración falta', /const hay = estado\.cols\.has\(r\.col\)/.test(US) && /\$\{hay \? '' : 'disabled'\}/.test(US))
}

console.log('\n── 6. En pantalla ──')
{
  const BASE = 'http://localhost:8892'
  const browser = await chromium.launch()
  const TORNEO = {
    id: 'torneo-1', slug: 'copa', name: 'Copa de PINGU', status: 'registration_open',
    admin_id: 'admin-1', max_players: 8, swiss_rounds: 3, swiss_bo: 1,
  }
  const abrir = async (perfil) => {
    const page = await browser.newPage({ viewport: { width: 1150, height: 1000 } })
    const errores = []
    page.on('pageerror', (e) => errores.push(String(e).slice(0, 170)))
    await page.addInitScript((p) => {
      window.__FAKE_SESSION__ = 'user-1'
      window.__FAKE_PERFIL__ = p
      window.__FAKE_TORNEOS__ = [{
        id: 'torneo-1', slug: 'copa', name: 'Copa de PINGU', status: 'registration_open',
        admin_id: 'admin-1', max_players: 8, swiss_rounds: 3, swiss_bo: 1,
      }]
    }, perfil)
    await page.goto(`${BASE}/torneo?slug=copa`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2400)
    return { page, errores }
  }

  // Se miran los botones de MANDO por su id. Contar los de la caja entera
  // no vale: ahí va también el de «añadir al calendario», que es para
  // todo el mundo y no manda en nada.
  const DE_MANDO = '#btnCerrarInscripciones, #btnAbrirInscripciones, #btnReabrirInscripciones, #btnEditarTorneo, #btnCancelarTorneo, #btnBorrarTorneo'

  const organiza = await abrir({ is_admin: false, is_tournament_admin: true })
  const botones = await organiza.page.locator(DE_MANDO).count()
  const cuales = await organiza.page.locator(DE_MANDO).evaluateAll((n) => n.map((b) => b.id))
  check('un organizador ve las herramientas del torneo de otro', botones >= 3, cuales.join(', '))
  check('  …incluida la de editar', cuales.includes('btnEditarTorneo'), cuales.join(', '))
  check('  …y la de cancelar', cuales.includes('btnCancelarTorneo'), cuales.join(', '))
  check('sin errores', organiza.errores.length === 0, organiza.errores.join(' | '))
  await organiza.page.close()

  const normal = await abrir({ is_admin: false, is_tournament_admin: false })
  const suyos = await normal.page.locator(DE_MANDO).evaluateAll((n) => n.map((b) => b.id))
  // Del torneo de OTRO, un jugador normal no manda: ni antes ni ahora.
  check('y un jugador normal no ve ninguna', suyos.length === 0, suyos.join(', '))
  await normal.page.close()
  await browser.close()
}

console.log('\n── 7. La prueba contra PostgreSQL ──')
{
  const proof = readFileSync('/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad/sql-organizadores.sql', 'utf8')
  check('aplica la migración de verdad', /\\i \/home\/user\/pingu\/supabase-migration-torneos-organizadores\.sql/.test(proof))
  check('prueba que manda en el torneo de otro', /Copa, llevada por el equipo/.test(proof))
  check('que un jugador normal no', /me la apropio/.test(proof))
  check('que no puede marcar OFICIAL', /Torneo del equipo/.test(proof))
  check('que el admin del sitio sí', /Torneo de la casa/.test(proof))
  // Y el caso peor a propósito: aunque la política dejara editarse la
  // propia fila, el disparador tiene que aguantar.
  check('y que nadie se da el rol a sí mismo', /perfiles_editar[\s\S]*?id = auth\.uid\(\)/.test(proof))
}

console.log(`\n${fails === 0 ? '✅ TODO BIEN' : `❌ ${fails} FALLOS`}`)
process.exit(fails ? 1 : 0)
