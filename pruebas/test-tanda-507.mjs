// Tanda 507 — la PRIMERA ESCRITURA desde Scrydex: los sets.
//
// PINGU: «estamos pagando Scrydex, de algo tiene que servir. Tráete
// cartas, logos, tráete todo. Fíate del catálogo de Scrydex, y si falta
// algo en Scrydex cógelo de las otras cosas».
//
// Esto es la mitad pequeña (210 sets contra 21.476 cartas) y la que se
// puede mirar a ojo. Lo que la prueba vigila es lo que puede salir mal
// SIN DAR ERROR, que aquí son cuatro cosas distintas.
import { readFileSync } from 'node:fs'
import { filaDeSetConScrydex, loQueCambia, HUELLAS_DE_RELLENO } from '/home/user/pingu/netlify/lib/scrydex.mjs'
import { procesar } from '/home/user/pingu/netlify/functions/scrydex-sets.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 320) : ''}`)
}
const ENV = { SCRYDEX_API_KEY: 'k', SCRYDEX_TEAM_ID: 't', SUPABASE_SERVICE_ROLE_KEY: 's' }

console.log('── 1. Scrydex gana, pero NO PISA lo nuestro ──')
{
  // Un set al que le faltan las tres columnas de la tanda 322.
  const vacio = { id: 'sv10', market: 'WEST', name: 'Rivales Predestinados' }
  const suyo = { id: 'sv10', code: 'DRI', release_date: '2026/05/30', printed_total: 182, total: 244, logo: 'https://images.scrydex.com/pokemon/sv10-logo/logo', symbol: 'https://images.scrydex.com/pokemon/sv10-symbol/symbol' }
  const f = filaDeSetConScrydex(vacio, suyo)
  check('el logo suyo se guarda ENTERO y sin extensión', f.logo_scrydex === 'https://images.scrydex.com/pokemon/sv10-logo/logo')
  check('el símbolo también', f.symbol_scrydex.endsWith('/symbol'))
  check('la fecha se guarda en nuestro formato, con guiones', f.release_date === '2026-05-30', f.release_date)
  check('el código se rellena', f.tcg_online_code === 'DRI')
  check('y la cuenta OFICIAL es `printed_total`, no `total`', f.card_count_official === 182, String(f.card_count_official))

  // Y AHORA LO QUE IMPORTA: con los nuestros puestos, no se pisan.
  const lleno = { id: 'sv10', market: 'WEST', name: 'Rivales', release_date: '2026-05-29', tcg_online_code: 'XXX', card_count_official: 999 }
  const g = filaDeSetConScrydex(lleno, suyo)
  check('nuestra fecha NO se pisa', g.release_date === '2026-05-29', g.release_date)
  // EL CERO ES UN VALOR (tanda 508). Con `||` el cero se trataba como
  // «vacío» y en la primera escritura de verdad pisé el
  // `card_count_official` de `mep`, que valía 0. No hizo daño —`0` y
  // `null` se pintan igual— pero la regla decía «no se pisa nada
  // nuestro». Misma familia que el `progreso = {}` de la 319.
  const cero = filaDeSetConScrydex({ ...lleno, card_count_official: 0 }, suyo)
  check('un CERO nuestro no se trata como vacío', cero.card_count_official === 0, JSON.stringify(cero.card_count_official))
  // Y al revés: en un TEXTO la cadena vacía SÍ es «no hay nada», que es
  // una regla distinta de la del número y por eso está escrita aparte.
  const vacia = filaDeSetConScrydex({ ...lleno, tcg_online_code: '  ' }, suyo)
  check('un texto en blanco sí se rellena', vacia.tcg_online_code === 'DRI', JSON.stringify(vacia.tcg_online_code))
  check('nuestro código NO se pisa', g.tcg_online_code === 'XXX', g.tcg_online_code)
  check('nuestra cuenta NO se pisa', g.card_count_official === 999, String(g.card_count_official))
  check('y nuestro NOMBRE es el que va, que está en español a propósito', g.name === 'Rivales')
  // El logo de Scrydex sí manda: es columna nueva y no destruye nada.
  check('el logo de Scrydex sí se escribe siempre', g.logo_scrydex === suyo.logo)
  // Las claves son SIEMPRE las mismas: PostgREST exige uniformidad en
  // todos los objetos de una misma sentencia, y «no pisar» quitando
  // claves partiría el upsert en diez sentencias.
  check('las claves son las mismas con o sin datos nuestros',
    JSON.stringify(Object.keys(f)) === JSON.stringify(Object.keys(g)), JSON.stringify(Object.keys(f)))
  // Una URL que no sea https no se guarda: un `http://` en una página
  // https no carga y no da error que se vea.
  check('una URL que no es https no se guarda',
    filaDeSetConScrydex(vacio, { ...suyo, logo: 'http://x/y' }).logo_scrydex === null)
  check('y una fecha con basura dentro tampoco',
    filaDeSetConScrydex(vacio, { ...suyo, release_date: 'pronto' }).release_date === null)
}

console.log('\n── 2. El ensayo en seco enseña el ANTES, que es lo que lo hace servir ──')
{
  const c = loQueCambia(
    { release_date: null, tcg_online_code: 'LM', logo_scrydex: null },
    { id: 'a', market: 'WEST', name: 'n', release_date: '2006-02-13', tcg_online_code: 'LM', logo_scrydex: 'https://x/l' },
  )
  check('dice lo que cambia, con el valor de antes', c.release_date?.de === null && c.release_date?.a === '2006-02-13', JSON.stringify(c))
  check('lo que no cambia no sale', !('tcg_online_code' in c), JSON.stringify(c))
  check('y el nombre y la clave nunca cuentan como cambio', !('name' in c) && !('id' in c), JSON.stringify(c))
  check('sin nada que cambiar, está vacío', Object.keys(loQueCambia({ a: 1 }, { id: 'x', market: 'W', name: 'n', a: 1 })).length === 0)
}

console.log('\n── 3. La función entera: ensayo, relleno, y lo que NO se escribe ──')
const LOGO_BUENO = 'https://images.scrydex.com/pokemon/sv10-logo/logo'
const LOGO_RELLENO = 'https://images.scrydex.com/pokemon/promos-logo/logo'
const doble = () => {
  const escrito = []
  const llamadas = []
  const restImpl = async (ruta) => {
    llamadas.push(ruta)
    if (/tcg_cards/.test(ruta)) {
      // `promos` no tiene código nuestro, así que hace falta una carta.
      if (/set_id=eq\.promos/.test(ruta)) return [{ local_id: '1', name: 'Pikachu', dex_ids: [25], illustrator: 'A', hp: 60 }]
      return []
    }
    return [
      // 1. SIN NUESTRA FECHA, rescatado por el CÓDIGO (tanda 507). Antes
      //    un set así se daba por perdido — y son justo los que la 322
      //    encontró vacíos, o sea los que más falta hace rellenar.
      { id: 'sv10', market: 'WEST', name: 'Rivales Predestinados', tcg_online_code: 'DRI', release_date: null, card_count_total: 244, card_count_official: null, logo_path: null, logo_scrydex: null, symbol_scrydex: null },
      // 2. Sin código nuestro: empareja por fecha+cuenta y se confirma
      //    con una CARTA. Y su logo es el RELLENO, así que el logo no se
      //    escribe pero el resto sí.
      // NUESTRO NOMBRE Y EL SUYO TIENEN QUE SER DISTINTOS AQUÍ (tanda
      // 530), y es lo realista: el nuestro viene de TCGdex en español y el
      // suyo está en inglés. Con los dos iguales, el par se confirma
      // GRATIS por el nombre del set y ya no se pide la carta — que es
      // una mejora, pero deja sin probar el camino de la Pokédex, que es
      // justo lo que estas dos comprobaciones miran.
      { id: 'promos', market: 'WEST', name: 'Promos del sello negro', tcg_online_code: null, release_date: '2023-01-01', card_count_total: 60, card_count_official: null, logo_path: null, logo_scrydex: null, symbol_scrydex: null },
      // 3. Un par FALSO: empareja por fecha+cuenta y el código NO cuadra.
      //    No se escribe NADA de él.
      { id: 'ex5.5', market: 'WEST', name: 'Creadores de Leyendas', tcg_online_code: 'LM', release_date: '2006-02-13', card_count_total: 93, card_count_official: null, logo_path: null, logo_scrydex: null, symbol_scrydex: null },
      // 4. Ya completo: no hay nada que cambiar y no entra en el upsert.
      { id: 'base1', market: 'WEST', name: 'Base', tcg_online_code: 'BS', release_date: '1999-01-09', card_count_total: 102, card_count_official: 102, logo_path: 'base/base1/logo', logo_scrydex: LOGO_BUENO, symbol_scrydex: 'https://images.scrydex.com/pokemon/base1-symbol/symbol', scrydex_id: 'base1', scrydex_por: 'el código del set' },
      // 5. NI FECHA NI CÓDIGO: no hay con qué emparejarlo, y se DICE.
      //    Esto se queda en TCGdex, que es lo que PINGU pidió: «si falta
      //    algo en Scrydex, cógelo de las otras cosas».
      { id: 'huerfano', market: 'WEST', name: 'Huérfano', tcg_online_code: null, release_date: null, card_count_total: 7, card_count_official: null, logo_path: null, logo_scrydex: null, symbol_scrydex: null },
    ]
  }
  const fetchImpl = async (url, o) => {
    llamadas.push({ url, cab: o?.headers })
    if (/\/expansions/.test(url)) {
      return { ok: true, json: async () => ({ total_count: 4, data: [
        { id: 'sv10', name: 'Destined Rivals', code: 'DRI', release_date: '2026/05/30', printed_total: 182, total: 244, logo: LOGO_BUENO, symbol: 'https://images.scrydex.com/pokemon/sv10-symbol/symbol' },
        { id: 'svp', name: 'Promos', code: 'PR', release_date: '2023/01/01', printed_total: 60, total: 60, logo: LOGO_RELLENO },
        { id: 'wb1', name: 'Wizards Black Star', code: 'WBSP', release_date: '2006/02/13', printed_total: 93, total: 93, logo: LOGO_BUENO },
        { id: 'base1', name: 'Base', code: 'BS', release_date: '1999/01/09', printed_total: 102, total: 102, logo: LOGO_BUENO, symbol: 'https://images.scrydex.com/pokemon/base1-symbol/symbol' },
      ] }) }
    }
    if (/\/cards\//.test(url)) {
      const id = url.split('/cards/')[1]
      if (id.startsWith('svp-')) return { ok: true, json: async () => ({ data: { id, name: 'Pikachu', national_pokedex_numbers: [25], expansion: { id: 'svp', code: 'PR' } } }) }
      return { ok: false, status: 404 }
    }
    // Las imágenes: el relleno devuelve los bytes cuyo sha-1 empieza por
    // la huella conocida, que es lo que `esRelleno` reconoce.
    const cuerpo = url === LOGO_RELLENO ? RELLENO_BYTES : Buffer.from(`dibujo de ${url}`)
    return { ok: true, status: 206, arrayBuffer: async () => cuerpo }
  }
  const escribirImpl = async (filas) => { escrito.push(...filas) }
  return { restImpl, fetchImpl, escribirImpl, escrito, llamadas }
}
const RELLENO_BYTES = Buffer.from('__RELLENO__')

// NO SE PUEDEN FABRICAR unos bytes cuyo sha-1 empiece por una huella dada,
// así que la prueba no podía llegar NUNCA a la rama que tira la URL del
// relleno — y es justo la rama que evita escribir un cuadro de «no image»
// que nadie distingue de un logo. Por eso la huella es inyectable, como el
// `fetchImpl` y el `restImpl`: aquí se devuelve la huella CONOCIDA del
// relleno para esos bytes concretos, y la decisión la sigue tomando
// `esRelleno` de verdad.
const huellaDePrueba = (buf) => (
  buf.equals(RELLENO_BYTES) ? `${HUELLAS_DE_RELLENO.logo}0000` : 'aa'.repeat(20)
)

{
  const d = doble()
  const r = await procesar({ env: ENV, fetchImpl: d.fetchImpl, restImpl: d.restImpl, escribirImpl: d.escribirImpl, huellaImpl: huellaDePrueba })
  check('contesta 200', r.estado === 200, JSON.stringify(r.cuerpo?.error))
  // LO PRIMERO: por defecto NO ESCRIBE. Netlify despliega esta rama en
  // directo y es la primera escritura desde Scrydex.
  check('POR DEFECTO ES UN ENSAYO EN SECO', r.cuerpo.ensayoEnSeco === true && r.cuerpo.escritas === 0, JSON.stringify(r.cuerpo.ensayoEnSeco))
  check('  …y no ha escrito NI UNA fila', d.escrito.length === 0, JSON.stringify(d.escrito))
  check('  …y dice cómo se escribe', /escribir/.test(r.cuerpo.COMO_ESCRIBIR || ''), r.cuerpo.COMO_ESCRIBIR)
  check('dice si su listado trae los logos, en vez de darlo por hecho', /4 de 4/.test(r.cuerpo.suListadoTraeLogos), r.cuerpo.suListadoTraeLogos)
  // EL PAR DUDOSO NO ENTRA, que es la propiedad que importa. Desde la
  // 508 un código distinto ya NO rechaza —«RR» contra «TRR» era el mismo
  // set—, así que se queda sin confirmar… y sin confirmar tampoco se
  // escribe. Falla hacia el lado bueno.
  check('el par con el código distinto NO se rechaza', r.cuerpo.rechazados.length === 0, JSON.stringify(r.cuerpo.rechazados))
  check('  …pero tampoco se confirma', r.cuerpo.sinConfirmar.some((x) => /ex5\.5/.test(x.par)), JSON.stringify(r.cuerpo.sinConfirmar))
  check('  …y NO sale en los cambios', !JSON.stringify(r.cuerpo.cambios).includes('ex5.5'), JSON.stringify(r.cuerpo.cambios))
  check('se confirma por el código cuando lo hay, gratis', r.cuerpo.porQueSeConfirman['el código del set'] >= 1, JSON.stringify(r.cuerpo.porQueSeConfirman))
  check('y por la Pokédex de una carta cuando no', r.cuerpo.porQueSeConfirman['los números de Pokédex'] === 1, JSON.stringify(r.cuerpo.porQueSeConfirman))
  check('hay algo que escribir', r.cuerpo.aEscribir > 0, String(r.cuerpo.aEscribir))
  // EL RESCATE: un set sin NUESTRA fecha se daba antes por perdido, y
  // son justo los que la 322 encontró vacíos. Lo rescata el id o el
  // código — aquí el ID, que es la llave más fuerte de las dos.
  check('un set sin nuestra fecha se rescata',
    JSON.stringify(r.cuerpo.cambios).includes('sv10'), JSON.stringify(r.cuerpo.cambios.map((c) => c.set)))
  check('  …y se dice CON QUÉ se ha rescatado',
    r.cuerpo.porQueSeEmparejan['id idéntico'] === 1, JSON.stringify(r.cuerpo.porQueSeEmparejan))
  // Y LA LIMITACIÓN, por escrito: sin fecha, sin id y sin código no hay
  // con qué, y eso se DICE en vez de quedarse callado.
  check('sin nada con lo que casar se queda suelto, y se dice por qué',
    r.cuerpo.sinEmparejar === 1 && /ni el id ni el código/.test(JSON.stringify(r.cuerpo.porQueNoSeEmparejan)),
    JSON.stringify(r.cuerpo.porQueNoSeEmparejan))
  check('el que ya está completo no entra en el upsert', !JSON.stringify(r.cuerpo.cambios).includes('base1'), JSON.stringify(r.cuerpo.cambios))
  check('la cuenta cuadra', r.cuerpo.cuadraLaCuenta === true, JSON.stringify(r.cuerpo))
  // LA GUARDA DE LA 499: cada imagen se mira antes de guardarla, y solo
  // los primeros bytes. Sin esto se guardaría un cuadro de «no image»
  // que nadie distingue de un logo, porque devuelve 200.
  const imagenes = d.llamadas.filter((l) => String(l.url || '').includes('images.scrydex'))
  check('cada imagen se mira ANTES de escribirla', imagenes.length >= 2, String(imagenes.length))
  check('  …y solo los primeros bytes, con `Range`',
    imagenes.every((l) => /^bytes=0-\d+$/.test(l.cab?.range || '')),
    JSON.stringify(imagenes.map((l) => l.cab?.range)))
  // Y EL RELLENO SE TIRA. Su servidor lo contesta con un 200, así que sin
  // esto se guardaría un cuadro de «no image» y la cadena de respaldo no
  // pasaría al siguiente dibujo —solo pasa cuando la imagen DA ERROR—.
  check('la imagen de RELLENO se descarta', r.cuerpo.descartadosPorRelleno === 1, JSON.stringify(r.cuerpo.ejemplosDeRelleno))
  check('  …diciendo que es el relleno, no «no la tienen»', /RELLENO/.test(JSON.stringify(r.cuerpo.ejemplosDeRelleno)), JSON.stringify(r.cuerpo.ejemplosDeRelleno))
  const promos = r.cuerpo.cambios.find((c) => c.set === 'promos')
  check('  …y el logo del relleno NO se escribe', promos && !('logo_scrydex' in promos.cambia), JSON.stringify(promos))
  check('  …pero lo demás de ese set SÍ', promos && 'card_count_official' in promos.cambia, JSON.stringify(promos))
}
{
  // CON `escribir`, escribe — y solo las filas del ensayo.
  const d = doble()
  const r = await procesar({ env: ENV, fetchImpl: d.fetchImpl, restImpl: d.restImpl, escribirImpl: d.escribirImpl, huellaImpl: huellaDePrueba, escribir: true })
  check('con `escribir`, sí escribe', r.cuerpo.escritas === r.cuerpo.aEscribir && r.cuerpo.escritas > 0, JSON.stringify([r.cuerpo.escritas, r.cuerpo.aEscribir]))
  check('  …y escribe exactamente lo que dijo el ensayo', d.escrito.length === r.cuerpo.aEscribir, String(d.escrito.length))
  check('NO escribe el set del par falso', !d.escrito.some((f) => f.id === 'ex5.5'), JSON.stringify(d.escrito.map((f) => f.id)))
  check('NO escribe el set que ya estaba completo', !d.escrito.some((f) => f.id === 'base1'), JSON.stringify(d.escrito.map((f) => f.id)))
  // Y TODAS las filas llevan las MISMAS claves: PostgREST rechaza una
  // sentencia con objetos de claves distintas.
  const claves = d.escrito.map((f) => JSON.stringify(Object.keys(f).sort()))
  check('todas las filas llevan las mismas claves', new Set(claves).size === 1, JSON.stringify([...new Set(claves)]))
  check('y todas llevan la clave primaria entera (id + market)', d.escrito.every((f) => f.id && f.market), JSON.stringify(d.escrito.map((f) => [f.id, f.market])))
  // EL EMPAREJAMIENTO SE GUARDA (tanda 509): sin esto, cada pasada de las
  // cartas tendría que volver a verificar los 210 pares, y podría
  // emparejar distinto que la vez anterior sin que nada lo dijera.
  check('se guarda CON QUIÉN casa cada set', d.escrito.every((f) => f.scrydex_id), JSON.stringify(d.escrito.map((f) => [f.id, f.scrydex_id])))
  check('  …y con qué señal se confirmó', d.escrito.every((f) => f.scrydex_por), JSON.stringify(d.escrito.map((f) => f.scrydex_por)))
  check('y NO se escribe la URL del relleno en ninguna fila',
    !d.escrito.some((f) => f.logo_scrydex === LOGO_RELLENO), JSON.stringify(d.escrito.map((f) => [f.id, f.logo_scrydex])))
}
{
  // EL CASO DE LOS 37 (tanda 508): un set NUESTRO que SÍ tiene fecha pero
  // cuya cuenta no casa con ninguna de las suyas. Son todo promos, donde
  // los dos catálogos cuentan distinto porque no hay un total oficial.
  // Antes se daban por perdidos los 37; ahora los rescata el id.
  const d = doble()
  const cuentaDistinta = async (ruta) => {
    // La carta la pide por el id NUEVO del set, así que el doble tiene
    // que contestar por `svp` igual que contestaba por `promos`.
    if (/tcg_cards/.test(ruta)) return d.restImpl(ruta.replace('set_id=eq.svp', 'set_id=eq.promos'))
    const filas = await d.restImpl(ruta)
    // `promos` conserva su fecha pero se le cambia la cuenta, así que ya
    // no casa por fecha+cuenta con ninguna de las suyas.
    return filas.map((f) => (f.id === 'promos' ? { ...f, id: 'svp', card_count_total: 9999 } : f))
  }
  const conSvp = async (url, o) => {
    if (!/\/expansions/.test(url)) return d.fetchImpl(url, o)
    const r = await d.fetchImpl(url, o)
    const j = await r.json()
    return { ok: true, json: async () => ({ ...j, data: j.data.map((e) => (e.id === 'svp' ? e : e)) }) }
  }
  const r = await procesar({ env: ENV, fetchImpl: conSvp, restImpl: cuentaDistinta, escribirImpl: d.escribirImpl, huellaImpl: huellaDePrueba })
  // Y se comprueba por SU NOMBRE, no por un contador: con `sv10` también
  // emparejando por id, un «>= 1» se habría cumplido sin rescatar a `svp`.
  check('un set CON fecha cuya cuenta no casa se rescata por el id',
    r.cuerpo.cambios.some((c) => c.set === 'svp'), JSON.stringify(r.cuerpo.cambios.map((c) => c.set)))
  check('  …y se dice que ha sido por el id', r.cuerpo.porQueSeEmparejan['id idéntico'] === 2, JSON.stringify(r.cuerpo.porQueSeEmparejan))
}
{
  // UN SET SUYO NO SE REPARTE DOS VECES. Si ya está emparejado con uno
  // nuestro, el rescate no puede volver a cogerlo: serían dos sets
  // nuestros con el mismo logo y uno de los dos estaría mal.
  const d = doble()
  const dosNuestros = async (ruta) => {
    if (/tcg_cards/.test(ruta)) return d.restImpl(ruta)
    const filas = await d.restImpl(ruta)
    // Un segundo set nuestro que TAMBIÉN se llama `sv10`… no puede ser,
    // así que se le da el mismo CÓDIGO, que es la otra llave del rescate.
    return [...filas, { id: 'otro', market: 'WEST', name: 'Otro', tcg_online_code: 'DRI', release_date: null, card_count_total: 1, card_count_official: null, logo_path: null, logo_scrydex: null, symbol_scrydex: null }]
  }
  const r = await procesar({ env: ENV, fetchImpl: d.fetchImpl, restImpl: dosNuestros, escribirImpl: d.escribirImpl, huellaImpl: huellaDePrueba, escribir: true })
  // Se comprueba con `scrydex_id`, que ES el emparejamiento. La primera
  // versión miraba el logo —tres sets distintos pueden compartir la misma
  // URL en un fixture— y daba un rojo que no era: un proxy no es el dato.
  const suyos = d.escrito.map((f) => f.scrydex_id).filter(Boolean)
  check('ningún set suyo se reparte a DOS nuestros',
    suyos.length === new Set(suyos).size, JSON.stringify(suyos))
}
{
  // DOS EXPANSIONES SUYAS CON EL MISMO CÓDIGO: entonces el código no
  // identifica a nadie, y elegir «la primera» sería elegir a ojo. Un par
  // inventado mete el logo de otro set en la base sin dar error.
  const d = doble()
  const dosIguales = async (url, o) => {
    if (!/\/expansions/.test(url)) return d.fetchImpl(url, o)
    return { ok: true, json: async () => ({ total_count: 2, data: [
      { id: 'uno', name: 'Uno', code: 'DRI', release_date: '2026/05/30', printed_total: 182, total: 244, logo: LOGO_BUENO },
      { id: 'dos', name: 'Dos', code: 'DRI', release_date: '1990/01/01', printed_total: 9, total: 9, logo: LOGO_BUENO },
    ] }) }
  }
  const r = await procesar({ env: ENV, fetchImpl: dosIguales, restImpl: d.restImpl, escribirImpl: d.escribirImpl, huellaImpl: huellaDePrueba, escribir: true })
  check('con dos códigos iguales, `sv10` NO se empareja a ojo',
    !d.escrito.some((f) => f.id === 'sv10'), JSON.stringify(d.escrito.map((f) => f.id)))
  check('  …y se dice POR QUÉ, que es lo único que sirve para arreglarlo',
    /ni el id ni el código/.test(JSON.stringify(r.cuerpo.porQueNoSeEmparejan)), JSON.stringify(r.cuerpo.porQueNoSeEmparejan))
}
{
  // ── PRESUPUESTO DE TIEMPO (tanda 510) ──
  //
  // Cada par cuyo código no cuadra pide una carta a su API, y 210 pares a
  // ~300 ms son 63 segundos. Netlify mata a los 30, y como la escritura va
  // AL FINAL, una pasada matada a mitad gasta los créditos y NO ESCRIBE
  // NADA — y la siguiente vuelve a empezar igual, para siempre.
  const d = doble()
  let t = 0
  const r = await procesar({ env: ENV, ...d, huellaImpl: huellaDePrueba, escribir: true, reloj: () => (t += 12000) })
  check('se para antes de que Netlify lo mate', r.cuerpo.sinTiempo > 0, JSON.stringify(r.cuerpo.sinTiempo))
  check('  …y aun así ESCRIBE lo que confirmó', d.escrito.length > 0, JSON.stringify(d.escrito.map((f) => f.id)))
  check('  …y la cuenta sigue cuadrando', r.cuerpo.cuadraLaCuenta === true, JSON.stringify(r.cuerpo))
}
{
  // «No tenemos cartas» y «no he podido preguntar» NO son lo mismo: lo
  // primero es un dato del catálogo, lo segundo un fallo nuestro. El
  // `catch { filas = [] }` que había los juntaba, y un tropiezo de la base
  // se leía como un set vacío — y un set vacío no se vuelve a mirar igual.
  const d = doble()
  const rota = async (ruta) => {
    if (/tcg_cards/.test(ruta)) throw new Error('Supabase 503: upstream')
    return d.restImpl(ruta)
  }
  const r = await procesar({ env: ENV, ...d, restImpl: rota, huellaImpl: huellaDePrueba })
  check('un fallo de la base NO se cuenta como «no tenemos cartas»',
    r.cuerpo.sinConfirmar.some((x) => /no se ha podido preguntar/.test(x.porque)), JSON.stringify(r.cuerpo.sinConfirmar))
}
{
  // Si falta la migración, se dice QUÉ hay que ejecutar — no un «no se
  // ha podido» que no explica nada.
  const d = doble()
  const sinColumna = async (ruta) => {
    if (/tcg_sets\?select/.test(ruta)) throw new Error('Supabase 400: column tcg_sets.logo_scrydex does not exist')
    return d.restImpl(ruta)
  }
  const r = await procesar({ env: ENV, fetchImpl: d.fetchImpl, restImpl: sinColumna, escribirImpl: d.escribirImpl })
  check('sin la migración, dice cuál ejecutar', r.estado === 409 && /supabase-migration-scrydex\.sql/.test(r.cuerpo.error), JSON.stringify(r.cuerpo))
}
{
  // Si su API se cae, no se escribe nada.
  const d = doble()
  const roto = async (url, o) => (/\/expansions/.test(url) ? { ok: false, status: 500 } : d.fetchImpl(url, o))
  const r = await procesar({ env: ENV, fetchImpl: roto, restImpl: d.restImpl, escribirImpl: d.escribirImpl, escribir: true })
  check('si su API falla, no se escribe nada', r.estado === 502 && d.escrito.length === 0, JSON.stringify(r.cuerpo))
}

console.log('\n── 4. EL FALLO SILENCIOSO: escribir una columna que nadie pide ──')
//
// Si un `select` de `tcg_sets` no pide `logo_scrydex`, se escriben 160
// logos y EN PANTALLA NO CAMBIA NADA, sin un solo error. Así que la regla
// se comprueba por su FORMA (lección de la 303): donde se pida
// `logo_path`, hay que pedir también los de Scrydex.
{
  const FICHEROS = [
    'js/mi-coleccion.js', 'js/cartas.js', 'js/coleccion.js',
    'netlify/edge-functions/meta-social.js',
  ]
  for (const f of FICHEROS) {
    const txt = readFileSync(`/home/user/pingu/${f}`, 'utf8')
    // Cada lista de columnas de un `select` que mencione `logo_path`
    // tiene que traer también `logo_scrydex`. Se mira lista por lista y
    // no el fichero entero: con un solo `select` arreglado de cinco, el
    // fichero contendría la cadena y esto pasaría (trampa de la 312).
    //
    // Y se buscan SOLO listas de columnas —las que van entre comillas y
    // llevan comas—, no cualquier línea que nombre `logo_path`: la
    // primera versión de esto casaba `urlDeLogo(set.logo_path, …)`, que
    // es código y no una consulta, y daba un rojo que no era.
    const listas = (txt.match(/'[^'\n]*logo_path[^'\n]*'/g) || [])
      .filter((l) => l.includes(','))
    check(`${f}: ${listas.length} lista(s) con \`logo_path\``, listas.length > 0)
    check(`  …y todas piden \`logo_scrydex\``,
      listas.every((l) => l.includes('logo_scrydex')),
      JSON.stringify(listas.filter((l) => !l.includes('logo_scrydex'))))
  }
}
{
  // Y quien PINTA el logo tiene que preferir el de Scrydex.
  const mc = readFileSync('/home/user/pingu/js/mi-coleccion.js', 'utf8')
  const cn = readFileSync('/home/user/pingu/js/carta-nucleo.js', 'utf8')
  const cadena = (mc.match(/const dibujos = \[[^\]]*\]/) || [''])[0]
  check('en /mi-coleccion el de Scrydex va PRIMERO', /^const dibujos = \[set\.logo_scrydex/.test(cadena), cadena)
  // Y LO DE TCGDEX SE QUEDA DETRÁS: un respaldo que se borra no es un
  // respaldo (tanda 321). El día que su CDN no conteste, se ve algo.
  check('  …y la cadena de TCGdex sigue detrás', /logoAMano/.test(cadena) && /simbolo/.test(cadena), cadena)
  check('la cabecera de una colección también lo prefiere', /set\.logo_scrydex \|\| urlDeLogo\(set\.logo_path\)/.test(cn))
}

console.log('\n── 5. La migración, y que no toque la base por su cuenta ──')
{
  const sql = readFileSync('/home/user/pingu/supabase-migration-scrydex.sql', 'utf8')
  check('añade las tres columnas', ['tcg_sets.logo_scrydex', 'tcg_sets.symbol_scrydex', 'tcg_cards.image_scrydex']
    .every((c) => new RegExp(c.replace('.', '\\s+add column if not exists ').replace('tcg_', 'public.tcg_')).test(sql) || sql.includes(c.split('.')[1])), sql.slice(0, 80))
  check('y no borra ni renombra NADA', !/drop\s+column|alter\s+column|update\s+public|delete\s+from/i.test(sql))
  check('cuenta las que llevan el español en `name` (hallazgo de la 505)', /name_es/.test(sql) && /nombre_en_espanol/.test(sql))

  const js = readFileSync('/home/user/pingu/netlify/functions/scrydex-sets.mjs', 'utf8')
  check('solo POST', /req\.method !== 'POST'/.test(js))
  check('  …y admin antes de nada', js.indexOf('idDeAdmin') < js.indexOf('await procesar({'))
  // `escribir` tiene que pedirse A PROPÓSITO: un valor a medias
  // (undefined, '', 0, 'false') no puede acabar escribiendo.
  check('`escribir` solo vale si es exactamente `true`', /cuerpo\.escribir === true/.test(js))
  check('tiene un tope de escritura por si el emparejamiento se desmadra', /TOPE_DE_ESCRITURA/.test(js))
  check('usa `esRelleno`, sin la cual escribiría cuadros de «no image»', /esRelleno/.test(js))
}

console.log('\n── 6. Y el panel enseña el ensayo antes de escribir ──')
{
  const html = readFileSync('/home/user/pingu/admin/index.html', 'utf8')
  const js = readFileSync('/home/user/pingu/admin/js/admin.js', 'utf8')
  check('el botón está', /id="btnSetsScrydex"/.test(html))
  check('  …conectado', /getElementById\('btnSetsScrydex'\)\?\.addEventListener/.test(js))
  const i = js.indexOf('async function setsScrydex()')
  const fn = js.slice(i, i + js.slice(i).indexOf('\n}\n'))
  check('pide primero SIN escribir', /pedir\(false\)/.test(fn))
  check('  …y pregunta antes de escribir', /window\.confirm/.test(fn))
  check('  …con el número de filas delante', /r\.aEscribir\} sets/.test(fn))
  check('enseña el ANTES fila a fila', /c\.cambia/.test(fn))
  check('y avisa si la cuenta no cuadra', /cuadraLaCuenta === false/.test(fn))
  check('manda la sesión y no una clave', /session\.access_token/.test(fn) && !/SCRYDEX_/.test(js))
}

console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
