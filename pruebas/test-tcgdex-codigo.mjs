import { setToRow, codigoLiveDeSet } from '/home/user/pingu/js/tcgdex.js'

// Tanda 233: el código de TCG Live que trae TCGdex. Comprobado contra
// los tipos del SDK oficial (@tcgdex/sdk): `Set.tcgOnline?: string`,
// y está en el Set COMPLETO, no en el del listado.

let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + extra : ''}`) }

console.log('\n── 1. Leer el código ──')
check('lo saca de tcgOnline', codigoLiveDeSet({ tcgOnline: 'TWM' }) === 'TWM')
check('y lo pone en mayúsculas', codigoLiveDeSet({ tcgOnline: 'twm' }) === 'TWM')
check('quitando espacios', codigoLiveDeSet({ tcgOnline: ' ASC ' }) === 'ASC')
check('sin campo, nada', codigoLiveDeSet({}) === null)
check('ni con un set nulo', codigoLiveDeSet(null) === null)

console.log('\n── 2. Lo que NO se guarda ──')
// Un valor raro aquí traduce una decklist a la carta EQUIVOCADA, que es
// peor que no traducirla: mejor sin imagen que con la que no es.
check('una frase no es un código', codigoLiveDeSet({ tcgOnline: 'Twilight Masquerade' }) === null)
check('ni una sola letra', codigoLiveDeSet({ tcgOnline: 'T' }) === null)
check('ni algo con símbolos', codigoLiveDeSet({ tcgOnline: 'TW-M' }) === null)
check('ni un número suelto', codigoLiveDeSet({ tcgOnline: 42 }) === null)

console.log('\n── 3. La fila del set ──')
{
  const conCodigo = setToRow({ id: 'sv06', name: 'Twilight Masquerade', tcgOnline: 'TWM' })
  check('lleva el código', conCodigo.tcg_online_code === 'TWM', String(conCodigo.tcg_online_code))

  // ESTO ES LO IMPORTANTE: el LISTADO de sets no trae tcgOnline (es un
  // SetResume). Si la fila pusiera `null`, guardar el listado BORRARÍA
  // el código que la importación de cartas acababa de guardar, y las
  // imágenes se caerían solas al refrescar el catálogo.
  const delListado = setToRow({ id: 'sv06', name: 'Twilight Masquerade' })
  check('sin código, la columna NI SE MENCIONA',
    !('tcg_online_code' in delListado), JSON.stringify(Object.keys(delListado)))
}

console.log(fails ? `\n${fails} FALLOS\n` : '\nTodo en verde\n')
process.exit(fails ? 1 : 0)
