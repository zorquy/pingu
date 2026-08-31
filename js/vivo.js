// El tiempo real de PokeDoc: la base avisa, la página se entera sola.
//
// Hasta la tanda 227 todo iba PREGUNTANDO cada pocos segundos. La ficha
// de un torneo pedía 18 consultas cada 10 s, y aun así el chat llegaba
// con retraso. Ahora se abre un websocket y los cambios entran solos.
//
// TRES DECISIONES QUE EXPLICAN CASI TODO ESTE FICHERO:
//
// 1. EL SONDEO NO SE QUITA. Se queda de red de seguridad, más lento.
//    Un websocket no siempre conecta —redes de empresa que los
//    bloquean, wifis de hotel, pestañas que el móvil duerme—, y una
//    página que se queda muda para siempre es peor que una que va con
//    diez segundos de retraso. Mientras el vivo esté conectado el
//    sondeo va al ralentí; si se cae, vuelve a su ritmo de siempre.
//
// 2. NO SE CONFÍA EN EL CONTENIDO DE UN DELETE. En Supabase, los INSERT
//    y los UPDATE respetan la RLS (solo te llegan las filas que podrías
//    leer con una consulta normal), pero **los DELETE no**: no hay fila
//    contra la que comprobar el permiso, así que el borrado se emite a
//    todos los suscritos y además solo trae la clave. Aquí un DELETE
//    significa «algo ha cambiado, vuelve a pedirlo» y nada más.
//
// 3. EL CLIENTE DE REALTIME SE CARGA A DEMANDA. Vive en su propio
//    fichero (js/vendor/supabase-realtime.js, 17 KB comprimidos) y se
//    pide con import() DESPUÉS de que la página esté pintada. La
//    portada, las guías y los cursos no bajan ni un byte de esto.
import { supabase } from './supabase.js'

const URL_PROYECTO = 'https://zqamujmfavwrsqlgbead.supabase.co'

// Un único cliente para toda la pestaña: un websocket, no uno por
// sección. Si la campanita, el chat y el foro se suscriben a la vez,
// comparten la conexión.
let clientePrometido = null

async function cliente() {
  if (clientePrometido) return clientePrometido
  clientePrometido = (async () => {
    const { RealtimeClient } = await import('./vendor/supabase-realtime.js')
    const { data } = await supabase.auth.getSession()
    const anon = supabase.supabaseKey || supabase.rest?.headers?.apikey
    const rt = new RealtimeClient(`${URL_PROYECTO.replace('https://', 'wss://')}/realtime/v1`, {
      params: { apikey: anon },
    })
    // El token de la persona, no la clave pública: sin esto la RLS te
    // trata como a un desconocido y no llega nada de lo tuyo.
    if (data?.session?.access_token) rt.setAuth(data.session.access_token)
    // Si la sesión se renueva (pasa cada hora), hay que decírselo o el
    // websocket se queda con un token caducado y deja de recibir.
    supabase.auth.onAuthStateChange((_evento, sesion) => {
      if (sesion?.access_token) rt.setAuth(sesion.access_token)
    })
    return rt
  })().catch((e) => {
    // Que no se pueda cargar el tiempo real NO es un error de la
    // página: es quedarse con el sondeo, que es lo que había antes.
    console.warn('Tiempo real no disponible, se sigue con el sondeo:', e?.message || e)
    clientePrometido = null
    return null
  })
  return clientePrometido
}

// ── La suscripción ──
//
// `escuchar` devuelve una función para dejar de escuchar. Se llama así:
//
//   const parar = escuchar({
//     nombre: 'chat-mesa-1',
//     tablas: [{ tabla: 'match_messages', filtro: `match_id=eq.${id}` }],
//     alCambiar: () => refrescar(),
//     alEstado: (vivo) => { ... },   // opcional
//   })
//
// `alCambiar` recibe el evento, pero lo normal —y lo recomendado— es
// ignorarlo y volver a pedir los datos: es una consulta cada vez que
// algo cambia de verdad, en vez de una cada diez segundos pase lo que
// pase. Y así el DELETE no importa (ver decisión 2 de arriba).
export function escuchar({ nombre, tablas, alCambiar, alEstado }) {
  let canal = null
  let cortado = false

  ;(async () => {
    const rt = await cliente()
    if (!rt || cortado) return
    try {
      canal = rt.channel(nombre)
      for (const { tabla, filtro, evento } of tablas) {
        canal.on(
          'postgres_changes',
          { event: evento || '*', schema: 'public', table: tabla, ...(filtro ? { filter: filtro } : {}) },
          (payload) => alCambiar?.(payload)
        )
      }
      canal.subscribe((estado) => {
        // SUBSCRIBED es el único estado que significa «esto funciona».
        // CHANNEL_ERROR y TIMED_OUT los avisa para que quien escuche
        // vuelva a su sondeo normal.
        alEstado?.(estado === 'SUBSCRIBED')
      })
    } catch (e) {
      console.warn(`No se pudo escuchar «${nombre}»:`, e?.message || e)
      alEstado?.(false)
    }
  })()

  return () => {
    cortado = true
    if (canal) {
      try {
        canal.unsubscribe()
      } catch {}
      canal = null
    }
  }
}

// El sondeo de respaldo vive en su propio fichero (js/sondeo.js) y se
// re-exporta aquí para que quien use el tiempo real tenga las dos
// piezas a mano. Está fuera porque no depende de Supabase ni del
// navegador, y así se puede probar sola.
export { sondeoAdaptable } from './sondeo.js'
