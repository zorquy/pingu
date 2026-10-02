"""Rigor de la tanda 425 — la imagen del meta de un torneo.

Casi nada de esto da error al romperse. Un botón que le sale a un jugador
no rompe nada; una imagen sin sprites se baja igual; una cifra encima de
un trozo del anillo se lee mal pero se lee; y un proxy que acepta
cualquier dirección funciona PERFECTAMENTE, que es justo el problema.
Cada mutación rompe el ORIGEN de una de esas cosas.
"""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

R = 'js/torneos/ronda.js'
MT = 'js/torneos/meta-torneo.js'
MI = 'js/torneos/meta-imagen.js'
SP = 'netlify/functions/sprite.mjs'
NT = 'netlify.toml'
CSS = 'css/torneos.css'

MUTACIONES = [
    # ── 1. /sprite ──
    (SP, 'el filtro deja pasar cualquier cosa',
     'export const NOMBRE_VALIDO = /^[a-z0-9]+(?:-[a-z0-9]+)*$/', 'export const NOMBRE_VALIDO = /./'),
    (SP, 'sin tope de largo',
     '  if (n.length > 40 || !NOMBRE_VALIDO.test(n)) return null', '  if (!NOMBRE_VALIDO.test(n)) return null'),
    (SP, 'un 404 de la CDN pasa por sprite',
     '    if (!res.ok) return null\n', ''),
    (SP, 'una página de error con un 200 pasa por sprite',
     "    if (!/^image\\//.test(tipo)) return null\n", ''),
    (SP, 'el sprite no se cachea',
     "headers: { 'content-type': sprite.tipo, 'cache-control': CACHE }", "headers: { 'content-type': sprite.tipo, 'cache-control': 'no-store' }"),
    (NT, 'netlify.toml sin la regla de /sprite',
     'from = "/sprite/:n"', 'from = "/sprites-viejos/:n"'),

    # ── 2. Quién ve el botón ──
    (R, 'el botón sale con el torneo en juego',
     "    exportar: ctx.torneo.status === 'finished' && Boolean(mando()),", '    exportar: Boolean(mando()),'),
    (R, 'el botón sale a cualquiera',
     "    exportar: ctx.torneo.status === 'finished' && Boolean(mando()),", "    exportar: ctx.torneo.status === 'finished',"),
    (MT, 'el botón no se pinta',
     '  const imagen = ayudas.exportar\n', '  const imagen = false\n'),
    (R, 'el botón no hace nada',
     '        void descargarMetaComoImagen(imagen)', '        void 0'),
    (R, 'el botón no se apaga mientras se monta',
     'async function descargarMetaComoImagen(boton) {\n  boton.disabled = true\n', 'async function descargarMetaComoImagen(boton) {\n'),
    (CSS, 'el botón se queda pequeño con el dedo',
     '  .torneo-meta-volver,\n  .torneo-meta-imagen { min-height: 44px; }', '  .torneo-meta-volver { min-height: 44px; }'),

    # ── 3. Los datos de la imagen ──
    (R, 'el top no es la clasificación final',
     '      top: tabla.slice(0, 4).map(', '      top: [...tabla].reverse().slice(0, 4).map('),
    (R, 'la fecha no llega',
     '        fecha: ctx.torneo.start_at,', '        fecha: null,'),
    (R, 'las rondas no llegan',
     "        rondas: rondas.filter((r) => r.phase !== 'top_cut').length,", '        rondas: 0,'),
    (R, 'los jugadores son las listas',
     '      jugadores: tabla.length,', '      jugadores: arquetipos.size,'),
    (MI, 'los sueltos no van a «Otros»',
     'grupos.filter((g) => g.cuantos > 1)', 'grupos.filter((g) => g.cuantos > 0)'),
    (MI, 'un solo suelto va como «Otros»',
     '  if (resto.length === 1) {', '  if (false) {'),
    (MI, 'el «ex» se queda en el nombre',
     "String(n || '').replace(/\\s+ex\\b/gi, '')", "String(n || '')"),
    (MI, 'el porcentaje con punto',
     ".toFixed(1).replace('.', ',')} %`", ".toFixed(1)} %`"),
    (MI, 'la imagen sale a resolución normal',
     'const ESCALA = 2', 'const ESCALA = 1'),

    # ── 4. Los sprites ──
    (MI, 'los sprites se piden a Limitless directo (sin /sprite)',
     "  return u.startsWith(`${CDN_SPRITES}/`) ? `/sprite/${u.slice(CDN_SPRITES.length + 1).replace(/\\.png$/, '')}` : u", '  return u'),
    (MI, 'sin respaldo cuando /sprite no lo tiene',
     '[icono.url, ...cadenaDeRespaldos(icono.url)]', '[icono.url]'),
    (MI, 'el canvas pide las imágenes sin permiso (y se mancha)',
     "    img.crossOrigin = 'anonymous'\n", ''),
    (MI, 'el mazo con pareja enseña un solo sprite',
     '      const dos = suyos.length > 1 && largo >= 110', '      const dos = false'),
    (MI, 'el sprite no se pinta en su trozo',
     '      } else {\n        pintarIcono(ctx, suyos[0], mx, my, lado)\n      }', '      }'),

    # ── 5. Las cifras de los porcentajes ──
    (MI, 'las cifras de un lado se pisan',
     '      if (a.ini + a.n * sep <= b.ini) break', '      break'),
    (MI, 'un racimo se cae hacia abajo',
     'b.suma / b.n - ((b.n - 1) * sep) / 2', 'b.suma / b.n'),
    (MI, 'una cifra se sale por abajo',
     'max - (b.n - 1) * sep))', 'Infinity))'),
    (MI, 'una cifra se sale por arriba',
     '    b.ini = Math.max(min, ', '    b.ini = Math.max(-Infinity, '),
    (MI, 'una cifra subida o bajada se pinta encima del anillo',
     '  let hx = derecha ? Math.max(gx + 14, CX + libre) : Math.min(gx - 14, CX - libre)', '  let hx = gx + (derecha ? 14 : -14)'),
    (MI, 'una cifra pisa la leyenda o se sale de la imagen',
     '  hx = derecha ? Math.min(hx, BORDE_DER - 6 - w) : Math.max(hx, BORDE_IZQ + 6 + w)\n', ''),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-425.mjs')
