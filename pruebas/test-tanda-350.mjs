// Tanda 350 — los correos: duplicados, enlaces y verlos todos.
//
// PINGU: «los correos de resumen semanal se duplican y llegan varias
// veces. Además, quiero ver todos los correos que mandamos y hacerlos
// más visuales... hay algunos que el botón no funciona».
import { readFileSync } from 'node:fs'
import {
  EJEMPLOS_DE_CORREO,
  renderFilaDeCola,
  textosDeTipo,
  familiaDeTipo,
} from '/home/user/pingu/js/email-plantilla.js'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 200) : ''}`)
}
const leer = (f) => readFileSync(`/home/user/pingu/${f}`, 'utf8')
const SITIO = 'https://pokedoc.es'
const BAJA = `${SITIO}/baja-correo?t=x`

// ═════════════════════════════════════════════════════════════════════
// 1. LOS DUPLICADOS
// ═════════════════════════════════════════════════════════════════════
//
// Se hace correr la función de envío de verdad contra una red de
// mentira, porque lo que falla no es una cadena: es el ORDEN en que
// pasan las cosas. Mandar y marcar después deja la fila en `pending` en
// medio, y la pasada siguiente la vuelve a mandar.
console.log('\n── 1. Una fila reclamada no se manda dos veces ──')
{
  const originalFetch = globalThis.fetch
  const originalEnv = { ...process.env }

  // Una cola de una sola fila, con su estado, como la tendría Postgres.
  function montarRed({ reclamoGana = true }) {
    const enviados = []
    const patches = []
    globalThis.fetch = async (url, opciones = {}) => {
      const u = String(url)
      const metodo = (opciones.method || 'GET').toUpperCase()
      const json = (cuerpo) => new Response(JSON.stringify(cuerpo), { status: 200, headers: { 'content-type': 'application/json' } })

      // El rescate de lo que se quedó a medias: nada.
      if (u.includes('status=eq.sending')) return json([])
      // Los candidatos.
      if (metodo === 'GET' && u.includes('email_outbox?status=eq.pending')) return json([{ id: '11111111-1111-1111-1111-111111111111' }])
      // EL RECLAMO. Si otra pasada llegó antes, PostgREST no encuentra
      // ninguna fila `pending` con ese id y devuelve la lista vacía.
      if (metodo === 'PATCH' && u.includes('status=eq.pending')) {
        return json(reclamoGana
          ? [{ id: '11111111-1111-1111-1111-111111111111', recipient_id: 'u1', type: 'weekly_digest', subject: 'Lo mejor de PokeDoc esta semana', preview: '{"temas":[]}', link: '/foro', attempts: 0 }]
          : [])
      }
      if (u.includes('/auth/v1/admin/users/')) return json({ email: 'pingu@example.com', email_confirmed_at: '2026-01-01T00:00:00Z' })
      if (u.includes('user_profiles')) return json([{ email_unsubscribe_token: 'tok' }])
      if (u.includes('api.resend.com')) {
        enviados.push(JSON.parse(opciones.body))
        return json({ id: 'x' })
      }
      if (metodo === 'PATCH') {
        patches.push({ u, cuerpo: JSON.parse(opciones.body) })
        return new Response(null, { status: 204 })
      }
      return json([])
    }
    return { enviados, patches }
  }

  process.env.SUPABASE_SERVICE_ROLE_KEY = 'servicio'
  process.env.EMAIL_PROVIDER = 'resend'
  process.env.EMAIL_API_KEY = 'apikey'
  process.env.SITE_URL = SITIO

  const { default: enviar } = await import('/home/user/pingu/netlify/functions/send-emails.mjs')

  const gana = montarRed({ reclamoGana: true })
  const r1 = await (await enviar()).json()
  check('la pasada que reclama, manda', gana.enviados.length === 1 && r1.enviados === 1,
    `enviados=${gana.enviados.length} ${JSON.stringify(r1)}`)
  check('…y marca la fila como enviada',
    gana.patches.some((p) => p.cuerpo.status === 'sent'), JSON.stringify(gana.patches.map((p) => p.cuerpo)))
  check('…soltando el reclamo', gana.patches.some((p) => 'claimed_at' in p.cuerpo && p.cuerpo.claimed_at === null))

  // La segunda pasada: la fila ya no está `pending`, así que el UPDATE
  // no se lleva nada. Este es el caso que antes duplicaba el correo.
  const pierde = montarRed({ reclamoGana: false })
  const r2 = await (await enviar()).json()
  check('la pasada que NO reclama, no manda nada', pierde.enviados.length === 0 && r2.enviados === 0,
    `enviados=${pierde.enviados.length} ${JSON.stringify(r2)}`)

  globalThis.fetch = originalFetch
  process.env = originalEnv
}

console.log('\n── 2. Y lo que no da tiempo vuelve a la cola ──')
{
  const js = leer('netlify/functions/send-emails.mjs')
  // Netlify mata una función programada a los 30 segundos. Sin
  // presupuesto, morir a mitad deja filas reclamadas que hay que
  // esperar a rescatar.
  check('hay presupuesto de tiempo', /PRESUPUESTO_MS/.test(js) && /Date\.now\(\) - arranque > PRESUPUESTO_MS/.test(js))
  check('…y es menor que el tope de Netlify', Number((js.match(/const PRESUPUESTO_MS = (\d+)/) || [])[1]) < 30000)
  check('lo reclamado hace rato se rescata', /RESCATE_MINUTOS/.test(js) && /status=eq\.sending/.test(js))
  // Y si la migración no está puesta, `sending` no existe: el envío no
  // puede pararse del todo por eso.
  check('sin la migración sigue mandando como antes', /reclamando = false/.test(js))
}

// ═════════════════════════════════════════════════════════════════════
// 3. TODOS LOS CORREOS, Y QUE SE VEAN
// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. Los dieciséis correos ──')
{
  const tipos = EJEMPLOS_DE_CORREO.map((e) => e.type)
  check('hay un ejemplo de cada uno', tipos.length >= 16, String(tipos.length))
  check('sin repetidos', new Set(tipos).size === tipos.length)

  // Que no falte ninguno de los que la web ofrece apagar: un correo que
  // se manda y no está en esta lista es un correo que nadie repasa.
  const notif = leer('js/notifications.js')
  const bloque = notif.slice(notif.indexOf('EMAIL_TYPES = {'), notif.indexOf('EMAIL_TYPES_EQUIPO'))
  const ofrecidos = [...bloque.matchAll(/^\s{2}([a-z_]+):/gm)].map((m) => m[1])
  const sinEjemplo = ofrecidos.filter((t) => !tipos.includes(t))
  check('están todos los que la web ofrece', sinEjemplo.length === 0, sinEjemplo.join(', '))

  const malos = []
  for (const ej of EJEMPLOS_DE_CORREO) {
    const { html, text, subject } = renderFilaDeCola(ej, { siteUrl: SITIO, unsubscribeUrl: BAJA })
    const { cta, pie } = textosDeTipo(ej.type)
    if (!subject) malos.push(`${ej.type}: sin asunto`)
    // El botón: si el enlace no vale, `absoluteUrl` devuelve null y el
    // correo sale SIN botón. Un enlace mal escrito se ve aquí.
    if (!html.includes(`${SITIO}`)) malos.push(`${ej.type}: el enlace no llega al correo`)
    if (!familiaDeTipo(ej.type)) malos.push(`${ej.type}: sin etiqueta de familia`)
    if (cta === 'Verlo en PokeDoc') malos.push(`${ej.type}: verbo genérico`)
    if (!html.includes(pie) && ej.type !== 'weekly_digest') malos.push(`${ej.type}: sin motivo en el pie`)
    if (!html.includes('Dejar de recibir')) malos.push(`${ej.type}: sin baja`)
    if (!text.includes(SITIO)) malos.push(`${ej.type}: la versión en texto no lleva la dirección`)
  }
  check('todos pintan enteros', malos.length === 0, malos.join(' | '))
}

console.log('\n── 4. El botón que no funciona ──')
{
  const { html } = renderFilaDeCola(EJEMPLOS_DE_CORREO[0], { siteUrl: SITIO, unsubscribeUrl: BAJA })
  // Un botón es un enlace con fondo, y hay clientes que se comen el
  // fondo o el enlace. Con la dirección escrita al lado siempre hay por
  // dónde entrar — y se ve adónde lleva antes de pulsar.
  check('la dirección va también en claro', /copia esta dirección/.test(html))
  check('y el botón es una celda, no un <span> con fondo',
    /background-color:#1e5175;border-radius:8px/.test(html))
  // El de la guía rechazada llevaba a /perfil.html: «búscala tú».
  const rechazada = EJEMPLOS_DE_CORREO.find((e) => e.type === 'guide_rejected')
  check('la guía rechazada abre SU guía en el editor',
    /^\/editor-guia\.html\?id=/.test(rechazada.link), rechazada.link)
  const sql = leer('supabase-migration-correo-enlaces.sql')
  check('…y el disparador también', /'\/editor-guia\.html\?id=' \|\| new\.id::text/.test(sql))
  check('el editor toma id y no slug', /params\.get\('id'\)/.test(leer('js/editor-guia.js')))
}

console.log('\n── 5. /admin los pinta con la MISMA plantilla ──')
{
  const admin = leer('admin/js/admin.js')
  check('importa el módulo del envío', /from '\.\.\/\.\.\/js\/email-plantilla\.js'/.test(admin))
  check('…y no se copia la plantilla', !/<!doctype html>/i.test(admin))
  check('la sección existe', /id="section-correos"/.test(leer('admin/index.html')))
  check('el correo va en un iframe aislado', /sandbox=""/.test(admin) && /srcdoc/.test(admin))
  // Y la cola se mira con recuentos, no leyendo los correos de nadie.
  const sql = leer('supabase-migration-correo-envio.sql')
  check('la cola se resume sin destinatarios',
    /create or replace function public\.email_outbox_resumen/.test(sql) && !/recipient_id/.test(sql.slice(sql.indexOf('email_outbox_resumen'))))
  check('…y solo para el admin', /p\.is_admin = true/.test(sql))
  // Y el envío sigue pidiéndole la plantilla a donde siempre.
  check('netlify/lib/email.mjs la reexporta',
    /export \* from '\.\.\/\.\.\/js\/email-plantilla\.js'/.test(leer('netlify/lib/email.mjs')))
}

console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
