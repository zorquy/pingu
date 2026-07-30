import { escapeHtml } from './app.js'

// BBCode al viejo estilo de foro: [b] [i] [u] [url=...] [list][*]...[/list]
// Se escapa el HTML primero, así que las etiquetas que generamos aquí son
// las únicas que pueden acabar en el DOM — no hay forma de inyectar HTML
// a través del texto del usuario.
export function parseBBCode(text) {
  let html = escapeHtml(text || '')

  html = html.replace(/\[b\]([\s\S]*?)\[\/b\]/gi, '<strong>$1</strong>')
  html = html.replace(/\[i\]([\s\S]*?)\[\/i\]/gi, '<em>$1</em>')
  html = html.replace(/\[u\]([\s\S]*?)\[\/u\]/gi, '<u>$1</u>')

  html = html.replace(/\[url=([^\]]+)\]([\s\S]*?)\[\/url\]/gi, (match, url, label) => {
    const clean = url.trim()
    if (!/^https?:\/\//i.test(clean)) return label
    return `<a href="${clean.replace(/"/g, '&quot;')}" target="_blank" rel="noopener noreferrer">${label}</a>`
  })

  html = html.replace(/\[list\]([\s\S]*?)\[\/list\]/gi, (match, inner) => {
    const items = inner
      .split(/\[\*\]/)
      .map((s) => s.trim())
      .filter(Boolean)
    return `<ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>`
  })

  return html.replace(/\n/g, '<br>')
}

export const BBCODE_BUTTONS = [
  { tag: 'b', label: 'B', title: 'Negrita', before: '[b]', after: '[/b]' },
  { tag: 'i', label: 'I', title: 'Cursiva', before: '[i]', after: '[/i]' },
  { tag: 'u', label: 'U', title: 'Subrayado', before: '[u]', after: '[/u]' },
  { tag: 'url', label: '🔗', title: 'Enlace', before: '[url=https://]', after: '[/url]' },
  { tag: 'list', label: '•', title: 'Lista', before: '[list]\n[*]', after: '\n[/list]' },
]

export function bbcodeToolbarHtml(targetId) {
  return `
    <div class="bbcode-toolbar" data-target="${targetId}">
      ${BBCODE_BUTTONS.map((b) => `<button type="button" data-tag="${b.tag}" title="${b.title}">${b.label}</button>`).join('')}
    </div>`
}

export function wireBBCodeToolbars(containerEl) {
  containerEl.querySelectorAll('.bbcode-toolbar').forEach((toolbar) => {
    const textarea = containerEl.querySelector(`#${CSS.escape(toolbar.dataset.target)}`)
    if (!textarea) return
    toolbar.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', () => {
        const def = BBCODE_BUTTONS.find((b) => b.tag === btn.dataset.tag)
        const start = textarea.selectionStart ?? textarea.value.length
        const end = textarea.selectionEnd ?? textarea.value.length
        const selected = textarea.value.slice(start, end)
        const inserted = `${def.before}${selected}${def.after}`
        textarea.value = textarea.value.slice(0, start) + inserted + textarea.value.slice(end)
        textarea.focus()
        const cursor = start + def.before.length + selected.length
        textarea.setSelectionRange(cursor, cursor)
        textarea.dispatchEvent(new Event('input', { bubbles: true }))
      })
    })
  })
}
