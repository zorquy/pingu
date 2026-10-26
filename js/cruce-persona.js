// El cruce con UNA persona (tanda 794, NU5): lo que ve quien escanea el QR
// del modo evento. «Te puede dar» y «le puedes dar», sin buscarla en Cruces.
// Sale de los mismos datos que el tablón (quienTiene / quienBusca), filtrados
// por ella.
import { escapeHtml } from './html.js'
import { hojaInyectada } from './hoja.js'
import { rutaDeCarta } from './carta-ruta.js'
import { nombreDeCarta } from './catalogo-series.js'
import { cadenaDeEscaneo, atributosDeEscaneo } from './escaneo-carta.js'

export function cruceCon(personaId, tiene, busca) {
  const suyo = (f) => f.user_id === personaId
  return { teDa: (tiene || []).filter(suyo), leDas: (busca || []).filter(suyo) }
}

function lista(filas, cartas) {
  const vistas = new Set()
  return filas.filter((f) => !vistas.has(f.card_id) && vistas.add(f.card_id)).slice(0, 12).map((f) => {
    const c = cartas.get(f.card_id) || { id: f.card_id }
    return `<li><a href="${escapeHtml(rutaDeCarta(c))}">${escapeHtml(nombreDeCarta(c) || f.card_id)}</a></li>`
  }).join('')
}

// En el perfil (939), las cartas en pequeño: se reconocen antes que un
// nombre. Hasta ocho y «+N».
function miniaturas(filas, cartas) {
  const vistas = new Set()
  const unicas = filas.filter((f) => !vistas.has(f.card_id) && vistas.add(f.card_id))
  return `${unicas.slice(0, 8).map((f) => {
    const c = cartas.get(f.card_id) || { id: f.card_id }
    const nombre = nombreDeCarta(c) || f.card_id
    const escaneo = c.set_id ? atributosDeEscaneo(cadenaDeEscaneo(c)) : null
    return `<li><a class="perfil-cruce-mini" href="${escapeHtml(rutaDeCarta(c))}" title="${escapeHtml(nombre)}" aria-label="${escapeHtml(nombre)}">${escaneo ? `<img ${escaneo} alt="" width="245" height="342" loading="lazy" />` : `<span>${escapeHtml(nombre)}</span>`}</a></li>`
  }).join('')}${unicas.length > 8 ? `<li class="perfil-cruce-mas">+${unicas.length - 8}</li>` : ''}`
}

// El mensaje redactado con las dos listas (887): el mismo borrador que
// escribe Cruces (`borradorDeCruce`), abierto en la conversación.
async function enlaceParaEscribir(persona, teDa, leDas, cartas) {
  let texto = ''
  try {
    const { borradorDeCruce } = await import('./mi-coleccion/borrador-cruce.js')
    const conCarta = (filas) => filas.map((f) => ({ ...f, carta: cartas.get(f.card_id) || { id: f.card_id } }))
    texto = borradorDeCruce(conCarta(teDa), conCarta(leDas))
  } catch { /* sin borrador, la conversación se abre vacía */ }
  return `/mensajes.html?with=${encodeURIComponent(persona.id)}${texto ? `&texto=${encodeURIComponent(texto)}` : ''}`
}

export async function pintarCruce(caja, persona, sesion, { soloSiHay = false, escribir = false, miniaturas: conMiniaturas = false } = {}) {
  if (!caja || !persona) return
  hojaInyectada('css/cruce-persona.css')
  if (!soloSiHay) caja.classList.remove('hidden')
  // Sin cuenta (1030): las listas se ven igual, debajo, en Cambios; aquí la
  // puerta. Crear la cuenta vuelve a esta misma página, ya con el cruce.
  if (!sesion) {
    const volver = encodeURIComponent(location.pathname + location.search)
    const nombre = escapeHtml(persona.display_name || persona.username || 'esta persona')
    caja.innerHTML = `<h2>¿Tienes alguna de estas?</h2><p class="subtext">Crea tu cuenta en PokeDoc, apunta tus cartas y te decimos qué os podéis cambiar ${nombre} y tú.</p><div class="perfil-cruce-acciones"><a class="btn-primary" href="/auth.html?registro=1&volver=${volver}">Crear cuenta</a><a class="btn-secondary" href="/auth.html?volver=${volver}">Ya tengo cuenta</a></div>`
    return
  }
  if (sesion.user.id === persona.id) {
    caja.innerHTML = '<h2>Tu QR funciona</h2><p class="subtext">Quien lo escanee verá aquí lo que os podéis cambiar.</p>'
    return
  }
  if (!soloSiHay) caja.innerHTML = '<h2>Vuestro cruce</h2><p class="subtext">Mirando lo que os podéis cambiar…</p>'
  try {
    const { quienTiene, quienBusca } = await import('./mi-coleccion/cambios.js')
    const { cartasPorClaves, claveDeCarta } = await import('./mi-coleccion/datos.js')
    const [tiene, busca] = await Promise.all([quienTiene(500), quienBusca(500)])
    const { teDa, leDas } = cruceCon(persona.id, tiene, busca)
    const mapa = await cartasPorClaves([...teDa, ...leDas]).catch(() => new Map())
    const cartas = new Map([...teDa, ...leDas].map((f) => [f.card_id, mapa.get(claveDeCarta(f.card_id, f.market)) || mapa.get(f.card_id)]).filter(([, c]) => c))
    const nombre = escapeHtml(persona.display_name || persona.username || 'Esta persona')
    // En una conversación (798, PA13) solo sale si hay algo que cambiar.
    if (soloSiHay && !teDa.length && !leDas.length) { caja.classList.add('hidden'); return }
    caja.classList.remove('hidden')
    caja.innerHTML = `<h2>Vuestro cruce</h2>
      ${!teDa.length && !leDas.length ? `<p class="subtext">Ahora mismo no os cuadra nada: ni ${nombre} da algo de tu lista ni busca algo que tú des.</p>` : ''}
      <div class="perfil-cruce-lados">
        ${teDa.length ? `<div><h3>Te puede dar · ${new Set(teDa.map((f) => f.card_id)).size}</h3><ul${conMiniaturas ? ' class="perfil-cruce-minis"' : ''}>${(conMiniaturas ? miniaturas : lista)(teDa, cartas)}</ul></div>` : ''}
        ${leDas.length ? `<div><h3>Le puedes dar · ${new Set(leDas.map((f) => f.card_id)).size}</h3><ul${conMiniaturas ? ' class="perfil-cruce-minis"' : ''}>${(conMiniaturas ? miniaturas : lista)(leDas, cartas)}</ul></div>` : ''}
      </div>
      <div class="perfil-cruce-acciones">
        ${escribir ? '<button type="button" class="btn-primary" data-cruce-proponer>Proponer cambio</button>' : ''}
        ${escribir && (teDa.length || leDas.length) ? `<a class="btn-secondary" href="${escapeHtml(await enlaceParaEscribir(persona, teDa, leDas, cartas))}">Escribir a ${nombre}</a>` : ''}
        ${teDa.length || leDas.length ? '<a class="btn-secondary" href="/mi-coleccion?ver=cruces">Ver todos tus cruces</a>' : ''}
      </div>`
    // «Proponer cambio» (942), ya relleno con lo que os cruzáis.
    caja.querySelector('[data-cruce-proponer]')?.addEventListener('click', async () => {
      const fila = (f) => ({ card_id: f.card_id, market: f.market || cartas.get(f.card_id)?.market || 'WEST', idioma: f.idioma || null })
      const m = await import('./cambio-propuesta.js')
      await m.abrirPropuesta({ sesion, otro: persona, prefill: { suyas: teDa.map(fila), mias: leDas.map(fila) } })
    })
  } catch (e) {
    if (soloSiHay) return
    caja.innerHTML = `<h2>Vuestro cruce</h2><p class="subtext">${escapeHtml(e.sinMigracion ? 'Los cambios todavía no están puestos en la base.' : 'No se ha podido mirar ahora. Prueba otra vez en un momento.')}</p>`
  }
}
