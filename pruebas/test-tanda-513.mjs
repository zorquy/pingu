// Tanda 513 — la imagen resumen de una partida, para redes.
//
// PINGU, de la lista de ideas: «una imagen 1080×1350: ganador, mazos,
// carrera de premios y tres números clave, sin sprites ni arte de cartas».
//
//   1. Lo que cuenta (datosDelResumen, sin DOM): el ganador y cómo, los dos
//      jugadores con su mazo, la carrera y las tres cifras — y que
//      «esconder» un nombre lo esconde en TODAS partes.
//   2. Lo que NO lleva: ni sprites ni dibujos de cartas; el módulo no pinta
//      ninguna imagen de fuera y al hacerla no se pide ninguna.
//   3. La ventana de /repeticiones: la vista previa de 1080×1350, con los
//      colores de la mesa (que siguen al jugador al girarla, no al lado),
//      el fichero que se descarga y esconder al rival.
import { readFileSync } from 'node:fs'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const RAIZ = '/home/user/pingu'
const BASE = process.env.PD_BASE || process.env.BASE || 'http://localhost:8892'
const leer = (f) => readFileSync(`${RAIZ}/${f}`, 'utf8')

const { EJEMPLO } = await import(`${RAIZ}/js/repeticiones/ejemplo.js`)
const { leerRegistro } = await import(`${RAIZ}/js/repeticiones/registro.js`)
const { fotos: fotosDe } = await import(`${RAIZ}/js/repeticiones/estado.js`)
const { numerosDe, momentosDe } = await import(`${RAIZ}/js/repeticiones/numeros.js`)
const M = await import(`${RAIZ}/js/repeticiones/resumen-imagen.js`)

const lectura = leerRegistro(EJEMPLO)
const fotos = fotosDe(lectura)
const numeros = numerosDe(lectura, fotos)
const momentos = momentosDe(lectura, fotos)
const fin = momentos.find((m) => m.tipo === 'fin')

console.log('\n── 1. Lo que cuenta ──')
{
  const mazos = { Rojo: { arq: { nombre: 'Alakazam' } }, Azul: { arq: null } }
  const d = M.datosDelResumen({ numeros, momentos, mazos, titulo: 'Final del torneo', izquierda: 'Rojo', protagonista: 'Rojo' })
  check('el título es el de la repetición', d.titulo === 'Final del torneo')
  check('la línea dice los turnos', d.linea === `${numeros.turnos} turnos`, d.linea)
  check('el ganador, cómo y en qué turno (del registro)', d.ganador.nombre === 'Rojo' && d.ganador.porque === 'por rendición' && d.ganador.turno === fin.turno && fin.turno > 0, JSON.stringify(d.ganador))
  check('los dos jugadores, el de la izquierda primero, con su mazo (o sin él)', JSON.stringify(d.jugadores.map((j) => [j.nombre, j.mazo])) === '[["Rojo","Alakazam"],["Azul",null]]', JSON.stringify(d.jugadores))
  check('los colores son los de la mesa: el protagonista en hielo, el otro en oro', d.jugadores[0].color === '#9fd0f0' && d.jugadores[1].color === '#f5cf7a' && d.ganador.color === '#9fd0f0')
  const p = numeros.por
  check('las tres cifras salen de los números de la partida', JSON.stringify(d.cifras.map((c) => [c.etiqueta, ...c.valores])) === JSON.stringify([
    ['Daño hecho', String(p.Rojo.danio), String(p.Azul.danio)],
    ['Pokémon noqueados', String(p.Rojo.kos), String(p.Azul.kos)],
    ['Golpe más fuerte', p.Rojo.golpeMax ? String(p.Rojo.golpeMax.danio) : '—', p.Azul.golpeMax ? String(p.Azul.golpeMax.danio) : '—'],
  ]), JSON.stringify(d.cifras))
  check('  …y el golpe lleva el nombre de su ataque', d.cifras[2].notas[0] === (p.Rojo.golpeMax?.ataque || ''))
  check('la carrera, punto a punto y en el orden de los lados', d.carrera.length === numeros.carrera.length && d.carrera.every((c, i) => c.premios[0] === numeros.carrera[i].premios.Rojo && c.premios[1] === numeros.carrera[i].premios.Azul) && d.carrera[0].premios.join() === '6,6')

  // Girada la mesa: Azul a la izquierda, pero cada uno con SU color.
  const g = M.datosDelResumen({ numeros, momentos, mazos, izquierda: 'Azul', protagonista: 'Rojo' })
  check('girada, cambia el lado y no el color', g.jugadores[0].nombre === 'Azul' && g.jugadores[0].color === '#f5cf7a' && g.ganador.color === '#9fd0f0' && g.cifras[0].valores[0] === String(p.Azul.danio) && g.carrera.at(-1).premios[0] === numeros.carrera.at(-1).premios.Azul)
  check('sin título, «X contra Y»', g.titulo === 'Azul contra Rojo')

  const e = M.datosDelResumen({ numeros, momentos, mazos, titulo: 'Rojo contra Azul', izquierda: 'Azul', protagonista: 'Rojo', esconder: 'Rojo' })
  const todo = JSON.stringify(e)
  check('esconder un nombre lo quita de TODAS partes (título, ganador, jugadores)', !todo.includes('Rojo') && e.ganador.nombre === 'Rival' && e.jugadores[1].nombre === 'Rival' && e.titulo === 'Azul contra Rival', todo.slice(0, 200))

  const sinFin = leerRegistro(EJEMPLO.replace(/El rival se ha rendido\. Rojo ha ganado\.\s*$/, ''))
  const f2 = fotosDe(sinFin)
  const s = M.datosDelResumen({ numeros: numerosDe(sinFin, f2), momentos: momentosDe(sinFin, f2), izquierda: 'Rojo', protagonista: 'Rojo' })
  check('un registro sin final no se inventa ganador', s.ganador === null)
  check('sin los dos jugadores no hay imagen', M.datosDelResumen({ numeros: { jugadores: ['Rojo'], por: {}, carrera: [] } }) === null)
  check('el fichero: el título sin acentos ni símbolos', M.nombreDeFichero('Final: Ñandú contra Azul!') === 'partida-final-nandu-contra-azul.png' && M.nombreDeFichero('') === 'partida-pokedoc.png')
}

console.log('\n── 2. Lo que no lleva ──')
{
  const js = leer('js/repeticiones/resumen-imagen.js')
  check('el módulo no pinta ninguna imagen de fuera (ni sprites ni cartas)', !/drawImage|new Image|sprite|tcgdex|limitless|pokeapi|createImageBitmap/i.test(js.replace(/^\s*\/\/.*$/gm, '')))
  check('mide 1080 × 1350, lo que dice la ventana', M.W === 1080 && M.H === 1350 && /const ESCALA = 1\b/.test(js))
  const pag = leer('js/repeticiones.js')
  check('la ventana lo carga al abrirla, no con la página', /await import\('\.\/repeticiones\/resumen-imagen\.js'\)/.test(pag) && !/^import[^\n]*resumen-imagen/m.test(pag))
  check('la ventana dice el tamaño que de verdad tiene', /en 1080 × 1350: el tamaño de un post vertical de Instagram/.test(pag))
}

console.log('\n── 3. La ventana ──')
const browser = await chromium.launch()
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, acceptDownloads: true })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.goto(`${BASE}/repeticiones`, { waitUntil: 'domcontentloaded' })
  await page.locator('#repEjemplo').click()
  await page.waitForSelector('#repSala:not(.hidden)', { timeout: 8000 })
  const boton = page.locator('.rep-numeros-cab [data-accion="imagen"]')
  check('«La partida en números» ofrece «Imagen para redes»', (await boton.count()) === 1 && (await boton.textContent()).trim() === 'Imagen para redes')
  // Lo que se pinta en el canvas de la imagen: la página tiene sus propios
  // sprites (los de los mazos), así que no se miran las peticiones sino lo
  // que entra en ESE lienzo.
  await page.evaluate(() => {
    window.__pintadas__ = []
    const original = CanvasRenderingContext2D.prototype.drawImage
    CanvasRenderingContext2D.prototype.drawImage = function (img, ...resto) {
      if (this.canvas.width === 1080 && this.canvas.height === 1350) window.__pintadas__.push(img.src || img.constructor.name)
      return original.call(this, img, ...resto)
    }
  })
  await boton.click()
  const vista = page.locator('#repResumenVista')
  await page.waitForFunction(() => document.querySelector('#repResumenVista')?.src.startsWith('blob:') && document.querySelector('#repResumenVista').complete, null, { timeout: 10000 }).catch(() => null)
  const tam = await vista.evaluate((i) => [i.naturalWidth, i.naturalHeight])
  check('la vista previa es la imagen de verdad, de 1080 × 1350', tam.join('x') === '1080x1350', tam.join('x'))
  check('  …con un texto alternativo que dice lo que enseña', /^Vista previa: gana Rojo, Rojo( con [^,]+)? contra Azul/.test(await vista.getAttribute('alt')), await vista.getAttribute('alt'))
  const pintadas = await page.evaluate(() => window.__pintadas__)
  check('  …y sin pintar dentro ni un sprite ni una carta', !pintadas.length, pintadas.slice(0, 3).join(' '))
  // El color del ganador, en la franja de su nombre: Rojo es el protagonista
  // del registro, así que va en azul hielo.
  const colores = (caja) =>
    vista.evaluate((img, [x, y, w, h]) => {
      const c = document.createElement('canvas')
      c.width = img.naturalWidth
      c.height = img.naturalHeight
      const k = c.getContext('2d')
      k.drawImage(img, 0, 0)
      const d = k.getImageData(x, y, w, h).data
      const cerca = (r, g, b) => {
        let n = 0
        for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - r) < 12 && Math.abs(d[i + 1] - g) < 12 && Math.abs(d[i + 2] - b) < 12) n++
        return n
      }
      return { hielo: cerca(0x9f, 0xd0, 0xf0), oro: cerca(0xf5, 0xcf, 0x7a) }
    }, caja)
  let c = await colores([80, 300, 920, 100])
  check('el nombre del ganador va en SU color (hielo), no en el del otro', c.hielo > 200 && c.oro < 20, JSON.stringify(c))
  c = await colores([48, 480, 12, 110])
  check('la barra del jugador de la izquierda (Rojo) es hielo', c.hielo > 500 && c.oro < 20, JSON.stringify(c))
  check('el botón de descargar se habilita cuando está lista', await page.locator('[data-dlg="bajar-imagen"]').isEnabled())
  const [bajada] = await Promise.all([page.waitForEvent('download', { timeout: 5000 }).catch(() => null), page.locator('[data-dlg="bajar-imagen"]').click()])
  check('descarga un PNG con el título por nombre', bajada?.suggestedFilename() === 'partida-rojo-contra-azul.png', bajada?.suggestedFilename())

  // Esconder al rival: Azul sale como «Rival» y el fichero lo dice.
  const etiqueta = (await page.locator('label:has(#repResumenEsconder)').textContent()).replace(/\s+/g, ' ').trim()
  check('la casilla dice a quién esconde', etiqueta === 'Esconder el nombre de Azul (sale como «Rival»)', etiqueta)
  const antes = await vista.getAttribute('src')
  await page.locator('#repResumenEsconder').check()
  await page.waitForFunction((a) => document.querySelector('#repResumenVista').src !== a && document.querySelector('#repResumenVista').complete, antes, { timeout: 10000 }).catch(() => null)
  check('escondido, la imagen se rehace sin su nombre', /contra Rival( con [^.]+)?\.$/.test(await vista.getAttribute('alt')) && !(await vista.getAttribute('alt')).includes('Azul'), await vista.getAttribute('alt'))
  const [otra] = await Promise.all([page.waitForEvent('download', { timeout: 5000 }).catch(() => null), page.locator('[data-dlg="bajar-imagen"]').click()])
  check('  …y el fichero tampoco lo lleva', otra?.suggestedFilename() === 'partida-rojo-contra-rival.png', otra?.suggestedFilename())
  await page.locator('#repDialogo [data-cerrar]').first().click()

  // Girar la mesa: Azul pasa a la izquierda y sigue en oro.
  await page.locator('[data-accion="girar"]').click()
  await boton.click()
  await page.waitForFunction(() => document.querySelector('#repResumenVista')?.src.startsWith('blob:') && document.querySelector('#repResumenVista').complete, null, { timeout: 10000 }).catch(() => null)
  c = await colores([48, 480, 12, 110])
  check('girada la mesa, el de la izquierda (Azul) va en oro: el color sigue al jugador', c.oro > 500 && c.hielo < 20, JSON.stringify(c))
  check('  …y ahora se ofrece esconder a Rojo', (await page.locator('label:has(#repResumenEsconder)').textContent()).includes('Esconder el nombre de Rojo'))
  check('sin errores', !errores.length, errores.join(' | '))
  await page.close()
}
{
  // En el móvil la vista previa cabe y no empuja los botones fuera.
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  await page.goto(`${BASE}/repeticiones`, { waitUntil: 'domcontentloaded' })
  await page.locator('#repEjemplo').click()
  await page.waitForSelector('#repSala:not(.hidden)', { timeout: 8000 })
  await page.locator('.rep-numeros-cab [data-accion="imagen"]').click()
  await page.waitForFunction(() => document.querySelector('#repResumenVista')?.complete && document.querySelector('#repResumenVista').src.startsWith('blob:'), null, { timeout: 10000 }).catch(() => null)
  const r = await page.evaluate(() => {
    const v = document.querySelector('#repResumenVista').getBoundingClientRect()
    const b = document.querySelector('[data-dlg="bajar-imagen"]').getBoundingClientRect()
    return { w: v.width, h: v.height, bajo: b.bottom, alto: innerHeight, boton: b.height, ancho: document.documentElement.scrollWidth }
  })
  check('en el móvil la vista previa guarda la proporción y no se sale', Math.abs(r.w / r.h - 1080 / 1350) < 0.02 && r.w <= 358, JSON.stringify(r))
  check('  …el botón de descargar se ve sin hacer scroll y mide 44', r.bajo <= r.alto && r.boton >= 44, JSON.stringify(r))
  check('  …y la página no se ensancha', r.ancho <= 390, r.ancho)
  await page.close()
}

await browser.close()
console.log(fails ? `\n${fails} FALLAN` : '\nTodo en verde')
process.exit(fails ? 1 : 0)
