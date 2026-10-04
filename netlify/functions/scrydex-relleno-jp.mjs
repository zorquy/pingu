import { procesar } from './scrydex-relleno.mjs'

// El relleno del catálogo JAPONÉS (tanda 537).
//
// PINGU: «vete con lo japonés. Rellename todos los logos y las imágenes de
// cartas. No sé por qué esto te está costando tanto, lo tenemos todo en
// Scrydex, simplemente tráelo».
//
// Y tenía razón en lo de que faltaba: `scrydex-relleno` llevaba
// `MERCADO = 'WEST'` e `IDIOMA = 'en'` A FUEGO, con un comentario al lado
// que lo justificaba —«el japonés no está emparejado»— y que dejó de ser
// verdad en cuanto la 530 trajo sus 231 expansiones. Es EXACTAMENTE la
// trampa que la 471 dejó escrita: un `if` o una constante justificados con
// «hoy esto no hace falta» no avisan el día que hace falta.
//
// Esto NO es una copia del occidental: es la misma función con otros tres
// parámetros. Dos copias de un bucle con frenos se separan, y entonces el
// freno que arreglas en una sigue roto en la otra.
//
// ── LO QUE TRAE ──
//
// La foto de Scrydex, la rareza exacta, el ilustrador, los PS, la Pokédex
// y el NOMBRE OCCIDENTAL de cada carta (`translation.en.name`), que es lo
// que hace que la biblioteca japonesa se pueda leer.
//
// ── LO QUE CUESTA ──
//
// Una página de su catálogo por crédito, igual que el occidental: aquello
// fueron ~214 páginas para 25.209 cartas suyas. El japonés no se sabe hasta
// que conteste —su `total_count` lo dirá en la primera pasada—, y el freno
// es el mismo: UN barrido completo y luego a dormir una semana.
//
// Y se reanuda por su PROPIA clave de estado, `cartas-jp`, así que las dos
// pasadas no se pisan la página por la que iban.

export default async () => {
  try {
    const r = await procesar({ mercado: 'JP', idioma: 'ja', claveEstado: 'cartas-jp' })
    return new Response(JSON.stringify(r.cuerpo), { status: r.estado, headers: { 'content-type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500, headers: { 'content-type': 'application/json' } })
  }
}

// Cada cinco minutos, como el occidental. Cuando acabe su barrido se
// callará sola: el freno de `procesar` mira si queda alguna carta sin
// marcar y cuántos barridos lleva.
export const config = { schedule: '*/5 * * * *' }
