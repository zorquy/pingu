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
// ── LO QUE QUEDA DE ESTA PRUEBA (tanda 550) ──
//
// Las cinco primeras secciones probaban los botones de sondeo de /admin, y
// esos botones ya no existen: PINGU pidió limpiar el panel de lo que fue
// una prueba de una vez, y lo que contestaron está escrito en SCHEMA.md y
// en CLAUDE.md, que es donde sirve. Con ellos se fue `cuentas-mercado.js`.
//
// Se queda la sexta, que no era del botón: vigila que mientras
// `filtroDeColeccion` baje la caja de la clave, /coleccion siga siendo de
// UN solo mercado — porque el japonés nombra sus sets en MAYÚSCULAS y
// `id.eq.` distingue.
import { readFileSync } from 'node:fs'

const leer = (p) => readFileSync(`/home/user/pingu/${p}`, 'utf8')
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

console.log('── El cable trampa de las mayúsculas en /coleccion ──')
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
