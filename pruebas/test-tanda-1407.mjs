// Tanda 1407 — la armonía de una página (lo puro), con las huellas de 62
// ilustraciones de verdad de TCGdex (pruebas/datos/armonia-huellas-1407.json,
// calculadas por `huellaDeImagen` en el navegador).
//   · Una página de agua con el centro vacío sugiere cielo y agua azul, y deja
//     los bosques oscuros y los rojos los últimos.
//   · El porqué es una frase en palabras, sin números.
//   · Ordenar una página de fuego baja lo que no sigue la escena, y no pierde
//     ni repite cartas; los huecos se quedan donde estaban.
//   · Las vecinas se cuentan dentro de la página (no saltan a la siguiente).
import { readFileSync } from 'node:fs'
const REPO = process.env.PD_RAIZ || '/home/user/pingu'
const A = await import(`${REPO}/js/mi-coleccion/armonia.js`)
const H = JSON.parse(readFileSync(new URL('./datos/armonia-huellas-1407.json', import.meta.url), 'utf8'))
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

console.log('── las huellas ──')
check('hay huellas de 60 ilustraciones o más', Object.keys(H).length >= 60, Object.keys(H).length)
const w = H['sv03.5-171'] // Wartortle, bajo el agua
check('Wartortle es azul', A.nombreDeColor(w.labs[0]) === 'azul' || A.nombreDeColor(w.labs[0]) === 'celeste', w.labs.map(A.nombreDeColor))
check('Magby es rojo o naranja', ['rojo', 'naranja'].includes(A.nombreDeColor(H['sv04-186'].labs[0])), H['sv04-186'].labs.map(A.nombreDeColor))
check('la huella lleva 3 colores que suman 1', w.labs.length === 3 && Math.abs(w.pesos.reduce((s, x) => s + x, 0) - 1) < 0.01)

console.log('── sugerir para el hueco 5 de una página de agua ──')
const AGUA = ['sv03.5-181', 'sv04-189', 'sv06-178', 'sv03.5-171', null, 'sv06-175', 'sv02-204', 'sv02-207', 'sv02-205']
const NOMBRES = { 'sv03.5-171': 'Wartortle', 'sv04-189': 'Mantyke', 'sv06-175': 'Phione', 'sv02-207': 'Quaxwell' }
const pagina = AGUA.map((id) => (id ? H[id] : null))
const vecinas = A.vecinasDe(4, 3, 9).map((v) => ({ ...v, huella: pagina[v.indice], nombre: NOMBRES[AGUA[v.indice]] }))
check('el centro de un 3×3 tiene cuatro vecinas', vecinas.length === 4 && vecinas.map((v) => v.lado).sort().join() === 'aba,arr,der,izq')
const candidatas = Object.keys(H).filter((id) => !AGUA.includes(id)).map((id) => ({ id, huella: H[id] }))
const lista = A.sugerir({ candidatas, huellasDePagina: pagina, vecinas })
const top = lista.slice(0, 5).map((x) => x.id)
const AZULES = ['sv06-169', 'sv04-190', 'sv02-194', 'sv03.5-167', 'sv02-208', 'sv02-206']
check('las cinco primeras son de cielo o agua', top.filter((id) => AZULES.includes(id)).length >= 4, top.join(' '))
const ultimas = lista.slice(-6).map((x) => x.id)
check('los bosques oscuros y los rojos, al final (Blitzle, Fletchinder)', ultimas.includes('sv04-195') && ultimas.includes('sv02-199'), ultimas.join(' '))
check('la primera lleva 4 o 5 puntos, la última 1 o 2', A.puntosDe(lista[0].nota) >= 4 && A.puntosDe(lista.at(-1).nota) <= 2, `${lista[0].nota} / ${lista.at(-1).nota}`)
const porque = A.porqueDe(lista[0].huella, pagina, vecinas)
check('el porqué es una frase con palabras y sin números', /^[A-ZÁÉÍÓÚ]/.test(porque) && !/\d/.test(porque) && porque.length > 15, porque)
check('…y nombra el color o la vecina hacia la que sigue', /(azul|celeste|turquesa|blanco|gris|verde) es el de la página|sigue hacia (Wartortle|Mantyke|Phione|Quaxwell)|tonos suaves|colores vivos/.test(porque), porque)
const soloColor = A.sugerir({ candidatas, huellasDePagina: pagina, vecinas, modo: 'color' })
check('«Color» ordena por la nota de color', soloColor.every((x, i) => i === 0 || soloColor[i - 1].color >= x.color))
const soloEscena = A.sugerir({ candidatas, huellasDePagina: pagina, vecinas, modo: 'escena' })
check('«Escena» ordena por la nota de escena', soloEscena.every((x, i) => i === 0 || soloEscena[i - 1].escena >= x.escena))
const sinVecinas = A.sugerir({ candidatas, huellasDePagina: pagina, vecinas: [] })
check('sin vecinas manda el color', sinVecinas[0].nota === sinVecinas[0].color)

console.log('── la paleta de la página ──')
const P = A.paletaDePagina(pagina)
check('tres colores en hexadecimal, que suman 1', P.hex.length === 3 && P.hex.every((h) => /^#[0-9A-F]{6}$/.test(h)) && Math.abs(P.pesos.reduce((s, x) => s + x, 0) - 1) < 0.01, P.hex.join(' '))
check('…y son azules (página de agua)', P.labs.filter((l) => ['azul', 'celeste', 'turquesa', 'gris', 'blanco'].includes(A.nombreDeColor(l))).length === 3, P.labs.map(A.nombreDeColor).join(' '))

console.log('── ordenar una página ──')
const FUEGO = ['sv03.5-168', 'sv04-186', 'sv06-173', 'sv03.5-169', 'sv02-199', 'sv04-197', 'sv02-200', 'sv04-187', 'sv06-172']
const t0 = Date.now()
const o = A.ordenarPagina(FUEGO.map((id) => H[id]), 3)
const ms = Date.now() - t0
check('baja lo que no sigue la escena', o.despues < o.antes * 0.6, `${o.antes.toFixed(3)} → ${o.despues.toFixed(3)}`)
check('no pierde ni repite cartas', [...o.orden].sort().join() === [0, 1, 2, 3, 4, 5, 6, 7, 8].join(), o.orden.join())
check('nueve cartas, en menos de 3 s', ms < 3000, `${ms} ms`)
const conHuecos = [H['sv03.5-168'], null, H['sv04-186'], H['sv06-173'], null, H['sv03.5-169'], H['sv02-199'], H['sv04-197'], null]
const oh = A.ordenarPagina(conHuecos, 3)
check('los huecos se quedan donde estaban', [1, 4, 8].every((i) => oh.orden[i] === i) && oh.despues <= oh.antes + 1e-9, oh.orden.join())
const dieciseis = [...FUEGO, 'sv03.5-166', 'sv03.5-172', 'sv03.5-175', 'sv02-194', 'sv02-195', 'sv02-196', 'sv02-197'].map((id) => H[id] || H['sv04-186'])
const o16 = A.ordenarPagina(dieciseis, 4)
check('un 4×4 también se ordena (por intercambios) sin perder cartas', o16.despues <= o16.antes && new Set(o16.orden).size === 16, `${o16.antes.toFixed(2)} → ${o16.despues.toFixed(2)}`)

console.log('── vecinas, dentro de su página ──')
check('el primero de la página 2 no tiene vecina a la izquierda ni arriba', A.vecinasDe(9, 3, 9).map((v) => v.lado).sort().join() === 'aba,der')
check('el último de una página no mira a la siguiente', A.vecinasDe(8, 3, 9).every((v) => v.indice < 9))
check('en un 2×2, el de arriba a la derecha', A.vecinasDe(1, 2, 4).map((v) => v.lado).sort().join() === 'aba,izq')

console.log('── huellaDePixeles, de un dibujo conocido ──')
const datos = new Uint8ClampedArray(A.ANCHO * A.ALTO * 4)
for (let y = 0; y < A.ALTO; y++) for (let x = 0; x < A.ANCHO; x++) {
  const i = (y * A.ANCHO + x) * 4
  const izq = x < A.ANCHO / 2
  datos[i] = izq ? 30 : 230; datos[i + 1] = izq ? 90 : 60; datos[i + 2] = izq ? 200 : 40; datos[i + 3] = 255
}
const hp = A.huellaDePixeles(datos)
check('mitad azul, mitad roja: sale azul a la izquierda y rojo/naranja a la derecha', A.nombreDeColor(hp.bordes.izq) === 'azul' && ['rojo', 'naranja'].includes(A.nombreDeColor(hp.bordes.der)), `${A.nombreDeColor(hp.bordes.izq)} / ${A.nombreDeColor(hp.bordes.der)}`)

console.log(fails ? `    ❌ ${fails} fallan` : '    ✅ todo en verde')
process.exit(fails ? 1 : 0)
