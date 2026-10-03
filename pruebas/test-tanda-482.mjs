// Tanda 482 — el diagnóstico de /admin que daba un consejo falso.
//
// (Era la 480; Ibai llegó antes al remoto con la 480 y la 481.)
//
// PINGU pegó la línea de «Qué hay de cada mercado» y venía con este
// consejo detrás:
//
//   «sin FECHA una era se va al fondo de la estantería, y sin SERIE no hay
//    respaldo […]: dale a Completar los datos que faltan de los sets»
//
// …con los 210 sets occidentales a 210 con fecha y 210 con serie, y los
// 186 japoneses igual. O sea que no faltaba ninguna.
//
// El aviso se decidía leyendo la FRASE con una expresión regular, y
// `/0 con fecha/` casaba con el CERO DE «210 con fecha». Es la trampa que
// el CLAUDE.md tiene escrita desde la tanda 312 —al barrer una cadena,
// todo lo que la CONTIENE cuenta, no solo lo que ES—, esta vez dentro del
// propio diagnóstico.
//
// Y no es un detalle cosmético: un aviso que manda a pulsar un botón que
// no va a hacer nada gasta el tiempo de quien lo lee y le deja creyendo
// que el problema es suyo cuando no lo es.
import { avisosDeMercados, lineaDeMercado } from '/home/user/pingu/admin/js/cuentas-mercado.js'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

// Los números DE VERDAD que pegó PINGU el 2026-10-03. No un ejemplo
// inventado: una prueba escrita contra el caso que acabas de arreglar vale
// poco, pero el caso que lo destapó tiene que estar.
const REALES = [
  { market: 'WEST', sets: 210, logo: 147, simbolo: 210, fecha: 210, serie: 210, cartas: 21476, foto: 20125 },
  { market: 'JP', sets: 188, logo: 0, simbolo: 188, fecha: 186, serie: 186, cartas: 13006, foto: 3882 },
  { market: 'CN', sets: 56, logo: 0, simbolo: 56, fecha: 56, serie: 56, cartas: 877, foto: 0 },
  { market: 'TW', sets: 98, logo: 0, simbolo: 98, fecha: 98, serie: 98, cartas: 7436, foto: 2146 },
]

console.log('── 1. El consejo falso no vuelve ──')
{
  const avisos = avisosDeMercados([REALES[0]])
  check('con 210 de 210 no se manda a curar nada', !avisos.some((a) => /Completar los datos/.test(a)),
    avisos.join(' | '))
  // Y la razón, dicha en una comprobación: la frase LLEVA un «0 con fecha»
  // dentro, porque «210» acaba en cero.
  check('  …aunque su propia línea contenga «0 con fecha»', /0 con fecha/.test(lineaDeMercado(REALES[0])),
    lineaDeMercado(REALES[0]))
}

console.log('\n── 2. Cuando SÍ falta, se dice y se dice cuántos ──')
{
  const avisos = avisosDeMercados([{ market: 'JP', sets: 188, logo: 0, simbolo: 188, fecha: 186, serie: 186, cartas: 1, foto: 1 }])
  const curar = avisos.find((a) => /Completar los datos/.test(a))
  check('se manda a curar', Boolean(curar), avisos.join(' | '))
  check('  …y dice a cuántos les falta', /JP \(2\)/.test(curar || ''), curar)
}

console.log('\n── 3. Un mercado sin importar ──')
{
  const avisos = avisosDeMercados([{ market: 'KO', sets: 0, logo: 0, simbolo: 0, fecha: 0, serie: 0, cartas: 0, foto: 0 }])
  check('se dice que no se ha importado nunca', /no se ha importado nunca/.test(avisos[0] || ''), avisos.join(' | '))
  check('  …y se manda a «Buscar sets»', /Buscar sets en TCGdex/.test(avisos[0] || ''), avisos[0])
  // Y NO se le manda a curar: no hay nada que curar si no hay sets. Dos
  // avisos a la vez para el mismo mercado se leen como dos problemas.
  check('  …y no se le manda a curar también', !avisos.some((a) => /Completar los datos/.test(a)), avisos.join(' | '))
}

console.log('\n── 4. Lo que NO arregla ningún botón ──')
// Es la mitad que faltaba: la respuesta honesta a «¿por qué no hay logos
// japoneses?» es «no los hay», no «pulsa aquí».
{
  const avisos = avisosDeMercados(REALES)
  const dibujo = avisos.find((a) => /CERO logos/.test(a))
  check('se dice que los logos no son nuestros', Boolean(dibujo), avisos.join(' | '))
  check('  …y de qué mercados', /JP, CN, TW/.test(dibujo || ''), dibujo)
  check('  …y que no es cosa nuestra', /ya no es nuestro/.test(dibujo || ''), dibujo)
  // Y el occidental no entra: tiene 147 logos de 210, que es otra cosa.
  check('  …sin meter al occidental, que sí tiene', !/WEST/.test(dibujo || ''), dibujo)

  const foto = avisos.find((a) => /ni un escaneo/.test(a))
  check('y el chino, que no tiene ni un escaneo', /CN \(877 cartas\)/.test(foto || ''), foto)
  // JP y TW tienen algunos, así que no entran: decir «no tiene escaneos»
  // de un catálogo con 3.882 sería falso por el otro lado.
  check('  …sin meter a JP ni a TW, que tienen algunos', !/JP|TW/.test(foto || ''), foto)
}

console.log('\n── 5. Todo bien es no decir nada ──')
{
  const perfecto = [{ market: 'WEST', sets: 210, logo: 210, simbolo: 210, fecha: 210, serie: 210, cartas: 100, foto: 100 }]
  check('ningún aviso', avisosDeMercados(perfecto).length === 0, JSON.stringify(avisosDeMercados(perfecto)))
  check('sin datos, tampoco', avisosDeMercados([]).length === 0 && avisosDeMercados().length === 0)
}

console.log('\n── 6. La línea dice el símbolo ──')
// El símbolo es el último dibujo de la cadena de la tarjeta de una
// colección (logo propio → logo a mano → logo inglés → símbolo → nombre).
// Sin contarlo no se podía saber si a los sets sin logo les queda algo que
// enseñar o si van directos al nombre.
{
  const l = lineaDeMercado(REALES[1])
  check('sale en la línea', /188 con símbolo/.test(l), l)
  check('  …con todo lo demás', /JP: 188 sets/.test(l) && /13006 cartas \(3882 con foto\)/.test(l), l)
}

console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
