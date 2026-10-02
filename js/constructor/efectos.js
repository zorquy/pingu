// Lo que hace cada carta en el laboratorio (tanda 384).
//
// Por el nombre INGLÉS en plano, que es la clave que no cambia entre
// reimpresiones (tanda 335). Los textos salen de las cartas oficiales en
// inglés (Limitless, 2026-09-30) y están traducidos aquí: el espejo NO
// guarda el texto de los entrenadores —TCGdex lo trae en `effect` y
// `detalleDeCarta` nunca lo copió—, así que sin esto la carta se jugaría
// a ciegas.
//
// Qué hay: las ~120 cartas de entrenador y energía que más se juegan en
// los mazos del meta de los últimos 30 días (sacado de `meta_lista_media`
// de los 45 arquetipos con más cuota), las habilidades que buscan, roban
// o mueven cosas, y los ataques de esos Pokémon que hacen algo más que
// daño. Lo que no está se juega igual: va al descarte y se hace a mano
// con las herramientas del laboratorio, que es lo honesto — mejor eso
// que un efecto inventado.
//
// Cada efecto recibe la partida (`p`), el `ui` para elegir y lo que se
// está jugando. Todo lo que elige es asíncrono (ver partida.js).
import {
  esPokemon, esEntrenador, esEnergia, esPartidario, esObjeto, esHerramienta, esEstadio,
  faseDe, esBasicoEnJuego, esEvolucion, tieneRegla, esEx, esMegaEx, esTera, esDeTipo, esDe,
  evolucionaDe, claveDeEfecto, ponerEstado, unidadesDeEnergia, costeEnLetras, limpiarEfectosDeAtaque,
} from './partida.js'
import { esEnergiaBasica, letraDeCartaDeEnergia, nombreVisible, plano } from './nucleo.js'

// ── Filtros de cartas ──
const basicaDe = (letra) => (c) => esEnergiaBasica(c) && letraDeCartaDeEnergia(c) === letra
const basica = (c) => esEnergiaBasica(c)
const pokemonBasico = (c) => esPokemon(c) && esBasicoEnJuego(c)
const pokemonSinRegla = (c) => esPokemon(c) && !tieneRegla(c)
const psHasta = (n) => (c) => (Number(c.hp) || 0) <= n

// ── Piezas comunes ──

const otrasEnMano = (p, ctx) => p.s.mano.filter((u) => u !== ctx?.uid)

// Descartar N de la mano (la carta que se juega ya no está en ella).
async function descartarDeMano(p, ui, n, { titulo, filtro = () => true, min = n } = {}) {
  const opciones = p.s.mano.filter((u) => filtro(p.carta(u)))
  const elegidas = await ui.cartas({ titulo: titulo || `Descarta ${n} ${n === 1 ? 'carta' : 'cartas'} de tu mano`, opciones, min: Math.min(min, opciones.length), max: n, zona: 'mano' })
  p.descartar(elegidas)
  return elegidas
}

// Buscar varias cartas de clases distintas («un Básico, una Fase 1 y una
// Fase 2»): cada carta elegida tiene que poder ocupar un hueco distinto.
function asignable(cartas, requisitos) {
  const usados = new Array(requisitos.length).fill(false)
  const probar = (i) => {
    if (i === cartas.length) return true
    for (let j = 0; j < requisitos.length; j++) {
      if (usados[j] || !requisitos[j](cartas[i])) continue
      usados[j] = true
      if (probar(i + 1)) return true
      usados[j] = false
    }
    return false
  }
  return probar(0)
}

function buscarVarias(p, ui, requisitos, titulo, texto = '') {
  return p.buscarEnMazo(ui, {
    titulo,
    texto,
    filtro: (c) => requisitos.some((r) => r(c)),
    max: requisitos.length,
    validar: (sel) => (asignable(sel.map((u) => p.carta(u)), requisitos) ? null : 'Esa combinación no cabe: una carta de cada clase.'),
  })
}

// Mirar las N de arriba y quedarse con algunas; el resto se baraja.
async function mirarYCoger(p, ui, n, { titulo, filtro = () => true, max = 1, resto = 'barajar' } = {}) {
  const vistas = p.mirarArriba(n)
  const elegibles = vistas.filter((u) => filtro(p.carta(u)))
  const elegidas = await ui.cartas({ titulo, opciones: vistas, elegibles, min: 0, max, zona: 'mazo' })
  for (const u of elegidas) {
    p.sacarDelMazo(u)
    p.s.mano.push(u)
  }
  if (elegidas.length) p.log(`A la mano: ${elegidas.map((u) => p.nombre(u)).join(', ')}.`)
  else p.log('No coges ninguna.')
  const quedan = vistas.filter((u) => !elegidas.includes(u))
  if (resto === 'barajar') p.barajar()
  else if (resto === 'descartar') {
    for (const u of quedan) {
      p.sacarDelMazo(u)
      p.s.descarte.push(u)
    }
    if (quedan.length) p.log(`Al descarte: ${quedan.map((u) => p.nombre(u)).join(', ')}.`)
  }
  return elegidas
}

// Del descarte a la mano, hasta N de las que cumplan.
async function recuperar(p, ui, { titulo, filtro, max, min = 0, destino = 'mano' }) {
  const opciones = p.s.descarte.filter((u) => filtro(p.carta(u)))
  const elegidas = await ui.cartas({ titulo, opciones, min: Math.min(min, opciones.length), max, zona: 'descarte' })
  p.desdeDescarte(elegidas, destino)
  return elegidas
}

const hayEnDescarte = (p, filtro, texto) => p.s.descarte.some((u) => filtro(p.carta(u))) || texto

// Elegir uno de TUS Pokémon (por id de slot).
async function elegirPropio(p, ui, { titulo, filtro = () => true, texto = '' }) {
  const opciones = p.enJuego.filter((s) => filtro(p.cartaDe(s), s)).map((s) => s.id)
  if (!opciones.length) return null
  const [id] = await ui.pokemon({ titulo, texto, opciones, min: 1, max: 1 })
  return p.slot(id)
}

// Elegir un Pokémon de la banca del RIVAL y subirlo (Boss, Captura…).
async function atraerRival(p, ui, titulo = 'Elige el Pokémon de la banca rival que sube al puesto activo') {
  const r = p.rival
  if (!r.banca.length) {
    p.log('El rival no tiene banca: no cambia nada.')
    return false
  }
  const [id] = await ui.pokemon({ titulo, opciones: r.banca.map((d) => d.id), min: 1, max: 1 })
  return p.cambiarActivoRival(r.banca.findIndex((d) => d.id === id))
}

const rivalConBanca = (p) => p.rival.banca.length > 0 || 'El rival no tiene Pokémon en la banca.'
const conBanca = (p) => p.s.banca.length > 0 || 'No tienes Pokémon en la banca.'
const huecoEnBanca = (p) => p.huecosBanca > 0 || 'Tu banca está llena.'
const conMazo = (p) => p.s.mazo.length > 0 || 'No te quedan cartas en el mazo.'

// Poner contadores de daño en los Pokémon del rival, repartidos.
async function repartirContadores(p, ui, n, { donde = 'todos', titulo } = {}) {
  const r = p.rival
  const objetivos = donde === 'banca' ? r.banca : [r.activo, ...r.banca].filter(Boolean)
  if (!objetivos.length) {
    p.log('No hay dónde poner los contadores.')
    return
  }
  const reparto = await ui.repartir({ titulo: titulo || `Reparte ${n} contadores de daño`, total: n, opciones: objetivos.map((d) => d.id) })
  for (const d of objetivos) if (reparto[d.id]) p.danioAlRival(d, reparto[d.id] * 10, { contadores: true })
}

// Hacer daño o poner contadores en UN Pokémon rival que se elige.
async function aUnRival(p, ui, cantidad, { titulo, soloBanca = false, soloEx = false, contadores = false } = {}) {
  const r = p.rival
  const lista = (soloBanca ? r.banca : [r.activo, ...r.banca]).filter((d) => d && (!soloEx || d.ex))
  if (!lista.length) return p.log('No hay a quién.')
  const [id] = await ui.pokemon({ titulo: titulo || 'Elige un Pokémon del rival', opciones: lista.map((d) => d.id), min: 1, max: 1 })
  p.danioAlRival(lista.find((d) => d.id === id), cantidad, { contadores })
}

// Unir energías del descarte a Pokémon, una por una.
async function unirDesdeDescarte(p, ui, { filtroEnergia, filtroPokemon = () => true, max, titulo }) {
  let hechas = 0
  for (let i = 0; i < max; i++) {
    const opciones = p.s.descarte.filter((u) => filtroEnergia(p.carta(u)))
    if (!opciones.length) break
    const destinos = p.enJuego.filter((s) => filtroPokemon(p.cartaDe(s), s))
    if (!destinos.length) break
    const elegidas = await ui.cartas({ titulo: `${titulo} (${i + 1} de ${max})`, opciones, min: 0, max: 1, zona: 'descarte' })
    if (!elegidas.length) break
    const [id] = await ui.pokemon({ titulo: `¿A quién unes ${p.nombre(elegidas[0])}?`, opciones: destinos.map((s) => s.id), min: 1, max: 1 })
    p.unirEnergia(elegidas[0], p.slot(id), { desde: 'descarte' })
    hechas++
  }
  return hechas
}

// Buscar energías en el mazo y unirlas, cada una a quien toque.
async function unirDesdeMazo(p, ui, { filtroEnergia, filtroPokemon = () => true, max, titulo, texto = '', validar = null }) {
  p.verMazo()
  const elegibles = p.s.mazo.filter((u) => filtroEnergia(p.carta(u)))
  const elegidas = await ui.cartas({ titulo, texto, opciones: [...p.s.mazo], elegibles, min: 0, max, validar, zona: 'mazo' })
  const unidas = []
  for (const u of elegidas) {
    const destinos = p.enJuego.filter((s) => filtroPokemon(p.cartaDe(s), s, u))
    if (!destinos.length) break
    const [id] = destinos.length === 1 ? [destinos[0].id] : await ui.pokemon({ titulo: `¿A quién unes ${p.nombre(u)}?`, opciones: destinos.map((s) => s.id), min: 1, max: 1 })
    p.unirEnergia(u, p.slot(id), { desde: 'mazo' })
    unidas.push({ uid: u, slot: p.slot(id) })
  }
  p.barajar()
  return unidas
}

// Robar por un efecto con su motivo en el registro.
const robar = (p, n, motivo) => p.robar(n, { motivo })

// Un bono de daño para lo que queda de turno (Cinturón Negro, Kieran…).
// Va por NOMBRE: a quién le vale lo decide `BONOS_DE_TURNO` en
// partida.js, porque el estado se clona y una función no se clona.
function ponerBono(p, clave, n, porque) {
  p.s.flags.bonos.push({ clave, n, porque })
}

// Cartas que actúan sobre la mano o la energía del rival. El maniquí no
// tiene ni una cosa ni otra, así que contra él no hacen nada (y lo dicen);
// contra otro jugador de verdad (la mesa, tanda 456) hacen lo que pone.
const NADA_AL_MANIQUI = '(Actúa sobre el rival: el maniquí no tiene mano ni energía, así que aquí no cambia nada.)'
const soloRival = (texto, enMesa = null) => ({
  texto,
  async usar(p, ui, ctx) {
    if (p.oponente && enMesa) return enMesa(p, ui, ctx)
    p.log(NADA_AL_MANIQUI)
  },
})

// ── El rival de verdad (con mesa) ──
//
// Barajar su mano en su mazo y robar: Juez, Estampa Injusta, Archer…
function rivalBarajaYRoba(p, n, motivo) {
  const op = p.oponente
  if (!op) return
  op.manoAlMazo()
  op.robar(n, { motivo })
}

// Que el rival descarte de su mano hasta quedarse con N. Elige ÉL: en la
// mesa los dos jugadores son la misma persona, así que la ventana lo dice.
async function rivalDescartaHasta(p, ui, n) {
  const op = p.oponente
  const sobran = op.s.mano.length - n
  if (sobran <= 0) return p.log(`${op.nombreJugador} tiene ${op.s.mano.length} o menos: no descarta.`)
  const el = await ui.cartas({ titulo: `${op.nombreJugador}: descarta ${sobran} para quedarte con ${n}`, opciones: [...op.s.mano], min: sobran, max: sobran, zona: 'mano', partida: op })
  op.descartar(el)
}

// Quitar una carta unida (energía o herramienta) a un Pokémon del rival:
// se elige el Pokémon y luego la carta, y va al descarte de su dueño.
async function quitarAlRival(p, ui, { titulo, cual = 'energia', filtro = () => true }) {
  const op = p.oponente
  const r = p.rival
  const valen = (d) => (cual === 'herramienta' ? d.herramienta && filtro(op.carta(d.herramienta)) : d.energias.some((u) => filtro(op.carta(u))))
  const con = [r.activo, ...r.banca].filter((d) => d && valen(d))
  if (!con.length) return p.log(`${op.nombreJugador} no tiene nada que quitar ahí.`)
  const [id] = await ui.pokemon({ titulo, opciones: con.map((d) => d.id), min: 1, max: 1 })
  const d = con.find((x) => x.id === id)
  let fuera
  if (cual === 'herramienta') {
    fuera = d.herramienta
    d.herramienta = null
  } else {
    const opciones = d.energias.filter((u) => filtro(op.carta(u)))
    ;[fuera] = opciones.length === 1 ? opciones : await ui.cartas({ titulo: '¿Qué energía se descarta?', opciones, min: 1, max: 1 })
    d.energias = d.energias.filter((u) => u !== fuera)
  }
  op.s.descarte.push(fuera)
  p.log(`${p.nombre(fuera)} de ${nombreVisible(op.cartaDe(d))} se descarta.`)
  return d
}

// ════════════════════════════════════════════════════════════════════
// ENTRENADORES
// ════════════════════════════════════════════════════════════════════

const entrenadores = {
  "boss's orders": {
    texto: 'Cambia 1 de los Pokémon en la banca de tu rival por su Pokémon activo.',
    puede: rivalConBanca,
    usar: (p, ui) => atraerRival(p, ui),
  },
  'night stretcher': {
    texto: 'Pon en tu mano un Pokémon o una carta de Energía básica de tu pila de descartes.',
    puede: (p) => hayEnDescarte(p, (c) => esPokemon(c) || basica(c), 'No tienes Pokémon ni energías básicas en el descarte.'),
    usar: (p, ui) => recuperar(p, ui, { titulo: 'Un Pokémon o una Energía básica del descarte', filtro: (c) => esPokemon(c) || basica(c), max: 1, min: 1 }),
  },
  'ultra ball': {
    texto: 'Solo puedes usar esta carta si descartas otras 2 cartas de tu mano. Busca en tu mazo un Pokémon, enséñalo y ponlo en tu mano. Después, baraja tu mazo.',
    puede: (p, ctx) => otrasEnMano(p, ctx).length >= 2 || 'Necesitas otras 2 cartas en la mano para descartarlas.',
    async usar(p, ui) {
      await descartarDeMano(p, ui, 2)
      await p.buscarEnMazo(ui, { titulo: 'Busca un Pokémon', filtro: esPokemon })
    },
  },
  'poké pad': {
    texto: 'Busca en tu mazo un Pokémon que no tenga Regla, enséñalo y ponlo en tu mano. Después, baraja tu mazo. (Los Pokémon ex, V, etc. tienen Regla.)',
    usar: (p, ui) => p.buscarEnMazo(ui, { titulo: 'Busca un Pokémon sin Regla', filtro: pokemonSinRegla }),
  },
  "lillie's determination": {
    texto: 'Baraja tu mano con tu mazo. Después, roba 6 cartas. Si te quedan exactamente 6 premios, roba 8 en su lugar.',
    usar(p) {
      p.manoAlMazo()
      robar(p, p.s.premios.length === 6 ? 8 : 6, 'Determinación de Lillie')
    },
  },
  'buddy-buddy poffin': {
    texto: 'Busca en tu mazo hasta 2 Pokémon básicos con 70 PS o menos y ponlos en tu banca. Después, baraja tu mazo.',
    puede: huecoEnBanca,
    usar: (p, ui) => p.buscarEnMazo(ui, { titulo: 'Hasta 2 básicos de 70 PS o menos, a la banca', filtro: (c) => pokemonBasico(c) && psHasta(70)(c), max: Math.min(2, p.huecosBanca), destino: 'banca' }),
  },
  'special red card': {
    texto: 'Solo puedes usar esta carta si a tu rival le quedan 3 premios o menos. Tu rival baraja su mano y la pone debajo de su mazo; si puso alguna carta así, roba 3.',
    puede: (p) => p.rival.premios <= 3 || (p.oponente ? `Solo si a ${p.oponente.nombreJugador} le quedan 3 premios o menos.` : 'Solo si al rival le quedan 3 premios o menos (ajústalo en el panel del rival).'),
    usar: soloRival('', (p) => {
      const op = p.oponente
      const mano = op.s.mano.splice(0)
      for (let i = mano.length - 1; i > 0; i--) {
        const j = Math.floor(p.azar() * (i + 1))
        ;[mano[i], mano[j]] = [mano[j], mano[i]]
      }
      op.alMazo(mano, 'abajo')
      p.log(`${op.nombreJugador} pone su mano (${mano.length}) debajo de su mazo.`)
      if (mano.length) op.robar(3, { motivo: 'Tarjeta Roja Especial' })
    }).usar,
  },
  crispin: {
    texto: 'Busca en tu mazo hasta 2 Energías básicas de tipos distintos y enséñalas. Pon 1 en tu mano y une la otra a 1 de tus Pokémon. Después, baraja tu mazo.',
    async usar(p, ui) {
      p.verMazo()
      const elegibles = p.s.mazo.filter((u) => basica(p.carta(u)))
      const sel = await ui.cartas({
        titulo: 'Hasta 2 Energías básicas de tipos distintos',
        opciones: [...p.s.mazo],
        elegibles,
        min: 0,
        max: 2,
        zona: 'mazo',
        validar: (s) => (s.length === 2 && letraDeCartaDeEnergia(p.carta(s[0])) === letraDeCartaDeEnergia(p.carta(s[1])) ? 'Tienen que ser de tipos distintos.' : null),
      })
      if (!sel.length) {
        p.barajar()
        return p.log('No coges ninguna.')
      }
      let aMano = sel[0]
      if (sel.length === 2) [aMano] = await ui.cartas({ titulo: '¿Cuál va a tu mano? (la otra se une)', opciones: sel, min: 1, max: 1 })
      p.sacarDelMazo(aMano)
      p.s.mano.push(aMano)
      p.log(`A la mano: ${p.nombre(aMano)}.`)
      const otra = sel.find((u) => u !== aMano)
      if (otra && p.enJuego.length) {
        const s = await elegirPropio(p, ui, { titulo: `¿A quién unes ${p.nombre(otra)}?` })
        p.unirEnergia(otra, s, { desde: 'mazo' })
      }
      p.barajar()
    },
  },
  'unfair stamp': {
    texto: 'Solo puedes usar esta carta si alguno de tus Pokémon quedó fuera de combate durante el último turno de tu rival. Cada jugador baraja su mano con su mazo. Después, tú robas 5 y tu rival 2.',
    // Con mesa no hay «Simular KO»: el KO tiene que haber pasado de verdad.
    puede: (p) => p.s.koUltimoTurnoRival || (p.oponente ? 'Solo si en su último turno te dejaron KO un Pokémon.' : 'Solo si el rival te dejó KO un Pokémon en su último turno (usa «Simular KO del rival» en uno de tus Pokémon).'),
    usar(p) {
      p.manoAlMazo()
      robar(p, 5, 'Estampa Injusta')
      rivalBarajaYRoba(p, 2, 'Estampa Injusta')
    },
  },
  switch: {
    texto: 'Cambia tu Pokémon activo por 1 de los de tu banca.',
    puede: conBanca,
    usar: (p, ui) => p.elegirYCambiar(ui),
  },
  judge: {
    texto: 'Cada jugador baraja su mano con su mazo y roba 4 cartas.',
    usar(p) {
      p.manoAlMazo()
      robar(p, 4, 'Juez')
      rivalBarajaYRoba(p, 4, 'Juez')
    },
  },
  'rare candy': {
    texto: 'Elige 1 de tus Pokémon básicos en juego. Si tienes en la mano una carta de Fase 2 que evolucione de ese Pokémon, ponla sobre él (cuenta como evolucionar). No puedes usarla en tu primer turno ni sobre un básico que haya entrado en juego este turno.',
    puede(p, ctx) {
      if (p.s.estricta && p.esMiPrimerTurno) return 'No se puede usar en tu primer turno.'
      if (p.s.estricta && p.vetado('evolucionar')) return `Este turno no puedes evolucionar desde la mano (${p.vetado('evolucionar')}).`
      return parejasCaramelo(p, ctx).length > 0 || 'No tienes una Fase 2 en la mano que evolucione de uno de tus básicos (que no haya entrado este turno).'
    },
    async usar(p, ui, ctx) {
      const parejas = parejasCaramelo(p, ctx)
      const bases = [...new Set(parejas.map((x) => x.slot.id))]
      const [id] = await ui.pokemon({ titulo: 'Elige el básico que evoluciona', opciones: bases, min: 1, max: 1 })
      const fases2 = parejas.filter((x) => x.slot.id === id).map((x) => x.uid)
      const [uid] = await ui.cartas({ titulo: 'Elige la Fase 2 de tu mano', opciones: fases2, min: 1, max: 1, zona: 'mano' })
      const slot = p.slot(id)
      const antes = nombreVisible(p.cartaDe(slot))
      p.quitarDeMano(uid)
      slot.cartas.push(uid)
      slot.evolucionoTurno = p.s.turno
      slot.estados = []
      limpiarEfectosDeAtaque(slot)
      p.log(`Caramelo Raro: ${antes} evoluciona a ${p.nombre(uid)}.`)
      await p.habilidadAlEvolucionar(slot, ui)
    },
  },
  hilda: {
    texto: 'Busca en tu mazo un Pokémon Evolución y una carta de Energía, enséñalos y ponlos en tu mano. Después, baraja tu mazo.',
    usar: (p, ui) => buscarVarias(p, ui, [(c) => esPokemon(c) && esEvolucion(c), esEnergia], 'Un Pokémon Evolución y una Energía'),
  },
  "team rocket's petrel": {
    texto: 'Busca en tu mazo una carta de Entrenador, enséñala y ponla en tu mano. Después, baraja tu mazo.',
    usar: (p, ui) => p.buscarEnMazo(ui, { titulo: 'Busca un Entrenador', filtro: esEntrenador }),
  },
  dawn: {
    texto: 'Busca en tu mazo un Pokémon básico, uno de Fase 1 y uno de Fase 2, enséñalos y ponlos en tu mano. Después, baraja tu mazo.',
    usar: (p, ui) => buscarVarias(p, ui, [(c) => esPokemon(c) && faseDe(c) === 0, (c) => esPokemon(c) && faseDe(c) === 1, (c) => esPokemon(c) && faseDe(c) === 2], 'Un Básico, un Fase 1 y un Fase 2'),
  },
  "rosa's encouragement": {
    texto: 'Solo puedes usar esta carta si te quedan más premios que a tu rival. Une hasta 2 Energías básicas de tu descarte a 1 de tus Pokémon de Fase 2.',
    puede: (p) => (p.s.premios.length > p.rival.premios ? true : 'Solo si te quedan más premios que al rival.'),
    async usar(p, ui) {
      const s = await elegirPropio(p, ui, { titulo: 'Elige tu Pokémon de Fase 2', filtro: (c) => faseDe(c) === 2 })
      if (!s) return p.log('No tienes Pokémon de Fase 2.')
      const el = await ui.cartas({ titulo: 'Hasta 2 Energías básicas del descarte', opciones: p.s.descarte.filter((u) => basica(p.carta(u))), min: 0, max: 2, zona: 'descarte' })
      for (const u of el) p.unirEnergia(u, s, { desde: 'descarte' })
    },
  },
  'secret box': {
    texto: 'Solo puedes usar esta carta si descartas otras 3 cartas de tu mano. Busca en tu mazo un Objeto, una Herramienta, un Partidario y un Estadio, enséñalos y ponlos en tu mano. Después, baraja tu mazo.',
    puede: (p, ctx) => otrasEnMano(p, ctx).length >= 3 || 'Necesitas otras 3 cartas en la mano para descartarlas.',
    async usar(p, ui) {
      await descartarDeMano(p, ui, 3)
      await buscarVarias(p, ui, [esObjeto, esHerramienta, esPartidario, esEstadio], 'Un Objeto, una Herramienta, un Partidario y un Estadio')
    },
  },
  "ciphermaniac's codebreaking": {
    texto: 'Busca en tu mazo 2 cartas, baraja tu mazo y ponlas encima en el orden que quieras.',
    async usar(p, ui) {
      const el = await p.buscarEnMazo(ui, { titulo: 'Elige 2 cartas para ponerlas arriba', max: 2, min: Math.min(2, p.s.mazo.length), destino: 'nada', barajar: false })
      for (const u of el) p.sacarDelMazo(u)
      p.barajar()
      let orden = el
      if (el.length === 2) {
        const [primera] = await ui.cartas({ titulo: '¿Cuál robas PRIMERO?', opciones: el, min: 1, max: 1 })
        orden = [primera, el.find((u) => u !== primera)]
      }
      p.alMazo(orden, 'arriba')
      p.log(`Arriba del mazo: ${orden.map((u) => p.nombre(u)).join(' y luego ')}.`)
    },
  },
  cyrano: {
    texto: 'Busca en tu mazo hasta 3 Pokémon ex, enséñalos y ponlos en tu mano. Después, baraja tu mazo.',
    usar: (p, ui) => p.buscarEnMazo(ui, { titulo: 'Hasta 3 Pokémon ex', filtro: (c) => esPokemon(c) && esEx(c), max: 3 }),
  },
  'crushing hammer': {
    texto: 'Lanza una moneda. Si sale cara, descarta una Energía unida a 1 de los Pokémon de tu rival.',
    async usar(p, ui) {
      const cara = p.moneda()
      if (!p.oponente) return p.log('(El maniquí no tiene energías.)')
      if (cara) await quitarAlRival(p, ui, { titulo: '¿A qué Pokémon del rival le quitas una energía?' })
    },
  },
  'sacred ash': {
    texto: 'Baraja 5 Pokémon de tu pila de descartes con tu mazo.',
    puede: (p) => hayEnDescarte(p, esPokemon, 'No tienes Pokémon en el descarte.'),
    usar: (p, ui) => recuperar(p, ui, { titulo: 'Hasta 5 Pokémon del descarte al mazo', filtro: esPokemon, max: 5, min: 1, destino: 'mazo' }),
  },
  'pokégear 3.0': {
    texto: 'Mira las 7 cartas de arriba de tu mazo. Puedes enseñar un Partidario de entre ellas y ponerlo en tu mano. Baraja las demás con tu mazo.',
    puede: conMazo,
    usar: (p, ui) => mirarYCoger(p, ui, 7, { titulo: 'Las 7 de arriba: puedes coger un Partidario', filtro: esPartidario }),
  },
  "lana's aid": {
    texto: 'Pon en tu mano hasta 3 cartas, en cualquier combinación, de Pokémon sin Regla y Energías básicas de tu pila de descartes.',
    usar: (p, ui) => recuperar(p, ui, { titulo: 'Hasta 3 Pokémon sin Regla o Energías básicas', filtro: (c) => pokemonSinRegla(c) || basica(c), max: 3 }),
  },
  'energy switch': {
    texto: 'Mueve una Energía básica de 1 de tus Pokémon a otro de tus Pokémon.',
    puede: (p) => (p.enJuego.length > 1 && p.enJuego.some((s) => s.energias.some((u) => basica(p.carta(u))))) || 'Necesitas una Energía básica unida y otro Pokémon.',
    usar: (p, ui) => moverEnergia(p, ui, { filtro: basica }),
  },
  'wondrous patch': {
    texto: 'Une una Energía {P} básica de tu pila de descartes a 1 de tus Pokémon {P} en la banca.',
    puede: (p) => hayEnDescarte(p, basicaDe('P'), 'No tienes Energía Psíquica básica en el descarte.'),
    usar: (p, ui) => unirDesdeDescarte(p, ui, { filtroEnergia: basicaDe('P'), filtroPokemon: (c, s) => s !== p.s.activo && esDeTipo(c, 'P'), max: 1, titulo: 'Energía Psíquica del descarte' }),
  },
  "wally's compassion": {
    texto: 'Cura todo el daño de 1 de tus Pokémon Megaevolución ex. Si has curado daño así, pon en tu mano todas las Energías unidas a ese Pokémon.',
    async usar(p, ui) {
      const s = await elegirPropio(p, ui, { titulo: 'Elige tu Mega ex', filtro: (c, s) => esMegaEx(c) && s.danio > 0 })
      if (!s) return p.log('No tienes ninguna Mega ex con daño.')
      if (p.curar(s, s.danio)) {
        p.s.mano.push(...s.energias)
        p.log(`Sus energías vuelven a tu mano (${s.energias.length}).`)
        s.energias = []
      }
    },
  },
  'jumbo ice cream': {
    texto: 'Cura 80 de daño a tu Pokémon activo si tiene 3 o más Energías unidas.',
    usar(p) {
      const a = p.s.activo
      if (a && p.unidadesDe(a).length >= 3) p.curar(a, 80)
      else p.log('Tu activo no tiene 3 energías: no cura nada.')
    },
  },
  gwynn: {
    texto: 'Descarta hasta 2 Pokémon sin Regla de tu mano y roba 3 cartas por cada carta que hayas descartado así.',
    async usar(p, ui) {
      const d = await descartarDeMano(p, ui, 2, { titulo: 'Descarta hasta 2 Pokémon sin Regla', filtro: pokemonSinRegla, min: 0 })
      robar(p, d.length * 3, 'Gwynn')
    },
  },
  eri: soloRival('Tu rival enseña su mano y descartas hasta 2 Objetos que encuentres en ella.', async (p, ui) => {
    const op = p.oponente
    p.log(`${op.nombreJugador} enseña su mano.`)
    const el = await ui.cartas({ titulo: `La mano de ${op.nombreJugador}: descarta hasta 2 Objetos`, opciones: [...op.s.mano], elegibles: op.s.mano.filter((u) => esObjeto(op.carta(u))), min: 0, max: 2, zona: 'mano', partida: op })
    op.descartar(el)
  }),
  'bug catching set': {
    texto: 'Mira las 7 cartas de arriba de tu mazo. Puedes enseñar hasta 2 cartas, en cualquier combinación, de Pokémon {G} y Energías {G} básicas y ponerlas en tu mano. Baraja las demás con tu mazo.',
    puede: conMazo,
    usar: (p, ui) => mirarYCoger(p, ui, 7, { titulo: 'Las 7 de arriba: hasta 2 Pokémon Planta o Energías Planta básicas', filtro: (c) => (esPokemon(c) && esDeTipo(c, 'G')) || basicaDe('G')(c), max: 2 }),
  },
  'prime catcher': {
    texto: 'Cambia 1 de los Pokémon en la banca de tu rival por su Pokémon activo. Si lo haces, cambia tu Pokémon activo por 1 de los de tu banca.',
    puede: rivalConBanca,
    async usar(p, ui) {
      if (await atraerRival(p, ui)) await p.elegirYCambiar(ui)
    },
  },
  "n's pp up": {
    texto: 'Une una Energía básica de tu pila de descartes a 1 de tus Pokémon de N en la banca.',
    puede: (p) => hayEnDescarte(p, basica, 'No tienes Energías básicas en el descarte.'),
    usar: (p, ui) => unirDesdeDescarte(p, ui, { filtroEnergia: basica, filtroPokemon: (c, s) => s !== p.s.activo && esDe(c, 'n'), max: 1, titulo: 'Energía básica del descarte' }),
  },
  "black belt's training": {
    texto: 'Durante este turno, los ataques de tus Pokémon hacen 40 puntos de daño más al Pokémon activo ex de tu rival (antes de aplicar Debilidad y Resistencia).',
    usar: (p) => ponerBono(p, 'cinturon', 40, 'Entrenamiento de Cinturón Negro'),
  },
  'fighting gong': {
    texto: 'Busca en tu mazo una Energía {F} básica o un Pokémon {F} básico, enséñalo y ponlo en tu mano. Después, baraja tu mazo.',
    usar: (p, ui) => p.buscarEnMazo(ui, { titulo: 'Una Energía Lucha básica o un Pokémon Lucha básico', filtro: (c) => basicaDe('F')(c) || (pokemonBasico(c) && esDeTipo(c, 'F')) }),
  },
  kieran: {
    texto: 'Elige 1: cambia tu Pokémon activo por 1 de tu banca; o, durante este turno, los ataques de tus Pokémon hacen 30 puntos de daño más al Pokémon activo ex o V de tu rival.',
    async usar(p, ui) {
      const op = await ui.opcion({ titulo: 'Kieran: elige 1', opciones: [{ id: 'cambio', texto: 'Cambiar tu activo', no: p.s.banca.length ? null : 'No tienes banca.' }, { id: 'bono', texto: '+30 al activo ex o V del rival' }] })
      if (op === 'cambio') await p.elegirYCambiar(ui)
      else ponerBono(p, 'kieran', 30, 'Kieran')
    },
  },
  'enhanced hammer': soloRival('Descarta una Energía especial unida a 1 de los Pokémon de tu rival.', (p, ui) => quitarAlRival(p, ui, { titulo: '¿De qué Pokémon del rival descartas una Energía especial?', filtro: (c) => !esEnergiaBasica(c) })),
  'premium power pro': {
    texto: 'Durante este turno, los ataques de tus Pokémon {F} hacen 30 puntos de daño más al Pokémon activo de tu rival (antes de aplicar Debilidad y Resistencia).',
    usar: (p) => ponerBono(p, 'premium', 30, 'Premium Power Pro'),
  },
  "team rocket's transceiver": {
    texto: 'Busca en tu mazo un Partidario con «Team Rocket» en el nombre, enséñalo y ponlo en tu mano. Después, baraja tu mazo.',
    usar: (p, ui) => p.buscarEnMazo(ui, { titulo: 'Un Partidario del Team Rocket', filtro: (c) => esPartidario(c) && esDe(c, 'team rocket') }),
  },
  'energy recycler': {
    texto: 'Baraja hasta 5 Energías básicas de tu pila de descartes con tu mazo.',
    puede: (p) => hayEnDescarte(p, basica, 'No tienes Energías básicas en el descarte.'),
    usar: (p, ui) => recuperar(p, ui, { titulo: 'Hasta 5 Energías básicas al mazo', filtro: basica, max: 5, destino: 'mazo' }),
  },
  'glass trumpet': {
    texto: 'Solo puedes usar esta carta si tienes algún Pokémon Teracristal en juego. Elige hasta 2 de tus Pokémon {C} en la banca y une a cada uno una Energía básica de tu pila de descartes.',
    puede: (p) => p.enJuego.some((s) => esTera(p.cartaDe(s))) || 'Solo si tienes un Pokémon Teracristal en juego.',
    usar: (p, ui) => unirDesdeDescarte(p, ui, { filtroEnergia: basica, filtroPokemon: (c, s) => s !== p.s.activo && esDeTipo(c, 'C'), max: 2, titulo: 'Energía básica del descarte' }),
  },
  xerosic: soloRival('Tu rival descarta cartas de su mano hasta quedarse con 3.', (p, ui) => rivalDescartaHasta(p, ui, 3)),
  "xerosic's machinations": soloRival('Tu rival descarta cartas de su mano hasta quedarse con 3.', (p, ui) => rivalDescartaHasta(p, ui, 3)),
  "gladion's final battle": {
    texto: 'Solo puedes usar esta carta si es la última de tu mano. Durante este turno, los ataques de tus Pokémon sin Regla hacen 80 puntos de daño más al Pokémon activo de tu rival.',
    puede: (p, ctx) => otrasEnMano(p, ctx).length === 0 || 'Tiene que ser la última carta de tu mano.',
    usar: (p) => ponerBono(p, 'gladion', 80, 'Última Batalla de Gladio'),
  },
  "team rocket's ariana": {
    texto: 'Roba hasta tener 5 cartas en la mano. Si todos tus Pokémon en juego son del Team Rocket, roba hasta tener 8.',
    usar(p) {
      const todosTR = p.enJuego.length && p.enJuego.every((s) => esDe(p.cartaDe(s), 'team rocket'))
      p.robarHasta(todosTR ? 8 : 5, { motivo: 'Ariana del Team Rocket' })
    },
  },
  "team rocket's proton": {
    texto: 'Si vas primero, puedes usar esta carta en tu primer turno. Busca en tu mazo hasta 3 Pokémon básicos del Team Rocket, enséñalos y ponlos en tu mano. Después, baraja tu mazo.',
    primerTurno: true,
    usar: (p, ui) => p.buscarEnMazo(ui, { titulo: 'Hasta 3 básicos del Team Rocket', filtro: (c) => pokemonBasico(c) && esDe(c, 'team rocket'), max: 3 }),
  },
  "team rocket's giovanni": {
    texto: 'Cambia tu Pokémon activo del Team Rocket por 1 de tus Pokémon del Team Rocket en la banca. Si lo haces, cambia 1 de los Pokémon en la banca de tu rival por su activo.',
    puede: (p) => (esDe(p.cartaDe(p.s.activo), 'team rocket') && p.s.banca.some((s) => esDe(p.cartaDe(s), 'team rocket'))) || 'Necesitas un activo del Team Rocket y otro en la banca.',
    async usar(p, ui) {
      const s = await elegirPropio(p, ui, { titulo: 'Tu Pokémon del Team Rocket que sube', filtro: (c, s) => s !== p.s.activo && esDe(c, 'team rocket') })
      if (!s) return
      p.cambiarActivo(s)
      await atraerRival(p, ui)
    },
  },
  "team rocket's archer": {
    texto: 'Solo puedes usar esta carta si alguno de tus Pokémon del Team Rocket quedó fuera de combate en el último turno de tu rival. Cada jugador baraja su mano con su mazo; tú robas 5 y tu rival 3.',
    puede: (p) => p.s.koUltimoTurnoRival || 'Solo si el rival te dejó KO un Pokémon del Team Rocket en su último turno.',
    usar(p) {
      p.manoAlMazo()
      robar(p, 5, 'Archer del Team Rocket')
      rivalBarajaYRoba(p, 3, 'Archer del Team Rocket')
    },
  },
  "janine's secret art": {
    texto: 'Elige hasta 2 de tus Pokémon {D}. Para cada uno, busca en tu mazo una Energía {D} básica y únesela. Después, baraja tu mazo. Si has unido energía a tu activo así, queda Envenenado.',
    async usar(p, ui) {
      const opciones = p.enJuego.filter((s) => esDeTipo(p.cartaDe(s), 'D')).map((s) => s.id)
      const ids = await ui.pokemon({ titulo: 'Hasta 2 de tus Pokémon Oscuros', opciones, min: 0, max: 2 })
      p.verMazo()
      for (const id of ids) {
        const u = p.s.mazo.find((x) => basicaDe('D')(p.carta(x)))
        if (!u) break
        p.unirEnergia(u, p.slot(id), { desde: 'mazo' })
        if (p.slot(id) === p.s.activo) ponerEstado(p.s.activo, 'envenenado')
      }
      p.barajar()
    },
  },
  "brock's scouting": {
    texto: 'Busca en tu mazo hasta 2 Pokémon básicos o 1 Pokémon Evolución, enséñalos y ponlos en tu mano. Después, baraja tu mazo.',
    usar: (p, ui) =>
      p.buscarEnMazo(ui, {
        titulo: 'Hasta 2 básicos, o 1 Evolución',
        filtro: esPokemon,
        max: 2,
        validar: (sel) => {
          const cs = sel.map((u) => p.carta(u))
          if (cs.some(esEvolucion) && cs.length > 1) return 'Una Evolución va sola.'
          return null
        },
      }),
  },
  'pokémon center lady': {
    texto: 'Cura 60 de daño y quita todos los estados especiales a 1 de tus Pokémon.',
    async usar(p, ui) {
      const s = await elegirPropio(p, ui, { titulo: 'Elige a quién curas' })
      if (!s) return
      p.curar(s, 60)
      s.estados = []
    },
  },
  'precious trolley': {
    texto: 'Busca en tu mazo cualquier número de Pokémon básicos y ponlos en tu banca. Después, baraja tu mazo.',
    puede: huecoEnBanca,
    usar: (p, ui) => p.buscarEnMazo(ui, { titulo: 'Básicos a la banca (los que quepan)', filtro: pokemonBasico, max: p.huecosBanca, destino: 'banca' }),
  },
  'tool scrapper': {
    texto: 'Elige hasta 2 Herramientas unidas a Pokémon en juego (tuyos o de tu rival) y descártalas.',
    async usar(p, ui) {
      const op = p.oponente
      const suyos = op ? op.enJuego.filter((s) => s.herramienta) : []
      const con = [...p.enJuego.filter((s) => s.herramienta), ...suyos]
      if (!con.length) return p.log(op ? 'No hay herramientas en juego.' : 'No hay herramientas en juego (el maniquí no lleva).')
      const ids = await ui.pokemon({ titulo: 'Hasta 2 Pokémon: se descarta su herramienta', opciones: con.map((s) => s.id), min: 0, max: 2 })
      for (const id of ids) {
        const s = con.find((x) => x.id === id)
        p.alDescarteDeSuDueno([s.herramienta])
        p.log(`Se descarta ${p.nombre(s.herramienta)}.`)
        s.herramienta = null
      }
    },
  },
  briar: {
    texto: 'Solo puedes usar esta carta si a tu rival le quedan exactamente 2 premios. Durante este turno, si el activo rival queda fuera de combate por el ataque de tu Pokémon Teracristal, coges 1 premio más.',
    puede: (p) => p.rival.premios === 2 || 'Solo si al rival le quedan exactamente 2 premios.',
    usar(p) {
      p.s.flags.briar = true
    },
  },
  "explorer's guidance": {
    texto: 'Mira las 6 cartas de arriba de tu mazo y pon 2 de ellas en tu mano. Descarta las demás.',
    puede: conMazo,
    usar: (p, ui) => mirarYCoger(p, ui, 6, { titulo: 'Las 6 de arriba: 2 a la mano, el resto al descarte', max: 2, resto: 'descartar' }),
  },
  'strange timepiece': {
    texto: 'Involuciona 1 de tus Pokémon {P} evolucionados poniendo en tu mano las cartas de Evolución que quieras de encima. (Ese Pokémon no puede evolucionar este turno.)',
    async usar(p, ui) {
      const s = await elegirPropio(p, ui, { titulo: 'Tu Pokémon Psíquico evolucionado', filtro: (c, s) => esDeTipo(c, 'P') && s.cartas.length > 1 })
      if (!s) return p.log('No tienes Pokémon Psíquicos evolucionados.')
      const quita = await ui.cartas({ titulo: 'Qué cartas de Evolución vuelven a la mano (de arriba abajo)', opciones: s.cartas.slice(1).reverse(), min: 1, max: s.cartas.length - 1 })
      // Solo se pueden quitar desde arriba: se quitan tantas como se hayan elegido.
      const n = quita.length
      const fuera = s.cartas.splice(s.cartas.length - n, n)
      p.s.mano.push(...fuera)
      s.evolucionoTurno = p.s.turno
      p.log(`Involuciona: ${fuera.map((u) => p.nombre(u)).join(', ')} a la mano.`)
    },
  },
  'roto-stick': {
    texto: 'Mira las 4 cartas de arriba de tu mazo. Puedes enseñar los Partidarios que haya y ponerlos en tu mano. Baraja las demás con tu mazo.',
    puede: conMazo,
    usar: (p, ui) => mirarYCoger(p, ui, 4, { titulo: 'Las 4 de arriba: los Partidarios que quieras', filtro: esPartidario, max: 4 }),
  },
  'miracle headset': {
    texto: 'Pon en tu mano hasta 2 Partidarios de tu pila de descartes.',
    puede: (p) => hayEnDescarte(p, esPartidario, 'No tienes Partidarios en el descarte.'),
    usar: (p, ui) => recuperar(p, ui, { titulo: 'Hasta 2 Partidarios del descarte', filtro: esPartidario, max: 2 }),
  },
  salvatore: {
    texto: 'Busca en tu mazo una carta sin Habilidades que evolucione de 1 de tus Pokémon y ponla sobre él para evolucionarlo. Después, baraja tu mazo. Vale también para un Pokémon que pusiste al preparar la partida o que entró este turno.',
    puede: (p) => !(p.s.estricta && p.esMiPrimerTurno) || 'Nadie puede evolucionar en su primer turno.',
    async usar(p, ui) {
      p.verMazo()
      const vale = (c) => esPokemon(c) && !(Array.isArray(c.abilities) && c.abilities.length) && p.enJuego.some((s) => evolucionaDe(c, p.cartaDe(s)))
      const el = await ui.cartas({ titulo: 'Una evolución sin habilidad', opciones: [...p.s.mazo], elegibles: p.s.mazo.filter((u) => vale(p.carta(u))), min: 0, max: 1, zona: 'mazo' })
      if (el.length) {
        const destinos = p.enJuego.filter((s) => evolucionaDe(p.carta(el[0]), p.cartaDe(s)))
        const [id] = destinos.length === 1 ? [destinos[0].id] : await ui.pokemon({ titulo: '¿Cuál evoluciona?', opciones: destinos.map((s) => s.id), min: 1, max: 1 })
        const s = p.slot(id)
        p.sacarDelMazo(el[0])
        s.cartas.push(el[0])
        s.evolucionoTurno = p.s.turno
        s.estados = []
        p.log(`Salvatore: evoluciona a ${p.nombre(el[0])}.`)
      }
      p.barajar()
    },
  },
  surfer: {
    texto: 'Cambia tu Pokémon activo por 1 de tu banca. Si lo haces, roba hasta tener 5 cartas en la mano.',
    puede: conBanca,
    async usar(p, ui) {
      if (await p.elegirYCambiar(ui)) p.robarHasta(5, { motivo: 'Surfista' })
    },
  },
  'brilliant blender': {
    texto: 'Busca en tu mazo hasta 5 cartas y descártalas. Después, baraja tu mazo.',
    usar: (p, ui) => p.buscarEnMazo(ui, { titulo: 'Hasta 5 cartas al descarte', max: 5, destino: 'descarte' }),
  },
  "colress's tenacity": {
    texto: 'Busca en tu mazo un Estadio y una carta de Energía, enséñalos y ponlos en tu mano. Después, baraja tu mazo.',
    usar: (p, ui) => buscarVarias(p, ui, [esEstadio, esEnergia], 'Un Estadio y una Energía'),
  },
  'energy retrieval': {
    texto: 'Pon en tu mano hasta 2 Energías básicas de tu pila de descartes.',
    puede: (p) => hayEnDescarte(p, basica, 'No tienes Energías básicas en el descarte.'),
    usar: (p, ui) => recuperar(p, ui, { titulo: 'Hasta 2 Energías básicas del descarte', filtro: basica, max: 2 }),
  },
  hassel: {
    texto: 'Solo puedes usar esta carta si alguno de tus Pokémon quedó fuera de combate en el último turno de tu rival. Mira las 8 cartas de arriba de tu mazo y pon hasta 3 en tu mano. Baraja las demás con tu mazo.',
    puede: (p) => p.s.koUltimoTurnoRival || 'Solo si el rival te dejó KO un Pokémon en su último turno.',
    usar: (p, ui) => mirarYCoger(p, ui, 8, { titulo: 'Las 8 de arriba: hasta 3 a la mano', max: 3 }),
  },
  'redeemable ticket': {
    texto: 'Cuenta tus premios, barájalos y ponlos debajo de tu mazo. Después, coge ese número de cartas de arriba de tu mazo y ponlas boca abajo como premios.',
    usar(p) {
      const s = p.s
      const n = s.premios.length
      const viejos = s.premios.splice(0)
      s.premiosVistos = {}
      // No los miras: van abajo sin que sepas cuáles son, y los nuevos
      // salen de arriba. Lo que sabías del mazo deja de valer.
      s.mazo.push(...viejos)
      s.premios = s.mazo.splice(0, n)
      s.conocimiento = { arriba: 0, abajo: 0, confirmados: {} }
      p.log(`Tus ${n} premios se cambian por las ${n} de arriba del mazo.`)
    },
  },
  "hop's bag": {
    texto: 'Busca en tu mazo hasta 2 Pokémon básicos de Paul y ponlos en tu banca. Después, baraja tu mazo.',
    puede: huecoEnBanca,
    usar: (p, ui) => p.buscarEnMazo(ui, { titulo: 'Hasta 2 básicos de Paul a la banca', filtro: (c) => pokemonBasico(c) && esDe(c, 'hop'), max: Math.min(2, p.huecosBanca), destino: 'banca' }),
  },
  'dusk ball': {
    texto: 'Mira las 7 cartas de abajo de tu mazo. Elige 1 Pokémon, enséñalo y ponlo en tu mano. Vuelve a poner las demás encima de tu mazo y baraja.',
    puede: conMazo,
    async usar(p, ui) {
      const vistas = p.mirarAbajo(7)
      const el = await ui.cartas({ titulo: 'Las 7 de abajo: un Pokémon a la mano', opciones: vistas, elegibles: vistas.filter((u) => esPokemon(p.carta(u))), min: 0, max: 1, zona: 'mazo' })
      for (const u of el) {
        p.sacarDelMazo(u)
        p.s.mano.push(u)
      }
      if (el.length) p.log(`A la mano: ${p.nombre(el[0])}.`)
      p.barajar()
    },
  },
  "ethan's adventure": {
    texto: 'Busca en tu mazo hasta 3 cartas, en cualquier combinación, de Pokémon de Eco y Energías {R} básicas, enséñalas y ponlas en tu mano. Después, baraja tu mazo.',
    usar: (p, ui) => p.buscarEnMazo(ui, { titulo: 'Hasta 3 Pokémon de Eco o Energías Fuego básicas', filtro: (c) => (esPokemon(c) && esDe(c, 'ethan')) || basicaDe('R')(c), max: 3 }),
  },
  'mega signal': {
    texto: 'Busca en tu mazo un Pokémon Megaevolución ex, enséñalo y ponlo en tu mano. Después, baraja tu mazo.',
    usar: (p, ui) => p.buscarEnMazo(ui, { titulo: 'Una Mega ex', filtro: (c) => esPokemon(c) && esMegaEx(c) }),
  },
  'hand trimmer': {
    texto: 'Cada jugador descarta cartas de su mano hasta quedarse con 5 (primero tu rival). Quien tenga 5 o menos no descarta.',
    async usar(p, ui) {
      if (p.oponente) await rivalDescartaHasta(p, ui, 5)
      const sobran = p.s.mano.length - 5
      if (sobran > 0) await descartarDeMano(p, ui, sobran, { titulo: `Descarta ${sobran} para quedarte con 5` })
    },
  },
  'max rod': {
    texto: 'Pon en tu mano hasta 5 cartas, en cualquier combinación, de Pokémon y Energías básicas de tu pila de descartes.',
    usar: (p, ui) => recuperar(p, ui, { titulo: 'Hasta 5 Pokémon o Energías básicas', filtro: (c) => esPokemon(c) || basica(c), max: 5 }),
  },
  "morty's conviction": {
    texto: 'Solo puedes usar esta carta si descartas otra carta de tu mano. Roba una carta por cada Pokémon en la banca de tu rival.',
    puede: (p, ctx) => otrasEnMano(p, ctx).length >= 1 || 'Necesitas otra carta en la mano para descartarla.',
    async usar(p, ui) {
      await descartarDeMano(p, ui, 1)
      robar(p, p.rival.banca.length, 'Convicción de Morti')
    },
  },
  'dark bell': {
    texto: 'Los dos Pokémon activos que no sean {D} quedan Confundidos.',
    usar(p) {
      if (p.s.activo && !esDeTipo(p.cartaDe(p.s.activo), 'D')) ponerEstado(p.s.activo, 'confundido')
      const suyo = p.rival.activo
      if (suyo && !(p.oponente && esDeTipo(p.oponente.cartaDe(suyo), 'D'))) ponerEstado(suyo, 'confundido')
      p.log('Los activos que no son Oscuros quedan confundidos.')
    },
  },
  canari: {
    texto: 'Solo puedes usar esta carta si descartas otra carta de tu mano. Busca en tu mazo hasta 4 Pokémon {L}, enséñalos y ponlos en tu mano. Después, baraja tu mazo.',
    puede: (p, ctx) => otrasEnMano(p, ctx).length >= 1 || 'Necesitas otra carta en la mano para descartarla.',
    async usar(p, ui) {
      await descartarDeMano(p, ui, 1)
      await p.buscarEnMazo(ui, { titulo: 'Hasta 4 Pokémon Rayo', filtro: (c) => esPokemon(c) && esDeTipo(c, 'L'), max: 4 })
    },
  },
  "az's tranquility": {
    texto: 'Cambia tu Pokémon activo por 1 de tu banca. Si has mandado a la banca un Pokémon ex así, cúrale 80 de daño.',
    puede: conBanca,
    async usar(p, ui) {
      const viejo = p.s.activo
      if (await p.elegirYCambiar(ui)) if (viejo && esEx(p.cartaDe(viejo))) p.curar(viejo, 80)
    },
  },
  'energy search': {
    texto: 'Busca en tu mazo una Energía básica, enséñala y ponla en tu mano. Después, baraja tu mazo.',
    usar: (p, ui) => p.buscarEnMazo(ui, { titulo: 'Una Energía básica', filtro: basica }),
  },
  'dangerous laser': {
    texto: 'El Pokémon activo de tu rival queda Quemado y Confundido.',
    usar(p) {
      const r = p.rival.activo
      if (r) {
        ponerEstado(r, 'quemado')
        ponerEstado(r, 'confundido')
      }
      p.log('El activo rival queda quemado y confundido.')
    },
  },
  ruffian: soloRival('Descarta una Herramienta y una Energía especial de 1 de los Pokémon de tu rival.', async (p, ui) => {
    const op = p.oponente
    const r = p.rival
    const con = [r.activo, ...r.banca].filter((d) => d && (d.herramienta || d.energias.some((u) => !esEnergiaBasica(op.carta(u)))))
    if (!con.length) return p.log(`${op.nombreJugador} no lleva herramientas ni energías especiales.`)
    const [id] = await ui.pokemon({ titulo: 'Un Pokémon del rival: pierde su herramienta y una Energía especial', opciones: con.map((d) => d.id), min: 1, max: 1 })
    const d = con.find((x) => x.id === id)
    if (d.herramienta) {
      op.s.descarte.push(d.herramienta)
      p.log(`${p.nombre(d.herramienta)} se descarta.`)
      d.herramienta = null
    }
    const esp = d.energias.filter((u) => !esEnergiaBasica(op.carta(u)))
    if (esp.length) {
      const [e] = esp.length === 1 ? esp : await ui.cartas({ titulo: '¿Qué Energía especial?', opciones: esp, min: 1, max: 1 })
      d.energias = d.energias.filter((u) => u !== e)
      op.s.descarte.push(e)
      p.log(`${p.nombre(e)} se descarta.`)
    }
  }),
  'transformation tome': {
    texto: 'Tienes que jugar 2 Tomos de Transformación a la vez. Elige un Pokémon básico de tu descarte y cámbialo por 1 de tus Pokémon básicos en juego; todo lo unido, el daño y los efectos se quedan en el nuevo.',
  },

  // ── Estadios que se USAN (una vez por turno) ──
  'academy at night': {
    texto: 'Una vez durante el turno de cada jugador, ese jugador puede poner una carta de su mano encima de su mazo.',
    estadio: {
      nombre: 'Poner una carta arriba',
      puede: (p) => p.s.mano.length > 0 || 'No tienes cartas en la mano.',
      async usar(p, ui) {
        const [u] = await ui.cartas({ titulo: 'Una carta de tu mano, encima del mazo', opciones: [...p.s.mano], min: 1, max: 1, zona: 'mano' })
        p.quitarDeMano(u)
        p.alMazo([u], 'arriba')
        p.log(`${p.nombre(u)} va encima del mazo.`)
      },
    },
  },
  'prism tower': {
    texto: 'Una vez durante el turno de cada jugador, ese jugador puede descartar 2 cartas de su mano para robar una carta.',
    estadio: {
      nombre: 'Descartar 2 y robar 1',
      puede: (p) => p.s.mano.length >= 2 || 'Necesitas 2 cartas en la mano.',
      async usar(p, ui) {
        await descartarDeMano(p, ui, 2)
        robar(p, 1, 'Torre Prisma')
      },
    },
  },
  'lumiose city': {
    texto: 'Una vez durante el turno de cada jugador, ese jugador puede buscar en su mazo un Pokémon básico y ponerlo en su banca. Después, baraja. Si lo hace, su turno termina.',
    estadio: {
      nombre: 'Buscar un básico (termina el turno)',
      puede: huecoEnBanca,
      async usar(p, ui) {
        await p.buscarEnMazo(ui, { titulo: 'Un Pokémon básico a la banca', filtro: pokemonBasico, destino: 'banca' })
        p.log('Ciudad Luminalia: tu turno termina.')
        await p.pasarTurno(ui)
      },
    },
  },
  'spikemuth gym': {
    texto: 'Una vez durante el turno de cada jugador, ese jugador puede buscar en su mazo un Pokémon de Roxy, enseñarlo y ponerlo en su mano. Después, baraja.',
    estadio: {
      nombre: 'Buscar un Pokémon de Roxy',
      usar: (p, ui) => p.buscarEnMazo(ui, { titulo: 'Un Pokémon de Roxy', filtro: (c) => esPokemon(c) && esDe(c, 'marnie') }),
    },
  },
  "team rocket's factory": {
    texto: 'Una vez durante el turno de cada jugador, si ha jugado de su mano un Partidario con «Team Rocket» en el nombre este turno, puede robar 2 cartas.',
    estadio: {
      nombre: 'Robar 2',
      puede: (p) => p.s.flags.partidarioTR || 'Solo si has jugado un Partidario del Team Rocket este turno.',
      usar: (p) => robar(p, 2, 'Fábrica del Team Rocket'),
    },
  },
  'surfing beach': {
    texto: 'Una vez durante el turno de cada jugador, ese jugador puede cambiar su Pokémon activo {W} por 1 de sus Pokémon {W} en la banca.',
    estadio: {
      nombre: 'Cambiar Pokémon Agua',
      puede: (p) => (esDeTipo(p.cartaDe(p.s.activo), 'W') && p.s.banca.some((s) => esDeTipo(p.cartaDe(s), 'W'))) || 'Necesitas un activo Agua y otro Agua en la banca.',
      async usar(p, ui) {
        const s = await elegirPropio(p, ui, { titulo: 'El Pokémon Agua que sube', filtro: (c, s) => s !== p.s.activo && esDeTipo(c, 'W') })
        p.cambiarActivo(s)
      },
    },
  },
  'grand tree': {
    texto: 'Una vez durante el turno de cada jugador, ese jugador puede buscar en su mazo un Fase 1 que evolucione de uno de sus básicos y evolucionarlo; si lo hace, puede buscar un Fase 2 que evolucione de ese y evolucionarlo también. Después, baraja. (No en el primer turno ni sobre un básico que entró este turno.)',
    estadio: {
      nombre: 'Evolucionar desde el mazo',
      puede: (p) => !(p.s.estricta && p.esMiPrimerTurno) || 'Nadie puede evolucionar en su primer turno.',
      async usar(p, ui) {
        p.verMazo()
        const bases = p.enJuego.filter((s) => s.cartas.length === 1 && esBasicoEnJuego(p.cartaDe(s)) && (!p.s.estricta || s.entroTurno !== p.s.turno))
        const f1 = p.s.mazo.filter((u) => faseDe(p.carta(u)) === 1 && bases.some((s) => evolucionaDe(p.carta(u), p.cartaDe(s))))
        const [u1] = await ui.cartas({ titulo: 'Un Fase 1 que evolucione de uno de tus básicos', opciones: [...p.s.mazo], elegibles: f1, min: 0, max: 1, zona: 'mazo' })
        if (!u1) return p.barajar()
        const destinos = bases.filter((s) => evolucionaDe(p.carta(u1), p.cartaDe(s)))
        const [id] = destinos.length === 1 ? [destinos[0].id] : await ui.pokemon({ titulo: '¿Cuál evoluciona?', opciones: destinos.map((s) => s.id), min: 1, max: 1 })
        const s = p.slot(id)
        await p.evolucionar(u1, s, ui, { desdeMazo: true })
        const f2 = p.s.mazo.filter((u) => evolucionaDe(p.carta(u), p.carta(u1)))
        const [u2] = await ui.cartas({ titulo: 'Y un Fase 2 que evolucione de ese (opcional)', opciones: [...p.s.mazo], elegibles: f2, min: 0, max: 1, zona: 'mazo' })
        if (u2) {
          p.sacarDelMazo(u2)
          s.cartas.push(u2)
          p.log(`Gran Árbol: evoluciona a ${p.nombre(u2)}.`)
        }
        p.barajar()
      },
    },
  },

  // ── Clásicos que siguen en Expandido o en listas viejas ──
  'nest ball': {
    texto: 'Busca en tu mazo un Pokémon básico y ponlo en tu banca. Después, baraja tu mazo.',
    puede: huecoEnBanca,
    usar: (p, ui) => p.buscarEnMazo(ui, { titulo: 'Un Pokémon básico a la banca', filtro: pokemonBasico, destino: 'banca' }),
  },
  "professor's research": {
    texto: 'Descarta tu mano y roba 7 cartas.',
    usar(p) {
      p.descartar([...p.s.mano])
      robar(p, 7, 'Investigación de Profesores')
    },
  },
  iono: {
    texto: 'Cada jugador baraja su mano y la pone debajo de su mazo. Si lo hace, roba una carta por cada premio que le quede.',
    usar(p) {
      const mano = p.s.mano.splice(0)
      // Debajo, barajada: sabes qué hay abajo, no en qué orden.
      const L = mano.length
      for (let i = L - 1; i > 0; i--) {
        const j = Math.floor(p.azar() * (i + 1))
        ;[mano[i], mano[j]] = [mano[j], mano[i]]
      }
      p.alMazo(mano, 'abajo')
      const op = p.oponente
      let suya = []
      if (op) {
        suya = op.s.mano.splice(0)
        for (let i = suya.length - 1; i > 0; i--) {
          const j = Math.floor(p.azar() * (i + 1))
          ;[suya[i], suya[j]] = [suya[j], suya[i]]
        }
        op.alMazo(suya, 'abajo')
      }
      // La carta: «si ALGUNO de los dos puso cartas así, CADA jugador
      // roba…». Con la mano vacía también se roba si el otro tenía.
      if (L || suya.length) {
        robar(p, p.s.premios.length, 'Iono')
        if (op) op.robar(op.s.premios.length, { motivo: 'Iono' })
      }
    },
  },
  arven: {
    texto: 'Busca en tu mazo un Objeto y una Herramienta, enséñalos y ponlos en tu mano. Después, baraja tu mazo.',
    usar: (p, ui) => buscarVarias(p, ui, [esObjeto, esHerramienta], 'Un Objeto y una Herramienta'),
  },
  'earthen vessel': {
    texto: 'Solo puedes usar esta carta si descartas otra carta de tu mano. Busca en tu mazo hasta 2 Energías básicas, enséñalas y ponlas en tu mano. Después, baraja tu mazo.',
    puede: (p, ctx) => otrasEnMano(p, ctx).length >= 1 || 'Necesitas otra carta en la mano para descartarla.',
    async usar(p, ui) {
      await descartarDeMano(p, ui, 1)
      await p.buscarEnMazo(ui, { titulo: 'Hasta 2 Energías básicas', filtro: basica, max: 2 })
    },
  },
  'super rod': {
    texto: 'Baraja hasta 3 cartas, en cualquier combinación, de Pokémon y Energías básicas de tu pila de descartes con tu mazo.',
    usar: (p, ui) => recuperar(p, ui, { titulo: 'Hasta 3 Pokémon o Energías básicas al mazo', filtro: (c) => esPokemon(c) || basica(c), max: 3, destino: 'mazo' }),
  },
  'counter catcher': {
    texto: 'Solo puedes usar esta carta si te quedan más premios que a tu rival. Cambia 1 de los Pokémon en la banca de tu rival por su activo.',
    puede: (p) => (p.s.premios.length > p.rival.premios ? rivalConBanca(p) : 'Solo si te quedan más premios que al rival.'),
    usar: (p, ui) => atraerRival(p, ui),
  },
  'pal pad': {
    texto: 'Baraja hasta 2 Partidarios de tu pila de descartes con tu mazo.',
    usar: (p, ui) => recuperar(p, ui, { titulo: 'Hasta 2 Partidarios al mazo', filtro: esPartidario, max: 2, destino: 'mazo' }),
  },
  'level ball': {
    texto: 'Busca en tu mazo un Pokémon con 90 PS o menos, enséñalo y ponlo en tu mano. Después, baraja tu mazo.',
    usar: (p, ui) => p.buscarEnMazo(ui, { titulo: 'Un Pokémon de 90 PS o menos', filtro: (c) => esPokemon(c) && psHasta(90)(c) }),
  },
  'great ball': {
    texto: 'Mira las 7 cartas de arriba de tu mazo. Puedes enseñar un Pokémon y ponerlo en tu mano. Baraja las demás con tu mazo.',
    puede: conMazo,
    usar: (p, ui) => mirarYCoger(p, ui, 7, { titulo: 'Las 7 de arriba: puedes coger un Pokémon', filtro: esPokemon }),
  },
  "professor turo's scenario": {
    texto: 'Pon 1 de tus Pokémon en juego en tu mano. (Descarta todas las cartas unidas a él.)',
    async usar(p, ui) {
      const s = await elegirPropio(p, ui, { titulo: 'El Pokémon que vuelve a tu mano' })
      if (s) volverAMano(p, s)
      await p.reponerActivo(ui)
    },
  },
  penny: {
    texto: 'Pon 1 de tus Pokémon básicos en juego y todas las cartas unidas a él en tu mano.',
    async usar(p, ui) {
      const s = await elegirPropio(p, ui, { titulo: 'El básico que vuelve a tu mano', filtro: (c, s) => s.cartas.length === 1 && esBasicoEnJuego(c) })
      if (s) {
        p.s.mano.push(...p.cartasDelSlot(s))
        p.quitarDelJuego(s)
        p.log(`${nombreVisible(p.carta(s.cartas[0]))} y lo unido vuelven a tu mano.`)
      }
      await p.reponerActivo(ui)
    },
  },
  irida: {
    texto: 'Busca en tu mazo un Pokémon {W} y un Objeto, enséñalos y ponlos en tu mano. Después, baraja tu mazo.',
    usar: (p, ui) => buscarVarias(p, ui, [(c) => esPokemon(c) && esDeTipo(c, 'W'), esObjeto], 'Un Pokémon Agua y un Objeto'),
  },
  'battle vip pass': {
    texto: 'Solo puedes usar esta carta en tu primer turno. Busca en tu mazo hasta 2 Pokémon básicos y ponlos en tu banca. Después, baraja tu mazo.',
    puede: (p) => (p.esMiPrimerTurno ? huecoEnBanca(p) : 'Solo en tu primer turno.'),
    usar: (p, ui) => p.buscarEnMazo(ui, { titulo: 'Hasta 2 básicos a la banca', filtro: pokemonBasico, max: Math.min(2, p.huecosBanca), destino: 'banca' }),
  },
  carmine: {
    texto: 'Puedes usar esta carta en tu primer turno aunque vayas primero. Descarta tu mano y roba 5 cartas.',
    primerTurno: true,
    usar(p) {
      p.descartar([...p.s.mano])
      robar(p, 5, 'Carmín')
    },
  },
}

// Las parejas (básico en juego, Fase 2 de la mano) que admite Caramelo
// Raro. La Fase 1 intermedia puede no estar en el mazo, así que el
// «de quién evoluciona» sale de TODO lo que la partida conoce del mazo.
function parejasCaramelo(p, ctx) {
  const fases1 = [...p.cartas.values()].filter((c) => faseDe(c) === 1)
  const fases2 = p.s.mano.filter((u) => u !== ctx?.uid && faseDe(p.carta(u)) === 2)
  const bases = p.enJuego.filter((s) => s.cartas.length === 1 && esBasicoEnJuego(p.cartaDe(s)) && (!p.s.estricta || s.entroTurno !== p.s.turno))
  const out = []
  for (const u of fases2) {
    const f2 = p.carta(u)
    const intermedias = fases1.filter((f1) => evolucionaDe(f2, f1))
    for (const s of bases) {
      const base = p.cartaDe(s)
      const encaja = intermedias.some((f1) => evolucionaDe(f1, base)) || (!intermedias.length && LINEAS_CONOCIDAS[claveDeEfecto(f2)] === claveDeEfecto(base))
      if (encaja) out.push({ uid: u, slot: s })
    }
  }
  return out
}

// Por si el mazo lleva la Fase 2 sin su Fase 1 (pasa con Caramelo).
const LINEAS_CONOCIDAS = {
  'dragapult ex': 'dreepy', dragapult: 'dreepy', alakazam: 'abra', dusknoir: 'duskull', metagross: 'beldum',
  'greninja ex': 'froakie', 'mega greninja ex': 'froakie', meganium: 'chikorita', 'mega meganium ex': 'chikorita',
  'blaziken ex': 'torchic', 'hydrapple ex': 'applin', 'beedrill ex': 'weedle', 'arboliva ex': 'smoliv',
  toucannon: 'pikipek', chandelure: 'litwick', 'mega chandelure ex': 'litwick', 'mega venusaur ex': 'bulbasaur',
  'mega gengar ex': 'gastly', 'gengar ex': 'gastly', 'mega eelektross ex': 'tynamo', 'empoleon ex': 'piplup',
  "cynthia's garchomp ex": "cynthia's gible", "marnie's grimmsnarl ex": "marnie's impidimp",
  "steven's metagross ex": "steven's beldum", "ethan's typhlosion": "ethan's cyndaquil", annihilape: 'mankey',
}

function volverAMano(p, s) {
  const c = p.cartaDe(s)
  p.s.mano.push(...s.cartas)
  p.s.descarte.push(...s.energias, ...(s.herramienta ? [s.herramienta] : []))
  p.quitarDelJuego(s)
  p.log(`${nombreVisible(c)} vuelve a tu mano; lo unido, al descarte.`)
}

async function moverEnergia(p, ui, { filtro = () => true, desdeFiltro = () => true, haciaFiltro = () => true, titulo = 'Mueve una energía' } = {}) {
  const origenes = p.enJuego.filter((s) => desdeFiltro(p.cartaDe(s), s) && s.energias.some((u) => filtro(p.carta(u))))
  if (!origenes.length) return false
  const [de] = await ui.pokemon({ titulo: `${titulo}: ¿de quién?`, opciones: origenes.map((s) => s.id), min: 1, max: 1 })
  const origen = p.slot(de)
  const [u] = await ui.cartas({ titulo: '¿Qué energía?', opciones: origen.energias.filter((x) => filtro(p.carta(x))), min: 1, max: 1 })
  const destinos = p.enJuego.filter((s) => s !== origen && haciaFiltro(p.cartaDe(s), s))
  if (!destinos.length) return false
  const [a] = await ui.pokemon({ titulo: '¿A quién?', opciones: destinos.map((s) => s.id), min: 1, max: 1 })
  origen.energias = origen.energias.filter((x) => x !== u)
  p.slot(a).energias.push(u)
  p.log(`${p.nombre(u)} pasa de ${nombreVisible(p.cartaDe(origen))} a ${nombreVisible(p.cartaDe(p.slot(a)))}.`)
  return true
}

// Los estadios y herramientas que solo cambian números (PS, retirada,
// daño) los aplica partida.js al calcular; aquí solo va su texto, que
// es lo que el espejo no tiene.
const pasivos = {
  'air balloon': 'El coste de retirada del Pokémon al que está unida es 2 {C} menos.',
  'risky ruins': 'Cada vez que un jugador pone en su banca un Pokémon básico que no sea {D} durante su turno, pon 2 contadores de daño en ese Pokémon.',
  "team rocket's watchtower": 'Los Pokémon {C} en juego (tuyos y de tu rival) no tienen Habilidades.',
  'battle cage': 'Evita que se pongan contadores de daño en los Pokémon en banca (de los dos) por efectos de ataques y Habilidades de los Pokémon rivales. (El daño de los ataques sí se recibe.)',
  "hero's cape": 'El Pokémon al que está unida tiene +100 PS.',
  'binding mochi': 'Los ataques del Pokémon Envenenado al que está unida hacen 40 puntos de daño más al activo rival.',
  'area zero underdepths': 'Quien tenga algún Pokémon Teracristal en juego puede tener hasta 8 Pokémon en la banca. Si deja de tenerlo, descarta de la banca hasta quedarse con 5.',
  'brave bangle': 'Si el Pokémon al que está unida no tiene Regla, sus ataques hacen 30 puntos de daño más al activo ex rival.',
  'jamming tower': 'Las Herramientas unidas a cualquier Pokémon (de los dos) no tienen efecto.',
  'gravity mountain': 'Cada Pokémon de Fase 2 en juego (de los dos) tiene -30 PS.',
  'lucky helmet': 'Cada vez que el Pokémon al que está unida sea tu activo y reciba daño de un ataque rival (aunque quede fuera de combate), roba 2 cartas.',
  'handheld fan': 'Si el Pokémon al que está unida es el activo y recibe daño de un ataque rival, mueve una Energía del atacante a 1 de los Pokémon en la banca del rival.',
  'festival grounds': 'Cada Pokémon con alguna Energía unida (de los dos) se recupera de todos los estados especiales y no puede verse afectado por ellos.',
  "n's castle": 'Los Pokémon de N en juego (de los dos) no tienen coste de retirada.',
  'forest of vitality': 'Los Pokémon {G} de cada jugador pueden evolucionar a Pokémon {G} en el turno en que se juegan, salvo en el primer turno.',
  'nighttime mine': 'Los ataques de cada Pokémon Teracristal en juego (de los dos) cuestan {C} más.',
  "cynthia's power weight": 'El Pokémon de Cintia al que está unida tiene +70 PS.',
  'maximum belt': 'Los ataques del Pokémon al que está unida hacen 50 puntos de daño más al activo ex rival.',
  "hop's choice band": 'Los ataques del Pokémon de Paul al que está unida cuestan {C} menos y hacen 30 puntos de daño más al activo rival.',
  postwick: 'Los ataques de los Pokémon de Paul (de los dos) hacen 30 puntos de daño más al activo rival.',
  "lillie's pearl": 'Si el Pokémon de Lillie al que está unida queda fuera de combate por un ataque rival, ese jugador coge 1 premio menos.',
  'lively stadium': 'Cada Pokémon básico en juego (de los dos) tiene +30 PS.',
}
for (const [k, texto] of Object.entries(pasivos)) entrenadores[k] = { ...(entrenadores[k] || {}), texto }

// ════════════════════════════════════════════════════════════════════
// ENERGÍAS ESPECIALES
// ════════════════════════════════════════════════════════════════════

const energias = {
  'telepathic psychic energy': {
    texto: 'Da Energía {P}. Cuando la unes de tu mano a un Pokémon {P}, busca en tu mazo hasta 2 Pokémon {P} básicos y ponlos en tu banca. Después, baraja.',
    async alUnir(p, ui, slot) {
      if (!esDeTipo(p.cartaDe(slot), 'P') || p.huecosBanca <= 0) return
      await p.buscarEnMazo(ui, { titulo: 'Energía Psíquica Telepática: hasta 2 básicos Psíquicos a la banca', filtro: (c) => pokemonBasico(c) && esDeTipo(c, 'P'), max: Math.min(2, p.huecosBanca), destino: 'banca' })
    },
  },
  'enriching energy': {
    texto: 'Da Energía {C}. Cuando la unes de tu mano a un Pokémon, roba 4 cartas.',
    alUnir: (p) => robar(p, 4, 'Energía Enriquecedora'),
  },
  'mist energy': { texto: 'Da Energía {C}. Evita todos los efectos de ataques rivales sobre el Pokémon al que está unida.' },
  'boomerang energy': { texto: 'Da Energía {C}. Si se descarta por el efecto de un ataque de su Pokémon, vuelve a unirse a él después de atacar.' },
  'ignition energy': { texto: 'Da {C}, o {C}{C}{C} si está unida a un Pokémon Evolución. Se descarta al final de tu turno.' },
  'growing grass energy': { texto: 'Da Energía {G}. El Pokémon {G} al que está unida tiene +20 PS.' },
  'rocky fighting energy': { texto: 'Da Energía {F}. Evita todos los efectos de ataques rivales sobre el Pokémon {F} al que está unida.' },
  'legacy energy': { texto: 'Da una Energía de cualquier tipo. Si su Pokémon queda fuera de combate por un ataque rival, el rival coge 1 premio menos (una vez por partida).' },
  "team rocket's energy": { texto: 'Solo se une a Pokémon del Team Rocket. Da 2 energías en cualquier combinación de {P} y {D}.' },
  'spiky energy': { texto: 'Da Energía {C}. Si su Pokémon es el activo y recibe daño de un ataque rival, pon 2 contadores en el atacante.' },
  'neo upper energy': { texto: 'Da {C}. Si está unida a un Pokémon de Fase 2, da 2 energías de cualquier tipo.' },
  'prism energy': { texto: 'Da {C}. Si está unida a un Pokémon básico, da una energía de cualquier tipo.' },
  'bubbly water energy': { texto: 'Da Energía {W}. El Pokémon {W} al que está unida se recupera de los estados especiales y no puede sufrirlos.' },
  'voltaic lightning energy': { texto: 'Da Energía {L}. Los ataques del Pokémon {L} al que está unida hacen 20 puntos de daño más al activo rival.' },
  'shadowy darkness energy': { texto: 'Da Energía {D}. Mientras su Pokémon {D} esté en la banca, evita todo el daño de los ataques rivales sobre él.' },
}

// ════════════════════════════════════════════════════════════════════
// HABILIDADES
// ════════════════════════════════════════════════════════════════════
//
// `cuando`: 'bajar' (al ponerlo de la mano en la banca), 'evolucionar'
// (al evolucionar desde la mano) o nada (se usa con su botón).
// `unaPorTurno`: «no puedes usar más de 1 habilidad X por turno», entre
// todos tus Pokémon. Sin ella, es una vez por Pokémon.

const habilidades = {
  'fezandipiti ex': {
    nombre: 'Flip the Script',
    texto: 'Una vez por turno, si alguno de tus Pokémon quedó fuera de combate en el último turno de tu rival, puedes robar 3 cartas.',
    unaPorTurno: true,
    puede: (p) => p.s.koUltimoTurnoRival || 'Solo si el rival te dejó KO un Pokémon en su último turno.',
    usar: (p) => robar(p, 3, 'Fezandipiti ex'),
  },
  'meowth ex': {
    nombre: 'Last-Ditch',
    texto: 'Al bajarlo de la mano a la banca: busca en tu mazo un Partidario, enséñalo y ponlo en tu mano. Después, baraja.',
    cuando: 'bajar',
    unaPorTurno: true,
    puede: (p) => !p.s.flags.usos['hab:Last-Ditch'] || 'Ya has usado una habilidad «Last-Ditch» este turno.',
    usar: (p, ui) => p.buscarEnMazo(ui, { titulo: 'Busca un Partidario', filtro: esPartidario }),
  },
  munkidori: {
    nombre: 'Adrena-Brain',
    texto: 'Una vez por turno, si tiene Energía {D} unida, mueve hasta 3 contadores de daño de 1 de tus Pokémon a 1 de los del rival.',
    puede(p, s) {
      // Ojo Vigilante (Patrat, de cualquiera de los dos): los contadores no
      // se pueden mover (tanda 462).
      const quietos = [p, p.oponente].filter(Boolean).some((j) => j.rasgosEnJuego('contadoresQuietos').length)
      if (quietos) return 'Un Patrat en juego (Ojo Vigilante) impide mover contadores.'
      return s.energias.some((u) => unidadesDeEnergia(p.carta(u), p.cartaDe(s), p).some((x) => x.includes('D') || x.includes('*'))) || 'Necesita Energía Oscura unida.'
    },
    async usar(p, ui) {
      const s = await elegirPropio(p, ui, { titulo: '¿De qué Pokémon tuyo quitas contadores?', filtro: (c, s) => s.danio > 0 })
      if (!s) return p.log('Ninguno de tus Pokémon tiene daño.')
      const n = await ui.numero({ titulo: '¿Cuántos contadores mueves?', min: 1, max: Math.min(3, s.danio / 10), valor: Math.min(3, s.danio / 10) })
      s.danio -= n * 10
      await aUnRival(p, ui, n * 10, { titulo: '¿A qué Pokémon del rival?', contadores: true })
    },
  },
  dudunsparce: {
    nombre: 'Run Away Draw',
    texto: 'Una vez por turno, puedes robar 3 cartas. Si has robado alguna, baraja este Pokémon y todo lo unido con tu mazo.',
    puede: conMazo,
    async usar(p, ui, s) {
      const r = robar(p, 3, 'Dudunsparce')
      if (r.length) {
        const todo = p.cartasDelSlot(s)
        p.quitarDelJuego(s)
        p.alMazo(todo, 'barajar')
        p.log('Dudunsparce y lo unido vuelven al mazo.')
        await p.reponerActivo(ui)
      }
    },
  },
  drakloak: {
    nombre: 'Recon Directive',
    texto: 'Una vez por turno, mira las 2 cartas de arriba de tu mazo y pon 1 en tu mano. La otra va debajo del mazo.',
    puede: conMazo,
    async usar(p, ui) {
      const vistas = p.mirarArriba(2)
      const [u] = await ui.cartas({ titulo: 'Las 2 de arriba: una a la mano, la otra abajo', opciones: vistas, min: 1, max: 1, zona: 'mazo' })
      p.sacarDelMazo(u)
      p.s.mano.push(u)
      const otra = vistas.find((x) => x !== u)
      if (otra) {
        p.sacarDelMazo(otra)
        p.alMazo([otra], 'abajo')
      }
      p.log(`A la mano: ${p.nombre(u)}${otra ? `; ${p.nombre(otra)} va abajo` : ''}.`)
    },
  },
  'mega kangaskhan ex': {
    nombre: 'Run Errand',
    texto: 'Una vez por turno, si está en el puesto activo, roba 2 cartas.',
    soloActivo: true,
    unaPorTurno: true,
    usar: (p) => robar(p, 2, 'Mega Kangaskhan ex'),
  },
  dusknoir: {
    nombre: 'Cursed Blast',
    texto: 'Una vez por turno, pon 13 contadores de daño en 1 de los Pokémon del rival. Si la usas, este Pokémon queda fuera de combate.',
    puede: (p) => !p.hayHabilidadActiva('psyduck') || 'Psyduck (Humedad) lo impide.',
    async usar(p, ui, s) {
      await aUnRival(p, ui, 130, { titulo: '13 contadores: ¿a quién?', contadores: true })
      p.koPropio(s, { texto: 'Explosión Maldita' })
      await p.resolverKORival(ui)
      await p.reponerActivo(ui)
    },
  },
  dusclops: {
    nombre: 'Cursed Blast',
    texto: 'Una vez por turno, pon 5 contadores de daño en 1 de los Pokémon del rival. Si la usas, este Pokémon queda fuera de combate.',
    puede: (p) => !p.hayHabilidadActiva('psyduck') || 'Psyduck (Humedad) lo impide.',
    async usar(p, ui, s) {
      await aUnRival(p, ui, 50, { titulo: '5 contadores: ¿a quién?', contadores: true })
      p.koPropio(s, { texto: 'Explosión Maldita' })
      await p.resolverKORival(ui)
      await p.reponerActivo(ui)
    },
  },
  'pecharunt ex': {
    nombre: 'Subjugating Chains',
    texto: 'Una vez por turno, cambia 1 de tus Pokémon {D} en la banca (que no sea Pecharunt ex) por tu activo. El nuevo activo queda Envenenado.',
    unaPorTurno: true,
    puede: (p) => p.s.banca.some((s) => esDeTipo(p.cartaDe(s), 'D') && claveDeEfecto(p.cartaDe(s)) !== 'pecharunt ex') || 'No tienes otro Pokémon Oscuro en la banca.',
    async usar(p, ui) {
      const s = await elegirPropio(p, ui, { titulo: 'El Pokémon Oscuro que sube', filtro: (c, s) => s !== p.s.activo && esDeTipo(c, 'D') && claveDeEfecto(c) !== 'pecharunt ex' })
      p.cambiarActivo(s)
      ponerEstado(s, 'envenenado')
    },
  },
  'teal mask ogerpon ex': {
    nombre: 'Teal Dance',
    texto: 'Una vez por turno, une una Energía {G} básica de tu mano a este Pokémon. Si lo haces, roba una carta.',
    puede: (p) => p.s.mano.some((u) => basicaDe('G')(p.carta(u))) || 'No tienes Energía Planta básica en la mano.',
    async usar(p, ui, s) {
      const [u] = await ui.cartas({ titulo: 'Una Energía Planta básica de tu mano', opciones: p.s.mano.filter((x) => basicaDe('G')(p.carta(x))), min: 1, max: 1, zona: 'mano' })
      p.unirEnergia(u, s, { desde: 'mano' })
      robar(p, 1, 'Ogerpon ex')
    },
  },
  alakazam: {
    nombre: 'Psychic Draw',
    texto: 'Al evolucionar desde la mano: roba 3 cartas.',
    cuando: 'evolucionar',
    usar: (p) => robar(p, 3, 'Alakazam'),
  },
  kadabra: {
    nombre: 'Psychic Draw',
    texto: 'Al evolucionar desde la mano: roba 2 cartas.',
    cuando: 'evolucionar',
    usar: (p) => robar(p, 2, 'Kadabra'),
  },
  'genesect ex': {
    nombre: 'Metallic Signal',
    texto: 'Una vez por turno, busca en tu mazo hasta 2 Pokémon Evolución {M}, enséñalos y ponlos en tu mano. Después, baraja.',
    usar: (p, ui) => p.buscarEnMazo(ui, { titulo: 'Hasta 2 Evoluciones Metálicas', filtro: (c) => esPokemon(c) && esEvolucion(c) && esDeTipo(c, 'M'), max: 2 }),
  },
  'iron leaves ex': {
    nombre: 'Rapid Vernier',
    texto: 'Al bajarlo de la mano a la banca: puedes cambiarlo por tu activo y, si lo haces, mover las Energías que quieras de tus otros Pokémon a este.',
    cuando: 'bajar',
    async usar(p, ui, s) {
      p.cambiarActivo(s)
      for (;;) {
        const origenes = p.enJuego.filter((x) => x !== s && x.energias.length)
        if (!origenes.length) break
        const ids = await ui.pokemon({ titulo: '¿De quién mueves energía? (ninguno para terminar)', opciones: origenes.map((x) => x.id), min: 0, max: 1 })
        if (!ids.length) break
        const o = p.slot(ids[0])
        const us = await ui.cartas({ titulo: 'Qué energías pasan a Iron Leaves ex', opciones: [...o.energias], min: 0, max: o.energias.length })
        o.energias = o.energias.filter((u) => !us.includes(u))
        s.energias.push(...us)
      }
    },
  },
  "n's zoroark ex": {
    nombre: 'Trade',
    texto: 'Una vez por turno, descarta una carta de tu mano para robar 2 cartas.',
    puede: (p) => p.s.mano.length > 0 || 'Necesitas una carta en la mano para descartarla.',
    async usar(p, ui) {
      await descartarDeMano(p, ui, 1)
      robar(p, 2, 'Zoroark ex de N')
    },
  },
  'chien-pao': {
    nombre: 'Snow Sink',
    texto: 'Al bajarlo de la mano a la banca: puedes descartar un Estadio en juego.',
    cuando: 'bajar',
    puede: (p) => !!p.s.estadio || 'No hay estadio.',
    usar(p) {
      if (!p.s.estadio) return
      p.log(`${p.nombre(p.s.estadio)} se descarta.`)
      p.quitarEstadio()
    },
  },
  tatsugiri: {
    nombre: 'Attract Customers',
    texto: 'Una vez por turno, si está en el puesto activo, mira las 6 de arriba de tu mazo y pon un Partidario de entre ellas en tu mano. Baraja las demás.',
    soloActivo: true,
    puede: conMazo,
    usar: (p, ui) => mirarYCoger(p, ui, 6, { titulo: 'Las 6 de arriba: puedes coger un Partidario', filtro: esPartidario }),
  },
  metang: {
    nombre: 'Metal Maker',
    texto: 'Una vez por turno, mira las 4 de arriba de tu mazo y une a tus Pokémon las Energías {M} básicas que haya, como quieras. Las demás, barajadas, debajo del mazo.',
    puede: conMazo,
    async usar(p, ui) {
      const vistas = p.mirarArriba(4)
      const metal = vistas.filter((u) => basicaDe('M')(p.carta(u)))
      const el = await ui.cartas({ titulo: 'Las 4 de arriba: las Energías Metal que unes', opciones: vistas, elegibles: metal, min: 0, max: metal.length, zona: 'mazo' })
      for (const u of el) {
        const [id] = await ui.pokemon({ titulo: `¿A quién unes ${p.nombre(u)}?`, opciones: p.enJuego.map((s) => s.id), min: 1, max: 1 })
        p.unirEnergia(u, p.slot(id), { desde: 'mazo' })
      }
      const resto = vistas.filter((u) => !el.includes(u))
      for (const u of resto) p.sacarDelMazo(u)
      p.alMazo(resto, 'abajo')
    },
  },
  lunatone: {
    nombre: 'Lunar Cycle',
    texto: 'Una vez por turno, si tienes a Solrock en juego, descarta una Energía {F} básica de tu mano para robar 3 cartas.',
    unaPorTurno: true,
    puede: (p) => (p.enJuego.some((s) => claveDeEfecto(p.cartaDe(s)) === 'solrock') ? p.s.mano.some((u) => basicaDe('F')(p.carta(u))) || 'No tienes Energía Lucha básica en la mano.' : 'Necesitas a Solrock en juego.'),
    async usar(p, ui) {
      await descartarDeMano(p, ui, 1, { titulo: 'Descarta una Energía Lucha básica', filtro: basicaDe('F') })
      robar(p, 3, 'Lunatone')
    },
  },
  'fan rotom': {
    nombre: 'Fan Call',
    texto: 'Una vez en tu primer turno, busca en tu mazo hasta 3 Pokémon {C} con 100 PS o menos, enséñalos y ponlos en tu mano. Después, baraja.',
    unaPorTurno: true,
    puede: (p) => p.esMiPrimerTurno || 'Solo en tu primer turno.',
    usar: (p, ui) => p.buscarEnMazo(ui, { titulo: 'Hasta 3 Pokémon Incoloros de 100 PS o menos', filtro: (c) => esPokemon(c) && esDeTipo(c, 'C') && psHasta(100)(c), max: 3 }),
  },
  thwackey: {
    nombre: 'Boom Boom Groove',
    texto: 'Una vez por turno, si tu activo tiene la habilidad Festival Lead, busca en tu mazo una carta y ponla en tu mano. Después, baraja.',
    puede: (p) => ['dipplin', 'goldeen', 'seaking', 'hoothoot', 'grookey'].includes(claveDeEfecto(p.cartaDe(p.s.activo))) || 'Tu activo tiene que tener Festival Lead.',
    usar: (p, ui) => p.buscarEnMazo(ui, { titulo: 'Una carta cualquiera' }),
  },
  toxtricity: {
    nombre: 'Sinister Surge',
    texto: 'Una vez por turno, busca en tu mazo una Energía {D} básica y únela a 1 de tus Pokémon {D} en la banca. Pon 2 contadores de daño en ese Pokémon. Después, baraja.',
    async usar(p, ui) {
      const unidas = await unirDesdeMazo(p, ui, { titulo: 'Una Energía Oscura básica', filtroEnergia: basicaDe('D'), filtroPokemon: (c, s) => s !== p.s.activo && esDeTipo(c, 'D'), max: 1 })
      for (const { slot } of unidas) p.ponerDanio(slot, 20, { motivo: 'Oleada Siniestra' })
    },
  },
  'blaziken ex': {
    nombre: 'Seething Spirit',
    texto: 'Una vez por turno, une una Energía básica de tu pila de descartes a 1 de tus Pokémon.',
    puede: (p) => hayEnDescarte(p, basica, 'No tienes Energías básicas en el descarte.'),
    usar: (p, ui) => unirDesdeDescarte(p, ui, { filtroEnergia: basica, max: 1, titulo: 'Una Energía básica del descarte' }),
  },
  hariyama: {
    nombre: 'Heave-Ho Catcher',
    texto: 'Al evolucionar desde la mano: cambia 1 de los Pokémon en la banca del rival por su activo.',
    cuando: 'evolucionar',
    puede: rivalConBanca,
    usar: (p, ui) => atraerRival(p, ui),
  },
  "hop's dubwool": {
    nombre: 'Defiant Horn',
    texto: 'Al evolucionar desde la mano: puedes cambiar 1 de los Pokémon en la banca del rival por su activo.',
    cuando: 'evolucionar',
    puede: rivalConBanca,
    usar: (p, ui) => atraerRival(p, ui),
  },
  'hydrapple ex': {
    nombre: 'Ripening Charge',
    texto: 'Una vez por turno, une una Energía {G} básica de tu mano a 1 de tus Pokémon. Si lo haces, cúrale 30.',
    puede: (p) => p.s.mano.some((u) => basicaDe('G')(p.carta(u))) || 'No tienes Energía Planta básica en la mano.',
    async usar(p, ui) {
      const [u] = await ui.cartas({ titulo: 'Una Energía Planta básica de tu mano', opciones: p.s.mano.filter((x) => basicaDe('G')(p.carta(x))), min: 1, max: 1, zona: 'mano' })
      const s = await elegirPropio(p, ui, { titulo: '¿A quién la unes?' })
      p.unirEnergia(u, s, { desde: 'mano' })
      p.curar(s, 30)
    },
  },
  "marnie's grimmsnarl ex": {
    nombre: 'Punk Up',
    texto: 'Al evolucionar desde la mano: busca en tu mazo hasta 5 Energías {D} básicas y únelas a tus Pokémon de Roxy como quieras. Después, baraja.',
    cuando: 'evolucionar',
    usar: (p, ui) => unirDesdeMazo(p, ui, { titulo: 'Hasta 5 Energías Oscuras básicas', filtroEnergia: basicaDe('D'), filtroPokemon: (c) => esDe(c, 'marnie'), max: 5 }),
  },
  "cynthia's gabite": {
    nombre: "Champion's Call",
    texto: 'Una vez por turno, busca en tu mazo un Pokémon de Cintia, enséñalo y ponlo en tu mano. Después, baraja.',
    usar: (p, ui) => p.buscarEnMazo(ui, { titulo: 'Un Pokémon de Cintia', filtro: (c) => esPokemon(c) && esDe(c, 'cynthia') }),
  },
  "team rocket's spidops": {
    nombre: 'Charging Up',
    texto: 'Una vez por turno, une a este Pokémon una Energía básica de tu pila de descartes.',
    puede: (p) => hayEnDescarte(p, basica, 'No tienes Energías básicas en el descarte.'),
    async usar(p, ui, s) {
      const [u] = await ui.cartas({ titulo: 'Una Energía básica del descarte', opciones: p.s.descarte.filter((x) => basica(p.carta(x))), min: 1, max: 1, zona: 'descarte' })
      p.unirEnergia(u, s, { desde: 'descarte' })
    },
  },
  "steven's metagross ex": {
    nombre: 'X-Boot',
    texto: 'Una vez por turno, busca en tu mazo una Energía {P} básica, una {M} básica, o una de cada, y únelas a tus Pokémon {P} y {M} como quieras. Después, baraja.',
    usar: (p, ui) =>
      unirDesdeMazo(p, ui, {
        titulo: 'Una Energía Psíquica y/o una Metal básicas',
        filtroEnergia: (c) => basicaDe('P')(c) || basicaDe('M')(c),
        filtroPokemon: (c, s, u) => esDeTipo(c, letraDeCartaDeEnergia(p.carta(u))),
        max: 2,
        validar: (sel) => (sel.length === 2 && letraDeCartaDeEnergia(p.carta(sel[0])) === letraDeCartaDeEnergia(p.carta(sel[1])) ? 'Una de cada tipo, como mucho.' : null),
      }),
  },
  noctowl: {
    nombre: 'Jewel Seeker',
    texto: 'Al evolucionar desde la mano, si tienes un Pokémon Teracristal en juego: busca en tu mazo hasta 2 cartas de Entrenador, enséñalas y ponlas en tu mano. Después, baraja.',
    cuando: 'evolucionar',
    puede: (p) => p.enJuego.some((s) => esTera(p.cartaDe(s))) || 'Necesitas un Pokémon Teracristal en juego.',
    usar: (p, ui) => p.buscarEnMazo(ui, { titulo: 'Hasta 2 Entrenadores', filtro: esEntrenador, max: 2 }),
  },
  'mega greninja ex': {
    nombre: 'Mortal Shuriken',
    texto: 'Una vez por turno, si está en el puesto activo, descarta una Energía {W} básica de tu mano para poner 6 contadores de daño en 1 de los Pokémon del rival.',
    soloActivo: true,
    puede: (p) => p.s.mano.some((u) => basicaDe('W')(p.carta(u))) || 'No tienes Energía Agua básica en la mano.',
    async usar(p, ui) {
      await descartarDeMano(p, ui, 1, { titulo: 'Descarta una Energía Agua básica', filtro: basicaDe('W') })
      await aUnRival(p, ui, 60, { titulo: '6 contadores: ¿a quién?', contadores: true })
      await p.resolverKORival(ui)
    },
  },
  toucannon: {
    nombre: 'Aerial Draw',
    texto: 'Una vez por turno, roba una carta.',
    puede: conMazo,
    usar: (p) => robar(p, 1, 'Toucannon'),
  },
  chandelure: {
    nombre: 'Alluring Light',
    texto: 'Una vez por turno, cada jugador roba una carta.',
    puede: conMazo,
    usar: (p) => robar(p, 1, 'Chandelure'),
  },
  "ethan's quilava": {
    nombre: 'Bonded by the Journey',
    texto: 'Una vez por turno, busca en tu mazo una Aventura de Eco, enséñala y ponla en tu mano. Después, baraja.',
    usar: (p, ui) => p.buscarEnMazo(ui, { titulo: 'Una Aventura de Eco', filtro: (c) => claveDeEfecto(c) === "ethan's adventure" }),
  },
  'mega venusaur ex': {
    nombre: 'Solar Transfer',
    texto: 'Tantas veces como quieras en tu turno: mueve una Energía {G} básica de 1 de tus Pokémon a otro.',
    variasVeces: true,
    puede: (p) => (p.enJuego.length > 1 && p.enJuego.some((s) => s.energias.some((u) => basicaDe('G')(p.carta(u))))) || 'No hay Energía Planta básica que mover.',
    usar: (p, ui) => moverEnergia(p, ui, { filtro: basicaDe('G'), titulo: 'Mueve una Energía Planta' }),
  },
  eelektrik: {
    nombre: 'Dynamotor',
    texto: 'Una vez por turno (antes de atacar), une una Energía {L} de tu pila de descartes a 1 de tus Pokémon en la banca.',
    puede: (p) => hayEnDescarte(p, (c) => esEnergia(c) && letraDeCartaDeEnergia(c) === 'L', 'No tienes Energía Rayo en el descarte.'),
    usar: (p, ui) => unirDesdeDescarte(p, ui, { filtroEnergia: (c) => esEnergia(c) && letraDeCartaDeEnergia(c) === 'L', filtroPokemon: (c, s) => s !== p.s.activo, max: 1, titulo: 'Una Energía Rayo del descarte' }),
  },
  'volcanion ex': {
    nombre: 'Scalding Steam',
    texto: 'Una vez por turno, si está en el puesto activo, deja Quemado al activo rival.',
    soloActivo: true,
    usar(p) {
      ponerEstado(p.rival.activo, 'quemado')
      p.log('El activo rival queda quemado.')
    },
  },
  "iono's kilowattrel": {
    nombre: 'Flashing Draw',
    texto: 'Descarta una Energía {L} básica de este Pokémon para usarla. Una vez por turno, roba hasta tener 6 cartas en la mano.',
    puede: (p, s) => (s.energias.some((u) => basicaDe('L')(p.carta(u))) ? p.s.mano.length < 6 || 'Ya tienes 6 cartas o más.' : 'Necesita una Energía Rayo básica unida.'),
    usar(p, ui, s) {
      const u = s.energias.find((x) => basicaDe('L')(p.carta(x)))
      s.energias = s.energias.filter((x) => x !== u)
      p.s.descarte.push(u)
      p.robarHasta(6, { motivo: 'Kilowattrel de Iris' })
    },
  },
  // Las pasivas que el motor ya aplica al calcular (retirada, energía):
  // se declaran para que el menú diga «se activa sola».
  'latias ex': { nombre: 'Skyliner', texto: 'Tus Pokémon básicos en juego no tienen coste de retirada.', pasiva: true },
  meganium: { nombre: 'Wild Growth', texto: 'Cada Energía {G} básica unida a tus Pokémon da {G}{G}.', pasiva: true },
  'mew ex': { nombre: 'Memory Helix', texto: 'Puede usar los ataques de tus Pokémon en la banca (con la energía que pida cada uno).', pasiva: true },
  froslass: { nombre: 'Freezing Shroud', texto: 'En cada Chequeo Pokémon, pon 1 contador en cada Pokémon con Habilidad (de los dos), salvo en los Froslass.', pasiva: true },
  psyduck: { nombre: 'Damp', texto: 'Los Pokémon en juego (de los dos) pierden las Habilidades que les obligan a quedar fuera de combate.', pasiva: true },
}

// ════════════════════════════════════════════════════════════════════
// ATAQUES
// ════════════════════════════════════════════════════════════════════
//
// Por la POSICIÓN del ataque en la carta (#0, #1): el nombre del espejo
// puede venir en español. `usar` devuelve el daño al activo rival (o no
// devuelve nada y vale el impreso).

const cuentaBanca = (p) => p.s.banca.length + p.rival.banca.length
const buscaAtaque = (titulo, filtro, max = 1, destino = 'mano') => ({ usar: (p, ui, s, { base }) => p.buscarEnMazo(ui, { titulo, filtro, max, destino }).then(() => base) })
const robaAtaque = (n, motivo) => ({ usar: (p, ui, s, { base }) => (robar(p, n, motivo), base) })
const cambiaAtaque = { usar: async (p, ui, s, { base }) => (await p.elegirYCambiar(ui, '¿Quién pasa al puesto activo?'), base) }
const llamarFamilia = { usar: (p, ui, s, { base }) => p.buscarEnMazo(ui, { titulo: 'Hasta 2 básicos a la banca', filtro: pokemonBasico, max: Math.min(2, p.huecosBanca), destino: 'banca' }).then(() => base) }
// «Durante tu próximo turno, este Pokémon no puede atacar» (todo) y
// «…no puede usar X» (solo ese ataque).
const noAtacaSiguiente = { despues: (p, ui, s) => (s.bloqueo = { turno: p.s.turno + 1, indice: null }) }
const noRepite = (i) => ({ despues: (p, ui, s) => (s.bloqueo = { turno: p.s.turno + 1, indice: i }) })

const ataques = {
  'dragapult ex': {
    '#1': { async usar(p, ui, s, { base }) { await repartirContadores(p, ui, 6, { donde: 'banca', titulo: 'Picado Fantasma: 6 contadores en la banca rival' }); return base } },
  },
  'fezandipiti ex': { '#0': { async usar(p, ui) { await aUnRival(p, ui, 100, { titulo: '100 de daño a 1 de los Pokémon del rival' }); return 0 } } },
  dunsparce: { '#0': cambiaAtaque },
  abra: { '#0': { async usar(p, ui, s, { base }) { await p.elegirYCambiar(ui); return base } } },
  buneary: { '#0': cambiaAtaque },
  duskull: {
    '#0': {
      async usar(p, ui) {
        const el = await ui.cartas({ titulo: 'Hasta 3 Duskull del descarte a la banca', opciones: p.s.descarte.filter((u) => claveDeEfecto(p.carta(u)) === 'duskull'), min: 0, max: Math.min(3, p.huecosBanca), zona: 'descarte' })
        for (const u of el) {
          p.s.descarte.splice(p.s.descarte.indexOf(u), 1)
          const nuevo = p.nuevoSlot(u)
          p.s.banca.push(nuevo)
          p.alEntrarEnBanca(nuevo)
        }
        return 0
      },
    },
  },
  slowpoke: { '#0': { usar: (p, ui) => recuperar(p, ui, { titulo: 'Un Pokémon del descarte a la mano', filtro: esPokemon, max: 1 }).then(() => 0) } },
  'raging bolt ex': {
    '#0': { usar(p) { p.descartar([...p.s.mano]); robar(p, 6, 'Rugido Ráfaga'); return 0 } },
    '#1': {
      async usar(p, ui) {
        const todas = p.enJuego.flatMap((s) => s.energias.filter((u) => basica(p.carta(u))))
        const el = await ui.cartas({ titulo: 'Descarta Energías básicas de tus Pokémon (70 por cada una)', opciones: todas, min: 0, max: todas.length })
        for (const s of p.enJuego) s.energias = s.energias.filter((u) => !el.includes(u))
        p.s.descarte.push(...el)
        return 70 * el.length
      },
    },
  },
  torchic: { '#0': robaAtaque(1, 'Recoger') },
  froakie: { '#0': robaAtaque(1, 'Recoger') },
  "marnie's impidimp": { '#0': robaAtaque(1, 'Hurtar') },
  'chi-yu': { '#0': robaAtaque(2, 'Seducción') },
  comfey: { '#0': robaAtaque(3, 'Lluvia de Flores') },
  seaking: { '#0': robaAtaque(2, 'Robo Rápido') },
  'mega sharpedo ex': { '#0': robaAtaque(2, 'Colmillo Voraz'), '#1': { usar: (p, ui, s, { base }) => base + (s.danio > 0 ? 150 : 0) } },
  'jirachi ex': { '#0': { usar: (p) => (p.robarHasta(7, { motivo: 'Concededeseos' }), 0) } },
  "cynthia's garchomp ex": {
    '#0': { async usar(p, ui, s, { base }) { if (await ui.confirmar({ titulo: 'Picado Sacacorchos', texto: '¿Robas hasta tener 6 cartas?' })) p.robarHasta(6, { motivo: 'Picado Sacacorchos' }); return base } },
    '#1': { usar: (p, ui, s, { base }) => { p.s.descarte.push(...s.energias); s.energias = []; return base } },
  },
  frogadier: { '#0': buscaAtaque('Hasta 3 Pokémon', esPokemon, 3) },
  piplup: { '#0': buscaAtaque('Un Partidario', esPartidario) },
  "team rocket's murkrow": { '#0': buscaAtaque('Un Partidario', esPartidario) },
  celebi: { '#0': buscaAtaque('Hasta 3 Pokémon Planta o Estadios', (c) => (esPokemon(c) && esDeTipo(c, 'G')) || esEstadio(c), 3) },
  lampent: { '#0': { usar: (p, ui) => p.buscarEnMazo(ui, { titulo: 'Hasta 3 Lampent a la banca', filtro: (c) => claveDeEfecto(c) === 'lampent', max: Math.min(3, p.huecosBanca), destino: 'banca' }).then(() => 0) } },
  drilbur: { '#0': llamarFamilia },
  toxel: { '#0': llamarFamilia },
  dwebble: {
    '#0': {
      async usar(p, ui, s) {
        p.verMazo()
        const el = await ui.cartas({ titulo: 'Una carta que evolucione de este Pokémon', opciones: [...p.s.mazo], elegibles: p.s.mazo.filter((u) => evolucionaDe(p.carta(u), p.cartaDe(s))), min: 0, max: 1, zona: 'mazo' })
        if (el.length) await p.evolucionar(el[0], s, ui, { desdeMazo: true, sinHabilidad: true }).catch(() => {})
        p.barajar()
        return 0
      },
    },
  },
  dedenne: { '#0': { usar: (p, ui) => recuperar(p, ui, { titulo: 'Un Entrenador del descarte a la mano', filtro: esEntrenador, max: 1 }).then(() => 0) } },
  'greninja ex': {
    '#0': { async usar(p, ui, s, { base }) { await p.buscarEnMazo(ui, { titulo: 'Una carta cualquiera', max: 1 }); return base } },
    '#1': {
      async usar(p, ui, s) {
        const fuera = await ui.cartas({ titulo: 'Descarta 2 energías de este Pokémon', opciones: [...s.energias], min: Math.min(2, s.energias.length), max: 2 })
        s.energias = s.energias.filter((u) => !fuera.includes(u))
        p.s.descarte.push(...fuera)
        const objetivos = [p.rival.activo, ...p.rival.banca].filter(Boolean)
        const ids = await ui.pokemon({ titulo: '120 de daño a 2 de los Pokémon del rival', opciones: objetivos.map((d) => d.id), min: Math.min(2, objetivos.length), max: 2 })
        for (const d of objetivos) if (ids.includes(d.id)) p.danioAlRival(d, 120)
        return 0
      },
    },
  },
  banette: { '#0': { async usar(p, ui, s, { base }) { await p.buscarEnMazo(ui, { titulo: 'Una carta cualquiera', max: 1 }); return base } } },
  'mega lucario ex': {
    '#0': { async usar(p, ui, s, { base }) { await unirDesdeDescarte(p, ui, { filtroEnergia: basicaDe('F'), filtroPokemon: (c, x) => x !== p.s.activo, max: 3, titulo: 'Energía Lucha básica del descarte' }); return base } },
    '#1': noRepite(1),
  },
  riolu: { '#0': noRepite(0) },
  'mega kangaskhan ex': {
    '#0': { usar(p, ui, s, { base }) { let caras = 0; while (p.moneda()) caras++; return base + 50 * caras } },
  },
  // Contadores, no daño: no le suman los bonos de daño.
  alakazam: { '#0': { usar: (p) => (p.danioAlRival(p.rival.activo, 20 * p.s.mano.length, { contadores: true }), 0) } },
  'mega excadrill ex': {
    '#1': { usar: (p, ui, s, { base, ataque }) => base + (p.unidadesDe(s).length >= costeEnLetras(ataque).length + 2 ? 130 : 0) },
  },
  'teal mask ogerpon ex': { '#0': { usar: (p, ui, s, { base }) => base + 30 * p.unidadesDe(s).length } },
  "lillie's clefairy ex": { '#0': { usar: (p, ui, s, { base }) => base + 20 * cuentaBanca(p) } },
  toucannon: { '#0': { usar: (p, ui, s, { base }) => base + 20 * cuentaBanca(p) } },
  dipplin: { '#0': { usar: (p) => 20 * p.s.banca.length } },
  passimian: { '#0': { usar: (p) => 20 * p.enJuego.filter((x) => esBasicoEnJuego(p.cartaDe(x))).length } },
  'beedrill ex': { '#0': { usar: (p) => 110 * p.enJuego.filter((x) => /^beedrill( ex)?$/.test(claveDeEfecto(p.cartaDe(x)))).length } },
  'pecharunt ex': { '#0': { usar: (p) => 60 * (6 - p.rival.premios) } },
  'mega mawile ex': { '#0': { usar: (p) => 80 * (6 - p.s.premios.length) }, '#1': { usar: (p, ui, s, { base }) => (p.rival.activo?.danio > 0 ? 30 : base) } },
  moltres: { '#0': { usar: (p, ui, s, { base }) => base + (p.rival.activo?.ex ? 90 : 0) } },
  'blaziken ex': { '#0': noAtacaSiguiente },
  'iron leaves ex': { '#0': noAtacaSiguiente },
  'latias ex': { '#0': noAtacaSiguiente },
  "n's zekrom": { '#1': noAtacaSiguiente },
  'bloodmoon ursaluna ex': { '#0': { ...noAtacaSiguiente, rebaja: (p) => 6 - p.rival.premios } },
  'mega starmie ex': { '#0': { async usar(p, ui, s, { base }) { if (p.rival.banca.length) await aUnRival(p, ui, 50, { titulo: '50 de daño a 1 de la banca rival', soloBanca: true }); return base } } },
  'wellspring mask ogerpon ex': {
    '#1': {
      async usar(p, ui, s, { base }) {
        if (s.energias.length >= 3 && p.rival.banca.length && (await ui.confirmar({ titulo: 'Bomba Torrencial', texto: '¿Barajas 3 energías de este Pokémon con tu mazo para hacer 120 a la banca?' }))) {
          const el = await ui.cartas({ titulo: '3 energías al mazo', opciones: [...s.energias], min: 3, max: 3 })
          s.energias = s.energias.filter((u) => !el.includes(u))
          p.alMazo(el, 'barajar')
          await aUnRival(p, ui, 120, { soloBanca: true, titulo: '120 de daño a 1 de la banca rival' })
        }
        return base
      },
    },
  },
  'mega skarmory ex': {
    '#0': {
      async usar(p, ui, s) {
        p.alMazo(s.energias.splice(0), 'barajar')
        await aUnRival(p, ui, 220, { titulo: '220 de daño a 1 de los Pokémon del rival' })
        return 0
      },
    },
  },
  zeraora: {
    '#1': {
      async usar(p, ui, s) {
        p.s.descarte.push(...s.energias.splice(0))
        await aUnRival(p, ui, 210, { soloBanca: true, soloEx: true, titulo: '210 a 1 de los Pokémon ex en la banca rival' })
        return 0
      },
    },
  },
  "n's darmanitan": { '#1': { async usar(p, ui, s, { base }) { p.s.descarte.push(...s.energias.splice(0)); if (p.rival.banca.length) await aUnRival(p, ui, 90, { soloBanca: true, titulo: '90 a 1 de la banca rival' }); return base } } },
  "marnie's grimmsnarl ex": { '#0': { async usar(p, ui, s, { base }) { if (p.rival.banca.length) await aUnRival(p, ui, 30, { soloBanca: true, titulo: '30 a 1 de la banca rival' }); return base } } },
  "hop's zacian ex": { '#0': { async usar(p, ui, s, { base }) { if (p.rival.banca.length) await aUnRival(p, ui, 30, { soloBanca: true, titulo: '30 a 1 de la banca rival' }); return base } }, '#1': noRepite(1) },
  'flutter mane': { '#0': { async usar(p, ui, s, { base }) { if (p.rival.banca.length) await repartirContadores(p, ui, 2, { donde: 'banca' }); return base } } },
  'gengar ex': { '#0': { async usar(p, ui) { await aUnRival(p, ui, 130, { titulo: '13 contadores: ¿a quién?', contadores: true }); return 0 } } },
  kyurem: { '#0': { async usar(p, ui, s) { p.s.descarte.push(...s.energias.splice(0)); const objetivos = [p.rival.activo, ...p.rival.banca].filter(Boolean); const ids = await ui.pokemon({ titulo: '110 de daño a 3 de los Pokémon del rival', opciones: objetivos.map((d) => d.id), min: Math.min(3, objetivos.length), max: 3 }); for (const d of objetivos) if (ids.includes(d.id)) p.danioAlRival(d, 110); return 0 } } },
  'iron crown ex': { '#0': { async usar(p, ui) { const objetivos = [p.rival.activo, ...p.rival.banca].filter(Boolean); const ids = await ui.pokemon({ titulo: '50 de daño a 2 de los Pokémon del rival', opciones: objetivos.map((d) => d.id), min: Math.min(2, objetivos.length), max: 2 }); for (const d of objetivos) if (ids.includes(d.id)) p.danioAlRival(d, 50); return 0 } } },
  'arboliva ex': {
    '#0': {
      async usar(p, ui) {
        const objetivos = [p.rival.activo, ...p.rival.banca].filter(Boolean)
        const reparto = await ui.repartir({ titulo: 'Salva de Aceite: elige 6 veces (20 de daño cada una)', total: 6, opciones: objetivos.map((d) => d.id) })
        for (const d of objetivos) if (reparto[d.id]) p.danioAlRival(d, 20 * reparto[d.id])
        return 0
      },
    },
  },
  'mega eelektross ex': { '#0': { async usar(p, ui) { const objetivos = [p.rival.activo, ...p.rival.banca].filter(Boolean); const ids = await ui.pokemon({ titulo: '60 de daño a 2 de los Pokémon del rival', opciones: objetivos.map((d) => d.id), min: Math.min(2, objetivos.length), max: 2 }); for (const d of objetivos) if (ids.includes(d.id)) p.danioAlRival(d, 60); return 0 } } },
  'dudunsparce ex': { '#0': { usar: (p) => 60 * [p.rival.activo, ...p.rival.banca].filter((d) => d?.ex).length } },
  'mega absol ex': { '#0': { usar(p) { const r = p.rival.activo; if (r && r.danio === 60) { r.danio = r.ps; p.log('El activo rival tenía 6 contadores: queda fuera de combate.') } return 0 } } },
  'ethan\'s typhlosion': { '#0': { usar: (p, ui, s, { base }) => base + 60 * p.s.descarte.filter((u) => claveDeEfecto(p.carta(u)) === "ethan's adventure").length } },
}

// El daño impreso de cada ataque de las cartas de arriba (Limitless,
// 2026-09-30). Es la FIRMA con la que se reconoce la carta: dos Pokémon
// con el mismo nombre pueden tener ataques distintos (un Dunsparce de
// otra colección), y aplicarle a uno el efecto del otro sería peor que
// no aplicar nada. Si el daño de la carta no casa con la firma, el
// ataque se trata como no automatizado.
const firmas = {"dragapult ex":["70","200"],"fezandipiti ex":[""],"dunsparce":["","20"],"abra":["10"],"buneary":["","20"],"duskull":["","30"],"slowpoke":["","30"],"raging bolt ex":["","70"],"torchic":["","10"],"froakie":["","10"],"marnie's impidimp":["","10"],"chi-yu":["","60"],"comfey":["","20"],"seaking":["60"],"mega sharpedo ex":["70","120"],"jirachi ex":["","150"],"cynthia's garchomp ex":["100","260"],"frogadier":["","50"],"piplup":["","20"],"team rocket's murkrow":["","30"],"celebi":["","30"],"lampent":[""],"drilbur":["","50"],"toxel":["","20"],"dwebble":[""],"dedenne":["","30"],"greninja ex":["170",""],"banette":["80"],"mega lucario ex":["130","270"],"riolu":["30"],"mega kangaskhan ex":["200"],"alakazam":[""],"mega excadrill ex":["90","200"],"teal mask ogerpon ex":["30"],"lillie's clefairy ex":["20"],"toucannon":["60"],"dipplin":["20"],"passimian":["20"],"beedrill ex":["110"],"pecharunt ex":["60"],"mega mawile ex":["80","260"],"moltres":["20"],"blaziken ex":["200"],"iron leaves ex":["180"],"latias ex":["200"],"n's zekrom":["70","250"],"bloodmoon ursaluna ex":["240"],"mega starmie ex":["120","210"],"wellspring mask ogerpon ex":["20","100"],"mega skarmory ex":[""],"zeraora":["20",""],"n's darmanitan":["30","90"],"marnie's grimmsnarl ex":["180"],"hop's zacian ex":["30","240"],"flutter mane":["90"],"gengar ex":[""],"kyurem":[""],"iron crown ex":[""],"arboliva ex":["","160"],"mega eelektross ex":["","190"],"dudunsparce ex":["60","150"],"mega absol ex":["","200"],"ethan's typhlosion":["40","160"]}

// Las claves se escriben aquí como se leen («poké pad», «pokégear 3.0»)
// y se guardan como las busca el motor: con `claveDeEfecto`, sin tildes.
// Escribirlas ya en plano sería fácil de olvidar en la próxima carta con
// tilde — y una clave con tilde no casa NUNCA, sin dar error (le pasó a
// Poké Pad, la cuarta carta más jugada del meta, en la primera versión).
const enPlano = (tabla) => Object.fromEntries(Object.entries(tabla).map(([k, v]) => [claveDeEfecto({ name: k }), v]))
const PASIVOS = enPlano(pasivos)

export const EFECTOS = {
  entrenadores: enPlano(entrenadores),
  habilidades: enPlano(habilidades),
  ataques: enPlano(ataques),
  energias: enPlano(energias),
  firmas: enPlano(firmas),
}

// El texto que se enseña de una carta de Entrenador o de una Energía
// especial (el espejo no lo tiene). Para un Pokémon se usan sus ataques y
// habilidades del espejo, que sí vienen.
export function textoDeCarta(c) {
  const k = claveDeEfecto(c)
  return EFECTOS.entrenadores[k]?.texto || EFECTOS.energias[k]?.texto || null
}

// ¿Está automatizada? Es lo que pinta la chapa «a mano» en la mano.
export function estaAutomatizada(c) {
  const k = claveDeEfecto(c)
  const t = EFECTOS.entrenadores[k]
  if (esEntrenador(c)) return !!(t?.usar || t?.estadio || PASIVOS[k])
  if (esEnergia(c)) return esEnergiaBasica(c) || !!EFECTOS.energias[k]
  return true
}

// Para las pruebas: las claves que hay, por tipo.
export const CLAVES = {
  entrenadores: Object.keys(EFECTOS.entrenadores),
  habilidades: Object.keys(EFECTOS.habilidades),
  ataques: Object.keys(EFECTOS.ataques),
  energias: Object.keys(EFECTOS.energias),
}

