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
import { contarPestania, pestaniaLista, abrirPestania, abrirLaQueTengaAlgo } from './perfil-pestanias.js'

// Lo puro (qué es una baldosa, la chapa, los sellos) vive aparte y sin
// dependencias, para que la prueba lo importe en Node (la 471).
import { FICHERO_MIGRACION, DE_PRIMERAS, porCarta, textoDeChapa, selloDeLoQueDa, selloDeLoQueBusca } from './perfil-cambios-puro.js'
export { FICHERO_MIGRACION, DE_PRIMERAS, porCarta, textoDeChapa, selloDeLoQueDa, selloDeLoQueBusca }

const esRpcQueFalta = (e) => e && (e.code === 'PGRST202' || e.code === '42883' || /could not find the function|does not exist/i.test(String(e.message || '')))

// ── Los datos ──

async function loQueBusca(userId) {
  const { data, error } = await supabase.from('user_wants').select('card_id,idioma,created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(1000)
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
    supabase.from('user_wants').select('card_id,idioma').eq('user_id', miId).limit(2000).then((r) => r.data || []),
    idsQueBusca.length
      ? supabase.from('user_collection').select('card_id,idioma,cambio').eq('user_id', miId).in('card_id', idsQueBusca.slice(0, 300)).then((r) => r.data || [])
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

function baldosaHtml(fila, carta, { sello = null, precio = null, cuanto = '' } = {}) {
  const nombre = carta ? nombreDeCarta(carta) : fila.card_id
  const escaneo = carta ? atributosDeEscaneo(cadenaDeEscaneo(carta)) : null
  const set = carta ? `${nombreDeSet(carta.tcg_sets) || carta.set_id || ''}${carta.local_id ? ` · ${carta.local_id}` : ''}` : ''
  const idiomas = fila.idiomas.length ? fila.idiomas.map((i) => idiomaDe(i).nombre).join(', ') : 'cualquier idioma'
  const estados = fila.estados.length ? ` · ${fila.estados.map((e) => estadoDe(e).nombre).join(', ')}` : ''
  return `<li class="pc-carta">
    <a class="pc-carta-foto" href="${carta ? escapeHtml(rutaDeCarta(carta)) : '#'}" aria-label="${escapeHtml(nombre)}">
      ${sello ? `<span class="pc-sello${sello === 'La das' ? ' pc-sello-das' : sello === 'La tienes' ? ' pc-sello-tienes' : ''}">${escapeHtml(sello)}</span>` : ''}
      <span class="pc-carta-sinfoto">${escapeHtml(nombre)}</span>
      ${escaneo ? `<img ${escaneo} alt="" width="245" height="342" loading="lazy">` : ''}
    </a>
    <span class="pc-carta-nombre">${escapeHtml(nombre)}</span>
    ${set ? `<span class="pc-carta-set">${escapeHtml(set)}</span>` : ''}
    <span class="pc-carta-senas">${escapeHtml(`${cuanto}${idiomas}${estados}`)}</span>
    ${precio ? `<span class="pc-carta-precio">${escapeHtml(precio)}</span>` : ''}
  </li>`
}

function rejillaHtml(id, baldosas, total) {
  const resto = total - Math.min(total, DE_PRIMERAS)
  return `<ul class="pc-rejilla" id="${id}">${baldosas.join('')}</ul>
    ${resto > 0 ? `<button type="button" class="btn-secondary pc-ver-todas" data-ver-todas="${id}">Ver las ${total}</button>` : ''}`
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

  const baldosasDa = filasDa.map((f) => baldosaHtml(f, cartaDe(f), { sello: miId && !propia ? selloDeLoQueDa(f, mio.deseos) : null, precio: euros(precioDeFilaDeCambio(precios, f)), cuanto: `${f.total === 1 ? 'Da 1' : `Da ${f.total}`} · ` }))
  const baldosasBusca = filasBusca.map((f) => baldosaHtml(f, cartaDe(f), { sello: miId && !propia ? selloDeLoQueBusca(f, mio.lineas) : null, precio: euros(precioDeFilaDeCambio(precios, f)) }))

  caja.innerHTML = `
    ${miId && !propia ? '<section class="perfil-cruce pc-cruce" id="pcCruce" aria-label="Vuestro cruce"></section>' : ''}
    ${!miId && !propia ? `<p class="pc-entra subtext"><a href="/auth.html?volver=${encodeURIComponent(location.pathname + location.search)}">Entra</a> y te digo qué te puede dar ${escapeHtml(nombre)} y qué le puedes dar tú.</p>` : ''}
    <section class="pc-bloque" aria-label="${escapeHtml(`${quien} ${cuentas.da} cartas`)}">
      <h2 class="section-title">${quien} ${cuentas.da === 1 ? '1 carta' : `${cuentas.da} cartas`}</h2>
      ${da.sinMigracion ? `<p class="subtext">Lo que da todavía no se puede enseñar: falta ejecutar <code>${FICHERO_MIGRACION}</code>.</p>` : ''}
      ${cuentas.da ? rejillaHtml('pcRejillaDa', baldosasDa, cuentas.da) : (!da.sinMigracion ? vaciaHtml(propia, { daVacio: true, buscaVacio: false }) : '')}
    </section>
    <section class="pc-bloque" aria-label="${escapeHtml(`${quienBusca} ${cuentas.busca} cartas`)}">
      <h2 class="section-title">${quienBusca} ${cuentas.busca === 1 ? '1 carta' : `${cuentas.busca} cartas`}</h2>
      ${cuentas.busca ? rejillaHtml('pcRejillaBusca', baldosasBusca, cuentas.busca) : vaciaHtml(propia, { daVacio: false, buscaVacio: true })}
    </section>`

  // Las que pasan de DE_PRIMERAS nacen escondidas; «Ver las N» las enseña.
  for (const ul of caja.querySelectorAll('.pc-rejilla')) [...ul.children].forEach((li, i) => { if (i >= DE_PRIMERAS) li.hidden = true })
  caja.querySelectorAll('[data-ver-todas]').forEach((b) => b.addEventListener('click', () => {
    for (const li of document.getElementById(b.dataset.verTodas)?.children || []) li.hidden = false
    b.remove()
  }))

  // Vuestro cruce, arriba: el de la 794, siempre y no solo por el QR, con
  // «Escribir» y el mensaje redactado.
  if (miId && !propia) {
    import('./cruce-persona.js').then((m) => m.pintarCruce(document.getElementById('pcCruce'), persona, sesion, { escribir: true })).catch(() => {})
  }
  return cuentas
}
