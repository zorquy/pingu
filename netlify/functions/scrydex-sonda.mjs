import { idDeAdmin, tokenDe } from '../lib/admin.mjs'
import { cabecerasDe, urlDeSonda } from '../lib/scrydex.mjs'

// Preguntarle a Scrydex desde el servidor, para ver qué contesta de verdad
// (tanda 500).
//
// ── POR QUÉ UNA FUNCIÓN Y NO JAVASCRIPT DE /ADMIN ──
//
// Porque la clave iría en el navegador, y una clave en el JS de una página
// es una clave PUBLICADA: cualquiera abre el inspector y se la lleva. Esto
// la deja donde tiene que estar —una variable de entorno de Netlify— y el
// panel solo pide el resultado.
//
// ── POR QUÉ PIDE SER ADMIN ──
//
// Una función de Netlify es una URL pública. Sin la guarda, cualquiera que
// la descubra tiene una API de pago gratis a costa de la cuenta, y con 5.000
// créditos al mes eso se agota en una tarde. Es el mismo motivo por el que
// `generate-course` la lleva desde el primer día.
//
// ── PARA QUÉ EXISTE ──
//
// Para no deducir. Llevamos una sesión entera pagando el precio de afirmar
// cosas de una API que no se había llamado —dos notas mías tuvieron que
// corregirse— así que antes de escribir una sola fila en la base, esto
// enseña la respuesta CRUDA. Y no escribe nada: solo mira.
//
// VARIABLES DE ENTORNO: SCRYDEX_API_KEY y SCRYDEX_TEAM_ID (las dos).

const LIMITE = 20000

export async function procesar({ cuerpo = {}, env = process.env, fetchImpl = fetch } = {}) {
  const { cabeceras, faltan } = cabecerasDe(env)
  if (faltan) {
    return { estado: 500, cuerpo: { error: `Faltan variables de entorno en Netlify: ${faltan.join(' y ')}.` } }
  }
  const url = urlDeSonda(cuerpo.ruta, cuerpo.params)
  if (!url) {
    return { estado: 400, cuerpo: { error: 'Esa ruta no vale. Es un trozo de camino, como «en/expansions» o «cards».' } }
  }
  try {
    const res = await fetchImpl(url, { headers: cabeceras })
    const texto = await res.text()
    return {
      estado: 200,
      cuerpo: {
        // La URL se devuelve SIN las claves, que van en cabeceras: esto se
        // pega en un cuadro de texto y se copia por ahí.
        url,
        estadoHttp: res.status,
        // Lo que ha contestado, en crudo y recortado. En crudo a propósito:
        // un resumen mío de su respuesta es justo lo que no queremos.
        respuesta: texto.slice(0, LIMITE),
        recortado: texto.length > LIMITE,
      },
    }
  } catch (e) {
    return { estado: 502, cuerpo: { error: `No se ha podido preguntar: ${String(e?.message || e).slice(0, 200)}` } }
  }
}

export default async (req) => {
  const json = (estado, cuerpo) =>
    new Response(JSON.stringify(cuerpo), { status: estado, headers: { 'content-type': 'application/json' } })

  if (req.method !== 'POST') return json(405, { error: 'Método no permitido.' })
  if (!(await idDeAdmin(tokenDe(req)))) return json(401, { error: 'No autorizado.' })

  let cuerpo = {}
  try {
    cuerpo = await req.json()
  } catch {
    return json(400, { error: 'Cuerpo ilegible.' })
  }
  const r = await procesar({ cuerpo })
  return json(r.estado, r.cuerpo)
}
