// Tanda 985 — Adelantarse a la página siguiente y guardar las secciones
// (propuesta «Rápida al volver», D y E; PINGU: «al tocar o tras dejar el
// ratón encima» y «solo en wifi»).
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

console.log('── 1. Mientras Chrome la prepara, la página no escribe ──')
{
  const { fetchQueEspera } = await import(`${RAIZ}/js/espera-prerender.js`)
  const oyentes = {}
  const doc = { prerendering: true, addEventListener: (t, f) => { oyentes[t] = f } }
  const hechas = []
  const f = fetchQueEspera(async (u, o) => { hechas.push(`${o?.method || 'GET'} ${u}`); return 'ok' }, doc)
  await f('/rest/v1/foro', { method: 'GET' })
  const escritura = f('/rest/v1/page_views', { method: 'POST', body: '{}' })
  await new Promise((ok) => setTimeout(ok, 20))
  check('leer va ya', hechas.length === 1 && hechas[0].startsWith('GET'), hechas.join())
  check('  …escribir espera', hechas.length === 1)
  doc.prerendering = false
  oyentes.prerenderingchange()
  check('  …y sale al abrirse la página', (await escritura) === 'ok' && hechas[1] === 'POST /rest/v1/page_views', hechas.join())
  const sinPreparar = fetchQueEspera(async () => 'ya', { prerendering: false, addEventListener() {} })
  check('una página abierta escribe como siempre', (await sinPreparar('/x', { method: 'PATCH' })) === 'ya')
  check('el cliente de Supabase lo usa', /global: \{ fetch: fetchQueEspera\(\) \}/.test(readFileSync(`${RAIZ}/js/supabase.js`, 'utf8')))
}

console.log('\n── 2. Las reglas: listas enteras, lo demás solo la página ──')
{
  globalThis.location = new URL('https://pokedoc.es/')
  const { reglasDeEspeculacion, tocaGuardarSecciones, PREPARABLES, SECCIONES } = await import(`${RAIZ}/js/precarga.js`)
  const r = reglasDeEspeculacion()
  const enteras = r.prerender[0].where.or.map((x) => x.href_matches.pathname)
  check('se preparan enteras las listas (foro, Mi colección, torneos…)', ['/foro{.html}?', '/mi-coleccion{.html}?', '/torneos{.html}?', '/'].every((p) => enteras.includes(p)), enteras.join(' '))
  check('  …y NO una carta (pide precios de pago) ni un tema (se marca leído)', !PREPARABLES.some((p) => /^\/(carta|tema|guia|curso)(\.html)?$/.test(p)))
  check('  …al tocar o con el ratón encima un momento (moderate)', r.prerender[0].eagerness === 'moderate')
  const txt = JSON.stringify(r.prefetch)
  check('lo demás, solo la página, y nunca /admin, /auth ni la baja del correo', /\/admin\*/.test(txt) && /\/auth\*/.test(txt) && /\/baja-correo\*/.test(txt))
  check('las secciones de la barra', ['/', '/aprender.html', '/foro.html', '/torneos.html', '/cartas', '/mi-coleccion'].every((s) => SECCIONES.includes(s)))
  const ahora = Date.now()
  check('guardar las secciones: en wifi, sí', tocaGuardarSecciones({ type: 'wifi' }, null, ahora))
  check('  …con datos móviles, no', !tocaGuardarSecciones({ type: 'cellular' }, null, ahora))
  check('  …sin saber qué red es (Safari), no', !tocaGuardarSecciones(undefined, null, ahora) && !tocaGuardarSecciones({ effectiveType: '4g' }, null, ahora))
  check('  …con el ahorro de datos, no', !tocaGuardarSecciones({ type: 'wifi', saveData: true }, null, ahora))
  check('  …y una vez por semana', !tocaGuardarSecciones({ type: 'wifi' }, ahora - 86400000, ahora) && tocaGuardarSecciones({ type: 'wifi' }, ahora - 8 * 86400000, ahora))
}

console.log('\n── 3. El worker baja la página, sus ficheros y lo que importan ──')
{
  const ORIGEN = 'https://pokedoc.es'
  const almacen = new Map()
  const abrir = (n) => {
    if (!almacen.has(n)) almacen.set(n, new Map())
    const m = almacen.get(n)
    const clave = (r) => (typeof r === 'string' ? new URL(r, ORIGEN).href : r.url)
    return { match: async (r) => m.get(clave(r))?.clone(), put: async (r, res) => { m.set(clave(r), res) }, keys: async () => [...m.keys()].map((u) => new Request(u)), delete: async (r) => m.delete(clave(r)) }
  }
  const caches = { open: async (n) => abrir(n), keys: async () => [...almacen.keys()], delete: async (n) => almacen.delete(n), match: async () => undefined }
  const SITIO = {
    '/foro.html': '<link rel="stylesheet" href="css/style.css"><link rel="stylesheet" href="/css/foro.css"><script type="module" src="js/foro.js"></script>',
    '/js/foro.js': "import { a } from './foro-a.js'\nimport './foro-b.js'\nconst x = import('./pesado.js')",
    '/js/foro-a.js': "export { c } from '../js/foro-c.js'",
    '/js/foro-b.js': '', '/js/foro-c.js': '', '/css/style.css': '', '/css/foro.css': '', '/js/pesado.js': '',
  }
  const pedidas = []
  const basica = (t) => { const r = new Response(t, { status: 200 }); Object.defineProperty(r, 'type', { value: 'basic' }); return r }
  const red = async (req) => { const u = new URL(typeof req === 'string' ? req : req.url, ORIGEN).pathname; pedidas.push(u); return basica(SITIO[u] ?? '') }
  const oyentes = {}
  const self = { location: new URL(ORIGEN), addEventListener: (t, f) => { oyentes[t] = f }, skipWaiting: () => {}, clients: { claim: async () => {} } }
  vm.runInContext(readFileSync(`${RAIZ}/sw.js`, 'utf8'), vm.createContext({ self, caches, fetch: red, URL, Request, Response, setTimeout, clearTimeout, Promise, console }))
  // Ya tenía la hoja común guardada: esa no se pide.
  await abrir('pokedoc-ficheros-1').put(`${ORIGEN}/css/style.css`, basica('vieja'))
  let espera
  oyentes.message({ data: { tipo: 'precargar', paginas: ['/foro.html', '/carta?id=x'] }, waitUntil: (p) => { espera = p } })
  await espera
  const fic = [...(almacen.get('pokedoc-ficheros-1')?.keys() || [])].map((u) => new URL(u).pathname).sort()
  check('la página entra en la caché de páginas', almacen.get('pokedoc-paginas-1')?.has(`${ORIGEN}/foro.html`))
  check('  …con sus hojas y su módulo, y lo que este importa (también de segunda mano)', ['/css/foro.css', '/js/foro.js', '/js/foro-a.js', '/js/foro-b.js', '/js/foro-c.js'].every((f) => fic.includes(f)), fic.join(' '))
  check('  …pero no lo que entra por import() (eso es de lo que se abre al tocar)', !fic.includes('/js/pesado.js'))
  check('lo que ya estaba guardado no se vuelve a pedir', !pedidas.includes('/css/style.css'), pedidas.join(' '))
  check('una ficha con consulta no se adelanta', !pedidas.some((p) => p.startsWith('/carta')))
}

console.log('\n── 4. En el código ──')
{
  const pre = readFileSync(`${RAIZ}/js/precarga.js`, 'utf8')
  check('al tocar se le pide al worker también en el iPhone (sin reglas)', /alWorker\(\[u\.pathname \+ u\.search\]\)\s*\n\s*if \(conReglas\) return/.test(pre))
  check('las secciones, solo con el worker al mando y con el teléfono quieto', /requestIdleCallback\(guardar/.test(pre) && /if \(!win\.navigator\?\.serviceWorker\?\.controller\) return/.test(pre))
}
console.log(fails ? `\n❌ ${fails} fallos` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
