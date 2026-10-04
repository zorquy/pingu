"""Rigor de la tanda 525 — la marca que se perdía al ganar precisión.

El fallo que arregla no da ningún error: la fila de la rareza se queda con
el nombre y sin el dibujo, en miles de cartas de dos eras enteras.
"""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

RAR = 'js/rarezas.js'
CAR = 'js/carta-nucleo.js'

MUTACIONES = [
    # El fallo original: la marca sale de la rareza precisa y nada más.
    (RAR, 'la marca se queda sin respaldo',
     "  return marcaDeRarezaHtml(carta?.rarity_en, opciones) || marcaDeRarezaHtml(carta?.rarity, opciones)",
     '  return marcaDeRarezaHtml(carta?.rarity_en, opciones)'),
    # Y al revés: si manda la gruesa, la arcoíris pierde la suya y
    # volvemos a la 523.
    (RAR, 'manda la rareza gruesa y la arcoíris pierde su marca',
     "  return marcaDeRarezaHtml(carta?.rarity_en, opciones) || marcaDeRarezaHtml(carta?.rarity, opciones)",
     '  return marcaDeRarezaHtml(carta?.rarity, opciones) || marcaDeRarezaHtml(carta?.rarity_en, opciones)'),
    # La entrada de la arcoíris, que es la que hace que el orden importe.
    (RAR, 'la arcoíris sale de la tabla de marcas',
     "  'Rara Arcoíris': { forma: DIAMANTE, acabado: 'oro' },\n", ''),
    # Un vacío que NO es un olvido: una promo no lleva marca impresa.
    (RAR, 'a lo que no tiene marca se le dibuja una',
     "  const m = MARCAS[rarezaEs(valor)]\n  if (!m) return ''",
     "  const m = MARCAS[rarezaEs(valor)] || MARCAS['Rara']\n  if (!m) return ''"),
    # Y la ficha, que es donde se ve.
    (CAR, 'la ficha vuelve a pedir la marca de la cadena precisa',
     "  if (cruda) filas.push(['Rareza', rarezaEs(cruda), marcaDeCartaHtml(carta)])",
     "  if (cruda) filas.push(['Rareza', rarezaEs(cruda), marcaDeRarezaHtml(cruda)])"),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-525.mjs')
