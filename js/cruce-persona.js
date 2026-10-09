// El cruce con UNA persona (tanda 794, NU5): lo que ve quien escanea el QR
// del modo feria. «Te puede dar» y «le puedes dar», sin buscarla en Cruces.
// Sale de los mismos datos que el tablón (quienTiene / quienBusca), filtrados
// por ella.
import { escapeHtml } from './html.js'
import { hojaInyectada } from './hoja.js'
import { rutaDeCarta } from './carta-ruta.js'
import { nombreDeCarta } from './catalogo-series.js'

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

export async function pintarCruce(caja, persona, sesion, { soloSiHay = false } = {}) {
  if (!caja || !persona) return
  hojaInyectada('css/cruce-persona.css')
  if (!soloSiHay) caja.classList.remove('hidden')
  if (!sesion) {
    caja.innerHTML = `<h2>Vuestro cruce</h2><p class="subtext"><a href="/auth.html?volver=${encodeURIComponent(location.pathname + location.search)}">Entra</a> y te digo qué te puede dar ${escapeHtml(persona.display_name || persona.username || 'esta persona')} y qué le puedes dar tú.</p>`
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
        ${teDa.length ? `<div><h3>Te puede dar · ${new Set(teDa.map((f) => f.card_id)).size}</h3><ul>${lista(teDa, cartas)}</ul></div>` : ''}
        ${leDas.length ? `<div><h3>Le puedes dar · ${new Set(leDas.map((f) => f.card_id)).size}</h3><ul>${lista(leDas, cartas)}</ul></div>` : ''}
      </div>
      ${teDa.length || leDas.length ? '<a class="btn-secondary" href="/mi-coleccion?ver=cruces">Ver todos tus cruces</a>' : ''}`
  } catch (e) {
    if (soloSiHay) return
    caja.innerHTML = `<h2>Vuestro cruce</h2><p class="subtext">${escapeHtml(e.sinMigracion ? 'Los cambios todavía no están puestos en la base.' : 'No se ha podido mirar ahora. Prueba otra vez en un momento.')}</p>`
  }
}
