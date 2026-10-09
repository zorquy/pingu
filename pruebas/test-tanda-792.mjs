// Tanda 792 — NU3, lo que cuesta montarte un mazo del meta (lo que tienes,
// lo que falta y cuánto, con «Apuntar en La quiero»), y NU11, el glosario
// (/glosario y el subrayado de la primera vez en guías y foro).
import { readFileSync } from 'node:fs'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 240) : ''}`)
}
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const leer = (f) => readFileSync(`${RAIZ}/${f}`, 'utf8')

console.log('── 1. En el código ──')
check('/meta: cada lista lleva su coste', /data-coste/.test(leer('js/meta-mazo.js')) && /pintarCoste\(d\.querySelector\('\[data-coste\]'\), l\)/.test(leer('js/meta-mazo.js')))
check('guías y foro subrayan con el glosario', /subrayarGlosario/.test(leer('js/guia.js')) && /subrayarGlosario/.test(leer('js/tema.js')))
check('el glosario trae su hoja al entrar', /hojaInyectada\('css\/glosario\.css'\)/.test(leer('js/glosario.js')))
check('el constructor también lo calcula, sin volver a resolver (797)', /costeDeResueltas\(lista\(\)\.map/.test(leer('js/constructor.js')) && /id="cmCosteBoton"/.test(leer('constructor.html')))
check('/aprender enlaza al glosario', /href="\/glosario"/.test(leer('aprender.html')))

const b = await chromium.launch()
const p = await b.newPage()
await p.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' })
console.log('── 2. Lo que cuesta (puro) ──')
{
  const r = await p.evaluate(async () => {
    const { resumenDeCoste } = await import('/js/coste-mazo.js')
    const pide = new Map([
      ['dreepy', { n: 4, nombre: 'Dreepy', carta: { id: 'twm-128' } }],
      ['ultra ball', { n: 4, nombre: 'Ultra Ball', carta: { id: 'svi-196' } }],
      ['rara', { n: 2, nombre: 'Rara', carta: { id: 'x-1' } }],
    ])
    const tengo = new Map([['dreepy', 6], ['ultra ball', 1]])
    const barata = new Map([['ultra ball', { id: 'pal-186', precio: 0.5 }]])
    return resumenDeCoste(pide, tengo, barata)
  })
  check('lo que tienes no pasa de lo que pide la lista', r.total === 10 && r.tienes === 5 && r.faltan === 5, JSON.stringify(r))
  check('los euros, con la impresión más barata; lo que no tiene precio va aparte', r.euros === 1.5 && r.sinPrecio === 2, JSON.stringify(r))
  check('lo que más falta, primero', r.filas[0].falta >= r.filas[1].falta && r.filas.at(-1).clave === 'dreepy', JSON.stringify(r.filas.map((f) => f.clave)))
}

console.log('── 3. El glosario ──')
{
  const r = await p.evaluate(async () => {
    const { primerasApariciones, formasDelGlosario, GLOSARIO } = await import('/js/glosario-datos.js')
    const formas = formasDelGlosario()
    const t = 'Saca el reverse holo y mira la Banca. En la banca hay dos; un holo y otro reverse.'
    const a = primerasApariciones(t, formas)
    const ids = new Set(GLOSARIO.map((g) => g.id))
    return { n: GLOSARIO.length, unicos: ids.size === GLOSARIO.length, trozos: a.map((x) => [x.id, t.slice(x.inicio, x.fin)]), dentro: primerasApariciones('Superbancario', formas).length }
  })
  check('treinta términos o más, cada uno con su id', r.n >= 30 && r.unicos, JSON.stringify(r))
  check('la forma larga gana (y «holo» suelto es OTRO término) y cada uno sale UNA vez', JSON.stringify(r.trozos) === JSON.stringify([['reverse', 'reverse holo'], ['banca', 'Banca'], ['holo', 'holo']]), JSON.stringify(r.trozos))
  check('no subraya dentro de otra palabra', r.dentro === 0)
  const dom = await p.evaluate(async () => {
    const { subrayarGlosario } = await import('/js/glosario.js')
    const div = document.createElement('div')
    div.innerHTML = '<p>Si haces un mulligan, <a href="/x">mulligan</a> no cuenta. Otro mulligan.</p><code>mulligan</code>'
    document.body.append(div)
    const n = subrayarGlosario(div)
    div.querySelector('.glosa').click()
    const pop = document.querySelector('.glosa-pop')
    return { n, glosas: div.querySelectorAll('.glosa').length, enEnlace: div.querySelector('a .glosa') !== null, pop: pop?.textContent || '', expandida: div.querySelector('.glosa').getAttribute('aria-expanded'), texto: div.textContent }
  })
  check('subraya la primera, fuera de enlaces y código', dom.n === 1 && dom.glosas === 1 && !dom.enEnlace, JSON.stringify(dom))
  check('  …sin cambiar el texto', dom.texto === 'Si haces un mulligan, mulligan no cuenta. Otro mulligan.mulligan', dom.texto)
  check('al tocarla sale su definición', /Mulligan/.test(dom.pop) && /Básico/.test(dom.pop) && dom.expandida === 'true', dom.pop)
}
await p.goto(`${BASE}/glosario`, { waitUntil: 'domcontentloaded' })
await p.waitForSelector('.glosario-termino', { timeout: 6000 }).catch(() => {})
const g = await p.evaluate(() => ({ n: document.querySelectorAll('.glosario-termino').length, sir: Boolean(document.getElementById('sir')), h1: document.querySelector('h1')?.textContent }))
check('/glosario los pinta todos, con su ancla', g.n >= 30 && g.sir && g.h1 === 'Glosario', JSON.stringify(g))
await b.close()

console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
