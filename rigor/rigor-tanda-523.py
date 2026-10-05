"""Rigor de la tanda 523 — la rareza exacta que no llegaba a ninguna pantalla.

Todas estas mutaciones son SILENCIOSAS por construcción: una columna que no
se pide llega `undefined`, y `undefined || otra` es una expresión válida. Lo
que sale es la rareza gruesa de TCGdex con la precisa en la base.
"""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

NOM = 'js/rarezas-nombres.js'
TRA = 'js/carta-traducciones.js'
ORD = 'js/mi-coleccion/orden.js'
# La escala vive en su propio fichero desde la tanda 624.
ESC = 'js/rareza-escala.js'
FIL = 'js/mi-coleccion/filtros.js'
DAT = 'js/mi-coleccion/datos.js'
NUC = 'js/constructor/nucleo.js'
CAR = 'js/carta-nucleo.js'

MUTACIONES = [
    # La cadena de columnas, que es el fallo original de la tanda.
    (NOM, 'la cadena se queda solo en `rarity`',
     "  return carta?.rarity_en || carta?.rarity || null",
     '  return carta?.rarity || null'),
    (NOM, 'o solo en `rarity_en`',
     "  return carta?.rarity_en || carta?.rarity || null",
     '  return carta?.rarity_en || null'),
    # El vocabulario de Scrydex, que es lo que separa la arcoíris de la dorada.
    (NOM, 'la Rainbow vuelve a ser una hiperrara',
     "  'Rare Rainbow': 'Rara Arcoíris',\n", ''),
    # El brillo.
    # El mapa es la ÚNICA guarda del brillo a propósito: con el respaldo
    # por palabras puesto también, quitar cualquiera de las dos no cambiaba
    # nada y el rigor lo apuntaba como «sin detectar» (tandas 314 y 506).
    (TRA, 'la arcoíris brilla en oro',
     "  'Rara Arcoíris': 'arcoiris',\n", ''),
    (TRA, 'y la secreta también deja de ser oro',
     "  'Rara Secreta': 'dorada',\n", ''),
    # La escala.
    (ESC, 'la Rainbow se ordena como una rara del montón',
     "  [/\\b(rainbow|arcoiris)\\b/i, 11],\n", ''),
    (ESC, 'y la secreta igual',
     "  [/\\b(secret|secreta)\\b/i, 11],\n", ''),
    # Los chips de filtro.
    (FIL, 'los chips ignoran la columna preferida',
     "  const preferido = g.prefiere ? carta?.[g.prefiere] : null\n  return [preferido || carta?.[g.columna]]",
     '  return [carta?.[g.columna]]'),
    (FIL, 'el grupo de rareza se queda sin columna preferida',
     "columna: 'rarity', prefiere: 'rarity_en', mapa: 'RAREZAS_ES' }",
     "columna: 'rarity', mapa: 'RAREZAS_ES' }"),
    (FIL, 'el chip de tu colección mira la columna gruesa',
     "de: (l, c, a) => (rarezaCrudaDeCarta(c) ? [a.rarezaEs(rarezaCrudaDeCarta(c))] : [])",
     'de: (l, c, a) => (c?.rarity ? [a.rarezaEs(c.rarity)] : [])'),
    (FIL, 'el orden por rareza mira la columna gruesa',
     "case 'rareza': return rango(rarezaCrudaDeCarta(c))",
     "case 'rareza': return rango(c?.rarity)"),
    # Y EL BARRIDO: una consulta que se deja la columna. Es la mutación que
    # de verdad reproduce la tanda, porque lo demás estaba bien desde la 510.
    (DAT, 'la consulta de tu colección se deja `rarity_en`',
     'image_tcggo,rarity,rarity_en,category,variants,illustrator',
     'image_tcggo,rarity,category,variants,illustrator'),
    # Las reglas de mazo.
    (NUC, 'el AS táctico vuelve a mirar una sola columna',
     "const rarezasDe = (carta) => `${carta?.rarity_en || ''} ${carta?.rarity || ''}`",
     "const rarezasDe = (carta) => `${carta?.rarity || ''}`"),
    # Y la ficha de /carta, que era la pantalla de la queja.
    (CAR, '/carta vuelve a rotular la rareza gruesa',
     "  const cruda = rarezaCrudaDeCarta(carta)\n  if (cruda) filas.push(['Rareza', rarezaEs(cruda), marcaDeCartaHtml(carta)])",
     "  if (carta?.rarity) filas.push(['Rareza', rarezaEs(carta.rarity), marcaDeCartaHtml(carta)])"),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-523.mjs')
