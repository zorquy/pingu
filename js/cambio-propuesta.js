// LA PROPUESTA DE CAMBIO (tandas 942 y 943; propuesta «Cambios en PokeDoc»).
//
// PINGU: «si yo tengo una carta de 70 € y quiero dos cartas de 3 € de él,
// la diferencia me la tendría que dar por Bizum… que eso ya es algo privado,
// pero si el cambio se hace efectivo, que unas cartas pasen a la colección
// del otro y viceversa». Tres cosas viven aquí:
//   · el editor: lo que das y lo que te da, copia a copia (idioma, estado y
//     versión), con el precio de hoy en su idioma y la diferencia en dinero
//     apuntada (quién paga, cuánto y cómo; PokeDoc no cobra ni comprueba);
//   · la tarjeta de una propuesta, con lo que puede hacer quien mira
//     (aceptar, cambiar algo, rechazar, anular, «Lo tengo», deshacer);
//   · «Tus cambios», la lista para Deseos y cambios.
// Entra por `import()` desde Cruces, el Mercado, el perfil y Mensajes, y
// mete su hoja (css/cambio-propuesta.css). Todo lo que escribe pasa por las
// funciones de supabase-migration-942-propuestas-cambio.sql.
import { supabase } from './supabase.js'
import { escapeHtml, avatarStyle, getInitial, profileUrl } from './app.js'
import { hojaInyectada } from './hoja.js'
import { icons } from './icons.js'
import { showToast } from './toast.js'
import { nombreDeCarta, nombreDeSet } from './catalogo-series.js'
import { cadenaDeEscaneo, atributosDeEscaneo } from './escaneo-carta.js'
import { IDIOMAS, idiomaDe, precioDeFila, valorDe } from './cardmarket.js'
import { normalizeSearch } from './texto.js'
import { senasDe } from './mi-coleccion/borrador-cruce.js'
import {
  FICHERO_MIGRACION, COMOS, euros, balanceDe, dineroQueCuadra, dineroDeOferta, textoDeDinero, pagaParaRpc,
  estadoDe, pasoDe, estaViva, loQueSeMueve, itemsParaRpc,
} from './cambio-propuesta-puro.js'

export { FICHERO_MIGRACION, estaViva }

const $ = (id) => document.getElementById(id)
const sinMigracion = (e) => ['PGRST202', 'PGRST205', '42P01', '42883'].includes(e?.code) || /Could not find|does not exist/i.test(e?.message || '')
const mensajeDe = (e) => (sinMigracion(e) ? `Las propuestas de cambio todavía no están puestas en la base (falta ${FICHERO_MIGRACION}).` : String(e?.message || 'No se ha podido.'))
const nombreDePersona = (p) => p?.display_name || p?.username || 'Alguien'
const COLUMNAS_LINEA = 'id,card_id,market,idioma,estado,variante,gradeo,cantidad,cambio'
const COLUMNAS_BUSCAR = 'id,market,set_id,local_id,name,name_es,name_en,image_path,image_scrydex,image_tcggo,tcg_sets(name,name_en,tcg_online_code,serie_id,oculto)'

// ── Los datos ──

// Tu colección entera, a trozos (Supabase corta a 1.000 filas, la 808).
async function misLineas(yo) {
  const todas = []
  for (let desde = 0; desde < 20000; desde += 1000) {
    const { data, error } = await supabase.from('user_collection').select(COLUMNAS_LINEA).eq('user_id', yo).order('created_at').range(desde, desde + 999)
    if (error) throw error
    todas.push(...(data || []))
    if (!data || data.length < 1000) break
  }
  return todas
}

async function loQueDa(userId) {
  const { data, error } = await supabase.rpc('cambio_lo_que_da', { p_user: userId })
  if (error) throw error
  return data || []
}

async function fichasDe(filas) {
  const { cartasPorClaves, claveDeCarta } = await import('./mi-coleccion/datos.js')
  const mapa = await cartasPorClaves(filas).catch(() => new Map())
  return (f) => mapa.get(claveDeCarta(f.card_id, f.market || 'WEST')) || null
}

// El precio de una copia es el de la ficha: el mínimo de Cardmarket EN SU
// IDIOMA (900), con los respaldos de siempre (`valorDe`).
async function preciosDe(ids) {
  const mapa = new Map()
  const unicos = [...new Set(ids.filter(Boolean))]
  for (let i = 0; i < unicos.length; i += 150) {
    const { data } = await supabase.from('tcg_card_prices').select('*').in('card_id', unicos.slice(i, i + 150))
    for (const p of data || []) mapa.set(p.card_id, precioDeFila(p))
  }
  return mapa
}
const valorDeCopia = (precios, f) => {
  const v = valorDe(precios.get(f.card_id) || null, f.idioma || null)
  return v == null ? null : Math.round(Number(v) * 100) / 100
}

async function perfilesDe(ids) {
  const unicos = [...new Set(ids.filter(Boolean))]
  if (!unicos.length) return new Map()
  const { data } = await supabase.from('user_profiles').select('id,username,display_name,avatar_url').in('id', unicos)
  return new Map((data || []).map((p) => [p.id, p]))
}

// ── Piezas de pintado ──

function miniHtml(carta, f, titulo = '') {
  const nombre = carta ? nombreDeCarta(carta) : f.card_id
  const escaneo = carta ? atributosDeEscaneo(cadenaDeEscaneo(carta)) : null
  return `<span class="cp-mini" title="${escapeHtml(titulo || nombre)}">${escaneo ? `<img ${escaneo} alt="" width="245" height="342" loading="lazy" />` : `<span>${escapeHtml(nombre)}</span>`}</span>`
}

const setDe = (carta) => (carta ? [nombreDeSet(carta.tcg_sets) || carta.set_id, carta.local_id].filter(Boolean).join(' · ') : '')

function avatarHtml(p, clase = 'mini-avatar') {
  return `<span class="${clase}" style="${avatarStyle(p)}">${p?.avatar_url ? '' : escapeHtml(getInitial(nombreDePersona(p)))}</span>`
}

// ══════════════════ EL EDITOR ══════════════════

let ed = null

function dialogo() {
  let d = $('cpDialogo')
  if (d) return d
  d = document.createElement('dialog')
  d.id = 'cpDialogo'
  d.className = 'cp-dialogo'
  d.setAttribute('aria-labelledby', 'cpTitulo')
  d.innerHTML = '<div class="cp-cab" id="cpCab"></div><div class="cp-cuerpo" id="cpCuerpo"></div>'
  document.body.appendChild(d)
  d.addEventListener('click', alPulsarEnEditor)
  d.addEventListener('input', alEscribirEnEditor)
  d.addEventListener('change', alEscribirEnEditor)
  d.addEventListener('close', () => { ed = null })
  return d
}

let siguienteClave = 1
const nuevaClave = () => `i${siguienteClave++}`

function itemDeLinea(l, mia, { libres = null } = {}) {
  const max = Math.max(1, Number(libres ?? l.cantidad) || 1)
  return { key: nuevaClave(), mia, linea: l.id, card_id: l.card_id, market: l.market || 'WEST', idioma: l.idioma, estado: l.estado, variante: l.variante, gradeo: l.gradeo || null, cantidad: 1, max, pedida: false }
}
function itemPedido(card_id, market = 'WEST', idioma = 'es') {
  return { key: nuevaClave(), mia: false, linea: null, card_id, market, idioma, estado: 'NM', variante: 'normal', gradeo: null, cantidad: 1, max: 9, pedida: true }
}

// Abre el editor. `otro`: el perfil de la otra persona. `prefill`: lo que
// os cruzáis (las cartas suyas que buscas, `suyas`, y las tuyas que busca,
// `mias`: { card_id, idioma }). `anterior`: la propuesta que se cambia (sus
// cartas entran tal cual, desde tu lado). `alEnviar(id)`, al mandarla.
export async function abrirPropuesta({ sesion, otro, prefill = {}, anterior = null, alEnviar = null } = {}) {
  if (!sesion?.user?.id) {
    location.href = `/auth.html?registro=1&volver=${encodeURIComponent(location.pathname + location.search)}`
    return
  }
  hojaInyectada('css/cambio-propuesta.css')
  const d = dialogo()
  const yo = sesion.user.id
  ed = { yo, otro, anterior, alEnviar, items: [], dinero: { cantidad: 0, pagaYo: false, como: null }, nota: '', vista: 'principal', cargando: true, error: null }
  pintarCabecera()
  $('cpCuerpo').innerHTML = '<div class="skeleton cp-esqueleto"></div>'
  if (!d.open) d.showModal()
  try {
    const [mias, suyas, misDoy] = await Promise.all([misLineas(yo), loQueDa(otro.id), loQueDa(yo)])
    if (!ed || ed.otro !== otro) return
    const libresMias = new Map(misDoy.map((l) => [l.id, l.libres]))
    ed.mias = mias.map((l) => ({ ...l, libres: libresMias.has(l.id) ? libresMias.get(l.id) : l.cantidad }))
    ed.suyas = suyas
    const deAntes = anterior ? (anterior.items || []) : []
    const cartaDe = await fichasDe([...mias, ...suyas, ...deAntes, ...(prefill.suyas || []), ...(prefill.mias || [])])
    const precios = await preciosDe([...mias, ...suyas, ...deAntes, ...(prefill.suyas || [])].map((f) => f.card_id))
    if (!ed || ed.otro !== otro) return
    ed.cartaDe = cartaDe
    ed.precios = precios
    ed.items = anterior ? itemsDeAnterior(anterior) : itemsDePrefill(prefill)
    if (anterior) ed.dinero = { ...dineroDeOferta(anterior, yo) }
    if (anterior?.nota) ed.nota = anterior.nota
    for (const it of ed.items) it.precio = valorDeCopia(precios, it)
  } catch (err) {
    if (ed) ed.error = mensajeDe(err)
  }
  if (!ed) return
  ed.cargando = false
  pintarEditor()
}

function itemsDePrefill(prefill) {
  const items = []
  const usadas = new Set()
  for (const p of prefill.suyas || []) {
    const l = ed.suyas.find((x) => x.card_id === p.card_id && !usadas.has(x.id) && Number(x.libres) > 0 && (!p.idioma || x.idioma === p.idioma)) ||
      ed.suyas.find((x) => x.card_id === p.card_id && !usadas.has(x.id) && Number(x.libres) > 0)
    if (l) { usadas.add(l.id); items.push(itemDeLinea(l, false, { libres: l.libres })) }
    else if (!items.some((it) => !it.mia && it.card_id === p.card_id)) items.push(itemPedido(p.card_id, p.market, p.idioma || 'es'))
  }
  for (const p of prefill.mias || []) {
    const deEsa = ed.mias.filter((x) => x.card_id === p.card_id && !usadas.has(x.id) && Number(x.libres) > 0)
    const l = deEsa.find((x) => Number(x.cambio) > 0 && (!p.idioma || x.idioma === p.idioma)) || deEsa.find((x) => !p.idioma || x.idioma === p.idioma) || deEsa[0]
    if (l) { usadas.add(l.id); items.push(itemDeLinea(l, true, { libres: l.libres })) }
  }
  return items
}

// Una propuesta que se cambia, desde TU lado. Lo que te pedían sin línea y
// tienes, con tu copia; si no la tienes, fuera (y se dice).
function itemsDeAnterior(o) {
  const items = []
  const quitadas = []
  for (const it of o.items || []) {
    const mia = it.quien === ed.yo
    if (mia && !it.linea) {
      const l = ed.mias.find((x) => x.card_id === it.card_id && x.idioma === it.idioma) || ed.mias.find((x) => x.card_id === it.card_id)
      if (l) items.push({ ...itemDeLinea(l, true, { libres: l.libres }), cantidad: it.cantidad })
      else quitadas.push(it.card_id)
      continue
    }
    const linea = mia ? ed.mias.find((x) => x.id === it.linea) : ed.suyas.find((x) => x.id === it.linea)
    items.push({
      key: nuevaClave(), mia, linea: it.linea, card_id: it.card_id, market: it.market, idioma: it.idioma, estado: it.estado, variante: it.variante,
      gradeo: it.gradeo, cantidad: it.cantidad, max: Math.max(it.cantidad, Number(linea?.libres ?? linea?.cantidad) || it.cantidad), pedida: !it.linea,
    })
  }
  if (quitadas.length) showToast(`No tienes ${quitadas.length === 1 ? 'una de las que te pedía' : `${quitadas.length} de las que te pedía`}: la he quitado.`, 'info')
  return items
}

function pintarCabecera() {
  const p = ed.otro
  $('cpCab').innerHTML = `${avatarHtml(p, 'mini-avatar cp-cab-avatar')}
    <div class="cp-cab-texto"><h2 id="cpTitulo">${ed.anterior ? 'Cambiar la propuesta' : `Propuesta para ${escapeHtml(nombreDePersona(p))}`}</h2>
    <p class="mc-confianza" data-confianza="${escapeHtml(p.id)}"></p></div>
    <button type="button" class="cp-cerrar" data-cp="cerrar" aria-label="Cerrar">✕</button>`
  import('./cambios-hechos.js').then((m) => m.ponerConfianza($('cpCab'))).catch(() => {})
}

function itemHtml(it) {
  const c = ed.cartaDe?.(it)
  const nombre = c ? nombreDeCarta(c) : it.card_id
  const idiomas = it.pedida
    ? `<select class="cp-idioma" data-cp-idioma="${it.key}" aria-label="Idioma que le pides">${IDIOMAS.filter((i) => (i.id !== 'ja' || it.market === 'JP') && (i.id !== 'nl' || it.idioma === 'nl')).map((i) => `<option value="${i.id}"${i.id === it.idioma ? ' selected' : ''}>${escapeHtml(i.nombre)}</option>`).join('')}</select>`
    : ''
  return `<li class="cp-item${it.pedida ? ' pedida' : ''}" data-cp-item="${it.key}">
    ${miniHtml(c, it)}
    <span class="cp-item-txt">
      <b>${escapeHtml(nombre)}</b>
      <small>${escapeHtml(setDe(c))}</small>
      <small>${it.pedida ? `Se la pides · ${idiomas}` : escapeHtml(senasDe(it))}</small>
    </span>
    <span class="cp-item-der">
      <b class="cp-precio">${it.precio == null ? 'sin precio' : escapeHtml(euros(it.precio * (it.cantidad || 1)))}</b>
      ${it.max > 1 ? `<span class="cp-paso"><button type="button" data-cp-menos="${it.key}" aria-label="Una menos"${it.cantidad <= 1 ? ' disabled' : ''}>−</button><span>${it.cantidad}</span><button type="button" data-cp-mas="${it.key}" aria-label="Una más"${it.cantidad >= it.max ? ' disabled' : ''}>+</button></span>` : ''}
      <button type="button" class="cp-quitar" data-cp-quitar="${it.key}" aria-label="Quitar ${escapeHtml(nombre)}">✕</button>
    </span>
  </li>`
}

function balanceActual() {
  return balanceDe(ed.items, ed.dinero)
}

function pintarEditor() {
  if (!ed) return
  if (ed.error) {
    $('cpCuerpo').innerHTML = `<p class="empty-state">${escapeHtml(ed.error)}</p>`
    return
  }
  if (ed.vista !== 'principal') return pintarSelector()
  const b = balanceActual()
  const nombre = nombreDePersona(ed.otro)
  const mias = ed.items.filter((it) => it.mia)
  const suyas = ed.items.filter((it) => !it.mia)
  const sugerido = dineroQueCuadra(ed.items)
  const paga = ed.dinero.cantidad > 0 ? (ed.dinero.pagaYo ? 'yo' : 'otro') : 'nadie'
  const total = Math.max(b.das, b.recibes) || 1
  $('cpCuerpo').innerHTML = `
    <div class="cp-lados">
      <section class="cp-lado" aria-label="Lo que das">
        <div class="cp-lado-cab"><h3>Tú das</h3><b>${escapeHtml(euros(b.doy))}</b></div>
        <ul class="cp-items">${mias.map(itemHtml).join('') || '<li class="cp-vacio">Todavía nada.</li>'}</ul>
        <div class="cp-anadir"><button type="button" class="btn-secondary" data-cp-elegir="doy">+ De las que doy</button><button type="button" class="link-btn" data-cp-elegir="mias">+ Otra de mi colección</button></div>
      </section>
      <section class="cp-lado" aria-label="Lo que te da">
        <div class="cp-lado-cab"><h3>Te da</h3><b>${escapeHtml(euros(b.recibo))}</b></div>
        <ul class="cp-items">${suyas.map(itemHtml).join('') || '<li class="cp-vacio">Todavía nada.</li>'}</ul>
        <div class="cp-anadir"><button type="button" class="btn-secondary" data-cp-elegir="suyas">+ De las que da</button><button type="button" class="link-btn" data-cp-elegir="pedir">+ Pedirle otra</button></div>
      </section>
    </div>
    <section class="cp-dinero" aria-label="Diferencia en dinero">
      <h3>Diferencia en dinero</h3>
      <div class="cp-chips" role="group" aria-label="Quién paga">
        <button type="button" class="cp-chip" data-cp-paga="nadie" aria-pressed="${paga === 'nadie'}">Nadie</button>
        <button type="button" class="cp-chip" data-cp-paga="otro" aria-pressed="${paga === 'otro'}">${escapeHtml(nombre)} te paga</button>
        <button type="button" class="cp-chip" data-cp-paga="yo" aria-pressed="${paga === 'yo'}">Le pagas</button>
      </div>
      ${paga === 'nadie' ? '' : `<div class="cp-dinero-fila">
        <label class="cp-cantidad"><span class="sr-only">Cuánto</span><input type="number" id="cpDinero" min="0" max="100000" step="0.01" inputmode="decimal" value="${ed.dinero.cantidad || ''}" /> €</label>
        <div class="cp-chips" role="group" aria-label="Cómo">${COMOS.map((c) => `<button type="button" class="cp-chip" data-cp-como="${c.id}" aria-pressed="${ed.dinero.como === c.id}">${c.nombre}</button>`).join('')}</div>
      </div>`}
      ${sugerido.cantidad > 0 && !(ed.dinero.cantidad === sugerido.cantidad && ed.dinero.pagaYo === sugerido.pagaYo)
        ? `<button type="button" class="link-btn cp-sugerir" data-cp="sugerir">${escapeHtml(sugerido.pagaYo ? `Proponer que le pagues la diferencia: ${euros(sugerido.cantidad)}` : `Proponer que te pague la diferencia: ${euros(sugerido.cantidad)}`)}</button>`
        : ''}
      <p class="subtext cp-aviso-dinero">Se apunta para que los dos estéis de acuerdo. El pago lo hacéis vosotros, fuera de PokeDoc: no se cobra ni se comprueba.</p>
    </section>
    <div class="cp-balanza" aria-live="polite">
      <div class="cp-barra" aria-hidden="true"><i class="a" style="width:${(b.das / total) * 50}%"></i><i class="b" style="width:${((b.recibes - b.dinero * (ed.dinero.pagaYo ? 0 : 1)) / total) * 50}%"></i>${!ed.dinero.pagaYo && b.dinero ? `<i class="m" style="width:${(b.dinero / total) * 50}%"></i>` : ''}</div>
      <p class="cp-balanza-texto"><span>Das ${escapeHtml(euros(b.das))} · recibes ${escapeHtml(euros(b.recibes))}</span><b class="${b.cuadra ? 'ok' : 'no'}">${mias.length || suyas.length ? (b.cuadra ? 'Cuadra' : b.diferencia > 0 ? `Recibes ${euros(b.diferencia)} más` : `Das ${euros(-b.diferencia)} más`) : ''}</b></p>
      ${b.sinPrecio ? `<p class="subtext">${b.sinPrecio === 1 ? 'Una carta no tiene precio' : `${b.sinPrecio} cartas no tienen precio`}: no cuentan en la cuenta.</p>` : ''}
    </div>
    <label class="cp-nota-campo"><span>Mensaje (opcional)</span><textarea id="cpNota" maxlength="500" rows="2" placeholder="Te la mando certificada el lunes…">${escapeHtml(ed.nota || '')}</textarea></label>
    <div class="cp-pie"><p class="cp-error" id="cpError" role="alert"></p><button type="button" class="btn-primary" id="cpEnviar" data-cp="enviar">${ed.anterior ? 'Mandar la propuesta cambiada' : 'Enviar propuesta'}</button></div>`
}

// ── Elegir cartas: una vista dentro de la misma hoja ──

function opcionesDe(vista) {
  const yaEstan = new Set(ed.items.filter((it) => it.linea).map((it) => it.linea))
  if (vista === 'doy') return ed.mias.filter((l) => Number(l.cambio) > 0).map((l) => ({ l, ya: yaEstan.has(l.id), libres: Number(l.libres) }))
  if (vista === 'mias') return ed.mias.map((l) => ({ l, ya: yaEstan.has(l.id), libres: Number(l.libres) }))
  if (vista === 'suyas') return ed.suyas.map((l) => ({ l, ya: yaEstan.has(l.id), libres: Number(l.libres) }))
  return []
}

function pintarSelector() {
  const titulo = { doy: 'De las que das', mias: 'De tu colección', suyas: `De las que da ${nombreDePersona(ed.otro)}`, pedir: 'Pedirle otra carta' }[ed.vista]
  const pedir = ed.vista === 'pedir'
  $('cpCuerpo').innerHTML = `
    <div class="cp-sel-cab"><button type="button" class="link-btn" data-cp="volver">‹ Volver</button><h3>${escapeHtml(titulo)}</h3></div>
    <label class="sr-only" for="cpBuscar">Buscar</label>
    <input type="search" enterkeyhint="search" id="cpBuscar" class="cp-buscar" placeholder="${pedir ? 'Busca la carta: Charizard, Iono, 151/165…' : 'Busca por nombre o expansión'}" autocomplete="off" value="${escapeHtml(ed.buscar || '')}" />
    ${pedir ? '<p class="subtext">Una que no tiene en «doy»: se la pides y él dice si la tiene.</p>' : ''}
    <ul class="cp-opciones" id="cpOpciones"></ul>
    ${pedir ? '' : '<div class="cp-pie"><button type="button" class="btn-primary" data-cp="anadir" id="cpAnadir" disabled>Añadir</button></div>'}`
  pintarOpciones()
  $('cpBuscar')?.focus()
}

function opcionHtml({ l, ya, libres }, marcada) {
  const c = ed.cartaDe?.(l)
  const nombre = c ? nombreDeCarta(c) : l.card_id
  const precio = valorDeCopia(ed.precios, l)
  const sin = libres <= 0
  return `<li><button type="button" class="cp-opcion${marcada || ya ? ' marcada' : ''}" data-cp-opcion="${escapeHtml(l.id)}"${ya || sin ? ' disabled' : ''} aria-pressed="${Boolean(marcada || ya)}">
      <span class="cp-check" aria-hidden="true">${marcada || ya ? '✓' : ''}</span>
      ${miniHtml(c, l)}
      <span class="cp-item-txt"><b>${escapeHtml(nombre)}</b><small>${escapeHtml(setDe(c))}</small><small>${escapeHtml(senasDe(l))}${ya ? ' · ya está' : sin ? ' · reservada en otro cambio' : libres > 1 ? ` · ${libres} libres` : ''}</small></span>
      <b class="cp-precio">${precio == null ? '' : escapeHtml(euros(precio))}</b>
    </button></li>`
}

let turnoPedir = 0
async function pintarOpciones() {
  const caja = $('cpOpciones')
  if (!caja || !ed) return
  const q = normalizeSearch(ed.buscar || '').trim()
  if (ed.vista === 'pedir') {
    if (q.length < 2) { caja.innerHTML = '<li class="cp-vacio">Escribe al menos dos letras.</li>'; return }
    const mio = ++turnoPedir
    caja.innerHTML = '<li class="skeleton cp-esqueleto-fila"></li>'
    try {
      const { buscarComoEnCartas } = await import('./buscar-cartas.js')
      const { lista } = await buscarComoEnCartas(ed.buscar, 40, { columnas: COLUMNAS_BUSCAR, market: 'WEST', sets: [] })
      if (mio !== turnoPedir || !ed) return
      ed.resultados = lista
      caja.innerHTML = lista.length
        ? lista.map((c) => `<li><button type="button" class="cp-opcion" data-cp-pedir="${escapeHtml(c.id)}">${miniHtml(c, { card_id: c.id })}<span class="cp-item-txt"><b>${escapeHtml(nombreDeCarta(c))}</b><small>${escapeHtml(setDe(c))}</small></span><span class="cp-mas" aria-hidden="true">+</span></button></li>`).join('')
        : '<li class="cp-vacio">No encuentro ninguna carta así.</li>'
    } catch (err) {
      if (mio === turnoPedir) caja.innerHTML = `<li class="cp-vacio">${escapeHtml(mensajeDe(err))}</li>`
    }
    return
  }
  const cartaDe = ed.cartaDe || (() => null)
  const todas = opcionesDe(ed.vista)
  const vistas = todas.filter(({ l }) => {
    if (!q) return true
    const c = cartaDe(l)
    return normalizeSearch([c ? nombreDeCarta(c) : l.card_id, c ? nombreDeSet(c.tcg_sets) || c.set_id : '', c?.local_id || ''].join(' ')).includes(q)
  })
  caja.innerHTML = vistas.slice(0, 200).map((o) => opcionHtml(o, ed.marcadas?.has(o.l.id))).join('') ||
    `<li class="cp-vacio">${todas.length ? 'Ninguna con eso.' : ed.vista === 'suyas' ? `${escapeHtml(nombreDePersona(ed.otro))} no da ninguna ahora mismo. Puedes pedirle una.` : ed.vista === 'doy' ? 'No das ninguna. Elige de tu colección.' : 'Tu colección está vacía.'}</li>`
  const boton = $('cpAnadir')
  if (boton) {
    const n = ed.marcadas?.size || 0
    boton.disabled = !n
    boton.textContent = n ? `Añadir ${n}` : 'Añadir'
  }
}

function abrirSelector(vista) {
  ed.vista = vista
  ed.buscar = ''
  ed.marcadas = new Set()
  pintarEditor()
}

function anadirMarcadas() {
  const mia = ed.vista !== 'suyas'
  const lista = mia ? ed.mias : ed.suyas
  for (const id of ed.marcadas || []) {
    const l = lista.find((x) => x.id === id)
    if (!l) continue
    const it = itemDeLinea(l, mia, { libres: l.libres })
    it.precio = valorDeCopia(ed.precios, it)
    ed.items.push(it)
  }
  ed.vista = 'principal'
  pintarEditor()
}

async function anadirPedida(cardId) {
  const c = (ed.resultados || []).find((x) => x.id === cardId)
  if (!c) return
  const it = itemPedido(c.id, c.market || 'WEST', 'es')
  // Su ficha y su precio, que no estaban en memoria.
  const antes = ed.cartaDe
  ed.cartaDe = (f) => (f.card_id === c.id && (f.market || 'WEST') === (c.market || 'WEST') ? c : antes(f))
  const precios = await preciosDe([c.id]).catch(() => new Map())
  for (const [k, v] of precios) ed.precios.set(k, v)
  it.precio = valorDeCopia(ed.precios, it)
  ed.items.push(it)
  ed.vista = 'principal'
  pintarEditor()
}

async function enviar() {
  const err = $('cpError')
  if (!ed.items.length) { err.textContent = 'Añade al menos una carta.'; return }
  if (ed.dinero.cantidad > 0 && !(ed.dinero.cantidad <= 100000)) { err.textContent = 'Esa cantidad no puede ser.'; return }
  const boton = $('cpEnviar')
  boton.disabled = true
  boton.textContent = 'Enviando…'
  const { data, error } = await supabase.rpc('cambio_proponer', {
    p_para: ed.otro.id,
    p_items: itemsParaRpc(ed.items),
    p_dinero: Number(ed.dinero.cantidad) || 0,
    p_paga: pagaParaRpc(ed.dinero),
    p_como: Number(ed.dinero.cantidad) > 0 ? ed.dinero.como || null : null,
    p_nota: (ed.nota || '').trim() || null,
    p_anterior: ed.anterior?.id || null,
  })
  if (error) {
    boton.disabled = false
    boton.textContent = ed.anterior ? 'Mandar la propuesta cambiada' : 'Enviar propuesta'
    err.textContent = mensajeDe(error)
    return
  }
  const otro = ed.otro
  const alEnviar = ed.alEnviar
  $('cpDialogo').close()
  showToast(`Propuesta enviada a ${nombreDePersona(otro)}. La tenéis en vuestra conversación.`, 'success', {
    accion: alEnviar ? null : { texto: 'Ver', alPulsar: () => { location.href = `/mensajes.html?with=${encodeURIComponent(otro.id)}` } },
  })
  alEnviar?.(data)
}

function alPulsarEnEditor(e) {
  const d = $('cpDialogo')
  if (e.target === d) return d.close()
  if (!ed) return
  const t = e.target.closest('[data-cp], [data-cp-elegir], [data-cp-quitar], [data-cp-menos], [data-cp-mas], [data-cp-paga], [data-cp-como], [data-cp-opcion], [data-cp-pedir]')
  if (!t) return
  const ds = t.dataset
  if (ds.cp === 'cerrar') return d.close()
  if (ds.cp === 'enviar') return void enviar()
  if (ds.cp === 'volver') { ed.vista = 'principal'; return pintarEditor() }
  if (ds.cp === 'anadir') return anadirMarcadas()
  if (ds.cp === 'sugerir') {
    const s = dineroQueCuadra(ed.items)
    ed.dinero = { ...ed.dinero, cantidad: s.cantidad, pagaYo: s.pagaYo }
    return pintarEditor()
  }
  if (ds.cpElegir) return abrirSelector(ds.cpElegir)
  if (ds.cpQuitar) { ed.items = ed.items.filter((it) => it.key !== ds.cpQuitar); return pintarEditor() }
  const paso = ds.cpMenos || ds.cpMas
  if (paso) {
    const it = ed.items.find((x) => x.key === paso)
    if (it) it.cantidad = Math.max(1, Math.min(it.max, it.cantidad + (ds.cpMas ? 1 : -1)))
    return pintarEditor()
  }
  if (ds.cpPaga) {
    if (ds.cpPaga === 'nadie') ed.dinero = { cantidad: 0, pagaYo: false, como: null }
    else {
      const s = dineroQueCuadra(ed.items)
      const pagaYo = ds.cpPaga === 'yo'
      ed.dinero = { ...ed.dinero, pagaYo, cantidad: ed.dinero.cantidad || (s.pagaYo === pagaYo ? s.cantidad : 0) }
    }
    return pintarEditor()
  }
  if (ds.cpComo) { ed.dinero.como = ed.dinero.como === ds.cpComo ? null : ds.cpComo; return pintarEditor() }
  if (ds.cpOpcion) {
    if (!ed.marcadas) ed.marcadas = new Set()
    if (ed.marcadas.has(ds.cpOpcion)) ed.marcadas.delete(ds.cpOpcion)
    else ed.marcadas.add(ds.cpOpcion)
    return void pintarOpciones()
  }
  if (ds.cpPedir) return void anadirPedida(ds.cpPedir)
}

let esperaBuscar = null
function alEscribirEnEditor(e) {
  if (!ed) return
  const t = e.target
  if (t.id === 'cpNota') { ed.nota = t.value; return }
  if (t.id === 'cpDinero') {
    ed.dinero.cantidad = Math.max(0, Math.round((Number(String(t.value).replace(',', '.')) || 0) * 100) / 100)
    if (e.type === 'change') pintarEditor()
    return
  }
  if (t.id === 'cpBuscar') {
    ed.buscar = t.value
    clearTimeout(esperaBuscar)
    esperaBuscar = setTimeout(() => void pintarOpciones(), ed.vista === 'pedir' ? 300 : 120)
    return
  }
  if (t.dataset.cpIdioma) {
    const it = ed.items.find((x) => x.key === t.dataset.cpIdioma)
    if (it) { it.idioma = t.value; it.precio = valorDeCopia(ed.precios, it) }
    if (e.type === 'change') pintarEditor()
  }
}

// ══════════════════ LAS PROPUESTAS GUARDADAS ══════════════════

// Tus propuestas (las dos direcciones), con sus cartas. `con`: solo las de
// esa persona. Lanza si falla; `sinMigracion` dice si es porque no está.
export async function cargarOfertas(yo, { con = null, limite = 60 } = {}) {
  const { data, error } = await supabase.from('trade_offers').select('*').or(`de.eq.${yo},para.eq.${yo}`).order('created_at', { ascending: false }).limit(limite)
  if (error) { error.sinMigracion = sinMigracion(error); throw error }
  const ofertas = (data || []).filter((o) => !con || o.de === con || o.para === con)
  if (!ofertas.length) return []
  const { data: items, error: e2 } = await supabase.from('trade_offer_items').select('*').in('oferta', ofertas.map((o) => o.id))
  if (e2) throw e2
  const porOferta = new Map()
  for (const it of items || []) {
    if (!porOferta.has(it.oferta)) porOferta.set(it.oferta, [])
    porOferta.get(it.oferta).push(it)
  }
  return ofertas.map((o) => ({ ...o, items: porOferta.get(o.id) || [] }))
}

function ladoHtml(titulo, items, cartaDe, vacio) {
  return `<div class="cp-t-lado"><h4>${escapeHtml(titulo)}</h4>
    ${items.length
      ? `<ul class="cp-minis">${items.map((it) => {
          const c = cartaDe(it)
          const nombre = c ? nombreDeCarta(c) : it.card_id
          return `<li>${miniHtml(c, it, `${nombre} · ${senasDe(it)}${it.cantidad > 1 ? ` · ×${it.cantidad}` : ''}${it.pedida && !it.linea ? ' · se la pides' : ''}`)}${it.cantidad > 1 ? `<span class="cp-mini-n">×${it.cantidad}</span>` : ''}</li>`
        }).join('')}</ul>`
      : `<p class="subtext">${vacio}</p>`}
  </div>`
}

const sumaDe = (items) => items.reduce((n, it) => n + (it.precio == null ? 0 : Number(it.precio) * (it.cantidad || 1)), 0)

export function tarjetaHtml(o, { yo, otro, cartaDe }) {
  const nombre = nombreDePersona(otro)
  const das = o.items.filter((it) => it.quien === yo)
  const recibes = o.items.filter((it) => it.quien !== yo)
  const dinero = dineroDeOferta(o, yo)
  const est = estadoDe(o, yo, nombre)
  const paso = pasoDe(o)
  const de = o.de === yo ? 'tuya' : `de ${nombre}`
  const boton = (accion, texto, primario = false) => `<button type="button" class="${primario ? 'btn-primary' : 'btn-secondary'}" data-cp-accion="${accion}" data-oferta="${escapeHtml(o.id)}">${texto}</button>`
  const acciones = est.acciones.map((a) => ({
    aceptar: boton('aceptar', 'Aceptar', true),
    editar: boton('editar', 'Cambiar algo'),
    rechazar: boton('rechazar', 'Rechazar'),
    anular: boton('anular', 'Anular'),
    'lo-tengo': boton('lo-tengo', 'Lo tengo', true),
    deshacer: boton('deshacer', 'Deshacer'),
  })[a]).join('')
  return `<article class="cp-tarjeta tono-${est.tono}" data-oferta="${escapeHtml(o.id)}">
    <header class="cp-t-cab"><b>Propuesta ${de}${o.version > 1 ? ` · ${o.version}.ª versión` : ''}</b><span class="cp-estado">${escapeHtml(est.texto)}</span></header>
    <div class="cp-t-lados">
      ${ladoHtml(`Das · ${euros(sumaDe(das))}`, das, cartaDe, 'Nada')}
      ${ladoHtml(`Recibes · ${euros(sumaDe(recibes))}`, recibes, cartaDe, 'Nada')}
    </div>
    ${dinero.cantidad ? `<p class="cp-t-dinero">${icons.zap ? icons.zap(14) : ''}<span>${escapeHtml(textoDeDinero(dinero, nombre))}</span></p>` : ''}
    ${o.nota ? `<p class="cp-t-nota">«${escapeHtml(o.nota)}»</p>` : ''}
    ${o.estado === 'aceptada' || o.estado === 'hecha' ? `<ol class="cp-pasos" aria-label="Paso ${paso} de 4">${['Propuesta', 'Aceptada', 'Lo tengo', 'Hecho'].map((p, i) => `<li class="${i + 1 < paso ? 'hecho' : i + 1 === paso ? 'ahora' : ''}">${p}</li>`).join('')}</ol>` : ''}
    ${o.estado === 'aceptada' ? `<p class="subtext cp-t-ayuda">${(o.de === yo ? o.recibido_de_at : o.recibido_para_at) ? `Cuando ${escapeHtml(nombre)} diga «Lo tengo», las cartas se mueven solas.` : `Cuando te llegue lo de ${escapeHtml(nombre)}, dale a «Lo tengo». Al decirlo los dos, las cartas cambian de colección solas.`}</p>` : ''}
    ${acciones ? `<div class="cp-t-acciones">${acciones}</div>` : ''}
  </article>`
}

// Lo que va a pasar al cerrarlo, antes de hacerlo.
function confirmarCierre(o, { yo, otro, cartaDe }) {
  return new Promise((resolver) => {
    hojaInyectada('css/cambio-propuesta.css')
    let d = $('cpCerrar')
    if (!d) {
      d = document.createElement('dialog')
      d.id = 'cpCerrar'
      d.className = 'cp-confirmar'
      document.body.appendChild(d)
    }
    const items = o.items.map((it) => ({ ...it, mia: it.quien === yo }))
    const m = loQueSeMueve(items, dineroDeOferta(o, yo))
    const fila = (it, signo) => {
      const c = cartaDe(it)
      return `<li class="${signo === '−' ? 'sale' : 'entra'}"><i>${signo}</i><span><b>${escapeHtml(c ? nombreDeCarta(c) : it.card_id)}</b> ${escapeHtml(senasDe(it))}${it.cantidad > 1 ? ` · ×${it.cantidad}` : ''} ${signo === '−' ? 'sale de tu colección' : 'entra en tu colección'}</span></li>`
    }
    d.innerHTML = `<h2>Cerrar el cambio con ${escapeHtml(nombreDePersona(otro))}</h2>
      <ul class="cp-mueve">${m.salen.map((it) => fila(it, '−')).join('')}${m.entran.map((it) => fila(it, '+')).join('')}
      ${m.dinero ? `<li class="din"><i>€</i><span>${escapeHtml(textoDeDinero(m.dinero, nombreDePersona(otro)))}: es cosa vuestra, no se apunta en tu colección</span></li>` : ''}</ul>
      <p class="subtext">Lo que buscabas y te llega se tacha de «La quiero». Puedes deshacerlo durante un día.</p>
      <div class="cp-pie"><button type="button" class="btn-secondary" data-r="no">Todavía no</button><button type="button" class="btn-primary" data-r="si">Mover las cartas</button></div>`
    d.onclick = (e) => {
      const r = e.target.closest('[data-r]')?.dataset.r || (e.target === d ? 'no' : null)
      if (!r) return
      d.close()
      resolver(r === 'si')
    }
    d.onclose = () => resolver(false)
    d.showModal()
  })
}

// Las acciones de las tarjetas de una caja. `contexto()`: { yo, ofertas,
// perfiles, cartaDe, sesion }; `recargar()`: vuelve a pintar.
// El contexto y el repintado se guardan en la caja: la caja se repinta
// entera y el oyente es UNO, así que tiene que leer el de la última pintada.
const contextosDeCaja = new WeakMap()
function engancharAcciones(caja, contexto, recargar) {
  contextosDeCaja.set(caja, { contexto, recargar })
  if (caja.dataset.cpEnganchado) return
  caja.dataset.cpEnganchado = '1'
  caja.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-cp-accion]')
    if (b && caja.contains(b)) {
      const { contexto, recargar } = contextosDeCaja.get(caja)
      const ctx = contexto()
      const o = ctx.ofertas.find((x) => x.id === b.dataset.oferta)
      if (!o) return
      const otro = ctx.perfiles.get(o.de === ctx.yo ? o.para : o.de) || { id: o.de === ctx.yo ? o.para : o.de }
      const accion = b.dataset.cpAccion
      if (accion === 'editar') return void abrirPropuesta({ sesion: ctx.sesion, otro, anterior: o, alEnviar: recargar })
      // Anular pide una segunda pulsación: no hay vuelta atrás.
      if (accion === 'anular' && !b.dataset.seguro) {
        b.dataset.seguro = '1'
        b.textContent = 'Pulsa otra vez para anular'
        return
      }
      if (accion === 'lo-tengo') {
        const otroYa = o.de === ctx.yo ? o.recibido_para_at : o.recibido_de_at
        if (otroYa && !(await confirmarCierre(o, { yo: ctx.yo, otro, cartaDe: ctx.cartaDe }))) return
      }
      b.disabled = true
      const rpc = accion === 'lo-tengo' ? ['cambio_lo_tengo', { p_oferta: o.id }]
        : accion === 'deshacer' ? ['cambio_deshacer', { p_oferta: o.id }]
          : ['cambio_contestar', { p_oferta: o.id, p_accion: accion }]
      const { data, error } = await supabase.rpc(rpc[0], rpc[1])
      if (error) {
        b.disabled = false
        showToast(mensajeDe(error), 'error')
        return
      }
      const fila = Array.isArray(data) ? data[0] : data
      if (fila?.estado === 'hecha') {
        const salen = o.items.filter((it) => it.quien === ctx.yo).length
        const entran = o.items.length - salen
        showToast(`Cambio hecho: ${salen} ${salen === 1 ? 'carta sale' : 'cartas salen'} de tu colección y ${entran} ${entran === 1 ? 'entra' : 'entran'}.`, 'success', {
          accion: { texto: 'Deshacer', alPulsar: async () => {
            const r = await supabase.rpc('cambio_deshacer', { p_oferta: o.id })
            showToast(r.error ? mensajeDe(r.error) : 'Deshecho: las cartas vuelven a donde estaban.', r.error ? 'error' : 'success')
            recargar()
          } },
        })
      } else {
        showToast({ aceptar: 'Aceptada. Ahora os mandáis las cartas.', rechazar: 'Rechazada.', anular: 'Anulada.', 'lo-tengo': 'Apuntado. Cuando lo diga la otra persona, se mueven las cartas.', deshacer: 'Deshecho: las cartas vuelven a donde estaban.' }[accion] || 'Hecho.', 'success')
      }
      recargar()
    }
  })
}

// Las propuestas con UNA persona, para Mensajes: las vivas arriba y
// «Proponer un cambio» si no hay ninguna. `cruce`: lo que os cruzáis, para
// rellenar la propuesta nueva.
export async function pintarPropuestasCon(caja, { sesion, otro, cruce = null } = {}) {
  if (!caja || !sesion?.user?.id || !otro?.id) return
  hojaInyectada('css/cambio-propuesta.css')
  caja.classList.add('cp-caja')
  const yo = sesion.user.id
  const estado = { yo, sesion, ofertas: [], perfiles: new Map([[otro.id, otro]]), cartaDe: () => null }
  const recargar = () => pintarPropuestasCon(caja, { sesion, otro, cruce })
  let ofertas
  try {
    ofertas = await cargarOfertas(yo, { con: otro.id })
  } catch (err) {
    caja.innerHTML = ''
    caja.hidden = true
    return
  }
  const vivas = ofertas.filter(estaViva)
  estado.ofertas = vivas
  estado.cartaDe = await fichasDe(vivas.flatMap((o) => o.items))
  caja.hidden = false
  caja.innerHTML = `${vivas.map((o) => tarjetaHtml(o, { yo, otro, cartaDe: estado.cartaDe })).join('')}
    <div class="cp-proponer-fila">
      <button type="button" class="btn-secondary" data-cp-nueva>${icons.refreshCw(15)}<span>${vivas.length ? 'Otra propuesta' : 'Proponer un cambio'}</span></button>
      ${ofertas.length > vivas.length ? '<a class="link-btn" href="/mi-coleccion?ver=cambios">Tus cambios</a>' : ''}
    </div>`
  engancharAcciones(caja, () => estado, recargar)
  // En el propio botón y no en la caja: la caja se repinta al contestar, y
  // un oyente en ella recogía el clic de «Aceptar» como si fuera este.
  caja.querySelector('[data-cp-nueva]')?.addEventListener('click', () => void abrirPropuesta({ sesion, otro, prefill: cruce || {}, alEnviar: recargar }))
}

// «Tus cambios», para Deseos y cambios: los vivos en tarjeta y los demás
// en una lista corta.
export async function pintarMisCambios(caja, { sesion } = {}) {
  if (!caja || !sesion?.user?.id) return
  hojaInyectada('css/cambio-propuesta.css')
  caja.classList.add('cp-mis')
  const yo = sesion.user.id
  const estado = { yo, sesion, ofertas: [], perfiles: new Map(), cartaDe: () => null }
  const recargar = () => pintarMisCambios(caja, { sesion })
  let ofertas
  try {
    ofertas = await cargarOfertas(yo)
  } catch (err) {
    caja.innerHTML = err.sinMigracion ? '' : `<p class="subtext">${escapeHtml(mensajeDe(err))}</p>`
    caja.hidden = !caja.innerHTML
    return
  }
  if (!ofertas.length) { caja.innerHTML = ''; caja.hidden = true; return }
  estado.ofertas = ofertas
  estado.perfiles = await perfilesDe(ofertas.map((o) => (o.de === yo ? o.para : o.de)))
  const vivas = ofertas.filter(estaViva)
  const pasadas = ofertas.filter((o) => !estaViva(o))
  estado.cartaDe = await fichasDe(vivas.flatMap((o) => o.items))
  const otroDe = (o) => estado.perfiles.get(o.de === yo ? o.para : o.de) || { id: o.de === yo ? o.para : o.de }
  caja.hidden = false
  caja.innerHTML = `<h2 class="section-title cp-mis-titulo">Tus cambios${vivas.length ? ` · ${vivas.length} en curso` : ''}</h2>
    ${vivas.map((o) => {
      const p = otroDe(o)
      return `<div class="cp-con"><a class="cp-con-quien" href="${escapeHtml(profileUrl(p))}">${avatarHtml(p)}<span>${escapeHtml(nombreDePersona(p))}</span></a>${o.conversacion ? `<a class="link-btn" href="/mensajes.html?c=${escapeHtml(o.conversacion)}">Ir a la conversación</a>` : ''}</div>${tarjetaHtml(o, { yo, otro: p, cartaDe: estado.cartaDe })}`
    }).join('')}
    ${pasadas.length ? `<details class="cp-pasadas"><summary>Los anteriores · ${pasadas.length}</summary><ul>${pasadas.map((o) => {
      const p = otroDe(o)
      const est = estadoDe(o, yo, nombreDePersona(p))
      const das = o.items.filter((it) => it.quien === yo).length
      return `<li class="cp-pasada"><span>${avatarHtml(p)} <b>${escapeHtml(nombreDePersona(p))}</b> · das ${das}, recibes ${o.items.length - das}${Number(o.dinero) > 0 ? ` · ${escapeHtml(textoDeDinero(dineroDeOferta(o, yo), nombreDePersona(p)))}` : ''}</span><span class="cp-estado tono-${est.tono}">${escapeHtml(est.texto)}</span></li>`
    }).join('')}</ul></details>` : ''}`
  engancharAcciones(caja, () => estado, recargar)
}

// Cuántas copias de cada carta tiene reservadas cada persona (en un cambio
// aceptado): `user_id|card_id` → n. Null si no se sabe.
export async function reservadasDe(cardIds) {
  const { data, error } = await supabase.rpc('cambios_reservadas', { p_cards: cardIds })
  if (error) return null
  return new Map((data || []).map((r) => [`${r.user_id}|${r.card_id}`, Number(r.cantidad) || 0]))
}
