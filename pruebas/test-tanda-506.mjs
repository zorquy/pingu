// Tanda 506 — verificar con señales que el IDIOMA NO PUEDE ENGAÑAR.
//
// Tercer intento, y el primero con una respuesta suya delante en vez de
// imaginada. La 504 verificó por el nombre y falló los ocho rechazos; la
// 505 le quitó la palabra «rechazado» porque la comparación no la
// sostenía; esto es lo que faltaba.
//
// El fixture es su respuesta REAL a `cards/sm10-1`, sondeada el 2026-10-04
// y guardada byte por byte (norma de la 501). Y lo que enseñó es que la
// mejor señal no es el ilustrador que yo iba buscando, sino
// **`expansion.code`** — «UNB», que es nuestro `tcg_online_code`: va sobre
// el SET, que es lo que se está verificando, y viene gratis.
import { readFileSync } from 'node:fs'
import {
  senalesDelPar, veredictoDelPar, formasDeId, cuentaDelInforme,
} from '/home/user/pingu/netlify/lib/scrydex.mjs'
import { procesar } from '/home/user/pingu/netlify/functions/scrydex-verificar.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 320) : ''}`)
}
const ENV = { SCRYDEX_API_KEY: 'k', SCRYDEX_TEAM_ID: 't', SUPABASE_SERVICE_ROLE_KEY: 's' }

const SM10_1 = JSON.parse(readFileSync(new URL('./fixtures/scrydex-cards-sm10-1.json', import.meta.url), 'utf8')).data

console.log('── 1. El fixture es SU respuesta, no una que se le parezca ──')
{
  check('trae el ilustrador en `artist`', SM10_1.artist === 'Mitsuhiro Arita')
  check('la Pokédex en `national_pokedex_numbers`', JSON.stringify(SM10_1.national_pokedex_numbers) === '[794,795]')
  check('los PS en `hp`, y de CADENA', SM10_1.hp === '260' && typeof SM10_1.hp === 'string')
  check('y el código del set anidado en `expansion.code`', SM10_1.expansion.code === 'UNB')
  // Y lo que importa de este caso concreto: su nombre NO es el nuestro.
  check('su nombre es el inglés, el nuestro el español', SM10_1.name === 'Pheromosa & Buzzwole-GX')
}

console.log('\n── 2. EL CASO QUE COSTÓ DOS TANDAS, ahora bien ──')
//
// `sm10 → sm10`, nuestra carta 1 llamada «Pheromosa y Buzzwole GX». La 504
// la RECHAZÓ. Con el código del set delante, se confirma.
{
  const nuestra = { local_id: '1', name: 'Pheromosa y Buzzwole GX', name_es: 'Pheromosa y Buzzwole GX', dex_ids: [794, 795], illustrator: 'Mitsuhiro Arita', hp: 260 }
  const v = veredictoDelPar({ nuestra, nuestroSet: { id: 'sm10', tcg_online_code: 'UNB' }, suya: SM10_1 })
  check('se CONFIRMA, con el nombre en español y todo', v.veredicto === 'confirmado', JSON.stringify(v))
  // Desde la 508 manda la Pokédex, que es canónica; el código confirma
  // igual, pero ya no decide. Con las dos a favor gana la que decide.
  check('  …y dice con qué señal', v.por === 'los números de Pokédex', JSON.stringify(v))
  // Y el código SIGUE confirmando cuando es lo único que hay.
  const soloCodigo = veredictoDelPar({ nuestra: {}, nuestroSet: { tcg_online_code: 'UNB' }, suya: { expansion: { code: 'UNB' } } })
  check('  …y el código confirma cuando es lo único que hay', soloCodigo.veredicto === 'confirmado' && soloCodigo.por === 'el código del set', JSON.stringify(soloCodigo))
  // Y sin el código tampoco hace falta el nombre: la Pokédex basta.
  const sinCodigo = veredictoDelPar({ nuestra, nuestroSet: { id: 'sm10' }, suya: SM10_1 })
  check('sin código, deciden los números de Pokédex', sinCodigo.veredicto === 'confirmado' && sinCodigo.por === 'los números de Pokédex', JSON.stringify(sinCodigo))
  // Y sin ninguna de las dos, el ilustrador confirma — nunca rechaza.
  const soloArte = veredictoDelPar({ nuestra: { illustrator: 'Mitsuhiro Arita', name: 'Pinsir de Eco' }, nuestroSet: {}, suya: SM10_1 })
  check('sin las dos, confirma el ilustrador', soloArte.veredicto === 'confirmado' && soloArte.por === 'el ilustrador', JSON.stringify(soloArte))
}

console.log('\n── 3. Un rechazo DE VERDAD, y solo de lo que no admite otra explicación ──')
{
  // `ex5.5 → wb1`, el par sospechoso de la 503: la Pokédex los desmiente.
  const r = veredictoDelPar({
    nuestra: { name: 'Blaziken ex', dex_ids: [257] },
    nuestroSet: { id: 'ex5.5', tcg_online_code: 'LM' },
    suya: { name: 'Kecleon', national_pokedex_numbers: [352], expansion: { id: 'wb1', code: 'WBSP' } },
  })
  check('dos Pokédex distintas RECHAZAN', r.veredicto === 'rechazado' && r.por === 'los números de Pokédex', JSON.stringify(r))
  check('  …nombrando la señal y los dos valores', /257/.test(r.porque) && /352/.test(r.porque), r.porque)
  // ── EL CASO `ex7`, DE LA PRIMERA ESCRITURA DE VERDAD (tanda 508) ──
  //
  // Mismo id, mismo set (*EX Team Rocket Returns*), y los códigos eran
  // «RR» el nuestro y «TRR» el suyo. Los dos están BIEN: cada catálogo lo
  // abrevia a su manera. Rechazarlo por eso dejó un set sin su logo.
  //
  // Una señal que no depende del IDIOMA puede seguir dependiendo del
  // FABRICANTE: la Pokédex Nacional es canónica, un código es convención.
  const ex7 = veredictoDelPar({
    nuestra: {}, nuestroSet: { id: 'ex7', tcg_online_code: 'RR' },
    suya: { expansion: { id: 'ex7', code: 'TRR' } },
  })
  check('«RR» contra «TRR» YA NO RECHAZA', ex7.veredicto !== 'rechazado', JSON.stringify(ex7))
  check('  …se queda sin señal y se mira a mano', ex7.veredicto === 'sin-senal', JSON.stringify(ex7))
  // Y con la Pokédex a favor, un código distinto NO estropea el acuerdo.
  const conDex = veredictoDelPar({
    nuestra: { dex_ids: [25] }, nuestroSet: { tcg_online_code: 'RR' },
    suya: { national_pokedex_numbers: [25], expansion: { code: 'TRR' } },
  })
  check('con la Pokédex a favor, el código distinto no lo tumba', conDex.veredicto === 'confirmado', JSON.stringify(conDex))
  // Dos listas de Pokédex sin un número en común también rechazan.
  const d = veredictoDelPar({
    nuestra: { name: 'Pikachu', dex_ids: [25] },
    nuestroSet: { id: 'a' },
    suya: { name: 'Pikachu', national_pokedex_numbers: [352], expansion: { id: 'b' } },
  })
  check('dos Pokédex disjuntas RECHAZAN aunque el nombre coincida', d.veredicto === 'rechazado' && d.por === 'los números de Pokédex', JSON.stringify(d))
  // Y una lista que SOLAPA confirma: [794,795] contra [794] es la misma
  // carta en otra impresión, no un par malo.
  const sol = veredictoDelPar({
    nuestra: { dex_ids: [794] }, nuestroSet: {},
    suya: { national_pokedex_numbers: [794, 795], expansion: {} },
  })
  check('una Pokédex que solapa confirma', sol.veredicto === 'confirmado', JSON.stringify(sol))
}

console.log('\n── 4. Y lo que NO puede rechazar, no rechaza ──')
//
// La lección entera de las 504 y 505 en cuatro comprobaciones.
{
  const mudo = { nuestroSet: {}, suya: { expansion: {} } }
  // EL NOMBRE. «Energía Planta» contra «Basic Grass Energy».
  const n = veredictoDelPar({ ...mudo, nuestra: { name: 'Energía Planta' }, suya: { name: 'Basic Grass Energy', expansion: {} } })
  check('un nombre distinto NO rechaza', n.veredicto !== 'rechazado', JSON.stringify(n))
  check('  …se queda sin señal, y lo dice', n.veredicto === 'sin-senal' && /mudas:/.test(n.porque), JSON.stringify(n))
  // EL ILUSTRADOR acreditado al revés: los catálogos lo hacen.
  const a = veredictoDelPar({ ...mudo, nuestra: { illustrator: 'Arita Mitsuhiro' }, suya: { artist: 'Mitsuhiro Arita', expansion: {} } })
  check('un ilustrador escrito al revés NO rechaza', a.veredicto !== 'rechazado', JSON.stringify(a))
  // LOS PS: cientos de cartas comparten 260, así que un PS distinto no
  // dice nada… y uno igual tampoco debería decidir solo. Confirma, pero
  // es el penúltimo de la lista y nunca rechaza.
  const h = veredictoDelPar({ ...mudo, nuestra: { hp: 90 }, suya: { hp: '260', expansion: {} } })
  check('unos PS distintos NO rechazan', h.veredicto !== 'rechazado', JSON.stringify(h))
  // Y UNA SEÑAL VACÍA NO ES UNA SEÑAL: nuestra columna sin rellenar no
  // puede contradecir nada. Es la lección del `progreso = {}` de la 319.
  const v = veredictoDelPar({ nuestra: { dex_ids: null, illustrator: null }, nuestroSet: { tcg_online_code: null }, suya: SM10_1 })
  check('nuestras columnas vacías no contradicen nada', v.veredicto !== 'rechazado', JSON.stringify(v))
  // Y al revés: si la nuestra está vacía pero el nombre coincide, confirma.
  const s = senalesDelPar({ nuestra: {}, nuestroSet: {}, suya: SM10_1 })
  check('una señal con un lado vacío se queda MUDA, no «discrepa»',
    s.deciden.every((x) => x.estado === 'muda'), JSON.stringify(s.deciden.map((x) => [x.que, x.estado])))
  // EL INTERRUPTOR ES UNO SOLO (`decide`), y las señales dicen la verdad.
  // Antes el nombre devolvía «muda» cuando discrepaba, así que la regla
  // estaba escrita dos veces y ninguna se podía observar — la 314.
  const dos = senalesDelPar({
    nuestra: { name: 'Energía Planta', dex_ids: [1] }, nuestroSet: { tcg_online_code: 'UNB' },
    suya: { name: 'Basic Grass Energy', national_pokedex_numbers: [1], expansion: { code: 'UNB' } },
  })
  check('el nombre DICE que discrepa, no se calla',
    dos.confirman.find((x) => x.que === 'el nombre').estado === 'discrepa',
    JSON.stringify(dos.confirman.map((x) => [x.que, x.estado])))
  check('  …y lo que le impide rechazar es `decide`, y nada más',
    dos.confirman.every((x) => x.decide === false) && dos.deciden.every((x) => x.decide === true),
    JSON.stringify([...dos.deciden, ...dos.confirman].map((x) => [x.que, x.decide])))
  // Y el informe lo puede enseñar: «el nombre discrepa pero el código
  // confirma» es información, no ruido.
  const mezcla = veredictoDelPar({
    nuestra: { name: 'Energía Planta' }, nuestroSet: { tcg_online_code: 'UNB' },
    suya: { name: 'Basic Grass Energy', expansion: { code: 'UNB' } },
  })
  check('con el código a favor y el nombre en contra, se CONFIRMA',
    mezcla.veredicto === 'confirmado' && mezcla.por === 'el código del set', JSON.stringify(mezcla))
}

console.log('\n── 5. La cuarta forma del id, que es el 404 que quedaba ──')
{
  // De los trece 404 de la 504 quedaron DOS en la 505, y uno era `cel25c`
  // con nuestra `CC001`: se probaron «CC001» y «cc1», y la suya es «CC1»
  // —sin los ceros pero CON las mayúsculas—. `numeroComparable` quitaba
  // las dos cosas de golpe.
  const f = formasDeId('cel25c', 'CC001')
  check('ahora se prueba «CC1»', f.includes('cel25c-CC1'), JSON.stringify(f))
  check('  …sin dejar de probar las otras tres', f.includes('cel25c-CC001') && f.includes('cel25c-cc1'), JSON.stringify(f))
  check('y sin repetir cuando no hay nada que cambiar', formasDeId('x', '58').length === 1, JSON.stringify(formasDeId('x', '58')))
}

console.log('\n── 6. Un informe cuyas casillas no suman tiene un agujero ──')
//
// En la pasada de la 505 el panel enseñó «160 confirmados + 2 sin
// comprobar» de 171: faltaban NUEVE, y nada dijo nada. El navegador tenía
// el panel viejo en caché y leía un campo que la respuesta ya no traía, así
// que una casilla entera se perdió EN SILENCIO.
{
  // LA GUARDA SE EJERCITA CUANDO SALTA, que es lo contrario de lo que yo
  // había hecho: comprobaba que cuadra en el caso bueno y nunca montaba
  // uno malo, así que poner `cuadra = true` a pelo pasaba desapercibido.
  const bien = cuentaDelInforme(5, [[1, 2], [3], 2])
  check('si suman, cuadra y no avisa de nada', bien.cuadra === true && !bien.aviso, JSON.stringify(bien))
  const mal = cuentaDelInforme(171, [160, 2])
  check('con los NÚMEROS DE LA PASADA de la 505, NO cuadra', mal.cuadra === false, JSON.stringify(mal))
  check('  …y el aviso dice los dos números', /162 de 171/.test(mal.aviso), mal.aviso)
  check('una casilla de más tampoco cuadra', cuentaDelInforme(2, [[1], [2], [3]]).cuadra === false)
  check('y cero contra cero sí cuadra', cuentaDelInforme(0, [[], []]).cuadra === true)
}

const doble = () => {
  const llamadas = []
  const restImpl = async (ruta) => {
    llamadas.push(ruta)
    if (/tcg_cards/.test(ruta)) {
      if (/set_id=eq\.sm10/.test(ruta)) return [{ local_id: '1', name: 'Pheromosa y Buzzwole GX', name_es: 'Pheromosa y Buzzwole GX', dex_ids: [794, 795], illustrator: 'Mitsuhiro Arita', hp: 260 }]
      if (/set_id=eq\.ex5\.5/.test(ruta)) return [{ local_id: '1', name: 'Blaziken ex', name_es: null, dex_ids: [257], illustrator: 'Midori Harada', hp: 100 }]
      return []
    }
    return [
      { id: 'sm10', name: 'Unbroken Bonds', release_date: '2019-05-03', card_count_total: 238, tcg_online_code: 'UNB' },
      { id: 'ex5.5', name: 'Legend Maker', release_date: '2006-02-13', card_count_total: 93, tcg_online_code: 'LM' },
    ]
  }
  const fetchImpl = async (url) => {
    llamadas.push(url)
    if (/\/expansions/.test(url)) {
      return {
        ok: true,
        json: async () => ({
          data: [
            { id: 'sm10', name: 'Unbroken Bonds', release_date: '2019/05/03', total: 238, code: 'UNB' },
            { id: 'wb1', name: 'Wizards Black Star', release_date: '2006/02/13', total: 93, code: 'WBSP' },
          ],
          total_count: 2,
        }),
      }
    }
    const id = url.split('/cards/')[1]
    if (id === 'sm10-1') return { ok: true, json: async () => ({ data: SM10_1 }) }
    if (id === 'wb1-1') {
      return { ok: true, json: async () => ({ data: { id: 'wb1-1', name: 'Kecleon', national_pokedex_numbers: [352], artist: 'Otro', hp: '60', expansion: { id: 'wb1', code: 'WBSP' } } }) }
    }
    return { ok: false, status: 404 }
  }
  return { restImpl, fetchImpl, llamadas }
}
{
  const d = doble()
  const r = await procesar({ env: ENV, fetchImpl: d.fetchImpl, restImpl: d.restImpl })
  check('contesta 200', r.estado === 200, JSON.stringify(r.cuerpo?.error))
  check('LA CUENTA CUADRA', r.cuerpo.cuadraLaCuenta === true && !r.cuerpo.AVISO, JSON.stringify(r.cuerpo))
  check('confirma el que la 504 rechazaba', r.cuerpo.confirmados === 1, JSON.stringify(r.cuerpo.ejemplosConfirmados))
  check('  …diciendo con qué señal', /los números de Pokédex/.test(JSON.stringify(r.cuerpo.ejemplosConfirmados)), JSON.stringify(r.cuerpo.ejemplosConfirmados))
  check('y RECHAZA el `ex5.5 → wb1` de verdad', r.cuerpo.rechazados.length === 1 && r.cuerpo.rechazados[0].suyo === 'wb1', JSON.stringify(r.cuerpo.rechazados))
  check('  …nombrando la señal, no «se llaman distinto»', /números de Pokédex/.test(r.cuerpo.rechazados[0].porque), r.cuerpo.rechazados[0].porque)
  check('nada queda «por mirar a mano»', r.cuerpo.porMirar.length === 0, JSON.stringify(r.cuerpo.porMirar))
  check('NO ESCRIBE NADA', !d.llamadas.some((l) => /patch|rpc|on_conflict/i.test(String(l))))
  // Y las columnas que dan señal se PIDEN. Sin ellas no hay veredicto.
  const consulta = d.llamadas.find((l) => String(l).includes('tcg_cards'))
  check('se piden `dex_ids`, `illustrator` y `hp`', /dex_ids/.test(consulta) && /illustrator/.test(consulta) && /hp/.test(consulta), consulta)
}
{
  // Y si una casilla se perdiera, el informe lo CANTA. Se simula haciendo
  // que una carta nuestra no exista: ese par va a «sin comprobar», y la
  // suma tiene que seguir cuadrando.
  const d = doble()
  const sinUna = async (ruta) => (/set_id=eq\.ex5\.5/.test(ruta) ? [] : d.restImpl(ruta))
  const r = await procesar({ env: ENV, fetchImpl: d.fetchImpl, restImpl: sinUna })
  check('con un par sin carta, la cuenta sigue cuadrando', r.cuerpo.cuadraLaCuenta === true, JSON.stringify(r.cuerpo))
  check('  …y ese par está en «sin comprobar»', r.cuerpo.sinComprobarTotal === 1, JSON.stringify(r.cuerpo.sinComprobar))
}

console.log('\n── 7. Y el panel avisa de lo que antes se comía en silencio ──')
{
  const js = readFileSync('/home/user/pingu/admin/js/admin.js', 'utf8')
  const i = js.indexOf('async function verificarScrydex()')
  const fn = js.slice(i, i + js.slice(i).indexOf('\n}\n'))
  check('si la cuenta no cuadra, lo dice', /cuadraLaCuenta === false/.test(fn), (fn.match(/.{0,60}cuadraLaCuenta.{0,60}/) || [''])[0])
  check('enseña los rechazos de verdad uno a uno', /rechazados\.map/.test(fn))
  check('y explica con qué señal se decide', /c[óo]digo del set/i.test(fn) && /Pok[ée]dex/i.test(fn))
  check('sigue diciendo que no ha escrito nada', /no ha escrito nada/.test(fn))
}

console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
