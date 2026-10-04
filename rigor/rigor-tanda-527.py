"""Rigor de la tanda 527 — lo que dijeron los datos en la primera pasada.

La mutación que importa es la del informe: si vuelve a preguntar «¿se
traduce a sí misma?», señala «Promo» —que está bien— y el día que aparezca
una rareza de verdad estará en una lista que nadie lee.
"""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

NOM = 'js/rarezas-nombres.js'
ADM = 'admin/js/admin.js'

MUTACIONES = [
    (NOM, '«Shiny Rare» se queda sin traducción', "  'Shiny Rare': 'Rara Brillante',\n", ''),
    (NOM, 'conocida vuelve a ser «cambia de palabra»',
     '  return !!valor && CANONICA.has(String(valor))',
     '  return !!valor && rarezaEs(valor) !== String(valor)'),
    (NOM, 'conocida dice que sí a todo',
     '  return !!valor && CANONICA.has(String(valor))',
     '  return true'),
    (NOM, 'una rareza nueva deja de enseñarse en inglés',
     '  return CANONICA.get(valor) || String(valor)',
     "  return CANONICA.get(valor) || 'Sin rareza'"),
    (ADM, 'el informe vuelve a comparar la traducción consigo misma',
     'const sinTraducir = [...porRareza.keys()].filter((r) => !rarezaConocida(r))',
     'const sinTraducir = [...porRareza.keys()].filter((r) => rarezaEs(r) === r)'),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-527.mjs')
