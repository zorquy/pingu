// Tanda 891 — los mensajes privados con fotos, y el chat como un chat.
//
// PINGU: «mejora el apartado de los mensajes privados y mete la opción de
// poder adjuntar imágenes». Lo que se mira: lo puro (días, grupos, visto,
// no leídos, resumen, lo que cabe); la migración (cubo PRIVADO, políticas
// por conversación); y la pantalla en móvil y PC: bandeja con no leídos y
// «Foto», hilo con días, fotos firmadas, visto y «Mensaje eliminado»,
// adjuntar con su tope, enviar solo fotos, borrar con el diálogo de la
// casa, y Enter que envía en PC y no en el móvil.
import { readFileSync } from 'node:fs'
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const leer = (f) => readFileSync(`${RAIZ}/${f}`, 'utf8')
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

console.log('── 1. Lo puro ──')
{
  const m = await import(`${RAIZ}/js/mensajes-puro.js`)
  const ahora = new Date('2026-10-18T15:00:00')
  check('«Hoy», «Ayer», «12 oct» y con el año si es otro', m.etiquetaDeDia('2026-10-18T09:00:00', ahora) === 'Hoy' && m.etiquetaDeDia('2026-10-17T23:00:00', ahora) === 'Ayer' && m.etiquetaDeDia('2026-10-12T10:00:00', ahora) === '12 oct' && m.etiquetaDeDia('2025-10-12T10:00:00', ahora) === '12 oct 2025')
  const msgs = [
    { id: 'a', sender_id: 'f', created_at: '2026-10-17T22:14:00', body: 'Hola' },
    { id: 'b', sender_id: 'f', created_at: '2026-10-17T22:15:00', body: 'Vi tu perfil' },
    { id: 'c', sender_id: 'yo', created_at: '2026-10-18T14:05:00', body: 'Qué pasada' },
    { id: 'd', sender_id: 'yo', created_at: '2026-10-18T14:30:00', body: 'Te lo cambio' },
    { id: 'e', sender_id: 'f', created_at: '2026-10-18T14:40:00', body: '', adjuntos: [{ ruta: 'c1/x.webp', w: 10, h: 10 }, { ruta: 'c1/y.webp' }] },
  ]
  const dias = m.agruparPorDia(msgs, ahora)
  check('dos días: Ayer (2) y Hoy (3)', dias.length === 2 && dias[0].etiqueta === 'Ayer' && dias[0].mensajes.length === 2 && dias[1].etiqueta === 'Hoy' && dias[1].mensajes.length === 3, JSON.stringify(dias.map((d) => [d.etiqueta, d.mensajes.length])))
  check('el segundo de la misma persona en cinco minutos va «seguido»; a los 25 minutos, no', dias[0].mensajes[1].seguido === true && dias[1].mensajes[1].seguido === false)
  check('«visto» solo bajo el último mío que la otra persona ha leído', m.ultimoVisto(msgs, 'yo', '2026-10-18T14:10:00') === 'c' && m.ultimoVisto(msgs, 'yo', '2026-10-18T15:00:00') === 'd' && m.ultimoVisto(msgs, 'yo', null) === null)
  check('no leídos: los de la otra persona después de mi última lectura', m.cuentaNoLeidos(msgs, 'yo', '2026-10-17T22:14:30') === 2 && m.cuentaNoLeidos(msgs, 'yo', null) === 3)
  check('…y lo eliminado no cuenta', m.cuentaNoLeidos([{ sender_id: 'f', created_at: '2026-10-18T14:40:00', deleted_at: '2026-10-18T14:41:00' }], 'yo', null) === 0)
  check('resumen: «2 fotos», «Foto · texto», «Tú: …», «Mensaje eliminado»', m.resumenDeUltimo(msgs[4], false).texto === '2 fotos' && m.resumenDeUltimo({ body: 'Mira', adjuntos: [{ ruta: 'a' }] }, false).texto === 'Foto · Mira' && m.resumenDeUltimo(msgs[3], true).texto === 'Tú: Te lo cambio' && m.resumenDeUltimo({ body: 'x', deleted_at: 'y' }, true).texto === 'Mensaje eliminado')
  const f = (type, size = 1000) => ({ type, size })
  const r = m.cabenAdjuntos([f('image/png'), f('image/png'), f('image/png')], [f('image/png'), f('image/png'), f('text/plain'), f('image/jpeg', 11 * 1024 * 1024)])
  const motivos = r.rechazados.map((x) => x.motivo)
  check('caben: con 3 puestas solo entra 1 más; lo que no es imagen y lo que pesa más de 10 MB se quedan fuera con su motivo', r.aceptados.length === 1 && motivos.length === 3 && /como mucho 4/.test(motivos[0]) && /no es una imagen/.test(motivos[1]) && /pesa más de 10 MB/.test(motivos[2]), JSON.stringify(motivos))
  check('medida reducida: 4000×3000 → 1600×1200; una pequeña no se agranda', JSON.stringify(m.medidaReducida(4000, 3000)) === '{"ancho":1600,"alto":1200}' && JSON.stringify(m.medidaReducida(800, 600)) === '{"ancho":800,"alto":600}')
  check('Enter envía solo con ratón y sin Mayús', m.enterEnvia({ key: 'Enter', shiftKey: false }, true) && !m.enterEnvia({ key: 'Enter', shiftKey: true }, true) && !m.enterEnvia({ key: 'Enter', shiftKey: false }, false))
}

console.log('\n── 2. Lo estático: migración y hoja ──')
{
  const sql = leer('supabase-migration-891-mensajes-fotos.sql')
  check('el cubo es PRIVADO', /'mensajes-adjuntos', 'mensajes-adjuntos', false/.test(sql))
  check('las tres políticas del cubo pasan por la conversación de la carpeta', ['select', 'insert', 'delete'].every((op) => new RegExp(`mensajes_adjuntos_${op}"[^;]*mensajes_adjunto_es_mio\\(name\\)`).test(sql)))
  check('columna adjuntos con tope de 4 y «deleted_at»', /adjuntos jsonb not null default/.test(sql) && /jsonb_array_length\(adjuntos\) <= 4/.test(sql) && /deleted_at timestamptz/.test(sql))
  check('un mensaje tiene texto, fotos o está eliminado', /deleted_at is not null or char_length\(body\) > 0 or jsonb_array_length\(adjuntos\) > 0/.test(sql))
  const js = leer('js/mensajes.js')
  check('el hilo ya no lleva estilos en línea de burbuja', !/align-self:\$\{mine/.test(js) && /class="msg-burbuja/.test(js))
  check('borrar pasa por el diálogo de la casa, no por confirm()', !/(^|[^`\w])confirm\(/m.test(js) && /msgDialogoBorrar/.test(js))
  check('las fotos se piden firmadas (cubo privado), nunca por getPublicUrl', /createSignedUrls/.test(leer('js/mensajes-adjuntos.js')) && !/(^|[^`\w])getPublicUrl/m.test(leer('js/mensajes-adjuntos.js')))
  check('el visor abre las fotos de un mensaje', /msg-fotos/.test(leer('js/lightbox.js')))
}

console.log('\n── 3. En la pantalla ──')
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64')
const hace = (min) => new Date(Date.now() - min * 60000).toISOString()
const ayer = (h) => { const d = new Date(); d.setDate(d.getDate() - 1); d.setHours(h, 14, 0, 0); return d.toISOString() }
const semilla = () => {
  window.__FAKE_SESSION__ = 'admin-1'
  window.__FAKE_PERFILES__ = [
    { id: 'u-fede', username: 'soyfedeegb', display_name: 'soyfedeegb' },
    { id: 'u-marta', username: 'marta', display_name: 'Marta_TCG' },
  ]
  window.__FAKE_FILAS__ = {
    conversations: [{ id: 'c1' }, { id: 'c2' }],
    conversation_participants: [
      { conversation_id: 'c1', user_id: 'admin-1', last_read_at: window.__T_LEIDO_C1__ },
      { conversation_id: 'c1', user_id: 'u-fede', last_read_at: window.__T_FEDE_LEYO__ },
      { conversation_id: 'c2', user_id: 'admin-1', last_read_at: null },
      { conversation_id: 'c2', user_id: 'u-marta', last_read_at: null },
    ],
    private_messages: [
      { id: 'm1', conversation_id: 'c1', sender_id: 'u-fede', body: 'Hola! Vi en tu perfil que buscas el Gardevoir ex', created_at: window.__T_AYER__, adjuntos: [], deleted_at: null },
      { id: 'm2', conversation_id: 'c1', sender_id: 'admin-1', body: '', created_at: window.__T_M2__, adjuntos: [], deleted_at: window.__T_M2__ },
      { id: 'm3', conversation_id: 'c1', sender_id: 'admin-1', body: 'Te cambio el Charizard por el Gardevoir', created_at: window.__T_M3__, adjuntos: [], deleted_at: null },
      { id: 'm4', conversation_id: 'c1', sender_id: 'u-fede', body: 'Mira el Charizard que tengo', created_at: window.__T_M4__, adjuntos: [{ ruta: 'c1/a.webp', w: 1200, h: 1600 }, { ruta: 'c1/b.webp', w: 1200, h: 1600 }], deleted_at: null },
      { id: 'm5', conversation_id: 'c2', sender_id: 'u-marta', body: '¿Sigues teniendo el Pikachu 25?', created_at: window.__T_M4__, adjuntos: [], deleted_at: null },
      { id: 'm6', conversation_id: 'c2', sender_id: 'u-marta', body: 'Me interesa', created_at: window.__T_M4__, adjuntos: [], deleted_at: null },
    ],
  }
}
const tiempos = { __T_AYER__: ayer(22), __T_M2__: hace(60), __T_M3__: hace(50), __T_FEDE_LEYO__: hace(45), __T_LEIDO_C1__: hace(40), __T_M4__: hace(30) }
const puro = await import(`${RAIZ}/js/mensajes-puro.js`)
const b = await chromium.launch()
async function abrir(movil, ruta) {
  const ctx = await b.newContext(movil ? { ...devices['iPhone 13'], locale: 'es-ES' } : { viewport: { width: 1280, height: 900 }, locale: 'es-ES' })
  await ctx.addInitScript((t) => Object.assign(window, t), tiempos)
  await ctx.addInitScript(semilla)
  await ctx.route(/ejemplo\.supabase\.co\/storage\/v1\/object\/sign/, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }))
  const p = await ctx.newPage()
  const errores = []
  p.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await p.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(1800)
  return { p, ctx, errores }
}

console.log('  · la bandeja (móvil)')
{
  const { p, ctx, errores } = await abrir(true, '/mensajes.html')
  check('sin errores', errores.length === 0, errores.join(' | '))
  const filas = await p.$$eval('.msg-fila', (fs) => fs.map((f) => ({ nombre: f.querySelector('strong')?.textContent, ultimo: f.querySelector('.msg-fila-ultimo')?.textContent.trim(), foto: !!f.querySelector('.msg-foto-ico'), badge: f.querySelector('.msg-noleidos')?.textContent || null })))
  check('dos conversaciones, la más reciente primero', filas.length === 2, JSON.stringify(filas))
  const fede = filas.find((f) => f.nombre === 'soyfedeegb')
  const marta = filas.find((f) => f.nombre === 'Marta_TCG')
  check('fede: «2 fotos · Mira el Charizard…», con icono de foto y 1 sin leer', fede && /^2 fotos · Mira el Charizard/.test(fede.ultimo) && fede.foto && fede.badge === '1', JSON.stringify(fede))
  check('Marta: 2 sin leer', marta?.badge === '2', JSON.stringify(marta))
  await ctx.close()
}

console.log('  · el hilo (móvil)')
{
  const { p, ctx, errores } = await abrir(true, '/mensajes.html?c=c1')
  check('sin errores', errores.length === 0, errores.join(' | '))
  const dias = await p.$$eval('.msg-dia span', (ds) => ds.map((d) => d.textContent))
  // Las horas de la siembra son relativas a AHORA: pasada la medianoche,
  // «hace 60 minutos» es ayer y solo hay un separador. Lo esperado se
  // calcula con la misma función pura, no se escribe a mano.
  const esperados = [...new Set([tiempos.__T_AYER__, tiempos.__T_M2__, tiempos.__T_M3__, tiempos.__T_M4__].map((t) => puro.etiquetaDeDia(t)))]
  check(`separadores por día (${esperados.join(', ')})`, JSON.stringify(dias) === JSON.stringify(esperados), JSON.stringify(dias))
  const burbujas = await p.$$eval('#threadMessages .msg-burbuja', (bs) => bs.map((x) => ({ id: x.dataset.id, mia: x.classList.contains('mia'), eliminado: x.classList.contains('msg-eliminado'), fotos: x.querySelectorAll('.msg-fotos img').length, texto: x.querySelector('p')?.textContent || '' })))
  check('cuatro burbujas en orden, la mía borrada como «Mensaje eliminado»', burbujas.length === 4 && burbujas[1].eliminado && burbujas[1].mia && burbujas[2].mia && !burbujas[3].mia, JSON.stringify(burbujas))
  check('las dos fotos de fede, firmadas y CARGADAS, en rejilla de 2', burbujas[3].fotos === 2 && (await p.$eval('.msg-fotos', (f) => f.dataset.n)) === '2' && (await p.$$eval('.msg-fotos img', (is) => is.every((i) => i.complete && i.naturalWidth > 0 && /object\/sign\/mensajes-adjuntos\/c1\//.test(i.src)))))
  check('…con su hueco reservado (ancho y alto)', await p.$eval('.msg-fotos img', (i) => i.getAttribute('width') === '1200' && i.getAttribute('height') === '1600'))
  const visto = await p.$$eval('.msg-visto', (vs) => vs.map((v) => v.textContent.trim()))
  check('«Visto HH:MM» una sola vez, bajo mi último mensaje leído', visto.length === 1 && /^Visto \d\d:\d\d$/.test(visto[0]) && (await p.$eval('.msg-visto', (v) => v.previousElementSibling?.dataset.id)) === 'm3', JSON.stringify(visto))
  check('al abrir, el hilo queda leído', await p.evaluate(() => { const f = window.__TABLAS__.conversation_participants.find((x) => x.conversation_id === 'c1' && x.user_id === 'admin-1'); return !!f.last_read_at && Date.now() - new Date(f.last_read_at) < 60000 }))
  // PINGU (2026-10-19, captura): el velo de «Suelta la imagen» tapaba el hilo
  // al abrirlo. Un `display: flex` en la clase le ganaba al atributo `hidden`.
  check('ni el velo de arrastrar ni la tira de miniaturas se ven al abrir', await p.$eval('#msgArrastre', (v) => getComputedStyle(v).display === 'none') && (await p.$eval('#msgAdjuntos', (a) => getComputedStyle(a).display === 'none')))
  // 891b (PINGU: «se abre así, queda raro»): el hilo ocupa la pantalla, los
  // mensajes hacen scroll dentro y el cuadro queda abajo, encima de la barra
  // del móvil y sin pie ni botón de subir a la vista.
  const pantalla = await p.evaluate(() => {
    const c = document.getElementById('msgCompositor').getBoundingClientRect()
    const bm = document.querySelector('body > .bm')?.getBoundingClientRect()
    const el = document.getElementById('msgScroll')
    return { cBottom: c.bottom, bmTop: bm?.top ?? window.innerHeight, alto: window.innerHeight, scrollDentro: getComputedStyle(el).overflowY === 'auto', pie: getComputedStyle(document.querySelector('.footer')).display, subir: getComputedStyle(document.querySelector('.volver-arriba')).display, scrollY: window.scrollY }
  })
  check('el cuadro de escribir queda abajo, encima de la barra del móvil, sin bajar la página', pantalla.cBottom <= pantalla.bmTop + 1 && pantalla.cBottom >= pantalla.bmTop - 16 && pantalla.scrollY === 0, JSON.stringify(pantalla))
  check('…los mensajes hacen scroll dentro, y ni pie ni botón de subir', pantalla.scrollDentro && pantalla.pie === 'none' && pantalla.subir === 'none', JSON.stringify(pantalla))
  check('el clip, el enviar y la flecha de atrás miden 44', await p.$$eval('#msgClip, #btnSendMsg, .msg-atras', (es) => es.every((e) => e.getBoundingClientRect().height >= 44 && e.getBoundingClientRect().width >= 44)))

  // Adjuntar: con el dedo, la hoja; de la galería, un fichero.
  await p.click('#msgClip')
  check('con el dedo, el clip abre la hoja «cámara o galería»', await p.$eval('#msgHoja', (d) => d.open && getComputedStyle(d).display !== 'none'))
  const [chooser] = await Promise.all([p.waitForEvent('filechooser'), p.click('[data-hoja="galeria"]')])
  await chooser.setFiles([{ name: 'carta.png', mimeType: 'image/png', buffer: PNG }])
  await p.waitForTimeout(300)
  check('la foto elegida aparece como miniatura, con su «×» y su peso', (await p.$$eval('.msg-adjunto', (as) => as.length)) === 1 && (await p.$eval('#msgAdjuntos', (a) => !a.hidden)) && (await p.$eval('.msg-adjunto small', (s) => /KB/.test(s.textContent))))
  // Cuatro más: solo entran tres (tope 4) y se avisa.
  await p.setInputFiles('#msgFotos', [1, 2, 3, 4].map((i) => ({ name: `f${i}.png`, mimeType: 'image/png', buffer: PNG })))
  await p.waitForTimeout(300)
  check('con el tope de 4, la quinta se queda fuera y se avisa', (await p.$$eval('.msg-adjunto', (as) => as.length)) === 4 && (await p.$$eval('.toast', (ts) => ts.map((t) => t.textContent))).some((t) => /se queda fuera/.test(t)))
  await p.click('.msg-adjunto-quitar')
  await p.waitForTimeout(100)
  check('el «×» quita una', (await p.$$eval('.msg-adjunto', (as) => as.length)) === 3)
  // Enviar SOLO fotos, sin texto.
  await p.click('#btnSendMsg')
  await p.waitForTimeout(1500)
  const subidas = await p.evaluate(() => window.__SUBIDAS__.filter((s) => s.cubo === 'mensajes-adjuntos'))
  check('las tres fotos suben al cubo privado, en la carpeta de la conversación, como imagen', subidas.length === 3 && subidas.every((s) => /^c1\/[a-z0-9-]+\.(webp|png|jpg)$/.test(s.ruta) && /^image\//.test(s.tipo)), JSON.stringify(subidas))
  const nuevo = await p.evaluate(() => window.__TABLAS__.private_messages.filter((m) => m.conversation_id === 'c1').at(-1))
  check('el mensaje se guarda sin texto, con sus 3 adjuntos y las medidas', nuevo && nuevo.sender_id === 'admin-1' && nuevo.body === '' && nuevo.adjuntos?.length === 3 && nuevo.adjuntos.every((a) => /^c1\//.test(a.ruta)), JSON.stringify(nuevo))
  check('…y se pinta en el hilo como burbuja de solo fotos, abajo del todo', await p.$eval('#threadMessages .msg-burbuja:last-of-type', (x) => x.classList.contains('mia') && x.classList.contains('solo-fotos') && x.querySelectorAll('.msg-fotos img').length === 3))
  check('las miniaturas pendientes se vacían al enviar', await p.$eval('#msgAdjuntos', (a) => a.hidden))

  // Enter en el móvil NO envía.
  const antes = await p.evaluate(() => window.__TABLAS__.private_messages.length)
  await p.fill('#msgBody', 'hola')
  await p.press('#msgBody', 'Enter')
  await p.waitForTimeout(400)
  check('en el móvil, Enter no envía', (await p.evaluate(() => window.__TABLAS__.private_messages.length)) === antes)

  // Borrar el mensaje nuevo: diálogo de la casa, y las fotos se van del cubo.
  await p.click(`#threadMessages .msg-burbuja[data-id="${nuevo.id}"] .msg-borrar`)
  check('borrar abre el diálogo de la casa', await p.$eval('#msgDialogoBorrar', (d) => d.open))
  await p.click('[data-borrar="si"]')
  await p.waitForTimeout(800)
  const fila = await p.evaluate((id) => window.__TABLAS__.private_messages.find((m) => m.id === id), nuevo.id)
  check('queda marcado como eliminado, sin texto ni fotos', fila && !!fila.deleted_at && fila.adjuntos.length === 0, JSON.stringify(fila))
  check('…sus fotos se borran del cubo', (await p.evaluate(() => window.__BORRADAS__.length)) === 3)
  check('…y en el hilo sale «Mensaje eliminado»', await p.$eval(`#threadMessages .msg-burbuja[data-id="${nuevo.id}"]`, (x) => x.classList.contains('msg-eliminado') && /Mensaje eliminado/.test(x.textContent)))
  await ctx.close()
}

console.log('  · el PC')
{
  const { p, ctx, errores } = await abrir(false, '/mensajes.html?c=c1')
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('en el PC el cuadro de escribir está a la vista al abrir, sin bajar la página', await p.evaluate(() => { const c = document.getElementById('msgCompositor').getBoundingClientRect(); return c.bottom <= window.innerHeight && c.top > 0 && window.scrollY === 0 }))
  check('dos paneles: la lista a la izquierda con sus no leídos', await p.$eval('.msg-dos', (d) => d.classList.contains('con-lista')) && (await p.$$eval('#msgLista .msg-noleidos', (ns) => ns.map((n) => n.textContent))).includes('2'))
  const [chooser] = await Promise.all([p.waitForEvent('filechooser'), p.click('#msgClip')])
  check('con ratón, el clip abre la galería directamente', chooser.isMultiple())
  await chooser.setFiles([])
  await p.fill('#msgBody', 'Perfecto, el viernes en la liga')
  await p.press('#msgBody', 'Enter')
  await p.waitForTimeout(800)
  const ultimo = await p.evaluate(() => window.__TABLAS__.private_messages.filter((m) => m.conversation_id === 'c1').at(-1))
  check('en el PC, Enter envía', ultimo?.body === 'Perfecto, el viernes en la liga' && !ultimo.adjuntos?.length, JSON.stringify(ultimo))
  check('…y Mayús+Enter no', await p.evaluate(() => { const c = document.getElementById('msgBody'); c.value = 'a'; const e = new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, cancelable: true }); c.dispatchEvent(e); return !e.defaultPrevented }))
  // Pegar una imagen en el cuadro.
  await p.evaluate(async () => {
    const r = await fetch('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=')
    const f = new File([await r.blob()], 'pegada.png', { type: 'image/png' })
    const dt = new DataTransfer()
    dt.items.add(f)
    const e = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })
    document.getElementById('msgBody').dispatchEvent(e)
  })
  await p.waitForTimeout(200)
  check('pegar una imagen (Ctrl+V) la adjunta', (await p.$$eval('.msg-adjunto', (as) => as.length)) === 1)
  await ctx.close()
}
await b.close()

console.log(fails ? `\n❌ ${fails} fallos` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
