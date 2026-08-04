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
