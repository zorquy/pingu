"""Rigor de la tanda 1070 (lo que no necesita pantalla).

Cada mutación rompe el ORIGEN: el puesto imposible, el puesto en el texto,
el tono de «Color», cuándo coincide y cuándo se quita el predeterminado, el
orden de tus mazos, leer el puesto, y en la migración el arrastre del mazo
guardado, la privacidad del predeterminado, el puesto que no cabe y el mazo
que no es tuyo."""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

IMG = 'js/partida-imagen.js'
EM = 'js/partidas-elegir-mazo.js'
PM = 'js/partidas-mazos.js'
MIG = 'supabase-migration-1070-torneos-mazo-y-puesto.sql'

MUTACIONES = [
    (IMG, 'un puesto imposible se enseña', "  if (jugadores != null && Number.isInteger(j) && j >= 2 && p > j) return null\n", ""),
    (IMG, 'el 3.º no es Top 4', "p <= 4 ? 'Top 4'", "p <= 2 ? 'Top 4'"),
    (IMG, 'el texto no lleva el puesto', "`🏆 ${t.nombre}: ${pu ? `${pu.largo} · ` : ''}${texto}", "`🏆 ${t.nombre}: ${texto}"),
    (IMG, '«Color» no mira la medalla', "  if (pu && pu.medalla !== 'azul') return MEDALLA[pu.medalla].oscuro\n", ""),
    (IMG, 'el mosaico enseña más de 16', "  const visibles = total > maxBaldosas ? maxBaldosas - 1 : total", "  const visibles = total"),
    (EM, 'el predeterminado guardado se compara por arquetipo', "  if (predet.user_deck_id) return valor.guardado === predet.user_deck_id\n", ""),
    (EM, 'desmarcar no quita', "  if (!marcado && es) return 'quitar'\n", ""),
    (EM, 'el predeterminado no va primero', "  return p ? [...lista.filter((m) => m.id === p), ...lista.filter((m) => m.id !== p)] : lista", "  return lista"),
    (EM, 'lo recordado manda sobre el predeterminado', "  if (predet?.user_deck_id) return 'guardado'\n", ""),
    (PM, '«30.º de 24» pasa', "  if (puesto !== null && jugadores !== null && puesto > jugadores) return { error: `No puedes quedar ${puesto}.º de ${jugadores}.` }\n", ""),
    (MIG, 'el arrastre no lleva el mazo guardado', "           user_deck_id = new.user_deck_id,\n", ""),
    (MIG, 'cualquiera lee el predeterminado de otro', "create policy ajustes_partidas_ver on public.match_log_ajustes for select to authenticated\n  using (user_id = auth.uid());", "create policy ajustes_partidas_ver on public.match_log_ajustes for select to authenticated\n  using (true);"),
    (MIG, 'el puesto no tiene por qué caber', "  check (puesto is null or jugadores is null or puesto <= jugadores);", "  check (true);"),
    (MIG, 'un torneo se cuelga del mazo de otro', "create trigger match_log_torneos_mazo_propio\n  before insert or update of user_deck_id, user_id on public.match_log_torneos\n  for each row execute function public.match_log_mazo_propio();", "select 1;"),
    (MIG, 'sin anon fuera', "    revoke all on public.match_log_ajustes from anon;", "    grant select on public.match_log_ajustes to anon;"),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-1070.mjs')
