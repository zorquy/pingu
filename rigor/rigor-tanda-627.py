"""Rigor de la tanda 627 — tus repeticiones en Mis partidas, enlazadas con
tus mazos guardados.

Cada mutación rompe el ORIGEN: la función pura que arma la fila, la
sonda que dice si la base tiene la columna, el disparador de la base, o
el paso de la página que lo usa."""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

PM = 'js/partidas-mazos.js'
MP = 'js/mis-partidas.js'
REP = 'js/repeticiones.js'
DAT = 'js/repeticiones/datos.js'
SQL = 'supabase-migration-partidas-mazo-guardado.sql'

MUTACIONES = [
    # ── Lo puro ──
    (PM, 'la columna va aunque la base no la tenga', "  if (conVinculo && mazoGuardado) fila.user_deck_id = mazoGuardado", "  if (mazoGuardado) fila.user_deck_id = mazoGuardado"),
    (PM, 'tu mazo es el que se vio, no el guardado', "  const mio = arqGuardado\n", "  const mio = false\n"),
    (PM, 'las energías en español cuentan como entrenadores', "  if (/energ/.test(c)) return 'energy'", "  if (/energy/.test(c)) return 'energy'"),
    (PM, 'las repeticiones ya apuntadas se vuelven a ofrecer', "    .filter((r) => r?.id && !ya.has(r.id))", "    .filter((r) => r?.id)"),
    (PM, 'el desplegable pierde el mazo que la fila ya tiene', "  if (actual && !ops.some((o) => o.id === actual)) ops.push(", "  if (false) ops.push("),
    (PM, 'un mazo con nombre del catálogo no casa con él', "  const arq = (catalogo || []).find((a) => a?.activo !== false && normalizarNombre(a.nombre || '') === n)", "  const arq = null"),

    # ── /mis-partidas ──
    (MP, 'la sonda da la columna por puesta siempre', "  vinculoMazo = !sonda.error", "  vinculoMazo = true"),
    (MP, 'una ronda de torneo también ofrece mazo guardado', "  $('partidaCamposMios').classList.toggle('hidden', esRonda)", "  $('partidaCamposMios').classList.toggle('hidden', false)"),
    (MP, 'el resultado del registro no cuenta', "  const resultado = resultadoDeRepeticion(rep, yo) || caja.querySelector('[name=desdeRepRes]:checked')?.value || null", "  const resultado = caja.querySelector('[name=desdeRepRes]:checked')?.value || null"),
    (MP, 'sin decir cómo acabó, se apunta igual', "  if (!resultado) return showToast('Dinos cómo acabó.', 'error')\n", ""),
    (MP, 'el arquetipo del guardado se pide sin la categoría', "    const { data, error } = await supabase.from('tcg_cards').select('id,name,category').in('id', faltan)", "    const { data, error } = await supabase.from('tcg_cards').select('id,name').in('id', faltan)"),
    (MP, 'elegir el mazo no rellena «Tu mazo»', "  if (arq && !selectores.mio1?.valor()) ponerMazoEnSelector(", "  if (false) ponerMazoEnSelector("),
    (MP, 'al editar, el desplegable no trae el mazo de la partida', "  sel.value = actual || ''", "  sel.value = ''"),
    (MP, 'el formulario no guarda el mazo', "  if (vinculoMazo && !rondaPara) fila.user_deck_id = $('partidaMazoGuardado').value || null\n", ""),

    # ── /repeticiones ──
    (REP, 'al guardar, el mazo no se enlaza', "conVinculo: Boolean(R.enlazar?.vinculo) }", "conVinculo: false }"),
    (REP, 'al guardar, tu mazo es el que se vio', "  const arqYo = arqGuardado || R.mazos?.[yo]?.arq || null", "  const arqYo = R.mazos?.[yo]?.arq || null"),
    (DAT, 'la sonda de /repeticiones da la columna por puesta', "  return { mazos: mazos.error ? [] : mazos.data || [], vinculo: !sonda.error }", "  return { mazos: mazos.error ? [] : mazos.data || [], vinculo: true }"),

    # ── La base ──
    (SQL, 'el mazo de otra persona también vale', "    select 1 from public.user_decks d where d.id = new.user_deck_id and d.user_id = new.user_id", "    select 1 from public.user_decks d where d.id = new.user_deck_id"),
    (SQL, 'borrar el mazo se lleva sus partidas', "references public.user_decks (id) on delete set null", "references public.user_decks (id) on delete cascade"),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-627.mjs')
