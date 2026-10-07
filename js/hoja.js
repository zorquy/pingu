// Una hoja de CSS que un módulo mete él solo, cuando hace falta (704).
// La prueba 299 lee el marcador `hojaInyectada('css/x.css')` para saber
// que las clases de ese módulo tienen hoja aunque no esté en el HTML.
//
// La dirección va SIEMPRE desde la raíz (718): con `css/movil.css` a
// secas, en /carta/<slug> el navegador pedía /carta/css/movil.css, Netlify
// lo reescribe a carta.html, y una hoja que llega como HTML se descarta
// sin error. La barra de abajo salía sin estilo en las fichas de carta, de
// tema, de guía y de persona.
export function hojaInyectada(ruta) {
  const href = ruta.startsWith('/') ? ruta : `/${ruta}`
  if (document.querySelector(`link[href="${href}"], link[href="${ruta}"]`)) return
  const l = document.createElement('link')
  l.rel = 'stylesheet'
  l.href = href
  document.head.appendChild(l)
}
