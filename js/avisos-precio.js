// «Avísame» de una carta (tanda 665): el botón en el bloque de precio y
// el pequeño diálogo donde se pone «si baja de X €» o «si sube de X €».
//
// Lo comparten /carta y la ficha de /mi-coleccion, como el bloque de
// precio. Guarda en `user_price_alerts` (la RLS deja a cada uno los
// suyos); los dispara la función programada `avisos-precio`, que deja la
// notificación en la campanita (y de ahí el push) y un correo.
import { supabase } from './supabase.js'
import { escapeHtml } from './html.js'
import { showToast } from './toast.js'
import { icons } from './icons.js'
import { euros, idiomaDe } from './cardmarket.js'

export function botonDeAvisoHtml(cardId) {
  if (!cardId) return ''
  return `<button type="button" class="btn-secondary pv-aviso" data-aviso="${escapeHtml(cardId)}">${icons.bell(16)}<span>Avísame</span></button>`
}

const $ = (id) => document.getElementById(id)
let abierto = null

function dialogo() {
  let d = $('pvAvisoDialogo')
  if (d) return d
  document.body.insertAdjacentHTML('beforeend', `
    <dialog class="pv-aviso-dialogo" id="pvAvisoDialogo" aria-labelledby="pvAvisoTitulo">
      <form method="dialog" class="pv-aviso-form" id="pvAvisoForm">
        <div class="pv-aviso-cab">
          <h2 id="pvAvisoTitulo">Avísame de esta carta</h2>
          <button type="button" class="pv-aviso-cerrar" id="pvAvisoCerrar" aria-label="Cerrar">${icons.xCircle(18)}</button>
        </div>
        <p class="subtext" id="pvAvisoAhora"></p>
        <div class="pv-aviso-tipos" role="radiogroup" aria-label="Cuándo avisar">
          <label class="pv-aviso-tipo"><input type="radio" name="tipo" value="baja" checked /> <span>Si baja de</span></label>
          <label class="pv-aviso-tipo"><input type="radio" name="tipo" value="sube" /> <span>Si sube de</span></label>
        </div>
        <label class="pv-aviso-umbral">
          <span>Precio (€)</span>
          <input type="number" id="pvAvisoUmbral" name="umbral" min="0.01" step="0.01" inputmode="decimal" required />
        </label>
        <p class="subtext">Se mira el mínimo en Cardmarket en <b id="pvAvisoIdioma"></b>, una vez cada hora. Te llega a la campanita, al móvil si tienes los avisos puestos, y al correo.</p>
        <div class="pv-aviso-lista" id="pvAvisoLista"></div>
        <div class="pv-aviso-pie">
          <button type="button" class="btn-secondary" id="pvAvisoCancelar">Cancelar</button>
          <button type="submit" class="btn-primary" id="pvAvisoGuardar">Guardar aviso</button>
        </div>
      </form>
    </dialog>`)
  d = $('pvAvisoDialogo')
  $('pvAvisoCerrar').addEventListener('click', () => d.close())
  $('pvAvisoCancelar').addEventListener('click', () => d.close())
  $('pvAvisoForm').addEventListener('submit', (e) => { e.preventDefault(); void guardar() })
  $('pvAvisoLista').addEventListener('click', (e) => {
    const b = e.target.closest('[data-quitar-aviso]')
    if (b) void quitar(b.dataset.quitarAviso)
  })
  return d
}

const sinMigracion = (error) => /user_price_alerts|42P01|PGRST205|schema cache/i.test(String(error?.message || error?.code || ''))

async function pintarLista() {
  const caja = $('pvAvisoLista')
  if (!caja || !abierto) return
  const { data, error } = await supabase.from('user_price_alerts').select('id,tipo,umbral,idioma,activo,disparado_at,precio_disparo').eq('card_id', abierto.cardId).order('created_at', { ascending: false }).limit(10)
  if (error) {
    caja.innerHTML = sinMigracion(error) ? '<p class="subtext">Los avisos todavía no están puestos en la base (falta la migración).</p>' : ''
    return
  }
  const filas = data || []
  caja.innerHTML = filas.length
    ? `<p class="pv-aviso-lista-titulo">Tus avisos de esta carta</p>${filas.map((a) => `<div class="pv-aviso-fila${a.activo ? '' : ' apagado'}"><span>${a.tipo === 'baja' ? 'Si baja de' : 'Si sube de'} <b>${escapeHtml(euros(Number(a.umbral)))}</b> · ${escapeHtml(idiomaDe(a.idioma).nombre.toLowerCase())}${a.activo ? '' : ` · avisado${a.precio_disparo ? ` a ${escapeHtml(euros(Number(a.precio_disparo)))}` : ''}`}</span><button type="button" class="pv-aviso-quitar" data-quitar-aviso="${escapeHtml(a.id)}" aria-label="Quitar este aviso">${icons.trash ? icons.trash(14) : 'Quitar'}</button></div>`).join('')}`
    : ''
}

async function guardar() {
  if (!abierto) return
  const d = $('pvAvisoDialogo')
  const tipo = d.querySelector('input[name="tipo"]:checked')?.value || 'baja'
  const umbral = Number($('pvAvisoUmbral').value)
  if (!(umbral > 0)) { showToast('Pon un precio mayor que cero.'); return }
  const { data: { session } = {} } = await supabase.auth.getSession()
  if (!session) { showToast('Entra con tu cuenta para pedir avisos.'); return }
  $('pvAvisoGuardar').disabled = true
  const { error } = await supabase.from('user_price_alerts').insert({ user_id: session.user.id, card_id: abierto.cardId, market: abierto.market || 'WEST', idioma: abierto.idioma || 'es', tipo, umbral })
  $('pvAvisoGuardar').disabled = false
  if (error) {
    showToast(sinMigracion(error) ? 'Falta ejecutar supabase-migration-avisos-precio.sql en Supabase.' : `No se ha podido guardar: ${error.message}`)
    return
  }
  showToast(`Aviso puesto: te avisaré si ${tipo === 'baja' ? 'baja de' : 'sube de'} ${euros(umbral)}.`, 'success')
  await pintarLista()
}

async function quitar(id) {
  const { error } = await supabase.from('user_price_alerts').delete().eq('id', id)
  if (error) { showToast(`No se ha podido quitar: ${error.message}`); return }
  await pintarLista()
}

// Abre el diálogo para una carta. `precio` es el mínimo actual en el
// idioma (o null), para proponer un umbral: un 10 % por debajo.
export function abrirAviso({ cardId, market = 'WEST', idioma = 'es', precio = null }) {
  abierto = { cardId, market, idioma }
  const d = dialogo()
  $('pvAvisoAhora').textContent = precio ? `Ahora está a ${euros(precio)} (mínimo en ${idiomaDe(idioma).nombre.toLowerCase()}).` : 'Todavía no tiene precio guardado; el aviso saltará cuando lo tenga y cumpla.'
  $('pvAvisoIdioma').textContent = idiomaDe(idioma).nombre.toLowerCase()
  $('pvAvisoUmbral').value = precio ? (Math.floor(precio * 0.9 * 100) / 100).toFixed(2) : ''
  d.querySelector('input[name="tipo"][value="baja"]').checked = true
  $('pvAvisoLista').innerHTML = ''
  d.showModal()
  void pintarLista()
}

// Delegado en la zona donde se pinta el bloque de precio: ese bloque se
// repinta entero al cambiar de idioma o de versión, así que el oyente va
// en el contenedor y no en el botón. `datos()` se consulta al pulsar.
export function engancharAvisos(zona, datos) {
  if (!zona || zona.dataset.avisos) return
  zona.dataset.avisos = '1'
  zona.addEventListener('click', (e) => {
    const b = e.target.closest('[data-aviso]')
    if (!b) return
    e.preventDefault()
    abrirAviso({ cardId: b.dataset.aviso, ...(typeof datos === 'function' ? datos() : datos || {}) })
  })
}
