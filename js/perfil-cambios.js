// ── La pestaña «Cambios» del perfil (tanda 887) ──
//
// soyfedeegb, en el foro de Ayuda: «visualizar las cartas buscadas y
// disponibles para trade por los demás usuarios en su perfil al ingresar a
// ellos». PINGU: «creo que es muy importante… adelante con la A, con
// cifras».
//
// Hasta ahora lo que alguien da y busca se veía por CARTA (el Mercado, la
// ficha) o cruzado contigo (Cruces), nunca entrando en su perfil. Aquí van
// las dos listas enteras, y arriba vuestro cruce si has entrado. En la
// cabecera, la chapa «Cambia · da N · busca M» lleva a la pestaña.
//
// Entra por `import()` desde usuario.js y perfil.js: la ficha no lo baja
// hasta que hay perfil. Lo que busca sale de `user_wants` (público, 376);
// lo que da, de `intercambios_de_persona` (migración 887): sin ella, la
// pestaña enseña lo que busca y lo dice.
import { supabase } from './supabase.js'
import { escapeHtml } from './app.js'
import { hojaInyectada } from './hoja.js'
import { icons } from './icons.js'
import { rutaDeCarta } from './carta-ruta.js'
import { nombreDeCarta, nombreDeSet } from './catalogo-series.js'
import { cadenaDeEscaneo, atributosDeEscaneo } from './escaneo-carta.js'
import { idiomaDe, estadoDe, precioDeFila, valorDe } from './cardmarket.js'
import { conVariante } from './deseo-version.js'
import { nombreDeVariante } from './mi-coleccion/variantes.js'
import { contarPestania, pestaniaLista, abrirPestania, abrirLaQueTengaAlgo } from './perfil-pestanias.js'

// Lo puro (qué es una baldosa, la chapa, los sellos) vive aparte y sin
// dependencias, para que la prueba lo importe en Node (la 471).
import { FICHERO_MIGRACION, DE_PRIMERAS, porCarta, textoDeChapa, selloDeLoQueDa, selloDeLoQueBusca, ordenarParaTira } from './perfil-cambios-puro.js'
import { normalizeSearch } from './texto.js'
export { FICHERO_MIGRACION, DE_PRIMERAS, porCarta, textoDeChapa, selloDeLoQueDa, selloDeLoQueBusca, ordenarParaTira }

const esRpcQueFalta = (e) => e && (e.code === 'PGRST202' || e.code === '42883' || /could not find the function|does not exist/i.test(String(e.message || '')))

// ── Los datos ──

async function loQueBusca(userId) {
  const { data, error } = await conVariante('card_id,idioma,created_at', (cols) => supabase.from('user_wants').select(cols).eq('user_id', userId).order('created_at', { ascending: false }).limit(1000))
  if (error) throw error
  return data || []
}

async function loQueDa(userId) {
  const { data, error } = await supabase.rpc('intercambios_de_persona', { p_user: userId, p_limite: 500 })
  if (error) {
    if (esRpcQueFalta(error)) return { filas: [], sinMigracion: true }
    throw error
  }
  return { filas: data || [], sinMigracion: false }
}

// Lo mío, para los sellos: mis deseos y mis líneas de las cartas que
// busca (solo esas: mi colección entera no cabe en una consulta).
async function loMio(miId, idsQueBusca) {
  const [deseos, lineas] = await Promise.all([
    conVariante('card_id,idioma', (cols) => supabase.from('user_wants').select(cols).eq('user_id', miId).limit(2000)).then((r) => r.data || []),
    idsQueBusca.length
      ? supabase.from('user_collection').select('card_id,idioma,cambio,variante').eq('user_id', miId).in('card_id', idsQueBusca.slice(0, 300)).then((r) => r.data || [])
      : Promise.resolve([]),
  ])
  return { deseos, lineas }
}

// Las fichas de las cartas: lo que da trae su mercado; lo que busca no
// (user_wants no lo guarda), así que se prueba el occidental y lo que no
// case, el japonés.
async function fichasDe(da, busca) {
  const { cartasPorClaves, cartasPorIds, claveDeCarta } = await import('./mi-coleccion/datos.js')
  const mapa = await cartasPorClaves(da).catch(() => new Map())
  const idsBusca = [...new Set(busca.map((b) => b.card_id))]
  if (idsBusca.length) {
    const west = await cartasPorIds(idsBusca, 'WEST').catch(() => new Map())
    for (const [id, c] of west) mapa.set(claveDeCarta(id, 'WEST'), c)
    const faltan = idsBusca.filter((id) => !west.has(id))
    if (faltan.length) for (const [id, c] of await cartasPorIds(faltan, 'JP').catch(() => new Map())) mapa.set(claveDeCarta(id, 'JP'), c)
  }
  return { mapa, claveDeCarta }
}

// EL PRECIO ES EL DE LA FICHA (900): el mínimo de Cardmarket EN EL IDIOMA
// de la copia, con los mismos respaldos que `precio-vista` (`valorDe`).
// Hasta la 900 se pintaba `cm_low` a secas, el mínimo entre todos los
// idiomas, y PINGU y soyfedeegb lo vieron: «Terrakion 14,90 €» en la
// pestaña y 230 € (español) en la ficha. Mapa de carta → precio ya
// montado; quien pinta le pide el idioma que toque.
async function preciosDe(ids) {
  if (!ids.length) return new Map()
  const { data } = await supabase.from('tcg_card_prices').select('*').in('card_id', ids.slice(0, 300))
  return new Map((data || []).map((p) => [p.card_id, precioDeFila(p)]))
}
// Lo que vale una fila de la pestaña: en el idioma de la copia (el primero
// si hay varios); sin idioma apuntado, el de la ficha por defecto.
const precioDeFilaDeCambio = (precios, f) => valorDe(precios.get(f.card_id) || null, f.idiomas?.[0] || null)

// ── El pintado ──

const euros = (n) => (Number.isFinite(Number(n)) && n !== null ? `${Number(n).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €` : '')

function baldosaHtml(fila, carta, { sello = null, precio = null, cuanto = '', deseo = false } = {}) {
  const nombre = carta ? nombreDeCarta(carta) : fila.card_id
  const escaneo = carta ? atributosDeEscaneo(cadenaDeEscaneo(carta)) : null
  const set = carta ? `${nombreDeSet(carta.tcg_sets) || carta.set_id || ''}${carta.local_id ? ` · ${carta.local_id}` : ''}` : ''
  const idiomas = fila.idiomas.length ? fila.idiomas.map((i) => idiomaDe(i).nombre).join(', ') : 'cualquier idioma'
  const estados = fila.estados.length ? ` · ${fila.estados.map((e) => estadoDe(e).nombre).join(', ')}` : ''
  // La versión (1047): de lo que da, si no es la normal (como `senasDe`);
  // de lo que busca, la que pide, también la normal.
  const versiones = (fila.variantes || []).filter((v) => deseo || v !== 'normal')
  const version = versiones.length ? `${versiones.map((v) => nombreDeVariante(v)).join(', ')} · ` : ''
  return `<li class="pc-carta">
    <a class="pc-carta-foto" href="${carta ? escapeHtml(rutaDeCarta(carta)) : '#'}" aria-label="${escapeHtml(nombre)}">
      ${sello ? `<span class="pc-sello${sello === 'La das' ? ' pc-sello-das' : sello === 'La tienes' ? ' pc-sello-tienes' : ''}">${escapeHtml(sello)}</span>` : ''}
      <span class="pc-carta-sinfoto">${escapeHtml(nombre)}</span>
      ${escaneo ? `<img ${escaneo} alt="" width="245" height="342" loading="lazy">` : ''}
    </a>
    <span class="pc-carta-nombre">${escapeHtml(nombre)}</span>
    ${set ? `<span class="pc-carta-set">${escapeHtml(set)}</span>` : ''}
    <span class="pc-carta-senas">${escapeHtml(`${cuanto}${version}${idiomas}${estados}`)}</span>
    ${precio ? `<span class="pc-carta-precio">${escapeHtml(precio)}</span>` : ''}
  </li>`
}

// UNA fila que se desliza de lado (939), con flechas en el PC y «Ver todas»
// cuando no caben. La cabecera va con el título de la lista.
function tiraHtml(id, titulo, orden, baldosas, total) {
  return `<div class="pc-tira-cab">
      <h2 class="section-title">${escapeHtml(titulo)}</h2>
      ${orden ? `<span class="pc-orden">${escapeHtml(orden)}</span>` : ''}
      <span class="pc-tira-mandos">
        <button type="button" class="pc-flecha" data-tira="${id}" data-paso="-1" aria-label="Anteriores">‹</button>
        <button type="button" class="pc-flecha" data-tira="${id}" data-paso="1" aria-label="Siguientes">›</button>
        ${total > 4 ? `<button type="button" class="btn-secondary pc-ver-todas" data-ver-todas="${id}">Ver todas${total > DE_PRIMERAS ? ` (${total.toLocaleString('es-ES')})` : ''}</button>` : ''}
      </span>
    </div>
    <ul class="pc-rejilla pc-tira" id="${id}">${baldosas.slice(0, DE_PRIMERAS).join('')}</ul>`
}

// «Ver todas»: la lista entera en una hoja (a un lado en el PC, desde
// abajo en el móvil), con buscador y, si has entrado, «las que buscas» o
// «las que das». Se crea la primera vez.
function hojaTodas() {
  let d = document.getElementById('pcTodas')
  if (d) return d
  d = document.createElement('dialog')
  d.id = 'pcTodas'
  d.className = 'pc-todas'
  d.setAttribute('aria-labelledby', 'pcTodasTitulo')
  d.innerHTML = `<div class="pc-todas-cab">
      <h2 id="pcTodasTitulo"></h2>
      <button type="button" class="pc-todas-cerrar" data-cerrar aria-label="Cerrar">✕</button>
    </div>
    <div class="pc-todas-mandos">
      <label class="sr-only" for="pcTodasBuscar">Buscar en la lista</label>
      <input type="search" enterkeyhint="search" id="pcTodasBuscar" placeholder="Busca por nombre o expansión" autocomplete="off" />
      <button type="button" class="pc-todas-chip" id="pcTodasSolo" aria-pressed="false"></button>
    </div>
    <p class="subtext pc-todas-cuenta" id="pcTodasCuenta" aria-live="polite"></p>
    <ul class="pc-rejilla" id="pcTodasRejilla"></ul>`
  document.body.appendChild(d)
  d.addEventListener('click', (e) => {
    if (e.target === d || e.target.closest('[data-cerrar]')) d.close()
  })
  return d
}

function abrirTodas(lista) {
  const d = hojaTodas()
  const buscar = d.querySelector('#pcTodasBuscar')
  const solo = d.querySelector('#pcTodasSolo')
  let soloMias = false
  d.querySelector('#pcTodasTitulo').textContent = lista.titulo
  buscar.value = ''
  solo.hidden = !lista.textoSolo
  solo.textContent = lista.textoSolo || ''
  const pintar = () => {
    const q = normalizeSearch(buscar.value || '').trim()
    const vistas = lista.items.filter((x) => (!q || x.texto.includes(q)) && (!soloMias || x.sello))
    d.querySelector('#pcTodasRejilla').innerHTML = vistas.map((x) => x.html).join('') || '<li class="pc-vacio">Ninguna con eso.</li>'
    d.querySelector('#pcTodasCuenta').textContent = `${vistas.length.toLocaleString('es-ES')} de ${lista.items.length.toLocaleString('es-ES')}`
    solo.setAttribute('aria-pressed', String(soloMias))
  }
  buscar.oninput = pintar
  solo.onclick = () => { soloMias = !soloMias; pintar() }
  pintar()
  if (!d.open) d.showModal()
  buscar.focus()
}

function vaciaHtml(propia, { daVacio, buscaVacio }) {
  if (!propia) return '<p class="empty-state">Ahora mismo no da ni busca ninguna carta.</p>'
  return `<div class="pc-vacio">
    <p>Aquí verá la gente lo que das y lo que buscas, y qué os podéis cambiar.</p>
    <div class="pc-vacio-botones">
      ${daVacio ? '<a class="btn-primary" href="/mi-coleccion?ver=cambios">Pon cartas para cambio</a>' : ''}
      ${buscaVacio ? '<a class="btn-secondary" href="/mi-coleccion?ver=quiero">Apunta lo que buscas</a>' : ''}
    </div>
  </div>`
}

// La chapa de la cabecera, al lado del nivel y la racha. Es un botón que
// abre la pestaña: la primera señal de que esa persona cambia.
function ponerChapa(texto, { propia }) {
  const sitio = document.querySelector('.perfil-chapas')
  if (!sitio) return
  sitio.querySelector('.perfil-chapa-cambia')?.remove()
  if (!texto) return
  const b = document.createElement('button')
  b.type = 'button'
  b.className = 'perfil-chapa-cambia'
  b.innerHTML = `${icons.refreshCw(14)} ${escapeHtml(texto)}`
  b.title = propia ? 'Lo que das y lo que buscas' : 'Lo que da y lo que busca'
  b.addEventListener('click', () => {
    abrirPestania('cambios')
    document.getElementById('ptab-cambios')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
  sitio.appendChild(b)
}

// `persona`: la fila de user_profiles de la ficha; `sesion`: la de quien
// mira (o null); `propia`: si es tu perfil (la pestaña sale siempre, vacía
// con sus dos caminos).
export async function pintarCambiosDe(caja, persona, sesion, { propia = false } = {}) {
  if (!caja || !persona?.id) return null
  hojaInyectada('css/perfil-cambios.css')
  const miId = sesion?.user?.id || null
  let busca = []
  let da = { filas: [], sinMigracion: false }
  try {
    ;[busca, da] = await Promise.all([loQueBusca(persona.id), loQueDa(persona.id)])
  } catch (e) {
    caja.innerHTML = `<p class="empty-state">No se ha podido mirar ahora. Prueba otra vez en un momento.</p>`
    pestaniaLista('cambios', propia)
    return null
  }
  const filasDa = porCarta(da.filas, { sumar: 'cambio' })
  const filasBusca = porCarta(busca.map((b) => ({ ...b, cambio: 1 })))
  const cuentas = { da: filasDa.length, busca: filasBusca.length }
  const total = cuentas.da + cuentas.busca

  contarPestania('cambios', total)
  pestaniaLista('cambios', total > 0 || propia)
  ponerChapa(textoDeChapa(cuentas), { propia })
  if (total > 0) abrirLaQueTengaAlgo()

  if (!total) {
    caja.innerHTML = vaciaHtml(propia, { daVacio: true, buscaVacio: true })
    return cuentas
  }

  const [{ mapa, claveDeCarta }, mio] = await Promise.all([
    fichasDe(filasDa, filasBusca),
    miId && !propia ? loMio(miId, filasBusca.map((f) => f.card_id)).catch(() => ({ deseos: [], lineas: [] })) : Promise.resolve({ deseos: [], lineas: [] }),
  ])
  const precios = await preciosDe([...new Set([...filasDa, ...filasBusca].map((f) => f.card_id))]).catch(() => new Map())
  const cartaDe = (f) => mapa.get(claveDeCarta(f.card_id, f.market)) || mapa.get(claveDeCarta(f.card_id, 'WEST')) || mapa.get(claveDeCarta(f.card_id, 'JP')) || null
  const nombre = persona.display_name || persona.username || 'Esta persona'
  const quien = propia ? 'Das' : 'Da'
  const quienBusca = propia ? 'Buscas' : 'Busca'

  const valor = (f) => precioDeFilaDeCambio(precios, f)
  const selloDa = (f) => (miId && !propia ? selloDeLoQueDa(f, mio.deseos) : null)
  const selloBusca = (f) => (miId && !propia ? selloDeLoQueBusca(f, mio.lineas) : null)
  // Lo que te importa primero, y lo de más valor delante (939).
  const enOrdenDa = ordenarParaTira(filasDa, { sello: selloDa, precio: valor })
  const enOrdenBusca = ordenarParaTira(filasBusca, { sello: selloBusca, precio: valor })
  const item = (f, sello, extra = {}) => {
    const c = cartaDe(f)
    return {
      sello,
      html: baldosaHtml(f, c, { sello, precio: euros(valor(f)), ...extra }),
      texto: normalizeSearch([c ? nombreDeCarta(c) : f.card_id, c ? nombreDeSet(c.tcg_sets) || c.set_id : '', c?.local_id || ''].join(' ')),
    }
  }
  const itemsDa = enOrdenDa.map((f) => item(f, selloDa(f), { cuanto: `${f.total === 1 ? 'Da 1' : `Da ${f.total}`} · ` }))
  const itemsBusca = enOrdenBusca.map((f) => item(f, selloBusca(f), { deseo: true }))
  const baldosasDa = itemsDa.map((x) => x.html)
  const baldosasBusca = itemsBusca.map((x) => x.html)
  const hayDeLoMio = (items) => miId && !propia && items.some((x) => x.sello)

  caja.innerHTML = `
    ${miId && !propia ? '<section class="perfil-cruce pc-cruce" id="pcCruce" aria-label="Vuestro cruce"></section>' : ''}
    ${!miId && !propia ? `<p class="pc-entra subtext"><a href="/auth.html?volver=${encodeURIComponent(location.pathname + location.search)}">Entra</a> y te digo qué te puede dar ${escapeHtml(nombre)} y qué le puedes dar tú.</p>` : ''}
    <section class="pc-bloque" aria-label="${escapeHtml(`${quien} ${cuentas.da} cartas`)}">
      ${cuentas.da
        ? tiraHtml('pcRejillaDa', `${quien} ${cuentas.da === 1 ? '1 carta' : `${cuentas.da} cartas`}`, hayDeLoMio(itemsDa) ? 'Las que buscas, primero' : '', baldosasDa, cuentas.da)
        : `<h2 class="section-title">${quien} 0 cartas</h2>`}
      ${da.sinMigracion ? `<p class="subtext">Lo que da todavía no se puede enseñar: falta ejecutar <code>${FICHERO_MIGRACION}</code>.</p>` : ''}
      ${cuentas.da ? '' : (!da.sinMigracion ? vaciaHtml(propia, { daVacio: true, buscaVacio: false }) : '')}
    </section>
    <section class="pc-bloque" aria-label="${escapeHtml(`${quienBusca} ${cuentas.busca} cartas`)}">
      ${cuentas.busca
        ? tiraHtml('pcRejillaBusca', `${quienBusca} ${cuentas.busca === 1 ? '1 carta' : `${cuentas.busca} cartas`}`, hayDeLoMio(itemsBusca) ? 'Las que das, primero' : '', baldosasBusca, cuentas.busca)
        : `<h2 class="section-title">${quienBusca} 0 cartas</h2>${vaciaHtml(propia, { daVacio: false, buscaVacio: true })}`}
    </section>`

  // Las flechas pasan una «pantalla» de la fila; «Ver todas», la hoja.
  const listas = {
    pcRejillaDa: { titulo: `Lo que ${propia ? 'das' : `da ${nombre}`}`, items: itemsDa, textoSolo: hayDeLoMio(itemsDa) ? 'Las que buscas' : '' },
    pcRejillaBusca: { titulo: `Lo que ${propia ? 'buscas' : `busca ${nombre}`}`, items: itemsBusca, textoSolo: hayDeLoMio(itemsBusca) ? 'Las que das o tienes' : '' },
  }
  const quieto = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  caja.querySelectorAll('[data-tira]').forEach((b) => b.addEventListener('click', () => {
    const ul = document.getElementById(b.dataset.tira)
    if (ul) ul.scrollBy({ left: Number(b.dataset.paso) * ul.clientWidth * 0.85, behavior: quieto ? 'auto' : 'smooth' })
  }))
  caja.querySelectorAll('[data-ver-todas]').forEach((b) => b.addEventListener('click', () => abrirTodas(listas[b.dataset.verTodas])))

  // Vuestro cruce, arriba: el de la 794, siempre y no solo por el QR, con
  // «Escribir» y el mensaje redactado.
  if (miId && !propia) {
    import('./cruce-persona.js').then((m) => m.pintarCruce(document.getElementById('pcCruce'), persona, sesion, { escribir: true, miniaturas: true })).catch(() => {})
  }
  return cuentas
}
