// Selector de emoji sencillo para el campo de "emoji de portada" de las
// guías: en vez de tener que ir a buscar el emoji en Google y pegarlo,
// esto añade un botón junto al input que abre una rejilla de emojis
// habituales en el tema de la web (cartas, lupa, escudo, rareza...) — el
// input de texto se deja intacto por si alguien prefiere pegar otro.

const EMOJI_OPTIONS = [
  '📘', '📗', '📙', '📕', '📖', '🗂️', '🔍', '🔎', '🛡️', '⭐',
  '🌟', '✨', '💎', '🃏', '🎴', '🏆', '🏅', '🎯', '💰', '🧾',
  '📦', '🔖', '🕵️', '⚡', '🔥', '💧', '🌿', '🐉', '👑', '🎨',
  '🔬', '📐', '✅', '⚠️', '💡', '📌',
]

export function attachEmojiPicker(input) {
  if (!input || input.dataset.emojiPickerAttached) return
  input.dataset.emojiPickerAttached = '1'

  const wrap = document.createElement('div')
  wrap.className = 'emoji-picker-wrap'
  input.parentNode.insertBefore(wrap, input)
  wrap.appendChild(input)

  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'emoji-picker-btn'
  btn.textContent = input.value.trim() || '🙂'
  btn.setAttribute('aria-label', 'Elegir emoji de una lista')
  btn.setAttribute('title', 'Elegir emoji de una lista')
  wrap.appendChild(btn)

  const panel = document.createElement('div')
  panel.className = 'emoji-picker-panel hidden'
  panel.setAttribute('role', 'listbox')
  panel.innerHTML = EMOJI_OPTIONS.map((e) => `<button type="button" class="emoji-picker-option">${e}</button>`).join('')
  wrap.appendChild(panel)

  function close() {
    panel.classList.add('hidden')
  }

  btn.addEventListener('click', () => {
    // Por si el valor del input lo puso otro código (cargar una guía
    // existente, un borrador...) sin pasar por un evento "input".
    btn.textContent = input.value.trim() || '🙂'
    panel.classList.toggle('hidden')
  })

  panel.querySelectorAll('.emoji-picker-option').forEach((opt) =>
    opt.addEventListener('click', () => {
      input.value = opt.textContent
      btn.textContent = opt.textContent
      input.dispatchEvent(new Event('input', { bubbles: true }))
      close()
    })
  )

  input.addEventListener('input', () => {
    btn.textContent = input.value.trim() || '🙂'
  })

  document.addEventListener('click', (e) => {
    if (!wrap.contains(e.target)) close()
  })
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close()
  })
}
