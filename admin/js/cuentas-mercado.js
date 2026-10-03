// Qué significan las cuentas de cada mercado (tanda 482).
//
// El botón «Qué hay de cada mercado» de /admin existe para separar tres
// cosas que desde la web se ven EXACTAMENTE igual —una pantalla sin
// nada— y que llevan a tres sitios distintos: que un catálogo no se haya
// importado nunca, que esté importado y sin curar, o que esté entero y
// sea TCGdex quien no tiene el dibujo.
//
// ── Por qué esto vive aquí y no dentro del botón ──
//
// Porque decidirlo es lo que se equivocó. El aviso se sacaba leyendo la
// FRASE con una expresión regular, y `/0 con fecha/` casaba con el CERO
// DE «210 con fecha»: PINGU vio «dale a Completar los datos que faltan»
// con los 210 sets occidentales completos y los 186 japoneses también.
// Es la trampa que el CLAUDE.md tiene escrita desde la 312 —al barrer
// una cadena, todo lo que la CONTIENE cuenta, no solo lo que ES—, esta
// vez dentro del propio diagnóstico.
//
// Aquí es puro: entran números, salen frases, y se prueba en Node.
//
// Y un aviso que manda a pulsar un botón que no va a hacer nada es peor
// que no avisar: gasta el tiempo de quien lo lee y le deja creyendo que
// el problema es suyo.

// `datos`: una lista de { market, sets, logo, simbolo, fecha, serie,
// cartas, foto }. Devuelve las frases, en orden de «lo que puedes
// arreglar» a «lo que no».
export function avisosDeMercados(datos = []) {
  const avisos = []
  const nombres = (lista) => lista.map((d) => d.market).join(', ')

  // 1. Ni se ha intentado.
  const vacios = datos.filter((d) => d.sets === 0)
  if (vacios.length) {
    avisos.push(
      `${nombres(vacios)} no se ha${vacios.length === 1 ? '' : 'n'} importado nunca: dale a «Buscar sets en TCGdex».`
    )
  }

  // 2. Lo que SÍ arregla «Completar los datos que faltan de los sets».
  // Por NÚMERO: «le falta a alguno», no «la frase contiene un cero».
  const sinCurar = datos.filter((d) => d.sets > 0 && (d.serie < d.sets || d.fecha < d.sets))
  if (sinCurar.length) {
    const cuales = sinCurar.map((d) => `${d.market} (${d.sets - Math.min(d.serie, d.fecha)})`).join(', ')
    avisos.push(
      `A ${cuales} le faltan serie o fecha: sin fecha una era se va al fondo de la estantería y sin serie no hay ` +
        'respaldo de imagen. Dale a «Completar los datos que faltan de los sets».'
    )
  }

  // 3. Y lo que NO arregla ningún botón. Decirlo importa tanto como lo
  // otro: la respuesta honesta a «¿por qué no hay logos japoneses?» es
  // «no los hay», no «pulsa aquí».
  //
  // `serie > 0` y no `serie === sets` (lo intenté así y la prueba lo cazó):
  // el japés tiene 186 de 188 curados, y exigir el pleno lo dejaba fuera
  // del aviso — justo el mercado por el que PINGU preguntaba. Lo que hace
  // falta saber es si YA LE PREGUNTAMOS a TCGdex, y haber curado un solo
  // set y haber vuelto con cero logos ya lo contesta. Los dos que faltan
  // por curar son otra cosa, y los dice el aviso de arriba.
  const sinDibujo = datos.filter((d) => d.serie > 0 && d.logo === 0)
  if (sinDibujo.length) {
    avisos.push(
      `${nombres(sinDibujo)} tiene${sinDibujo.length === 1 ? '' : 'n'} sus sets curados y aun así CERO logos: eso ya no ` +
        'es nuestro, es que TCGdex no publica logos de ese catálogo. La tarjeta cae al símbolo y al nombre.'
    )
  }
  const sinFoto = datos.filter((d) => d.cartas > 0 && d.foto === 0)
  if (sinFoto.length) {
    const cuales = sinFoto.map((d) => `${d.market} (${d.cartas} cartas)`).join(', ')
    avisos.push(`${cuales} no tiene ni un escaneo: tampoco es nuestro. Harían falta imágenes de otra fuente.`)
  }
  return avisos
}

// La línea de un mercado. Va aquí al lado de los avisos a propósito: son
// los mismos números, y tenerlos separados es cómo se acaba decidiendo
// sobre un texto en vez de sobre un dato.
export function lineaDeMercado(d) {
  return (
    `${d.market}: ${d.sets} sets (${d.logo} con logo, ${d.simbolo} con símbolo, ` +
    `${d.fecha} con fecha, ${d.serie} con serie), ${d.cartas} cartas (${d.foto} con foto)`
  )
}

// ── La MUESTRA de un sondeo de catálogo (tanda 486) ──
//
// Vive aquí y no en `admin.js` por la norma de la 471: `admin.js` importa
// `supabase.js` y no se puede probar sin navegador, y esto es aritmética.
// El módulo no importa NADA a propósito.
//
// El primero, el último y repartidos por el medio. Por POSICIÓN en la
// lista y no por fecha: el listado de sets es un «SetResume» y la fecha no
// viene en él (la lección de la 322, otra vez). La posición sí sirve,
// porque TCGdex devuelve el listado en orden.
export const CUANTOS_SONDEOS = 9

export function muestraDeSets(lista, cuantos = CUANTOS_SONDEOS) {
  const todos = Array.isArray(lista) ? lista.filter((s) => s && s.id) : []
  if (cuantos < 2 || todos.length <= cuantos) return todos.slice()
  const fuera = []
  for (let i = 0; i < cuantos; i++) {
    fuera.push(todos[Math.round((i * (todos.length - 1)) / (cuantos - 1))])
  }
  // Sin repetidos: con una lista corta, dos posiciones redondean al mismo
  // set, y sondear dos veces el mismo gasta una petición y no dice nada.
  return [...new Map(fuera.map((s) => [s.id, s])).values()]
}
