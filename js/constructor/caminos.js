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
export function repartoDeLoQueNoSabes(s0, azar) {
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
function uiAFavor(objetivo, puentes, p0) {
  const vale = (p, u) => (objetivo(p.carta(u)) ? 3 : puentes.get(claveDeEfecto(p.carta(u))) || 0)
  return {
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
export async function buscarCaminos({ partida: p, objetivo, muestras = 300, profundidad = 4, anchura = 6, preparar = 3, semilla = 0x5eed, alProgresar = null, ceder = null }) {
  const real = fotoDe(p)
  const inicial = cuantasTienes(p, objetivo)
  const robo = probabilidadDeGrupo(p, objetivo, 1)
  const resumen = { muestras, quedan: robo.quedan, siguienteRobo: robo.siguiente, todasPremiadas: robo.todasPremiadas }
  if (inicial > 0 && p.s.mano.some((u) => objetivo(p.carta(u)))) return { ...resumen, yaLaTienes: true, caminos: [] }
  if (robo.quedan === 0) return { ...resumen, noQueda: true, caminos: [] }

  // Los repartos, los mismos para todos los caminos.
  const azar = azarDe(semilla)
  const raices = []
  const mRaiz = p.mesa ? { ...structuredClone({ ...p.mesa.m, registro: [], diario: [] }) } : null
  for (let i = 0; i < muestras; i++) raices.push({ s: repartoDeLoQueNoSabes(real.s, azar), op: real.op, m: mRaiz })

  const puentes = new Map()
  const ui = uiAFavor(objetivo, puentes, () => p)

  // ── Los puentes ──
  //
  // Una carta que no tienes en la mano puede ser el paso intermedio: Dawn
  // trae la carta, y Pokégear trae a Dawn. Para saber cuáles, cada carta
  // del mazo que hace algo se prueba PUESTA en la mano, en unos pocos
  // repartos: primero las que traen la carta y luego las que traen una de
  // esas. Sin esto, al buscar con Pokégear no se cogería nada que no fuera
  // la propia carta.
  async function probarPuentes(trae, valor) {
    const vistas = new Set()
    const nuevas = []
    const tanda = raices.slice(0, 24)
    try {
      for (const u of p.uidsPropios) {
        const c = p.carta(u)
        const clave = claveDeEfecto(c)
        if (vistas.has(clave) || puentes.has(clave)) continue
        vistas.add(clave)
        const def = esPokemon(c) ? p.efectos?.habilidades?.[clave] : null
        // Una evolución con habilidad de las que se usan (Drakloak, Kadabra…)
        // también es un puente: Ultra Ball la trae, evoluciona y la usas. Sin
        // esto la búsqueda no sabía que coger a Drakloak servía de algo.
        const evoluciona = !!def && esEvolucion(c) && !def.cuando && !def.pasiva
        const util = esEntrenador(c) ? !esHerramienta(c) && (p.efectoDe(c)?.usar || p.efectoDe(c)?.alPoner) : (def?.cuando === 'bajar' && esBasicoEnJuego(c)) || evoluciona
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
          const accion = { tipo: esEntrenador(c) ? 'carta' : evoluciona ? 'evolucion' : 'banca', clave }
          const dado = (await hacer(p, accion, ui)) && (!evoluciona || (await hacer(p, { tipo: 'habilidad', clave }, ui)))
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
  const raiz = { pasos: [], estados: raices, encontradas: 0, dados: [] }
  const todos = []
  let hechos = 0
  const total = () => hechos

  async function extender(nodo, accion) {
    const estados = []
    let encontradas = 0
    let pudo = 0
    let intentos = 0
    // En cuántos repartos el paso ha MOVIDO el mazo (barajarlo, mandar una
    // abajo, sacar cartas): lo que hace que un paso que no trae nada sí
    // cambie lo que trae el siguiente.
    let mueve = 0
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
        const dado = await hacer(p, accion, ui)
        hechos++
        if (dado) pudo++
        if (dado && p.s.mazo.join() !== mazoAntes) mueve++
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
    return { pasos: [...nodo.pasos, accion], estados, encontradas, dados: [...nodo.dados, intentos ? pudo / intentos : 0], mueve: intentos ? mueve / intentos : 0, padre: nodo }
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
  const caminos = ordenados.map((c) => ({
    p: c.p,
    // Uno más CORTO que llega igual o mejor: este no es la mejor opción
    // para nadie, aunque sea un camino posible.
    dominado: ordenados.some((q) => q !== c && q.pasos.length < c.pasos.length && q.p >= c.p - 0.005),
    pasos: c.pasos.map((a, i) => ({ tipo: a.tipo, clave: a.clave, nombre: a.nombre, habilidad: a.habilidad || null, partidario: Boolean(a.partidario), siempre: c.dados[i] > 0.995, cuando: c.dados[i] })),
  }))
  return { ...resumen, caminos, simulados: total(), puentes: Object.fromEntries(puentes) }
}
