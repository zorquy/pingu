// Tanda 1418 — Tus colores, bien (PINGU con su binder «Por colores» delante:
// «los colores no están casando del todo bien… sácale tú el color a las
// cartas»; eligió lo recomendado de la propuesta). Lo puro de
// `js/mi-coleccion/color-de-carta.js`:
//   · cada píxel vota por su familia; el rojo oscuro es rojo, no rosa;
//   · un detalle pequeño muy vivo no gana a un fondo grande;
//   · Multicolor, Oscuras y Claras;
//   · las hojas de nueve juntan paletas parecidas y la hoja a medias va al final;
//   · con los colores de verdad de 113 ilustraciones (pruebas/datos/
//     colores-1418.json, sacados por `huellaDeImagen` en el navegador): ninguna
//     cae en blanco, gris o negro, y las hojas casan más que al azar.
import { readFileSync } from 'node:fs'
const REPO = process.env.PD_RAIZ || '/home/user/pingu'
const C = await import(`${REPO}/js/mi-coleccion/color-de-carta.js`)
const A = await import(`${REPO}/js/mi-coleccion/armonia.js`)
const REAL = JSON.parse(readFileSync(new URL('./datos/colores-1418.json', import.meta.url), 'utf8'))
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

// Un lienzo de mentira: `pinta(x, y)` da el [r, g, b] de cada píxel.
const W = 64, H = 90
const lienzo = (pinta) => {
  const d = new Uint8ClampedArray(W * H * 4)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const [r, g, b] = pinta(x, y); const i = (y * W + x) * 4; d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255 }
  return d
}

console.log('── las familias ──')
check('un rojo oscuro de volcán es rojo', C.familiaDe(C.oklab(140, 20, 30)) === 'rojo', C.familiaDe(C.oklab(140, 20, 30)))
check('un rosa claro es rosa', C.familiaDe(C.oklab(245, 170, 200)) === 'rosa', C.familiaDe(C.oklab(245, 170, 200)))
check('un gris es gris y un casi blanco, blanco', C.familiaDe(C.oklab(128, 128, 128)) === 'gris' && C.familiaDe(C.oklab(245, 245, 245)) === 'blanco')
check('el hexadecimal vuelve a su color', C.hexDe(C.oklab(46, 125, 50)) === '#2E7D32', C.hexDe(C.oklab(46, 125, 50)))
check('armonia.js sigue dando oklab y hexDe (los mismos)', A.oklab === C.oklab && A.hexDe === C.hexDe)

console.log('── el voto por píxel ──')
{
  // Un bosque con un ojo rojo muy vivo: manda el verde.
  const r = C.colorDePixeles(lienzo((x, y) => (Math.hypot(x - 32, y - 40) < 6 ? [235, 20, 30] : [60, 140, 60])), W, H)
  check('un detalle rojo pequeño no gana a un fondo verde', r.color === 'verde', JSON.stringify(r))
  check('salen sus tres colores con su peso, el que más primero', r.paleta.length === 2 && r.paleta[0].f === 'verde' && r.paleta[0].s > r.paleta[1].s, JSON.stringify(r.paleta))
  // Un píxel vivo vota más que uno sin color: hace falta MUCHO negro.
  const oscura = C.colorDePixeles(lienzo((x, y) => (y < 10 ? [40, 90, 200] : [20, 20, 24])), W, H)
  check('casi toda negra con una franja azul: Oscuras', oscura.color === 'oscuras', JSON.stringify(oscura))
  const clara = C.colorDePixeles(lienzo((x, y) => (y < 10 ? [230, 200, 40] : [242, 244, 246])), W, H)
  check('casi blanca con algo de amarillo: Claras', clara.color === 'claras', JSON.stringify(clara))
  const tres = [[220, 40, 40], [40, 160, 60], [40, 90, 220], [240, 200, 30]]
  const multi = C.colorDePixeles(lienzo((x) => tres[Math.floor((x / W) * 4)]), W, H)
  check('cuatro colores a partes iguales: Multicolor', multi.color === 'multicolor', JSON.stringify(multi))
  const dos = C.colorDePixeles(lienzo((x) => (x < 34 ? [220, 40, 40] : [40, 90, 220])), W, H)
  check('dos colores fuertes: manda uno, no es Multicolor', dos.color === 'rojo' || dos.color === 'azul', JSON.stringify(dos))
  // La huella del navegador ya lo lleva dentro.
  const h = A.huellaDePixeles(lienzo((x, y) => (Math.hypot(x - 32, y - 40) < 6 ? [235, 20, 30] : [60, 140, 60])))
  check('la huella de «Sugerir» lleva el color de Tus colores', h.colores?.color === 'verde' && h.labs.length === 3, JSON.stringify(h.colores))
}

console.log('── las hojas ──')
{
  const f = (id, lab) => ({ id, colores: { paleta: [{ f: 'x', lab, s: 0.8 }, { f: 'y', lab: [0.5, 0, 0], s: 0.2 }] } })
  const rojas = Array.from({ length: 9 }, (_, i) => f(`r${i}`, [0.55, 0.18 - i * 0.004, 0.08]))
  const verdes = Array.from({ length: 9 }, (_, i) => f(`v${i}`, [0.6, -0.14, 0.11 - i * 0.004]))
  const azules = Array.from({ length: 4 }, (_, i) => f(`a${i}`, [0.5, -0.03, -0.12 + i * 0.004]))
  const mezcla = [...azules, ...verdes, ...rojas].sort((a, b) => a.id.localeCompare(b.id) * (a.id.length % 2 ? 1 : -1))
  const hojas = C.hojasDe(mezcla)
  const letras = hojas.map((h) => [...new Set(h.map((x) => x.id[0]))].join(''))
  check('tres hojas: las rojas juntas, las verdes juntas y las azules (a medias) al final', hojas.length === 3 && letras.join(',') === 'r,v,a', letras.join(','))
  check('no se pierde ni se repite ninguna', new Set(hojas.flat().map((x) => x.id)).size === 22 && hojas.flat().length === 22)
  check('sale igual cada vez', JSON.stringify(C.hojasDe(mezcla).map((h) => h.map((x) => x.id))) === JSON.stringify(hojas.map((h) => h.map((x) => x.id))))
  check('la muestra de Multicolor es la rueda; la de Oscuras, oscura', /conic-gradient/.test(C.fondoDeGrupo('multicolor', '#000')) && C.fondoDeGrupo('oscuras', '#123456') !== '#123456' && C.fondoDeGrupo('rojo', '#C62828') === '#C62828')
}

console.log('── con 113 ilustraciones de verdad ──')
{
  const fichas = Object.entries(REAL).filter(([, c]) => c).map(([id, colores]) => ({ id, colores }))
  check('están las 113', fichas.length === 113, fichas.length)
  const neutras = fichas.filter((x) => C.NEUTROS.includes(x.colores.color))
  check('ninguna cae en blanco, gris o negro (con el método de antes, 20)', !neutras.length, neutras.map((x) => x.id).join())
  const cuenta = (g) => fichas.filter((x) => x.colores.color === g).length
  check('hay de los tres grupos nuevos', cuenta('multicolor') >= 5 && cuenta('oscuras') >= 1 && cuenta('claras') >= 1, `multi ${cuenta('multicolor')}, oscuras ${cuenta('oscuras')}, claras ${cuenta('claras')}`)
  const hojas = C.hojasDe(fichas)
  const media = (lista) => { let s = 0, n = 0; for (let i = 0; i < lista.length; i++) for (let j = i + 1; j < lista.length; j++) { s += C.distanciaDePaletas(lista[i].colores.paleta, lista[j].colores.paleta); n++ } return n ? s / n : 0 }
  const dentro = hojas.reduce((s, h) => s + media(h), 0) / hojas.length
  const todas = media(fichas)
  check('dentro de una hoja las paletas se parecen mucho más que entre dos cartas cualesquiera', dentro < todas * 0.7, `${dentro.toFixed(3)} frente a ${todas.toFixed(3)}`)
  check('13 hojas, todas de nueve menos la última', hojas.length === 13 && hojas.slice(0, -1).every((h) => h.length === 9), hojas.map((h) => h.length).join())
}

console.log(fails ? `\n${fails} FALLAN` : '\n    ✅ todo en verde')
process.exit(fails ? 1 : 0)
