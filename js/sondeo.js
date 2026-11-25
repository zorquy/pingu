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

// El sondeo ESCALONADO (1437, la propuesta «Torneos sin atascos»). El de
// arriba, con el vivo caído, vuelve de golpe a su marcha corta: si el tiempo
// real se cae para TODOS a la vez (pasó en el Tardeo de Testeo, con la base
// saturada), todos se ponen a preguntar cada 10 s justo cuando la base peor
// va. Este sube poco a poco (15, 20, 30 s) y con azar, así que las fichas no
// van juntas; con el vivo conectado, una vez por minuto, también con azar.
//   pasos:   las esperas sin vivo, la última se repite
//   conVivo: la espera con el vivo conectado
//   azar:    cuánto se mueve cada espera arriba o abajo (0,25 = ±25 %)
// `aleatorio` se puede cambiar en las pruebas para que salga siempre igual.
export function esperaEscalonada(paso, { pasos = [15000, 20000, 30000], conVivo = 60000, azar = 0.25, vivo = false, aleatorio = Math.random } = {}) {
  const base = vivo ? conVivo : pasos[Math.min(paso, pasos.length - 1)]
  return Math.round(base * (1 - azar + 2 * azar * aleatorio()))
}

export function sondeoEscalonado(fn, opciones = {}) {
  let timer = null
  let vivo = false
  let paso = 0
  let parado = false
  const siguiente = () => {
    if (timer) clearTimeout(timer)
    if (parado) return
    timer = setTimeout(async () => {
      timer = null
      try {
        await fn()
      } finally {
        if (!vivo) paso++
        siguiente()
      }
    }, esperaEscalonada(paso, { ...opciones, vivo }))
  }
  siguiente()
  return {
    conVivo(estaVivo) {
      if (estaVivo === vivo) return
      vivo = estaVivo
      // Al caerse el vivo se empieza por el primer escalón, no por el último.
      if (!vivo) paso = 0
      siguiente()
    },
    parar() {
      parado = true
      if (timer) clearTimeout(timer)
      timer = null
    },
  }
}
