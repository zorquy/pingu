// Tanda 486 — la herramienta que vino a no deducir, deduciendo.
//
// PINGU pulsó el botón de la 484 con `sv1a JP` y volvió con dos cosas:
//
//   1. TCGdex NO publica `logo` ni `symbol` de ese set japonés. Primera
//      vez que eso es un DATO y no mi deducción: los 0 de 188 logos son
//      de arriba, no nuestros.
//   2. Sus 103 cartas vienen con imagen YA EN EL LISTADO, el 100 % — y
//      nuestra tabla dice que de las 13.006 japonesas importadas solo
//      3.882 tienen foto, el 30 %. Las dos cosas no pueden ser verdad del
//      catálogo entero.
//
// Y de paso enseñó DOS fallos del propio botón:
//
//   · «ese set no está en nuestra tabla» salió de comparar contra lo
//     ESCRITO en el prompt. El catálogo japonés nombra sus sets en
//     MAYÚSCULAS (`SV1a`, serie `SV`) y el occidental en minúsculas; la
//     API no distingue y contestó, mi comparación sí. O sea que la
//     herramienta hecha para no dar respuestas ambiguas dio una: «no
//     importado» y «lo escribiste en otra caja» se leen igual.
//   · `cs1a CN` dio 404 porque ese identificador no existe. El chino los
//     nombra de otra forma, y no había manera de saber cuáles son.
import { readFileSync } from 'node:fs'
import { muestraDeSets, CUANTOS_SONDEOS } from '/home/user/pingu/admin/js/cuentas-mercado.js'

const leer = (p) => readFileSync(`/home/user/pingu/${p}`, 'utf8')
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

console.log('── 1. La muestra reparte por toda la lista ──')
//
// Lo importante no es cuántos: es que el PRIMERO y el ÚLTIMO estén. Una
// muestra que se quede en un extremo contesta lo contrario de la verdad —
// los primeros sets de un catálogo japonés son de los noventa y los
// últimos de este año, y la pregunta es justamente si la cobertura depende
// de la antigüedad.
{
  const lista = Array.from({ length: 188 }, (_, i) => ({ id: `s${i}` }))
  const m = muestraDeSets(lista)
  check('coge nueve', m.length === CUANTOS_SONDEOS, String(m.length))
  check('  …el primero de la lista', m[0].id === 's0', m[0].id)
  check('  …y el último', m[m.length - 1].id === 's187', m[m.length - 1].id)
  // Repartidos: ningún hueco entre dos sondeos puede ser el doble que otro.
  const pos = m.map((s) => Number(s.id.slice(1)))
  const huecos = pos.slice(1).map((v, i) => v - pos[i])
  check('  …y a trechos parejos', Math.max(...huecos) - Math.min(...huecos) <= 1, JSON.stringify(huecos))
  check('  …en orden', pos.every((v, i) => i === 0 || v > pos[i - 1]), JSON.stringify(pos))
}

console.log('\n── 2. Y no se inventa nada con listas raras ──')
{
  check('una lista corta se sondea entera', muestraDeSets([{ id: 'a' }, { id: 'b' }]).length === 2)
  check('vacía da vacía', muestraDeSets([]).length === 0)
  check('nada da vacía', muestraDeSets(null).length === 0 && muestraDeSets(undefined).length === 0)
  // Sin repetidos: con una lista corta dos posiciones redondean al mismo
  // set, y sondear dos veces el mismo gasta una petición y no dice nada.
  const m = muestraDeSets(Array.from({ length: 10 }, (_, i) => ({ id: `s${i}` })))
  check('ni un set dos veces', new Set(m.map((s) => s.id)).size === m.length, JSON.stringify(m.map((s) => s.id)))
  // Y las filas sin id no entran: una fila así haría una petición a
  // `/sets/undefined`, que es un 404 que parece un fallo del catálogo.
  check('las filas sin id se caen', muestraDeSets([{ id: 'a' }, {}, null, { id: 'b' }]).length === 2)
}

console.log('\n── 3. El id se compara SIN distinguir mayúsculas ──')
//
// Es el fallo que PINGU destapó, y se comprueba sobre el código porque la
// comparación vive dentro del manejador del botón.
{
  const js = leer('admin/js/admin.js')
  const i = js.indexOf('async function mirarUnSet()')
  check('la función sigue ahí', i > 0)
  const fn = js.slice(i, i + js.slice(i).indexOf('\n}\n'))
  check('compara en minúsculas', /toLowerCase\(\)/.test(fn), 'no hay ni un toLowerCase')
  // Y por el id QUE DEVUELVE TCGdex, no solo por el escrito: es el que
  // dice cómo se llama el set de verdad.
  check('  …y usa el id que contesta TCGdex', /completo\?\.id/.test(fn))
  // Cuando NO lo tenemos, lo dice con contexto. Un «no está» a secas es
  // justo la respuesta ambigua que esta tanda viene a quitar.
  check('un «no lo tenemos» va con cuántos sí tenemos', /NO lo tenemos/.test(fn) && /deEseMercado\.length/.test(fn))
  check('  …y con unos cuantos ids nuestros para comparar', /cómo se escriben/.test(fn))
}

console.log('\n── 4. El sondeo pide el listado y lo enseña ──')
//
// Porque `cs1a CN` dio 404 y no había cómo saber los identificadores de
// verdad del catálogo chino.
{
  const js = leer('admin/js/admin.js')
  const i = js.indexOf('async function sondearMercado()')
  check('existe', i > 0)
  const fn = js.slice(i, i + js.slice(i).indexOf('\n}\n'))
  check('pide el LISTADO del mercado', /await fetchSets\(market\)/.test(fn))
  check('  …y enseña los identificadores de verdad', /Así se llaman/.test(fn) && /los diez últimos/i.test(fn))
  check('pide el set COMPLETO de cada uno de la muestra', /await fetchSet\(s\.id, market\)/.test(fn))
  check('  …y cuenta logo, símbolo y cartas con imagen', /completo\?\.logo/.test(fn) && /completo\?\.symbol/.test(fn) && /c\.image/.test(fn))
  // LA FECHA de cada set sondeado, que es lo que permite ver si la
  // cobertura depende de la antigüedad — que es la pregunta.
  check('  …con la FECHA al lado', /releaseDate/.test(fn))
  // Y no atiza un catálogo comunitario y gratuito: la misma pausa que se
  // le pide a la función programada.
  check('espera entre peticiones', /setTimeout\(r, 350\)/.test(fn))
  // Un mercado que no es uno de los nuestros no se pide: sería un 404 que
  // parece que TCGdex está roto.
  check('un mercado inventado no se pide', /MERCADOS_A_IMPORTAR\.includes\(market\)/.test(fn))
  // Y si un set no contesta, el sondeo SIGUE: un 404 de uno no puede
  // tirar los otros ocho, que es lo que le pasó a PINGU con `cs1a`.
  check('un set que falla no tumba el sondeo', /NO CONTESTA/.test(fn))
}

console.log('\n── 5. Y el panel lo tiene conectado ──')
{
  const html = leer('admin/index.html')
  const js = leer('admin/js/admin.js')
  check('el botón está', /id="btnSondearMercado"/.test(html))
  check('  …conectado', /getElementById\('btnSondearMercado'\)\?\.addEventListener/.test(js))
  // La aritmética vive en el módulo SIN dependencias y no en `admin.js`,
  // que importa `supabase.js` y no se puede probar sin navegador (la
  // norma de la 471).
  check('la muestra vive en el módulo puro', /export function muestraDeSets/.test(leer('admin/js/cuentas-mercado.js')))
  check('  …que no importa nada', !/^import /m.test(leer('admin/js/cuentas-mercado.js')))
  check('  …y `admin.js` la importa de allí', /muestraDeSets.*from '\.\/cuentas-mercado\.js'/.test(js))
}

console.log('\n── 6. El cable trampa de las mayúsculas en /coleccion ──')
//
// `filtroDeColeccion` baja la clave a minúsculas porque los ids
// occidentales lo son (`sv08`, `me05`). El japonés los nombra en
// MAYÚSCULAS, y `id.eq.` de Postgres distingue caja: `id.eq.sv1a` no
// casaría con `SV1a` y la ficha de una colección japonesa daría un 404 sin
// que nada diera error.
//
// Hoy no pasa por un motivo concreto —`js/coleccion.js` lleva
// `const MERCADO = 'WEST'`— y no por suerte. Pero un comentario que
// justifica un atajo caduca y nadie vuelve a leerlo (la lección de la 471),
// así que esto es el aviso que SÍ salta: el día que /coleccion deje de ser
// de un solo mercado, esta prueba se pone roja y manda a arreglar el filtro.
{
  const filtro = leer('js/carta-ruta.js')
  const pagina = leer('js/coleccion.js')
  const bajaLaCaja = /id\.eq\.\$\{limpia\.toLowerCase\(\)\}/.test(filtro)
  const unSoloMercado = /const MERCADO = 'WEST'/.test(pagina)
  if (bajaLaCaja) {
    check(
      '`filtroDeColeccion` baja la caja, luego /coleccion sigue siendo de UN mercado',
      unSoloMercado,
      'ARREGLA `filtroDeColeccion`: /coleccion ya no es solo occidental y el japonés nombra sus sets en MAYÚSCULAS'
    )
    // Y que el aviso siga escrito al lado, que es lo que explica el porqué
    // a quien llegue aquí por esta prueba.
    check('  …y el porqué está escrito al lado', /MAYÚSCULAS/.test(filtro))
  } else {
    // Si alguien ya lo arregló, la prueba no exige el atajo de vuelta:
    // solo que no se resuelva una dirección con una comparación sensible a
    // la caja sobre varios catálogos.
    check('`filtroDeColeccion` ya no baja la caja: nada que vigilar', true)
  }
}

console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
