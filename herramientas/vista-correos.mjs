import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { renderFilaDeCola } from '/home/user/pingu/netlify/lib/email.mjs'
import { writeFileSync } from 'node:fs'

const SC = '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad/correos'
const sitio = 'https://pokedoc.es'
const baja = (t) => `https://pokedoc.es/baja-correo?t=abc&tipo=${t}`

const CASOS = [
  ['torneo_apertura', 'Inscripciones abiertas — Copa Inaugural PokeDoc', 'Se juega el viernes 4 de septiembre a las 19:00 · 3 rondas suizas BO1 · 16 plazas. Apúntate y deja lista tu decklist antes de que empiece.', 'https://pokedoc.es/torneo?slug=copa-inaugural'],
  ['torneo_ronda', 'Ronda 1 en marcha — Copa Inaugural PokeDoc', 'Tu mesa ya está puesta. Entra, juega y avisa del resultado cuando terminéis.', 'https://pokedoc.es/torneo?slug=copa-inaugural'],
  ['torneo_recordatorio', '«Copa Inaugural PokeDoc» empieza en menos de una hora', 'Ten TCG Live abierto y tu decklist lista. Entra a la ficha cuando empiece para ver tu mesa.', 'https://pokedoc.es/torneo?slug=copa-inaugural'],
  ['forum_reply', 'Ash ha respondido en «¿Esta Pikachu es legal?»', 'Yo esa la tengo y me la dieron por buena en la liga, aunque el borde tira a mate.', '/tema/42'],
  ['private_message', 'Misty te ha escrito', '¿Te viene bien cambiar el Dragapult por los dos Martillos mañana?', '/mensajes.html?c=7'],
  ['new_follower', 'Brock ha empezado a seguirte', 'Colecciono desde Base Set. Sobre todo Onix y cualquier cosa de tipo roca.', '/usuario/brock'],
]

const nav = await chromium.launch()
const pag = await (await nav.newContext({ deviceScaleFactor: 1, viewport: { width: 620, height: 900 } })).newPage()

for (const [tipo, subject, preview, link] of CASOS) {
  const { html } = renderFilaDeCola({ type: tipo, subject, preview, link }, { siteUrl: sitio, unsubscribeUrl: baja(tipo) })
  writeFileSync(`${SC}/${tipo}.html`, html)
  await pag.setContent(html, { waitUntil: 'domcontentloaded' })
  await pag.screenshot({ path: `${SC}/${tipo}.png`, fullPage: true })
  console.log('pintado', tipo)
}

// El resumen semanal, que lleva plantilla propia.
const semanal = renderFilaDeCola(
  { type: 'weekly_digest', subject: 'x', preview: JSON.stringify({
      temas: [
        { id: 11, titulo: '¿Merece la pena el Elite Trainer Box de Mega Evolution?', mensajes: 23 },
        { id: 12, titulo: 'Mi Dragapult de liga: dudas con la línea de Dusknoir', mensajes: 14 },
        { id: 13, titulo: 'Hilo de intercambios de septiembre', mensajes: 9 },
      ],
      guia: { titulo: 'Cómo leer una marca de regulación', slug: 'marcas-de-regulacion' },
    }), link: null },
  { siteUrl: sitio, unsubscribeUrl: baja('weekly_digest') }
)
writeFileSync(`${SC}/weekly_digest.html`, semanal.html)
await pag.setContent(semanal.html, { waitUntil: 'domcontentloaded' })
await pag.screenshot({ path: `${SC}/weekly_digest.png`, fullPage: true })
console.log('pintado weekly_digest')

await nav.close()
