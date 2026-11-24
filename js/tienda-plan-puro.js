// Los planes de las tiendas (tanda 1429), lo puro: qué plan abre qué, cuánto
// cuesta y qué se dice de él. Sin dependencias: lo prueba node y lo usan el
// panel de la tienda (js/tienda-plan.js), /para-tiendas y /admin.
//
// PINGU (2026-11-24): «más caro de entrada… el recomendado debería ser el
// tienda… el tienda plus debería ser desorbitado». Puesto se queda a 10 € de
// Tienda para que casi todo el mundo suba; Tienda+ está muy arriba para que 35
// parezca lo sensato. Las fundadoras (antes del 1 de marzo de 2027) pagan su
// precio mientras sigan; si se dan de baja y vuelven, el de entonces.
//
// La base (supabase-migration-1429) solo sabe el nombre del plan que vale; lo
// que abre cada uno se decide AQUÍ, y una función nueva de pago entra en
// `FUNCIONES` con el plan mínimo que la abre.

export const ORDEN = ['gratis', 'puesto', 'tienda', 'tienda_mas']

export const PLANES = {
  gratis: { nombre: 'Gratis', mes: 0, fundadora: 0, para: 'Para estar: que te encuentren.' },
  puesto: { nombre: 'Puesto', mes: 25, fundadora: 19, para: 'Para quien vende desde casa o en ferias.' },
  tienda: { nombre: 'Tienda', mes: 35, fundadora: 29, para: 'Solo 10 € más que Puesto, y tienes la tienda entera.' },
  tienda_mas: { nombre: 'Tienda+', mes: 99, fundadora: 79, para: 'Para la tienda grande: tu equipo y salir delante.' },
}

// Cuántos días de prueba (Tienda+ entero) y hasta cuándo se es fundadora. Son
// los mismos que pone la base al dar de alta; si cambian, cambian los dos.
export const DIAS_DE_PRUEBA = 60
export const FUNDADORAS_HASTA = '2027-03-01'

// Lo que abre cada plan, con cómo se dice en la pantalla de «es de…».
// `son`: si el nombre va en plural («Tus ventas son de Puesto»).
export const FUNCIONES = {
  mostrador: { plan: 'puesto', nombre: 'El mostrador', son: false },
  ventas: { plan: 'puesto', nombre: 'Tus ventas y la caja', son: true },
  caja: { plan: 'puesto', nombre: 'La caja de hoy', son: false },
  etiquetas: { plan: 'puesto', nombre: 'Las etiquetas', son: true },
  cifras: { plan: 'tienda', nombre: 'Las cifras', son: true },
  lotes: { plan: 'tienda', nombre: 'Los lotes', son: true },
  destacadas: { plan: 'tienda', nombre: 'Las destacadas y las ofertas', son: true },
  avisar: { plan: 'tienda', nombre: 'Avisar a los que la buscan', son: false },
  cierre: { plan: 'tienda', nombre: 'El cierre del mes', son: false },
  buscan: { plan: 'tienda', nombre: 'Lo que busca la gente y no tienes', son: false },
  novedades: { plan: 'tienda', nombre: 'Las novedades a tus seguidores', son: true },
  equipo: { plan: 'tienda_mas', nombre: 'Tu equipo', son: false },
}

// Lo que trae cada plan, para Tu plan, la pantalla de «es de…» y /para-tiendas.
// Cada uno trae lo del anterior; aquí va solo lo que AÑADE.
export const QUE_TRAE = {
  gratis: ['Tu stock y tu colección, sin límite', 'Tu escaparate con QR', 'Sales en /tiendas y en el Mercado', 'Ofertas, reservas y mensajes de la gente', 'Tus torneos'],
  puesto: ['El mostrador: vender, comprar, cambiar y escanear', 'Tus ventas y la caja de hoy', 'Etiquetas con SKU, QR y código de barras'],
  tienda: ['Las cifras: beneficio, margen, valor del stock y lo que no rota', 'Lo que busca la gente y no tienes', 'Lotes y «por poner a la venta»', 'Destacadas y ofertas con el precio tachado', 'Avisar a los que la buscan', 'Novedades a tus seguidores', 'El cierre del mes en PDF y CSV'],
  tienda_mas: ['Tu equipo: hasta 5 personas, cada una con su cuenta', 'Sales primera en el Mercado y en /tiendas', 'Te atendemos directamente por WhatsApp'],
}

const nivel = (plan) => Math.max(0, ORDEN.indexOf(plan))

export function puede(plan, funcion) {
  const f = FUNCIONES[funcion]
  if (!f) return true
  return nivel(plan || 'gratis') >= nivel(f.plan)
}

export const planMinimo = (funcion) => FUNCIONES[funcion]?.plan || 'gratis'
export const nombreDePlan = (plan) => PLANES[plan]?.nombre || 'Gratis'

// El precio que le toca: el de fundadora si lo es.
export function precioDe(plan, fundadora = false) {
  const p = PLANES[plan]
  if (!p || !p.mes) return 0
  return fundadora ? p.fundadora : p.mes
}
export const precioTexto = (plan, fundadora = false) => {
  const n = precioDe(plan, fundadora)
  return n ? `${n} €/mes` : '0 €'
}

export const fechaLarga = (d) => new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })

const DIA = 864e5
// Días que quedan hasta `hasta` (redondeando hacia arriba; 0 si ya pasó).
export function diasHasta(hasta, ahora = new Date()) {
  if (!hasta) return 0
  return Math.max(0, Math.ceil((new Date(hasta) - new Date(ahora)) / DIA))
}

// Cómo está una tienda hoy, de lo que devuelve `tienda_mi_plan()`.
export function estadoDelPlan(info, ahora = new Date()) {
  if (!info) return null
  const plan = ORDEN.includes(info.plan) ? info.plan : 'gratis'
  const pruebaHasta = info.prueba_hasta ? new Date(info.prueba_hasta) : null
  const pagadoHasta = info.pagado_hasta ? new Date(info.pagado_hasta) : null
  const enPrueba = Boolean(pruebaHasta && pruebaHasta > ahora)
  const pagando = Boolean(pagadoHasta && pagadoHasta > ahora) && !enPrueba
  const dias = enPrueba ? diasHasta(pruebaHasta, ahora) : 0
  const acabo = !enPrueba && !pagando && Boolean(pruebaHasta)
  return {
    plan,
    nombre: nombreDePlan(plan),
    enPrueba,
    pagando,
    acabo,
    dias,
    pruebaHasta,
    pagadoHasta,
    fundadora: Boolean(info.fundadora),
    seQueda: ORDEN.includes(info.se_queda) ? info.se_queda : null,
    // De la prueba, lo que va gastado (0 al empezar, 1 al acabar).
    gastado: enPrueba ? Math.min(1, Math.max(0, 1 - dias / DIAS_DE_PRUEBA)) : 1,
  }
}

// La chapa del saludo del panel: «Fundadora · Tienda+» o «Plan Gratis».
export function chapaDe(e) {
  if (!e) return 'Tienda'
  if (e.enPrueba) return e.fundadora ? 'Fundadora · prueba de Tienda+' : 'Prueba de Tienda+'
  return e.fundadora ? `Fundadora · ${e.nombre}` : `Plan ${e.nombre}`
}

// La banda de arriba del panel, o nada. En prueba, la primera semana y las dos
// últimas (el resto, solo la chapa: que no canse); acabada sin plan, el primer
// mes después.
export function bandaDe(e, ahora = new Date()) {
  if (!e) return null
  if (e.enPrueba) {
    if (e.dias < DIAS_DE_PRUEBA - 7 && e.dias > 14) return null
    const despues = e.seQueda
      ? `Te quedas con ${nombreDePlan(e.seQueda)}: ${precioTexto(e.seQueda, e.fundadora)}${e.fundadora ? ' mientras sigas' : ''}.`
      : e.fundadora ? 'Eres fundadora: elige plan y te quedas tu precio mientras sigas.' : 'Elige plan antes de que acabe.'
    return {
      tipo: 'prueba',
      titulo: e.fundadora ? 'Eres tienda fundadora' : 'Estás probando Tienda+',
      texto: `Tienes todo Tienda+ gratis hasta el ${fechaLarga(e.pruebaHasta)} (${e.dias === 1 ? 'queda 1 día' : `quedan ${e.dias} días`}). ${despues}`,
      enlace: 'Tu plan',
      gastado: e.gastado,
    }
  }
  if (e.acabo && e.plan === 'gratis' && e.pruebaHasta && ahora - e.pruebaHasta < 30 * DIA) {
    return {
      tipo: 'acabo',
      titulo: `Tu prueba de Tienda+ acabó el ${fechaLarga(e.pruebaHasta)}`,
      texto: 'Tu escaparate y tu stock siguen igual. El mostrador, las ventas y las cifras vuelven en cuanto elijas plan.',
      enlace: 'Elegir plan',
    }
  }
  return null
}

// «Tus ventas y la caja son de Puesto»: el título de la pantalla de «es de…».
export function tituloDeCandado(funcion) {
  const f = FUNCIONES[funcion]
  if (!f) return ''
  return `${f.nombre} ${f.son ? 'son' : 'es'} de ${nombreDePlan(f.plan)}`
}

// Todo lo que trae un plan, sumando los de debajo (sin el Gratis).
export function todoLoDe(plan) {
  const hasta = nivel(plan)
  return ORDEN.slice(1, hasta + 1).flatMap((p) => QUE_TRAE[p])
}
