// Tanda 825 — las eras del japonés como las tiene TCGGO, y de quién es la
// culpa de que una expansión japonesa se quede sin precio.
const RAIZ = '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const lib = await import(`${RAIZ}/netlify/lib/tcggo.mjs`)
const calco = await import(`${RAIZ}/netlify/functions/tcggo-calco-jp.mjs`)
const precios = await import(`${RAIZ}/netlify/functions/tcggo-precios.mjs`)

// La forma de PINGU: Expansion Pack con la era vieja, Jungle con una propia
// (la abrió al crearse porque el nombre de la serie no casaba) y Fossil sin
// ninguna. Las tres son la misma serie de TCGGO.
const EPISODIOS = [
  { id: 708, nombre: 'Expansion Pack', serie: 'Original Era', serieId: 'original-era' },
  { id: 709, nombre: 'Jungle', serie: 'Original Era', serieId: 'original-era' },
  { id: 710, nombre: 'Fossil', serie: 'Original Era', serieId: 'original-era' },
  { id: 711, nombre: 'Rocket Gang', serie: 'Original Era', serieId: 'original-era' },
  { id: 800, nombre: 'Scarlet ex', serie: 'Scarlet & Violet', serieId: 'scarlet-violet' },
  { id: 801, nombre: 'Violet ex', serie: 'Scarlet & Violet', serieId: 'scarlet-violet' },
  { id: 900, nombre: 'Algo suelto', serie: null, serieId: null },
  { id: 901, nombre: 'Algo sin fecha', serie: null, serieId: null },
]
const SETS = [
  { id: 'tg-708', name_en: 'Expansion Pack', tcggo_id: 708, serie_id: 'base', serie_name: 'Base', serie_name_en: 'Base', release_date: '1996-10-20' },
  { id: 'tg-709', name_en: 'Jungle', tcggo_id: 709, serie_id: 'original-era', serie_name: null, serie_name_en: 'Original Era', release_date: '1997-03-05' },
  { id: 'tg-710', name_en: 'Fossil', tcggo_id: 710, serie_id: null, release_date: '1997-06-21' },
  { id: 'tg-711', name_en: 'Rocket Gang', tcggo_id: 711, serie_id: 'base', serie_name: 'Base', serie_name_en: 'Base', release_date: '1997-11-21' },
  { id: 'sv1s', name_en: 'Scarlet ex', tcggo_id: 800, serie_id: 'SV', serie_name: 'Escarlata y Púrpura', serie_name_en: 'Scarlet & Violet', release_date: '2023-01-20' },
  { id: 'sv1v', name_en: 'Violet ex', tcggo_id: 801, serie_id: 'scarlet-violet', serie_name: null, serie_name_en: 'Scarlet & Violet', release_date: '2023-01-20' },
  { id: 'tg-900', name_en: 'Algo suelto', tcggo_id: 900, serie_id: null, release_date: '1997-08-01' },
  { id: 'tg-901', name_en: 'Algo sin fecha', tcggo_id: 901, serie_id: null, release_date: null },
  { id: 'viejo', name_en: 'Escondido', tcggo_id: 709, serie_id: 'otra', oculto: true },
]
const aplicar = (sets, cambios) => sets.map((s) => { const c = cambios.find((x) => x.id === s.id); return c ? { ...s, ...c.a } : s })
const r = lib.erasDeTcggo(SETS, EPISODIOS)
const de = (id) => r.cambios.find((c) => c.id === id)
check('Jungle entra en la era de Expansion Pack (la de la mayoría)', de('tg-709')?.a.serie_id === 'base', JSON.stringify(de('tg-709')))
check('  …y Fossil, que no tenía ninguna', de('tg-710')?.a.serie_id === 'base')
check('  …con el nombre propio que ya tenía la era y el inglés de TCGGO', de('tg-709').a.serie_name === 'Base' && de('tg-709').a.serie_name_en === 'Original Era')
check('una expansión sin serie va a la era cuyas fechas la cubren', de('tg-900')?.a.serie_id === 'base' && de('tg-900').por === 'fecha')
check('  …y sin fecha se queda como está, apuntada', !de('tg-901') && r.sinEra.includes('tg-901'))
check('un set escondido no se toca', !de('viejo'))
check('dos series suyas no comparten era', new Set(r.eras.map((e) => e.serie_id)).size === r.eras.length, JSON.stringify(r.eras))
check('en un empate sin nada a mano, el orden es estable', de('sv1s')?.a.serie_id === 'scarlet-violet')
const empate = lib.erasDeTcggo(SETS, EPISODIOS, { aMano: new Set(['SV']) })
check('en un empate gana la era colocada a mano en /admin', empate.cambios.find((c) => c.id === 'sv1v')?.a.serie_id === 'SV' && empate.cambios.find((c) => c.id === 'sv1v').a.serie_name === 'Escarlata y Púrpura', JSON.stringify(empate.cambios.filter((c) => c.id.startsWith('sv'))))
const sinNadie = lib.erasDeTcggo([{ id: 'a', tcggo_id: 1 }, { id: 'b', tcggo_id: 2 }], [{ id: 1, serie: 'Mega Evolution', serieId: null }, { id: 2, serie: 'Mega Evolution' }])
check('una serie en la que nadie tiene era estrena «tg-<slug>», la misma para todos', sinNadie.cambios.length === 2 && sinNadie.cambios.every((c) => c.a.serie_id === 'tg-mega-evolution'), JSON.stringify(sinNadie.cambios))
const despues = aplicar(SETS, r.cambios)
check('aplicado, la segunda pasada no cambia nada', lib.erasDeTcggo(despues, EPISODIOS).cambios.length === 0, JSON.stringify(lib.erasDeTcggo(despues, EPISODIOS).cambios))
const puestas = Object.fromEntries(r.cambios.map((c) => [c.id, c.a.serie_id]))
const aMano = despues.map((s) => (s.id === 'tg-709' ? { ...s, serie_id: 'mi-era' } : s))
const otra = lib.erasDeTcggo(aMano, EPISODIOS, { puestas })
check('lo que alguien movió a mano después no se pisa', !otra.cambios.some((c) => c.id === 'tg-709') && otra.respetadas.includes('tg-709'), JSON.stringify(otra))

// El set NUEVO coge la era de un hermano de su serie, no una propia.
const nuevo = lib.serieDeEpisodio({ id: 712, nombre: 'Team Rocket', serie: 'Original Era', serieId: 'original-era' }, despues, EPISODIOS)
check('un set nuevo coge la era de un hermano de su serie de TCGGO', nuevo?.serie_id === 'base' && nuevo.por === 'hermano', JSON.stringify(nuevo))
check('  …y sin la lista, como antes (por el nombre)', lib.serieDeEpisodio({ id: 712, serie: 'Original Era', serieId: 'original-era' }, despues)?.por !== 'hermano')

// La pasada: escribe, apunta lo movido, una vez al día.
const parches = []
let estado = { cascarones: { listo: true } }
const pedir = async (ruta, o = null) => {
  const rr = decodeURIComponent(ruta)
  if (o?.method === 'PATCH') { parches.push({ ruta: rr, cuerpo: JSON.parse(o.body) }); return null }
  if (rr.startsWith('tcg_sets?')) return rr.includes('oculto=is.false') ? SETS.filter((s) => !s.oculto) : []
  if (rr.startsWith('tcg_eras?')) throw new Error('42P01')
  return []
}
const AHORA = new Date('2026-10-14T09:00:00Z')
const p1 = await calco.pasoDeEras({ pedir, estado, episodios: EPISODIOS, dia: '2026-10-14', ahora: AHORA, persistir: async () => {} })
check('escribe los cambios (y sin la tabla de eras a mano sigue)', p1.ok && parches.length === r.cambios.length && parches.some((x) => /id=eq\.tg-709/.test(x.ruta) && x.cuerpo.serie_id === 'base'), JSON.stringify(p1))
check('  …apunta lo movido con su era de antes, para deshacer', estado.eras.movidos.some((m) => m.id === 'tg-709' && m.de === 'original-era' && m.a === 'base'))
check('  …y lo que puso, para respetar luego lo que se cambie a mano', estado.eras.puestas['tg-709'] === 'base')
const p2 = await calco.pasoDeEras({ pedir, estado, episodios: EPISODIOS, dia: '2026-10-14', ahora: AHORA, persistir: async () => {} })
check('una vez al día', /hoy/.test(p2.saltado || ''))
estado = { cascarones: { listo: true } }
parches.length = 0
const caido = await calco.pasoDeEras({ pedir: async (ruta, o) => { if (o?.method === 'PATCH') throw new Error('Supabase 500'); return pedir(ruta, o) }, estado, episodios: EPISODIOS, dia: '2026-10-14', ahora: AHORA, persistir: async () => {} })
check('un fallo se apunta y el día no se da por hecho', !caido.ok && estado.eras.ultimoError && estado.eras.dia !== '2026-10-14')
check('el tope por pasada es pequeño (Netlify corta a los 30 s)', calco.ERAS_POR_PASADA <= 80)

// Precios: qué es «tener precio».
check('tiene precio: un mínimo en cualquier idioma', precios.tienePrecio({ prices: { cardmarket: { lowest_near_mint_JP: 3 } } }))
check('  …o TCGplayer', precios.tienePrecio({ prices: { tcg_player: { market_price: 2 } } }))
check('  …y no con todo a cero o vacío', !precios.tienePrecio({ prices: { cardmarket: { lowest_near_mint: 0, available_items: 4 } } }) && !precios.tienePrecio({}))
const fuente = (await import('node:fs')).readFileSync(`${RAIZ}/netlify/functions/tcggo-precios.mjs`, 'utf8')
check('la pasada apunta cada expansión japonesa y lo reinicia cada día', /resumenJp = \{ \.\.\.\(estado\.resumenJp/.test(fuente) && /resumenJp: \{\} \}/.test(fuente))
const admin = (await import('node:fs')).readFileSync(`${RAIZ}/admin/js/admin.js`, 'utf8')
check('/admin enseña las dos cosas', /lineasDePreciosJp\(p\.resumenJp/.test(admin) && /lineasDeErasJp\(k\.eras\)/.test(admin))
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
