// Tanda 1468 — propuesta «Arena: siguientes mejoras» (PINGU: «adelante con
// todo lo recomendado»):
//   · «Tu temporada» en la banda de /torneos: torneos, podios, récord, mejor
//     puesto y las cinco últimas (V/D/E), del año en curso; las cifras de la
//     arena pasan a una línea pequeña. En el móvil, una fila.
//   · El hueco de «Lo próximo» ya no es un recuadro punteado de media
//     pantalla: «Organiza el tuyo» y, si cabe, «Lo que se juega» (el meta).
//   · Campeones: el pie siempre dice algo tuyo («Ver sus mazos» si no
//     jugaste), sin repetir «N jugadores», y los jugadores cuentan a quien se
//     retiró jugando (no a quien se borró antes de empezar).
import { chromium, contexto, BASE } from './fixtures-app.mjs'
import { datosArena, sembrarArena } from './fixture-arena.mjs'
const REPO = process.env.PD_RAIZ || '/home/user/pingu'

let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

console.log('── Lo puro ──')
{
  const { desenlace, temporadaDe, temporadaHtml } = await import(`${REPO}/js/torneos/temporada.js`)
  const m = { id: 'm', player_a_id: 'yo', player_b_id: 'el', status: 'finished' }
  check('a_wins siendo A → V; siendo B → D', desenlace(m, 'a_wins', 'yo') === 'V' && desenlace({ ...m, player_a_id: 'el', player_b_id: 'yo' }, 'a_wins', 'yo') === 'D')
  check('forfeit_b es victoria de A; forfeit_both, derrota', desenlace(m, 'forfeit_b', 'yo') === 'V' && desenlace(m, 'forfeit_both', 'yo') === 'D')
  check('el bye no cuenta', desenlace({ ...m, player_b_id: null, is_bye: true }, 'bye', 'yo') === null)
  check('una mesa ajena no cuenta', desenlace({ ...m, player_a_id: 'x', player_b_id: 'z' }, 'a_wins', 'yo') === null)
  const c = temporadaDe({
    yo: 'yo',
    torneos: [{ id: 1, champion_id: 'yo', podium: ['yo', 'b'] }, { id: 2, podium: ['a', 'b', 'yo'] }, { id: 3, podium: ['a'] }],
    mesas: [{ ...m, id: 'm1' }, { ...m, id: 'm2' }, { ...m, id: 'm3' }],
    resultados: [{ match_id: 'm2', result: 'b_wins', resolved_at: '2026-02-01' }, { match_id: 'm1', result: 'a_wins', resolved_at: '2026-01-01' }, { match_id: 'm3', result: 'draw', resolved_at: '2026-03-01' }],
  })
  check('tres torneos, dos podios, mejor 1.º', c.torneos === 3 && c.podios === 2 && c.mejor === 1, JSON.stringify(c))
  check('récord 1-1-1 y la racha en orden de fecha (V, D, E)', c.victorias === 1 && c.derrotas === 1 && c.empates === 1 && c.ultimas.join('') === 'VDE', JSON.stringify(c))
  const h = temporadaHtml(c, Date.parse('2026-11-26'))
  check('la banda dice «Tu temporada 2026» y el récord con empates', /Tu temporada 2026/.test(h) && />1-1-1</.test(h), h.slice(0, 200))
  check('la racha lleva letra y su texto para el lector', /aria-label="Tus últimas partidas: ganada, perdida, empate"/.test(h) && /class="r-V">V</.test(h))
  check('sin nada jugado, no hay banda', temporadaHtml({ torneos: 0, partidas: 0, ultimas: [] }) === '')
}

const b = await chromium.launch()
async function abrir({ movil = false, quien = 'user-1', datos = { abiertos: false } } = {}) {
  const ctx = await contexto(b, movil, quien)
  await ctx.addInitScript(sembrarArena, datosArena(datos))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.goto(`${BASE}/torneos`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.t-campeon', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(1500)
  await page.evaluate(() => document.querySelectorAll('dialog[open]').forEach((d) => d.close()))
  return { ctx, page, errores }
}

console.log('── PC ──')
{
  const { ctx, page, errores } = await abrir()
  const r = await page.evaluate(() => {
    const caja = document.getElementById('torneosTemporada')
    const cifras = document.querySelector('.torneos-heroe .banda-s-cifra b')
    const tiles = [...document.querySelectorAll('.t-carteles-tramo .t-carteles > *')].map((n) => Math.round(n.getBoundingClientRect().width))
    const campeones = [...document.querySelectorAll('.t-campeon')].map((c) => ({
      torneo: c.querySelector('.t-campeon-torneo')?.textContent.replace(/\s+/g, ' ').trim(),
      pie: c.querySelector('.t-campeon-pie')?.textContent.replace(/\s+/g, ' ').trim(),
      mazos: c.querySelector('a.t-campeon-tu')?.getAttribute('href') || '',
    }))
    return {
      visible: Boolean(caja && !caja.hidden && caja.getBoundingClientRect().height > 30),
      texto: caja?.textContent.replace(/\s+/g, ' ').trim(),
      racha: [...document.querySelectorAll('.t-temp-racha i')].map((i) => i.textContent).join(''),
      cifraPequena: cifras ? parseFloat(getComputedStyle(cifras).fontSize) : 0,
      tiles,
      invitas: [...document.querySelectorAll('.t-invita')].map((n) => n.dataset.invita),
      campeones,
    }
  })
  check('la banda dice tu temporada: 1 torneo, 1 podio, 3-1-1, 3.º', r.visible && /Tu temporada \d{4}/.test(r.texto) && /1 ?torneo/.test(r.texto) && /1 ?podio/.test(r.texto) && /3-1-1/.test(r.texto) && /3\.º/.test(r.texto), r.texto)
  check('las cinco últimas, de la más vieja a la última: D V V E V', r.racha === 'DVVEV', r.racha)
  check('las cifras de la arena pasan a ser pequeñas', r.cifraPequena > 0 && r.cifraPequena <= 14, r.cifraPequena)
  check('al lado de la liga, «Organiza el tuyo» y el meta', r.invitas.join(',') === 'crear,meta', r.invitas.join(','))
  check('…del mismo ancho que un cartel', r.tiles.length === 3 && Math.max(...r.tiles) - Math.min(...r.tiles) <= 2, r.tiles.join(','))
  const tardeo = r.campeones.find((c) => /Tardeo/.test(c.torneo || ''))
  check('el Tardeo cuenta 6 jugadores (5 + el que se retiró jugando; no el que se borró antes)', /6 jugadores/.test(tardeo?.torneo || ''), tardeo?.torneo)
  check('…y en su pie, «Quedaste 3.º», sin repetir los jugadores', /Quedaste 3\.º/.test(tardeo?.pie || '') && !/jugador/.test(tardeo?.pie || ''), tardeo?.pie)
  const otro = r.campeones.find((c) => /RyuCards/.test(c.torneo || ''))
  check('donde no jugaste: «Ver sus mazos» a la pestaña Mazos', /Ver sus mazos/.test(otro?.pie || '') && /ver=meta/.test(otro?.mazos || ''), JSON.stringify(otro))
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('── Sin sesión ──')
{
  const { ctx, page, errores } = await abrir({ quien: 'none' })
  const r = await page.evaluate(() => ({
    temporada: !document.getElementById('torneosTemporada')?.hidden,
    entrar: document.querySelector('.t-invita[data-invita="crear"] a[href="/auth"]')?.textContent.trim(),
  }))
  check('sin cuenta no hay temporada', !r.temporada)
  check('…y la tarjeta invita a entrar para crear', r.entrar === 'Entra para crear uno', r.entrar)
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('── Móvil ──')
{
  const { ctx, page, errores } = await abrir({ movil: true })
  const r = await page.evaluate(() => {
    const caja = document.getElementById('torneosTemporada')
    const rc = caja?.getBoundingClientRect()
    const fila = document.querySelector('.t-temp-fila')?.getBoundingClientRect()
    const primer = document.querySelector('.t-carteles > .t-cartel')?.getBoundingClientRect()
    const record = [...document.querySelectorAll('.t-temp-cifra b')].find((b) => /-/.test(b.textContent))
    return {
      alto: Math.round(rc?.height || 0),
      fila: Math.round(fila?.height || 0),
      ancho: Math.round(rc?.width || 0),
      vw: innerWidth,
      primer: Math.round(primer?.top || 0),
      recordAlto: Math.round(record?.getBoundingClientRect().height || 0),
      scroll: document.documentElement.scrollWidth - innerWidth,
    }
  })
  check('tu temporada se ve, en una fila baja', r.alto > 20 && r.alto <= 60, JSON.stringify(r))
  check('el récord en una línea', r.recordAlto > 0 && r.recordAlto <= 30, r.recordAlto)
  check('no ensancha la página', r.scroll <= 0, r.scroll)
  check('el primer cartel sigue arriba (antes de 300 px)', r.primer > 0 && r.primer < 300, r.primer)
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

await b.close()
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ todo bien')
process.exit(fails ? 1 : 0)
