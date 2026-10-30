// El pop-up de un logro (tanda 1117, PINGU: «cuando cliques en uno te salga
// un pop-up con ese logro y qué has hecho para conseguirlo o cuál es el
// objetivo»). Lo abren las dos fichas de persona (/perfil y /usuario) al tocar
// un logro de la rejilla o la chapa del destacado. Centrado en el PC, hoja
// desde abajo en el móvil (la regla de la 1045); el CSS vive en perfil.css.
import { supabase } from './supabase.js'
import { escapeHtml, achievementIconHtml } from './app.js'
import { icons } from './icons.js'
import { showToast } from './toast.js'
import { objetivoDeLogro, RAREZAS, textoDeReparto } from './logro-objetivo.js'

let dialogo = null
let reparto = null

function crearDialogo() {
  const d = document.createElement('dialog')
  d.className = 'logro-ficha'
  d.setAttribute('aria-labelledby', 'logroFichaTitulo')
  document.body.append(d)
  d.addEventListener('click', (e) => {
    if (e.target === d || e.target.closest('[data-logro-cerrar]')) d.close()
  })
  return d
}

// Cuánta gente lo tiene: una llamada por visita, la misma de la rejilla.
async function textoDeRepartoDe(id) {
  reparto ??= supabase.rpc('logros_reparto').then(({ data, error }) => (error ? [] : data || []), () => [])
  const fila = (await reparto).find((f) => f.id === id)
  return fila ? textoDeReparto(Number(fila.personas), Number(fila.total)) : ''
}

// `tiene`: si esta persona lo tiene. `propia`: si es tu perfil (entonces se
// puede destacar y compartir). `nombre`: cómo se llama, para «Lo tiene X».
export function abrirLogro(logro, { tiene = false, propia = false, nombre = '', destacado = false, alDestacar } = {}) {
  if (!logro) return
  dialogo ??= crearDialogo()
  const rareza = logro.rarity || 'bronze'
  const objetivo = objetivoDeLogro(logro)
  const estado = tiene
    ? `${icons.checkCircle(16)} ${propia ? 'Lo tienes' : `Lo tiene ${escapeHtml(nombre || 'esta persona')}`}`
    : `${icons.lock(16)} ${propia ? 'Aún no lo tienes' : `${escapeHtml(nombre || 'Esta persona')} aún no lo tiene`}`
  // Con el logro, lo que hiciste (la descripción, en pasado); sin él, lo
  // que hay que hacer. Si no se sabe decir el objetivo, la descripción.
  const cuerpo = tiene
    ? `<h3>${propia ? 'Lo que hiciste' : 'Lo que hizo'}</h3><p>${escapeHtml(logro.description || objetivo || '')}</p>`
    : `<h3>Cómo se consigue</h3><p>${escapeHtml(objetivo || logro.description || 'Sigue usando PokeDoc: este se da a mano.')}</p>`
  dialogo.innerHTML = `
    <button type="button" class="logro-ficha-cerrar" data-logro-cerrar aria-label="Cerrar">✕</button>
    <div class="logro-ficha-cuerpo">
      <span class="logro-ficha-icono icon rarity-${escapeHtml(rareza)}${tiene ? '' : ' bloqueado'}">${tiene ? achievementIconHtml(logro, 40) : icons.lock(36)}</span>
      <h2 id="logroFichaTitulo">${escapeHtml(logro.title)}</h2>
      <p class="logro-ficha-chapas"><span class="rarity-chip rarity-${escapeHtml(rareza)}">${RAREZAS[rareza] || escapeHtml(rareza)}</span><span>+${Number(logro.xp_reward) || 0} XP</span></p>
      <p class="logro-ficha-estado${tiene ? ' tiene' : ''}">${estado}</p>
      <div class="logro-ficha-texto">${cuerpo}</div>
      <p class="logro-ficha-reparto" data-reparto hidden></p>
      ${propia && tiene ? `<div class="logro-ficha-acciones">
        <button type="button" class="btn-secondary" data-logro-destacar ${destacado ? 'disabled' : ''}>${icons.star(14)} ${destacado ? 'Es tu logro destacado' : 'Destacar en mi perfil'}</button>
        <button type="button" class="btn-primary" data-logro-compartir>${icons.share(14)} Compartir</button>
      </div>` : ''}
    </div>`
  textoDeRepartoDe(logro.id).then((t) => {
    const p = dialogo.querySelector('[data-reparto]')
    if (p && t) {
      p.textContent = `${t} de la gente de PokeDoc.`
      p.hidden = false
    }
  })
  dialogo.querySelector('[data-logro-compartir]')?.addEventListener('click', async () => {
    const { compartirLogro } = await import('./logro-compartir.js')
    compartirLogro(logro)
  })
  const destacar = dialogo.querySelector('[data-logro-destacar]')
  destacar?.addEventListener('click', async () => {
    // Cambia ya y deshace si la base dice que no (la regla de la 896).
    const antes = destacar.innerHTML
    destacar.disabled = true
    destacar.innerHTML = `${icons.star(14)} Es tu logro destacado`
    const { data: s } = await supabase.auth.getSession()
    const uid = s?.session?.user?.id
    const { error } = uid ? await supabase.from('user_profiles').update({ showcase_achievement: logro.id }).eq('id', uid) : { error: true }
    if (error) {
      destacar.disabled = false
      destacar.innerHTML = antes
      showToast('No se ha podido destacar. Inténtalo otra vez.')
      return
    }
    showToast('Ahora es tu logro destacado.', 'success')
    alDestacar?.(logro)
  })
  if (!dialogo.open) dialogo.showModal()
}
