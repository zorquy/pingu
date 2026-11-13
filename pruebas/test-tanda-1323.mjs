// Tanda 1323 — Tu temporada de liga en el perfil (P3 del plan): el puesto que
// tenías al acabar cada jornada (la cuenta de la ficha, con las rondas hasta
// esa jornada), tu resultado de cada una y la línea que sube o baja.
import { readFileSync } from 'node:fs'
const REPO = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

// El módulo importa sprites (navegador) por arriba: se importa con un window mínimo.
globalThis.window = globalThis.window || { location: { href: '' } }
const m = await import(`${REPO}/js/perfil-liga.js`)

// Una liga de 3 jornadas (1 ronda cada una), 4 jugadores.
const t = { id: 'L', slug: 'liga-fdn', name: 'Liga FDN [Oct–Dic]', format: 'league', swiss_rounds: 3, rounds_per_matchday: 1, pairing_seed: 's' }
const R = (n, hecha = true) => ({ id: `r${n}`, round_number: n, phase: 'swiss', status: hecha ? 'finished' : 'in_progress', started_at: '2026-10-01T18:00:00Z', closed_at: '2026-10-01T20:00:00Z' })
const rondas = [R(1), R(2), R(3, false)]
const inscripciones = ['yo', 'b', 'c', 'd'].map((u) => ({ user_id: u, status: 'active' }))
// J1: yo pierdo contra b; c gana a d. J2: yo gano a d; b gana a c. J3 en juego.
const partidas = [
  { id: 'm1', round_id: 'r1', table_number: 1, player_a_id: 'yo', player_b_id: 'b', status: 'finished' },
  { id: 'm2', round_id: 'r1', table_number: 2, player_a_id: 'c', player_b_id: 'd', status: 'finished' },
  { id: 'm3', round_id: 'r2', table_number: 1, player_a_id: 'd', player_b_id: 'yo', status: 'finished' },
  { id: 'm4', round_id: 'r2', table_number: 2, player_a_id: 'b', player_b_id: 'c', status: 'finished' },
]
const resultados = [{ match_id: 'm1', result: 'b_wins' }, { match_id: 'm2', result: 'a_wins' }, { match_id: 'm3', result: 'b_wins' }, { match_id: 'm4', result: 'a_wins' }]
const temp = m.temporadaDeLiga(t, { userId: 'yo', rondas, inscripciones, partidas, resultados })
check('solo las jornadas hechas (2 de 3), no la que está en juego', temp.hechas === 2 && temp.total === 3 && !temp.completa, JSON.stringify(temp))
check('J1: perdiste (0–1), con 0 puntos y en la mitad de abajo', temp.jornadas[0].v === 0 && temp.jornadas[0].d === 1 && temp.jornadas[0].puntos === 0 && temp.jornadas[0].puesto >= 3, JSON.stringify(temp.jornadas[0]))
check('J2: ganaste (1–0) y subiste, con 3 puntos', temp.jornadas[1].v === 1 && temp.jornadas[1].d === 0 && temp.jornadas[1].puntos === 3 && temp.jornadas[1].puesto < temp.jornadas[0].puesto, JSON.stringify(temp.jornadas[1]))
check('el resumen es el de la última jornada hecha', temp.puesto === temp.jornadas[1].puesto && temp.de === 4 && temp.puntos === 3)
check('el resultado se escribe «1–0» (y con empates, «1–0–1»)', m.resultadoTexto({ v: 1, d: 0, e: 0 }) === '1–0' && m.resultadoTexto({ v: 1, d: 0, e: 1 }) === '1–0–1')
const svg = m.lineaDePuestosHtml(temp.jornadas)
const ys = [...svg.matchAll(/<circle cx="[\d.]+" cy="([\d.]+)"/g)].map((x) => Number(x[1]))
check('la línea: un punto por jornada y el mejor puesto MÁS ARRIBA', ys.length === 2 && ys[1] < ys[0] && /aria-label="Tu puesto jornada a jornada/.test(svg), svg.slice(0, 200))
check('con una sola jornada no hay línea (no se puede subir ni bajar)', m.lineaDePuestosHtml(temp.jornadas.slice(0, 1)) === '')
const html = m.tarjetaDeLigaHtml(t, temp)
check('la tarjeta: el nombre sin la temporada entre corchetes, «N.º de 4 · 3 puntos · 2 de 3 jornadas» y una fila por jornada', /<h3>Liga FDN<\/h3>/.test(html) && /de 4 · 3 puntos · 2 de 3 jornadas/.test(html) && (html.match(/class="pl-jornada"/g) || []).length === 2, html.replace(/\s+/g, ' ').slice(0, 300))
const todas = m.temporadaDeLiga(t, { userId: 'yo', rondas: [R(1), R(2), R(3)], inscripciones, partidas: [...partidas, { id: 'm5', round_id: 'r3', table_number: 1, player_a_id: 'yo', player_b_id: 'c', status: 'finished' }], resultados: [...resultados, { match_id: 'm5', result: 'draw' }] })
check('las tres jugadas: «temporada completa», con el empate contado', todas.completa && todas.jornadas[2].e === 1 && /temporada completa/.test(m.tarjetaDeLigaHtml(t, todas)))
check('quien no está en la liga: ninguna jornada', m.temporadaDeLiga(t, { userId: 'otro', rondas, inscripciones, partidas, resultados }).hechas === 0)
const pt = readFileSync(`${REPO}/js/perfil-torneos.js`, 'utf8')
check('la pestaña Torneos lo pide por import() y con las columnas de la liga', /import\('\.\/perfil-liga\.js'\)/.test(pt) && /format, swiss_rounds, rounds_per_matchday, matchday_dates/.test(pt))

console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
