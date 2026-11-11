// Tanda 1284 — las noticias no cuentan como guías en el perfil (PINGU: «pone
// que he escrito 53 guías… y hay algunas noticias que las coge como guías»).
//
// En `guides` viven las dos cosas (kind 'guide' y 'news'), y la losa «Guías»,
// el rango de colaborador, «le han servido a N», la pestaña Guías de los dos
// perfiles, la chapa de las firmas, Gente y los logros contaban todo lo
// aprobado. Aquí: una persona con DOS guías y DOS noticias aprobadas tiene que
// decir 2 y enseñar 2, en su perfil y en el de fuera.
import { chromium, contexto, BASE } from './fixtures-app.mjs'
import { readFileSync } from 'node:fs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

console.log('── 1. Cada consulta que cuenta o lista guías de alguien pide kind = guide ──')
{
  const leer = (f) => readFileSync(`${RAIZ}/${f}`, 'utf8')
  // Cada `from('guides')` con review_status approved y por autor tiene que
  // llevar su `kind` en la misma cadena (hasta el siguiente `)` de cierre de
  // la sentencia, que aquí es la coma o el fin de línea del Promise.all).
  const SITIOS = ['js/perfil.js', 'js/usuario.js', 'js/contributor-badge.js', 'js/usuarios.js', 'js/guias-servido.js', 'js/gamification.js', 'js/perfil-resumen.js']
  for (const f of SITIOS) {
    const src = leer(f)
    const cadenas = [...src.matchAll(/from\('guides'\)[\s\S]*?(?=\n\s*(?:supabase|\]\)|const |let |return |if |\}\)|$))/g)].map((m) => m[0])
      .filter((c) => /author_id/.test(c) && /approved/.test(c))
    check(`${f}: ${cadenas.length} consulta(s) de guías aprobadas por autor, todas con kind = guide`, cadenas.length > 0 && cadenas.every((c) => /\.eq\('kind', 'guide'\)/.test(c)), cadenas.filter((c) => !/kind/.test(c)).map((c) => c.slice(0, 120)).join(' || '))
  }
  // Y la pestaña Guías propia (que lista también pendientes y rechazadas).
  const mias = (leer('js/perfil.js').match(/async function loadMyGuides[\s\S]*?\]\)/) || [''])[0]
  check('js/perfil.js: «Mis guías» lista solo guías', /\.eq\('kind', 'guide'\)/.test(mias))
}

const b = await chromium.launch()
// Dos guías y dos noticias aprobadas de user-1 (tú) y lo mismo de Misty (user-2).
const extra = () => {
  const fila = (id, autor, kind, title) => ({ id, slug: id, title, kind, author_id: autor, review_status: 'approved', published_at: '2026-11-01T10:00:00Z', submitted_at: '2026-11-01T10:00:00Z', category_id: null, blocks: [] })
  window.__FAKE_GUIAS__ = [
    fila('g-mia-1', 'user-1', 'guide', 'GUIA mía uno'), fila('g-mia-2', 'user-1', 'guide', 'GUIA mía dos'),
    fila('n-mia-1', 'user-1', 'news', 'NOTICIA mía uno'), fila('n-mia-2', 'user-1', 'news', 'NOTICIA mía dos'),
    fila('g-misty-1', 'user-2', 'guide', 'GUIA de Misty uno'), fila('g-misty-2', 'user-2', 'guide', 'GUIA de Misty dos'),
    fila('n-misty-1', 'user-2', 'news', 'NOTICIA de Misty uno'), fila('n-misty-2', 'user-2', 'news', 'NOTICIA de Misty dos'),
  ]
}
const abrir = async (ruta) => {
  const ctx = await contexto(b, false, 'user-1', extra)
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3200)
  return { ctx, page, errores }
}
const valorGuias = (page) => page.locator('#profileStats [data-losa="aprender"] .valor').first().innerText().catch(() => '')

console.log('── 2. Tu perfil ──')
{
  const { ctx, page, errores } = await abrir('/perfil.html')
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('la losa dice 2 guías, no 4', (await valorGuias(page)).trim() === '2', await valorGuias(page))
  await page.locator('[data-tab="guides"], [data-ptab="guides"], button:has-text("Guías")').first().click().catch(() => {})
  await page.waitForTimeout(800)
  const lista = (await page.locator('#myGuidesList').innerText().catch(() => '')).replace(/\s+/g, ' ')
  check('la pestaña Guías lista tus dos guías y ninguna noticia', /GUIA mía uno/.test(lista) && /GUIA mía dos/.test(lista) && !/NOTICIA/.test(lista), lista.slice(0, 200))
  await ctx.close()
}

// En producción es /usuario/Misty; el servidor local no tiene esa reescritura.
console.log('── 3. El perfil de otra persona ──')
{
  const { ctx, page, errores } = await abrir('/usuario?id=user-2')
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('la losa dice 2 guías, no 4', (await valorGuias(page)).trim() === '2', await valorGuias(page))
  const lista = (await page.locator('#publishedGuides').innerText().catch(() => '')).replace(/\s+/g, ' ')
  check('su pestaña Guías: sus dos guías y ninguna noticia', /GUIA de Misty uno/.test(lista) && /GUIA de Misty dos/.test(lista) && !/NOTICIA/.test(lista), lista.slice(0, 200))
  await ctx.close()
}

await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
