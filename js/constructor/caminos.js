// «¿Cómo encuentro esta carta?» (tanda 554): los caminos de habilidades,
// partidarios y objetos que tienes AHORA para traer una carta a la mano, con
// la probabilidad de cada uno.
//
// PINGU: «poder parar y preguntar a la app cuál es el mejor camino de
// habilidades, entrenadores y objetos que tienes que usar para que te
// favorezca al máximo la probabilidad de encontrar X carta […] y te diga
// todos los posibles caminos con la probabilidad de cada uno».
//
// ── Cómo se calcula ──
//
// Con el MOTOR, no con fórmulas a mano: cada carta ya sabe lo que hace en
// efectos.js (buscar, robar, mirar las de arriba, barajar y robar…), y
// escribir aparte la probabilidad de cada una sería tener dos versiones de
// la misma carta que acaban diciendo cosas distintas. Así que se JUEGA: el
// camino se juega en cientos de repartos de lo que no sabes y se cuenta en
// cuántos aparece la carta.
//
// «Lo que no sabes» es exactamente lo de la tabla de probabilidades
// (contextoDeProbabilidad): el orden del mazo y qué hay en los premios boca
// abajo, salvo lo que ya viste (las de arriba que miraste, las que sabes
// que están dentro). Cada reparto es uno de los que encajan con eso, todos
// igual de probables. El motor sabe el orden de verdad, pero usarlo sería
// hacer trampa: el camino bueno es el bueno sin saber lo que viene.
//
// Las elecciones las hace un `ui` que juega A FAVOR de la carta: al buscar
// coge la carta (o una que la trae: Dawn, si la carta es un Pokémon), al
// descartar suelta lo que no hace falta. Y los mismos repartos para todos los caminos
// (números aleatorios comunes): así la diferencia entre dos caminos es la
// de los caminos y no la del azar.
//
// Un paso que no se puede dar en un reparto (no tienes la carta: no la
// robaste) se SALTA, y en cuanto la carta aparece se para: es lo que haría
// cualquiera. Por eso «Investigación → Ultra Ball» quiere decir «juega
// Investigación y, si robas una Ultra Ball, juégala».
//
// Sin DOM: se prueba en Node con el motor de verdad.
import { esPokemon, esEntrenador, esPartidario, esHerramienta, esBasicoEnJuego, esEvolucion, evolucionaDe, claveDeEfecto, probabilidadDeGrupo, NoSePuede } from './partida.js'
import { nombreVisible } from './nucleo.js'

// ── El azar propio (mulberry32): repetible con la misma semilla ──
function azarDe(semilla) {
  let t = semilla >>> 0
  return () => {
    t = (t + 0x6d2b79f5) >>> 0
    let x = Math.imul(t ^ (t >>> 15), t | 1)
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61)
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
}
function barajar(lista, azar) {
  for (let i = lista.length - 1; i > 0; i--) {
    const j = Math.floor(azar() * (i + 1))
    ;[lista[i], lista[j]] = [lista[j], lista[i]]
  }
  return lista
}

// ── Un reparto de lo que no sabes ──
//
// Las cartas sin identificar del medio del mazo y los premios boca abajo
// son UNA bolsa: se barajan juntas y se vuelven a repartir en los mismos
// huecos. Lo que sabes que está en el mazo se queda en el mazo (en un
// sitio cualquiera del medio); lo de arriba y lo de abajo, donde está.
//
// `fijar` (tanda 623): { objetivo(uid), u } pone la primera copia de la carta
// buscada en el sitio que le toca al cuantil `u` (ver `colocarEnSuEstrato`).
export function repartoDeLoQueNoSabes(s0, azar, fijar = null) {
  // Si colocarla obliga a mandar a un premio una carta que sabes que está en
  // el mazo, ese reparto no vale y se saca otro (pasa muy pocas veces).
  for (let intento = 0; fijar && intento < 12; intento++) {
    const s = repartir(s0, azar)
    if (colocarEnSuEstrato(s, fijar)) return s
  }
  return repartir(s0, azar)
}

function repartir(s0, azar) {
  const s = structuredClone(s0)
  s.registro = []
  const k = s.conocimiento
  const D = s.mazo.length
  const t = Math.min(k.arriba, D)
  const b = Math.min(k.abajo, D - t)
  const medio = s.mazo.slice(t, D - b)
  const conf = medio.filter((u) => k.confirmados[u])
  const sinConf = medio.filter((u) => !k.confirmados[u])
  const huecosPremio = s.premios.map((u, i) => (s.premiosVistos[u] ? -1 : i)).filter((i) => i >= 0)
  const bolsa = barajar([...sinConf, ...huecosPremio.map((i) => s.premios[i])], azar)
  huecosPremio.forEach((i, j) => (s.premios[i] = bolsa[sinConf.length + j]))
  const nuevoMedio = barajar([...conf, ...bolsa.slice(0, sinConf.length)], azar)
  s.mazo = [...s.mazo.slice(0, t), ...nuevoMedio, ...s.mazo.slice(D - b)]
  // Y el azar del propio motor (lo que baraja un efecto), distinto en cada
  // reparto.
  s.semilla = Math.floor(azar() * 4294967296) >>> 0
  return s
}

// ── Dónde cae la carta buscada: por estratos (tanda 623) ──
//
// PINGU, con un enlace: «Run Away Draw de Dudunsparce, 11 %» cuando robar 3
// de un mazo de 40 con UNA que buscas es un 7,5. El motor lo hacía bien
// —roba tres, baraja a Dudunsparce con el mazo, que crece—; lo que fallaba
// es la cuenta: con 400 repartos al azar, en cuántos cae la carta arriba
// baila ±3 puntos, y con la semilla fija bailaba SIEMPRE hacia el mismo
// lado en esa mesa. Y el orden de dos pasos (¿Kadabra antes o después de
// Dudunsparce?) se decidía por ese baile.
//
// Lo que más pesa es DÓNDE está la carta, así que eso no se deja al azar:
// en el reparto i, la primera copia va al sitio del cuantil u_i, y los u_i
// cubren [0, 1) a partes iguales (uno por estrato, en orden barajado). Con
// una copia y un mazo sin barajar en medio, la cuenta sale EXACTA (3/40, no
// «entre 4 y 11»). Su sitio sigue su reparto de verdad: si sabes que está
// en el mazo (la viste al buscar), un hueco del medio del mazo; si no, un
// premio boca abajo con su probabilidad y, si no, el mazo. Las demás
// cartas, como salieron.
function colocarEnSuEstrato(s, { objetivo, u }) {
  const k = s.conocimiento
  const D = s.mazo.length
  const t = Math.min(k.arriba, D)
  const b = Math.min(k.abajo, D - t)
  const medio = []
  for (let i = t; i < D - b; i++) medio.push(i)
  const huecosPremio = s.premios.map((x, i) => (s.premiosVistos[x] ? -1 : i)).filter((i) => i >= 0)
  // La primera copia cuyo sitio no se sabe (por uid: la misma en todos los
  // repartos).
  const copias = [...medio.map((i) => s.mazo[i]), ...huecosPremio.map((i) => s.premios[i])].filter(objetivo).sort()
  if (!copias.length || !medio.length) return true
  const c1 = copias[0]
  const Dm = medio.length
  const Ph = huecosPremio.length
  const S = medio.filter((i) => !k.confirmados[s.mazo[i]]).length
  const enUno = (x, n) => Math.min(n - 1, Math.floor(x * n))
  let destino
  if (k.confirmados[c1] || !Ph) destino = ['mazo', medio[enUno(u, Dm)]]
  else {
    // Una que no sabes dónde está: en cada premio boca abajo con 1/(S+Ph),
    // y en el mazo con lo que queda, en cualquier hueco del medio.
    const pPremio = Ph / (S + Ph)
    destino = u < pPremio ? ['premio', huecosPremio[enUno(u / pPremio, Ph)]] : ['mazo', medio[enUno((u - pPremio) / (1 - pPremio), Dm)]]
  }
  const zona = (z) => (z === 'mazo' ? s.mazo : s.premios)
  const ahora = s.mazo.includes(c1) ? ['mazo', s.mazo.indexOf(c1)] : ['premio', s.premios.indexOf(c1)]
  const otra = zona(destino[0])[destino[1]]
  if (otra === c1) return true
  // La que estaba ahí va a donde estaba la buscada: si sabes que está en el
  // mazo, no puede acabar en un premio.
  if (ahora[0] === 'premio' && k.confirmados[otra]) return false
  zona(destino[0])[destino[1]] = c1
  zona(ahora[0])[ahora[1]] = otra
  return true
}

// ── Lo que se puede hacer ahora ──
//
// Jugar un entrenador de la mano (los que tienen efecto: una herramienta se
// une, no busca), bajar un Pokémon que hace algo al bajarlo, evolucionar a
// uno que hace algo al evolucionar, y las habilidades que se usan con un
// botón. Por NOMBRE, no por copia: el paso «Ultra Ball» vale con cualquier
// Ultra Ball que tengas en ese momento, también una que acabas de robar.
export function accionesDisponibles(p) {
  const out = new Map()
  if (p.s.fase !== 'turno') return []
  const poner = (key, a) => {
    if (!out.has(key)) out.set(key, { key, ...a })
  }
  for (const u of p.s.mano) {
    const c = p.carta(u)
    const clave = claveDeEfecto(c)
    if (esEntrenador(c)) {
      if (esHerramienta(c)) continue
      const ef = p.efectoDe(c)
      if (!ef?.usar && !ef?.alPoner) continue
      if (p.motivoNoJugar(u)) continue
      poner(`c:${clave}`, { tipo: 'carta', clave, nombre: nombreVisible(c), partidario: esPartidario(c) })
    } else if (esPokemon(c)) {
      const def = p.efectos?.habilidades?.[clave]
      if (!def) continue
      if (def.cuando === 'bajar' && esBasicoEnJuego(c) && p.huecosBanca > 0) {
        poner(`b:${clave}`, { tipo: 'banca', clave, nombre: nombreVisible(c), habilidad: def.nombre })
      } else if (seBajaYSeUsa(c, def) && p.huecosBanca > 0) {
        // Un básico cuya habilidad va con su botón (Fezandipiti ex, Ogerpon
        // ex, Fan Rotom…): en la mano no hace nada, en la banca sí (tanda
        // 630). Es UN paso —bajarlo y usarla—, que bajarlo solo no es camino.
        poner(`b:${clave}`, { tipo: 'banca', usa: true, clave, nombre: nombreVisible(c), habilidad: def.nombre })
      } else if (esEvolucion(c) && p.enJuego.some((sl) => evolucionaDe(c, p.cartaDe(sl)) && !p.motivoNoEvolucionar(u, sl))) {
        poner(`e:${clave}`, { tipo: 'evolucion', clave, nombre: nombreVisible(c), habilidad: def.nombre })
      }
    }
  }
  for (const sl of p.enJuego) {
    const def = p.habilidadDe(sl)
    if (!def || def.cuando || def.pasiva) continue
    if (p.motivoNoHabilidad(sl)) continue
    const c = p.cartaDe(sl)
    poner(`h:${claveDeEfecto(c)}`, { tipo: 'habilidad', clave: claveDeEfecto(c), nombre: nombreVisible(c), habilidad: def.nombre })
  }
  return [...out.values()]
}

// Una habilidad que se usa con su botón: ni la que salta sola al bajar o al
// evolucionar, ni una pasiva.
const conBoton = (def) => !!def && !def.cuando && !def.pasiva
// Un básico que se baja para usar su habilidad (tanda 630). Las de «solo en
// el puesto activo» no: bajarlo a la banca no la deja usar.
const seBajaYSeUsa = (c, def) => conBoton(def) && esBasicoEnJuego(c) && !def.soloActivo

// Hacer la acción en el estado que tenga `p` ahora. false si no se puede.
async function hacer(p, accion, ui) {
  const conClave = (u) => claveDeEfecto(p.carta(u)) === accion.clave
  try {
    if (accion.tipo === 'carta') {
      const u = p.s.mano.find((x) => conClave(x) && !p.motivoNoJugar(x))
      if (!u) return false
      await p.jugarEntrenador(u, ui)
    } else if (accion.tipo === 'banca') {
      const u = p.s.mano.find(conClave)
      if (!u || p.huecosBanca <= 0) return false
      await p.bajarABanca(u, ui)
      if (accion.usa) {
        // Si la habilidad no se puede usar (Fezandipiti sin un KO en el
        // turno del rival), `usarHabilidad` lo dice (NoSePuede) y el paso no
        // se ha dado: bajarlo no trae nada, y quien llama se queda con el
        // estado de antes.
        const sl = p.enJuego.find((x) => x.cartas.includes(u))
        if (!sl) return false
        await p.usarHabilidad(sl, ui)
      }
    } else if (accion.tipo === 'evolucion') {
      const u = p.s.mano.find(conClave)
      const sl = u && p.enJuego.find((x) => evolucionaDe(p.carta(u), p.cartaDe(x)) && !p.motivoNoEvolucionar(u, x))
      if (!sl) return false
      await p.evolucionar(u, sl, ui)
    } else {
      const sl = p.enJuego.find((x) => claveDeEfecto(p.cartaDe(x)) === accion.clave && p.habilidadDe(x) && !p.motivoNoHabilidad(x))
      if (!sl) return false
      await p.usarHabilidad(sl, ui)
    }
    return true
  } catch (err) {
    if (err?.noSePuede || err?.cancelado) return false
    throw err
  }
}

// ── El `ui` que juega a favor de la carta ──
//
// `objetivo(carta)`: la que buscas. `puentes`: clave → cuánto vale como
// paso intermedio (entre 1 y 2 si trae la carta, según lo a menudo que la
// trae; hasta 1 si trae una de las que la traen), para que Pokégear coja a
// Dawn —que la trae casi siempre— antes que a Lillie. Al soltar cartas (un
// coste de la mano), suelta primero lo que menos vale.
//
// Y ADELGAZA el mazo (tanda 630). PINGU: «puede que te quites cartas del
// mazo». Una búsqueda que deja coger más de lo que hace falta —un Poffin con
// dos huecos, una Ultra Ball sin nada que valga— coge lo que pueda: cada
// carta que sale del mazo hace más fácil robar la buscada después. Coger
// nunca la aleja, con dos excepciones que se miran: a la BANCA se deja un
// hueco libre (para bajar un Fezandipiti luego), y a la MANO no se coge nada
// si hay a tiro una carta que roba HASTA tener N (Ariana, Surfista,
// Kilowattrel de Iris): ahí cada carta de más en la mano es una menos que
// robas. `ui.adelgazadas` cuenta lo cogido de más, para decirlo en el paso.
function uiAFavor(objetivo, puentes, p0, { adelgazarAMano = true } = {}) {
  const vale = (p, u) => (objetivo(p.carta(u)) ? 3 : puentes.get(claveDeEfecto(p.carta(u))) || 0)
  // Hasta cuántas se cogen, adelgazando. Solo cuando quien busca dice adónde
  // van (`destino`): sin eso no se sabe si coger de más ayuda.
  const tope = (p, o, ya) => {
    if (ui.sinAdelgazar || o.zona !== 'mazo' || !o.destino) return ya
    if (o.destino === 'banca') return Math.max(ya, Math.min(o.max, p.huecosBanca - 1))
    if (o.destino === 'mano' && !adelgazarAMano) return ya
    return o.max
  }
  const ui = {
    adelgazadas: 0,
    sinAdelgazar: false,
    async cartas(o) {
      const p = o.partida || p0()
      const elegibles = o.elegibles || o.opciones
      const sel = []
      const cabe = (u) => !o.validar || !o.validar([...sel, u])
      if (o.zona === 'mano') {
        // Un coste: lo justo, y empezando por lo que menos falta.
        const orden = [...elegibles].sort((a, b) => vale(p, a) - vale(p, b))
        for (const u of orden) if (sel.length < o.min && cabe(u)) sel.push(u)
        return sel
      }
      // Coger: la carta primero, luego lo que hace falta, y solo lo que
      // se pida de más si es obligatorio.
      const orden = [...elegibles].sort((a, b) => vale(p, b) - vale(p, a))
      for (const u of orden) {
        if (sel.length >= o.max) break
        if (vale(p, u) > 0 && cabe(u)) sel.push(u)
      }
      for (const u of orden) if (sel.length < o.min && !sel.includes(u) && cabe(u)) sel.push(u)
      const hasta = Math.min(o.max, tope(p, o, sel.length))
      for (const u of orden) {
        if (sel.length >= hasta) break
        if (sel.includes(u) || !cabe(u)) continue
        sel.push(u)
        ui.adelgazadas++
      }
      return sel.slice(0, o.max)
    },
    async pokemon(o) {
      return o.opciones.slice(0, Math.max(o.min || 0, Math.min(o.max || 1, 1)))
    },
    async confirmar() {
      return true
    },
    async opcion(o) {
      return (o.opciones.find((x) => !x.no) || o.opciones[0]).id
    },
    async numero(o) {
      return o.max ?? o.valor
    },
    async repartir(o) {
      return { [o.opciones[0]]: o.total }
    },
    async premios(o) {
      return (o.partida || p0()).s.premios.slice(0, o.n)
    },
  }
  return ui
}

// Cuántas hay de la carta en la mano y en juego (lo que ya tienes).
function cuantasTienes(p, objetivo) {
  const enMano = p.s.mano.filter((u) => objetivo(p.carta(u))).length
  const enJuego = p.enJuego.reduce((k, sl) => k + sl.cartas.filter((u) => objetivo(p.carta(u))).length, 0)
  return enMano + enJuego
}

// ── Las fotos: con mesa, una jugada toca a los dos y a la mesa ──
const fotoDe = (p) => ({ s: p.s, op: p.oponente?.s ?? null, m: p.mesa?.m ?? null })
function ponerFoto(p, f, { copiar = true } = {}) {
  p.s = copiar ? structuredClone(f.s) : f.s
  if (p.oponente && f.op) p.oponente.s = copiar ? structuredClone(f.op) : f.op
  if (p.mesa && f.m) p.mesa.m = copiar ? structuredClone(f.m) : f.m
}

// ── Buscar los caminos ──
//
// En anchura y con poda: primero cada acción suelta; después, a los
// `anchura` mejores se les añade cada acción que quede, y así hasta
// `profundidad` pasos. Un paso que no sube la probabilidad no se enseña
// (alargar el camino sin ganar nada no es un camino mejor), pero se sigue
// mirando si ABRE algo nuevo: Caramelo Raro no encuentra nada por sí solo,
// y es lo que pone a Pidgeot ex en juego para usar su habilidad.
//
// `ceder()`: se llama entre tandas para no congelar la página; durante la
// tanda el estado de verdad está cambiado, así que NO puede haber nada más
// tocando la partida mientras tanto (quien llama tiene la ventana delante).
export async function buscarCaminos(opciones) {
  // Mientras se buscan, la partida baraja «por estratos» (ver abajo): se le
  // pone un `barajar` propio y se le quita al acabar, pase lo que pase.
  const p = opciones.partida
  const propio = Object.getOwnPropertyDescriptor(p, 'barajar')
  try {
    return await buscar(opciones)
  } finally {
    if (propio) Object.defineProperty(p, 'barajar', propio)
    else delete p.barajar
  }
}

async function buscar({ partida: p, objetivo, muestras = 300, profundidad = 4, anchura = 6, preparar = 3, semilla = 0x5eed, alProgresar = null, ceder = null }) {
  const real = fotoDe(p)
  const inicial = cuantasTienes(p, objetivo)
  const robo = probabilidadDeGrupo(p, objetivo, 1)
  const resumen = { muestras, quedan: robo.quedan, siguienteRobo: robo.siguiente, todasPremiadas: robo.todasPremiadas }
  if (inicial > 0 && p.s.mano.some((u) => objetivo(p.carta(u)))) return { ...resumen, yaLaTienes: true, caminos: [] }
  if (robo.quedan === 0) return { ...resumen, noQueda: true, caminos: [] }

  // Los repartos, los mismos para todos los caminos. Dónde cae la carta, por
  // estratos (ver `colocarEnSuEstrato`): uno por cada trozo de [0, 1), en
  // orden barajado para que los primeros (los de probar puentes) no sean
  // todos de arriba del mazo.
  const azar = azarDe(semilla)
  const raices = []
  const mRaiz = p.mesa ? { ...structuredClone({ ...p.mesa.m, registro: [], diario: [] }) } : null
  const estratos = barajar([...Array(muestras).keys()], azar)
  const esLaCarta = (u) => objetivo(p.carta(u))
  for (let i = 0; i < muestras; i++) {
    const s = repartoDeLoQueNoSabes(real.s, azar, { objetivo: esLaCarta, u: (estratos[i] + azar()) / muestras })
    s.repartoDeCaminos = i
    raices.push({ s, op: real.op, m: mRaiz })
  }

  // ── Y después de barajar, también por estratos (tanda 630) ──
  //
  // Hasta aquí, lo de después de barajar (un Poffin, una Ultra Ball,
  // Dudunsparce que vuelve) era una muestra: ±2 puntos con 400 repartos. Y
  // eso tapaba justo lo que PINGU pedía ver: sacar dos cartas con un Poffin
  // antes de un Lillie's Determination es pasar de 8/23 a 8/21 —dos puntos—,
  // y dos puntos de baile no dejan ver dos puntos de ganancia. Ahora, al
  // barajar, la primera copia de la buscada va al sitio del estrato que le
  // toca a ESE reparto en ESA barajada (la k-ésima del camino): cada
  // barajada reparte los estratos de nuevo, a partes iguales. Es el mismo
  // reparto de antes —tras barajar, la carta está en cualquier sitio con la
  // misma probabilidad, y las demás también—, solo que contado en vez de
  // sorteado. Y empareja: con y sin adelgazar, la k-ésima barajada de un
  // reparto pone la carta en el mismo trozo del mazo.
  const azarTras = azarDe((semilla ^ 0x9e3779b9) >>> 0)
  const tras = []
  const estratoTras = (k, i) => {
    while (tras.length <= k) tras.push(barajar([...Array(muestras).keys()], azarTras))
    return tras[k][i]
  }
  const barajarDeVerdad = Object.getPrototypeOf(p).barajar
  p.barajar = function () {
    barajarDeVerdad.call(this)
    const s = this.s
    if (s.repartoDeCaminos == null) return
    const k = s.barajadasDeCaminos || 0
    s.barajadasDeCaminos = k + 1
    const c1 = s.mazo.filter(esLaCarta).sort()[0]
    if (!c1) return
    const D = s.mazo.length
    const destino = Math.min(D - 1, Math.floor(((estratoTras(k, s.repartoDeCaminos) + 0.5) / muestras) * D))
    const ahora = s.mazo.indexOf(c1)
    ;[s.mazo[ahora], s.mazo[destino]] = [s.mazo[destino], s.mazo[ahora]]
  }

  // ¿Hay a tiro una carta que roba HASTA tener N en la mano (tanda 630)? Con
  // ella, lo que vacía la mano también prepara (jugar una Ultra Ball antes que
  // Ariana es robar tres más) y lo que la llena estorba (ver `uiAFavor`). Se
  // mira en la mano, en juego y en el mazo —la del mazo puede llegar con un
  // Pokégear—; la del descarte, no.
  const aTiro = [...p.s.mano, ...p.s.mazo, ...p.enJuego.flatMap((sl) => sl.cartas)]
  const roboSegunMano = aTiro.some((u) => {
    const c = p.carta(u)
    return Boolean(esEntrenador(c) ? p.efectoDe(c)?.robaSegunMano : p.efectos?.habilidades?.[claveDeEfecto(c)]?.robaSegunMano)
  })
  const puentes = new Map()
  const ui = uiAFavor(objetivo, puentes, () => p, { adelgazarAMano: !roboSegunMano })

  // ── Los puentes ──
  //
  // Una carta que no tienes en la mano puede ser el paso intermedio: Dawn
  // trae la carta, y Pokégear trae a Dawn. Para saber cuáles, cada carta
  // del mazo que hace algo se prueba PUESTA en la mano, en unos pocos
  // repartos: primero las que traen la carta y luego las que traen una de
  // esas. Sin esto, al buscar con Pokégear no se cogería nada que no fuera
  // la propia carta.
  // Los repartos de probar puentes: los que caen a partes iguales en los
  // estratos (tanda 630). Con los 24 primeros, que caen donde caen, un puente
  // que roba 2 de 39 no acertaba NINGUNA vez en uno de cada cuatro mazos —y
  // no siendo puente, la Ultra Ball no sabía que coger a Kadabra servía—.
  // Repartidos, el que roba arriba acierta en los que tocan, siempre.
  const PROBAR = Math.min(32, muestras)
  const porEstrato = [...raices.keys()].sort((a, b) => estratos[a] - estratos[b])
  const tandaDePrueba = Array.from({ length: PROBAR }, (_, k) => raices[porEstrato[Math.floor(((k + 0.5) * muestras) / PROBAR)]])

  async function probarPuentes(trae, valor) {
    const vistas = new Set()
    const nuevas = []
    const tanda = tandaDePrueba
    try {
      for (const u of p.uidsPropios) {
        const c = p.carta(u)
        const clave = claveDeEfecto(c)
        if (vistas.has(clave) || puentes.has(clave)) continue
        vistas.add(clave)
        const def = esPokemon(c) ? p.efectos?.habilidades?.[clave] : null
        // Una evolución con habilidad (Drakloak, Kadabra…) también es un
        // puente: Ultra Ball la trae, evoluciona y la usas —o salta sola al
        // evolucionar, como Kadabra, que eso se dejaba fuera hasta la 630—.
        // Sin esto la búsqueda no sabía que coger a Drakloak servía de algo.
        const evoluciona = !!def && esEvolucion(c) && (conBoton(def) || def.cuando === 'evolucionar')
        // Y un básico que se baja para usar su habilidad (tanda 630): Nest
        // Ball trae a Fezandipiti, lo bajas y robas tres.
        const bajaYUsa = !!def && seBajaYSeUsa(c, def)
        const util = esEntrenador(c) ? !esHerramienta(c) && (p.efectoDe(c)?.usar || p.efectoDe(c)?.alPoner) : (def?.cuando === 'bajar' && esBasicoEnJuego(c)) || evoluciona || bajaYUsa
        if (!util) continue
        let sirve = 0
        for (const st of tanda) {
          ponerFoto(p, st)
          // Una copia suya a la mano, sacada del mazo (si no queda ninguna
          // fuera de la mano, ya se probará si la tienes).
          const copia = p.s.mazo.find((x) => claveDeEfecto(p.carta(x)) === clave)
          if (!copia) continue
          p.sacarDelMazo(copia)
          p.s.mano.push(copia)
          const antes = cuantasTienes(p, trae) - (trae(c) ? 1 : 0)
          const accion = { tipo: esEntrenador(c) ? 'carta' : evoluciona ? 'evolucion' : 'banca', clave, usa: bajaYUsa }
          const dado = (await hacer(p, accion, ui)) && (!(evoluciona && conBoton(def)) || (await hacer(p, { tipo: 'habilidad', clave }, ui)))
          if (dado && cuantasTienes(p, trae) > antes) sirve++
        }
        if (sirve) nuevas.push([clave, sirve / tanda.length])
      }
    } finally {
      ponerFoto(p, real, { copiar: false })
    }
    for (const [k, tasa] of nuevas) puentes.set(k, valor + tasa)
    return nuevas
  }
  const directas = await probarPuentes(objetivo, 1)
  if (directas.length) await probarPuentes((c) => (puentes.get(claveDeEfecto(c)) || 0) > 1, 0)

  // Un nodo: los pasos, y por cada reparto el estado al que llevan (o
  // `null` si la carta ya apareció) y si cada paso se pudo dar.
  const raiz = { pasos: [], estados: raices, encontradas: 0, dados: [], adelgazan: [] }
  const todos = []
  // Todos los nodos jugados, por su secuencia de pasos: para comparar un
  // camino con los mismos pasos en otro orden sin volver a jugarlo.
  const jugados = new Map()
  const claveDe = (pasos) => pasos.map((a) => a.key).join('>')
  // Y los jugados sin adelgazar (`adelgazarCuenta`): muchos caminos empiezan
  // igual.
  const sinAdelgazar = new Map()
  let hechos = 0
  const total = () => hechos

  // `adelgazar: false` juega el paso cogiendo solo lo que hace falta (para
  // ver si adelgazar cambia algo: `adelgazarCuenta`).
  async function extender(nodo, accion, { adelgazar = true } = {}) {
    const estados = []
    let encontradas = 0
    let pudo = 0
    let intentos = 0
    // En cuántos repartos el paso ha MOVIDO el mazo (barajarlo, mandar una
    // abajo, sacar cartas): lo que hace que un paso que no trae nada sí
    // cambie lo que trae el siguiente. Y con una carta que roba hasta tener
    // N a tiro, también lo que VACÍA la mano (tanda 630).
    let mueve = 0
    // En cuántos ha cogido de más para adelgazar el mazo (ver `uiAFavor`).
    let adelgaza = 0
    try {
      for (let i = 0; i < nodo.estados.length; i++) {
        const st = nodo.estados[i]
        if (st === null) {
          estados.push(null)
          encontradas++
          continue
        }
        intentos++
        ponerFoto(p, st)
        const mazoAntes = p.s.mazo.join()
        const manoAntes = p.s.mano.length
        ui.adelgazadas = 0
        ui.sinAdelgazar = !adelgazar
        const dado = await hacer(p, accion, ui).finally(() => (ui.sinAdelgazar = false))
        hechos++
        if (dado) pudo++
        if (dado && (p.s.mazo.join() !== mazoAntes || (roboSegunMano && p.s.mano.length < manoAntes))) mueve++
        if (dado && ui.adelgazadas > 0) adelgaza++
        if (cuantasTienes(p, objetivo) > inicial) {
          estados.push(null)
          encontradas++
        } else estados.push(dado ? fotoDe(p) : st)
        if (ceder && hechos % 40 === 0) {
          ponerFoto(p, real, { copiar: false })
          await ceder()
        }
      }
    } finally {
      ponerFoto(p, real, { copiar: false })
    }
    return { pasos: [...nodo.pasos, accion], estados, encontradas, dados: [...nodo.dados, intentos ? pudo / intentos : 0], adelgazan: [...nodo.adelgazan, pudo ? adelgaza / pudo : 0], mueve: intentos ? mueve / intentos : 0, padre: nodo }
  }

  // Lo que se puede hacer después de un nodo: lo que esté disponible en
  // ALGUNO de sus repartos (en otros quizá no, y el paso se salta).
  function siguientes(nodo) {
    const vistas = new Map()
    let mirados = 0
    try {
      for (const st of nodo.estados) {
        if (st === null) continue
        ponerFoto(p, st, { copiar: false })
        for (const a of accionesDisponibles(p)) if (!vistas.has(a.key)) vistas.set(a.key, a)
        if (++mirados >= 60) break
      }
    } finally {
      ponerFoto(p, real, { copiar: false })
    }
    return [...vistas.values()]
  }

  let frontera = [raiz]
  for (let nivel = 1; nivel <= profundidad && frontera.length; nivel++) {
    const hijos = []
    for (const nodo of frontera) {
      const posibles = siguientes(nodo)
      const antes = new Set(posibles.map((a) => a.key))
      for (const accion of posibles) {
        // Dos partidarios en un camino no se juegan los dos: el segundo
        // sería «o este otro», y eso no es un camino sino dos.
        if (p.s.estricta && accion.partidario && nodo.pasos.some((x) => x.partidario)) continue
        const hijo = await extender(nodo, accion)
        jugados.set(claveDe(hijo.pasos), hijo)
        const pPadre = nodo.encontradas / muestras
        hijo.p = hijo.encontradas / muestras
        hijo.gana = hijo.p - pPadre
        // ¿Abre algo que antes no había? (una habilidad nueva en juego)
        hijo.abre = hijo.gana <= 0.005 && nivel < profundidad && siguientes(hijo).some((a) => !antes.has(a.key))
        hijos.push(hijo)
        alProgresar?.({ nivel, caminos: todos.length + hijos.length })
      }
    }
    for (const h of hijos) if (h.gana > 0.005) todos.push(h)
    const ganan = hijos
      .filter((h) => h.gana > 0.005 || h.abre)
      .sort((a, b) => b.p - a.p)
      .slice(0, anchura)
    // Los pasos que PREPARAN (tanda 595). No traen la carta, así que antes
    // se tiraban, y con ellos los caminos en los que sí cuentan: barajar
    // con un Poffin un mazo cuyas dos de arriba ya sabes que no son, y LUEGO
    // mirar las dos de arriba con Drakloak. Pasan unos pocos al nivel
    // siguiente: los que mueven el mazo en la mayoría de los repartos (un
    // Martillo o un estadio no cambian lo que viene, y ocuparían el sitio).
    // Si después nada gana, no se enseñan.
    const preparan = hijos.filter((h) => !ganan.includes(h) && h.mueve > 0.5).slice(0, preparar)
    frontera = [...ganan, ...preparan]
  }

  // Los mismos pasos en otro orden: se queda el mejor orden.
  const porConjunto = new Map()
  for (const c of todos) {
    const k = c.pasos.map((a) => a.key).sort().join('|')
    const ya = porConjunto.get(k)
    if (!ya || c.p > ya.p || (c.p === ya.p && c.pasos.length < ya.pasos.length)) porConjunto.set(k, c)
  }
  const ordenados = [...porConjunto.values()].sort((a, b) => b.p - a.p || a.pasos.length - b.pasos.length)
  // Uno más CORTO que llega igual o mejor: este no es la mejor opción para
  // nadie, aunque sea un camino posible. Salvo que el corto gaste el
  // partidario y este no (tanda 623): con Dawn al 100 %, «Kadabra →
  // Dudunsparce» sin gastarlo es lo que quiere quien guarda el partidario
  // para un Jefes, y se escondía.
  const usaPartidario = (c) => c.pasos.some((a) => a.partidario)
  const dominado = (c) => ordenados.some((q) => q !== c && q.pasos.length < c.pasos.length && q.p >= c.p - 0.005 && (!usaPartidario(q) || usaPartidario(c)))
  const mejor = ordenados.find((c) => !dominado(c))
  const ordenDaIgual = mejor ? await ordenDaIgualEn(mejor) : null
  // Los que adelgazan: ¿cambia algo? (tanda 630). Adelgazar en el ÚLTIMO
  // paso no cambia nada (la buscada se coge la primera, y detrás no queda
  // nada que robe), así que eso ni se mira. De los demás, los ocho primeros
  // —antes los que no tienen uno más corto delante—; en el resto no se dice,
  // que sin mirarlo no se sabe.
  for (const c of ordenados) c.adelgazan = c.adelgazan.map((a, i) => (i < c.pasos.length - 1 ? a : 0))
  const adelgazan = ordenados.filter((x) => x.adelgazan.some((a) => a > 0.5)).sort((a, b) => dominado(a) - dominado(b))
  for (const [i, c] of adelgazan.entries()) {
    if (i >= 8 || !(await adelgazarCuenta(c))) c.adelgazan = c.adelgazan.map(() => 0)
  }
  const caminos = ordenados.map((c) => ({
    p: c.p,
    dominado: dominado(c),
    // Solo del primero: si cambiar el orden de sus pasos no cambia nada que
    // se pueda distinguir del azar, «en este orden» sería mentira.
    ordenDaIgual: c === mejor ? ordenDaIgual : null,
    // `adelgaza`: en la mayoría de las veces que se da, coge de más para
    // sacar cartas del mazo, y eso hay que decirlo: quien lo juegue cogiendo
    // solo lo que busca no llega a la cifra.
    pasos: c.pasos.map((a, i) => ({ tipo: a.tipo, clave: a.clave, nombre: a.nombre, habilidad: a.habilidad || null, usa: Boolean(a.usa), partidario: Boolean(a.partidario), siempre: c.dados[i] > 0.995, cuando: c.dados[i], adelgaza: c.adelgazan[i] > 0.5 })),
  }))
  return { ...resumen, caminos, simulados: total(), puentes: Object.fromEntries(puentes) }

  // ── ¿Cuenta adelgazar? (tanda 630) ──
  //
  // Coger de más antes de un Lillie's Determination no cambia nada (la mano
  // vuelve al mazo); antes de un Poffin a la banca y luego robar, sí. Decir
  // «cogiendo todas las que deje» donde no cuenta sería mandar a hacer algo
  // que no sirve: el camino se juega otra vez cogiendo solo lo que hace falta
  // y se compara reparto a reparto, con la misma regla que el orden.
  async function adelgazarCuenta(c) {
    let nodo = raiz
    for (const [i, a] of c.pasos.entries()) {
      const k = claveDe(c.pasos.slice(0, i + 1))
      if (!sinAdelgazar.has(k)) sinAdelgazar.set(k, await extender(nodo, a, { adelgazar: false }))
      nodo = sinAdelgazar.get(k)
    }
    return ganaDeVerdad(c, nodo)
  }

  // ¿`a` encuentra la carta en más repartos que `b`, más de lo que da el
  // azar? La prueba de McNemar: solo cuentan los repartos en los que uno la
  // encuentra y el otro no, y tiene que pasar de un punto y de dos
  // desviaciones de la diferencia emparejada.
  function ganaDeVerdad(a, b) {
    let solo1 = 0
    let solo2 = 0
    a.estados.forEach((x, i) => {
      if (x === null && b.estados[i] !== null) solo1++
      if (x !== null && b.estados[i] === null) solo2++
    })
    return solo1 - solo2 > Math.max(muestras * 0.01, 2 * Math.sqrt(solo1 + solo2))
  }

  // ── ¿Importa el orden? (tanda 623) ──
  //
  // PINGU: «¿qué tienes que hacer primero?». A veces mucho (barajar con un
  // Poffin y DESPUÉS mirar con Drakloak), y a veces nada: Kadabra (roba 2)
  // y Dudunsparce (roba 3 y se baraja con el mazo, que crece) dan 12,5 % o
  // 12,2 % según el orden. Se juegan los otros órdenes con los MISMOS
  // repartos y se comparan reparto a reparto (la prueba de McNemar: solo
  // cuentan los repartos en los que un orden la encuentra y el otro no). Si
  // la diferencia no pasa de un punto o se explica por el azar con TODOS
  // los otros órdenes, el orden da igual. Hasta tres pasos: con cuatro
  // serían 24 órdenes que jugar.
  async function ordenDaIgualEn(c) {
    const n = c.pasos.length
    if (n < 2 || n > 3) return null
    for (const orden of permutaciones(c.pasos)) {
      if (claveDe(orden) === claveDe(c.pasos)) continue
      if (p.s.estricta && orden.filter((a) => a.partidario).length > 1) continue
      let nodo = jugados.get(claveDe(orden))
      if (!nodo) {
        nodo = raiz
        for (const a of orden) {
          nodo = await extender(nodo, a)
          jugados.set(claveDe(nodo.pasos), nodo)
        }
      }
      // Este orden gana a ese de verdad (`ganaDeVerdad`). Con tres pasos
      // puede dar igual cambiar dos y no el tercero: si ALGÚN otro orden
      // pierde de verdad, el orden importa.
      if (ganaDeVerdad(c, nodo)) return false
    }
    return true
  }
}

// Los órdenes distintos de unos pasos (con repetidos, sin duplicar).
function permutaciones(pasos) {
  if (pasos.length <= 1) return [pasos]
  const out = []
  const vistos = new Set()
  pasos.forEach((a, i) => {
    if (vistos.has(a.key)) return
    vistos.add(a.key)
    for (const resto of permutaciones([...pasos.slice(0, i), ...pasos.slice(i + 1)])) out.push([a, ...resto])
  })
  return out
}
