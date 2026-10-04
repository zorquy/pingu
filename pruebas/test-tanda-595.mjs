// Tanda 595 — «¿cómo la encuentro?», con TODO combinado.
//
// PINGU: «quiero que te diga siempre la manera más óptima de buscar X carta
// […] combinando todas las cosas posibles, teniendo en cuenta los premios,
// la mano, el mazo y absolutamente todo. ¿Qué tienes que hacer primero? La
// habilidad de Drakloak primero, una Ultra Ball primero… O usar una carta
// de búsqueda para remover el mazo y luego Drakloak».
//
// La 554 ya jugaba los caminos con el motor, pero tiraba todo paso que por
// sí solo no traía la carta, y con él los caminos en los que ese paso es lo
// que hace que el SIGUIENTE funcione. Y no sabía que traer a Drakloak con
// Ultra Ball sirve de algo (evoluciona y usa su habilidad).
//
// Lo que se prueba, en Node y con el motor de verdad:
//   1. Remover el mazo antes de mirar: con las dos de arriba vistas (y que
//      no son), Drakloak solo no trae nada; Poffin (que baraja) y DESPUÉS
//      Drakloak sí. Y el orden importa: al revés no vale.
//   2. Ultra Ball → evolucionar a Drakloak → su habilidad: Drakloak es un
//      puente aunque no traiga nada él solo.
//   3. Lo de antes no se pierde: Ultra Ball → Meowth ex sigue siendo lo
//      mejor para un partidario, y la partida queda como estaba.
//   4. Cómo se dice: el primero es «Lo mejor», y con más de un paso, «en
//      este orden».
import { readFileSync } from 'node:fs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const RAIZ = '/home/user/pingu'
const M = await import(`${RAIZ}/js/constructor/partida.js`)
const { EFECTOS } = await import(`${RAIZ}/js/constructor/efectos.js`)
const C = await import(`${RAIZ}/js/constructor/caminos.js`)
const H = await import(`${RAIZ}/js/constructor/caminos-html.js`)
const { Partida, esPokemon } = M
const FILAS = JSON.parse(readFileSync(new URL('./cartas-laboratorio.json', import.meta.url), 'utf8'))
const fila = (n) => {
  const f = FILAS.find((x) => x.name === n)
  if (!f) throw new Error(`falta ${n} en la ficha de pruebas`)
  return f
}
const mazo = (lista) => lista.map(([n, nombre]) => ({ carta: fila(nombre), n }))
const DRAGAPULT = [
  [4, 'Dreepy'], [4, 'Drakloak'], [3, 'Dragapult ex'], [2, 'Budew'], [1, 'Fezandipiti ex'], [1, 'Meowth ex'], [2, 'Munkidori'], [1, 'Moltres'],
  [4, 'Buddy-Buddy Poffin'], [4, 'Poké Pad'], [4, "Lillie's Determination"], [3, "Boss's Orders"], [3, 'Night Stretcher'], [3, 'Ultra Ball'],
  [4, 'Crushing Hammer'], [2, 'Crispin'], [2, 'Risky Ruins'], [1, 'Dawn'], [1, 'Judge'], [1, "Rosa's Encouragement"], [1, 'Special Red Card'], [1, 'Unfair Stamp'],
  [3, 'Fire Energy'], [3, 'Psychic Energy'], [2, 'Darkness Energy'],
]
const nombre = (p, u) => p.carta(u).name
const de = (n) => (c) => c?.name === n
const texto = (c) => c.pasos.map((x) => (x.tipo === 'evolucion' ? `evolucionar a ${x.nombre}` : x.tipo === 'habilidad' ? `${x.nombre}: ${x.habilidad}` : x.nombre)).join(' → ')

// Tu turno, con un Dreepy de activo (o un Drakloak, si se pide) que lleva
// en juego desde antes; la mano que se diga, y las de arriba del mazo VISTAS
// (las que se digan, en ese orden).
function montar(mano, { semilla = 11, drakloak = true, turno = 1, arriba = [], fuera = [] } = {}) {
  const p = new Partida({ entradas: mazo(DRAGAPULT), efectos: EFECTOS, semilla, vaPrimero: false })
  p.repartir()
  const traer = (n) => {
    const u = [...p.s.mazo, ...p.s.premios].find((x) => nombre(p, x) === n)
    if (!u) return null
    if (p.s.mazo.includes(u)) p.sacarDelMazo(u)
    else {
      const i = p.s.premios.indexOf(u)
      const otra = p.s.mazo.find((x) => !esPokemon(p.carta(x)))
      p.sacarDelMazo(otra)
      p.s.premios[i] = otra
    }
    return u
  }
  const dreepy = p.s.mano.find((x) => nombre(p, x) === 'Dreepy') || traer('Dreepy')
  if (!p.s.mano.includes(dreepy)) p.s.mano.push(dreepy)
  p.colocar(dreepy, 'activo')
  p.empezar()
  for (const u of [...p.s.mano]) {
    p.quitarDeMano(u)
    p.alMazo([u], 'barajar')
  }
  p.s.turno = turno
  p.s.activo.entroTurno = -5
  if (drakloak) {
    const d = traer('Drakloak')
    p.s.activo.cartas.push(d)
    p.s.activo.evolucionoTurno = -5
  }
  for (const n of fuera) {
    const u = traer(n)
    if (u) p.s.descarte.push(u)
  }
  for (const n of mano) p.s.mano.push(traer(n))
  for (const n of [...arriba].reverse()) {
    const u = p.s.mazo.find((x) => nombre(p, x) === n)
    p.sacarDelMazo(u)
    p.alMazo([u], 'arriba')
  }
  return p
}

console.log('\n── 1. Remover el mazo ANTES de mirar ──')
{
  const p = montar(['Buddy-Buddy Poffin', 'Crushing Hammer'], { arriba: ['Fire Energy', 'Psychic Energy'] })
  const antes = JSON.stringify(p.s)
  const r = await C.buscarCaminos({ partida: p, objetivo: de("Boss's Orders"), muestras: 300 })
  const lista = r.caminos.map((c) => `${Math.round(c.p * 100)}% ${texto(c)}`).join(' / ')
  check('Drakloak SOLO no es un camino: las dos de arriba ya sabes que no son', !r.caminos.some((c) => texto(c) === 'Drakloak: Recon Directive'), lista)
  const bueno = r.caminos.find((c) => texto(c) === 'Buddy-Buddy Poffin → Drakloak: Recon Directive')
  check('  …Poffin (que baraja) y DESPUÉS Drakloak sí lo es', bueno && bueno.p > 0.03, lista)
  check('  …y al revés no: mirar primero y barajar después no trae nada', !r.caminos.some((c) => texto(c) === 'Drakloak: Recon Directive → Buddy-Buddy Poffin'))
  check('  …y el que más trae va primero', r.caminos[0] && r.caminos.every((c) => c.p <= r.caminos[0].p), lista)
  check('  …la partida queda EXACTAMENTE como estaba', JSON.stringify(p.s) === antes)
}

{
  // Los que preparan son los que MUEVEN el mazo: un Martillo o recuperar
  // del descarte no cambian lo que viene, y si pasaran ellos ocuparían el
  // sitio del Poffin (van antes en la mano).
  // Con UN solo sitio para preparar, para que se vea quién se lo queda.
  const p = montar(['Crushing Hammer', 'Night Stretcher', 'Buddy-Buddy Poffin'], { arriba: ['Fire Energy', 'Psychic Energy'], fuera: ['Budew'] })
  const r = await C.buscarCaminos({ partida: p, objetivo: de("Boss's Orders"), muestras: 200, preparar: 1 })
  check('con un Martillo y una Camilla (que no mueven el mazo) delante, el sitio de preparar es del Poffin', r.caminos.some((c) => /^Buddy-Buddy Poffin → Drakloak: Recon Directive/.test(texto(c))), r.caminos.slice(0, 3).map(texto).join(' / '))
}

console.log('\n── 2. Ultra Ball → evolucionar a Drakloak → su habilidad ──')
{
  // Turno 2, un Dreepy que ya estaba en juego y nada que busque partidarios
  // en el mazo (Meowth ex y Fezandipiti ex, fuera): el único camino a un
  // Boss es traer a Drakloak, evolucionar y mirar.
  const p = montar(['Ultra Ball', 'Crushing Hammer', 'Fire Energy'], { drakloak: false, turno: 2, fuera: ['Meowth ex', 'Fezandipiti ex'] })
  const r = await C.buscarCaminos({ partida: p, objetivo: de("Boss's Orders"), muestras: 300 })
  const lista = r.caminos.map((c) => `${Math.round(c.p * 100)}% ${texto(c)}`).join(' / ')
  check('Drakloak sale como puente (la Ultra Ball sabe que traerlo sirve)', (r.puentes.drakloak || 0) > 0, JSON.stringify(r.puentes))
  check('  …y el camino entero: Ultra Ball → evolucionar a Drakloak → Drakloak: Recon Directive', r.caminos.some((c) => /^Ultra Ball → evolucionar a Drakloak → Drakloak: Recon Directive/.test(texto(c))), lista)
}

console.log('\n── 3. Lo de antes no se pierde ──')
{
  const p = montar(['Ultra Ball', "Lillie's Determination", 'Poké Pad', 'Night Stretcher'])
  const antes = JSON.stringify(p.s)
  const r = await C.buscarCaminos({ partida: p, objetivo: de("Boss's Orders"), muestras: 300 })
  check('para un partidario, lo mejor sigue siendo Ultra Ball → Meowth ex', r.caminos[0] && texto(r.caminos[0]) === 'Ultra Ball → Meowth ex' && r.caminos[0].p > 0.95, r.caminos.slice(0, 3).map(texto).join(' / '))
  check('  …y los caminos más largos que no mejoran salen como «otros»', r.caminos.filter((c) => c.pasos.length > 2 && c.p <= r.caminos[0].p).every((c) => c.dominado))
  check('  …y la partida queda como estaba', JSON.stringify(p.s) === antes)
}

console.log('\n── 4. Cómo se dice ──')
{
  const r = {
    quedan: 3, siguienteRobo: 0.07, todasPremiadas: 0.01, muestras: 300,
    caminos: [
      { p: 0.8, dominado: false, pasos: [{ tipo: 'carta', nombre: 'Buddy-Buddy Poffin', siempre: true }, { tipo: 'habilidad', nombre: 'Drakloak', habilidad: 'Recon Directive', siempre: true }] },
      { p: 0.4, dominado: false, pasos: [{ tipo: 'carta', nombre: 'Ultra Ball', siempre: true }] },
    ],
  }
  const html = H.resultadoDeCaminosHtml(r, "Boss's Orders")
  const items = html.split('<li class="lab-camino').slice(1)
  check('el primero dice «Lo mejor, en este orden»', /lab-camino-mejor">Lo mejor, en este orden</.test(items[0] || ''))
  check('  …y solo el primero', !/lab-camino-mejor/.test(items[1] || ''))
  const uno = H.resultadoDeCaminosHtml({ ...r, caminos: [r.caminos[1]] }, "Boss's Orders")
  check('con un solo paso, «Lo mejor» a secas', /lab-camino-mejor">Lo mejor</.test(uno))
}

console.log(fails ? `\n${fails} fallos.` : '\nTodo en verde.')
process.exit(fails ? 1 : 0)
