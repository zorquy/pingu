// /mazos: los mazos guardados de quien ha entrado. Abrir, duplicar,
// borrar. Montar uno nuevo es cosa de /constructor.
import { requireAuth, escapeHtml } from './app.js'
import { showToast } from './toast.js'
import { cardImageUrl } from './tcgdex.js'
import { misMazos, cartasPorIds, borrarMazo, guardarMazo } from './constructor/datos.js'

const $ = (id) => document.getElementById(id)
const FORMATOS = { standard: 'Estándar', expanded: 'Expandido', libre: 'Libre' }

function haceCuanto(iso) {
  const min = Math.round((Date.now() - Date.parse(iso)) / 60000)
  if (min < 1) return 'ahora mismo'
  if (min < 60) return `hace ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `hace ${h} h`
  const d = Math.round(h / 24)
  if (d < 31) return `hace ${d} ${d === 1 ? 'día' : 'días'}`
  return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
}

let mazos = []
let portadas = new Map()

function tarjetaHtml(m) {
  const total = (m.cards || []).reduce((s, c) => s + (c.n || 0), 0)
  const portada = portadas.get(m.cover_card) || portadas.get(m.cards?.[0]?.id)
  const url = portada ? cardImageUrl(portada.image_path, 'low') : null
  return `
    <article class="cm-mazo-tarjeta" data-id="${escapeHtml(m.id)}">
      <a class="cm-mazo-portada" href="/constructor?mazo=${escapeHtml(m.id)}" aria-hidden="true" tabindex="-1">
        ${url ? `<img src="${escapeHtml(url)}" alt="" width="245" height="342" loading="lazy" onerror="this.remove()" />` : ''}
      </a>
      <div class="cm-mazo-info">
        <a class="cm-mazo-nombre" href="/constructor?mazo=${escapeHtml(m.id)}">${escapeHtml(m.name)}</a>
        <p class="cm-mazo-meta subtext">${total}/60 cartas · ${FORMATOS[m.format] || m.format} · ${haceCuanto(m.updated_at)}</p>
        <p>${m.is_public ? '<span class="cm-chapa cm-chapa-publico">Público</span>' : '<span class="cm-chapa">Privado</span>'}</p>
        <div class="cm-mazo-acciones">
          <button type="button" class="link-btn" data-duplicar>Duplicar</button>
          <button type="button" class="link-btn" data-borrar>Borrar</button>
        </div>
      </div>
    </article>`
}

function pintar() {
  $('mzCargando').classList.add('hidden')
  $('mzVacio').classList.toggle('hidden', mazos.length > 0)
  $('mzLista').innerHTML = mazos.map(tarjetaHtml).join('')
}

async function iniciar() {
  const sesion = await requireAuth()
  if (!sesion) return
  try {
    mazos = await misMazos(sesion.user.id)
    const ids = mazos.map((m) => m.cover_card || m.cards?.[0]?.id).filter(Boolean)
    portadas = await cartasPorIds(ids).catch(() => new Map())
    pintar()
  } catch (err) {
    $('mzCargando').classList.add('hidden')
    const aviso = $('cmAviso')
    aviso.textContent = err.message || 'No se han podido cargar tus mazos.'
    aviso.classList.remove('hidden')
  }

  $('mzLista').addEventListener('click', async (e) => {
    const tarjeta = e.target.closest('[data-id]')
    if (!tarjeta) return
    const mazo = mazos.find((m) => m.id === tarjeta.dataset.id)
    if (!mazo) return
    if (e.target.closest('[data-borrar]')) {
      // confirm() a propósito: borrar no se puede deshacer.
      if (!window.confirm(`¿Borrar «${mazo.name}»? No se puede deshacer.`)) return
      try {
        await borrarMazo(mazo.id)
        mazos = mazos.filter((m) => m.id !== mazo.id)
        pintar()
        showToast('Mazo borrado.', 'success')
      } catch (err) {
        showToast(err.message, 'error')
      }
    } else if (e.target.closest('[data-duplicar]')) {
      try {
        const copia = await guardarMazo({ name: `${mazo.name} (copia)`.slice(0, 80), format: mazo.format, cards: mazo.cards, cover_card: mazo.cover_card, is_public: false })
        mazos.unshift(copia)
        pintar()
        showToast('Mazo duplicado.', 'success')
      } catch (err) {
        showToast(err.message, 'error')
      }
    }
  })
}

iniciar()
