// Tanda 1027 — la edición gemela de una expansión (japonesa ↔ occidental),
// de `related_episodes` de TCGGO: lo puro, la pasada que escribe y las
// columnas opcionales de la estantería.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

const lib = await import(`${RAIZ}/netlify/lib/tcggo.mjs`)
const calco = await import(`${RAIZ}/netlify/functions/tcggo-calco-jp.mjs`)
const setsFn = await import(`${RAIZ}/netlify/functions/sets.mjs`)
// El fixture es el ejemplo «List episodes» de su especificación, tal cual.
const LISTA = JSON.parse(readFileSync(new URL('./fixtures/tcggo-episodios-1027.json', import.meta.url), 'utf8'))
// Y de su ejemplo de «Search episodes»: una occidental con TRES japonesas.
const PALDEA = { id: 318, name: 'Paldea Evolved', related_episodes: [{ id: 452, name: 'Triplet Beat', lang: 'jp', game: { slug: 'pokemon-jp' } }, { id: 453, name: 'Snow Hazard', lang: 'jp', game: { slug: 'pokemon-jp' } }, { id: 454, name: 'Clay Burst', lang: 'jp', game: { slug: 'pokemon-jp' } }] }

console.log('── 1. Lo puro ──')
{
  const r = lib.resumirEpisodio(LISTA.data[0])
  check('el resumen de una expansión lleva sus gemelas (id, catálogo, nombre), tal como las da TCGGO', JSON.stringify(r.gemelos) === JSON.stringify([{ id: 448, lang: 'jp', nombre: '30th Celebration (Japanese)' }]), JSON.stringify(r.gemelos))
  check('  …sin `related_episodes`, lista vacía (no undefined: la pasada la recorre)', Array.isArray(lib.resumirEpisodio({ id: 1, name: 'x' }).gemelos) && lib.gemelosDeEpisodio({}).length === 0)
  check('  …y sin `lang` decide el juego (`pokemon-jp`)', lib.gemelosDeEpisodio({ related_episodes: [{ id: 5, game: { slug: 'pokemon-jp' } }, { id: 6, game: { slug: 'pokemon' } }, { id: 'x' }] }).map((g) => `${g.id}:${g.lang}`).join() === '5:jp,6:en')

  const episodiosWest = [...LISTA.data, PALDEA].map(lib.resumirEpisodio)
  const setsWest = [
    { id: 'tcggo-431', name_en: '30th Celebration', tcggo_id: 431, tcggo_gemelos: null },
    { id: 'me3', name_en: 'Pitch Black', tcggo_id: 415, tcggo_gemelos: [447] },
    { id: 'sv2', name_en: 'Paldea Evolved', tcggo_id: 318, tcggo_gemelos: [452] },
    { id: 'me2pt5', name_en: 'Ascended Heroes', tcggo_id: 396, tcggo_gemelos: null },
    { id: 'viejo', name_en: 'Escondido', tcggo_id: 231, oculto: true },
  ]
  const setsJp = [
    { id: 'M6A', name_en: '30th Celebration (Japanese)', tcggo_id: 448, tcggo_gemelos: null },
    { id: 'M5', name_en: 'Abyss Eye', tcggo_id: 447, tcggo_gemelos: [415] },
    { id: 'SV1a', name_en: 'Triplet Beat', tcggo_id: 452, tcggo_gemelos: null },
    { id: 'SV2P', name_en: 'Snow Hazard', tcggo_id: 453, tcggo_gemelos: null },
    { id: 'SV2D', name_en: 'Clay Burst', tcggo_id: 454, tcggo_gemelos: null },
    { id: 'M2', name_en: 'Inferno X', tcggo_id: 440, tcggo_gemelos: null },
  ]
  const r2 = lib.gemelasDeEpisodios({ setsWest, setsJp, episodiosWest, episodiosJp: [] })
  const de = (id) => r2.cambios.find((c) => c.id === id)
  check('con la lista occidental se escriben los DOS lados: el 30 aniversario y su japonés', de('tcggo-431')?.a.tcggo_gemelos.join() === '448' && de('M6A')?.a.tcggo_gemelos.join() === '431', JSON.stringify(r2.cambios))
  check('  …una occidental con tres japonesas lleva las tres (ordenadas), y cada japonesa la occidental', de('sv2')?.a.tcggo_gemelos.join() === '452,453,454' && de('SV2P')?.a.tcggo_gemelos.join() === '318' && de('SV2D')?.a.tcggo_gemelos.join() === '318' && de('SV1a')?.a.tcggo_gemelos.join() === '318', JSON.stringify(de('sv2')))
  check('  …lo que ya está igual no se toca (Pitch Black ↔ Abyss Eye)', !de('me3') && !de('M5'))
  check('  …sin el set del otro lado (MEGA Dream ex no lo tenemos) no se escribe nada', !de('me2pt5'))
  check('  …y un set escondido no entra (Phantasmal Flames ↔ Inferno X)', !de('viejo') && !de('M2'))
  // La lista JAPONESA diciendo lo mismo al revés da lo mismo (y no duplica).
  const episodiosJp = [{ id: 447, gemelos: [{ id: 415, lang: 'en', nombre: 'Pitch Black' }] }, { id: 448, gemelos: [{ id: 431, lang: 'en', nombre: '30th Celebration' }] }]
  const r3 = lib.gemelasDeEpisodios({ setsWest, setsJp, episodiosWest, episodiosJp })
  check('la lista japonesa confirma sin duplicar: las mismas filas, los mismos ids', r3.cambios.length === r2.cambios.length && r3.cambios.find((c) => c.id === 'tcggo-431').a.tcggo_gemelos.join() === '448', JSON.stringify(r3.cambios.map((c) => c.id)))
  const r4 = lib.gemelasDeEpisodios({ setsWest: [{ id: 'a', tcggo_id: 1, tcggo_gemelos: [9] }], setsJp: [], episodiosWest: [], episodiosJp: [] })
  check('una gemela que ya no existe se quita (null)', r4.cambios.length === 1 && r4.cambios[0].a.tcggo_gemelos === null, JSON.stringify(r4))
}

console.log('\n── 2. La pasada (pasoDeGemelas, en el calco japonés) ──')
{
  const SETS = [
    { id: 'tcggo-431', market: 'WEST', name_en: '30th Celebration', tcggo_id: 431, tcggo_gemelos: null, oculto: false },
    { id: 'M6A', market: 'JP', name_en: '30th Celebration (Japanese)', tcggo_id: 448, tcggo_gemelos: null, oculto: false },
  ]
  const episodiosJp = [{ id: 448, nombre: '30th Celebration (Japanese)', gemelos: [] }]
  const montar = ({ sinColumna = false, caida = false, pares = true } = {}) => {
    const parches = []
    const pedir = async (ruta, o = null) => {
      const rr = decodeURIComponent(ruta)
      if (o?.method === 'PATCH') { if (caida) throw new Error('Supabase 500'); parches.push({ ruta: rr, cuerpo: JSON.parse(o.body) }); return null }
      if (rr.startsWith('tcg_sets?')) { if (sinColumna) throw new Error('Supabase 400: {"code":"42703","message":"column tcg_sets.tcggo_gemelos does not exist"}'); return SETS }
      return []
    }
    const leerEstado = async (k) => (k === 'tcggo_pares' && pares ? { episodios: { lista: LISTA.data.map(lib.resumirEpisodio) } } : {})
    return { pedir, parches, leerEstado, estado: { cascarones: { listo: true } }, persistir: async () => {} }
  }
  const AHORA = new Date('2026-10-26T09:00:00Z')
  const a = montar()
  const p1 = await calco.pasoDeGemelas({ ...a, episodios: episodiosJp, dia: '2026-10-26', ahora: AHORA })
  check('escribe las gemelas en los dos catálogos, con la lista occidental del emparejador', p1.ok && p1.escritos === 2 && a.parches.some((x) => /market=eq\.WEST&id=eq\.tcggo-431/.test(x.ruta) && x.cuerpo.tcggo_gemelos.join() === '448') && a.parches.some((x) => /market=eq\.JP&id=eq\.M6A/.test(x.ruta) && x.cuerpo.tcggo_gemelos.join() === '431'), JSON.stringify(a.parches))
  check('  …apunta lo escrito y el día', a.estado.gemelas.dia === '2026-10-26' && a.estado.gemelas.escritos.length === 2 && a.estado.gemelas.ultima.pares === 1)
  const p2 = await calco.pasoDeGemelas({ ...a, episodios: episodiosJp, dia: '2026-10-26', ahora: AHORA })
  check('una vez al día', /hoy/.test(p2.saltado || ''))
  const b = montar({ sinColumna: true })
  const pb = await calco.pasoDeGemelas({ ...b, episodios: episodiosJp, dia: '2026-10-26', ahora: AHORA })
  check('sin la migración 1027 (42703) se apunta y no se escribe nada', /migración 1027/.test(pb.saltado || '') && b.parches.length === 0 && b.estado.gemelas.faltaMigracion, JSON.stringify(pb))
  const c = montar({ caida: true })
  const pc = await calco.pasoDeGemelas({ ...c, episodios: episodiosJp, dia: '2026-10-26', ahora: AHORA })
  check('un fallo se apunta y el día no se da por hecho', !pc.ok && c.estado.gemelas.ultimoError && c.estado.gemelas.dia !== '2026-10-26')
  const d = montar({ pares: false })
  const pd = await calco.pasoDeGemelas({ ...d, episodios: episodiosJp, dia: '2026-10-26', ahora: AHORA })
  check('sin la lista occidental ni gemelas en la japonesa, nada que escribir y el día hecho', pd.ok && pd.escritos === 0 && d.estado.gemelas.dia === '2026-10-26')
  check('el tope por pasada es pequeño (Netlify corta a los 30 s)', calco.GEMELAS_POR_PASADA <= 80)
  const js = readFileSync(join(RAIZ, 'netlify/functions/tcggo-calco-jp.mjs'), 'utf8')
  check('la pasada entera llama al paso después de las eras', /pasoDeEras\(\{[\s\S]{0,400}pasoDeGemelas\(\{/.test(js))
}

console.log('\n── 3. La estantería pide la columna con respaldo, de una en una ──')
{
  const pedidas = []
  const fetchImpl = async (url) => {
    pedidas.push(url)
    if (/tcggo_gemelos/.test(url)) return { ok: false, status: 400, text: async () => '{"code":"42703","message":"column tcg_sets.tcggo_gemelos does not exist"}', json: async () => ({}) }
    return { ok: true, status: 200, json: async () => [{ id: 'sv8', market: 'WEST', symbol_tcggo: 'https://x/s.png' }] }
  }
  const filas = await setsFn.leerSets('WEST', { fetchImpl })
  check('sin la migración 1027 se repite SIN `tcggo_gemelos` y CON el símbolo (929): se quita solo la que falta', filas.length === 1 && filas[0].symbol_tcggo && pedidas.length === 2 && /tcggo_gemelos/.test(pedidas[0]) && !/tcggo_gemelos/.test(pedidas[1]) && /symbol_tcggo/.test(pedidas[1]), pedidas.map((u) => u.slice(u.indexOf('select='), u.indexOf('&'))).join(' | '))
  check('  …y la web pide lo mismo que la función (los mismos nombres)', /COLUMNA_GEMELAS = 'tcggo_gemelos'/.test(readFileSync(join(RAIZ, 'js/sets-catalogo.js'), 'utf8')) && setsFn.COLUMNA_GEMELAS === 'tcggo_gemelos')
  const migracion = readFileSync(join(RAIZ, 'supabase-migration-1027-expansion-gemela.sql'), 'utf8')
  check('la migración crea la columna y la deja corregible desde /admin (885)', /add column if not exists tcggo_gemelos jsonb/.test(migracion) && /'origen', 'tcggo_gemelos'\]/.test(migracion))
  const admin = readFileSync(join(RAIZ, 'admin/js/colecciones.js'), 'utf8')
  check('/admin la ofrece en el editor y la guarda como corrección', /colGemelas/.test(admin) && /'tcggo_gemelos'\]\)/.test(admin) && /sinGemelas/.test(admin))
}

console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
