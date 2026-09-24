// Tanda 352 — los premios de un torneo, fuera de la descripción.
//
// PINGU: «acabo de crear mi primer torneo con premios, pero solo se
// especifican en la descripción». Y ahí solo los ve quien ya ha entrado.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync } from 'node:fs'
import {
  premiosDeTorneo,
  premiosParaGuardar,
  resumenDePremios,
  hayPremios,
  PREMIOS_MAXIMO,
} from '/home/user/pingu/js/torneos/comun.js'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 200) : ''}`)
}
const BASE = 'http://localhost:8892'
const leer = (f) => readFileSync(`/home/user/pingu/${f}`, 'utf8')

const PREMIOS = [
  { puesto: '1º', premio: '50 € en cartas' },
  { puesto: '2º', premio: 'Una caja de sobres' },
  { puesto: 'Todos', premio: 'Una promo de participación' },
]

console.log('\n── 1. Qué es un premio y qué se tira ──')
{
  check('se leen los que están bien', premiosDeTorneo({ prizes: PREMIOS }).length === 3)
  // Media frase en pantalla se lee como un fallo: un puesto sin premio
  // (o al revés) no se pinta.
  check('media frase no es un premio',
    premiosDeTorneo({ prizes: [{ puesto: '1º' }, { premio: 'algo' }, ...PREMIOS] }).length === 3)
  check('sin columna, ninguno', premiosDeTorneo({}).length === 0 && hayPremios({}) === false)
  check('una columna con basura no rompe', premiosDeTorneo({ prizes: 'texto' }).length === 0)
  check('el tope se respeta',
    premiosDeTorneo({ prizes: Array.from({ length: 30 }, () => ({ puesto: 'x', premio: 'y' })) }).length === PREMIOS_MAXIMO)
  // Sin premios se guarda NULL y no un array vacío: dos maneras de decir
  // lo mismo son una de más para preguntar.
  check('sin premios se guarda null', premiosParaGuardar([{ puesto: '', premio: '' }]) === null)
  check('y se limpian los espacios',
    premiosParaGuardar([{ puesto: ' 1º ', premio: ' 50 € ' }])[0].premio === '50 €')
  check('el listado enseña el del primero', resumenDePremios({ prizes: PREMIOS }) === '50 € en cartas')
  check('…recortado si no cabe, sin cortar a hachazo',
    resumenDePremios({ prizes: [{ puesto: '1º', premio: 'x'.repeat(80) }] }).endsWith('…'))
}

console.log('\n── 2. La base también lo comprueba ──')
{
  // La columna la escribe cualquiera que pueda editar SU torneo: un
  // jsonb sin forma rompería la ficha a todo el que la abra.
  const sql = leer('supabase-migration-torneos-premios.sql')
  check('se añade la columna', /add column if not exists prizes jsonb/.test(sql))
  check('y se comprueba que es una lista', /jsonb_typeof\(p_premios\) = 'array'/.test(sql))
  // Y con `is distinct from` y no `<>`: si la clave no está,
  // `jsonb_typeof` devuelve NULL y `NULL <> 'string'` no es cierto — es
  // nulo. Con `<>` se colaba {"puesto":"1º"} sin premio, comprobado
  // contra PostgreSQL 16 de verdad.
  check('…de objetos con las dos mitades',
    /jsonb_typeof\(p -> 'puesto'\) is distinct from 'string'/.test(sql) &&
    /jsonb_typeof\(p -> 'premio'\) is distinct from 'string'/.test(sql))
  // Un CHECK no admite subconsultas (0A000), y recorrer una lista jsonb
  // lo es: el recorrido va en una función IMMUTABLE. La primera versión
  // de esta migración falló en la base de PINGU por eso.
  check('el recorrido va en una función inmutable',
    /create or replace function public\.premios_bien_formados/.test(sql) && /\nimmutable\n/.test(sql))
  check('…y el check solo la llama', /check \(\s*prizes is null or public\.premios_bien_formados\(prizes\)\s*\)/.test(sql))
  check('…y con los mismos límites que el cliente',
    /length\(p ->> 'puesto'\) > 40/.test(sql) && /length\(p ->> 'premio'\) > 200/.test(sql))
  check('/admin avisa si falta la migración', /supabase-migration-torneos-premios\.sql/.test(leer('js/schema-check.js')))
  // Y entre el despliegue y el SQL, crear y editar torneos SIGUE
  // funcionando: la columna se quita y se reintenta.
  check('crear aguanta sin la columna', /'join_code', 'prizes'\]/.test(leer('js/torneos/torneos.js')))
  check('editar también', /'join_code', 'prizes'\]/.test(leer('js/torneos/torneo.js')))
}

console.log('\n── 3. En la ficha del torneo ──')
{
  const browser = await chromium.launch()
  const abrir = async (prizes) => {
    const page = await browser.newPage({ viewport: { width: 1150, height: 1200 } })
    const errores = []
    page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
    await page.addInitScript((pr) => {
      window.__FAKE_SESSION__ = 'user-1'
      window.__FAKE_PERFIL__ = { is_admin: false, is_tournament_admin: false }
      window.__FAKE_TORNEOS__ = [{
        id: 'torneo-1', slug: 'copa', name: 'La pachanga', status: 'registration_open',
        admin_id: 'user-1', max_players: 8, swiss_rounds: 3, swiss_bo: 1,
        format: 'standard', round_time_minutes: 50, top_cut_size: 0, prizes: pr,
      }]
    }, prizes)
    await page.goto(`${BASE}/torneo?slug=copa`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2300)
    return { page, errores }
  }

  const con = await abrir(PREMIOS)
  check('el panel sale', await con.page.locator('#torneoPremios').isVisible())
  const textos = await con.page.locator('.torneo-premio-que').allTextContents()
  check('…con los tres premios', textos.join(' | ') === '50 € en cartas | Una caja de sobres | Una promo de participación', textos.join(' | '))
  check('…y el primero destacado', (await con.page.locator('.torneo-premio-primero').count()) === 1)
  // Y se puede editar: es lo que PINGU no podía hacer.
  await con.page.click('#btnEditarTorneo')
  await con.page.waitForTimeout(600)
  const puestos = await con.page.locator('#editarPremiosLista [data-premio-puesto]').evaluateAll((n) => n.map((i) => i.value))
  check('el editor trae los que hay', puestos.join(',') === '1º,2º,Todos', puestos.join(','))
  await con.page.click('#btnEditarAnadirPremio')
  await con.page.waitForTimeout(200)
  check('…y se puede añadir otro',
    (await con.page.locator('#editarPremiosLista .torneo-premio-fila').count()) === 4)
  check('sin errores', con.errores.length === 0, con.errores.join(' | '))
  await con.page.close()

  // Un torneo sin premios no enseña un panel vacío.
  const sin = await abrir(null)
  check('sin premios, el panel ni ocupa', !(await sin.page.locator('#torneoPremios').isVisible()))
  await sin.page.close()
  await browser.close()
}

console.log('\n── 4. Y en el listado, que es donde se decide ──')
{
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1150, height: 1200 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.addInitScript((pr) => {
    window.__FAKE_SESSION__ = 'user-1'
    window.__FAKE_PERFIL__ = { is_admin: false }
    window.__FAKE_TORNEOS__ = [
      { id: 't1', slug: 'con', name: 'Con premios', status: 'registration_open', admin_id: 'otro',
        max_players: 8, swiss_rounds: 3, swiss_bo: 1, format: 'standard', prizes: pr,
        start_at: '2026-12-01T18:00:00Z' },
      { id: 't2', slug: 'sin', name: 'Sin premios', status: 'registration_open', admin_id: 'otro',
        max_players: 8, swiss_rounds: 3, swiss_bo: 1, format: 'standard',
        start_at: '2026-12-02T18:00:00Z' },
    ]
  }, PREMIOS)
  await page.goto(`${BASE}/torneos.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2300)
  const chapas = await page.locator('.torneo-etiqueta-premio').allTextContents()
  check('el torneo con premios lo dice en su tarjeta', chapas.length === 1, chapas.join(' | '))
  check('…y dice CUÁL', chapas[0]?.includes('50 € en cartas'), chapas[0])
  check('sin errores', errores.length === 0, errores.join(' | '))
  await browser.close()
}

console.log('\n── 5. Y la descripción deja de pedirlos ──')
{
  // El hueco donde se escribían antes no puede seguir invitando a
  // escribirlos ahí: si no, conviven los dos sitios y gana el viejo.
  check('el editor de la descripción ya no dice «premios»',
    !/Reglas de la casa, premios/.test(leer('js/torneos/torneos.js')) &&
    !/Reglas de la casa, premios/.test(leer('js/torneos/torneo.js')))
  check('y el formulario de crear tiene su campo', /id="nuevoPremiosLista"/.test(leer('torneos.html')))
}

console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
