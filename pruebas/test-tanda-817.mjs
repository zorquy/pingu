// Tanda 817 (QU1 + QU2) — lo retirado, borrado, y el semáforo de /admin.
import { readFileSync, existsSync } from 'node:fs'
const RAIZ = '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
console.log('── QU1. Lo retirado, fuera ──')
check('scrydex-huecos y precios-espejo ya no existen', !existsSync(`${RAIZ}/netlify/functions/scrydex-huecos.mjs`) && !existsSync(`${RAIZ}/netlify/functions/precios-espejo.mjs`))
const admin = readFileSync(`${RAIZ}/admin/js/admin.js`, 'utf8')
check('  …y /admin ya no los lee ni los pinta', !/scrydex_huecos|precios_espejo|HUECOS DESDE SCRYDEX|ESPEJO DE PRECIOS/.test(admin))

console.log('\n── QU2. El semáforo ──')
const { PASADAS, semaforoDe } = await import(`${RAIZ}/admin/js/semaforo.js`)
const AHORA = new Date('2026-10-14T08:00:00Z')
const fila = (valor, updated_at = '2026-10-14T07:55:00Z') => ({ valor, updated_at })
check('una por pasada, con los productos (desde la 824 las líneas JP viejas; desde la 886 los decks de Scrydex, los de mano y el relleno; desde la 902 las noticias a X; desde la 929 las versiones por idioma; desde la 993 los push; desde la 1028 las versiones al abrir la ficha)', PASADAS.length === 16 && PASADAS.some(([k]) => k === 'tcggo_versiones_ahora') && PASADAS.some(([k]) => k === 'enviar_push') && PASADAS.some(([k]) => k === 'tcggo_productos') && ['scrydex_decks_jp', 'decks_jp_a_mano', 'scrydex_rellenar_set', 'tcggo_versiones_idioma'].every((c) => PASADAS.some(([k]) => k === c)))
check('sin fila: gris', semaforoDe(null, AHORA).luz === 'gris')
check('parado sin día: rojo', semaforoDe(fila({ parado: 'tope diario' }), AHORA).luz === 'rojo')
check('parado de HOY: rojo; de ayer: ya no', semaforoDe(fila({ parado: { dia: '2026-10-14', motivo: '429' } }), AHORA).luz === 'rojo' && semaforoDe(fila({ parado: { dia: '2026-10-13', motivo: '429' } }), AHORA).luz === 'verde')
check('el plan bloqueado hoy: rojo', semaforoDe(fila({ planBloqueado: { dia: '2026-10-14', motivo: 'Ultra' } }), AHORA).luz === 'rojo')
check('un error de hace una hora: ámbar, con el error', (() => { const s = semaforoDe(fila({ ultimoError: { fecha: '2026-10-14T07:00:00Z', error: '23502 not null' } }), AHORA); return s.luz === 'ambar' && /23502/.test(s.motivo) })())
check('un error de hace dos días: no cuenta', semaforoDe(fila({ ultimoError: { fecha: '2026-10-12T07:00:00Z', error: 'x' } }), AHORA).luz === 'verde')
check('más de un día sin escribir: ámbar', semaforoDe(fila({}, '2026-10-12T00:00:00Z'), AHORA).luz === 'ambar')
check('lo normal: verde', semaforoDe(fila({ hecho: true }), AHORA).luz === 'verde')
check('/admin lo pinta encima del estado, leyendo las mismas claves', /PASADAS\.map\(\(\[k\]\) => k\)/.test(admin) && /semaforoDe\(de\(k\)\)/.test(admin) && /caja\.before\(luces\)/.test(admin))
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
