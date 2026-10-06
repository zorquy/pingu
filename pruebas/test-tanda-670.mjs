// Tanda 670 — el barrido de huecos: sets sin cartas que se rellenan solos.
//
// PINGU: «el Expansion Pack japonés está vacío: el logo está y te dice
// cuántas cartas contiene, pero cuando entras no hay cartas». Con los
// reemplazos de la lista hechos, cada pasada mira unos sets, pregunta a
// nuestra base si tienen alguna carta y rellena UNO vacío por pasada con
// su expansión de TCGGO.
import { readFileSync } from 'node:fs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const RAIZ = '/home/user/pingu'
const { pasada, REEMPLAZOS, CLAVE_ESTADO, MAXIMO_PROBADOS, MAXIMO_INTENTOS, DIAS_REVISAR } = await import(`${RAIZ}/netlify/functions/tcggo-reemplazar-set.mjs`)
const ENV = { SUPABASE_SERVICE_ROLE_KEY: 's', TCGGO_API_KEY: 'k' }

// Los dobles: dos mercados, con sets llenos y vacíos.
const SETS = {
  JP: [
    { id: 'BASE1', name: 'Expansion Pack', name_en: 'Expansion Pack', tcg_online_code: null, tcggo_id: 555, oculto: false },
    { id: 'SV1a', name: 'Triplet Beat', name_en: 'Triplet Beat', tcg_online_code: null, tcggo_id: 600, oculto: false },
    { id: 'SM1', name: 'Collection Sun', name_en: 'Collection Sun', tcg_online_code: null, tcggo_id: null, oculto: false },
    { id: 'tcggo-700', name: 'Collection Sun', name_en: 'Collection Sun', tcg_online_code: null, tcggo_id: 700, oculto: false },
    { id: 'XY1', name: 'Collection X', name_en: 'Collection X', tcg_online_code: null, tcggo_id: null, oculto: false },
    { id: 'OCULTO', name: 'Oculto', name_en: 'Oculto', tcggo_id: 999, oculto: true },
  ],
  WEST: [
    { id: 'sv1', name: 'Escarlata y Púrpura', name_en: 'Scarlet & Violet', tcg_online_code: 'SVI', tcggo_id: 10, oculto: false },
    { id: 'energias', name: 'Energías', name_en: 'Energies', tcg_online_code: null, tcggo_id: 11, oculto: false },
  ],
}
const montar = ({ llenos = ['SV1a', 'tcggo-700', 'sv1'], estadoInicial = null, lista = null } = {}) => {
  const estados = {
    [CLAVE_ESTADO]: estadoInicial || { hechos: Object.fromEntries(REEMPLAZOS.map((r) => [r.clave, { episodio: 1 }])), intentos: {} },
    tcggo_pares: { hechos: { sv1: { episodio: 10 } }, episodios: { lista: [{ id: 10, nombre: 'Scarlet & Violet', codigo: 'SVI', cartas: 258 }, { id: 11, nombre: 'Energies', codigo: null, cartas: 0 }] } },
    tcggo_catalogo: { episodiosJp: { lista: lista || [{ id: 555, nombre: 'Expansion Pack', codigo: 'BASE1', cartas: 102 }, { id: 700, nombre: 'Collection Sun', codigo: 'SM1', cartas: 60 }] } },
  }
  const llamadas = []
  const hechas = []
  return {
    estados, llamadas, hechas,
    estadoImpl: async (k) => estados[k] || {},
    guardarEstadoImpl: async (k, v) => { estados[k] = JSON.parse(JSON.stringify(v)) },
    restImpl: async (ruta, opciones = null) => {
      llamadas.push({ ruta: decodeURIComponent(ruta), metodo: opciones?.method || 'GET', cuerpo: opciones?.body ? JSON.parse(opciones.body) : null })
      if (opciones) return null
      const m = (ruta.match(/market=eq\.(\w+)/) || [])[1]
      if (ruta.startsWith('tcg_sets?')) return SETS[m] || []
      if (ruta.startsWith('tcg_cards?')) { const id = decodeURIComponent((ruta.match(/set_id=eq\.([^&]+)/) || [])[1] || ''); return llenos.includes(id) ? [{ id: 'una' }] : [] }
      return []
    },
    procesarImpl: async (o) => { hechas.push(o); return { ok: true, escritas: 102, suyas: 102 } },
  }
}

console.log('── 1. La primera pasada: el Expansion Pack, vacío y con expansión, se rellena ──')
{
  const b = montar()
  const r = await pasada({ env: ENV, ...b })
  check('la pasada dice hecho (la lista) y trae el barrido', r.ok && r.hecho === true && r.huecos && typeof r.huecos.probados === 'number', JSON.stringify(r).slice(0, 300))
  check(`se prueban como mucho ${MAXIMO_PROBADOS} sets, y el oculto no se mira`, r.huecos.probados <= MAXIMO_PROBADOS && !b.llamadas.some((l) => /set_id=eq\.OCULTO/.test(l.ruta)))
  check('el BASE1 (vacío, tcggo_id 555) se rellena con `procesar`: su set, su mercado, su expansión', b.hechas.length === 1 && b.hechas[0].sets.join() === 'BASE1' && b.hechas[0].destino === 'BASE1' && b.hechas[0].mercado === 'JP' && b.hechas[0].episodio === 555, JSON.stringify(b.hechas.map((x) => [x.sets, x.destino, x.mercado, x.episodio])))
  check('  …UNO por pasada: el resto de huecos espera', b.hechas.length === 1 && r.huecos.rellenado?.set === 'BASE1')
  const h = b.estados[CLAVE_ESTADO].huecos
  check('  …y queda apuntado como rellenado, con la expansión y las cartas', h.vistos['JP:BASE1']?.estado === 'rellenado' && h.vistos['JP:BASE1'].episodio === 555 && h.vistos['JP:BASE1'].cartas === 102, JSON.stringify(h))
}

console.log('\n── 2. La segunda pasada: los llenos, los hermanos y los que no tienen expansión ──')
{
  const b = montar()
  await pasada({ env: ENV, ...b })
  const r2 = await pasada({ env: ENV, ...b })
  const h = b.estados[CLAVE_ESTADO].huecos
  check('el BASE1 ya no se vuelve a mirar (rellenado)', b.hechas.length === 1 || b.hechas.every((x) => x.sets[0] !== 'BASE1'), JSON.stringify(b.hechas.map((x) => [x.sets, x.destino, x.mercado, x.episodio])))
  check('SV1a tiene cartas: «lleno»', h.vistos['JP:SV1a']?.estado === 'lleno')
  check('SM1 (vacío, sin tcggo_id) casa por código con la 700, que YA lleva tcggo-700: hermano, se le apunta el tcggo_id y NO se rellena', h.vistos['JP:SM1']?.estado === 'hermano' && h.vistos['JP:SM1'].de.join() === 'tcggo-700' && b.llamadas.some((l) => l.metodo === 'PATCH' && /tcg_sets\?market=eq\.JP&id=eq\.SM1/.test(l.ruta) && l.cuerpo.tcggo_id === 700) && !b.hechas.some((x) => x.sets[0] === 'SM1'), JSON.stringify(h.vistos['JP:SM1']))
  check('XY1 (vacío, sin ninguna expansión suya que case): un cascarón, se ESCONDE (672) y no se rellena', h.vistos['JP:XY1']?.estado === 'ocultado' && b.llamadas.some((l) => l.metodo === 'PATCH' && /tcg_sets\?market=eq\.JP&id=eq\.XY1/.test(l.ruta) && l.cuerpo.oculto === true) && !b.hechas.some((x) => x.sets[0] === 'XY1'), JSON.stringify(h.vistos['JP:XY1']))
  check('las energías occidentales (vacías, expansión con CERO cartas en su lista): «vacioEnTcggo», sin pedir nada', h.vistos['WEST:energias']?.estado === 'vacioEnTcggo' && !b.hechas.some((x) => x.sets[0] === 'energias'), JSON.stringify(h.vistos['WEST:energias']))
  check('sv1 lleno', h.vistos['WEST:sv1']?.estado === 'lleno' && r2.ok)
  const r3 = await pasada({ env: ENV, ...b })
  check('la tercera pasada no prueba nada: todo visto hace menos de una semana', r3.huecos.probados === 0 && b.hechas.length === 1, JSON.stringify(r3.huecos))
  // Y pasada la semana, lo que no se rellenó se vuelve a mirar (el lleno también: una carta se puede borrar).
  const dentroDeOchoDias = new Date(Date.now() + (DIAS_REVISAR + 1) * 86_400_000)
  const r4 = await pasada({ env: ENV, ...b, ahora: dentroDeOchoDias })
  check(`a los ${DIAS_REVISAR} días se vuelven a mirar los no rellenados, y el rellenado no`, r4.huecos.probados > 0 && !b.llamadas.slice(-r4.huecos.probados * 2).some((l) => /set_id=eq\.BASE1/.test(l.ruta)) && b.hechas.length === 1, JSON.stringify(r4.huecos))
}

console.log('\n── 3. Un relleno que falla cuenta intentos y para ──')
{
  const b = montar()
  b.procesarImpl = async () => ({ ok: false, error: 'TCGGO 500' })
  for (let k = 0; k < MAXIMO_INTENTOS + 2; k++) await pasada({ env: ENV, ...b, ahora: new Date(Date.now() + k * (DIAS_REVISAR + 1) * 86_400_000) })
  const h = b.estados[CLAVE_ESTADO].huecos
  check(`a los ${MAXIMO_INTENTOS} fallos el set queda «parado» con su error, y no se vuelve a pedir`, h.vistos['JP:BASE1']?.estado === 'parado' && h.intentos['JP:BASE1'] === MAXIMO_INTENTOS && h.ultimoError?.error === 'TCGGO 500', JSON.stringify({ v: h.vistos['JP:BASE1'], i: h.intentos }))
}

console.log('\n── 4. Lo estático ──')
{
  const js = readFileSync(`${RAIZ}/admin/js/admin.js`, 'utf8')
  check('el panel resume los huecos (rellenados, parados, último error) en vez de volcar el mapa', /HUECOS \(sets sin cartas, 670\)/.test(js) && /huecos: undefined/.test(js))
}

console.log(fails ? `\n${fails} FALLOS` : '\nTODO OK')
process.exit(fails ? 1 : 0)
