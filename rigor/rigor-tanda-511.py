"""Rigor de la tanda 511 — las megas de la imagen del meta.

Lo que se rompe aquí no da error: una mega que cae a su especie base (que
era el fallo), un sprite con su margen transparente dibujado diminuto, o
un 404 del proxy que no dice por qué. Cada mutación rompe el ORIGEN.
"""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

SPR = 'js/torneos/sprites-pokemon.js'
IMG = 'js/torneos/meta-imagen.js'
PRX = 'netlify/functions/sprite.mjs'
ESC = 'netlify/functions/escaneo.mjs'

MUTACIONES = [
    (SPR, 'una mega cae a su especie base antes que a su dibujo',
     '  const id = MEGAS_POKEAPI.get(slugForma) || idPokeapi\n', '  const id = null\n'),
    (SPR, 'las formas con número de PokeAPI (Ogerpon, Ursaluna) no lo usan',
     'respaldoDeForma(f.slug, slugBase, f.dex >= 10000 && f.dex < 20000 ? f.dex : null)', 'respaldoDeForma(f.slug, slugBase)'),
    (SPR, 'las megas que se registran solas (Heatran) no prueban PokeAPI',
     "  respaldoDeForma(`${slugLimitless(especie)}-mega`, slugLimitless(especie))",
     "  RESPALDO_POR_URL.set(`${CDN_SPRITES}/${slugLimitless(especie)}-mega.png`, `${CDN_SPRITES}/${slugLimitless(especie)}.png`)"),
    (SPR, 'tras PokeAPI ya no se vuelve a la especie base',
     '  return DESPUES_DE_POKEAPI.get(u) || null', '  return null'),
    (SPR, 'la cadena se corta antes de la especie base',
     '  for (let i = 0; i < 6; i++) {', '  for (let i = 0; i < 4; i++) {'),
    (SPR, 'una mega de la lista apunta a otro número',
     'lucario-mega:10059', 'lucario-mega:10058'),
    (IMG, 'el sprite se dibuja con su margen transparente',
     '    const v = icono.caja || cajaVisible(img)\n', '    const v = { x: 0, y: 0, w: img.width, h: img.height }\n'),
    (IMG, 'el recorte no mira la transparencia',
     '        if (data[(y * c.width + x) * 4 + 3] > 8) {', '        if (data[(y * c.width + x) * 4] > 8) {'),
    (PRX, 'el proxy no dice por qué no hay sprite',
     "'cache-control': 'public, max-age=3600', 'x-motivo': motivo }", "'cache-control': 'public, max-age=3600' }"),
    (PRX, 'el proxy pide sin decir quién es',
     '{ headers: CABECERAS_ORIGEN, signal: AbortSignal.timeout(6000) }', '{ signal: AbortSignal.timeout(6000) }'),
    (PRX, 'un origen que contesta 403 no se distingue',
     '      alFallar(`origen ${res.status}`)', "      alFallar('origen')"),
    (ESC, 'el proxy de escaneos no dice por qué',
     "'cache-control': 'public, max-age=3600', 'x-motivo': motivo }", "'cache-control': 'public, max-age=3600' }"),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-511.mjs')
