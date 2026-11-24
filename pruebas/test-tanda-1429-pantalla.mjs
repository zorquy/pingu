// Tanda 1429 — Los planes de las tiendas, en la pantalla:
//   · lo puro: qué abre cada plan, la chapa, la banda (la primera semana, las
//     dos últimas y el mes después de acabar; en medio, nada);
//   · el panel en prueba: chapa de fundadora y banda con los días;
//   · Gratis: el Panel sin lo vendido (con su línea), Ventas con la pantalla de
//     «es de Puesto», y el Mostrador abre esa pantalla en vez de Vender;
//   · Puesto: el Mostrador sí, las cifras no (su línea), el cierre del mes no;
//   · sin la migración (`tienda_mi_plan` no existe): nada cerrado, nada pintado;
//   · Datos → Tu plan: tres tarjetas con el precio de fundadora y «Me quedo
//     con…» llama a `tienda_me_quedo`;
//   · /para-tiendas: los cuatro planes con los precios de lo puro, y «Al año»;
//   · /admin → Tiendas → Planes: la lista y «Guardar» con `admin_tienda_plan`;
//   · el cartel para tiendas lleva a /para-tiendas.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

console.log('── Lo puro ──')
const P = await import(`${RAIZ}/js/tienda-plan-puro.js`)
{
  check('Gratis no abre el mostrador; Puesto sí', !P.puede('gratis', 'mostrador') && P.puede('puesto', 'mostrador'))
  check('Puesto no abre las cifras ni los lotes; Tienda sí', !P.puede('puesto', 'cifras') && !P.puede('puesto', 'lotes') && P.puede('tienda', 'cifras'))
  check('Tu equipo, solo Tienda+', !P.puede('tienda', 'equipo') && P.puede('tienda_mas', 'equipo'))
  check('lo que no está en la lista, abierto', P.puede('gratis', 'escaparate'))
  check('precios: 25/35/99 y 19/29/79', [P.precioDe('puesto'), P.precioDe('tienda'), P.precioDe('tienda_mas'), P.precioDe('puesto', true), P.precioDe('tienda', true), P.precioDe('tienda_mas', true)].join() === '25,35,99,19,29,79')
  const ahora = new Date('2026-12-01T12:00:00Z')
  const en = (d) => new Date(ahora.getTime() + d * 864e5).toISOString()
  const prueba = (d, extra = {}) => P.estadoDelPlan({ plan: 'tienda_mas', prueba_hasta: en(d), fundadora: true, ...extra }, ahora)
  check('en prueba, 58 días: banda de fundadora', P.bandaDe(prueba(58), ahora)?.titulo === 'Eres tienda fundadora')
  check('a mitad (30 días): sin banda', P.bandaDe(prueba(30), ahora) === null)
  check('a 10 días: con banda, y dice los días', /quedan 10 días/.test(P.bandaDe(prueba(10), ahora)?.texto || ''))
  check('con «me quedo», la banda lo dice', /Te quedas con Tienda: 29 €\/mes mientras sigas/.test(P.bandaDe(prueba(5, { se_queda: 'tienda' }), ahora)?.texto || ''))
  const acabada = P.estadoDelPlan({ plan: 'gratis', prueba_hasta: en(-3), fundadora: true }, ahora)
  check('acabada hace 3 días: banda de «acabó»', P.bandaDe(acabada, ahora)?.tipo === 'acabo' && acabada.acabo)
  check('acabada hace 40 días: sin banda', P.bandaDe(P.estadoDelPlan({ plan: 'gratis', prueba_hasta: en(-40) }, ahora), ahora) === null)
  check('pagando: sin banda; chapa «Fundadora · Tienda»', P.bandaDe(P.estadoDelPlan({ plan: 'tienda', pagado_hasta: en(20), fundadora: true }, ahora), ahora) === null && P.chapaDe(P.estadoDelPlan({ plan: 'tienda', pagado_hasta: en(20), fundadora: true }, ahora)) === 'Fundadora · Tienda')
  check('el título de «es de…»', P.tituloDeCandado('ventas') === 'Tus ventas y la caja son de Puesto' && P.tituloDeCandado('mostrador') === 'El mostrador es de Puesto')
}

const b = await chromium.launch()
const en = (d) => new Date(Date.now() + d * 864e5).toISOString()
const PLAN = {
  prueba: { plan: 'tienda_mas', pagado: 'gratis', prueba_hasta: en(58), pagado_hasta: null, fundadora: true, se_queda: null, existe: true },
  gratis: { plan: 'gratis', pagado: 'gratis', prueba_hasta: en(-3), pagado_hasta: null, fundadora: true, se_queda: null, existe: true },
  puesto: { plan: 'puesto', pagado: 'puesto', prueba_hasta: en(-30), pagado_hasta: en(20), fundadora: false, se_queda: 'puesto', existe: true },
}
async function abrir(ruta, { plan, movil = false, sinMigracion = false, sesion = 'user-2', filas = {}, rpcs = {} } = {}) {
  const base = movil ? { ...devices['iPhone 13'] } : { viewport: { width: 1280, height: 900 } }
  const ctx = await b.newContext({ ...base, locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript((d) => {
    window.__FAKE_SESSION__ = d.sesion
    if (d.sesion === 'user-2') {
      window.__FAKE_PERFIL__ = { tipo: 'tienda', display_name: 'Cartas Bilbao', username: 'cartasbilbao' }
      try { localStorage.setItem('pd-tienda', '{"u":"cartasbilbao","id":"user-2"}') } catch {}
    }
    try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())) } catch {}
    window.__FAKE_PERFILES__ = [{ id: 'user-2', username: 'cartasbilbao', display_name: 'Cartas Bilbao', tipo: 'tienda' }, { id: 'user-3', username: 'rincon', display_name: 'El Rincón', tipo: 'tienda' }]
    window.__FAKE_FILAS__ = { tiendas: [{ user_id: 'user-2', ciudad: 'Bilbao', con_local: true, precio_visible: true }], ...d.filas }
    window.__RPC_RESPUESTAS__ = {
      tienda_reservas_al_dia: 0,
      tienda_hoy: { actual: { importe: 100, ventas: 2, beneficio: 30, coste: 70, sin_coste: 0 }, anterior: { importe: 50, ventas: 1, beneficio: 10 }, serie: [], paso: 'hour', stock: { valor: 1000, unidades: 20, lineas: 10, coste: 700 }, visitas: { actual: 5, anterior: 3 }, avisos: {}, demanda: [] },
      tienda_ventas_lista: { total: 0, tickets: 0, sumas: { unidades: 0, importe: 0, coste: 0, importe_con_coste: 0, beneficio: 0, sin_coste: 0 }, por_donde: {}, filas: [] },
      ...(d.plan ? { tienda_mi_plan: d.plan } : {}),
      ...d.rpcs,
    }
    if (d.sinMigracion) window.__RPC_ERRORES__ = { tienda_mi_plan: { code: 'PGRST202', message: 'Could not find the function public.tienda_mi_plan' } }
  }, { plan, sinMigracion, sesion, filas, rpcs })
  await ctx.route(/\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => { if (!/Transition/.test(String(e))) errores.push(String(e).slice(0, 160)) })
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1800)
  return { page, ctx, errores }
}

console.log('\n── En prueba ──')
{
  const { page, ctx, errores } = await abrir('/tienda', { plan: PLAN.prueba })
  const r = await page.evaluate(() => ({ chapa: document.getElementById('tdChapa')?.textContent, banda: document.querySelector('#tdBanda .tdp-banda')?.textContent.replace(/\s+/g, ' ').trim(), cartera: !!document.querySelector('.tdh-cartera') && getComputedStyle(document.querySelector('.tdh-cartera')).display !== 'none' }))
  check('sin errores', !errores.length, errores.join(' | '))
  check('la chapa: «Fundadora · prueba de Tienda+»', r.chapa === 'Fundadora · prueba de Tienda+', r.chapa)
  check('la banda, con los días', /Eres tienda fundadora/.test(r.banda || '') && /quedan 58 días/.test(r.banda || ''), r.banda)
  check('el Panel entero (lo vendido a la vista)', r.cartera)
  await ctx.close()
}

console.log('\n── Gratis (la prueba acabó) ──')
{
  const { page, ctx, errores } = await abrir('/tienda', { plan: PLAN.gratis })
  const r = await page.evaluate(() => ({
    banda: document.querySelector('#tdBanda .tdp-banda-acabo')?.textContent.replace(/\s+/g, ' ').trim(),
    cartera: getComputedStyle(document.querySelector('.tdh-cartera')).display,
    mini: document.querySelector('.tdp-mini')?.textContent.replace(/\s+/g, ' ').trim(),
  }))
  check('sin errores', !errores.length, errores.join(' | '))
  check('la banda de «acabó»', /Tu prueba de Tienda\+ acabó/.test(r.banda || ''), r.banda)
  check('el Panel sin lo vendido, y su línea «con Puesto»', r.cartera === 'none' && /con Puesto, 19 €\/mes/.test(r.mini || ''), JSON.stringify(r))
  // El Mostrador: la pantalla de «es de…» en vez de Vender.
  await page.evaluate(() => import('/js/tienda-mostrador.js').then((m) => m.abrirVenderRapido()))
  await page.waitForTimeout(600)
  const d = await page.evaluate(() => ({ abierto: document.querySelector('dialog.tdp-candado')?.open, titulo: document.getElementById('tdpCandadoTitulo')?.textContent, vender: !!document.querySelector('.tdv, #tdvBusca') }))
  check('Vender abre «El mostrador es de Puesto», no la hoja', d.abierto && d.titulo === 'El mostrador es de Puesto' && !d.vender, JSON.stringify(d))
  await page.click('dialog.tdp-candado [data-tdp="elegir"]')
  await page.waitForTimeout(600)
  const datos = await page.evaluate(() => ({ ver: document.documentElement.dataset.tdVer, tarjetas: document.querySelectorAll('#plan .tdp-tarjeta').length }))
  check('«Elegir plan» lleva a Datos → Tu plan', datos.ver === 'datos' && datos.tarjetas === 3, JSON.stringify(datos))
  await ctx.close()
}
{
  const { page, ctx } = await abrir('/tienda?ver=ventas', { plan: PLAN.gratis })
  const t = await page.evaluate(() => document.querySelector('#tdVentas #tdpCandadoTitulo')?.textContent)
  check('Ventas: «Tus ventas y la caja son de Puesto» en su sitio', t === 'Tus ventas y la caja son de Puesto', t)
  await ctx.close()
}

console.log('\n── Puesto ──')
{
  const { page, ctx, errores } = await abrir('/tienda', { plan: PLAN.puesto })
  const r = await page.evaluate(() => ({
    chapa: document.getElementById('tdChapa')?.textContent,
    banda: document.querySelector('#tdBanda')?.innerHTML.trim(),
    cartera: getComputedStyle(document.querySelector('.tdh-cartera')).display,
    cifras: getComputedStyle(document.querySelector('.tdh-cifras')).display,
    mini: document.querySelector('.tdp-mini')?.textContent.replace(/\s+/g, ' ').trim(),
  }))
  check('sin errores', !errores.length, errores.join(' | '))
  check('chapa «Plan Puesto» y sin banda', r.chapa === 'Plan Puesto' && !r.banda, JSON.stringify(r))
  check('lo vendido sí; las cifras no, con su línea «con Tienda, 35 €/mes»', r.cartera !== 'none' && r.cifras === 'none' && /con Tienda, 35 €\/mes/.test(r.mini || ''), JSON.stringify(r))
  await page.evaluate(() => import('/js/tienda-mostrador.js').then((m) => m.abrirLotesPorDesglosar()))
  await page.waitForTimeout(500)
  const t = await page.evaluate(() => document.getElementById('tdpCandadoTitulo')?.textContent)
  check('los lotes: «Los lotes son de Tienda»', t === 'Los lotes son de Tienda', t)
  await ctx.close()
}

console.log('\n── Sin la migración ──')
{
  const { page, ctx, errores } = await abrir('/tienda', { sinMigracion: true })
  const r = await page.evaluate(() => ({ chapa: document.getElementById('tdChapa')?.textContent, banda: document.getElementById('tdBanda')?.innerHTML.trim(), cartera: getComputedStyle(document.querySelector('.tdh-cartera')).display, mini: !!document.querySelector('.tdp-mini') }))
  check('sin errores', !errores.length, errores.join(' | '))
  check('nada cerrado ni pintado', r.chapa === 'Tienda' && !r.banda && r.cartera !== 'none' && !r.mini, JSON.stringify(r))
  await page.evaluate(() => import('/js/tienda-mostrador.js').then((m) => m.abrirCajaDeHoy()))
  await page.waitForTimeout(600)
  check('la caja se abre', !(await page.evaluate(() => document.querySelector('dialog.tdp-candado')?.open)))
  await ctx.close()
}

console.log('\n── Datos → Tu plan ──')
for (const movil of [false, true]) {
  const { page, ctx, errores } = await abrir('/tienda?ver=datos', { plan: PLAN.prueba, movil })
  const r = await page.evaluate(() => ({
    titulo: document.getElementById('tdpTitulo')?.textContent,
    tarjetas: [...document.querySelectorAll('#plan .tdp-tarjeta')].map((t) => `${t.querySelector('h3').textContent}:${t.querySelector('.tdp-precio b').textContent}`),
    primera: (() => { const ts = [...document.querySelectorAll('#plan .tdp-tarjeta')]; return ts.map((t) => [t.querySelector('h3').textContent, t.getBoundingClientRect().top]).sort((a, c) => a[1] - c[1])[0]?.[0] })(),
    // Solo Tu plan: la barra de arriba de la tienda ya se salía 57 px a 1280
    // antes de esta tanda (el avatar; apuntado en la bitácora).
    ancho: Math.round(document.getElementById('plan').getBoundingClientRect().right), ventana: innerWidth,
  }))
  check(`${movil ? 'móvil' : 'PC'}: sin errores`, !errores.length, errores.join(' | '))
  check(`${movil ? 'móvil' : 'PC'}: tres tarjetas con el precio de fundadora`, r.titulo === 'Tu plan' && r.tarjetas.join() === 'Puesto:19 €/mes,Tienda:29 €/mes,Tienda+:79 €/mes', JSON.stringify(r))
  check(`${movil ? 'móvil' : 'PC'}: nada se sale`, r.ancho <= r.ventana, `${r.ancho} > ${r.ventana}`)
  if (movil) check('móvil: Tienda, la primera', r.primera === 'Tienda', r.primera)
  if (!movil) {
    await page.click('#plan [data-tdp-quedo="tienda"]')
    await page.waitForTimeout(500)
    const llamada = await page.evaluate(() => (window.__RPCS__ || []).filter((x) => x.nombre === 'tienda_me_quedo').map((x) => x.args))
    check('«Me quedo con Tienda» llama a tienda_me_quedo', JSON.stringify(llamada) === '[{"p_plan":"tienda"}]', JSON.stringify(llamada))
  }
  await ctx.close()
}

console.log('\n── /para-tiendas ──')
for (const movil of [false, true]) {
  const { page, ctx, errores } = await abrir('/para-tiendas', { sesion: 'none', movil })
  const r = await page.evaluate(() => ({
    planes: [...document.querySelectorAll('.pt-plan')].map((p) => `${p.querySelector('h3').textContent}:${p.querySelector('.pt-plan-precio b').textContent}`),
    fund: [...document.querySelectorAll('.pt-plan-fund')].map((x) => x.textContent.trim()).filter((x) => x.length > 1),
    rec: document.querySelector('.pt-plan-rec h3')?.textContent,
    chapa: document.querySelector('.pt-chapa')?.textContent.trim(),
    ancho: document.documentElement.scrollWidth, ventana: innerWidth,
  }))
  check(`${movil ? 'móvil' : 'PC'}: sin errores`, !errores.length, errores.join(' | '))
  check(`${movil ? 'móvil' : 'PC'}: los cuatro planes con sus precios`, r.planes.join() === 'Gratis:0 €,Puesto:25 €,Tienda:35 €,Tienda+:99 €', r.planes.join())
  check(`${movil ? 'móvil' : 'PC'}: fundadoras 19, 29 y 79; Tienda, la recomendada`, r.fund.join('|').includes('19 €/mes') && r.fund.join('|').includes('29 €/mes') && r.fund.join('|').includes('79 €/mes') && r.rec === 'Tienda', JSON.stringify(r.fund))
  check(`${movil ? 'móvil' : 'PC'}: la chapa de arriba dice «2 meses gratis»`, /2 meses gratis/.test(r.chapa || ''), r.chapa)
  check(`${movil ? 'móvil' : 'PC'}: nada se sale`, r.ancho <= r.ventana, `${r.ancho} > ${r.ventana}`)
  if (!movil) {
    await page.click('[data-pt-periodo="anio"]')
    const anual = await page.evaluate(() => [...document.querySelectorAll('.pt-plan-precio b')].map((x) => x.textContent).join())
    check('«Al año»: diez meses', anual === '0 €,250 €,350 €,990 €', anual)
  }
  await ctx.close()
}

console.log('\n── /admin → Tiendas → Planes ──')
{
  const filas = {
    tiendas: [],
    tienda_solicitudes: [],
    tienda_planes: [
      { tienda_id: 'user-2', plan: 'gratis', prueba_hasta: en(20), pagado_hasta: null, fundadora: true, se_queda: 'tienda', se_queda_at: en(-1), nota: null },
      { tienda_id: 'user-3', plan: 'puesto', prueba_hasta: en(-40), pagado_hasta: en(10), fundadora: false, se_queda: null, nota: 'Ko-fi' },
    ],
  }
  const { page, ctx, errores } = await abrir('/admin/?ver=tiendas', { sesion: 'admin-1', filas })
  await page.waitForTimeout(800)
  const r = await page.evaluate(() => ({
    filas: [...document.querySelectorAll('#tiendasPlanes [data-tdpa]')].map((f) => f.textContent.replace(/\s+/g, ' ')),
    cifras: document.querySelector('#tiendasPlanes .admin-stats-grid')?.textContent.replace(/\s+/g, ' '),
  }))
  check('sin errores', !errores.length, errores.join(' | '))
  check('dos tiendas: una en prueba que se queda con Tienda, otra pagando Puesto', r.filas.length === 2 && r.filas.some((t) => /Prueba de Tienda\+/.test(t) && /se queda con Tienda/.test(t)) && r.filas.some((t) => /Puesto pagado hasta/.test(t)), JSON.stringify(r.filas).slice(0, 300))
  check('las cifras: 1 pagando · 25 €/mes', /\b1\s*pagando · 25 €\/mes/.test(r.cifras || ''), r.cifras)
  await page.selectOption('[data-tdpa="user-2"] [data-tdpa-plan]', 'tienda')
  await page.fill('[data-tdpa="user-2"] [data-tdpa-hasta]', '2027-02-28')
  await page.click('[data-tdpa="user-2"] [data-tdpa-accion="guardar"]')
  await page.waitForTimeout(500)
  const ll = await page.evaluate(() => (window.__RPCS__ || []).filter((x) => x.nombre === 'admin_tienda_plan').map((x) => x.args))
  const c = ll[0]?.p_cambios || {}
  check('«Guardar» llama a admin_tienda_plan con el plan y el día entero', ll.length === 1 && ll[0].p_tienda === 'user-2' && c.plan === 'tienda' && /^2027-02-2[89]T/.test(c.pagado_hasta || '') && c.fundadora === true, JSON.stringify(ll))
  await ctx.close()
}

console.log('\n── El cartel para tiendas ──')
{
  const { page, ctx, errores } = await abrir('/', { sesion: 'none' })
  const r = await page.evaluate(async () => {
    const m = await import('/js/cartel-modo-evento.js')
    const c = await m.dibujarCartel({ tipo: 'tiendas' })
    return { enlace: m.enlaceDelCartel(null, 'tiendas'), evento: m.enlaceDelCartel(null), ancho: c.width }
  })
  check('sin errores', !errores.length, errores.join(' | '))
  check('el de tiendas lleva a /para-tiendas; el de siempre, a /evento', r.enlace === 'https://pokedoc.es/para-tiendas?utm_source=cartel-tiendas' && r.evento === 'https://pokedoc.es/evento?utm_source=cartel' && r.ancho === 1240, JSON.stringify(r))
  await ctx.close()
}

await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
