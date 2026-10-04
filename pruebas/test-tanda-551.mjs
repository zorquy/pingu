// Tanda 551 — colocar ARRASTRANDO, y subir el logo.
//
// PINGU, con el editor de la 550 delante: «no me gusta la forma de ordenar,
// no quiero meter números; quiero simplemente arrastrar una colección
// arriba o abajo, que sean arrastrables. Y al editar el logo, que también
// pueda cargar yo una imagen, no solamente poner un enlace».
//
// Tenía razón en las dos. Un número es cómo se GUARDA el orden, no cómo se
// decide: para mover una colección tres puestos había que mirar qué número
// tenían las de alrededor y calcular uno en medio, que es pedirle a una
// persona que haga de base de datos.
//
// Lo que se guarda sigue siendo un número —se recalcula al soltar—, y de
// diez en diez a propósito: así una colocación suelta escribe las filas que
// se movieron y no las doscientas.
import { readFileSync } from 'node:fs'
import { numeros, moverEnLista, loQueCambia, dondeCae } from '/home/user/pingu/admin/js/orden-arrastrable.js'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 250) : ''}`)
}
const leer = (p) => readFileSync(`/home/user/pingu/${p}`, 'utf8')

console.log('── 1. Mover uno ──')
{
  const l = ['a', 'b', 'c', 'd']
  check('hacia arriba', moverEnLista(l, 'c', -1).join() === 'a,c,b,d', moverEnLista(l, 'c', -1).join())
  check('hacia abajo', moverEnLista(l, 'b', 1).join() === 'a,c,b,d', moverEnLista(l, 'b', 1).join())
  // En los extremos no se cae de la lista ni da la vuelta: se queda.
  check('el primero no sube más', moverEnLista(l, 'a', -1).join() === 'a,b,c,d')
  check('el último no baja más', moverEnLista(l, 'd', 1).join() === 'a,b,c,d')
  check('uno que no está, no toca nada', moverEnLista(l, 'z', 1).join() === 'a,b,c,d')
  // Y NO SE MUTA la de entrada: es lo que hay en pantalla, y si se pisa
  // sola el segundo movimiento parte de algo que ya no es lo que se ve.
  check('la lista de entrada no se toca', l.join() === 'a,b,c,d', l.join())
}

console.log('── 2. Lo que se escribe, y SOLO lo que cambia ──')
{
  check('se numera de diez en diez', numeros(['a', 'b', 'c']).join() === '10,20,30', numeros(['a', 'b', 'c']).join())
  // Mover UNA no puede escribir las doscientas: con 231 colecciones eso
  // son 231 peticiones por arrastre.
  const antes = new Map([['a', 10], ['b', 20], ['c', 30], ['d', 40]])
  const cambios = loQueCambia(antes, ['a', 'c', 'b', 'd'])
  check('cambiar dos de sitio escribe DOS filas', cambios.length === 2, JSON.stringify(cambios))
  check('  …las que se movieron', cambios.map((c) => c.id).sort().join() === 'b,c', JSON.stringify(cambios))
  check('y si no se mueve nada, no se escribe nada', loQueCambia(antes, ['a', 'b', 'c', 'd']).length === 0)
  // Una lista recién traída del catálogo no tiene ningún número: la
  // primera colocación los pone todos, y eso es correcto.
  const sinNada = new Map([['a', null], ['b', null]])
  check('la primera colocación numera lo que hay', loQueCambia(sinNada, ['b', 'a']).length === 2)
}

console.log('── 3. Dónde cae lo que se suelta ──')
{
  const cajas = [
    { id: 'a', top: 0, alto: 40 },
    { id: 'b', top: 40, alto: 40 },
    { id: 'c', top: 80, alto: 40 },
  ]
  check('por encima de la mitad de la primera, antes de ella', dondeCae(cajas, 10) === 'a')
  check('por debajo de su mitad, antes de la siguiente', dondeCae(cajas, 30) === 'b')
  check('en medio de la última, antes de ella', dondeCae(cajas, 90) === 'c')
  // AL FINAL: sin la mitad no se podría soltar al fondo —el cursor siempre
  // está sobre alguna fila— y mandar una al fondo es lo que más se hace.
  check('pasada la mitad de la última, AL FINAL', dondeCae(cajas, 110) === null, String(dondeCae(cajas, 110)))
  check('una lista vacía no rompe', dondeCae([], 10) === null)
}

console.log('── 4. Y en la pantalla: ni una caja de números ──')
{
  const js = leer('admin/js/colecciones.js')
  const html = leer('admin/index.html')
  check('no quedan cajas de número para ordenar', !/data-orden=|data-orden-era=/.test(js), 'queda una caja de número')
  check('las filas se arrastran', /draggable="true"/.test(js))
  check('  …y las eras también', (js.match(/draggable="true"/g) || []).length >= 2)
  // El asa es un BOTÓN y no un adorno: arrastrar no se puede hacer con el
  // teclado, así que con el asa enfocada las flechas mueven.
  check('el asa es un botón', /<button class="col-asa"/.test(js))
  check('  …y las flechas mueven', /ArrowUp/.test(js) && /ArrowDown/.test(js))
  check('  …y dice lo que hace a quien no lo ve', /aria-label="Mover /.test(js))
  // El texto de ayuda de la página tiene que decir lo que se hace ahora:
  // una frase de la interfaz es una afirmación sobre lo que hace el código.
  check('la ayuda ya no habla de números', !/El número de la izquierda/.test(html), 'la ayuda sigue explicando los números')
  check('  …sino de arrastrar', /[Aa]rrastra/.test(html))
}

console.log('── 5. El logo se sube, no solo se pega ──')
{
  const js = leer('admin/js/colecciones.js')
  check('hay un selector de fichero', /type="file"/.test(js) && /accept="image\/\*"/.test(js))
  // Con la misma comprobación que el resto de la web: un fichero que no es
  // una imagen, o que pesa de más, se rechaza ANTES de subirlo.
  check('  …con la comprobación de siempre', /validateImageFile/.test(js))
  check('  …y sube al cubo de las imágenes', /uploadGuideImage/.test(js))
  // Lo subido RELLENA la caja de la dirección en vez de guardarse por su
  // cuenta: así solo hay un sitio del que sale el logo, y se puede
  // cancelar la edición sin haber cambiado nada.
  check('lo subido rellena la dirección', /\$\('colLogo'\)\.value = url/.test(js))
  check('  …y se ve antes de guardar', /colLogoVer/.test(js))
}

console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
