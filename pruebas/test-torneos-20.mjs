import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

// Tanda 228: el ESCAPARATE. Un enlace de torneo compartido tiene que
// enseñar algo a quien no ha entrado — el cartel, quién juega, las mesas
// y la clasificación — y NADA de lo que es privado: decklists, chats,
// jueces y el usuario de TCG Live de nadie.
//
// La barrera de verdad es la RLS (comprobada aparte contra PostgreSQL en
// sql-torneos-anon.sql). Aquí se prueba lo otro: que la PANTALLA no
// pinte lo que no debe y que no se rompa sin sesión.

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + extra : ''}`)
}

const BASE = 'http://localhost:8892'
const browser = await chromium.launch()

const TORNEO = {
  id: 'torneo-1', slug: 'copa', name: 'Copa de Prueba', status: 'registration_open',
  admin_id: 'admin-1', max_players: 8, swiss_rounds: 3, description: 'Ven a jugar.',
}
const INSCRIPCIONES = [
  { id: 'ins-1', tournament_id: 'torneo-1', user_id: 'user-1', status: 'active', tcg_live_username: 'AshKetchum' },
  { id: 'ins-2', tournament_id: 'torneo-1', user_id: 'user-2', status: 'active', tcg_live_username: 'MistyW' },
]

const abrir = async (ruta, semillas = {}) => {
  const page = await browser.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e)))
  await page.addInitScript((s) => {
    if (s.sesion) window.__FAKE_SESSION__ = s.sesion
    if (s.torneos) window.__FAKE_TORNEOS__ = s.torneos
    if (s.inscripciones) window.__FAKE_INSCRIPCIONES__ = s.inscripciones
    if (s.rondas) window.__FAKE_RONDAS__ = s.rondas
    if (s.mesas) window.__FAKE_MESAS__ = s.mesas
    if (s.decklists) window.__FAKE_DECKLISTS__ = s.decklists
  }, semillas)
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  return { page, errores }
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. Sin cuenta, el torneo SE VE ──')
{
  const { page, errores } = await abrir('/torneo?slug=copa', {
    sesion: 'none', torneos: [TORNEO], inscripciones: INSCRIPCIONES,
  })
  check('la ficha se pinta (no rebota a la portada)', page.url().includes('/torneo'), page.url())
  check('sin errores de JavaScript', errores.length === 0, errores[0] || '')
  const visible = await page.locator('#torneoContenido').isVisible()
  check('el contenido está a la vista', visible)
  check('sale el nombre del torneo', (await page.locator('#torneoNombre').textContent()) === 'Copa de Prueba')
  check('y las plazas', (await page.locator('#torneoPlazasTexto').textContent())?.includes('2 de 8'))
  check('salen los dos inscritos, con enlace a su perfil',
    (await page.locator('#listaInscritos a[href^="/usuario/"]').count()) === 2)
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. Pero NO se ve lo privado ──')
{
  const { page } = await abrir('/torneo?slug=copa', {
    sesion: 'none', torneos: [TORNEO], inscripciones: INSCRIPCIONES,
    decklists: [{ id: 'dk-1', tournament_id: 'torneo-1', user_id: 'user-1', raw_text: '4 Pikachu' }],
  })
  const cuerpo = await page.locator('body').innerText()
  check('NO sale el usuario de TCG Live de nadie', !/AshKetchum|MistyW/.test(cuerpo), cuerpo.match(/AshKetchum|MistyW/)?.[0] || '')
  check('NO sale ninguna decklist', !/Pikachu/.test(cuerpo))
  check('la caja de tu decklist está oculta', await page.locator('#torneoDecklistCaja').isHidden())
  check('la caja de jueces está oculta', await page.locator('#torneoJuecesCaja').isHidden())
  check('no hay botón de solicitar ser juez', (await page.locator('#btnSolicitarJuez').count()) === 0)
  // «Añadir al calendario» SÍ sale, y está bien que salga: apuntarse la
  // fecha es lo primero que hace quien se lo está pensando. Lo que no
  // puede salir es ninguna acción de organizador.
  for (const id of ['btnAbrirInscripciones', 'btnCerrarInscripciones', 'btnEditarTorneo',
                    'btnCancelarTorneo', 'btnBorrarTorneo', 'btnAnunciarForo']) {
    check(`no hay botón #${id}`, (await page.locator(`#${id}`).count()) === 0)
  }
  check('el calendario sí, que no es de nadie', (await page.locator('#btnCalendario').count()) === 1)
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. La invitación a entrar ──')
{
  const { page } = await abrir('/torneo?slug=copa', {
    sesion: 'none', torneos: [TORNEO], inscripciones: INSCRIPCIONES,
  })
  const plaza = await page.locator('#miPlazaContenido').innerText()
  // Desde la tanda 252 no invita a ENTRAR sino a REGISTRARSE: quien mira
  // el escaparate sin cuenta no la tiene, y mandarlo al formulario de
  // acceso era pedirle que se busque solo el enlace de crearla.
  check('invita a crearse una cuenta', /Crea tu cuenta para inscribirte/i.test(plaza), plaza.slice(0, 90))
  const href = await page.locator('#miPlazaContenido a').first().getAttribute('href')
  check('el enlace lleva al REGISTRO', (href || '').startsWith('/auth.html?registro=1'), href || '')
  check('y vuelve al torneo después', (href || '').includes('volver=') && decodeURIComponent(href || '').includes('/torneo'), href || '')
  check('dice cuántas plazas quedan', /6 plazas/.test(plaza), plaza.slice(0, 80))
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3b. Y con aforo sin límite (tanda 228 de IBAI) ──')
{
  const { page } = await abrir('/torneo?slug=copa', {
    sesion: 'none', torneos: [{ ...TORNEO, max_players: null }], inscripciones: INSCRIPCIONES,
  })
  const plaza = await page.locator('#miPlazaContenido').innerText()
  check('no intenta restar plazas a un null', !/NaN|null|undefined/.test(plaza), plaza.slice(0, 90))
  check('dice que no hay límite', /no hay límite/i.test(plaza), plaza.slice(0, 90))
  check('y sigue invitando a crearse una cuenta', /Crea tu cuenta para inscribirte/i.test(plaza))
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 4. Un torneo que no se puede ver ──')
{
  const { page, errores } = await abrir('/torneo?slug=noexiste', { sesion: 'none', torneos: [TORNEO] })
  check('sale la página de «no disponible»', await page.locator('#torneoNoDisponible').isVisible())
  check('sin errores de JavaScript', errores.length === 0, errores[0] || '')
  check('y no se pinta la ficha', await page.locator('#torneoContenido').isHidden())
  const texto = await page.locator('#torneoNoDisponible').innerText()
  check('no dice si existe o no (no filtra nada)', !/privado|admin|permiso/i.test(texto), texto.slice(0, 80))
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 5. La mesa del BYE no es «tu partida» ──')
{
  // El fallo que esto vigila: sin sesión el «yo» es null, y una mesa con
  // bye tiene player_b_id a null. Sin guardia, null === null y el
  // visitante se encontraría la partida del bye como suya.
  const { page } = await abrir('/torneo?slug=copa', {
    sesion: 'none',
    torneos: [{ ...TORNEO, status: 'in_progress' }],
    inscripciones: INSCRIPCIONES,
    rondas: [{ id: 'ronda-1', tournament_id: 'torneo-1', round_number: 1, phase: 'swiss', status: 'active' }],
    mesas: [
      // La primera es una mesa VIVA con el segundo jugador a null. No es
      // el caso normal (un hueco es un bye), pero es exactamente la
      // forma contra la que existe el guardia: sin él, `null === null`
      // hace que esta mesa sea «la tuya» para quien no ha entrado, y
      // entonces sí se monta el chat. Con el bye delante la rotura no se
      // notaba, porque las mesas de bye no montan chat.
      { id: 'mesa-0', round_id: 'ronda-1', table_number: 1, player_a_id: 'user-1', player_b_id: null, status: 'active' },
      { id: 'mesa-1', round_id: 'ronda-1', table_number: 2, player_a_id: 'user-4', player_b_id: null, status: 'bye' },
      { id: 'mesa-2', round_id: 'ronda-1', table_number: 3, player_a_id: 'user-2', player_b_id: 'user-3', status: 'active' },
    ],
  })
  check('«Tu partida» sigue oculta', await page.locator('#torneoMiPartida').isHidden())
  // Y por DENTRO tampoco se monta: el chat de mesa y el «llamar al
  // juez» los pone jueces.js en #miPartidaExtra, que va dentro de la
  // caja oculta — comprobar solo que la caja no se ve dejaba pasar que
  // el visitante tuviera montado el chat de una mesa ajena.
  check('el chat de mesa ni se monta', (await page.locator('#chatDeMesa').count()) === 0)
  check('ni el botón de llamar al juez', (await page.locator('#zonaLlamarJuez').count()) === 0)

  // La clasificación SÍ se ve — es media gracia del escaparate — pero
  // sin la columna de TCG Live.
  const cabeceras = await page.locator('#clasificacionContenido th').allInnerTexts()
  check('la clasificación se pinta', cabeceras.length > 0, JSON.stringify(cabeceras))
  check('sin columna de TCG Live', !cabeceras.some((c) => /TCG Live/i.test(c)), JSON.stringify(cabeceras))
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 5b. Y con cuenta, la clasificación SÍ la lleva ──')
{
  const { page } = await abrir('/torneo?slug=copa', {
    sesion: 'admin-1',
    torneos: [{ ...TORNEO, status: 'in_progress' }],
    inscripciones: INSCRIPCIONES,
    rondas: [{ id: 'ronda-1', tournament_id: 'torneo-1', round_number: 1, phase: 'swiss', status: 'active' }],
    // MISMA semilla que el bloque 5, para que lo único que cambie sea
    // la sesión: si no, una diferencia de datos podría explicar la
    // diferencia de columnas y la prueba no probaría nada.
    mesas: [
      { id: 'mesa-0', round_id: 'ronda-1', table_number: 1, player_a_id: 'user-1', player_b_id: null, status: 'active' },
      { id: 'mesa-1', round_id: 'ronda-1', table_number: 2, player_a_id: 'user-4', player_b_id: null, status: 'bye' },
      { id: 'mesa-2', round_id: 'ronda-1', table_number: 3, player_a_id: 'user-2', player_b_id: 'user-3', status: 'active' },
    ],
  })
  const cabeceras = await page.locator('#clasificacionContenido th').allInnerTexts()
  check('con columna de TCG Live', cabeceras.some((c) => /TCG Live/i.test(c)), JSON.stringify(cabeceras))
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 6. Con cuenta, todo sigue igual que antes ──')
{
  const { page, errores } = await abrir('/torneo?slug=copa', {
    sesion: 'admin-1', torneos: [TORNEO], inscripciones: INSCRIPCIONES,
  })
  check('sin errores de JavaScript', errores.length === 0, errores[0] || '')
  const cuerpo = await page.locator('body').innerText()
  check('el organizador SÍ ve el usuario de TCG Live', /AshKetchum/.test(cuerpo))
  check('y tiene sus acciones', (await page.locator('#torneoAdminAcciones button').count()) > 0)
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 7. Qué columnas pide un visitante ──')
{
  // Esto no es quisquillosidad: en la base real, `anon` NO tiene permiso
  // sobre tcg_live_username, y en Postgres un `select *` que toca una
  // columna prohibida no devuelve esa columna vacía — FALLA LA CONSULTA
  // ENTERA. Un `*` aquí deja la ficha en blanco para todo el que no haya
  // entrado, y no hay forma de verlo hasta que pasa en producción.
  //
  // El doble no proyecta columnas (devuelve la fila entera), pero sí
  // REGISTRA lo que se le pidió, que es lo que se comprueba aquí.
  const { page } = await abrir('/torneo?slug=copa', {
    sesion: 'none', torneos: [TORNEO], inscripciones: INSCRIPCIONES,
  })
  const pedidas = await page.evaluate(() => window.__CONSULTAS__.columnas.tournament_registrations || [])
  check('se consultó la tabla de inscripciones', pedidas.length > 0)
  check('y NUNCA con *', !pedidas.includes('*'), JSON.stringify(pedidas))
  check('sí con la lista pública', pedidas.some((c) => c.includes('user_id') && c.includes('status')), JSON.stringify(pedidas))
  check('sin pedir el usuario de TCG Live', !pedidas.some((c) => c.includes('tcg_live_username')), JSON.stringify(pedidas))
  await page.close()
}

{
  // Y con cuenta sí se piden todas: el jugador necesita su TCG Live.
  const { page } = await abrir('/torneo?slug=copa', {
    sesion: 'admin-1', torneos: [TORNEO], inscripciones: INSCRIPCIONES,
  })
  const pedidas = await page.evaluate(() => window.__CONSULTAS__.columnas.tournament_registrations || [])
  check('con cuenta sí se piden todas', pedidas.includes('*'), JSON.stringify(pedidas))
  await page.close()
}

await browser.close()
console.log(fails ? `\n${fails} FALLOS\n` : '\nTodo en verde\n')
process.exit(fails ? 1 : 0)
