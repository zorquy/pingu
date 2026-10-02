"""Rigor de la tanda 437 — qué catálogo se mira.

Casi nada de esto da error al romperse. Un mercado que no llega a una
consulta devuelve el catálogo inglés con toda normalidad: la pantalla se ve
perfecta, solo que enseña otra cosa de la que dice. Es el fallo que se ve
bien, que es el que hay que cazar aquí.
"""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

J = 'js/mi-coleccion.js'
D = 'js/mi-coleccion/datos.js'
A = 'js/mi-coleccion/albumes.js'
H = 'mi-coleccion.html'

MUTACIONES = [
    # ── El mercado no llega a una consulta ──
    (D, 'tus lineas salen de todos los mercados a la vez',
     "      .eq('user_id', userId)\n      .eq('market', mercado)", "      .eq('user_id', userId)"),
    (D, 'las cartas de tus lineas se buscan siempre en el ingles',
     ".select(COLUMNAS_CARTA).eq('market', mercado).in('id'", ".select(COLUMNAS_CARTA).eq('market', 'WEST').in('id'"),
    (D, 'una expansion trae siempre las cartas inglesas',
     "variants,tcg_sets(tcg_online_code,serie_id)')\n    .eq('market', mercado)",
     "variants,tcg_sets(tcg_online_code,serie_id)')\n    .eq('market', 'WEST')"),
    (D, 'las cartas de una especie son siempre las inglesas',
     "    .select(COLUMNAS_CARTA)\n    .eq('market', mercado)\n    .contains('dex_ids'",
     "    .select(COLUMNAS_CARTA)\n    .eq('market', 'WEST')\n    .contains('dex_ids'"),
    (D, 'la pokedex se pide siempre sin decir el mercado',
     "  const { data, error } = mercado === 'WEST'\n    ? await supabase.rpc('pokedex_resumen')\n    : await supabase.rpc('pokedex_resumen', { p_market: mercado })",
     "  const { data, error } = await supabase.rpc('pokedex_resumen')"),
    (J, 'la estanteria trae siempre las colecciones inglesas',
     "card_count_total,tcg_online_code')\n    .eq('market', mercado)",
     "card_count_total,tcg_online_code')\n    .eq('market', 'WEST')"),
    (J, 'el buscador busca siempre en el catalogo ingles',
     "release_date,tcg_online_code)').eq('market', mercado)",
     "release_date,tcg_online_code)').eq('market', 'WEST')"),

    # ── El cambio no limpia lo que ya estaba ──
    (J, 'al cambiar de catalogo la estanteria se queda con la anterior',
     "  todosLosSets = null\n  album = {", "  album = {"),
    (J, 'al cambiar de catalogo la pokedex se queda con la anterior',
     "  pokedex = null\n  pokedexCargada = false", "  pokedex = null"),

    # ── El selector ──
    (J, 'la eleccion no se guarda',
     "    localStorage.setItem(CLAVE_MERCADO, nuevo)", "    void nuevo"),
    (J, 'la eleccion guardada no se lee al entrar',
     "    return VISTAS.some((x) => x.id === v) ? v : 'es'", "    return v && 'es'"),
    (J, 'solo se entera el primer selector de los tres',
     "  for (const sel of document.querySelectorAll('.mc-mercado')) {\n    if (sel.innerHTML !== opciones) sel.innerHTML = opciones\n    sel.value = vista\n",
     "  for (const sel of [document.querySelector('.mc-mercado')].filter(Boolean)) {\n    if (sel.innerHTML !== opciones) sel.innerHTML = opciones\n    sel.value = vista\n"),
    # La lista pasó a ser de VISTAS en la 438. Quitarle el japonés deja a
    # /mi-coleccion sin más catálogo que el occidental, que es el fallo de
    # esta tanda al completo.
    (J, 'se queda sin ningun catalogo que elegir aparte del occidental',
     "  { id: 'ja', bandera: '\U0001F1EF\U0001F1F5', nombre: 'Japonés', mercado: 'JP', enEspanol: false },\n", "  "),
    (J, 'cambiar de catalogo no vuelve a cargar nada',
     "  $('mcCargando')?.classList.remove('hidden')\n  await cargarColeccion(duenoActual)",
     "  $('mcCargando')?.classList.remove('hidden')"),

    # ── Y el HTML ──
    (H, 'la pestana de cartas se queda sin selector',
     '          <select class="mc-chapa-select mc-mercado" aria-label="Qué catálogo se mira"></select>\n          <button type="button" class="mc-chip-mando mc-chip-solo-icono hidden" id="mcFiltrosQuitar"',
     '          <button type="button" class="mc-chip-mando mc-chip-solo-icono hidden" id="mcFiltrosQuitar"'),
    (H, 'la estanteria se queda sin selector',
     '<select id="mcEstanteriaSerie" class="mc-chapa-select" aria-label="Serie"></select>\n            <select class="mc-chapa-select mc-mercado" aria-label="Qué catálogo se mira"></select>',
     '<select id="mcEstanteriaSerie" class="mc-chapa-select" aria-label="Serie"></select>'),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-437.mjs')
