// Tanda 1167 — M2 y M3 de «PokeDoc entera»: el perfil de otra persona,
// compacto en el móvil (lo que vienes a ver antes del 40 %, tu propio perfil
// sin cambios); y Mensajes sin conversaciones dice con quién podrías hablar
// (tiene lo que buscas, la sigues, en tu torneo), con «Escribirle».
import { chromium, contexto, BASE } from './fixtures-app.mjs'
import { sugerir } from '/home/user/pingu/js/mensajes-sugeridos-puro.js'

let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

console.log('── M3, puro: a quién se sugiere y por qué ──')
{
  const r = sugerir({
    tienen: [{ user_id: 'u2', username: 'misty', card_id: 'a' }, { user_id: 'u2', username: 'misty', card_id: 'b' }, { user_id: 'u3', username: 'brock', card_id: 'a' }],
    seguidas: [{ user_id: 'u2', username: 'misty' }, { user_id: 'u4', username: 'lance' }],
    torneos: [{ user_id: 'u5', username: 'cynthia', torneo: 'Copa Delta Reign' }, { user_id: 'u3', username: 'brock', torneo: 'Copa' }, { user_id: 'yo', username: 'ash', torneo: 'Copa' }],
    yo: 'yo',
  })
  check('cruces primero (más cartas antes), luego seguidas, luego torneo; sin repetir ni a ti', r.map((p) => `${p.username}:${p.motivo}`).join(' | ') === 'misty:tiene 2 cartas que buscas | brock:tiene 1 carta que buscas | lance:la sigues | cynthia:en Copa Delta Reign contigo', JSON.stringify(r))
  check('como mucho seis', sugerir({ seguidas: [...Array(9)].map((_, i) => ({ user_id: 'p' + i, username: 'p' + i })) }).length === 6)
}

const b = await chromium.launch()
const abrir = async (ruta, movil, extra = null) => {
  const ctx = await contexto(b, movil, 'user-1', extra)
  const p = await ctx.newPage()
  if (!movil) await p.setViewportSize({ width: 1280, height: 800 })
  const errores = []
  p.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await p.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(3000)
  return { p, ctx, errores }
}

console.log('── M2: el perfil de otra persona en el móvil ──')
{
  const { p, ctx, errores } = await abrir('/usuario/Misty', true)
  check('sin errores', errores.length === 0, errores.join(' | '))
  const r = await p.evaluate(() => {
    const m = (s) => { const e = document.querySelector(s); return e ? Math.round(e.getBoundingClientRect().height) : null }
    const botones = [...document.querySelectorAll('.perfil-acciones > *')].filter((x) => x.getBoundingClientRect().width > 0)
    const cifras = [...document.querySelectorAll('#profileStats .perfil-losa')].map((x) => Math.round(x.getBoundingClientRect().top))
    return { banner: m('.profile-hero-banner, .profile-hero-banner-vacio'), avatar: m('.profile-hero-avatar'), botones: botones.map((x) => Math.round(x.getBoundingClientRect().width)), botonesMismaLinea: new Set(botones.map((x) => Math.round(x.getBoundingClientRect().top))).size === 1, cifrasUnaLinea: new Set(cifras).size === 1, losas: Math.round(document.getElementById('profileStats').getBoundingClientRect().top), tabs: Math.round(document.getElementById('profileTabs').getBoundingClientRect().top), contenido: Math.round(document.querySelector('.tab-panel.active').getBoundingClientRect().top), vh: innerHeight, nombre: document.querySelector('.profile-hero-info h1')?.textContent.trim(), desborda: document.documentElement.scrollWidth > innerWidth }
  })
  check('banner de 56 y avatar de 48', r.banner === 56 && r.avatar === 48, JSON.stringify(r))
  check('los dos botones a media anchura, en una línea; las cifras en una fila', r.botones.length === 2 && r.botonesMismaLinea && Math.abs(r.botones[0] - r.botones[1]) < 8 && r.cifrasUnaLinea, JSON.stringify(r))
  // Desde la 1270 lo primero que se viene a ver son las tres losas (colección,
  // guías, torneos), y las pestañas van debajo de ellas y de la tarjeta de cambios.
  check('1270: las losas (lo que vienes a ver) antes del 40 %', r.losas < r.vh * 0.4, JSON.stringify(r))
  check('el nombre sigue siendo el título, y nada desborda', r.nombre === 'Misty' && !r.desborda, JSON.stringify(r))
  await ctx.close()
  const propio = await abrir('/perfil', true)
  const q = await propio.p.evaluate(() => { const e = document.querySelector('.profile-hero-banner, .profile-hero-banner-vacio'); return Math.round(e.getBoundingClientRect().height) })
  check('tu propio perfil no cambia (banner de 88, la 1040)', q === 88, q)
  await propio.ctx.close()
}

console.log('── M3: Mensajes sin conversaciones ──')
{
  const { p, ctx, errores } = await abrir('/mensajes', false)
  check('PC sin errores', errores.length === 0, errores.join(' | '))
  const r = await p.evaluate(() => ({ titulo: document.querySelector('.msg-sugeridos-titulo')?.textContent.trim(), gente: [...document.querySelectorAll('.msg-sugerido')].map((x) => ({ nombre: x.querySelector('.msg-sugerido-nombre').textContent.trim(), motivo: x.querySelector('.msg-sugerido-motivo').textContent.trim(), href: x.querySelector('a').getAttribute('href') })), lista: document.querySelector('#msgLista')?.innerText.replace(/\s+/g, ' ').trim(), nueva: Boolean(document.querySelector('#messagesRoot a.btn-primary[href="/mensajes.html?new=1"]')) }))
  check('«Con quién podrías hablar» con gente y su motivo', r.titulo === 'Con quién podrías hablar' && r.gente.length >= 2 && r.gente.every((g) => g.nombre && g.motivo), JSON.stringify(r))
  check('  …la que sigues sale («la sigues») y cada una con «Escribirle» a su conversación', r.gente.some((g) => g.motivo === 'la sigues') && r.gente.every((g) => /^\/mensajes\.html\?with=/.test(g.href)), JSON.stringify(r.gente))
  check('  …y la lista ya no manda a «la lista»: dice que empieces por alguien de la derecha', /Empieza por alguien de la derecha/.test(r.lista) && r.nueva, r.lista)
  await ctx.close()
  const m = await abrir('/mensajes', true)
  const s = await m.p.evaluate(() => ({ gente: document.querySelectorAll('.msg-sugerido').length, desborda: document.documentElement.scrollWidth > innerWidth }))
  check('en el móvil también, bajo el vacío, sin desbordar', s.gente >= 2 && !s.desborda, JSON.stringify(s))
  await m.ctx.close()
}
await b.close()
console.log(fails ? `\n${fails} FALLOS` : '\nTODO OK')
process.exit(fails ? 1 : 0)
