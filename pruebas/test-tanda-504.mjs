// Tanda 504 — verificar que un emparejamiento de set es el que creemos.
//
// La 503 contestó «¿tiene Scrydex las fotos que nos faltan?»: sí, 40/40 y
// 16/16. Pero entre sus 171 pares salió `ex5.5 → wb1`, que NO es el mismo
// set: comparten fecha y cuenta, no había segundo candidato, y como en
// `wb1-logo` hay un logo de verdad la sonda lo contó como acierto.
//
// Para decidir si pagar, daba igual. Para ESCRIBIR no: un par falso mete
// el logo y las cartas de otro set dentro del nuestro **sin dar error**.
import { verificarPar, laCarta } from '/home/user/pingu/netlify/lib/scrydex.mjs'
import { procesar } from '/home/user/pingu/netlify/functions/scrydex-verificar.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 320) : ''}`)
}
const ENV = { SCRYDEX_API_KEY: 'k', SCRYDEX_TEAM_ID: 't', SUPABASE_SERVICE_ROLE_KEY: 's' }

console.log('── 1. El veredicto de un par, por el nombre de una carta ──')
{
  check('dos nombres iguales confirman', verificarPar({ nuestroNombre: 'Jynx', suyoNombre: 'Jynx' }).veredicto === 'confirmado')
  // Las tildes y los signos no cuentan: «Pokémon GO» y «Pokemon GO» son la
  // misma carta escrita por dos catálogos distintos.
  check('las tildes no cuentan', verificarPar({ nuestroNombre: 'Flabébé', suyoNombre: 'Flabebe' }).veredicto === 'confirmado')
  check('ni los signos', verificarPar({ nuestroNombre: "Farfetch'd", suyoNombre: 'Farfetchd' }).veredicto === 'confirmado')
  // Y AQUÍ ESTÁ EL VALOR: si no es el mismo set, los nombres no coinciden.
  const r = verificarPar({ nuestroNombre: 'Blaziken ex', suyoNombre: 'Pikachu' })
  check('dos nombres distintos RECHAZAN', r.veredicto === 'rechazado', JSON.stringify(r))
  check('  …y el porqué trae los dos nombres, para no fiarse de un número',
    /Blaziken ex/.test(r.porque) && /Pikachu/.test(r.porque), r.porque)
  // NO más tolerante que eso: si aprobara «Pikachu» contra «Pikachu V» el
  // verificador aprobaría cualquier cosa y no serviría para nada.
  check('«Pikachu» y «Pikachu V» siguen siendo distintas',
    verificarPar({ nuestroNombre: 'Pikachu', suyoNombre: 'Pikachu V' }).veredicto === 'rechazado')
  check('sin uno de los dos nombres, no se puede',
    verificarPar({ nuestroNombre: 'Jynx', suyoNombre: undefined }).veredicto === 'no-se-puede')
}

console.log('\n── 2. Y la trampa de la 483, otra vez: el ALFABETO ──')
//
// `clave()` tira todo lo que no es a-z0-9. Un nombre japonés se queda en
// NADA, así que compararlo con uno inglés no es «distinto»: es una
// comparación que no existe. Y el caso MIXTO es el peligroso de verdad.
{
  const r = verificarPar({ nuestroNombre: 'フシギダネ', suyoNombre: 'Bulbasaur' })
  check('un nombre japonés contra uno inglés NO se rechaza', r.veredicto === 'no-se-puede', JSON.stringify(r))
  check('  …y se dice que es por el alfabeto', /alfabeto/.test(r.porque), r.porque)
  // EL CASO QUE HABRÍA DADO UN RECHAZO INVENTADO: 「ピカチュウV」 deja «v» y
  // «Pikachu V» deja «pikachuv». Distintas → habría tirado un par bueno.
  const m = verificarPar({ nuestroNombre: 'ピカチュウV', suyoNombre: 'Pikachu V' })
  check('el caso MIXTO tampoco se rechaza', m.veredicto === 'no-se-puede', JSON.stringify(m))
  // Dos japoneses entre ellos sí se pueden comparar… pero `clave()` los
  // deja vacíos, así que el veredicto honesto es «no se puede», nunca un
  // «confirmado» por dos cadenas vacías iguales.
  const j = verificarPar({ nuestroNombre: 'フシギダネ', suyoNombre: 'フシギソウ' })
  check('dos japoneses NO se confirman por ser los dos vacíos', j.veredicto === 'no-se-puede', JSON.stringify(j))
}

console.log('\n── 3. `data` es un OBJETO en una carta y un ARRAY en una lista ──')
{
  // Pegado de su respuesta real a `cards/me55c-58`.
  check('de una carta sola saca la carta', laCarta({ data: { id: 'me55c-58', name: 'Pikachu' } })?.name === 'Pikachu')
  check('de una lista saca la primera', laCarta({ data: [{ name: 'Uno' }, { name: 'Dos' }] })?.name === 'Uno')
  check('de una lista vacía no saca nada', laCarta({ data: [] }) === null)
  check('y de una respuesta rara tampoco', laCarta({}) === null && laCarta(null) === null)
}

console.log('\n── 4. El verificador entero, con un doble ──')
//
// Tres sets nuestros, dos emparejables. Uno de los pares es BUENO (la
// carta se llama igual) y el otro es FALSO (se llama distinto) — que es
// exactamente la forma de `ex5.5 → wb1`.
const doble = ({ cuatrocientocuatro = [], expansionesPorPagina = null } = {}) => {
  const llamadas = []
  const restImpl = async (ruta) => {
    llamadas.push(ruta)
    if (/tcg_cards/.test(ruta)) {
      // Se devuelven DESORDENADAS y con el «10» delante del «2» a
      // propósito: PostgREST ordena `local_id` como TEXTO.
      if (/set_id=eq\.bueno/.test(ruta)) {
        return [
          { local_id: '10', name: 'Diez' },
          { local_id: 'TG01', name: 'Jynx' },
          { local_id: '2', name: 'Dos' },
        ]
      }
      if (/set_id=eq\.falso/.test(ruta)) return [{ local_id: '1', name: 'Blaziken ex' }]
      return []
    }
    return [
      { id: 'bueno', name: 'Bueno', release_date: '2021-01-01', card_count_total: 100 },
      { id: 'falso', name: 'Ex Cinco y Medio', release_date: '2004-11-24', card_count_total: 17 },
      { id: 'sinpareja', name: 'Sin Pareja', release_date: '1990-01-01', card_count_total: 7 },
    ]
  }
  const fetchImpl = async (url, o) => {
    llamadas.push(url)
    if (/\/expansions/.test(url)) {
      if (expansionesPorPagina) return expansionesPorPagina(url)
      return {
        ok: true,
        json: async () => ({
          data: [
            // Sus fechas vienen CON BARRAS (tanda 501).
            { id: 'sus_bueno', name: 'Bueno', release_date: '2021/01/01', total: 100 },
            { id: 'wb1', name: 'Wizards Black Star', release_date: '2004/11/24', total: 17 },
          ],
          total_count: 2,
        }),
      }
    }
    const id = url.split('/cards/')[1]
    if (cuatrocientocuatro.includes(id)) return { ok: false, status: 404 }
    const nombres = { 'sus_bueno-2': 'Dos', 'wb1-1': 'Kecleon' }
    if (!(id in nombres)) return { ok: false, status: 404 }
    return { ok: true, json: async () => ({ data: { id, name: nombres[id] } }) }
  }
  return { restImpl, fetchImpl, llamadas }
}

{
  const d = doble()
  const r = await procesar({ env: ENV, fetchImpl: d.fetchImpl, restImpl: d.restImpl })
  check('contesta 200', r.estado === 200, JSON.stringify(r.cuerpo?.error))
  check('empareja los dos que se pueden emparejar', r.cuerpo.emparejados === 2, String(r.cuerpo.emparejados))
  check('el tercero se queda suelto', r.cuerpo.sinEmparejar === 1, String(r.cuerpo.sinEmparejar))
  // LO QUE IMPORTA: el par bueno se confirma y el falso se RECHAZA.
  check('confirma el par bueno', r.cuerpo.confirmados === 1, JSON.stringify(r.cuerpo.ejemplosConfirmados))
  check('y RECHAZA el falso', r.cuerpo.rechazados.length === 1 && r.cuerpo.rechazados[0].suyo === 'wb1', JSON.stringify(r.cuerpo.rechazados))
  check('  …diciendo los dos nombres, no solo que falla',
    /Blaziken ex/.test(JSON.stringify(r.cuerpo.rechazados[0])) && /Kecleon/.test(JSON.stringify(r.cuerpo.rechazados[0])),
    JSON.stringify(r.cuerpo.rechazados[0]))
  // La carta elegida es la de número más bajo DE VERDAD: el doble devuelve
  // «10», «TG01» y «2», y el orden de texto pondría el 10 primero.
  check('elige la carta de número más bajo, no la primera fila',
    d.llamadas.some((l) => String(l).endsWith('/cards/sus_bueno-2')),
    d.llamadas.filter((l) => String(l).includes('/cards/')).join(' | '))
  // Las cartas se piden SET A SET: con una sola consulta y un `limit`
  // global los últimos sets se quedaban fuera por truncado y el informe
  // decía «no tenemos ninguna carta» de sets llenos.
  const consultas = d.llamadas.filter((l) => String(l).includes('tcg_cards'))
  check('las cartas se piden set a set', consultas.length === 2 && consultas.every((c) => /set_id=eq\./.test(c)), consultas.join(' | '))
  check('NO ESCRIBE NADA', !d.llamadas.some((l) => /patch|post|rpc|on_conflict/i.test(String(l))), d.llamadas.join(' | '))
}

console.log('\n── 5. Un 404 no es un rechazo ──')
{
  // Si su API no encuentra la carta, puede ser que esa carta nuestra no
  // exista en su set o que su id no se monte como creemos. Contarlo como
  // rechazo tiraría un emparejamiento BUENO por un fallo nuestro.
  const d = doble({ cuatrocientocuatro: ['sus_bueno-2'] })
  const r = await procesar({ env: ENV, fetchImpl: d.fetchImpl, restImpl: d.restImpl })
  check('un 404 no rechaza el par', !r.cuerpo.rechazados.some((x) => x.suyo === 'sus_bueno'), JSON.stringify(r.cuerpo.rechazados))
  check('  …sino que se declara sin comprobar', r.cuerpo.sinComprobar.some((x) => /sus_bueno/.test(x.par) && /404/.test(x.porque)), JSON.stringify(r.cuerpo.sinComprobar))
  check('  …y no cuenta como confirmado', r.cuerpo.confirmados === 0, String(r.cuerpo.confirmados))
}
{
  // Un set del que no tenemos ninguna carta tampoco es un rechazo.
  const d = doble()
  const sinCartas = async (ruta) => (/tcg_cards/.test(ruta) ? [] : d.restImpl(ruta))
  const r = await procesar({ env: ENV, fetchImpl: d.fetchImpl, restImpl: sinCartas })
  check('sin cartas nuestras, no se rechaza nada', r.cuerpo.rechazados.length === 0 && r.cuerpo.sinComprobarTotal === 2, JSON.stringify(r.cuerpo))
}

console.log('\n── 6. Los pares que no caben en una pasada se pueden ALCANZAR ──')
{
  // Sin `desde`, «quedan 111 por verificar» es un número que no lleva a
  // ninguna parte: quien lo lee no tiene forma de pedir los siguientes.
  const d = doble()
  const r0 = await procesar({ env: ENV, fetchImpl: d.fetchImpl, restImpl: d.restImpl })
  check('con todo verificado, no manda seguir', r0.cuerpo.siguienteDesde === null, String(r0.cuerpo.siguienteDesde))
  const r1 = await procesar({ env: ENV, fetchImpl: d.fetchImpl, restImpl: d.restImpl, desde: 1 })
  check('`desde` salta los ya vistos', r1.cuerpo.verificadas === 1 && /^2–2 /.test(r1.cuerpo.verificadosEnEstaPasada), r1.cuerpo.verificadosEnEstaPasada)
  check('  …y ahí solo queda el par falso', r1.cuerpo.rechazados.length === 1 && r1.cuerpo.confirmados === 0, JSON.stringify(r1.cuerpo.rechazados))
  const r9 = await procesar({ env: ENV, fetchImpl: d.fetchImpl, restImpl: d.restImpl, desde: 99 })
  // Y el rótulo no dice una frase sin sentido: «3–2 de 2» no es nada.
  check('un `desde` pasado de rosca no revienta ni repite',
    r9.cuerpo.verificadas === 0 && r9.cuerpo.siguienteDesde === null && /ninguno/.test(r9.cuerpo.verificadosEnEstaPasada),
    JSON.stringify(r9.cuerpo.verificadosEnEstaPasada))
  // Y el número que suma el panel es un NÚMERO, no una cifra sacada de una
  // frase con guion largo dentro.
  check('`verificadas` es un número', typeof r0.cuerpo.verificadas === 'number' && r0.cuerpo.verificadas === 2)
}

console.log('\n── 7. Y si algo falla, no se concluye nada ──')
{
  const r = await procesar({ env: { SCRYDEX_API_KEY: 'k' } })
  check('sin las variables, se dice cuáles faltan', r.estado === 500 && /SCRYDEX_TEAM_ID/.test(r.cuerpo.error), r.cuerpo.error)
  const r2 = await procesar({ env: { SCRYDEX_API_KEY: 'k', SCRYDEX_TEAM_ID: 't' } })
  check('  …y también la de Supabase', r2.estado === 500 && /SUPABASE_SERVICE_ROLE_KEY/.test(r2.cuerpo.error), r2.cuerpo.error)
  const d = doble()
  const roto = async (url, o) => (/\/expansions/.test(url) ? { ok: false, status: 500 } : d.fetchImpl(url, o))
  const r3 = await procesar({ env: ENV, fetchImpl: roto, restImpl: d.restImpl })
  check('si su API se cae, NO se rechaza nada', r3.estado === 502 && /Scrydex 500/.test(r3.cuerpo.error), JSON.stringify(r3.cuerpo))
  // Un error de red al pedir UNA carta tampoco es un rechazo.
  const revienta = async (url, o) => {
    if (/\/cards\//.test(url)) throw new Error('ECONNRESET')
    return d.fetchImpl(url, o)
  }
  const r4 = await procesar({ env: ENV, fetchImpl: revienta, restImpl: d.restImpl })
  check('un error de red tampoco rechaza', r4.estado === 200 && r4.cuerpo.rechazados.length === 0 && r4.cuerpo.sinComprobarTotal === 2, JSON.stringify(r4.cuerpo))
}

console.log('\n── 8. Y no se puede llamar sin ser admin ──')
{
  const { readFileSync } = await import('node:fs')
  const js = readFileSync('/home/user/pingu/netlify/functions/scrydex-verificar.mjs', 'utf8')
  check('solo POST', /req\.method !== 'POST'/.test(js))
  check('  …y admin antes de gastar un crédito', js.indexOf('idDeAdmin') < js.indexOf('await procesar({ mercado'))
  check('la clave no está escrita en el código', !/SCRYDEX_API_KEY\s*=\s*['"]/.test(js))
  // LA GARANTÍA DE LA TANDA: esto NO escribe. Una verificación que
  // escribiera mientras verifica no se podría correr para mirar.
  check('no hay ni un INSERT ni un PATCH', !/method:\s*'(POST|PATCH|PUT)'/.test(js) && !/on_conflict/.test(js))
}

console.log('\n── 9. Y el panel lo enseña sin que haya que interpretarlo ──')
{
  const { readFileSync } = await import('node:fs')
  const html = readFileSync('/home/user/pingu/admin/index.html', 'utf8')
  const js = readFileSync('/home/user/pingu/admin/js/admin.js', 'utf8')
  check('el botón está', /id="btnVerificarScrydex"/.test(html))
  check('  …conectado', /getElementById\('btnVerificarScrydex'\)\?\.addEventListener/.test(js))
  const i = js.indexOf('async function verificarScrydex()')
  const fn = js.slice(i, i + js.slice(i).indexOf('\n}\n'))
  check('manda la sesión y no una clave', /session\.access_token/.test(fn) && !/SCRYDEX_/.test(js))
  // Va solo de pasada en pasada: si no, los pares de más allá del corte no
  // se verifican nunca y nadie se enteraría.
  check('va solo hasta acabarse', /siguienteDesde/.test(fn) && /MAX_PASADAS_VERIFICAR/.test(fn))
  check('enseña los rechazados uno a uno, no solo el número', /rechazados\.map/.test(fn))
  check('dice que «sin comprobar» NO es un rechazo', /NO es un rechazo/.test(fn))
  check('y que no ha escrito nada', /no ha escrito nada/.test(fn))
}

console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
