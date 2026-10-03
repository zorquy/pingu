// Tanda 505 — lo que la 504 llamó «rechazado» y no lo era.
//
// La pasada de verdad: 171 pares, 150 confirmados, **8 rechazados** y 13
// en 404. Y los ocho rechazos eran FALSOS, los ocho por el mismo motivo:
//
//   sm10 → sm10   nuestra «Pheromosa y Buzzwole GX» vs suya «Pheromosa & Buzzwole-GX»
//   sv10 → sv10   nuestra «Pinsir de Eco»           vs suya «Ethan's Pinsir»
//   sve  → sve    nuestra «Energía Planta»          vs suya «Basic Grass Energy»
//
// Nuestro `name` del catálogo occidental está en ESPAÑOL en parte de las
// filas. SEIS de los ocho tenían el id IDÉNTICO, o sea que eran el mismo
// set con toda seguridad. La guarda del alfabeto de la 504 no lo vio
// porque esto no es otro alfabeto: es el MISMO alfabeto en otro IDIOMA.
//
// Y los trece 404 eran todos de la misma forma: `swsh12tg-tg1` donde
// nuestra carta es la `TG01`. Ellos guardan el número tal como está
// impreso; mi normalización lo estropeaba.
import { verificarPar, formasDeId, culpaDeLaDiscrepancia } from '/home/user/pingu/netlify/lib/scrydex.mjs'
import { procesar } from '/home/user/pingu/netlify/functions/scrydex-verificar.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 320) : ''}`)
}
const ENV = { SCRYDEX_API_KEY: 'k', SCRYDEX_TEAM_ID: 't', SUPABASE_SERVICE_ROLE_KEY: 's' }

console.log('── 1. Un nombre que no coincide ya NO es un rechazo ──')
{
  // Los tres casos REALES de la pasada, pegados tal cual salieron.
  for (const [a, b] of [
    ['Pheromosa y Buzzwole GX', 'Pheromosa & Buzzwole-GX'],
    ['Pinsir de Eco', "Ethan's Pinsir"],
    ['Energía Planta', 'Basic Grass Energy'],
    ['Rowlet y Exeggutor de Alola GX', 'Rowlet & Alolan Exeggutor-GX'],
  ]) {
    const v = verificarPar({ nuestroNombre: a, suyoNombre: b })
    check(`«${a}» no se RECHAZA`, v.veredicto === 'discrepan' && v.veredicto !== 'rechazado', JSON.stringify(v))
  }
  check('y uno que coincide sigue confirmando', verificarPar({ nuestroNombre: 'Jynx', suyoNombre: 'Jynx' }).veredicto === 'confirmado')
}

console.log('\n── 2. La prueba LOCAL de quién tiene la culpa ──')
//
// La migración de la 335 copió el nombre traducido a `name_es` antes de
// recuperar el inglés. Así que una fila en la que `name` y `name_es` valen
// LO MISMO tiene el español metido en `name`.
{
  const c = culpaDeLaDiscrepancia({ name: 'Pinsir de Eco', nameEs: 'Pinsir de Eco' })
  check('si `name` vale lo mismo que `name_es`, la culpa es NUESTRA', c.culpa === 'nuestra', JSON.stringify(c))
  check('  …y se dice que no dice nada del par', /no dice nada del par/.test(c.porque), c.porque)
  // Una fila YA arreglada: el inglés en `name`, el español en `name_es`.
  // Ahí una discrepancia sí es sospechosa y hay que mirarla.
  const d = culpaDeLaDiscrepancia({ name: "Ethan's Pinsir", nameEs: 'Pinsir de Eco' })
  check('con el inglés ya puesto, la culpa es desconocida', d.culpa === 'desconocida', JSON.stringify(d))
  check('sin `name_es`, tampoco se echa la culpa a nadie', culpaDeLaDiscrepancia({ name: 'Algo' }).culpa === 'desconocida')
  // Y no se echa la culpa por casualidad con dos vacíos.
  check('dos vacíos no son «la misma»', culpaDeLaDiscrepancia({ name: '', nameEs: '' }).culpa === 'desconocida')
}

console.log('\n── 3. Las formas del id, la LITERAL primero ──')
{
  // Los trece 404 de la pasada: ellos guardan «TG01», no «tg1».
  const f = formasDeId('swsh12tg', 'TG01')
  check('se prueba «TG01» antes que «tg1»', f[0] === 'swsh12tg-TG01', JSON.stringify(f))
  check('  …pero «tg1» se sigue probando', f.includes('swsh12tg-tg1'), JSON.stringify(f))
  // El caso para el que existía la normalización: nuestro «001» japonés
  // contra su «1». Tiene que seguir funcionando.
  check('«001» todavía se prueba como «1»', formasDeId('sv1a', '001').includes('sv1a-1'), JSON.stringify(formasDeId('sv1a', '001')))
  check('sin repetir cuando las formas coinciden', formasDeId('x', '58').length === 1, JSON.stringify(formasDeId('x', '58')))
  check('sin set o sin número, no monta nada', formasDeId('', '1').length === 0 && formasDeId('x', '').length === 0)
}

console.log('\n── 4. El verificador entero, con los casos de la pasada ──')
// EL DOBLE RESPETA EL `select=` (lección de la 437): devolver una columna
// que no se ha pedido es ser más generoso que PostgREST, y eso esconde
// fallos que en producción no pueden pasar. Sin esto, quitar `name_es` de
// la consulta no se notaba: el doble lo devolvía igual.
const soloLoPedido = (ruta, filas) => {
  const sel = /select=([^&]+)/.exec(ruta)
  if (!sel) return filas
  const cols = decodeURIComponent(sel[1]).split(',').map((c) => c.trim())
  return filas.map((f) => Object.fromEntries(cols.filter((c) => c in f).map((c) => [c, f[c]])))
}

const doble = ({ soloLiteral = true } = {}) => {
  const llamadas = []
  const restImpl = async (ruta) => {
    llamadas.push(ruta)
    if (/tcg_cards/.test(ruta)) {
      // `sv10`: el español metido en `name` Y en `name_es` — culpa nuestra.
      if (/set_id=eq\.sv10/.test(ruta)) return soloLoPedido(ruta, [{ local_id: '001', name: 'Pinsir de Eco', name_es: 'Pinsir de Eco' }])
      // `tk-xy-latia`: el inglés ya puesto y el nombre discrepa. ESTE hay
      // que mirarlo a mano, y es el único.
      if (/set_id=eq\.tk-xy-latia/.test(ruta)) return soloLoPedido(ruta, [{ local_id: '1', name: 'Grass Energy', name_es: 'Energía Planta' }])
      // `swsh12.5tg`: su id lleva «TG01», que es el 404 de la 504.
      if (/set_id=eq\.swsh12\.5tg/.test(ruta)) return soloLoPedido(ruta, [{ local_id: 'TG01', name: 'Jynx', name_es: null }])
      return []
    }
    return [
      { id: 'sv10', name: 'Destined Rivals', release_date: '2026-05-30', card_count_total: 182 },
      { id: 'tk-xy-latia', name: 'Kit Latias', release_date: '2015-03-01', card_count_total: 30 },
      { id: 'swsh12.5tg', name: 'Crown Zenith GG', release_date: '2023-01-20', card_count_total: 70 },
    ]
  }
  const fetchImpl = async (url, o) => {
    llamadas.push(url)
    if (/\/expansions/.test(url)) {
      return {
        ok: true,
        json: async () => ({
          data: [
            { id: 'sv10', name: 'Destined Rivals', release_date: '2026/05/30', total: 182 },
            { id: 'tk8b', name: 'Kit Latias', release_date: '2015/03/01', total: 30 },
            { id: 'swsh12tg', name: 'Crown Zenith GG', release_date: '2023/01/20', total: 70 },
          ],
          total_count: 3,
        }),
      }
    }
    const id = url.split('/cards/')[1]
    // LA CLAVE DEL DOBLE: su servidor conoce «swsh12tg-TG01» y NO conoce
    // «swsh12tg-tg1», que es exactamente lo que pasó en la pasada real.
    const suyas = {
      'sv10-001': 'Ethan’s Pinsir', 'sv10-1': "Ethan's Pinsir",
      'tk8b-1': 'Water Energy',
      'swsh12tg-TG01': 'Jynx',
    }
    if (soloLiteral && id === 'swsh12tg-tg1') return { ok: false, status: 404 }
    if (!(id in suyas)) return { ok: false, status: 404 }
    return { ok: true, json: async () => ({ data: { id, name: suyas[id] } }) }
  }
  return { restImpl, fetchImpl, llamadas }
}

{
  const d = doble()
  const r = await procesar({ env: ENV, fetchImpl: d.fetchImpl, restImpl: d.restImpl })
  check('contesta 200', r.estado === 200, JSON.stringify(r.cuerpo?.error))
  check('empareja los tres', r.cuerpo.emparejados === 3, String(r.cuerpo.emparejados))
  // 1. El que la 504 dejaba en 404 ahora se CONFIRMA, por la forma literal.
  check('el del «TG01» ya se confirma', r.cuerpo.confirmados === 1, JSON.stringify(r.cuerpo.ejemplosConfirmados))
  check('  …y se pidió «TG01», no «tg1»', d.llamadas.some((l) => String(l).endsWith('/cards/swsh12tg-TG01')), d.llamadas.filter((l) => String(l).includes('/cards/')).join(' | '))
  // 2. El del español NO va a «por mirar»: va aparte, declarado como
  // fallo nuestro. Es el fallo que la 504 llamó «rechazado».
  check('el del español NO va a «por mirar»', !r.cuerpo.porMirar.some((x) => x.nuestro === 'sv10'), JSON.stringify(r.cuerpo.porMirar))
  check('  …sino que se cuenta como nuestro', r.cuerpo.nuestroNombreEnEspanol === 1, String(r.cuerpo.nuestroNombreEnEspanol))
  check('  …con el ejemplo para poder arreglarlo', r.cuerpo.ejemplosEnEspanol.some((x) => /Pinsir de Eco/.test(x.carta)), JSON.stringify(r.cuerpo.ejemplosEnEspanol))
  // 3. Y el ÚNICO que de verdad hay que mirar a mano es el kit, donde el
  // inglés ya está puesto y aun así no coincide.
  check('y «por mirar» queda SOLO el que de verdad lo pide', r.cuerpo.porMirar.length === 1 && r.cuerpo.porMirar[0].suyo === 'tk8b', JSON.stringify(r.cuerpo.porMirar))
  check('NO ESCRIBE NADA', !d.llamadas.some((l) => /patch|rpc|on_conflict/i.test(String(l))))
  // LA GUARDA DE ESTA TANDA, estrechada en la 506: desde la 506 SÍ hay una
  // vía de rechazo, pero sale de una señal que el idioma no puede engañar
  // (el código del set, los números de Pokédex). Lo que no puede pasar
  // nunca es que un rechazo salga del NOMBRE — y en este doble ninguna
  // señal dice nada (ni `tcg_online_code`, ni `code`, ni `dex_ids`), así
  // que la lista de rechazos tiene que estar VACÍA aunque tres nombres
  // discrepen.
  check('sin ninguna señal, el nombre no rechaza NADA', (r.cuerpo.rechazados || []).length === 0, JSON.stringify(r.cuerpo.rechazados))
  check('  …y los tres discrepantes están repartidos en las otras casillas',
    r.cuerpo.confirmados + r.cuerpo.nuestroNombreEnEspanol + r.cuerpo.porMirar.length + r.cuerpo.sinComprobarTotal === r.cuerpo.verificadas,
    JSON.stringify(r.cuerpo))
}
{
  // Un 404 de TODAS las formas sigue siendo «sin comprobar», no un rechazo.
  const d = doble()
  const todoRoto = async (url, o) => (/\/cards\//.test(url) ? { ok: false, status: 404 } : d.fetchImpl(url, o))
  const r = await procesar({ env: ENV, fetchImpl: todoRoto, restImpl: d.restImpl })
  check('404 en todas las formas → sin comprobar', r.cuerpo.sinComprobarTotal === 3 && r.cuerpo.porMirar.length === 0, JSON.stringify(r.cuerpo.sinComprobar))
  check('  …y se dicen las formas probadas, para poder arreglarlo', /404 en todas las formas: .*TG01/.test(JSON.stringify(r.cuerpo.sinComprobar)), JSON.stringify(r.cuerpo.sinComprobar))
  // Un 500 no se confunde con un 404: no se sigue probando formas.
  const quinientos = async (url, o) => (/\/cards\//.test(url) ? { ok: false, status: 500 } : d.fetchImpl(url, o))
  const r5 = await procesar({ env: ENV, fetchImpl: quinientos, restImpl: d.restImpl })
  check('un 500 se dice como 500, no como «todas las formas»', /devolvió 500/.test(JSON.stringify(r5.cuerpo.sinComprobar)), JSON.stringify(r5.cuerpo.sinComprobar))
}

console.log('\n── 5. Y el panel no vuelve a decir «rechazado» ──')
{
  const { readFileSync } = await import('node:fs')
  const js = readFileSync('/home/user/pingu/admin/js/admin.js', 'utf8')
  const i = js.indexOf('async function verificarScrydex()')
  const fn = js.slice(i, i + js.slice(i).indexOf('\n}\n'))
  // El panel SÍ tiene apartado de rechazos desde la 506 — pero tiene que
  // decir DE DÓNDE sale, porque un rechazo a secas es lo que llevó a los
  // ocho falsos. Y tiene que seguir diciendo que el nombre ya no decide.
  check('el apartado de rechazos dice que sale de una SEÑAL', /RECHAZADOS DE VERDAD/.test(fn) && /se[ñn]al independiente del idioma/.test(fn), (fn.match(/.{0,80}RECHAZADOS.{0,80}/) || [''])[0])
  check('  …y se dice que el nombre YA NO rechaza', /nombre YA NO puede rechazar/.test(fn))
  check('enseña «por mirar a mano» uno a uno', /porMirar\.map/.test(fn))
  check('y los del español aparte, con su porqué', /nuestroNombreEnEspanol/.test(fn) && /est[áa] en español/i.test(fn))
  check('sigue diciendo que no ha escrito nada', /no ha escrito nada/.test(fn))
}

console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
