// Doble de js/vivo.js para las pruebas.
//
// EXISTE POR SEGURIDAD, no por comodidad: el vivo de verdad abre un
// websocket contra el Supabase DE PRODUCCIÓN. Una prueba jamás puede
// hacer eso, así que en el entorno de pruebas se sustituye entero.
//
// Además deja simular lo que de otra forma no se podría: que llegue un
// evento (window.__VIVO__.emitir) y que el websocket se caiga
// (window.__VIVO__.estado(false)), que es la rama que hay que probar
// justamente porque en el navegador de verdad casi nunca pasa.
const SUSCRIPCIONES = []

export function escuchar({ nombre, tablas, alCambiar, alEstado }) {
  const s = { nombre, tablas, alCambiar, alEstado, viva: true }
  SUSCRIPCIONES.push(s)
  // Por defecto se da por conectado, que es el caso normal.
  setTimeout(() => s.viva && alEstado?.(true), 0)
  return () => {
    s.viva = false
  }
}

export function sondeoAdaptable(fn, msNormal, factorDormido = 6) {
  const estado = { ms: msNormal, vivo: false, llamadas: 0 }
  let timer = setInterval(() => {
    estado.llamadas++
    fn()
  }, msNormal)
  const api = {
    conVivo(estaVivo) {
      if (estaVivo === estado.vivo) return
      estado.vivo = estaVivo
      estado.ms = estaVivo ? msNormal * factorDormido : msNormal
      clearInterval(timer)
      timer = setInterval(() => {
        estado.llamadas++
        fn()
      }, estado.ms)
    },
    parar() {
      clearInterval(timer)
    },
    __estado: estado,
  }
  SONDEOS.push(api)
  return api
}

const SONDEOS = []

if (typeof window !== 'undefined') {
  window.__VIVO__ = {
    suscripciones: SUSCRIPCIONES,
    sondeos: SONDEOS,
    // Simula que llega un cambio de la base.
    emitir(nombre, payload = {}) {
      SUSCRIPCIONES.filter((s) => s.viva && (!nombre || s.nombre === nombre)).forEach((s) => s.alCambiar?.(payload))
    },
    // Simula que el websocket conecta o se cae.
    estado(vivo, nombre) {
      SUSCRIPCIONES.filter((s) => s.viva && (!nombre || s.nombre === nombre)).forEach((s) => s.alEstado?.(vivo))
    },
  }
}
