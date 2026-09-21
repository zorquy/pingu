"""Rigor de la tanda 323 — las megas fuera de la lista curada.

Ninguna de estas mutaciones da error: el buscador sigue devolviendo una
lista, la pantalla sigue pintándose y el sprite sigue saliendo. Lo que
cambia es QUÉ SE PUEDE ELEGIR — y eso solo se nota cuando alguien va a
apuntar su partida y no encuentra su mazo.

Es la misma familia que el fallo original: el sistema sabía montar la
carta y el buscador no la ofrecía, sin que nada se quejara.
"""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

F = 'js/torneos/selector-mazo.js'

MUTACIONES = [
    # ── 1. El fallo original, tal cual ──
    # Sin el bloque entero volvemos al 2026-09-02: quien busca
    # Mega-Zeraora encuentra «Zeraora» y no puede apuntar la partida.
    (F, 'el buscador vuelve a recorrer solo las listas fijas',
     "  const resto = q.startsWith('mega') ? q.slice(4) : ''\n  if (resto.length >= 2) {",
     "  const resto = ''\n  if (false) {"),

    # ── 2. …y su versión sutil ──
    # El umbral tan alto que no se alcanza nunca. Parece un ajuste de
    # ruido y apaga la función entera.
    (F, 'el umbral de letras sube tanto que no entra nadie',
     '  if (resto.length >= 2) {', '  if (resto.length >= 20) {'),

    # ── 3. El umbral al revés: se inunda ──
    # Con cero letras, teclear «mega c» ofrece media Pokédex. La lista
    # está acotada a 40, así que NO desborda nada: simplemente el
    # principiante ve «Mega Caterpie» y ya no se fía de la lista.
    (F, 'basta con teclear «mega» para que salga media Pokédex',
     '  if (resto.length >= 2) {', '  if (resto.length >= 0) {'),

    # ── 4. Sin registrar, sin sprite ──
    # Llamar a `dexDeCarta` es lo que REGISTRA la mega en las tablas del
    # módulo. Sin esa llamada el número existe pero el slug no, así que
    # la opción sale con sprite null: un hueco en la lista.
    (F, 'la mega no se registra y sale sin sprite',
     '      const dex = dexDeCarta(nombre)\n      if (!dex) continue',
     '      const dex = 20000\n      if (!dex) continue'),

    # ── 5. La tercera mega falsa ──
    # Sin la guarda, «mega charizard» ofrece «Mega Charizard» a secas,
    # que NO ES UNA CARTA, y encima delante de las dos buenas por orden
    # alfabético.
    (F, 'vuelve a ofrecerse «Mega Charizard» a secas',
     '      if (yaCuradas.has(i + 1)) continue\n', ''),

    # ── 6. …y la guarda comparada por NOMBRE, que es lo que no vale ──
    # Es el error que se cometió al escribirlo: filtrar por nombre deja
    # pasar «Mega Charizard» porque no es igual a «Mega Charizard X».
    # Parece que arregla lo mismo y no arregla nada.
    (F, 'la guarda compara por nombre en vez de por especie',
     "    const yaCuradas = new Set(\n      FORMAS_TCG.filter((f) => f.base && String(f.nombre).startsWith('Mega ')).map((f) => f.base)\n    )",
     "    const yaCuradas = new Set()"),

    # ── 7. La sintetizada, con otro tipo ──
    # (Aquí había una mutación sobre un descarte de duplicados por
    # nombre, y el rigor la dio por «sin detectar» con razón: `yaCuradas`
    # ya impide que una mega curada llegue a sintetizarse, así que las
    # dos guardas se cubrían la una a la otra. Se quitó la que sobraba.)
    #
    # El tipo decide cómo trata la opción quien la recibe. Si una
    # sintetizada llega como 'carta' y una curada como 'pokemon', el
    # mismo mazo se comporta distinto según cuándo se apuntó.
    (F, 'la mega sintetizada llega con otro tipo que la curada',
     "        tipo: 'pokemon',\n        valor: `d:${nombre.toLowerCase()}`,",
     "        tipo: 'carta',\n        valor: `d:${nombre.toLowerCase()}`,"),

    # ── 8. El nombre, sin el «Mega» ──
    # Ofrecería «Zeraora» otra vez en vez de «Mega Zeraora»: el mazo se
    # apuntaría como la especie a secas y caería en la casilla
    # equivocada de la matriz de enfrentamientos.
    (F, 'la opción se llama como la especie, sin el «Mega»',
     '      const nombre = `Mega ${POKEMON_POR_DEX[i]}`',
     '      const nombre = POKEMON_POR_DEX[i]'),

    # ── 9. La clave de agrupación, distinta ──
    # Si no coincide con la de una mega curada, el MISMO mazo cae en dos
    # casillas según cuándo se apuntó. Y no da error: solo salen dos
    # filas donde debería haber una.
    (F, 'la clave de la sintetizada no es como la de una curada',
     '        valor: `d:${nombre.toLowerCase()}`,\n        nombre,',
     '        valor: `mega:${nombre.toLowerCase()}`,\n        nombre,'),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-323.mjs')
