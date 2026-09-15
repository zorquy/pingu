// Tanda 302: mandar un torneo al canal a mano, y saber por qué no salió.
//
// PINGU: «creia que se enviaria solo al canal pero parece que no...»
//
// LA CAUSA, que es lo que hay que dejar clavado aquí: la migración de la
// tanda 287 copió de las noticias la «red del estreno» —marcar como
// mandado todo lo que ya existía—. En noticias vale: una noticia
// publicada está en el PASADO y soltar el archivo el día del estreno es
// la forma más rápida de que la gente silencie el canal. Un torneo
// apunta al FUTURO: el que tiene las inscripciones abiertas y fecha por
// delante es justo el que hay que anunciar, y quedó silenciado.
//
// Y encima no había forma de arreglarlo: las noticias tienen botón de
// «mandar a mano» desde la 282 y los torneos se quedaron sin él, así que
// cuando el envío automático no llega no hay ni segunda vía ni manera de
// enterarse — el error de una función programada se queda en el registro
// de Netlify, que no lee nadie.
//
// Sin red: se doblan Supabase y la API de Telegram.
import { mandarUna, mandarUnTorneo } from '/home/user/pingu/netlify/functions/telegram-mandar.mjs'
import { readFileSync } from 'node:fs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 190) : ''}`)
}
const leer = (f) => readFileSync(`/home/user/pingu/${f}`, 'utf8')

const AHORA = new Date('2026-09-15T10:00:00.000Z')
const TORNEO = {
  id: 't1',
  slug: 'pachanga-inaugural',
  name: 'Pachanga de inauguración',
  description: '<p>La primera de todas.</p>',
  banner_url: 'https://pokedoc.es/banner.jpg',
  start_at: '2026-09-20T15:00:00.000Z',
  status: 'registration_open',
  format: 'standard',
  swiss_rounds: 4,
  top_cut_size: null,
  max_players: null,
  is_private: false,
  telegram_sent_at: null,
}
const ENV = {
  TELEGRAM_BOT_TOKEN: 'tok',
  TELEGRAM_CANAL_NOTICIAS: '@pokedoc',
  TELEGRAM_TEMA_TORNEOS: '777',
  SUPABASE_SERVICE_ROLE_KEY: 'k',
}

function doblar({ torneo = TORNEO, telegramOk = true, errorTelegram = 'chat not found' } = {}) {
  const enviado = []
  const marcado = []
  const restImpl = async (ruta, _clave, opciones = {}) => {
    if (opciones.method === 'PATCH') {
      marcado.push({ ruta, cuerpo: JSON.parse(opciones.body) })
      return null
    }
    return torneo ? [torneo] : []
  }
  const fetchImpl = async (url, opciones = {}) => {
    enviado.push({ url, cuerpo: JSON.parse(opciones.body || '{}') })
    return {
      ok: true,
      json: async () => (telegramOk ? { ok: true, result: {} } : { ok: false, description: errorTelegram }),
    }
  }
  return { restImpl, fetchImpl, enviado, marcado }
}
const mandar = (opciones = {}, dobles = {}) => {
  const d = doblar(dobles)
  return mandarUnTorneo({ id: 't1', env: ENV, ahora: AHORA, restImpl: d.restImpl, fetchImpl: d.fetchImpl, ...opciones }).then((r) => ({ ...r, ...d }))
}

console.log('\n── 1. Un torneo abierto se manda ──')
{
  const r = await mandar()
  check('responde que sí', r.estado === 200 && r.cuerpo.ok === true, JSON.stringify(r.cuerpo))
  check('  …ha llamado a Telegram', r.enviado.length === 1, String(r.enviado.length))
  check('  …con el nombre del torneo', JSON.stringify(r.enviado[0]?.cuerpo).includes('Pachanga de inauguraci'), JSON.stringify(r.enviado[0]?.cuerpo).slice(0, 150))
  check('  …y su enlace', JSON.stringify(r.enviado[0]?.cuerpo).includes('pachanga-inaugural'))
  // Al TEMA de torneos, no al de noticias: en una comunidad de Telegram
  // los canales son temas de un mismo grupo, y colar el torneo en el de
  // noticias es tan malo como no mandarlo.
  check('  …al tema de torneos', JSON.stringify(r.enviado[0]?.cuerpo).includes('777'), JSON.stringify(r.enviado[0]?.cuerpo).slice(0, 200))
  // Y se apunta, que si no la función programada lo repite en 5 minutos.
  check('queda apuntado como mandado', r.marcado.length === 1 && 'telegram_sent_at' in r.marcado[0].cuerpo, JSON.stringify(r.marcado))
  check('  …sobre la tabla de torneos', /^tournaments\?/.test(r.marcado[0]?.ruta || ''), r.marcado[0]?.ruta)
}

console.log('\n── 2. El caso de PINGU: ya CONSTA mandado sin haberlo estado ──')
{
  // Es el estado en el que la migración de la 287 dejó a la Pachanga.
  const yaConsta = { ...TORNEO, telegram_sent_at: '2026-09-10T00:00:00.000Z' }
  const r = await mandar({}, { torneo: yaConsta })
  check('no se manda dos veces sin querer', r.estado === 409, String(r.estado))
  check('  …y se dice cuándo consta', r.cuerpo.yaMandada === '2026-09-10T00:00:00.000Z', JSON.stringify(r.cuerpo))
  check('  …sin llamar a Telegram', r.enviado.length === 0)
  // Pero con `forzar` sale: es la salida de emergencia del fallo de la
  // 287, y sin ella la Pachanga no habría podido anunciarse nunca.
  const f = await mandar({ forzar: true }, { torneo: yaConsta })
  check('forzando sí sale', f.estado === 200 && f.cuerpo.ok === true, JSON.stringify(f.cuerpo))
  check('  …y llama a Telegram', f.enviado.length === 1)
}

console.log('\n── 3. Lo que NO puede salir por el canal ──')
{
  // Un torneo privado no sale NI FORZANDO. La función programada ya lo
  // filtra, pero aquí hay una persona pulsando un botón, y lo que se
  // escapa por el canal no se recoge: nombre, fecha y enlace de algo que
  // alguien quiso que no se viera.
  const priv = { ...TORNEO, is_private: true }
  const r = await mandar({}, { torneo: priv })
  check('un torneo privado no sale', r.estado === 400 && /privado/i.test(r.cuerpo.error), JSON.stringify(r.cuerpo))
  check('  …sin llamar a Telegram', r.enviado.length === 0)
  const f = await mandar({ forzar: true }, { torneo: priv })
  check('  …y forzando tampoco', f.estado === 400 && f.enviado.length === 0, JSON.stringify(f.cuerpo))

  // Un borrador no: el enlace llevaría a una página que no existe.
  const borrador = { ...TORNEO, status: 'draft' }
  const b = await mandar({}, { torneo: borrador })
  check('un borrador no sale', b.estado === 400 && /inscripciones/i.test(b.cuerpo.error), JSON.stringify(b.cuerpo))

  // Uno ya empezado: anunciar algo a lo que no te puedes apuntar es peor
  // que no anunciarlo. Esta sí se puede forzar (avisar de uno que empieza
  // en un rato es legítimo).
  const pasado = { ...TORNEO, start_at: '2026-09-14T15:00:00.000Z' }
  const p = await mandar({}, { torneo: pasado })
  check('uno que ya empezó no sale solo', p.estado === 409, String(p.estado))
  const pf = await mandar({ forzar: true }, { torneo: pasado })
  check('  …pero forzando sí', pf.estado === 200 && pf.enviado.length === 1, JSON.stringify(pf.cuerpo))

  const n = await mandar({}, { torneo: null })
  check('uno que ya no existe', n.estado === 404, JSON.stringify(n.cuerpo))
}

console.log('\n── 4. Cuando algo falla, se DICE qué falla ──')
{
  // Es el motivo de que esto exista: el error de una función programada
  // se queda en el registro de Netlify. Aquí hay alguien delante.
  const r = await mandar({}, { telegramOk: false, errorTelegram: 'bot is not a member of the supergroup chat' })
  check('el error de Telegram se pasa TAL CUAL', /bot is not a member/.test(r.cuerpo.error || ''), r.cuerpo.error)
  check('  …y no se da por mandado', r.marcado.length === 0)

  // Y si falta una variable, se dice CUÁL y dónde se pone.
  const sinLlaves = await mandarUnTorneo({ id: 't1', env: { SUPABASE_SERVICE_ROLE_KEY: 'k' }, ahora: AHORA })
  check('si falta una variable, se dice cuál', sinLlaves.estado === 503 && sinLlaves.cuerpo.faltan?.includes('TELEGRAM_BOT_TOKEN'),
    JSON.stringify(sinLlaves.cuerpo))
  check('  …y dónde se pone', /Environment variables/.test(sinLlaves.cuerpo.error || ''), sinLlaves.cuerpo.error)
}

console.log('\n── 5. Las noticias siguen funcionando igual ──')
{
  // La misma función atiende a los dos. Si el porte de torneos se hubiera
  // llevado por delante el camino de las noticias, el canal se queda sin
  // lo que ya funcionaba.
  const noticia = { id: 'n1', slug: 'mew', title: 'Mew RGB', description: 'x', cover_image: null, kind: 'news', published_at: '2026-09-14T00:00:00.000Z', telegram_sent_at: null }
  const d = doblar({ torneo: noticia })
  const r = await mandarUna({ id: 'n1', env: ENV, restImpl: d.restImpl, fetchImpl: d.fetchImpl })
  check('una noticia se manda', r.estado === 200 && r.cuerpo.ok === true, JSON.stringify(r.cuerpo))
  check('  …sobre la tabla de guías', /^guides\?/.test(d.marcado[0]?.ruta || ''), d.marcado[0]?.ruta)
  // Y sin `tipo` se sigue entendiendo «noticia», que es lo que manda el
  // botón viejo del panel.
  const d2 = doblar({ torneo: noticia })
  const sinTipo = await mandarUna({ id: 'n1', env: ENV, restImpl: d2.restImpl, fetchImpl: d2.fetchImpl })
  check('sin decir el tipo, sigue siendo una noticia', sinTipo.estado === 200, JSON.stringify(sinTipo.cuerpo))
}

console.log('\n── 6. La migración ya no silencia lo que queda por anunciar ──')
{
  const sql = leer('supabase-migration-telegram-torneos.sql')
  // ESTE es el fallo de la 287, escrito. Si alguien lo devuelve, vuelve a
  // pasar lo de la Pachanga.
  const redVieja = /set telegram_sent_at = now\(\)\s*\n\s*where telegram_sent_at is null;/.test(sql)
  check('la red del estreno ya no marca TODO', !redVieja, redVieja ? 'sigue el update sin condiciones' : '')
  check('  …deja fuera lo que sigue abierto', /status is distinct from 'registration_open'/.test(sql))
  check('  …y lo que aún no ha empezado', /start_at < now\(\)/.test(sql))
  // Y que quede dicho POR QUÉ, que es lo que evita que se repita.
  check('  …y explica por qué no vale copiarlo de noticias', /apunta al FUTURO/.test(sql))
}

console.log('\n── 7. El botón, y quién lo ve ──')
{
  // ABRIENDO LA PÁGINA, no leyendo el fichero. La primera versión de
  // este bloque buscaba «btnTelegramTorneo» en el código y pasaba
  // igual con la llamada a pintarTelegram borrada: el texto seguía ahí
  // dentro de una función que ya no llamaba nadie. Un botón que no se
  // pinta es exactamente el fallo que hay que poder ver.
  const { chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs')
  const BASE = 'http://localhost:8892'
  const ahora = Date.now()
  const BASE_TORNEO = {
    id: 't1', slug: 'pachanga', name: 'Pachanga de inauguración', status: 'registration_open',
    admin_id: 'admin-1', max_players: null, swiss_rounds: 4,
    start_at: new Date(ahora + 5 * 86400e3).toISOString(),
  }
  const navegador = await chromium.launch()
  const abrir = async (sesion, extra = {}) => {
    const page = await navegador.newPage({ viewport: { width: 1280, height: 900 } })
    const errores = []
    page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
    await page.addInitScript(([s, t]) => {
      window.__FAKE_SESSION__ = s
      window.__FAKE_TORNEOS__ = [t]
    }, [sesion, { ...BASE_TORNEO, ...extra }])
    await page.goto(`${BASE}/torneo?slug=pachanga`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2400)
    const btn = page.locator('[id^="btnTelegramTorneo"]')
    return { page, errores, btn, cuantos: await btn.count() }
  }

  const admin = await abrir('admin-1')
  check('el admin del sitio ve el botón', admin.cuantos === 1, String(admin.cuantos))
  check('  …sin errores de JavaScript', admin.errores.length === 0, admin.errores.join(' | '))
  check('  …y dice que todavía no se ha anunciado',
    /Todavía no se ha anunciado/.test((await admin.btn.getAttribute('title')) || ''), await admin.btn.getAttribute('title'))
  await admin.page.close()

  // EL CASO DE PINGU: el torneo que la migración de la 287 dio por
  // mandado sin haberlo mandado. El botón tiene que cambiar de texto Y
  // explicar qué pasó — es lo que contesta «¿por qué no salió?» sin
  // abrir el registro de Netlify.
  const constaba = await abrir('admin-1', { telegram_sent_at: new Date(ahora - 86400e3).toISOString() })
  check('si ya consta mandado, el botón lo dice', /otra vez/.test((await constaba.btn.textContent()) || ''),
    await constaba.btn.textContent())
  const pista = (await constaba.btn.getAttribute('title')) || ''
  check('  …con la fecha en la que consta', /Ya consta como mandado el/.test(pista), pista.slice(0, 90))
  check('  …y avisando del caso de los torneos viejos', /ya existían al poner el canal/.test(pista), pista.slice(0, 200))
  await constaba.page.close()

  // Dónde NO puede salir.
  const priv = await abrir('admin-1', { is_private: true })
  check('en un torneo privado no hay botón', priv.cuantos === 0, String(priv.cuantos))
  await priv.page.close()
  const borrador = await abrir('admin-1', { status: 'draft' })
  check('en un borrador tampoco', borrador.cuantos === 0, String(borrador.cuantos))
  await borrador.page.close()

  // Quién NO lo ve: escribir en el canal oficial de PokeDoc es un acto
  // del SITIO, del mismo tipo que el sello de OFICIAL. Quien lleva un
  // torneo manda en el torneo, no en el canal (CLAUDE.md).
  const nadie = await abrir('user-1')
  check('quien no pinta nada no lo ve', nadie.cuantos === 0, String(nadie.cuantos))
  await nadie.page.close()

  // Y EL CASO QUE DE VERDAD SEPARA las dos reglas: quien CREÓ el torneo.
  // Lleva el torneo entero —`torneos_mando` le da todo lo demás— pero el
  // canal no es suyo. Sin este caso, cambiar `is_admin` por `mando()` no
  // se notaría: el de arriba no es ninguna de las dos cosas y sale
  // escondido con las dos reglas.
  const dueno = await abrir('user-1', { admin_id: 'user-1' })
  check('ni siquiera quien creó el torneo lo ve', dueno.cuantos === 0, String(dueno.cuantos))
  // Y que conste que ESE sí lleva el torneo, para que el caso valga:
  // si no pudiera editarlo, estaría escondido por el motivo equivocado.
  check('  …aunque sí puede editarlo', (await dueno.page.locator('#btnEditarTorneo').count()) === 1,
    String(await dueno.page.locator('#btnEditarTorneo').count()))
  await dueno.page.close()

  await navegador.close()
}

console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
