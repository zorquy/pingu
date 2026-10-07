// Una hoja de CSS que un módulo mete él solo, cuando hace falta (704).
// La prueba 299 lee el marcador `hojaInyectada('css/x.css')` para saber
// que las clases de ese módulo tienen hoja aunque no esté en el HTML.
//
// La dirección va SIEMPRE desde la raíz (718): con `css/movil.css` a
// secas, en /carta/<slug> el navegador pedía /carta/css/movil.css, Netlify
// lo reescribe a carta.html, y una hoja que llega como HTML se descarta
// sin error. La barra de abajo salía sin estilo en las fichas de carta, de
// tema, de guía y de persona.
//
// Y devuelve una promesa que se cumple cuando la hoja YA está (748): lo que
// se pinta antes que su hoja sale un instante sin estilo —la lateral, en el
// flujo de la página, empujaba todo 230 px hacia abajo— y eso es un salto.
// Se cumple también si falla o tarda, para no dejar nada escondido.
export function hojaInyectada(ruta) {
  const href = ruta.startsWith('/') ? ruta : `/${ruta}`
  const ya = document.querySelector(`link[href="${href}"], link[href="${ruta}"]`)
  if (ya?.sheet) return Promise.resolve()
  const l = ya || document.createElement('link')
  const lista = new Promise((ok) => {
    l.addEventListener('load', ok, { once: true })
    l.addEventListener('error', ok, { once: true })
    setTimeout(ok, 3000)
  })
  if (!ya) {
    l.rel = 'stylesheet'
    l.href = href
    document.head.appendChild(l)
  }
  return lista
}
