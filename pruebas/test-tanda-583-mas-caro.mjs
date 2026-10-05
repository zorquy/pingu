// Tanda 583 — «¿Más caro o más barato?»: lo puro y la función del día.
import {
  DIA_UNO, RONDAS, CARTAS_POR_DIA, numeroDelDia, indicesDelDia, cartasQueSirven, acierta, textoParaCompartir, rachaDeDias,
} from '/home/user/pingu/js/mas-caro.js'
import { elegirMasCaro, FILTRO_PRECIOS, CANDIDATAS } from '/home/user/pingu/netlify/functions/mas-caro.mjs'
import { readFileSync } from 'node:fs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 220) : ''}`)
}

console.log('── 1. El día y sus índices ──')
{
  check('el día uno es el #1', numeroDelDia(DIA_UNO) === 1)
  check('cinco rondas, seis cartas', RONDAS === 5 && CARTAS_POR_DIA === 6)
  const a = indicesDelDia('2026-10-07', 1000, 16)
  const b = indicesDelDia('2026-10-07', 1000, 16)
  check('los índices de un día son siempre los mismos', JSON.stringify(a) === JSON.stringify(b))
  check('  …dieciséis y distintos', a.length === 16 && new Set(a).size === 16, JSON.stringify(a))
  check('  …todos dentro del total', a.every((i) => i >= 0 && i < 1000))
  check('  …y otro día da otros', JSON.stringify(indicesDelDia('2026-10-08', 1000, 16)) !== JSON.stringify(a))
  check('con menos cartas que índices, no se pasa', indicesDelDia('2026-10-07', 3, 16).length === 3)
}

console.log('── 2. Qué cartas sirven ──')
{
  const c = (id, precio, extra = {}) => ({ id, precio, image_path: 'x', ...extra })
  const fuera = cartasQueSirven([
    c('a', 5), c('b', 5), // mismo precio seguido: la b fuera
    c('c', 0.5), // menos de un euro
    c('d', 12, { image_path: null, image_scrydex: null }), // sin foto
    c('e', 12), c('f', 3), c('g', 3.004), c('h', 40), c('i', 7), c('j', 9), c('k', 2),
  ])
  check('se quedan seis', fuera.length === 6, fuera.map((x) => x.id).join(','))
  check('  …sin dos seguidas con el mismo precio, sin baratas y sin las que no tienen foto', fuera.map((x) => x.id).join(',') === 'a,e,f,h,i,j', fuera.map((x) => x.id).join(','))
  check('con pocas, las que haya', cartasQueSirven([c('a', 5), c('b', 6)]).length === 2)
  check('vacío, vacío', cartasQueSirven([]).length === 0 && cartasQueSirven(null).length === 0)
}

console.log('── 3. Acertar y compartir ──')
{
  check('«más» acierta si B vale más', acierta(5, 10, 'mas') === true && acierta(10, 5, 'mas') === false)
  check('«menos» acierta si B vale menos', acierta(10, 5, 'menos') === true && acierta(5, 10, 'menos') === false)
  check('otra cosa no acierta', acierta(5, 10, 'igual') === false)
  const t = textoParaCompartir({ dia: '2026-10-07', tira: [true, true, false, true, true], rachaDias: 3 })
  check('el texto lleva el número, la cuenta, la tira, la racha y el enlace', t === '¿Más caro o más barato? PokeDoc #4 · 4/5 💶\n🟩🟩🟥🟩🟩\n🔥 3 días seguidos\npokedoc.es/mas-caro', JSON.stringify(t))
  check('cinco de cinco lleva el trofeo', /5\/5 🏆/.test(textoParaCompartir({ dia: DIA_UNO, tira: [1, 1, 1, 1, 1] })))
  check('sin racha no se dice', !/días seguidos/.test(textoParaCompartir({ dia: DIA_UNO, tira: [1, 0, 0, 0, 0], rachaDias: 1 })))
  check('la racha se comparte con los otros retos', rachaDeDias(['2026-10-06', '2026-10-07'], '2026-10-07') === 2)
}

console.log('── 4. La función: elige, guarda y repite ──')
{
  const PRECIOS = Array.from({ length: 40 }, (_, i) => ({ card_id: `sv8-${i + 1}`, cm_trend: i % 2 ? 2 + i : 1.5 + i }))
  const CARTAS = PRECIOS.map((p, i) => ({ id: p.card_id, market: 'WEST', set_id: 'sv8', local_id: String(i + 1), name: `Carta ${i + 1}`, image_path: 'x', tcg_sets: { name: 'Mega Evolution' } }))
  let guardadas = []
  const pedidas = []
  const pedir = async (ruta, { cabeceras } = {}) => {
    pedidas.push(ruta)
    if (ruta.startsWith('mas_caro_del_dia')) return { datos: guardadas.filter((g) => ruta.includes(`day=eq.${g.day}`)).map((g) => ({ card_ids: g.card_ids })) }
    if (ruta.startsWith('tcg_card_prices?select=card_id&')) {
      if (cabeceras?.prefer === 'count=exact') return { datos: [], total: PRECIOS.length }
      const off = Number(ruta.match(/offset=(\d+)/)?.[1] || 0)
      return { datos: [PRECIOS[off]].filter(Boolean) }
    }
    if (ruta.startsWith('tcg_card_prices?select=card_id,cm_trend')) {
      const ids = decodeURIComponent(ruta).match(/in\.\(([^)]*)\)/)[1].split(',').map((s) => s.replace(/"/g, ''))
      return { datos: PRECIOS.filter((p) => ids.includes(p.card_id)) }
    }
    if (ruta.startsWith('tcg_cards?')) {
      const ids = decodeURIComponent(ruta).match(/in\.\(([^)]*)\)/)[1].split(',').map((s) => s.replace(/"/g, ''))
      return { datos: CARTAS.filter((c) => ids.includes(c.id)) }
    }
    throw new Error(`ruta inesperada: ${ruta}`)
  }
  const guardar = async (tabla, fila) => { guardadas.push(fila) }
  const r = await elegirMasCaro({ dia: '2026-10-07', pedir, guardar })
  check('devuelve el día, el número y seis cartas', r.dia === '2026-10-07' && r.numero === 4 && r.cartas?.length === 6, JSON.stringify(r).slice(0, 200))
  check('  …cada una con su precio', r.cartas.every((c) => typeof c.precio === 'number' && c.precio >= 1), JSON.stringify(r.cartas.map((c) => c.precio)))
  check('  …sin dos seguidas iguales', r.cartas.every((c, i) => i === 0 || c.precio !== r.cartas[i - 1].precio))
  check('  …y se guardan los seis ids', guardadas.length === 1 && guardadas[0].card_ids.length === 6 && guardadas[0].day === '2026-10-07', JSON.stringify(guardadas))
  check('el filtro de precios pide de un euro para arriba', FILTRO_PRECIOS === 'cm_trend=gte.1')
  check('las cartas se piden sin TCG Pocket', pedidas.some((p) => p.startsWith('tcg_cards?') && /set_id=not\.imatch/.test(p)))
  const antes = pedidas.length
  const r2 = await elegirMasCaro({ dia: '2026-10-07', pedir, guardar })
  check('la segunda vez lee lo guardado y no vuelve a elegir', guardadas.length === 1 && JSON.stringify(r2.cartas.map((c) => c.id)) === JSON.stringify(r.cartas.map((c) => c.id)))
  check('  …con tres peticiones y ninguna de candidatas', pedidas.length - antes === 3, String(pedidas.length - antes))
  check(`se miran hasta ${CANDIDATAS} candidatas`, CANDIDATAS >= 12)
  // Sin cartas con precio suficientes, se dice.
  const pocas = await elegirMasCaro({ dia: '2026-10-09', pedir: async (ruta, o) => (o?.cabeceras?.prefer === 'count=exact' ? { datos: [], total: 3 } : { datos: [] }), guardar })
  check('con menos de seis cartas con precio, error claro', /suficientes/.test(pocas.error || ''), JSON.stringify(pocas))
}

console.log('── 5. La migración ──')
{
  const sql = readFileSync('/home/user/pingu/supabase-migration-mas-caro.sql', 'utf8')
  check('tabla con el día de clave y los ids', /create table if not exists public\.mas_caro_del_dia/.test(sql) && /day date primary key/.test(sql) && /card_ids text\[\] not null/.test(sql))
  check('lectura pública y sin política de escritura', /for select using \(true\)/.test(sql) && !/for insert/.test(sql))
}

console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
