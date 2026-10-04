// Tanda 524 — un camino escrito en prosa es un enlace que nadie comprueba.
//
// Es la TERCERA vez esta semana: la 510 encontró el estado vacío de
// /mi-coleccion mandando a «Añadir cartas», una pestaña que borró la 408;
// y ahora dos frases más de la misma pantalla mandaban a la pestaña
// «Cartas», que SALIÓ DEL MENÚ en la 447 (la pantalla sigue, se llega por
// el panel). Y de paso dos nombres de control que no existen en ninguna
// pantalla: «Precio de compra» —el campo se llama «Lo que pagaste (€)»— y
// «la doy», que es «De esas, doy».
//
// El patrón es siempre el mismo y no da ningún error: **el texto no se
// rompe cuando su destino desaparece.** Un botón sí. Así que lo que se
// puede convertir en botón va en botón, y lo que tiene que seguir siendo
// una frase —el nombre de un campo, que no es un sitio al que ir— lo
// vigila el barrido de abajo.
import { readFileSync, readdirSync } from 'node:fs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 600) : ''}`)
}

const RAIZ = '/home/user/pingu'

// ── LO QUE NO ES UN DESTINO ──
//
// Una frase entre comillas angulares puede ser tres cosas distintas: el
// nombre de un control (lo que vigila esto), un EJEMPLO de lo que
// escribiría alguien, o una palabra citada. Las dos últimas van aquí, una
// por una y con su motivo, porque una lista corta y explicada se mantiene
// y un barrido que perdona por su cuenta no vigila nada.
const NO_SON_CONTROLES = new Set([
  // Ejemplos de lo que escribe un admin en un aviso del sitio.
  'el sábado hay torneo', 'mantenimiento a las 22h',
  // Un mazo de ejemplo en la ayuda del panel.
  'Martillos',
  // El informe de Scrydex de /admin: códigos y nombres de VEREDICTO, que
  // son del propio informe y no botones.
  'UNB', 'rechazado de verdad', 'por mirar a mano',
  'nuestro nombre está en español', 'sin comprobar',
  // Dos explicaciones del laboratorio: citan un concepto, no un control.
  'cualquiera de las marcadas', 'Para tu turno N',
  // La guarda del esquema cita el nombre de una política de la base.
  'listas nunca públicas',
  // Dos nombres de sección escritos como pregunta, en su propia página.
  '¿qué jugarías?', '¿esta carta es falsa?',
])

const ficheros = []
const andar = (dir) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.git' || e.name === 'fotos') continue
    if (e.isDirectory()) andar(`${dir}/${e.name}`)
    else if (/\.(js|html)$/.test(e.name)) ficheros.push(`${dir}/${e.name}`)
  }
}
andar(RAIZ)

// UN DESTINO NOMBRADO EN UN COMENTARIO NO ES UN DESTINO, y esto es la
// mitad de la tanda: `mi-coleccion.html` nombra «Cartas» en tres
// comentarios que cuentan por qué se quitó del menú, así que un barrido
// que no los quitara habría dado por bueno justo el fallo que buscaba.
//
// Y se respetan los SALTOS DE LÍNEA al borrarlos: si se colapsan, el
// informe apunta a otra línea y manda a mirar donde no es (pasó al
// escribirlo).
const sinComentarios = (txt) => txt
  .replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '))
  .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
  .split('\n')
  .map((l) => (/^\s*(\/\/|\*|<!--)/.test(l) ? '' : l.replace(/(^|[^:'"\w])\/\/.*$/, '$1')))
  .join('\n')

const limpios = new Map()
for (const f of ficheros) limpios.set(f, sinComentarios(readFileSync(f, 'utf8')))

console.log('── El barrido llega ──')
check('se recorren las páginas y los módulos', ficheros.length > 150, ficheros.length)
check('y los comentarios se quitan de verdad',
  !limpios.get(`${RAIZ}/mi-coleccion.html`).includes('SALE del menú'),
  'el comentario de la 447 sigue contando como destino')

console.log('── Cada nombre de control entre comillas existe en alguna pantalla ──')
{
  const huerfanas = []
  let mirados = 0
  for (const [f, txt] of limpios) {
    txt.split('\n').forEach((l, i) => {
      for (const m of l.matchAll(/«([^»]{2,40})»/g)) {
        const frase = m[1]
        // Lo que lleva un valor dentro cita lo que haya escrito alguien.
        if (frase.includes('${')) continue
        if (NO_SON_CONTROLES.has(frase)) continue
        mirados++
        // ¿Sale en algún OTRO sitio, que no sea esta misma línea?
        let fuera = false
        for (const [g, otro] of limpios) {
          for (const [j, ol] of otro.split('\n').entries()) {
            if (g === f && j === i) continue
            if (ol.includes(frase)) { fuera = true; break }
          }
          if (fuera) break
        }
        if (!fuera) huerfanas.push(`${f.replace(RAIZ, '.')}:${i + 1} «${frase}»`)
      }
    })
  }
  check('se han mirado nombres de verdad', mirados > 40, mirados)
  check('ninguno nombra un control que no existe', huerfanas.length === 0, huerfanas.join(' | '))
}

console.log('── Y los dos caminos de Cambios son BOTONES, no indicaciones ──')
{
  const mc = readFileSync(`${RAIZ}/js/mi-coleccion.js`, 'utf8')
  // Entero y entre comillas (la trampa de la 312): `data-ir-cartas` suelto
  // casaría también con un `data-ir-cartas-algo`.
  check('el paso 1 lleva botón', (mc.match(/data-ir-cartas>/g) || []).length === 2, (mc.match(/data-ir-cartas>/g) || []).length)
  check('y hay quien lo atienda', mc.includes("closest('[data-ir-cartas]')"))
  check('va a la pantalla de las cartas', mc.includes("if (aCartas) return cambiarPestania('cartas')"))
  // Y la pantalla existe, que es lo que hace que el botón no sea otro
  // callejón: «cartas» sigue en la lista aunque no esté en el menú.
  check('«cartas» sigue siendo una pantalla', /const PESTANAS = \[[^\]]*'cartas'/.test(mc))
  // Sobre el texto SIN COMENTARIOS: «pestaña “Cartas”» sigue escrito en un
  // comentario que explica de qué otra pantalla es una pieza, y eso es
  // información correcta. Mirarlo sobre el fichero entero es la trampa de
  // la 312 al revés — contar lo que CONTIENE la cadena cuando lo que
  // importa es dónde.
  check('ya no se manda a buscar una pestaña que no está',
    !limpios.get(`${RAIZ}/js/mi-coleccion.js`).includes('pestaña «Cartas»'))
}

console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
