// Tanda 626 — las energías, con su símbolo.
//
// PINGU: «a partir de ahora estaría bien que las energías tengan iconos;
// he añadido una carpeta con los iconos de los distintos tipos». Son ocho
// (Planta, Fuego, Agua, Rayo, Psíquico, Lucha, Oscuridad y Metal): los
// tres que faltan (Incolora, Hada, Dragón) siguen con su punto de color.
//
// Se pintan en los dos sitios donde sale una energía: el laboratorio y
// las repeticiones (`.lab-energia`, con la letra del tipo) y la ficha de
// una carta (`.carta-energia`, con el nombre inglés). Lo que se comprueba
// es el DIBUJO (lo que calcula el navegador), no que la regla esté
// escrita: una regla con la fuerza de otra que viene detrás no pinta nada.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync, existsSync } from 'node:fs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 220) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const RAIZ = '/home/user/pingu'
const LETRAS = ['G', 'R', 'W', 'L', 'P', 'F', 'D', 'M']
const TIPO_DE_LETRA = { G: 'Grass', R: 'Fire', W: 'Water', L: 'Lightning', P: 'Psychic', F: 'Fighting', D: 'Darkness', M: 'Metal' }

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. Los ocho ficheros ──')
for (const l of LETRAS) {
  const f = `${RAIZ}/assets/iconos-energia/${l}.png`
  const ok = existsSync(f)
  const b = ok ? readFileSync(f) : Buffer.alloc(0)
  // Cabecera PNG y el tamaño del IHDR: 30 × 30.
  const png = b.slice(1, 4).toString() === 'PNG'
  const ancho = png ? b.readUInt32BE(16) : 0
  const alto = png ? b.readUInt32BE(20) : 0
  check(`${l}.png existe, es PNG y mide 30 × 30`, ok && png && ancho === 30 && alto === 30, `${ok} ${png} ${ancho}×${alto}`)
}

const browser = await chromium.launch()

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. En el laboratorio (y las repeticiones, que usan la misma hoja) ──')
{
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } })
  await page.goto(`${BASE}/laboratorio`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(800)
  const dibujos = await page.evaluate((letras) => {
    const caja = document.createElement('div')
    caja.id = 'prueba626'
    document.body.appendChild(caja)
    const todas = [...letras, 'C', 'Y', 'N', '*']
    caja.innerHTML =
      todas.map((l) => `<span class="lab-energia" data-tipo="${l}" title="${l}">${l}</span>`).join('') +
      '<span class="lab-energia" data-tipo="P" id="conSub">P<sub>2</sub></span>' +
      '<span class="lab-energia" data-tipo="L" id="conSubClaro">L<sub>2</sub></span>' +
      '<div class="lab-texto-bloque"><p>Une <span class="lab-energia" data-tipo="G" id="enTexto">G</span></p></div>'
    const de = (n) => {
      const s = getComputedStyle(n)
      return { imagen: s.backgroundImage, color: s.color, fondo: s.backgroundColor, ancho: n.getBoundingClientRect().width, alto: n.getBoundingClientRect().height, pad: s.paddingLeft }
    }
    const out = {}
    for (const n of caja.querySelectorAll('[data-tipo]')) out[n.id || n.dataset.tipo] = de(n)
    out.sub = getComputedStyle(caja.querySelector('#conSub sub')).color
    out.subClaro = getComputedStyle(caja.querySelector('#conSubClaro sub')).color
    return out
  }, LETRAS)

  for (const l of LETRAS) {
    const d = dibujos[l]
    check(`«${l}»: lleva su símbolo`, d.imagen.includes(`/assets/iconos-energia/${l}.png`), d.imagen)
    check(`  …y la letra no se pinta encima`, d.color === 'rgba(0, 0, 0, 0)', d.color)
  }
  // El color del tipo sigue debajo (la prueba 384 compara las paletas, y
  // si el símbolo no llegara se vería el punto de siempre).
  check('debajo sigue el color del tipo (Psíquico)', dibujos.P.fondo === 'rgb(160, 107, 196)', dibujos.P.fondo)
  for (const l of ['C', 'Y', 'N', '*']) {
    const d = dibujos[l]
    check(`«${l}» (sin símbolo) se queda con su punto y su letra`, !d.imagen.includes('iconos-energia') && d.color !== 'rgba(0, 0, 0, 0)', `${d.imagen} ${d.color}`)
  }
  check('el número de una energía que da dos se sigue leyendo', dibujos.sub !== 'rgba(0, 0, 0, 0)' && dibujos.subClaro !== 'rgba(0, 0, 0, 0)', `${dibujos.sub} / ${dibujos.subClaro}`)
  check('  …y no va encima del símbolo', dibujos.conSub.pad === '24px', dibujos.conSub.pad)
  check('en el texto de una carta, el símbolo es redondo (16 × 16)', Math.round(dibujos.enTexto.ancho) === 16 && Math.round(dibujos.enTexto.alto) === 16, `${dibujos.enTexto.ancho}×${dibujos.enTexto.alto}`)

  // Y el fichero LLEGA: un símbolo que no carga deja el punto de color, que
  // se ve bien y no avisa de nada.
  const cargan = await page.evaluate(async (letras) => {
    const r = {}
    for (const l of letras) {
      r[l] = await new Promise((ok) => {
        const im = new Image()
        im.onload = () => ok(im.naturalWidth)
        im.onerror = () => ok(0)
        im.src = `/assets/iconos-energia/${l}.png`
      })
    }
    return r
  }, LETRAS)
  check('los ocho se sirven y se pueden dibujar', LETRAS.every((l) => cargan[l] === 30), JSON.stringify(cargan))
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. En la ficha de una carta ──')
{
  const MEW = {
    id: '30th-066', set_id: '30th', market: 'WEST', local_id: '066',
    name: 'Mew ex', name_es: 'Mew ex', image_path: 'sv/30th/66',
    category: 'Pokémon', hp: 160, types: ['Psíquico'], stage: 'Básico', retreat: 1,
    regulation_mark: 'J', detalle_at: 'x', detalle_lang: 'es',
    weaknesses: [{ type: 'Siniestro', value: '×2' }],
    attacks: [{ name: 'Explosión Teleportadora', cost: ['Psíquico', 'Incoloro'], damage: '30' }],
  }
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } })
  await page.addInitScript((c) => {
    window.__FAKE_SETS__ = [{ id: '30th', name: '30th Celebration', market: 'WEST', card_count_official: 128 }]
    window.__FAKE_CARTAS__ = [c]
  }, MEW)
  await page.goto(`${BASE}/carta/mew-ex-30th-066`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2400)
  const puntos = await page.evaluate(() =>
    [...document.querySelectorAll('#cartaNucleo .carta-energia')].map((n) => {
      const s = getComputedStyle(n)
      return { tipo: n.dataset.tipo, imagen: s.backgroundImage, fondo: s.backgroundColor, etiqueta: n.getAttribute('aria-label') }
    })
  )
  const de = (t) => puntos.filter((p) => p.tipo === t)
  check('el coste Psíquico lleva su símbolo', de('Psychic').length && de('Psychic').every((p) => p.imagen.includes('/assets/iconos-energia/P.png')), JSON.stringify(de('Psychic')))
  check('la debilidad Oscuridad, el suyo', de('Darkness').length && de('Darkness').every((p) => p.imagen.includes('/assets/iconos-energia/D.png')), JSON.stringify(de('Darkness')))
  check('  …con su color debajo, como antes', de('Darkness').every((p) => p.fondo === 'rgb(61, 74, 87)'), JSON.stringify(de('Darkness')))
  check('Incolora (coste y retirada) se queda con el punto', de('Colorless').length >= 2 && de('Colorless').every((p) => p.imagen === 'none'), JSON.stringify(de('Colorless')))
  check('y quien no ve el dibujo sigue oyendo el nombre', de('Psychic')[0]?.etiqueta === 'Psíquico', de('Psychic')[0]?.etiqueta)
  await page.screenshot({ path: '/tmp/t626-carta.png', clip: { x: 0, y: 0, width: 1200, height: 900 } })
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 4. Los tipos de las dos hojas son los mismos ocho ──')
{
  const tipos = (css, re) => [...css.matchAll(re)].map((m) => m[1])
  const lab = tipos(readFileSync(`${RAIZ}/css/laboratorio.css`, 'utf8'), /\.lab-energia\[data-tipo='(\w)'\] \{ --icono-energia: url\('\/assets\/iconos-energia\/\1\.png'\); \}/g)
  const ficha = tipos(readFileSync(`${RAIZ}/css/carta.css`, 'utf8'), /\.carta-energia\[data-tipo='(\w+)'\] \{ --icono-energia: url\('\/assets\/iconos-energia\/(\w)\.png'\); \}/g)
  check('el laboratorio declara los ocho, cada uno con SU fichero', JSON.stringify([...lab].sort()) === JSON.stringify([...LETRAS].sort()), lab.join(','))
  const css = readFileSync(`${RAIZ}/css/carta.css`, 'utf8')
  const mal = LETRAS.filter((l) => !css.includes(`.carta-energia[data-tipo='${TIPO_DE_LETRA[l]}'] { --icono-energia: url('/assets/iconos-energia/${l}.png'); }`))
  check('la ficha declara los ocho, cada uno con SU fichero', ficha.length === 8 && !mal.length, mal.join(','))
}

await browser.close()
console.log(fails ? `\n${fails} FALLAS` : '\nTodo en verde.')
process.exit(fails ? 1 : 0)
