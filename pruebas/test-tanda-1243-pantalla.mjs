// Tanda 1243 — Una tienda se reconoce por su nombre (PINGU: «el color, pon el
// color que dices y al lado un iconito en el nombre… y la dirección, pon
// tiendas, cámbialo a /tiendas/el usuario»). Se mira:
//   · la regla (js/rangos.js): una tienda es un rango más, en verde azulado,
//     con su icono por un ATRIBUTO (`data-nombre-tienda`), y si fuera también
//     del equipo manda el equipo pero el icono sigue;
//   · las direcciones: `profileUrl` lleva una tienda a /tiendas/<usuario>, y la
//     redirección del servidor (`destinoDePerfil`) manda cada una a la suya;
//   · /tiendas/<usuario> abre el escaparate, con el nombre en su color y el icono
//     dibujado (en claro y en oscuro, con contraste), y /usuario/<tienda> abierto
//     sin servidor se corrige en la barra;
//   · la agenda de /tiendas y la franja del Mercado enlazan a /tiendas/<usuario>
//     con el nombre pintado igual;
//   · una cuenta de tienda puede abrir su escaparate en la dirección nueva.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

console.log('── 1. La regla del nombre ──')
{
  const R = await import(`${RAIZ}/js/rangos.js`)
  check('las columnas del rango piden el tipo de cuenta', /\btipo\b/.test(R.COLUMNAS_RANGO))
  check('una tienda es el rango «tienda»', R.rangoDe({ tipo: 'tienda' }) === 'tienda' && R.nombreDeRango({ tipo: 'tienda' }) === 'Tienda')
  check('una persona no tiene rango', R.rangoDe({ tipo: 'persona' }) === null && R.atributosDeRango({ tipo: 'persona' }) === '')
  const a = R.atributosDeRango({ tipo: 'tienda' })
  check('sus atributos: el color de tienda, «Tienda» al pasar y el icono', /var\(--rango-tienda\)/.test(a) && /title="Tienda"/.test(a) && /data-nombre-tienda/.test(a), a)
  const e = R.atributosDeRango({ tipo: 'tienda', is_admin: true })
  check('si fuera también del equipo: manda el equipo, el icono sigue', /var\(--rango-admin\)/.test(e) && /data-nombre-tienda/.test(e), e)
  check('un admin a secas no lleva el icono', !/data-nombre-tienda/.test(R.atributosDeRango({ is_admin: true, tipo: 'persona' })))
  check('los atributos fijos de las pantallas de tiendas dicen lo mismo', /data-nombre-tienda/.test(R.ATRIBUTOS_DE_TIENDA) && /--rango-tienda/.test(R.ATRIBUTOS_DE_TIENDA))
}

console.log('── 2. Las direcciones ──')
{
  const { destinoDePerfil } = await import(`${RAIZ}/netlify/edge-functions/meta-social.js`)
  const u = (s) => new URL(`https://pokedoc.es${s}`)
  check('/usuario/<tienda> → /tiendas/<tienda>, con su consulta (el QR)', destinoDePerfil(u('/usuario/rincon?utm_source=qr'), 'tienda') === 'https://pokedoc.es/tiendas/rincon?utm_source=qr')
  check('/tiendas/<persona> → /usuario/<persona>', destinoDePerfil(u('/tiendas/misty'), 'persona') === 'https://pokedoc.es/usuario/misty')
  check('cada una en la suya no se mueve', destinoDePerfil(u('/tiendas/rincon'), 'tienda') === null && destinoDePerfil(u('/usuario/misty'), 'persona') === null)
  check('sin perfil (no existe o la base no contesta), no se mueve', destinoDePerfil(u('/usuario/nadie'), null) === null)
  check('/usuario.html?u= y /tiendas a secas no se tocan', destinoDePerfil(u('/usuario.html'), 'tienda') === null && destinoDePerfil(u('/tiendas'), 'persona') === null)
  const { puedeAbrirTienda } = await import(`${RAIZ}/js/tienda-puertas.js`)
  const yo = { u: 'rincon', id: 'tienda-1' }
  check('una cuenta de tienda abre su escaparate en /tiendas/<suyo>, no el de otra', puedeAbrirTienda('/tiendas/rincon', '', yo) && !puedeAbrirTienda('/tiendas/otra', '', yo) && !puedeAbrirTienda('/tiendas', '', yo))
  const fuente = (await import('node:fs')).readFileSync(`${RAIZ}/netlify.toml`, 'utf8')
  check('netlify.toml sirve /tiendas/<usuario> con la ficha', /from = "\/tiendas\/:username"\s*\n\s*to = "\/usuario\.html\?u=:username"\s*\n\s*status = 200/.test(fuente))
  const meta = (await import('node:fs')).readFileSync(`${RAIZ}/netlify/edge-functions/meta-social.js`, 'utf8')
  check('meta-social atiende /tiendas/*', meta.includes("'/tiendas/*'"))
}

const TIENDA = { id: 'tienda-1', username: 'rincon', display_name: 'El Rincón', tipo: 'tienda', avatar_url: null }
const ESCAPARATE = { total: 0, en_escaparate: 0, de_tu_lista: 0, precios: true, facetas: {}, filas: [] }
const AGENDA = { total: 1, ciudades: { Bilbao: 1 }, tiendas: [{ user_id: 'tienda-1', username: 'rincon', display_name: 'El Rincón', avatar_url: null, ciudad: 'Bilbao', con_local: true, cartas: 12, productos: 0, de_tu_lista: 2 }] }
const b = await chromium.launch()
async function abrir(ruta, { tema = 'light', sesion = 'user-2', perfil = null } = {}) {
  const ctx = await b.newContext({ viewport: { width: 1360, height: 900 }, serviceWorkers: 'block' })
  await ctx.addInitScript(([s, t, a, e, p, tema]) => {
    window.__FAKE_SESSION__ = s
    window.__FAKE_PERFILES__ = [t]
    window.__RPC_RESPUESTAS__ = { tiendas_agenda: a, tienda_escaparate: e }
    window.__FAKE_FILAS__ = { tiendas: [{ user_id: 'tienda-1', ciudad: 'Bilbao', direccion: 'Calle 1', precio_visible: true }] }
    if (p) window.__FAKE_PERFIL__ = p
    try { localStorage.setItem('pokedoc-theme', tema); localStorage.setItem('pd-bienvenida-comunidad', '1') } catch {}
  }, [sesion, TIENDA, AGENDA, ESCAPARATE, perfil, tema])
  const p = await ctx.newPage()
  const errs = []
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)))
  await p.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2400)
  return { p, ctx, errs }
}
// Lo que se ve del nombre: su color, su fondo y si su ::after dibuja la tienda.
const nombre = (p, sel) => p.evaluate((sel) => {
  const el = document.querySelector(sel)
  if (!el) return null
  const cs = getComputedStyle(el), dp = getComputedStyle(el, '::after')
  let fondo = el, bg = 'rgba(0, 0, 0, 0)'
  while (fondo && /rgba\(0, 0, 0, 0\)|transparent/.test(bg)) { bg = getComputedStyle(fondo).backgroundColor; fondo = fondo.parentElement }
  return { texto: el.textContent.trim(), color: cs.color, fondo: bg, peso: cs.fontWeight, icono: (dp.maskImage || dp.webkitMaskImage || '').includes('svg'), ancho: parseFloat(dp.width), titulo: el.getAttribute('title') }
}, sel)
const lum = (c) => { const [r, g, bb] = c.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number).map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * bb }
const contraste = (a, c) => { const x = lum(a), y = lum(c); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) }

console.log('── 3. El escaparate en /tiendas/<usuario> ──')
for (const tema of ['light', 'dark']) {
  const { p, ctx, errs } = await abrir('/tiendas/rincon', { tema })
  const n = await nombre(p, 'h1[data-nombre-tienda]')
  const quiere = tema === 'dark' ? 'rgb(60, 200, 192)' : 'rgb(10, 116, 128)'
  check(`${tema}: abre su escaparate con el nombre en verde azulado y la tienda detrás`, n && n.texto === 'El Rincón' && n.color === quiere && n.icono && n.ancho > 8, JSON.stringify(n))
  check(`${tema}: se lee (contraste ≥ 4,5)`, n && contraste(n.color, n.fondo) >= 4.5, n && `${contraste(n.color, n.fondo).toFixed(2)} sobre ${n.fondo}`)
  check(`${tema}: la dirección se queda en /tiendas/rincon`, new URL(p.url()).pathname === '/tiendas/rincon', p.url())
  check(`${tema}: sin errores`, !errs.length, errs.join(' | '))
  await ctx.close()
}
{
  const { p, ctx } = await abrir('/usuario/rincon?utm_source=qr')
  check('/usuario/<tienda> sin servidor: la barra pasa a /tiendas/rincon con su consulta', new URL(p.url()).pathname === '/tiendas/rincon' && new URL(p.url()).search === '?utm_source=qr', p.url())
  await ctx.close()
}
{
  const { p, ctx, errs } = await abrir('/tiendas/rincon', { sesion: 'tienda-1', perfil: TIENDA })
  check('la propia tienda abre su escaparate en la dirección nueva (no la echa a /tienda)', new URL(p.url()).pathname === '/tiendas/rincon', p.url())
  check('  sin errores', !errs.length, errs.join(' | '))
  await ctx.close()
}

console.log('── 4. La agenda y el Mercado ──')
{
  const { p, ctx } = await abrir('/tiendas')
  const enlace = await p.evaluate(() => document.querySelector('#tiendasAgenda a[href*="rincon"]')?.getAttribute('href'))
  check('la agenda enlaza a /tiendas/rincon (con lo de tu lista)', enlace === '/tiendas/rincon?lista=1', enlace)
  const n = await nombre(p, '#tiendasAgenda .tag-nombre')
  check('y su nombre va pintado como tienda', n && n.icono && n.titulo === 'Tienda' && n.color === 'rgb(10, 116, 128)', JSON.stringify(n))
  await ctx.close()
}
{
  const { p, ctx } = await abrir('/tiendas')
  const urls = await p.evaluate(async () => { const m = await import('/js/app.js'); return [m.profileUrl({ username: 'rincon', tipo: 'tienda' }), m.profileUrl({ username: 'misty', tipo: 'persona' })] })
  check('profileUrl: tienda a /tiendas/, persona a /usuario/', urls[0] === '/tiendas/rincon' && urls[1] === '/usuario/misty', urls.join(' '))
  await ctx.close()
  const { enlaceDeTienda } = await import(`${RAIZ}/js/en-tiendas.js`).catch(() => ({}))
  if (enlaceDeTienda) check('«Su tienda» en las tarjetas de una carta va a /tiendas/', enlaceDeTienda({ username: 'rincon' }, 'c1') === '/tiendas/rincon?carta=c1')
}

await b.close()
console.log(fails ? `\n${fails} FALLOS` : '\nTodo en verde')
process.exit(fails ? 1 : 0)
