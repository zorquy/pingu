// Tanda 873 — lo demás que se comparte (en Node): «Mi mes», un logro, un
// nivel, la expansión, el podio y la vitrina. Los textos son puros; lo que
// se pinta y se pulsa lo mira test-tanda-873-pantalla.mjs.
import { readFileSync } from 'node:fs'
import { textoDeMiMes, ENLACE_RETOS } from '/home/user/pingu/js/mi-dia.js'
import { tonoDeDia } from '/home/user/pingu/js/reto-imagen.js'
import { textoDeLogro, textoDeNivel } from '/home/user/pingu/js/logro-compartir.js'
import { textoDeExpansion } from '/home/user/pingu/js/mi-coleccion/imagen-expansion.js'
import { textoDePodio, enlaceDeTorneo, PUESTOS } from '/home/user/pingu/js/torneos/podio-compartir.js'
import { textoDeVitrina } from '/home/user/pingu/js/vitrina-imagen.js'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 220) : ''}`)
}
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const leer = (f) => readFileSync(`${RAIZ}/${f}`, 'utf8')

console.log('── 1. «Mi mes» ──')
{
  const hoy = '2026-10-15'
  const dias = { '2026-10-15': 6, '2026-10-14': 2, '2026-10-10': 3, '2026-09-16': 1, '2026-09-15': 5 }
  const t = textoDeMiMes({ dias, hoy, jugados: 17, mejorRacha: 2, perfectos: 1 })
  const l = t.split('\n')
  check('la cabecera cuenta los días jugados de los últimos 30 (el 15/09 queda fuera)', l[0] === 'PokeDoc · mis últimos 30 días: 4 jugados', l[0])
  check('tres filas de diez, el más viejo primero (el 16/09, a 29 días, entra) y hoy el último', l.length === 6 && [...l[1]].length === 10 && l[1].startsWith('🟨') && l[3].endsWith('🟨🟩'), t)
  check('  …gris sin jugar, amarillo con uno o dos, verde con tres o más', l[1] === '🟨⬜⬜⬜⬜⬜⬜⬜⬜⬜' && l[2] === '⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜' && l[3] === '⬜⬜⬜⬜🟩⬜⬜⬜🟨🟩', l[3])
  check('  …las cifras', l[4] === '🎯 17 retos · 🔥 mejor racha 2 · 👑 1 día perfecto', l[4])
  check('  …y el enlace a /retos', l[5] === ENLACE_RETOS)
  check('con dos perfectos, en plural', /👑 2 días perfectos/.test(textoDeMiMes({ dias, hoy, perfectos: 2 })))
  check('el tono de la imagen sigue la misma regla', tonoDeDia(0) === null && tonoDeDia(1) === 'medio' && tonoDeDia(2) === 'medio' && tonoDeDia(3) === true && tonoDeDia(6) === true)
}

console.log('── 2. Logro y nivel ──')
{
  check('el logro: título, descripción y enlace', textoDeLogro({ titulo: 'Veterano', descripcion: 'Cinco torneos jugados.' }) === '🏅 Logro desbloqueado en PokeDoc: Veterano\nCinco torneos jugados.\npokedoc.es')
  check('  …sin descripción, dos líneas', textoDeLogro({ titulo: 'Veterano' }) === '🏅 Logro desbloqueado en PokeDoc: Veterano\npokedoc.es')
  check('el nivel', textoDeNivel({ nivel: 'Entrenador' }) === '⬆️ He subido de nivel en PokeDoc: ahora soy Entrenador\npokedoc.es')
  const g = leer('js/gamification.js')
  check('la tarjeta del logro lleva «Compartir» y abre logro-compartir.js por import()', /id="achievementShareBtn"/.test(g) && /import\('\.\/logro-compartir\.js'\)\.then\(\(m\) => m\.compartirLogro/.test(g))
  check('  …y la subida de nivel, un aviso con acción «Compartir»', /accion: \{ texto: 'Compartir', alPulsar: \(\) => import\('\.\/logro-compartir\.js'\)\.then\(\(m\) => m\.compartirNivel\(nivel\)\)/.test(g))
  const toast = leer('js/toast.js')
  // Desde la 1084 admite también varias (`acciones`); con una o con varias, dura más.
  check('showToast admite { accion } y entonces dura más', /accion = null/.test(toast) && /acciones = accion \? \[accion\] : \[\]/.test(toast) && /toast-accion/.test(toast) && /acciones\.length \? 9000 : 4200/.test(toast))
  check('  …con su estilo en components.css', /\.toast-accion \{/.test(leer('css/components.css')))
}

console.log('── 3. La expansión ──')
{
  check('llevo N de M (pct %) y lo que valen', textoDeExpansion({ nombre: 'Llamas Obsidianas', tengo: 3, total: 4, pct: 75, valor: 1475.9 }) === '📦 Llamas Obsidianas: llevo 3 de 4 (75 %) en PokeDoc\n💶 Las mías valen 1476 €\npokedoc.es/cartas')
  check('  …completa, con su marca, y sin valor no hay línea de valor', textoDeExpansion({ nombre: 'X', tengo: 4, total: 4, pct: 100, valor: 0 }) === '📦 X: llevo 4 de 4 (100 %) en PokeDoc ✅ ¡completa!\npokedoc.es/cartas')
  const html = leer('mi-coleccion.html')
  check('el ⋮ de la expansión tiene «Compartir la expansión», escondido hasta saber que es tuya', /id="mcAlbumCompartir"/.test(html) && /class="mc-menu-opcion hidden" id="mcAlbumCompartir"/.test(html))
  check('  …y /cartas se ha regenerado con él', /id="mcAlbumCompartir"/.test(leer('cartas.html')))
  const mc = leer('js/mi-coleccion.js')
  check('pintarAlbum deja el resumen y enseña la opción solo en la tuya', /albumResumen = elSet/.test(mc) && /classList\.toggle\('hidden', !\(albumResumen && esMia && sesion\)\)/.test(mc) && /import\('\.\/mi-coleccion\/imagen-expansion\.js'\)/.test(mc))
}

console.log('── 4. El podio ──')
{
  check('campeón', textoDePodio({ nombre: 'Copa de Octubre', slug: 'copa-octubre', puesto: 0 }) === '🏆 Campeón de Copa de Octubre en PokeDoc\npokedoc.es/torneo?slug=copa-octubre')
  check('finalista y semifinalistas', /🥈 Finalista/.test(textoDePodio({ nombre: 'X', slug: 'x', puesto: 1 })) && /🥉 Semifinalista/.test(textoDePodio({ nombre: 'X', slug: 'x', puesto: 3 })) && PUESTOS.length === 4)
  check('un puesto fuera de rango no rompe', /Campeón/.test(textoDePodio({ nombre: 'X', slug: 'x', puesto: -2 })) && /Semifinalista/.test(textoDePodio({ nombre: 'X', slug: 'x', puesto: 9 })))
  check('el enlace lleva el slug escapado', enlaceDeTorneo('copa ñ') === 'pokedoc.es/torneo?slug=copa%20%C3%B1')
  const ronda = leer('js/torneos/ronda.js')
  check('ronda.js pinta «Compartir» solo en TU puesto y lo delega a podio-compartir.js', /id === miId\(\) \? `<button type="button" class="link-btn torneo-podio-compartir" data-podio-compartir="\$\{i\}"/.test(ronda) && /import\('\.\/podio-compartir\.js'\)/.test(ronda))
  check('  …sin tocar el motor', !/podio-compartir/.test(leer('js/torneos/motor.js')))
}

console.log('── 5. La vitrina ──')
{
  const cartas = [{ id: 'xy5-1', name: 'Pikachu', name_es: 'Pikachu', tcg_sets: { name: 'Duelos Primigenios' } }, { id: 'xy5-2', name: 'Eevee', tcg_sets: null }]
  check('mi vitrina, una línea por carta con su set y el enlace al perfil', textoDeVitrina({ cartas, usuario: 'ash' }) === '🖼️ Mi vitrina en PokeDoc (@ash)\n· Pikachu (Duelos Primigenios)\n· Eevee\npokedoc.es/usuario/ash')
  check('  …sin usuario, el enlace es la web', textoDeVitrina({ cartas: [] }).endsWith('\npokedoc.es'))
  const v = leer('js/vitrina.js')
  check('vitrina.js: «Compartir» solo en la tuya con cartas, por import()', /propia && cartas\.length \? `<button type="button" class="link-btn vitrina-compartir" data-vitrina-compartir aria-label="Compartir la vitrina">/.test(v) && /import\('\.\/vitrina-imagen\.js'\)/.test(v))
  check('  …y /perfil le pasa el nombre de usuario', /usuario: currentProfile\?\.username \|\| ''/.test(leer('js/perfil.js')))
}

console.log(fails ? `\n${fails} FALLOS` : '\nTODO OK')
process.exit(fails ? 1 : 0)
