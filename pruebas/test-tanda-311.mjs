import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync, readdirSync } from 'node:fs'

// Tanda 311: que todo se LEA. El contraste medido en las dos pantallas,
// el rojo con nombre, y el espaciado cuadrado en la retícula.
//
// De dónde viene: PINGU, «sigue con todas las mejoras pendientes». Lo
// que había debajo: 45 reglas ponían texto --navy sobre --ice y en
// oscuro daban 4,17; doce controles que se pulsan iban pintados con el
// gris de los apuntes (2,35); y el rojo de peligro no existía como
// token — iba a mano 61 veces, en tres tonos, sin adaptarse al tema.

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + extra : ''}`)
}

const RAIZ = '/home/user/pingu'
const leer = (f) => readFileSync(`${RAIZ}/${f}`, 'utf8')
const HOJAS = readdirSync(`${RAIZ}/css`).filter((f) => f.endsWith('.css')).map((f) => `css/${f}`)
// Un comentario que NOMBRA el valor prohibido pone en rojo la prueba que
// lo busca. Van tres veces (la 305 con --t-lg, la 310 con --shadow-lg y
// con loading=), así que aquí se quitan los dos tipos de comentario.
const sinComentarios = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(?<![:'"`])\/\/[^\n]*/g, '')
const BASE = 'http://localhost:8892'
const browser = await chromium.launch()

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. Nada de lo que se lee se queda corto de contraste ──')
{
  // LA FORMA, no el caso. No se comprueba «--navy vale tal cosa» ni «esta
  // clase usa aquel token»: se MIDE, en las dos pantallas y en las ocho
  // páginas, el color de cada texto contra el fondo que de verdad tiene
  // detrás. Así una paleta futura que vuelva a quedarse corta cae aquí
  // sola, sin que nadie se acuerde de esta tanda.
  const lum = (c) => {
    const m = c.match(/[\d.]+/g)
    if (!m) return null
    const [r, g, b, a = 1] = m.map(Number)
    // Un color casi transparente no es el color que se ve: medirlo da un
    // número que no corresponde a nada.
    if (a < 0.5) return null
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
  }

  for (const tema of ['light', 'dark']) {
    const flojos = new Map()
    let medidos = 0
    for (const ruta of ['/index.html', '/aprender', '/foro', '/usuarios', '/torneos', '/perfil', '/mis-partidas', '/noticias']) {
      const page = await browser.newPage({ viewport: { width: 1100, height: 900 } })
      await page.addInitScript((t) => {
        localStorage.setItem('pokedoc-theme', t)
        window.__FAKE_SESSION__ = 'user-1'
      }, tema)
      await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(1800)
      const datos = await page.evaluate(() => {
        // El fondo de VERDAD: el primer antepasado que pinte algo. Y si
        // lo que pinta es un degradado, su primera parada de color — sin
        // eso el medidor pasaba de largo hasta el blanco de la página y
        // daba 1,06 en el héroe del reto, que es texto blanco sobre azul.
        const fondoDe = (n) => {
          let e = n
          while (e) {
            const s = getComputedStyle(e)
            if (s.backgroundImage && s.backgroundImage !== 'none') {
              const parada = s.backgroundImage.match(/rgba?\([^)]*\)/)
              if (parada) return parada[0]
            }
            if (s.backgroundColor && !/rgba\(0, 0, 0, 0\)/.test(s.backgroundColor)) return s.backgroundColor
            e = e.parentElement
          }
          return 'rgb(255,255,255)'
        }
        const HOJA = 'p, span, a, h1, h2, h3, li, button, td, small, strong'
        return [...document.querySelectorAll(HOJA)]
          .filter((n) => n.offsetParent !== null && n.textContent.trim().length > 2 && !n.querySelector(HOJA))
          .slice(0, 400)
          .map((n) => {
            const s = getComputedStyle(n)
            return {
              col: s.color, fon: fondoDe(n), tam: parseFloat(s.fontSize),
              cl: n.tagName + '.' + (n.className || '').toString().slice(0, 24),
              txt: n.textContent.trim().slice(0, 22),
            }
          })
      })
      for (const d of datos) {
        const l1 = lum(d.col), l2 = lum(d.fon)
        if (l1 === null || l2 === null) continue
        medidos++
        const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
        // El mínimo de la WCAG: 3 para lo grande, 4,5 para el resto.
        if (ratio < (d.tam >= 18.66 ? 3 : 4.5)) {
          flojos.set(d.cl + '|' + d.txt, `${ratio.toFixed(2)} ${d.cl} «${d.txt}» en ${ruta}`)
        }
      }
      await page.close()
    }
    // Y que el barrido LLEGUE. La lección de la 307: de una página de la
    // que no recoges nada no puedes decir que no tenga fallos, y sale
    // verde igual. Ocho páginas dan del orden de 190 textos con color y
    // fondo sólidos; si un día caen a cuatro, es que el doble dejó de
    // sembrar y esto no está midiendo nada.
    check(`[${tema}] el barrido llega a los textos`, medidos > 120, `${medidos} medidos`)
    check(`[${tema}] todo se lee`, flojos.size === 0, [...flojos.values()].slice(0, 6).join(' | '))
  }
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. El rojo de peligro tiene nombre ──')
{
  const style = sinComentarios(leer('css/style.css'))
  const claro = style.match(/^:root\s*\{([\s\S]*?)\n\}/m)?.[1] || ''
  const oscuro = style.match(/:root\[data-theme='dark'\]\s*\{([\s\S]*?)\n\}/)?.[1] || ''
  for (const [nombre, bloque] of [['claro', claro], ['oscuro', oscuro]]) {
    check(`--danger y --danger-bg existen en el tema ${nombre}`,
      /--danger:\s*\S/.test(bloque) && /--danger-bg:\s*\S/.test(bloque))
  }

  // EL FALLO QUE DE VERDAD PASÓ, y que no dio ni un error: el barrido que
  // sustituía los rojos pasó también por style.css y dejó
  // `--danger: var(--danger)`. Un token definido en términos de sí mismo
  // queda SIN definir, y todo lo que lo pedía se pintó del color de al
  // lado. La forma: ningún token puede nombrarse a sí mismo.
  const circulares = []
  for (const hoja of HOJAS) {
    for (const m of sinComentarios(leer(hoja)).matchAll(/(--[a-z0-9-]+)\s*:([^;]+);/g)) {
      if (m[2].includes(`var(${m[1]})`) || m[2].includes(`var(${m[1]},`)) circulares.push(`${hoja}: ${m[1]}`)
    }
  }
  check('ningún token se define en términos de sí mismo', circulares.length === 0, circulares.join(', '))

  // Y ningún rojo SÓLIDO escrito a mano. Dos excepciones declaradas, que
  // no son peligro sino IDENTIDAD —paletas cerradas donde el rojo es una
  // opción más y tiene que ser siempre el mismo—:
  //
  //  · --rt-* : los colores que elige quien escribe una guía. Cambian con
  //    el tema por su cuenta y su lista vive también en
  //    js/richtext-format.js.
  //  · COLORES_AVATAR (js/app.js): el color del avatar se deduce del
  //    identificador de cada persona y no puede cambiar al cambiar de
  //    tema. Aquí llegó a colarse `var(--danger)`, que en oscuro vuelve
  //    el rojo rosado y deja la inicial blanca encima en 2,4.
  //
  // Los rgba() translúcidos no entran: un tinte al 10% se lee igual sobre
  // los dos fondos a propósito, y eso está comentado donde toca.
  // Rojo de verdad, no naranja ni rosa: lo que distingue al rojo es que
  // el verde y el azul van PAREJOS y por debajo. En cuanto se separan ya
  // es un ámbar (verde arriba, como el de --warning) o un magenta (azul
  // arriba, como el rosa de la paleta del editor), y esos tienen su
  // propio token o su propia razón de estar a mano.
  const esRojo = (hex) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
    return r > 120 && r - g > 60 && r - b > 60 && Math.abs(g - b) < 40
  }
  const aMano = []
  for (const hoja of HOJAS) {
    for (const m of sinComentarios(leer(hoja)).matchAll(/([a-z-]+)\s*:\s*([^;{]*#[0-9a-f]{6}[^;{]*);/gi)) {
      if (m[1].startsWith('--rt-')) continue
      for (const h of m[2].matchAll(/#[0-9a-f]{6}/gi)) {
        if (esRojo(h[0]) && !/^--danger/.test(m[1])) aMano.push(`${hoja}: ${m[1]}: ${h[0]}`)
      }
    }
  }
  check('ningún rojo sólido escrito a mano en las hojas', aMano.length === 0, aMano.slice(0, 6).join(', '))

  const jsAMano = []
  for (const dir of ['js', 'js/torneos']) {
    for (const f of readdirSync(`${RAIZ}/${dir}`)) {
      if (!f.endsWith('.js') || f === 'richtext-format.js') continue
      const t = sinComentarios(leer(`${dir}/${f}`))
      // Solo donde el rojo se PINTA: un hex suelto dentro de una paleta
      // con nombre propio ya está cubierto por la excepción de arriba.
      for (const m of t.matchAll(/(?:color|background(?:-color)?)\s*:\s*(#[0-9a-f]{6})/gi)) {
        if (esRojo(m[1])) jsAMano.push(`${dir}/${f}: ${m[1]}`)
      }
    }
  }
  check('  …ni en los estilos en línea del JavaScript', jsAMano.length === 0, jsAMano.slice(0, 6).join(', '))
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. Un control que se pulsa no se pinta con el gris de los apuntes ──')
{
  // --text-dim es el gris de un metadato de refilón: una fecha, un
  // «hace 2 h». Da 2,35 de contraste, y eso está bien para algo que no
  // hace falta leer. Doce controles —«Eliminar», «Responder»,
  // «Denunciar», las flechas del reto, las pestañas del torneo— lo
  // usaban, y un botón SÍ hace falta leerlo.
  //
  // La excepción es un control DESACTIVADO: ahí el gris apagado es
  // justo el mensaje.
  const CONTROL = (sel) =>
    sel.split(',').some((parte) => {
      const s = parte.trim()
      // Un ancla es una ETIQUETA: o abre el selector, o va detrás de un
      // separador. Buscar «a:» a secas cazaba `.rte-vacia::before`.
      return /(^|[\s>+~])a([.:#[]|$)/.test(s) ||
        /(button|-btn\b|btn-|-boton\b|-borrar\b|-flecha\b|-pestana\b|\[role=.button)/i.test(s)
    })
  const grises = []
  for (const hoja of HOJAS) {
    for (const m of sinComentarios(leer(hoja)).matchAll(/([^{}]+)\{([^}]*)\}/g)) {
      const sel = m[1].trim()
      if (!/(^|[^-])color:\s*var\(--text-dim\)/.test(m[2])) continue
      if (!CONTROL(sel) || /\[disabled\]|:disabled|\.disabled/.test(sel)) continue
      grises.push(`${hoja}: ${sel.slice(0, 60)}`)
    }
  }
  check('ningún control activo va con --text-dim', grises.length === 0, grises.slice(0, 6).join(' | '))
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 4. El espaciado cuadra en la retícula ──')
{
  // La 310 quitó los impares. Faltaba la otra mitad: los pares que
  // tampoco eran un paso —6, 10, 14, 18, 20, 22, 26, 28, 30—, 792 en
  // total, que hacían que dos tarjetas de al lado respiraran distinto
  // sin que nadie lo hubiera decidido.
  //
  // La regla tiene DOS tramos a propósito. Hasta 32 un número es un PASO
  // de la escala y tiene que ser uno de los seis. Por encima ya no es un
  // paso: es una medida —el hueco de un avatar, el alto de una barra
  // pegada— y solo se le pide que siga en la retícula de 4.
  const ESCALA = new Set([1, 2, 4, 8, 12, 16, 24, 32])
  const fuera = []
  for (const hoja of HOJAS) {
    for (const m of sinComentarios(leer(hoja)).matchAll(/(?:padding|margin|gap)(?:-[a-z]+)?\s*:([^;{]+);/g)) {
      for (const p of m[1].matchAll(/(\d+)px/g)) {
        const n = Number(p[1])
        if (n <= 32 ? !ESCALA.has(n) : n % 4 !== 0) fuera.push(`${hoja}: ${n}px`)
      }
    }
  }
  check('todo espaciado es un paso de la escala (o, si es grande, múltiplo de 4)',
    fuera.length === 0, [...new Set(fuera)].slice(0, 8).join(', '))
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 5. Y nada se sale de la pantalla ──')
{
  // El espaciado subió en 792 sitios. Lo que se rompe con eso no es un
  // color: es una caja que ya iba justa y deja de caber. Pasó: en la
  // tarjeta del próximo torneo de la portada, el nombre se partió en dos
  // renglones dentro de una columna de 105 px.
  for (const ancho of [320, 1280]) {
    const page = await browser.newPage({ viewport: { width: ancho, height: 900 } })
    await page.addInitScript(() => {
      window.__FAKE_SESSION__ = 'user-1'
      window.__FAKE_TORNEOS__ = [{ id: 't1', slug: 'copa', name: 'Copa de Prueba', status: 'registration_open', admin_id: 'admin-1', max_players: 8, swiss_rounds: 3 }]
    })
    await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)
    const desborde = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    check(`[${ancho}px] la portada no se sale de ancho`, desborde <= 1, `${desborde}px de más`)
    await page.close()
  }
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 6. Una chapa de fondo sólido lleva blanco encima en los DOS temas ──')
{
  // El fallo, que llevaba ahí desde antes de esta tanda y no lo vio
  // nadie: la chapa de «EN JUEGO» es blanco sobre rojo, y un bloque
  // `:root[data-theme='dark'] .torneo-estado-jugando { color: … }`
  // —tres componentes de especificidad— le ganaba a
  // `.torneo-arte .torneo-estado-jugando { color: #fff }`, que solo
  // tiene dos. En oscuro la chapa salía AZUL sobre rojo: 2,2.
  //
  // Es la trampa de la 306 por otra cara: un bloque de tema no es solo
  // «el mismo color más claro», es una regla que compite, y el prefijo
  // del tema le regala especificidad.
  //
  // La forma: un fondo sólido de peligro lleva encima algo que se lee,
  // en los dos temas. Se mide, no se comprueba el hex.
  const lum = (c) => {
    const m = c.match(/[\d.]+/g)
    if (!m) return null
    const [r, g, b] = m.map(Number)
    const fn = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
    return 0.2126 * fn(r) + 0.7152 * fn(g) + 0.0722 * fn(b)
  }
  for (const tema of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width: 1000, height: 800 } })
    await page.addInitScript((t) => {
      localStorage.setItem('pokedoc-theme', t)
      window.__FAKE_SESSION__ = 'user-1'
      window.__FAKE_TORNEOS__ = [{ id: 't1', slug: 'copa', name: 'Copa en marcha', status: 'in_progress', admin_id: 'admin-1', max_players: 8, swiss_rounds: 3 }]
      window.__FAKE_INSCRIPCIONES__ = [{ id: 'i1', tournament_id: 't1', user_id: 'user-2', status: 'active' }]
    }, tema)
    await page.goto(`${BASE}/torneos`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2400)
    // Un torneo en juego no sale con el filtro de serie, que es
    // «Abiertas»: hay que pedirlo.
    const chip = page.locator('button', { hasText: 'En juego' }).first()
    if (await chip.count()) { await chip.click(); await page.waitForTimeout(700) }
    const chapa = await page.evaluate(() => {
      const n = document.querySelector('.torneo-estado-jugando')
      if (!n) return null
      const s = getComputedStyle(n)
      return { color: s.color, fondo: s.backgroundColor }
    })
    check(`[${tema}] la chapa de «en juego» está en la página`, chapa !== null)
    if (chapa) {
      const l1 = lum(chapa.color), l2 = lum(chapa.fondo)
      const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
      check(`  …y su texto se lee sobre el rojo`, ratio >= 4.5, `${ratio.toFixed(2)} — ${chapa.color} sobre ${chapa.fondo}`)
    }
    await page.close()
  }
}

await browser.close()
console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
