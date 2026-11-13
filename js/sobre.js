// /sobre (tanda 1326, D1 del plan 2027): las cifras vivas, el equipo y la
// línea del tiempo. Lo puro está en sobre-puro.js; aquí solo se pide y se pinta.
import { supabase } from './supabase.js'
import { avatarStyle, profileUrl } from './app.js'
import { sinMigracion } from './sin-migracion.js'
import { cifrasHtml, equipoHtml, lineaDelTiempo, lineaDelTiempoHtml } from './sobre-puro.js'

const $ = (id) => document.getElementById(id)

async function cifras() {
  const caja = $('sobreCifras')
  const equipo = $('sobreEquipo')
  let datos = null
  try {
    const { data, error } = await supabase.rpc('sobre_cifras')
    if (error) { if (!sinMigracion(error)) console.warn('sobre_cifras', error.message) } else datos = data
  } catch (e) { console.warn('sobre_cifras', e) }
  // Sin la migración o sin red, fuera las dos cosas: ni un «0 personas» ni un
  // «Quién lo hace» vacío. El resto de la página no depende de esto.
  const html = cifrasHtml(datos)
  if (caja) { if (html) { caja.innerHTML = html; caja.removeAttribute('aria-busy') } else caja.hidden = true }
  const eq = equipoHtml(datos?.equipo, { estilo: avatarStyle, enlace: profileUrl })
  if (equipo) { if (eq) equipo.innerHTML = eq; else $('sobreEquipoSec').hidden = true }
}

async function linea() {
  const caja = $('sobreLinea')
  if (!caja) return
  try {
    const res = await fetch('/novedades.json')
    const html = lineaDelTiempoHtml(lineaDelTiempo(await res.json()))
    if (html) caja.innerHTML = html
    else $('sobreLineaSec').hidden = true
  } catch { $('sobreLineaSec').hidden = true }
}

cifras()
linea()
