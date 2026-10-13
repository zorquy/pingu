// Escapado de HTML, en su propio módulo.
//
// Vivía en app.js, pero cuando content-icon.js necesitó usarlo se formó
// un ciclo: app.js importaba el resolutor de iconos y el resolutor
// importaba el escapado de app.js. Los módulos de JavaScript toleran los
// ciclos —las declaraciones de función se elevan— pero depender de esa
// sutileza es frágil: basta con que alguien convierta la función en una
// `const` para que deje de funcionar, y el síntoma es una página en
// blanco sin explicación. Ya pasó algo parecido con `avatarStyle`.
//
// Sacarlo aquí rompe el ciclo sin tocar a nadie: app.js lo reexporta, así
// que los 30 y pico ficheros que hacen `import { escapeHtml } from
// './app.js'` siguen funcionando igual.
export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Una dirección para meterla en `url('…')`, dentro de un `style="…"` o de
// `el.style` (804). El informe de seguridad de Luisfe: `avatarStyle` solo
// cambiaba la comilla simple, y `avatar_url` lo escribe cada uno en su
// fila, así que un `"` cerraba el atributo y colaba un `onmouseover` en el
// avatar de esa persona, en todas las páginas donde sale. Solo pasan
// https, una ruta nuestra (`/…`), `blob:` y una imagen `data:` en base64;
// lo demás sale vacío. Y lo que podría romper el atributo o el `url()` va
// codificado (`"` → %22): para una dirección es el mismo sitio.
export function urlParaCss(url) {
  const s = String(url ?? '').trim()
  if (/^data:image\/(png|jpe?g|gif|webp|avif);base64,[a-z0-9+/=]+$/i.test(s)) return s
  if (!/^(https:\/\/|blob:https:\/\/|\/(?!\/))/i.test(s)) return ''
  return s.replace(/[\s"'()\\<>&`]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')}`)
}
