// Tanda 544 — por qué 36 sets japoneses se quedaron en kanji y 21 sin chapa.
//
// Los números de PINGU, después de limpiar los huecos de TCGdex:
//
//   sets_jp  con_nombre_occidental  con_logo  emparejados
//   118      82                     61        82
//
// O sea: 36 sets sin nombre occidental y 57 sin logo, con 231 expansiones
// suyas enfrente y su listado trayendo los 231 logos. Dos fallos distintos,
// los dos de la misma familia —algo que se lee como una respuesta cuando no
// lo es— y ninguno de los dos da error.
//
//   1. EL EMPAREJAMIENTO SE LO COMÍA OTRO. El rescate por id existía desde
//      la 508, pero corría DESPUÉS de la fecha y la cuenta. En Japón salen
//      tres o cuatro sets el mismo día con la misma cuenta (un set y sus
//      mazos de ejemplo), así que el primero que pasa por el bucle se lleva
//      por fecha+cuenta el set suyo que por ID era de otro — y al dueño del
//      id ya no le queda nada que rescatar.
//
//   2. UN FALLO DE RED SE LEÍA COMO «NO TIENEN LOGO». `dibujoDeVerdad`
//      contestaba lo mismo para el relleno que para un tropiezo de su
//      servidor, y lo que se tacha no se escribe. Y el set quedaba
//      emparejado, así que la pregunta «¿queda algo?» —que miraba solo
//      `scrydex_id`— decía que no: 21 sets sin chapa PARA SIEMPRE por un
//      rato malo.
import { readFileSync } from 'node:fs'
import { emparejarSets, parejasPorId, parejasGuardadas, CAMPOS_SUYOS, HUELLAS_DE_RELLENO } from '/home/user/pingu/netlify/lib/scrydex.mjs'
import { procesar } from '/home/user/pingu/netlify/functions/scrydex-sets.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 320) : ''}`)
}
const ENV = { SCRYDEX_API_KEY: 'k', SCRYDEX_TEAM_ID: 't', SUPABASE_SERVICE_ROLE_KEY: 's' }

console.log('── 1. Un id idéntico NO pierde contra una fecha compartida ──')
{
  // El caso japonés de verdad: dos sets nuestros del MISMO DÍA, y de los
  // suyos solo uno con la misma cuenta. El que va primero por el bucle se
  // lo llevaba por fecha+cuenta aunque el id dijera lo contrario.
  const nuestros = [
    { id: 'SVC', market: 'JP', name: 'クレイバースト', release_date: '2023-03-10', card_count_total: 78 },
    { id: 'SV1a', market: 'JP', name: 'トリプレットビート', release_date: '2023-03-10', card_count_total: 78 },
  ]
  const suyos = [
    { id: 'sv1a_ja', name: 'トリプレットビート', release_date: '2023/03/10', total: 78 },
    { id: 'svc_ja', name: 'クレイバースト', release_date: '2023/03/10', total: 99 },
  ]
  const { pares, sueltos, ambiguos } = emparejarSets(nuestros, suyos, { suyos: CAMPOS_SUYOS })
  const de = (id) => pares.find((p) => p.nuestro.id === id)?.suyo?.id || null
  check('cada uno con el suyo', de('SV1a') === 'sv1a_ja' && de('SVC') === 'svc_ja', JSON.stringify(pares.map((p) => `${p.nuestro.id}→${p.suyo.id} (${p.por})`)))
  check('  …y ninguno se queda suelto', sueltos.length === 0 && ambiguos.length === 0, JSON.stringify(sueltos.map((x) => x.nuestro.id)))
  check('y queda dicho que fue por el id', pares.some((p) => p.por === 'id idéntico'), JSON.stringify(pares.map((p) => p.por)))
}

console.log('── 2. Pero un id REPETIDO no reparte nada ──')
{
  // Marcar de menos cuesta un set sin emparejar; marcar de más escribe el
  // logo de otro set encima del bueno. Así que un id que no es único en los
  // dos lados se deja para la fecha y la cuenta.
  const nuestros = [{ id: 'SV1', market: 'JP', name: 'x' }]
  const dosSuyos = [{ set: { id: 'sv1_ja' } }, { set: { id: 'sv1_jp' } }]
  check('dos de los suyos con el mismo id: ninguno', parejasPorId(nuestros, dosSuyos).length === 0)
  check('uno solo: ese', parejasPorId(nuestros, [{ set: { id: 'sv1_ja' } }])[0]?.suyo?.id === 'sv1_ja')
  const dosNuestros = [{ id: 'SV1' }, { id: 'sv1' }]
  check('dos de los nuestros con el mismo id: ninguno', parejasPorId(dosNuestros, [{ set: { id: 'sv1_ja' } }]).length === 0)
  // Y sin id no hay pareja: una cadena vacía no es una llave.
  check('un set sin id no empareja', parejasPorId([{ id: '' }], [{ set: { id: '' } }]).length === 0)
}

console.log('── 3. Un par YA GUARDADO es un dato, no un cálculo ──')
{
  const nuestros = [{ id: 'S8b', scrydex_id: 's8b_ja', scrydex_por: 'el código del set' }]
  const suyos = [{ set: { id: 's8b_ja' } }, { set: { id: 'otro_ja' } }]
  check('se empareja por lo guardado', parejasGuardadas(nuestros, suyos)[0]?.suyo?.id === 's8b_ja')
  // Un `scrydex_id` que ya no está en su catálogo NO se da por bueno: se
  // deja caer al emparejamiento normal, que es quien sabe decir «suelto».
  check('y si ese ya no está en su catálogo, no se inventa', parejasGuardadas([{ id: 'X', scrydex_id: 'fue_ja' }], suyos).length === 0)
  check('sin nada guardado, nada', parejasGuardadas([{ id: 'X' }], suyos).length === 0)
}

// ── El doble, con las dos formas que importan ──
const LOGO_BUENO = 'https://images.scrydex.com/pokemon/sv1a_ja-logo/logo'
const LOGO_RELLENO = 'https://images.scrydex.com/pokemon/svc_ja-logo/logo'
const LOGO_CAIDO = 'https://images.scrydex.com/pokemon/s8b_ja-logo/logo'
const RELLENO_BYTES = Buffer.from('__RELLENO__')
// No se pueden fabricar unos bytes cuyo sha-1 empiece por una huella dada,
// así que la huella es inyectable y la decisión la sigue tomando `esRelleno`.
const huellaDePrueba = (buf) => (buf.equals(RELLENO_BYTES) ? `${HUELLAS_DE_RELLENO.logo}0000` : 'aa'.repeat(20))

function doble({ caida = 'tira' } = {}) {
  const escrito = []
  const llamadas = []
  const restImpl = async (ruta) => {
    llamadas.push(ruta)
    if (/tcg_cards/.test(ruta)) return [{ local_id: '001', name: 'Pikachu', dex_ids: [25] }]
    return [
      // Emparejado y confirmado hace tiempo: no se le vuelve a preguntar.
      { id: 'S8b', market: 'JP', name: 'VMAXクライマックス', release_date: '2021-12-03', card_count_total: 184, scrydex_id: 's8b_ja', scrydex_por: 'el código del set', logo_scrydex: null, symbol_scrydex: null, name_en: 'VMAX Climax' },
      // Sin emparejar, y su pareja solo la encuentra el id.
      { id: 'SV1a', market: 'JP', name: 'トリプレットビート', release_date: '2023-03-10', card_count_total: 78, tcg_online_code: null, scrydex_id: null, logo_scrydex: null, symbol_scrydex: null, name_en: null },
      { id: 'SVC', market: 'JP', name: 'クレイバースト', release_date: '2023-03-10', card_count_total: 78, tcg_online_code: null, scrydex_id: null, logo_scrydex: null, symbol_scrydex: null, name_en: null },
    ]
  }
  const fetchImpl = async (url) => {
    llamadas.push(url)
    if (/\/expansions/.test(url)) {
      return { ok: true, json: async () => ({ total_count: 3, data: [
        { id: 'sv1a_ja', name: 'トリプレットビート', translation: { en: { name: 'Triplet Beat' } }, release_date: '2023/03/10', total: 78, logo: LOGO_BUENO },
        { id: 'svc_ja', name: 'クレイバースト', translation: { en: { name: 'Clay Burst' } }, release_date: '2023/03/10', total: 99, logo: LOGO_RELLENO },
        { id: 's8b_ja', name: 'VMAXクライマックス', translation: { en: { name: 'VMAX Climax' } }, release_date: '2021/12/03', total: 184, logo: LOGO_CAIDO },
      ] }) }
    }
    if (/\/cards\//.test(url)) return { ok: true, json: async () => ({ data: { id: 'x', name: 'Pikachu', national_pokedex_numbers: [25], expansion: { id: url.split('/cards/')[1].split('-')[0] } } }) }
    // Las imágenes.
    if (url === LOGO_CAIDO) {
      if (caida === 'tira') throw new Error('socket hang up')
      if (caida === '500') return { ok: false, status: 503 }
      if (caida === '404') return { ok: false, status: 404 }
    }
    const cuerpo = url === LOGO_RELLENO ? RELLENO_BYTES : Buffer.from(`dibujo de ${url}`)
    return { ok: true, status: 206, arrayBuffer: async () => cuerpo }
  }
  return { restImpl, fetchImpl, escribirImpl: async (filas) => { escrito.push(...filas) }, escrito, llamadas }
}

console.log('── 4. La pasada entera: lo que se escribe y lo que se gasta ──')
{
  const d = doble()
  const r = await procesar({ env: ENV, mercado: 'JP', idioma: 'ja', escribir: true, fetchImpl: d.fetchImpl, restImpl: d.restImpl, escribirImpl: d.escribirImpl, huellaImpl: huellaDePrueba })
  check('contesta 200', r.estado === 200, JSON.stringify(r.cuerpo?.error))
  check('los tres emparejados', r.cuerpo.emparejados === 3 && r.cuerpo.sinEmparejar === 0, JSON.stringify([r.cuerpo.emparejados, r.cuerpo.sinEmparejar]))
  check('  …uno de ellos porque ya lo estaba', r.cuerpo.yaEstabanGuardados === 1, String(r.cuerpo.yaEstabanGuardados))
  // LO QUE SE AHORRA: una confirmación guardada no se vuelve a pagar.
  const porCartas = d.llamadas.filter((x) => /\/cards\//.test(String(x)))
  check('y NO se le pide ninguna carta de ese', !porCartas.some((x) => /s8b/.test(x)), JSON.stringify(porCartas))
  check('la cuenta cuadra', r.cuerpo.cuadraLaCuenta === true, r.cuerpo.AVISO || '')
  const fila = (id) => d.escrito.find((f) => f.id === id)
  check('el nombre occidental llega a los dos nuevos', fila('SV1a')?.name_en === 'Triplet Beat' && fila('SVC')?.name_en === 'Clay Burst', JSON.stringify(d.escrito.map((f) => [f.id, f.name_en])))
  check('con el logo bueno', fila('SV1a')?.logo_scrydex === LOGO_BUENO, fila('SV1a')?.logo_scrydex)
  // El relleno de su servidor no se escribe: se pinta igual que un logo
  // bueno y nadie lo distingue (la lección de la 499).
  check('y el RELLENO no se escribe', fila('SVC')?.logo_scrydex === null, fila('SVC')?.logo_scrydex)
  check('  …y se dice que es suyo', r.cuerpo.descartadosPorRelleno === 1, JSON.stringify(r.cuerpo.ejemplosDeRelleno))
}

console.log('── 5. Un fallo de red NO es «no tienen logo» ──')
for (const [caso, esSuyo] of [['tira', false], ['500', false], ['404', true]]) {
  const d = doble({ caida: caso })
  const r = await procesar({ env: ENV, mercado: 'JP', idioma: 'ja', escribir: true, fetchImpl: d.fetchImpl, restImpl: d.restImpl, escribirImpl: d.escribirImpl, huellaImpl: huellaDePrueba })
  const sinMirar = JSON.stringify(r.cuerpo.ejemplosSinMirar || [])
  const relleno = JSON.stringify(r.cuerpo.ejemplosDeRelleno || [])
  if (esSuyo) {
    check(`un ${caso} es SUYO y se da por definitivo`, /S8b/.test(relleno) && !/S8b/.test(sinMirar), relleno + sinMirar)
  } else {
    check(`un ${caso} queda como «no se ha podido mirar»`, /S8b/.test(sinMirar) && !/S8b/.test(relleno), sinMirar + relleno)
  }
  // En los tres casos la URL que no se ha visto NO se escribe: eso no
  // cambia, porque escribir un cuadro de «no image» es peor que un hueco.
  const f = d.escrito.find((x) => x.id === 'S8b')
  check('  …y en ninguno de los dos casos se escribe esa URL', !f || f.logo_scrydex === null, JSON.stringify(f || null))
}

console.log('── 6. Y «emparejado» no es «terminado» ──')
{
  // El freno de las dos pasadas de logos preguntaba solo por `scrydex_id`,
  // así que un set con pareja y sin chapa quedaba fuera de la pregunta para
  // siempre. Es la familia del aviso que no para (tanda 510): si la
  // pregunta no incluye el caso, la respuesta no puede traerlo.
  for (const f of ['scrydex-logos.mjs', 'scrydex-logos-jp.mjs']) {
    const fuente = readFileSync(`/home/user/pingu/netlify/functions/${f}`, 'utf8')
    const pregunta = fuente.split('async function quedaAlgoPorEmparejar')[1]?.split('catch')[0] || ''
    check(`${f} cuenta los emparejados sin logo`, /logo_scrydex\.is\.null/.test(pregunta), pregunta.slice(0, 200))
    check(`  …y sigue contando los sin emparejar`, /scrydex_id\.is\.null/.test(pregunta))
  }
}

console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
