// El sondeo con dos marchas.
//
// Vive aparte de js/vivo.js A PROPÓSITO: no depende de Supabase, ni del
// websocket, ni del navegador. Eso lo hace comprobable en Node — y
// mientras estuvo dentro de vivo.js NO lo era, porque el entorno de
// pruebas sustituye vivo.js entero por un doble y romper esto no lo
// notaba nadie.
//
//
// Envuelve un `setInterval` de los de siempre y le añade una marcha
// larga: cuando el tiempo real está conectado, el sondeo pasa de cada
// N segundos a cada N×6 (sigue ahí por si el websocket miente, pero
// deja de ser el que trae los datos). Si el vivo se cae, vuelve solo a
// la marcha corta.
//
// Se hace así y no apagando el sondeo del todo a propósito: un canal
// puede decir SUBSCRIBED y luego dejar de recibir sin avisar (pasa con
// las pestañas que el móvil congela). Un sondeo lento de fondo es lo
// que hace que eso se note en 60 segundos en vez de nunca.
export function sondeoAdaptable(fn, msNormal, factorDormido = 6) {
  let timer = null
  let vivo = false

  const arrancar = () => {
    if (timer) clearInterval(timer)
    timer = setInterval(fn, vivo ? msNormal * factorDormido : msNormal)
  }
  arrancar()

  return {
    conVivo(estaVivo) {
      if (estaVivo === vivo) return
      vivo = estaVivo
      arrancar()
    },
    parar() {
      if (timer) clearInterval(timer)
      timer = null
    },
  }
}
