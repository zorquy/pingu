"""Rigor de la tanda 1070 (las pantallas).

Cada mutación rompe el ORIGEN de lo que se ve o se guarda: la ronda que no
copia el mazo guardado, el torneo sin puesto, el predeterminado que no se
guarda ni se usa, el arquetipo que se deduce otra vez al editar, el cierre sin
puesto, el podio de PokeDoc, la hoja que no pasa lo elegido ni lo recuerda, y
la chapa de /mazos."""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

MP = 'js/mis-partidas.js'
EM = 'js/partidas-elegir-mazo.js'
CH = 'js/compartir-hoja.js'
MZ = 'js/mazos.js'

MUTACIONES = [
    (MP, 'la ronda no copia el mazo guardado del torneo', "  if (vinculoMazo && rondaPara && torneoAlDia) fila.user_deck_id = rondaPara.user_deck_id || null\n", ""),
    (MP, 'el torneo se guarda sin puesto', "Object.assign(campos, { user_deck_id: mazo.guardado || null, puesto: puesto.puesto, jugadores: puesto.jugadores })", "Object.assign(campos, { user_deck_id: mazo.guardado || null })"),
    (MP, 'el torneo no guarda el predeterminado', "    await aplicarPredeterminado(cambioPredet, mazo)\n    showToast('Torneo actualizado.", "    showToast('Torneo actualizado."),
    (MP, 'cerrar no guarda el puesto', "  if (puesto && torneoAlDia) Object.assign(cambios, { puesto: puesto.puesto, jugadores: puesto.jugadores })\n", ""),
    (MP, 'el podio de PokeDoc no da el puesto', "      torneoPuesto: enPodio >= 0 ? enPodio + 1 : null,", "      torneoPuesto: null,"),
    (MP, 'sin la migración se ofrece igual', "  torneoAlDia = !sondaTorneo.error && vinculoMazo", "  torneoAlDia = vinculoMazo"),
    (EM, 'un torneo nuevo no sale con tu predeterminado', "        if (origen === 'guardado' && deFila) elegir(predet.user_deck_id)", "        if (false) elegir(predet.user_deck_id)"),
    (EM, 'la casilla no sigue a lo elegido', "    if (casilla && !casilla.dataset.tocada) casilla.checked = coincideConPredeterminado(valorSincrono(), o.predet())", "    if (casilla && !casilla.dataset.tocada) casilla.checked = Boolean(o.predet())"),
    (EM, 'una lista sin Pokémon se apunta sin arquetipo', "      if (origen === 'guardado' && elegido && !v?.clave) return { error: 'Dinos a qué juega ese mazo: su lista no lo dice.' }\n", ""),
    (CH, 'la hoja no pasa lo elegido al dibujo', "    if (f === 'historia' && historiaPropia) return (lienzos[clave] = await imagen('larga', pedido))", "    if (f === 'historia' && historiaPropia) return (lienzos[clave] = await imagen('larga'))"),
    (CH, 'la hoja no recuerda lo elegido', "      guardarEleccion(op.recordar, op.puesto ? eleccion : { diseno: eleccion.diseno, fondo: eleccion.fondo })\n", ""),
    (CH, 'el texto de X no sigue al puesto', "    d.querySelector('#chTextoX').textContent = textoX()\n", ""),
    (MZ, '/mazos no enseña la chapa', "          ${predeterminado?.user_deck_id === m.id ? `<span class=\"mz-chip mz-chip-predet\"", "          ${false ? `<span class=\"mz-chip mz-chip-predet\""),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-1070-pantalla.mjs')
