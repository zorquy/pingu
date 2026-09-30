// Tanda 386 — el color de un nombre según su rango.
//
// PINGU: «que los nicks en las estadísticas del foro, y en todos los
// sitios donde ponga un nombre con enlace al perfil, tengan el color que
// tienen que tener. Un usuario normal azul, y los admins y los
// moderadores de otros colores».
//
// Lo que esta prueba mira y no supone:
//   · Que el color LLEGA. La primera versión ponía la regla en
//     `components.css` y los nombres del foro salían azules: `.foro-gente
//     a` empata en especificidad y `foro.css` carga después. Un nombre en
//     azul entre nombres en azul NO CANTA, así que se mide el color
//     computado contra el token, no la presencia de la clase.
//   · Que se LEE: los cuatro colores (dos rangos × dos temas) por encima
//     del 4,5 de la WCAG.
//   · Que el color no es lo único que lo dice: negrita y `title`.
//   · Que ninguna consulta se olvida de traerse las columnas del rango.
//     Sin ellas todo el mundo sale en azul y parece que no hay ni un
//     admin conectado — sin dar ningún error.
//   · Que nadie pone DOS atributos `style` en la misma etiqueta: no se
//     suman, gana el primero, y el rango se perdería en silencio.
//   · Y que el CSS que salió de components.css para hacer sitio sigue
//     pintando donde tiene que pintar.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 220) : ''}`)
}
const BASE = 'http://localhost:8892'
const RAIZ = '/home/user/pingu'

console.log('\n── 1. El rango, sin navegador ──')
const R = await import(`${RAIZ}/js/rangos.js`)
{
  const admin = { is_admin: true, is_moderator: false }
  const mod = { is_admin: false, is_moderator: true }
  const normal = { is_admin: false, is_moderator: false }

  check('un admin es admin', R.rangoDe(admin) === 'admin')
  check('un moderador es moderador', R.rangoDe(mod) === 'moderador')
  check('una persona normal no tiene rango', R.rangoDe(normal) === null)
  // El orden de la escala ES la regla: quien manda gana.
  check('admin Y moderador sale como admin',
    R.rangoDe({ is_admin: true, is_moderator: true }) === 'admin')
  // Un perfil que no llegó no es una persona normal, pero se pinta
  // igual: no hay nada que decir de él.
  check('sin perfil, sin rango', R.rangoDe(null) === null && R.rangoDe(undefined) === null)
  // La columna a false y la columna AUSENTE son lo mismo aquí, pero una
  // consulta que no la pide deja el campo undefined: === true lo cubre.
  check('una columna que no vino no asciende a nadie',
    R.rangoDe({ username: 'Ash' }) === null)

  check('el nombre del rango está', R.nombreDeRango(admin) === 'Administrador' &&
    R.nombreDeRango(mod) === 'Moderador' && R.nombreDeRango(normal) === null)

  check('las columnas se exportan', R.COLUMNAS_RANGO.includes('is_admin') &&
    R.COLUMNAS_RANGO.includes('is_moderator'), R.COLUMNAS_RANGO)

  // El color sale del id, así que un rango nuevo no necesita un mapa
  // aparte que se quede viejo.
  check('el estilo pide el token de SU rango',
    R.estiloDeRango(admin) === 'color: var(--rango-admin); font-weight: 700', R.estiloDeRango(admin))
  check('  …y el normal no pide nada', R.estiloDeRango(normal) === '')

  const at = R.atributosDeRango(admin)
  check('los atributos traen clase, color y title',
    at.includes('class="rango-admin"') && at.includes('var(--rango-admin)') &&
    at.includes('title="Administrador"'), at)
  check('el normal no ensucia cada línea con una clase vacía',
    R.atributosDeRango(normal) === '')

  // La trampa: dos atributos `style` en la misma etiqueta NO se suman.
  const conBase = R.atributosDeRango(admin, 'font-weight:700; color:var(--navy)')
  check('un estilo propio se MEZCLA, no se añade un style aparte',
    (conBase.match(/style=/g) || []).length === 1, conBase)
  check('  …y el del rango va detrás, que es quien gana',
    conBase.indexOf('var(--navy)') < conBase.indexOf('var(--rango-admin)'))
  check('  …y sin rango se queda el estilo propio tal cual',
    R.atributosDeRango(normal, 'font-weight:700') === ' style="font-weight:700"',
    R.atributosDeRango(normal, 'font-weight:700'))
}

console.log('\n── 2. Quién se olvida de traerse el rango ──')
{
  // La FORMA del fallo, no el caso: si un fichero pinta rangos, toda
  // consulta suya que se traiga un NOMBRE para enseñarlo tiene que
  // traerse también el rango. Se pide el nombre porque se va a pintar, y
  // se pinta con su color.
  const js = []
  const barrer = (d) => {
    for (const e of readdirSync(d)) {
      const p = join(d, e)
      if (statSync(p).isDirectory()) { if (e !== 'vendor') barrer(p) }
      else if (e.endsWith('.js')) js.push(p)
    }
  }
  barrer(join(RAIZ, 'js'))

  // El barrido va por TODO js/, no solo por los ficheros que pintan. La
  // cabecera de una conversación enseña un nombre con enlace al perfil,
  // pero la consulta vive en `js/messages.js` y el enlace en
  // `js/mensajes.js`: mirar solo donde se pinta dejaba ese hueco fuera.
  const pintan = js.filter((p) => !p.endsWith('/rangos.js') &&
    readFileSync(p, 'utf8').includes('atributosDeRango('))
  check('hay ficheros que pintan rangos', pintan.length >= 15, `${pintan.length}`)
  for (const p of pintan) {
    check(`  ${p.slice(RAIZ.length + 1)} importa de rangos.js`,
      /from '\.{1,2}\/rangos\.js'/.test(readFileSync(p, 'utf8')))
  }

  const huerfanas = []
  const dosEstilos = []
  for (const p of js) {
    if (p.endsWith('/rangos.js')) continue
    const s = readFileSync(p, 'utf8')

    // Toda consulta que pida un NOMBRE para enseñarlo tiene que traerse
    // también el rango. La excepción NO es una lista aquí dentro —una
    // lista curada se queda vieja y el fichero que cambió no se entera,
    // que es la lección de las tandas 323 y 380— sino un comentario
    // `// sin rango:` pegado a la consulta, que viaja con ella y dice por
    // qué ese nombre no es un enlace a un perfil.
    for (const m of s.matchAll(/\.select\(\s*([`'"])([^`'"]*?)\1/g)) {
      const cols = m[2]
      if (!/\b(username|display_name)\b/.test(cols)) continue
      if (/count|exact/.test(cols)) continue
      if (cols.includes('COLUMNAS_RANGO')) continue
      const antes = s.slice(0, m.index).split('\n').slice(-7).join('\n')
      if (/\/\/ sin rango:/.test(antes)) continue
      huerfanas.push(`${p.slice(RAIZ.length + 1)}: select(${cols.slice(0, 70)})`)
    }

    // Una etiqueta con atributosDeRango no puede llevar además su
    // propio style=: el navegador tira el segundo sin decir nada.
    for (const m of s.matchAll(/<a\b[^>]*atributosDeRango\([^>]*>/g)) {
      const tag = m[0]
      const sueltos = (tag.match(/\sstyle="/g) || []).length
      if (sueltos > 0 && !/atributosDeRango\([^)]*,/.test(tag)) {
        dosEstilos.push(`${p.slice(RAIZ.length + 1)}: ${tag.slice(0, 90)}`)
      }
    }
  }
  check('ninguna consulta pide un nombre sin su rango', huerfanas.length === 0, huerfanas.join(' | '))
  check('ninguna etiqueta lleva dos atributos style', dosEstilos.length === 0, dosEstilos.join(' | '))

  // Y al revés, que es lo que de verdad contestó PINGU: que no quede
  // NI UN enlace a un perfil sin su color. Se barren los enlaces, no
  // las consultas — una consulta bien y un enlace olvidado se ven
  // igual de azules.
  //
  // Se libran los que no llevan NOMBRE, que son dos formas y no una
  // lista de sitios: un avatar (una foto o una inicial, no hay texto
  // que colorear) y el podio, cuyos tres puestos van ya tintados de
  // oro, plata y bronce — meterles encima el rango sería decir dos
  // cosas con el mismo sitio. El NOMBRE de esas mismas filas sí lo
  // lleva.
  const sinColor = []
  for (const p of js) {
    if (p.endsWith('/rangos.js')) continue
    const s = readFileSync(p, 'utf8')
    for (const m of s.matchAll(/<a\b[^>]*?(?:profileUrl\(|\/usuario\/\$\{)[^>]*?>/g)) {
      const tag = m[0]
      if (tag.includes('atributosDeRango')) continue
      if (/class="[^"]*(avatar|-cara|com-puesto)/.test(tag)) continue
      sinColor.push(`${p.slice(RAIZ.length + 1)}: ${tag.slice(0, 100)}`)
    }
  }
  check('ningún enlace a un perfil con nombre se queda sin color',
    sinColor.length === 0, sinColor.join(' | '))
}

console.log('\n── 2b. Los nombres que NO salen de un select ──')
{
  // El tablón de intercambios y el «quién da esta carta» de la ficha
  // enseñan nombres con enlace al perfil, pero no vienen de un
  // `.select(`: vienen de una función de la base, y una función solo
  // devuelve las columnas que DECLARA. El barrido de arriba no las ve.
  //
  // Escrito contra la FORMA: toda función de una migración que devuelva
  // un `username` tiene que devolver también el rango. Así lo cazaría
  // una función nueva, no solo estas tres.
  const sql = readdirSync(RAIZ).filter((f) => /^supabase-migration-.*\.sql$/.test(f))
  check('hay migraciones que mirar', sql.length > 10, `${sql.length}`)
  // Las migraciones son un LIBRO DE CUENTAS: el fichero viejo se queda
  // como está y el nuevo manda. Así que una función está bien si
  // CUALQUIER migración la declara con el rango — mirar fichero por
  // fichero daría por mala la definición original, que es correcta.
  const conRango = new Set()
  const candidatas = []
  for (const f of sql) {
    const t = readFileSync(join(RAIZ, f), 'utf8')
    for (const m of t.matchAll(/create (?:or replace )?function\s+([\w.]+)\s*\([^)]*\)\s*returns table \(([^)]*)\)/gi)) {
      const [, nombre, cols] = m
      if (!/\busername\s+text\b/.test(cols)) continue
      if (/\bis_admin\b/.test(cols)) { conRango.add(nombre); continue }
      // Y aquí también la excepción viaja con el código, no en una lista
      // de esta prueba: un `-- sin rango:` pegado a la función.
      const antes = t.slice(0, m.index).split('\n').slice(-6).join('\n')
      if (/-- sin rango:/.test(antes)) { conRango.add(nombre); continue }
      candidatas.push([f, nombre])
    }
  }
  const mudas = candidatas.filter(([, n]) => !conRango.has(n)).map(([f, n]) => `${f}: ${n}`)
  check('ninguna función devuelve un nombre sin su rango', mudas.length === 0, mudas.join(' | '))

  // Y la migración que las amplía tiene que TIRAR las tres antes: un
  // `create or replace` no puede cambiar las columnas de salida de una
  // función que ya existe, y el SQL Editor devolvería un error a la
  // cara de quien lo pegue.
  const mig = readFileSync(join(RAIZ, 'supabase-migration-rangos-intercambios.sql'), 'utf8')
  for (const fn of ['intercambios_quien_tiene', 'intercambios_quien_busca', 'intercambios_de_carta']) {
    check(`  ${fn} se tira antes de recrearse`,
      new RegExp(`drop function if exists public\\.${fn}\\(`).test(mig))
    check(`  …y se le devuelve el permiso`,
      new RegExp(`grant execute on function public\\.${fn}\\(`).test(mig))
  }
}

console.log('\n── 3. El color LLEGA a la pantalla ──')
const hoy = new Date().toISOString().slice(0, 10)
const browser = await chromium.launch()

const luminancia = (rgb) => {
  const [r, g, b] = rgb.match(/\d+/g).slice(0, 3).map((n) => {
    const c = Number(n) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contraste = (a, b) => {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

async function abrir(tema) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1100 } })
  await page.addInitScript((d) => {
    window.__FAKE_PERFILES__ = [
      { id: 'admin-1', username: 'Oak', display_name: 'Oak', is_admin: true, last_active_date: d },
      { id: 'mod-1', username: 'Brock', display_name: 'Brock', is_moderator: true, last_active_date: d },
      { id: 'user-1', username: 'Ash', display_name: 'Ash', last_active_date: d },
    ]
  }, hoy)
  await page.addInitScript((t) => {
    try { localStorage.setItem('theme', t) } catch {}
    addEventListener('DOMContentLoaded', () => document.documentElement.setAttribute('data-theme', t))
  }, tema)
  return page
}

for (const tema of ['light', 'dark']) {
  console.log(`  · tema ${tema}`)
  const page = await abrir(tema)
  await page.goto(`${BASE}/foro.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)

  const nombres = await page.$$eval('.foro-gente a, .foro-numero a', (as) =>
    as.map((a) => {
      const e = getComputedStyle(a)
      const caja = getComputedStyle(a.closest('.foro-panel') || document.body)
      return { texto: a.textContent.trim(), clase: a.className, title: a.title,
        color: e.color, peso: e.fontWeight, fondo: caja.backgroundColor }
    }))
  check('los paneles del foro traen nombres', nombres.length >= 3, `${nombres.length}`)

  const tokens = await page.evaluate(() => {
    const r = getComputedStyle(document.documentElement)
    const pinta = (v) => { const d = document.createElement('i'); d.style.color = v; document.body.append(d)
      const c = getComputedStyle(d).color; d.remove(); return c }
    return { admin: pinta(r.getPropertyValue('--rango-admin')), mod: pinta(r.getPropertyValue('--rango-moderador')) }
  })

  for (const [quien, esperado, rango] of [['Oak', tokens.admin, 'admin'], ['Brock', tokens.mod, 'moderador']]) {
    const n = nombres.filter((x) => x.texto === quien)
    check(`    ${quien} sale en todos sus sitios`, n.length >= 1, `${n.length}`)
    check(`    ${quien} lleva el color de su rango`, n.length > 0 && n.every((x) => x.color === esperado),
      n.map((x) => x.color).join(','))
    check(`    ${quien} no lo dice solo con el color`,
      n.length > 0 && n.every((x) => Number(x.peso) >= 700 && x.title))
    check(`    ${quien} lleva la clase rango-${rango}`,
      n.length > 0 && n.every((x) => x.className !== '' || x.clase.includes(`rango-${rango}`)))
    const c = n.length ? contraste(n[0].color, n[0].fondo) : 0
    check(`    ${quien} se lee (≥4,5)`, c >= 4.5, c.toFixed(2))
  }

  const ash = nombres.filter((x) => x.texto === 'Ash')
  check('    una persona normal no lleva clase de rango',
    ash.length > 0 && ash.every((x) => !x.clase.includes('rango-')), ash.map((x) => x.clase).join(','))
  check('    …y su nombre sigue siendo azul de enlace',
    ash.length > 0 && ash.every((x) => x.color !== tokens.admin && x.color !== tokens.mod))

  await page.close()
}

console.log('\n── 3b. Una @mención también lleva su color ──')
{
  // Una mención se monta con createElement, no con una plantilla: es el
  // único sitio donde el rango se pone a mano, así que es el único que
  // puede quedarse atrás sin que se note.
  const page = await abrir('light')
  await page.goto(`${BASE}/foro.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  const r = await page.evaluate(async () => {
    const m = await import('/js/menciones.js')
    const perfiles = m.porNombre([
      { id: 'a', username: 'oak', display_name: 'Oak', is_admin: true },
      { id: 'b', username: 'brock', display_name: 'Brock', is_moderator: true },
      { id: 'c', username: 'ash', display_name: 'Ash' },
    ])
    return m.enlazarMenciones('<p>@oak @brock @ash</p>', perfiles)
  })
  check('la mención de un admin lleva su clase y su color',
    /class="mencion rango-admin"/.test(r) && /var\(--rango-admin\)/.test(r), r)
  check('  …y la de un moderador la suya',
    /class="mencion rango-moderador"/.test(r) && /var\(--rango-moderador\)/.test(r), r)
  // Y la de una persona normal se queda EXACTAMENTE como estaba: es lo
  // que mira test-tanda-314, y romperlo habría sido gratis.
  check('  …y la de alguien normal sigue siendo class="mencion" a secas',
    /<a class="mencion"[^>]*>@ash<\/a>/.test(r) && !/@ash<\/a>[^]*rango-/.test(r), r)
  check('  …y las tres llevan su title menos la normal',
    (r.match(/title="/g) || []).length === 2, r)
  await page.close()
}

console.log('\n── 4. El CSS que salió de components.css sigue pintando ──')
{
  // Se hizo sitio en la portada moviendo tres bloques (la 404, las
  // páginas legales y las encuestas y la cabecera de tema). La trampa de
  // la tanda 299: que una pantalla use la clase sin cargar la hoja.
  const page = await abrir('light')
  const casos = [
    ['/404.html', '.pagina-404', 'display', 'flex'],
    ['/torneo.html?id=x', '.pagina-404', 'display', 'flex'],
    ['/terminos.html', '.legal-page li', 'paddingLeft', '16px'],
    ['/privacidad.html', '.legal-page li', 'paddingLeft', '16px'],
    ['/sobre.html', '.legal-page li', 'paddingLeft', '16px'],
  ]
  for (const [url, sel, prop, valor] of casos) {
    await page.goto(BASE + url, { waitUntil: 'domcontentloaded' }).catch(() => {})
    await page.waitForTimeout(1200)
    const v = await page.evaluate(([s, p]) => {
      const e = document.querySelector(s)
      return e ? getComputedStyle(e)[p] : 'NO ESTÁ'
    }, [sel, prop])
    check(`${url} pinta ${sel}`, v === valor, v)
  }
  await page.close()
}
{
  const page = await abrir('light')
  await page.goto(`${BASE}/foro.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  // La hoja tiene que ESTAR cargada aunque en esta pasada no haya
  // encuesta ninguna que pintar: de una clase que no sale no se puede
  // decir que esté bien.
  const reglas = await page.evaluate(() => {
    let e = 0, t = 0
    for (const h of document.styleSheets) {
      let rs; try { rs = h.cssRules } catch { continue }
      for (const r of rs) {
        const s = r.selectorText || ''
        if (s.includes('.encuesta')) e++
        if (s.includes('.tema-cabecera')) t++
      }
    }
    return { e, t }
  })
  check('foro.html carga las reglas de encuesta', reglas.e > 0, `${reglas.e}`)
  await page.goto(`${BASE}/tema.html?t=tema-1`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  const r2 = await page.evaluate(() => {
    let e = 0, t = 0
    for (const h of document.styleSheets) {
      let rs; try { rs = h.cssRules } catch { continue }
      for (const r of rs) {
        const s = r.selectorText || ''
        if (s.includes('.encuesta')) e++
        if (s.includes('.tema-cabecera')) t++
      }
    }
    return { e, t }
  })
  check('tema.html carga las reglas de encuesta y de cabecera', r2.e > 0 && r2.t > 0, JSON.stringify(r2))
  // Y mudar es MUDAR, no copiar: si la regla se quedara además en
  // components.css habría dos definiciones de lo mismo, la portada
  // seguiría bajándola y el día que alguien toque una de las dos la otra
  // diría algo distinto. Se comprueba de qué HOJA viene cada una.
  const deQuien = await page.evaluate(() => {
    const busca = (trozo) => {
      const hojas = []
      for (const h of document.styleSheets) {
        let rs; try { rs = h.cssRules } catch { continue }
        for (const r of rs) if ((r.selectorText || '').includes(trozo)) {
          hojas.push((h.href || 'inline').split('/').pop()); break
        }
      }
      return [...new Set(hojas)]
    }
    return { tema: busca('.tema-cabecera'), encuesta: busca('.encuesta') }
  })
  check('  …y .tema-cabecera vive SOLO en foro.css',
    deQuien.tema.length === 1 && deQuien.tema[0] === 'foro.css', deQuien.tema.join(','))
  check('  …y .encuesta también',
    deQuien.encuesta.length === 1 && deQuien.encuesta[0] === 'foro.css', deQuien.encuesta.join(','))
  await page.close()
}

await browser.close()
console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
