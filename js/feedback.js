import { supabase } from './supabase.js'
import { getSession } from './app.js'
import { showToast } from './toast.js'

function renderFeedbackModal() {
  if (document.getElementById('feedbackModal')) return

  const overlay = document.createElement('div')
  overlay.className = 'modal-overlay hidden'
  overlay.id = 'feedbackModal'
  overlay.innerHTML = `
    <div class="modal-box">
      <button type="button" class="modal-close" id="feedbackModalClose" aria-label="Cerrar">×</button>
      <h2>Enviar feedback</h2>
      <p class="subtext">¿Algo no funciona o se te ocurre una mejora? Cuéntanoslo, nos ayuda a mejorar PokeDoc.</p>
      <div class="form-group">
        <textarea id="feedbackBody" rows="5" placeholder="Escribe aquí…" maxlength="2000"></textarea>
      </div>
      <button type="button" class="btn-primary" id="feedbackSubmit">Enviar</button>
    </div>`
  document.body.appendChild(overlay)

  function close() {
    overlay.classList.add('hidden')
    document.getElementById('feedbackBody').value = ''
  }

  document.getElementById('feedbackModalClose').addEventListener('click', close)
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close()
  })
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !overlay.classList.contains('hidden')) close()
  })

  document.getElementById('feedbackSubmit').addEventListener('click', async () => {
    const body = document.getElementById('feedbackBody').value.trim()
    if (!body) return
    const session = await getSession()
    if (!session) {
      window.location.href = '/auth.html'
      return
    }
    const { error } = await supabase.from('app_feedback').insert({
      user_id: session.user.id,
      body,
      page_url: window.location.pathname,
    })
    showToast(error ? 'No se pudo enviar: ' + error.message : '¡Gracias! Hemos recibido tu feedback.', error ? 'error' : 'success')
    if (!error) close()
  })
}

export function openFeedbackModal() {
  renderFeedbackModal()
  document.getElementById('feedbackModal').classList.remove('hidden')
}
