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
import { readFileSync, readdirSync, existsSync } from 'node:fs'

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
  // Un ejemplo de lo que se puede escribir en el puesto de un premio,
  // que es texto libre: «1º», «Top 8», «Todos los participantes».
  'Todos los participantes',
  // Una opción del menú Compartir de SAFARI (732): el paso para instalar
  // la web en un iPhone; el control es de Apple, no nuestro.
  'Añadir a pantalla de inicio',
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

// Y UN SEGUNDO JUEGO, SIN LAS PROPIAS CITAS. Un nombre existe cuando está
// escrito en una PANTALLA —el rótulo de un campo, el texto de un botón—,
// no cuando lo cita otra frase. Si vale cualquier mención, dos frases que
// nombran lo mismo se dan la razón entre ellas y el barrido no puede ver
// que el campo se llame ya de otra manera: le pasó al escribirlo, porque
// «De esas, doy» está citado DOS veces en la misma pantalla.
//
// Es la trampa de la 314 otra vez, y aquí la parte buena es que la
// distinción es exacta: una cita va entre comillas angulares y un rótulo
// no.
const sinCitas = new Map()
for (const [f, txt] of limpios) sinCitas.set(f, txt.replace(/«[^»]*»/g, ' '))

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
        for (const [, otro] of sinCitas) {
          if (otro.includes(frase)) { fuera = true; break }
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

console.log('── Y lo mismo con las RUTAS: un href es una promesa ──')
{
  // Un nombre de control que no existe manda a buscar; una ruta que no
  // existe manda al 404, que es la misma cosa un paso más allá. Sale
  // gratis mirarlo aquí, que es donde ya están todos los ficheros
  // abiertos.
  //
  // Una ruta puede existir de tres maneras: el fichero, su `.html`, o una
  // REDIRECCIÓN de `netlify.toml` — /rss.xml es una función y no un
  // fichero, así que sin leer las redirecciones este barrido la cantaría
  // como rota y habría que acallarlo a mano, que es como empiezan los
  // barridos que ya no dicen nada.
  const toml = readFileSync(`${RAIZ}/netlify.toml`, 'utf8')
  const redirigidas = [...toml.matchAll(/from = "([^"]+)"/g)]
    .map((m) => m[1])
    .filter((r) => r.startsWith('/'))
  const escapar = (s) => s.split('').map((ch) => ('.*+?^${}()|[]\\'.includes(ch) ? '\\' + ch : ch)).join('')
  const cubreRedireccion = (ruta) => redirigidas.some((r) => {
    if (r === ruta) return true
    // Las dos formas de comodín de Netlify: /carta/* y /foro/:slug.
    const re = new RegExp('^' + escapar(r).split('\\*').join('.*').replace(/:[a-z]+/gi, '[^/]+') + '$')
    return re.test(ruta)
  })
  const existe = (ruta) => {
    const limpia = ruta.split('?')[0].split('#')[0].replace(/\/$/, '')
    if (!limpia || limpia === '/') return true
    const base = limpia.replace(/^\//, '')
    return existsSync(`${RAIZ}/${base}`) || existsSync(`${RAIZ}/${base}.html`) ||
      existsSync(`${RAIZ}/${base}/index.html`) || cubreRedireccion(limpia)
  }
  const rotas = new Set()
  let mirados = 0
  for (const [f, txt] of limpios) {
    for (const l of txt.split('\n')) {
      for (const m of l.matchAll(/href="(\/[^"'`${}\s]*)"/g)) {
        const r = m[1]
        if (r.startsWith('//')) continue
        mirados++
        if (!existe(r)) rotas.add(`${f.replace(RAIZ, '.')} → ${r}`)
      }
    }
  }
  check('se han mirado rutas de verdad', mirados > 100, mirados)
  check('ninguna lleva a una página que no existe', rotas.size === 0, [...rotas].join(' | '))
}

console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
