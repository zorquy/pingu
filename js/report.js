import { supabase } from './supabase.js'
import { showToast } from './toast.js'

export function reportButtonHtml(contentType, contentId) {
  return `<button class="report-btn" data-report-type="${contentType}" data-report-id="${contentId}" title="Reportar">🚩</button>`
}

export function wireReportButtons(containerEl, session) {
  containerEl.querySelectorAll('.report-btn').forEach((btn) =>
    btn.addEventListener('click', async () => {
      if (!session) {
        window.location.href = '/auth.html'
        return
      }
      const reason = window.prompt('¿Por qué reportas este contenido? (opcional)')
      if (reason === null) return
      const { error } = await supabase.from('content_reports').insert({
        reporter_id: session.user.id,
        content_type: btn.dataset.reportType,
        content_id: btn.dataset.reportId,
        reason: reason.trim() || null,
      })
      showToast(error ? 'No se pudo enviar el reporte: ' + error.message : 'Gracias, hemos recibido tu reporte.', error ? 'error' : 'success')
    })
  )
}
