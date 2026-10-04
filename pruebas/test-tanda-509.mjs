// Tanda 509 — el relleno que trabaja SOLO, de noche.
//
// PINGU, antes de acostarse: «quiero que me rellenes todas las cartas
// posibles, todos los logos posibles […] mañana cuando me despierte quiero
// poder recomendar esta parte de la web a mis amigos».
//
// Por eso es una función PROGRAMADA y no un botón: un botón necesita a
// alguien delante. Y por eso lo que más vigila esta prueba es que no pueda
// hacer daño mientras nadie mira.
import { readFileSync } from 'node:fs'
import {
  filaDeCartaConScrydex, nombreQueHayQueArreglar, filaDeSetConScrydex,
} from '/home/user/pingu/netlify/lib/scrydex.mjs'
import { procesar } from '/home/user/pingu/netlify/functions/scrydex-relleno.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 320) : ''}`)
}
const ENV = { SCRYDEX_API_KEY: 'k', SCRYDEX_TEAM_ID: 't', SUPABASE_SERVICE_ROLE_KEY: 's' }
const SM10_1 = JSON.parse(readFileSync(new URL('./fixtures/scrydex-cards-sm10-1.json', import.meta.url), 'utf8')).data

console.log('── 1. Una carta suya pasada a nuestras columnas ──')
{
  const nuestra = { id: 'sm10-1', market: 'WEST', set_id: 'sm10', local_id: '1', name: 'Pheromosa y Buzzwole GX', name_es: 'Pheromosa y Buzzwole GX' }
  const f = filaDeCartaConScrydex(nuestra, SM10_1)
  // LA FOTO SE GUARDA SIN LA CALIDAD: su URL viene con `/small` pegado, y
  // guardarlo dejaría la ficha grande pintando una miniatura para siempre.
  check('la foto se guarda SIN la calidad al final', f.image_scrydex === 'https://images.scrydex.com/pokemon/sm10-1', f.image_scrydex)
  check('el ilustrador', f.illustrator === 'Mitsuhiro Arita')
  check('la Pokédex, de números y no de cadenas', JSON.stringify(f.dex_ids) === '[794,795]', JSON.stringify(f.dex_ids))
  check('los PS, de número (los suyos vienen en cadena)', f.hp === 260 && typeof f.hp === 'number', JSON.stringify(f.hp))
  check('y la clave primaria entera', f.id === 'sm10-1' && f.market === 'WEST' && f.set_id === 'sm10')
  check('se marca por dónde pasó, que es como se reanuda', !!f.scrydex_at)

  // ── LA RAREZA EXACTA, que es lo que PINGU pidió ──
  check('la rareza inglesa va a `rarity_en`', f.rarity_en === 'Rare Holo GX', f.rarity_en)
  check('  …con su código', f.rarity_code === 'Rare Holo GX', f.rarity_code)
  // Y LO QUE NO SE TOCA: `rarity`, `types` y `category` están en ESPAÑOL
  // («Rara Doble», «Pokémon») y lo suyo en inglés. Escribirlos partiría
  // los desplegables de /mi-coleccion por la mitad, sin dar error.
  check('NO se escribe `rarity`, que está en español', !('rarity' in f), JSON.stringify(Object.keys(f)))
  check('NI `types` NI `category`', !('types' in f) && !('category' in f), JSON.stringify(Object.keys(f)))

  // ── LAS DOS CLASES DE COLUMNA, igual que en la 507 ──
  //
  // Las NUESTRAS (`illustrator`, `hp`, `dex_ids`) solo se rellenan si están
  // vacías: ahí manda lo que ya hay. Las de SCRYDEX (`image_scrydex`) son
  // suyas, así que él las refresca — y eso es lo que hace que una pasada
  // nueva cure una URL que se hubiera quedado vieja.
  const llena = { ...nuestra, illustrator: 'Otro', hp: 10, dex_ids: [1], rarity_en: 'Mía', image_scrydex: 'https://x/y' }
  const g = filaDeCartaConScrydex(llena, SM10_1)
  check('lo NUESTRO no se pisa',
    g.illustrator === 'Otro' && g.hp === 10 && JSON.stringify(g.dex_ids) === '[1]' && g.rarity_en === 'Mía',
    JSON.stringify(g))
  check('  …pero la columna SUYA la refresca él',
    g.image_scrydex === 'https://images.scrydex.com/pokemon/sm10-1', g.image_scrydex)
  // Y las claves son SIEMPRE las mismas: PostgREST las exige uniformes.
  check('las claves son las mismas con y sin datos nuestros',
    JSON.stringify(Object.keys(f)) === JSON.stringify(Object.keys(g)), JSON.stringify(Object.keys(f)))
  // Un cero no es «no lo tengo» (tanda 508).
  check('unos PS a 0 no se tratan como vacíos', filaDeCartaConScrydex({ ...nuestra, hp: 0 }, SM10_1).hp === 0)
  // Una Pokédex VACÍA nuestra sí se rellena; una con algo, no.
  check('un `dex_ids` vacío sí se rellena', JSON.stringify(filaDeCartaConScrydex({ ...nuestra, dex_ids: [] }, SM10_1).dex_ids) === '[794,795]')
}

console.log('\n── 2. El nombre en español: SOLO donde se puede demostrar ──')
//
// Es el arreglo del hallazgo de la 505 (~1.890 cartas), y es la única
// columna que PISA algo, así que va con pinzas.
{
  // Nuestra fila demuestra que lleva el español: `name` == `name_es`.
  const mala = { name: 'Pheromosa y Buzzwole GX', name_es: 'Pheromosa y Buzzwole GX' }
  check('con `name` == `name_es`, se arregla', nombreQueHayQueArreglar(mala, SM10_1) === 'Pheromosa & Buzzwole-GX', JSON.stringify(nombreQueHayQueArreglar(mala, SM10_1)))
  // Y si NO se puede demostrar, NO SE TOCA. Un `name` que ya es inglés y
  // discrepa del suyo puede ser un emparejamiento flojo, no un error.
  const buena = { name: 'Ethan’s Pinsir', name_es: 'Pinsir de Eco' }
  check('con el inglés ya puesto, NO se toca', nombreQueHayQueArreglar(buena, SM10_1) === null, JSON.stringify(nombreQueHayQueArreglar(buena, SM10_1)))
  check('sin `name_es`, tampoco', nombreQueHayQueArreglar({ name: 'Algo' }, SM10_1) === null)
  // Y si el suyo dice lo mismo, no hay nada que escribir.
  const igual = { name: 'Pikachu', name_es: 'Pikachu' }
  check('si el suyo dice lo mismo, no se escribe nada', nombreQueHayQueArreglar(igual, { name: 'Pikachu' }) === null)
  check('y sin nombre suyo tampoco', nombreQueHayQueArreglar(mala, { name: '  ' }) === null)
}

console.log('\n── 3. La pasada entera, con un doble ──')
const doble = ({ totalCount = 2, suTam = null, pendientes = true, estadoInicial = { pagina: 1 } } = {}) => {
  const escrito = []
  const estados = []
  const llamadas = []
  const restImpl = async (ruta) => {
    llamadas.push(ruta)
    if (/scrydex_estado/.test(ruta)) return [{ valor: estadoInicial }]
    // «¿Queda alguna carta sin tocar?», que es el freno de la 509b.
    if (/scrydex_at=is\.null/.test(ruta)) return pendientes ? [{ id: 'x' }] : []
    if (/tcg_sets/.test(ruta)) {
      // `sm10` verificado; `otro` NO (sin `scrydex_id`), así que la
      // consulta lleva `scrydex_id=not.is.null` y no lo devuelve.
      return [{ id: 'sm10', scrydex_id: 'sm10' }]
    }
    return [
      { id: 'sm10-1', market: 'WEST', set_id: 'sm10', local_id: '1', name: 'Pheromosa y Buzzwole GX', name_es: 'Pheromosa y Buzzwole GX' },
      { id: 'sm10-2', market: 'WEST', set_id: 'sm10', local_id: '002', name: 'Pikachu', name_es: 'Pikachu' },
    ]
  }
  const fetchImpl = async (url, o) => {
    llamadas.push({ url, cab: o?.headers })
    const pag = Number(/[?&]page=(\d+)/.exec(url)?.[1] || 1)
    if (pag > 1) return { ok: true, json: async () => ({ data: [], page: pag, page_size: suTam || 250, total_count: totalCount }) }
    return {
      ok: true,
      json: async () => ({
        data: [
          SM10_1,
          // Su «2» contra nuestro «002»: el número se normaliza.
          { id: 'sm10-2', name: 'Pikachu', number: '2', rarity: 'Rare Rainbow', rarity_code: 'RRB', artist: 'A', hp: '40', national_pokedex_numbers: [25], images: [{ type: 'front', small: 'https://images.scrydex.com/pokemon/sm10-2/small' }], expansion: { id: 'sm10', code: 'UNB' } },
          // Una carta suya de un set que NO tenemos emparejado: se cuenta
          // y NO se inserta. Ellos tienen 25.209 y nosotros 21.476.
          { id: 'zzz-1', name: 'Ajena', number: '1', expansion: { id: 'zzz', code: 'ZZZ' } },
        ],
        page: 1, page_size: suTam || 250, total_count: totalCount,
      }),
    }
  }
  const escribirImpl = async (tabla, filas) => { escrito.push({ tabla, filas }) }
  const guardarEstadoImpl = async (v) => { estados.push(v) }
  return { restImpl, fetchImpl, escribirImpl, guardarEstadoImpl, escrito, estados, llamadas }
}

{
  const d = doble()
  const r = await procesar({ env: ENV, ...d, paginas: 3 })
  check('contesta 200', r.estado === 200, JSON.stringify(r.cuerpo?.error))
  check('escribe las dos cartas que son nuestras', r.cuerpo.escritas === 2, String(r.cuerpo.escritas))
  // LA CARTA AJENA NO SE INSERTA. Sus ids son suyos y los nuestros vienen
  // de TCGdex: insertar dejaría el catálogo con dos nomenclaturas.
  check('la carta de un set ajeno NO se inserta', r.cuerpo.sinSetNuestro === 1, String(r.cuerpo.sinSetNuestro))
  const ids = d.escrito.flatMap((e) => e.filas.map((f) => f.id))
  check('  …y no aparece en nada de lo escrito', !ids.includes('zzz-1'), JSON.stringify(ids))
  // «2» contra «002»: sin normalizar, media página no casaría con nada.
  check('su «2» casa con nuestro «002»', ids.includes('sm10-2'), JSON.stringify(ids))
  // EL ARREGLO DE LA 505, en su propia sentencia porque es la única
  // columna que PISA y lleva claves distintas.
  check('el nombre en español se arregla', r.cuerpo.nombresArreglados === 1, String(r.cuerpo.nombresArreglados))
  const deNombre = d.escrito.find((e) => e.filas.some((f) => 'name' in f))
  check('  …en su PROPIA sentencia', !!deNombre && deNombre.filas.every((f) => !('image_scrydex' in f)), JSON.stringify(deNombre?.filas))
  check('  …y con un ejemplo que se puede leer', /Pheromosa/.test(JSON.stringify(r.cuerpo.ejemplosDeNombre)), JSON.stringify(r.cuerpo.ejemplosDeNombre))
  // Las rarezas se APRENDEN de los datos, que es como se sabe qué hay que
  // traducir sin inventarse la lista (la norma de la 501).
  check('aprende su vocabulario de rarezas', r.cuerpo.rarezasVistas['Rare Rainbow'] === 1, JSON.stringify(r.cuerpo.rarezasVistas))
  // Todas las filas de una sentencia, con las MISMAS claves.
  for (const e of d.escrito) {
    const ks = e.filas.map((f) => JSON.stringify(Object.keys(f).sort()))
    check(`una sentencia de ${e.filas.length} fila(s) con las mismas claves`, new Set(ks).size === 1, JSON.stringify([...new Set(ks)]))
  }
  // Se guarda por dónde iba: es lo ÚNICO que no se puede sacar de los datos.
  check('guarda por dónde iba', d.estados.length > 0 && d.estados.every((e) => Number(e.pagina) >= 1), JSON.stringify(d.estados))
  check('  …y al acabar vuelve a la 1 y cuenta el barrido',
    d.estados.at(-1).pagina === 1 && d.estados.at(-1).barridos === 1, JSON.stringify(d.estados.at(-1)))
}
{
  // SU `page_size` MANDA, no el que pedí: la respuesta dice el que de
  // verdad aplicó. Inventarse el máximo es el error que costó la 501.
  const d = doble({ totalCount: 500, suTam: 100 })
  const r = await procesar({ env: ENV, ...d, paginas: 1 })
  check('el tamaño de página sale de SU respuesta', r.cuerpo.susCartas === 500, JSON.stringify(r.cuerpo.susCartas))
  check('  …y la página avanza', r.cuerpo.siguientePagina === 2, String(r.cuerpo.siguientePagina))
}
{
  // SIN EMPAREJAMIENTOS VERIFICADOS NO SE TOCA NADA. Un par falso metería
  // las cartas de otro set dentro del nuestro, sin dar error.
  const d = doble()
  const sinSets = async (ruta) => (/tcg_sets/.test(ruta) ? [] : d.restImpl(ruta))
  const r = await procesar({ env: ENV, ...d, restImpl: sinSets })
  check('sin sets verificados, no escribe NADA', r.estado === 409 && d.escrito.length === 0, JSON.stringify(r.cuerpo))
}
{
  // El presupuesto de tiempo: Netlify mata a los 30 s, así que lo que no
  // da tiempo se queda para la pasada siguiente (lección de la 322).
  const d = doble({ totalCount: 99999 })
  let t = 0
  const r = await procesar({ env: ENV, ...d, paginas: 999, reloj: () => (t += 9000) })
  check('se para antes de que Netlify lo mate', r.cuerpo.paginasHechas <= 3, String(r.cuerpo.paginasHechas))
  check('  …dejando apuntada la página siguiente', r.cuerpo.siguientePagina > 1, String(r.cuerpo.siguientePagina))
}
{
  // Si su API falla, se apunta dónde y no se pierde el sitio.
  const d = doble()
  const roto = async (url, o) => (/\/cards/.test(url) ? { ok: false, status: 429 } : d.fetchImpl(url, o))
  const r = await procesar({ env: ENV, ...d, fetchImpl: roto })
  check('si su API falla, se dice y se guarda el sitio', r.estado === 502 && d.estados.at(-1)?.pagina === 1, JSON.stringify([r.cuerpo, d.estados]))
  check('  …y no se escribe nada', d.escrito.length === 0)
  check('  …y se cuenta el intento', d.estados.at(-1)?.fallos === 1, JSON.stringify(d.estados.at(-1)))
}
{
  // ── UNA PÁGINA QUE FALLA SIEMPRE NO PUEDE BLOQUEAR EL BARRIDO ──
  //
  // Reintentarla es correcto para un fallo pasajero. Pero si falla
  // SIEMPRE se reintenta cada cinco minutos para siempre: un crédito cada
  // vez, 288 al día, y el catálogo se queda parado en esa página sin que
  // nadie se entere. Es el bicho del barrido infinito por el otro lado.
  const d = doble({ estadoInicial: { pagina: 7, barridos: 0, fallos: 4 } })
  const roto = async (url, o) => (/\/cards/.test(url) ? { ok: false, status: 500 } : d.fetchImpl(url, o))
  const r = await procesar({ env: ENV, ...d, fetchImpl: roto })
  check('a la quinta, la página que falla siempre SE SALTA', d.estados.at(-1)?.pagina === 8, JSON.stringify(d.estados.at(-1)))
  check('  …y queda apuntada cuál se saltó', (d.estados.at(-1)?.saltadas || []).includes(7), JSON.stringify(d.estados.at(-1)))
  check('  …diciéndolo, no en silencio', /se salta/.test(r.cuerpo.AVISO || ''), JSON.stringify(r.cuerpo))
  check('  …y el contador vuelve a cero para la siguiente', d.estados.at(-1)?.fallos === 0, JSON.stringify(d.estados.at(-1)))
}
{
  // Y los fallos se cuentan SEGUIDOS: cinco tropiezos sueltos a lo largo
  // de un barrido no pueden saltarse una página sana.
  // El catálogo tiene que ser largo para que la pasada NO lo cierre: al
  // cerrar un barrido el estado se reinicia entero y el contador se iría
  // a cero de todas formas, así que esa versión de la prueba se aprobaba
  // sola sin ejercitar la línea.
  const d = doble({ totalCount: 99999, estadoInicial: { pagina: 1, barridos: 0, fallos: 4 } })
  await procesar({ env: ENV, ...d, paginas: 1 })
  check('una página buena pone el contador a cero',
    d.estados.at(-1)?.fallos === 0 && d.estados.at(-1)?.pagina === 2, JSON.stringify(d.estados.at(-1)))
}
{
  const r = await procesar({ env: { SCRYDEX_API_KEY: 'k' } })
  check('sin las variables, se dice cuáles faltan', r.estado === 500 && /SCRYDEX_TEAM_ID/.test(r.cuerpo.error), r.cuerpo.error)
}

console.log('\n── 3b. EL FRENO: sin él se come el plan en una noche ──')
//
// Un barrido completo son 101 páginas = 101 créditos. A 60 páginas por
// pasada y cada cinco minutos, son **48 barridos en una noche = 4.848
// créditos**, con 5.000 al MES. Se habría comido el plan entero antes de
// que nadie se despertara, y encima para reescribir lo mismo.
{
  // 1. Si no queda ninguna carta por marcar, NO SE GASTA NI UN CRÉDITO.
  const d = doble({ pendientes: false })
  const r = await procesar({ env: ENV, ...d })
  check('sin nada pendiente, no pide NADA a Scrydex',
    !d.llamadas.some((l) => String(l.url || '').includes('api.scrydex')), JSON.stringify(d.llamadas.filter((l) => l.url)))
  check('  …y lo dice con el crédito a cero', r.cuerpo.hecho === true && r.cuerpo.creditos === 0, JSON.stringify(r.cuerpo))
}
{
  // 2. Y EL TOPE DE BARRIDOS, porque lo anterior NO BASTA: hay cartas
  //    nuestras que su catálogo no tiene —ellos 25.209, nosotros 21.476,
  //    y no son el mismo conjunto—, así que esas no se marcan NUNCA y
  //    «quedan pendientes» sería verdad para siempre. Sin el tope, el
  //    freno de arriba no frena.
  const d = doble({ pendientes: true, estadoInicial: { pagina: 1, barridos: 2, completadoEn: new Date().toISOString() } })
  const r = await procesar({ env: ENV, ...d })
  check('con los barridos dados, tampoco pide nada aunque queden pendientes',
    !d.llamadas.some((l) => String(l.url || '').includes('api.scrydex')), JSON.stringify(d.llamadas.filter((l) => l.url)))
  check('  …y explica que lo que queda no lo tienen', /su catálogo no tiene/.test(r.cuerpo.porque || ''), r.cuerpo.porque)
}
{
  // 3. Pero un barrido A MEDIAS se termina, pase lo que pase: pararse en
  //    la página 40 dejaría el catálogo medio lleno para siempre.
  const d = doble({ pendientes: false, estadoInicial: { pagina: 40, barridos: 9 } })
  const r = await procesar({ env: ENV, ...d, paginas: 1 })
  check('un barrido a medias SÍ se termina', d.llamadas.some((l) => String(l.url || '').includes('api.scrydex')), String(r.cuerpo.paginasHechas))
}
{
  // 4. Y pasada una semana se vuelve a mirar, porque salen cartas nuevas.
  const hace8dias = new Date(Date.now() - 8 * 86400000).toISOString()
  const d = doble({ pendientes: false, estadoInicial: { pagina: 1, barridos: 9, completadoEn: hace8dias } })
  await procesar({ env: ENV, ...d, paginas: 1 })
  check('a la semana se repasa', d.llamadas.some((l) => String(l.url || '').includes('api.scrydex')))
}
{
  // 5. Y al cerrar un barrido se APUNTA, que es lo que hace que el freno
  //    frene la próxima vez.
  const d = doble({ totalCount: 2 })
  await procesar({ env: ENV, ...d, paginas: 3 })
  check('al cerrar un barrido se cuenta', d.estados.at(-1).barridos === 1, JSON.stringify(d.estados.at(-1)))
  check('  …con la fecha, para el repaso semanal', !!d.estados.at(-1).completadoEn, JSON.stringify(d.estados.at(-1)))
}

console.log('\n── 4. Y que de verdad trabaje SOLA ──')
{
  const relleno = readFileSync('/home/user/pingu/netlify/functions/scrydex-relleno.mjs', 'utf8')
  const logos = readFileSync('/home/user/pingu/netlify/functions/scrydex-logos.mjs', 'utf8')
  // SIN ESTO NO PASA NADA DE NOCHE, que es el motivo entero de la tanda.
  check('el relleno está PROGRAMADO', /export const config = \{ schedule: '\*\/5 \* \* \* \*' \}/.test(relleno))
  check('los logos también', /export const config = \{ schedule: '7 \* \* \* \*' \}/.test(logos))
  check('la clave no está escrita en el código', !/SCRYDEX_API_KEY\s*=\s*['"]/.test(relleno))
  // No inserta: solo escribe filas que ya existen (todas llevan la clave
  // primaria entera y salen de una consulta nuestra).
  check('no hay ningún DELETE ni ningún PATCH a ciegas', !/method:\s*'(DELETE|PUT)'/.test(relleno))
  check('y el emparejamiento se exige verificado', /scrydex_id=not\.is\.null/.test(relleno))
  // EL FRENO, en los dos: sin él son 4.848 créditos en una noche y 2.160
  // al mes respectivamente, con 5.000 de presupuesto MENSUAL.
  check('el relleno tiene tope de barridos', /BARRIDOS_MAXIMOS/.test(relleno))
  check('  …y pregunta antes si queda algo', /quedanPendientes/.test(relleno))
  check('los logos también frenan', /quedaAlgoPorEmparejar/.test(logos))
}
{
  // El emparejamiento se GUARDA, que es lo que permite que el relleno no
  // tenga que volver a verificar 210 pares en cada pasada.
  const f = filaDeSetConScrydex({ id: 'a', market: 'WEST', name: 'A' }, { id: 'sus_a' }, 'el código del set')
  check('el set guarda con quién casa', f.scrydex_id === 'sus_a' && f.scrydex_por === 'el código del set', JSON.stringify(f))
}

console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
