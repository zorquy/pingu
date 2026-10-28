// Tanda 1067 — la cuenta de tienda por invitación, en el navegador: el
// enlace «Para tiendas» del pie, /tiendas (pedir acceso, sin cuenta),
// /alta-tienda (la invitación, crear la cuenta con su email, la tienda),
// /tienda (las cuatro caras y los datos), /admin → Tiendas (aceptar con el
// correo que no sale y su enlace), el onboarding que manda al alta y el
// login de una tienda, que entra a su panel.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync, readdirSync } from 'node:fs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
const REPO = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const TOKEN = '6f1d2c0a-1111-2222-3333-444455556666'
const INVITACION = { valida: true, nombre: 'El Rincón del Entrenador', ciudad: 'Bilbao', email: 'user-2@pruebas.test', web: '@turincon', caduca: '2026-11-11T00:00:00Z' }

const b = await chromium.launch()
async function abrir(ruta, { sesion = 'user-2', perfil = null, rpc = {}, errores = {}, filas = null, auth = null, guardado = null, movil = false } = {}) {
  const ctx = await b.newContext(movil ? { ...devices['iPhone 13'] } : { viewport: { width: 1280, height: 900 } })
  await ctx.addInitScript(([s, p, r, e, f, a, g]) => {
    window.__FAKE_SESSION__ = s
    if (p) window.__FAKE_PERFIL__ = p
    window.__RPC_RESPUESTAS__ = r
    window.__RPC_ERRORES__ = e
    if (f) window.__FAKE_FILAS__ = f
    if (a) window.__FAKE_AUTH__ = a
    try { if (g) localStorage.setItem('pd-alta-tienda', g); else if (!sessionStorage.getItem('pd-1067')) localStorage.removeItem('pd-alta-tienda') } catch {}
  }, [sesion, perfil, rpc, errores, filas, auth, guardado])
  const p = await ctx.newPage()
  const errs = []
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)))
  await p.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(1500)
  return { p, ctx, errs }
}
const rpcs = (p, nombre) => p.evaluate((n) => (window.__RPCS__ || []).filter((r) => (r.nombre || r.name || r[0]) === n), nombre)

console.log('── 1. «Para tiendas» en el pie ──')
{
  const conPie = readdirSync(REPO).filter((f) => f.endsWith('.html') && readFileSync(`${REPO}/${f}`, 'utf8').includes('class="pie-rejilla"'))
  const sin = conPie.filter((f) => !readFileSync(`${REPO}/${f}`, 'utf8').includes('<a href="/tiendas">Para tiendas</a>'))
  check(`las ${conPie.length} páginas con pie lo llevan`, conPie.length >= 40 && !sin.length, sin.join(', '))
  const { p, ctx } = await abrir('/foro.html')
  await p.locator('footer a[href="/tiendas"]').click()
  await p.waitForURL(/\/tiendas/)
  check('  …y lleva a /tiendas', /\/tiendas/.test(p.url()))
  await ctx.close()
}

console.log('── 2. /tiendas: pedir acceso sin cuenta ──')
{
  const { p, ctx, errs } = await abrir('/tiendas.html', { sesion: 'none' })
  check('sin errores', !errs.length, errs.join(' | '))
  check('el título y los tres puntos, con su icono', (await p.textContent('h1')).includes('PokeDoc para tiendas') && (await p.locator('.tiendas-punto').count()) === 3 && (await p.locator('.tiendas-icono svg').count()) === 3)
  await p.click('#tiendasEnviar')
  check('vacío: dice qué falta y no manda nada', (await p.textContent('#tiendasError')) === 'Escribe el nombre de la tienda.' && !(await rpcs(p, 'tienda_pedir')).length)
  await p.fill('#tiendasNombre', 'El Rincón del Entrenador')
  await p.fill('#tiendasCiudad', 'Bilbao')
  await p.fill('#tiendasEmail', 'tienda@ejemplo')
  await p.click('#tiendasEnviar')
  check('  …un email malo, también', /email/.test(await p.textContent('#tiendasError')))
  await p.fill('#tiendasEmail', 'tienda@ejemplo.es')
  await p.fill('#tiendasContacto', 'Ane')
  await p.selectOption('#tiendasTamano', 'mucha')
  await p.click('#tiendasEnviar')
  await p.waitForTimeout(500)
  const llamada = (await rpcs(p, 'tienda_pedir'))[0]
  const args = llamada?.args || llamada?.[1] || {}
  check('manda la solicitud a la base con todo', args.p_nombre === 'El Rincón del Entrenador' && args.p_ciudad === 'Bilbao' && args.p_email === 'tienda@ejemplo.es' && args.p_contacto === 'Ane' && args.p_web === null && args.p_tamano === 'mucha', JSON.stringify(llamada))
  check('  …y da las gracias con su email', (await p.isVisible('#tiendasGracias')) && (await p.textContent('#tiendasGraciasEmail')) === 'tienda@ejemplo.es' && !(await p.isVisible('#tiendasForm')))
  await ctx.close()
}
{
  const { p, ctx } = await abrir('/tiendas.html', { sesion: 'none', errores: { tienda_pedir: { code: 'P0001', message: 'Ahora mismo llegan demasiadas solicitudes. Prueba dentro de un rato.' } } })
  await p.fill('#tiendasNombre', 'Rincón'); await p.fill('#tiendasCiudad', 'Bilbao'); await p.fill('#tiendasEmail', 'a@b.es')
  await p.click('#tiendasEnviar'); await p.waitForTimeout(400)
  check('un no de la base se enseña tal cual y el formulario sigue', /demasiadas solicitudes/.test(await p.textContent('#tiendasError')) && (await p.isVisible('#tiendasForm')))
  await ctx.close()
}
{
  const { p, ctx } = await abrir('/tiendas.html', { sesion: 'none' })
  await p.fill('#tiendasNombre', 'Rincón'); await p.fill('#tiendasCiudad', 'Bilbao'); await p.fill('#tiendasEmail', 'a@b.es')
  await p.evaluate(() => { document.getElementById('tiendasPagina').value = 'http://spam' })
  await p.click('#tiendasEnviar'); await p.waitForTimeout(400)
  check('un bot (la trampa rellena): gracias y nada a la base', (await p.isVisible('#tiendasGracias')) && !(await rpcs(p, 'tienda_pedir')).length)
  await ctx.close()
}
{
  const { p, ctx } = await abrir('/tiendas.html', { sesion: 'none', movil: true })
  const ancho = await p.evaluate(() => document.documentElement.scrollWidth)
  check('en el móvil no se sale de ancho', ancho <= 390, ancho)
  await ctx.close()
}

console.log('── 3. /alta-tienda ──')
{
  const { p, ctx, errs } = await abrir('/alta-tienda.html', { sesion: 'none' })
  check('sin token: «no vale» y a pedir otra vez', !errs.length && (await p.isVisible('#altaInvalida')) && /no es de ninguna invitación/.test(await p.textContent('#altaInvalidaMotivo')) && (await p.getAttribute('#altaInvalida a', 'href')) === '/tiendas', errs.join(' | '))
  await ctx.close()
}
{
  const { p, ctx } = await abrir(`/alta-tienda.html?i=${TOKEN}`, { sesion: 'none', rpc: { tienda_invitacion: { valida: false, motivo: 'caducada' } } })
  check('caducada: lo dice', /ha caducado/.test(await p.textContent('#altaInvalidaMotivo')))
  check('  …y olvida el token apuntado', (await p.evaluate(() => localStorage.getItem('pd-alta-tienda'))) === null)
  await ctx.close()
}
{
  const { p, ctx, errs } = await abrir(`/alta-tienda.html?i=${TOKEN}`, { sesion: 'none', rpc: { tienda_invitacion: INVITACION } })
  check('válida y sin sesión: crear la cuenta de la tienda, con su nombre', !errs.length && (await p.isVisible('#altaCuenta')) && (await p.textContent('#altaCuenta h2')).includes('El Rincón del Entrenador'), errs.join(' | '))
  check('  …el email es el de la invitación y no se cambia', (await p.inputValue('#altaEmail')) === INVITACION.email && (await p.getAttribute('#altaEmail', 'readonly')) !== null)
  check('  …y el token queda apuntado', (await p.evaluate(() => localStorage.getItem('pd-alta-tienda'))) === TOKEN)
  await p.fill('#altaPassword', 'corta')
  await p.click('#altaCrear')
  check('  …una contraseña floja no pasa', (await p.textContent('#altaCuentaError')).length > 5 && !(await p.evaluate(() => window.__AUTH__.length)))
  await p.fill('#altaPassword', 'Rinc0n!Bilbao')
  await p.click('#altaCrear'); await p.waitForTimeout(400)
  const alta = await p.evaluate(() => window.__AUTH__.find((a) => a.que === 'signUp'))
  check('  …crea la cuenta con ese email y vuelve AQUÍ tras confirmar', alta?.email === INVITACION.email && alta?.options?.emailRedirectTo?.endsWith(`/alta-tienda?i=${TOKEN}`), JSON.stringify(alta))
  check('  …y pide revisar el correo', await p.isVisible('#altaRevisa'))
  await ctx.close()
}
{
  const { p, ctx } = await abrir(`/alta-tienda.html?i=${TOKEN}`, { sesion: 'none', rpc: { tienda_invitacion: INVITACION } })
  await p.click('#altaGoogle'); await p.waitForTimeout(300)
  const g = await p.evaluate(() => window.__AUTH__.find((a) => a.que === 'signInWithOAuth'))
  check('Google vuelve también a /alta-tienda con el token', g?.provider === 'google' && g?.options?.redirectTo?.endsWith(`/alta-tienda?i=${TOKEN}`))
  await ctx.close()
}
{
  const { p, ctx } = await abrir(`/alta-tienda.html?i=${TOKEN}`, { sesion: 'user-1', rpc: { tienda_invitacion: INVITACION } })
  check('con OTRA cuenta abierta: lo dice, con los dos emails', (await p.isVisible('#altaOtro')) && (await p.textContent('#altaOtroEmail')) === 'user-1@pruebas.test' && (await p.textContent('#altaOtroInvitado')) === INVITACION.email)
  await p.click('#altaOlvidar'); await p.waitForTimeout(500)
  check('  …«No es para mí» olvida la invitación', (await p.evaluate(() => localStorage.getItem('pd-alta-tienda'))) === null)
  await ctx.close()
}
{
  const { p, ctx, errs } = await abrir(`/alta-tienda.html?i=${TOKEN}`, { sesion: 'user-2', rpc: { tienda_invitacion: INVITACION, tienda_alta: { ok: true, username: 'el-rincon-del-entrenador' } } })
  await p.waitForTimeout(600)
  check('con su cuenta: «Tu tienda», con lo de la solicitud', !errs.length && (await p.isVisible('#altaTienda')) && (await p.inputValue('#altaNombre')) === 'El Rincón del Entrenador' && (await p.inputValue('#altaCiudad')) === 'Bilbao' && (await p.inputValue('#altaWeb')) === '@turincon', errs.join(' | '))
  check('  …y un @ propuesto, libre', (await p.inputValue('#altaUsuario')) === 'el-rincon-del-entrenador' && (await p.textContent('#altaUsuarioEstado')) === 'Libre')
  await p.fill('#altaUsuario', 'ash'); await p.waitForTimeout(700)
  check('  …uno ocupado lo dice al escribir', /ya lo tiene otra cuenta/.test(await p.textContent('#altaUsuarioEstado')))
  await p.fill('#altaUsuario', 'El Rincón'); await p.waitForTimeout(500)
  check('  …y uno con mala forma, también', /letras, números y guiones/.test(await p.textContent('#altaUsuarioEstado')))
  await p.click('#altaGuardar')
  check('  …y no se guarda', !(await rpcs(p, 'tienda_alta')).length)
  await p.fill('#altaUsuario', 'el-rincon-del-entrenador')
  await p.fill('#altaDireccion', 'Calle de ejemplo, 12')
  await p.click('#altaGuardar'); await p.waitForTimeout(500)
  const a = (await rpcs(p, 'tienda_alta'))[0]
  const args = a?.args || a?.[1] || {}
  check('tienda_alta con el token y los datos', args.p_token === TOKEN && args.p_username === 'el-rincon-del-entrenador' && args.p_nombre === 'El Rincón del Entrenador' && args.p_ciudad === 'Bilbao' && args.p_direccion === 'Calle de ejemplo, 12' && args.p_web === '@turincon', JSON.stringify(a))
  check('  …y queda lista: a su panel o a su perfil', (await p.isVisible('#altaStock')) && (await p.getAttribute('#altaPerfil', 'href')) === '/usuario/el-rincon-del-entrenador' && (await p.locator('#altaStock a[href="/tienda"]').count()) === 1)
  check('  …y olvida la invitación', (await p.evaluate(() => localStorage.getItem('pd-alta-tienda'))) === null)
  await ctx.close()
}
{
  const { p, ctx } = await abrir(`/alta-tienda.html?i=${TOKEN}`, { sesion: 'user-2', rpc: { tienda_invitacion: INVITACION }, errores: { tienda_alta: { code: 'P0001', message: 'Esta invitación ya no vale. Pide otra desde /tiendas.' } } })
  await p.waitForTimeout(500)
  await p.click('#altaGuardar'); await p.waitForTimeout(500)
  check('un no de la base al guardar se enseña', /ya no vale/.test(await p.textContent('#altaTiendaError')) && (await p.isVisible('#altaTienda')))
  await ctx.close()
}
{
  const { p, ctx } = await abrir(`/alta-tienda.html`, { sesion: 'user-2', rpc: { tienda_invitacion: INVITACION }, guardado: TOKEN })
  await p.waitForTimeout(400)
  check('sin ?i= pero con la invitación apuntada (vuelta de Google): sigue', await p.isVisible('#altaTienda'))
  await ctx.close()
}

console.log('── 4. El onboarding de siempre manda al alta ──')
{
  const { p, ctx } = await abrir('/onboarding.html', { sesion: 'user-2', rpc: { tienda_invitacion: INVITACION }, guardado: TOKEN, perfil: { onboarding_completed: false } })
  await p.waitForTimeout(800)
  check('con una invitación apuntada, /onboarding lleva a /alta-tienda', p.url().includes(`/alta-tienda?i=${TOKEN}`), p.url())
  await ctx.close()
}

console.log('── 5. /tienda: las cuatro caras ──')
{
  const { p, ctx, errs } = await abrir('/tienda.html', { sesion: 'none' })
  check('sin sesión: entrar con la cuenta de la tienda', !errs.length && (await p.isVisible('#tdEntrar')) && (await p.getAttribute('#tdEntrar a', 'href')).includes('volver=%2Ftienda'), errs.join(' | '))
  await ctx.close()
}
{
  const { p, ctx } = await abrir('/tienda.html', { sesion: 'user-2' })
  check('una persona: «Esto aún no está abierto»', (await p.isVisible('#tdCerrado')) && !(await p.isVisible('#tdPanel')))
  await ctx.close()
}
{
  const { p, ctx } = await abrir('/tienda.html', { sesion: 'admin-1' })
  check('el equipo: la explicación y el enlace a /admin', (await p.isVisible('#tdEquipo')) && (await p.getAttribute('#tdEquipo a.btn-primary', 'href')) === '/admin/?ver=tiendas')
  await ctx.close()
}
const TIENDA_FILAS = { tiendas: [{ user_id: 'user-2', ciudad: 'Bilbao', direccion: null, horario: null, web: '@turincon', precio_visible: true }] }
{
  const { p, ctx, errs } = await abrir('/tienda.html', { sesion: 'user-2', perfil: { tipo: 'tienda', display_name: 'El Rincón del Entrenador', username: 'rincon' }, filas: TIENDA_FILAS })
  check('una tienda: su panel, con su nombre y su ciudad', !errs.length && (await p.isVisible('#tdPanel')) && (await p.textContent('#tdNombre')) === 'El Rincón del Entrenador' && (await p.textContent('#tdDonde')) === 'Bilbao', errs.join(' | '))
  check('  …«Ver mi perfil» lleva a su perfil', (await p.getAttribute('#tdVerPerfil', 'href')) === '/usuario/rincon')
  check('  …cuatro pestañas, Hoy elegida', (await p.locator('[data-td]').count()) === 4 && (await p.getAttribute('[data-td="hoy"]', 'aria-selected')) === 'true')
  const pasos = await p.$$eval('#tdPasos li', (ls) => ls.map((l) => (l.classList.contains('hecho') ? '✓ ' : '· ') + l.querySelector('strong').textContent))
  check('  …los primeros pasos: cuenta hecha, datos por hacer', pasos.length === 4 && pasos[0].startsWith('✓') && pasos[1].startsWith('·'), pasos.join(' | '))
  await p.click('[data-td-ir="datos"]')
  check('  …«Hacerlo» abre Datos, y la dirección lo recuerda', (await p.isVisible('#tdDatos')) && p.url().includes('ver=datos'))
  check('  …con lo que ya hay', (await p.inputValue('#tdDatoCiudad')) === 'Bilbao' && (await p.inputValue('#tdDatoWeb')) === '@turincon' && (await p.isChecked('#tdDatoPrecio')))
  await p.fill('#tdDatoDireccion', 'Calle de ejemplo, 12')
  await p.fill('#tdDatoHorario', 'L–S · 10:30–20:30')
  await p.uncheck('#tdDatoPrecio')
  await p.click('#tdDatosGuardar'); await p.waitForTimeout(600)
  const fila = await p.evaluate(() => window.__TABLAS__.tiendas.find((t) => t.user_id === 'user-2'))
  check('  …guardar escribe SU fila', fila.direccion === 'Calle de ejemplo, 12' && fila.horario === 'L–S · 10:30–20:30' && fila.precio_visible === false, JSON.stringify(fila))
  check('  …y la cabecera y los pasos se ponen al día', (await p.textContent('#tdDonde')) === 'Bilbao · Calle de ejemplo, 12')
  await p.click('[data-td="hoy"]')
  check('  …el paso de los datos ya está hecho', (await p.getAttribute('#tdPasos li:nth-child(2)', 'class')) === 'hecho')
  await p.click('[data-td="stock"]')
  await p.waitForTimeout(800)
  check('Stock: monta el stock (1068), y sin respuesta de la base dice que falta un paso', (await p.isVisible('[data-td-hoja="stock"] .tds')) && /falta un paso/.test(await p.textContent('[data-td-hoja="stock"]')))
  await ctx.close()
}
{
  const { p, ctx } = await abrir('/tienda.html?ver=escaparate', { sesion: 'user-2', perfil: { tipo: 'tienda', display_name: 'Rincón', username: 'rincon' }, filas: TIENDA_FILAS, movil: true })
  check('?ver=escaparate abre esa pestaña (en el móvil)', await p.isVisible('[data-td-hoja="escaparate"]'))
  const ancho = await p.evaluate(() => document.documentElement.scrollWidth)
  check('  …sin salirse de ancho', ancho <= 390, ancho)
  await ctx.close()
}

console.log('── 6. /admin → Tiendas ──')
{
  const SOL = [
    { id: 's1', nombre: 'El Rincón del Entrenador', ciudad: 'Bilbao', email: 'tienda@ejemplo.es', contacto: 'Ane', web: '@turincon', tamano: 'media', estado: 'pendiente', created_at: '2026-10-27T10:00:00Z' },
    { id: 's2', nombre: 'Mazo Norte', ciudad: 'Getxo', email: 'hola@mazonorte.es', contacto: null, web: null, tamano: 'poca', estado: 'pendiente', created_at: '2026-10-26T10:00:00Z' },
    { id: 's3', nombre: 'Carta Alta', ciudad: 'Vitoria', email: 'c@a.es', estado: 'usada', usada_el: '2026-10-20T10:00:00Z', created_at: '2026-10-10T10:00:00Z' },
  ]
  const { p, ctx, errs } = await abrir('/admin/?ver=tiendas', { sesion: 'admin-1', filas: { tienda_solicitudes: SOL } })
  await p.waitForTimeout(800)
  check('la sección se abre por ?ver=tiendas', !errs.length && (await p.isVisible('#section-tiendas')), errs.join(' | '))
  const cifras = await p.$$eval('#tiendasResumen .admin-card .value', (v) => v.map((x) => x.textContent))
  check('  …cifras: 2 pendientes, 0 aceptadas, 1 con cuenta, 0 rechazadas', cifras.join(',') === '2,0,1,0', cifras.join(','))
  check('  …las pendientes, con su ciudad, email y tamaño', (await p.locator('#tiendasLista .admin-card').count()) === 2 && /Bilbao · tienda@ejemplo\.es · @turincon · entre 1\.000 y 10\.000 cartas/.test(await p.textContent('#tiendasLista')))
  let pedido = null
  await p.route('**/.netlify/functions/tienda-decidir', async (route) => {
    pedido = { body: route.request().postDataJSON(), auth: route.request().headers().authorization }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, estado: 'aceptada', email: 'tienda@ejemplo.es', enlace: `https://pokedoc.es/alta-tienda?i=${TOKEN}`, correo: 'no_salio', motivo: 'Falta configurar EMAIL_API_KEY en Netlify.' }) })
  })
  await p.click('[data-tienda-aceptar="s1"]'); await p.waitForTimeout(800)
  check('Aceptar llama a tienda-decidir con la sesión', pedido?.body?.id === 's1' && pedido.body.aceptar === true && /^Bearer/.test(pedido.auth || ''), JSON.stringify(pedido))
  const aviso = await p.textContent('#tiendasAviso')
  check('  …el correo que no sale: el motivo y el enlace para mandarlo a mano', /El Rincón del Entrenador: aceptada/.test(aviso) && /EMAIL_API_KEY/.test(aviso) && aviso.includes(`/alta-tienda?i=${TOKEN}`) && (await p.locator('#tiendasAviso [data-tienda-copiar]').count()) === 1, aviso)
  check('  …y se pasa a «Aceptadas»', (await p.getAttribute('[data-tiendas-ver="aceptada"]', 'aria-pressed')) === 'true')
  await p.click('[data-tiendas-ver="usada"]')
  check('«Con cuenta»: la que ya entró, sin botones', /Carta Alta/.test(await p.textContent('#tiendasLista')) && (await p.locator('#tiendasLista button').count()) === 0)
  await ctx.close()
}

console.log('── 7. Entrar como tienda lleva a su panel ──')
{
  const { p, ctx } = await abrir('/auth.html', { sesion: 'none', perfil: null, filas: { user_profiles: [] }, auth: { signInWithPassword: { data: { user: { id: 'user-2' }, session: { user: { id: 'user-2' } } }, error: null } } })
  await p.evaluate(() => { const f = window.__TABLAS__.user_profiles.find((x) => x.id === 'user-2'); f.tipo = 'tienda'; f.onboarding_completed = true })
  await p.fill('#loginEmail', 'tienda@ejemplo.es')
  await p.fill('#loginPassword', 'Rinc0n!Bilbao')
  await p.click('#btnLogin')
  await p.waitForTimeout(1200)
  check('una cuenta de tienda entra a /tienda', /\/tienda(\.html)?$/.test(new URL(p.url()).pathname), p.url())
  await ctx.close()
}
{
  const { p, ctx } = await abrir('/auth.html?volver=%2Fforo', { sesion: 'none', auth: { signInWithPassword: { data: { user: { id: 'user-2' }, session: { user: { id: 'user-2' } } }, error: null } } })
  await p.evaluate(() => { const f = window.__TABLAS__.user_profiles.find((x) => x.id === 'user-2'); f.tipo = 'tienda'; f.onboarding_completed = true })
  await p.fill('#loginEmail', 'tienda@ejemplo.es'); await p.fill('#loginPassword', 'Rinc0n!Bilbao')
  await p.click('#btnLogin'); await p.waitForTimeout(1200)
  check('  …salvo que venga con un `volver`, que manda', new URL(p.url()).pathname.startsWith('/foro'), p.url())
  await ctx.close()
}
{
  const { p, ctx } = await abrir('/auth.html', { sesion: 'none', auth: { signInWithPassword: { data: { user: { id: 'user-1' }, session: { user: { id: 'user-1' } } }, error: null } } })
  await p.evaluate(() => { const f = window.__TABLAS__.user_profiles.find((x) => x.id === 'user-1'); f.onboarding_completed = true })
  await p.fill('#loginEmail', 'ash@ejemplo.es'); await p.fill('#loginPassword', 'Rinc0n!Bilbao')
  await p.click('#btnLogin'); await p.waitForTimeout(1200)
  check('  …y una persona, a la portada de siempre', new URL(p.url()).pathname === '/', p.url())
  await ctx.close()
}

await b.close()
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
