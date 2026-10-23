// Tanda 870 — «Mi día» y la cabecera única de los seis retos (en Node).
//
// Lo que vigila: que el número del día sea UNO para los seis (antes cada
// juego llevaba su estreno y el mismo día salía «#77», «#12» y «#2»), que
// cada texto empiece por «PokeDoc #N · <nombre corto> · cuenta», y que el
// texto de «Mi día» diga lo que se ha jugado sin desvelar nada.
import { readFileSync } from 'node:fs'
import { numeroDelDia, DIA_UNO, NOMBRE_CORTO, cabeceraDeReto, textoParaCompartir as textoReto } from '/home/user/pingu/js/reto-compartir.js'
import * as carta from '/home/user/pingu/js/carta-del-dia.js'
import * as caro from '/home/user/pingu/js/mas-caro.js'
import * as silueta from '/home/user/pingu/js/quien-es.js'
import * as ordena from '/home/user/pingu/js/ordena-precio.js'
import * as expansion from '/home/user/pingu/js/que-expansion.js'
import { RETOS } from '/home/user/pingu/js/retos-xp.js'
import { siguienteRetoHtml } from '/home/user/pingu/js/retos-siguiente.js'
import {
  EMOJI, CORTO, TAMANO, ENLACE_RETOS, CLAVE_RETO_LOCAL, tiraDeBase, tiraLocal, filasDeMiDia, textoDeMiDia, textoCortoDeMiDia,
} from '/home/user/pingu/js/mi-dia.js'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 220) : ''}`)
}
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const hoy = '2026-10-15'
const n = numeroDelDia(hoy)

console.log('── 1. Un número para los seis ──')
{
  check('el día uno del reto es el #1 y no se ha movido', numeroDelDia(DIA_UNO) === 1 && DIA_UNO === '2026-08-01')
  for (const [nombre, m] of [['carta-del-dia', carta], ['mas-caro', caro], ['quien-es', silueta], ['ordena-precio', ordena], ['que-expansion', expansion]]) {
    check(`  …${nombre} reexporta LA MISMA función (identidad, no «dice lo mismo»)`, m.numeroDelDia === numeroDelDia)
    check(`  …y ya no lleva su propio estreno`, !('DIA_UNO' in m))
  }
  for (const r of RETOS) check(`  …hay nombre corto, emoji y tamaño para «${r.juego}»`, typeof CORTO[r.juego] === 'string' && typeof EMOJI[r.juego] === 'string' && TAMANO[r.juego] >= 3)
  check('CORTO es NOMBRE_CORTO (una sola lista)', CORTO === NOMBRE_CORTO)
}

console.log('── 2. La cabecera única ──')
{
  const cab = (t) => t.split('\n')[0]
  const textos = {
    reto: textoReto({ dia: hoy, tira: [1, 0, 1, 1, 1], correct: 4, total: 5, medal: 'plata' }),
    carta: carta.textoParaCompartir({ dia: hoy, comparaciones: [{ nombre: true, era: false, tipo: true, rareza: false }, { nombre: true, era: true, tipo: true, rareza: true }], acertada: true }),
    caro: caro.textoParaCompartir({ dia: hoy, tira: [1, 1, 0, 1, 1] }),
    silueta: silueta.textoParaCompartir({ dia: hoy, fallos: [1], acertada: true }),
    ordena: ordena.textoParaCompartir({ dia: hoy, intentos: [['a', 'b', 'c', 'd']], cartas: [{ id: 'a', precio: 1 }, { id: 'b', precio: 2 }, { id: 'c', precio: 3 }, { id: 'd', precio: 4 }], acertada: true }),
    expansion: expansion.textoParaCompartir({ dia: hoy, tira: [1, 0, 1, 1, 1] }),
  }
  const cuentas = { reto: '4/5 🥈', carta: '2/6', caro: '4/5 💶', silueta: '2/3', ordena: '1/3', expansion: '4/5' }
  for (const [juego, t] of Object.entries(textos)) {
    check(`«${juego}»: «PokeDoc #${n} · ${CORTO[juego]} · ${cuentas[juego]}»`, cab(t) === `PokeDoc #${n} · ${CORTO[juego]} · ${cuentas[juego]}`, cab(t))
  }
  check('la cabecera se arma con cabeceraDeReto', cabeceraDeReto({ dia: hoy, nombre: 'X', cuenta: '1/2', extra: '🏆' }) === `PokeDoc #${n} · X · 1/2 🏆` && cabeceraDeReto({ dia: hoy, nombre: 'X', cuenta: '1/2' }) === `PokeDoc #${n} · X · 1/2`)
  check('los fallados dicen X/N, no 0/N', silueta.textoParaCompartir({ dia: hoy, fallos: [1, 2, 3], acertada: false }).startsWith(`PokeDoc #${n} · ¿Quién es? · X/3`))
}

console.log('── 3. Las tiras: del navegador y de la base ──')
{
  check('carta a medias (2 intentos, sin acertar) no cuenta', tiraLocal('carta', { dia: hoy, intentos: [1, 2], acertada: false }, hoy) === null)
  check('carta acertada en 3: rojo rojo verde', JSON.stringify(tiraLocal('carta', { dia: hoy, intentos: [1, 2, 3], acertada: true }, hoy)) === '[false,false,true]')
  check('carta fallada (6): seis rojos', JSON.stringify(tiraLocal('carta', { dia: hoy, intentos: [1, 2, 3, 4, 5, 6], acertada: false }, hoy)) === '[false,false,false,false,false,false]')
  check('de otro día, nada', tiraLocal('caro', { dia: '2026-10-14', respuestas: [1, 1, 1, 1, 1] }, hoy) === null)
  check('más caro: la tira tal cual', JSON.stringify(tiraLocal('caro', { dia: hoy, respuestas: [true, false, true, true, true] }, hoy)) === '[true,false,true,true,true]')
  check('  …y a medias (3 de 5), nada', tiraLocal('caro', { dia: hoy, respuestas: [true, false, true] }, hoy) === null)
  check('quién es a la segunda: rojo verde', JSON.stringify(tiraLocal('silueta', { dia: hoy, elegidos: [1, 2], acertada: true }, hoy)) === '[false,true]')
  check('ordena a la primera: verde', JSON.stringify(tiraLocal('ordena', { dia: hoy, intentos: [[1]], acertada: true }, hoy)) === '[true]')
  check('expansión: la tira guardada', JSON.stringify(tiraLocal('expansion', { dia: hoy, elegidas: [1, 2, 3, 4, 5], tira: [1, 0, 1, 1, 1] }, hoy)) === '[true,false,true,true,true]')
  check('el reto de preguntas: la tira que deja el cuestionario', JSON.stringify(tiraLocal('reto', { dia: hoy, tira: [1, 0, 1, 1, 1] }, hoy)) === '[true,false,true,true,true]' && CLAVE_RETO_LOCAL === 'pokedoc-reto-hoy')
  // De la base.
  check('base: la tira manda si viene', JSON.stringify(tiraDeBase('caro', { aciertos: 4, total: 5, tira: [true, true, false, true, true] })) === '[true,true,false,true,true]')
  check('base: carta con intentos=3 y acertada: rojo rojo verde', JSON.stringify(tiraDeBase('carta', { intentos: 3, acertada: true })) === '[false,false,true]')
  check('base: el reto con 4 de 5 y sin tira: cuatro verdes y un rojo', JSON.stringify(tiraDeBase('reto', { aciertos: 4, total: 5 })) === '[true,true,true,true,false]')
  check('base: sin fila, null', tiraDeBase('reto', null) === null)
}

console.log('── 4. El texto de «Mi día» ──')
{
  // Desde la 989 los seis son carta, caro, silueta, ordena, expansión y
  // Parejas (el cuestionario ya no está).
  const resultados = { carta: [false, false, false, false, false, false], caro: [true, true, true, true, true], silueta: [false, true], ordena: null, expansion: null, parejas: [true, false, true, true, true, true, true] }
  const t = textoDeMiDia({ dia: hoy, resultados, rachaDias: 3 })
  const lineas = t.split('\n')
  check('la cabecera: «PokeDoc #N · 4/6 retos»', lineas[0] === `PokeDoc #${n} · 4/6 retos`, lineas[0])
  check('una línea por reto, en el orden del menú', lineas.length === 1 + RETOS.length + 2 && RETOS.every((r, i) => lineas[i + 1].startsWith(`${EMOJI[r.juego]} ${CORTO[r.juego]}  `)), t)
  check('  …la carta fallada con su aspa', lineas[1] === '🃏 ¿Qué carta es?  🟥🟥🟥🟥🟥🟥 ✗', lineas[1])
  check('  …los no jugados en gris, con el tamaño del reto', lineas[4] === '🔢 Ordena por precio  ⬜⬜⬜' && lineas[5] === '📦 ¿Qué expansión?  ⬜⬜⬜⬜⬜', `${lineas[4]} | ${lineas[5]}`)
  check('  …Parejas con su tira de movimientos', lineas[6] === '🧠 Parejas  🟩🟥🟩🟩🟩🟩🟩', lineas[6])
  check('  …la racha', lineas[7] === '🔥 3 días seguidos')
  check('  …y el enlace al menú de los retos', lineas[8] === ENLACE_RETOS && ENLACE_RETOS === 'pokedoc.es/retos')
  check('no desvela nada: ni nombre de carta ni de Pokémon', !/Pikachu|Charizard|sv8/.test(t))
  const perfecto = textoDeMiDia({ dia: hoy, resultados: { carta: [true], caro: [true], silueta: [true], ordena: [true], expansion: [true], parejas: [true] } })
  check('con los seis, la corona', perfecto.split('\n')[0] === `PokeDoc #${n} · 6/6 retos 👑`, perfecto.split('\n')[0])
  check('sin racha (1 día), no se dice', !/días seguidos/.test(textoDeMiDia({ dia: hoy, resultados, rachaDias: 1 })))
  const corto = textoCortoDeMiDia({ dia: hoy, resultados, rachaDias: 3 })
  check('el corto: un cuadrado por reto (amarillo = parte, rojo = nada, gris = sin jugar)', corto === `PokeDoc #${n} · 4/6 · 🟥🟩🟩⬜⬜🟩 · 🔥 3 · ${ENLACE_RETOS}`, corto)
  const filas = filasDeMiDia(resultados)
  check('filasDeMiDia: hecho y acertado', filas.map((f) => `${f.juego}:${f.hecho ? 1 : 0}${f.acertado === null ? '-' : f.acertado ? 'v' : 'x'}`).join(' ') === 'carta:1x caro:1v silueta:1v ordena:0- expansion:0- parejas:1v', JSON.stringify(filas.map((f) => [f.juego, f.hecho, f.acertado])))
}

console.log('── 5. El botón en el bloque del siguiente reto ──')
{
  // Desde la 988, «Compartir mi día» ya no sale al acabar: se comparte
  // cada reto (PINGU). El bloque del cuestionario es el siguiente y la vuelta.
  const con = siguienteRetoHtml({ ruta: '/mas-caro', titulo: 'Más caro' }, { dia: hoy })
  check('al acabar ya no hay «Compartir mi día» (988)', !/rj-mi-dia|Compartir mi día/.test(con) && /rj-siguiente/.test(con) && /rj-volver-retos/.test(con), con)
  check('  …y con todos hechos, la vuelta diciéndolo', /Todos hechos por hoy/.test(siguienteRetoHtml(null)))
  for (const f of ['carta-del-dia-juego', 'mas-caro-juego', 'quien-es-juego', 'ordena-precio-juego', 'que-expansion-juego']) {
    const s = readFileSync(`${RAIZ}/js/${f}.js`, 'utf8')
    check(`  …${f} pinta las salidas comunes, con el día de HOY`, /salidasHtml\(\{ juego: '[a-z]+', ruta: '\/[a-z-]+', dia: hoy, libre,/.test(s) && !/siguienteRetoHtml|data-mi-dia/.test(s))
  }
  const curso = readFileSync(`${RAIZ}/js/curso.js`, 'utf8')
  check('  …y el cuestionario deja su tira para «Mi día»', /siguienteRetoHtml\(siguienteReto\('reto', hechoHoy\(hoyISO\(\)\)\)\)/.test(curso) && /localStorage\.setItem\(CLAVE_RETO_LOCAL/.test(curso))
  // Desde la 989 /retos tampoco lo tiene (decisión 5 de la propuesta).
  const retos = readFileSync(`${RAIZ}/js/retos.js`, 'utf8')
  check('/retos: ya no hay «Compartir mi día» en el menú (989)', !/rt-compartir-dia|data-mi-dia|compartirMiDia/.test(retos) && /compartirMiMes/.test(retos))
  check('  …y sin numeroDelDiaCarta ni MasCaro', !/numeroDelDiaCarta|numeroDelDiaMasCaro|numeroDelDiaNuevos/.test(retos))
}

console.log(fails ? `\n${fails} FALLOS` : '\nTODO OK')
process.exit(fails ? 1 : 0)
