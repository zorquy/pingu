-- Tanda 1451 — Los tickets del juez se cierran solos (propuesta «El torneo, de
-- nuevo», PINGU: «los tickets sin atender se ven de una manera horrible»; en
-- el Tardeo de Testeo quedaron tickets abiertos de mesas ya terminadas).
--
-- Un ticket abierto o en curso de una mesa que TERMINA (tiene resultado, bye o
-- no presentados) se cierra con la nota «Se cerró solo: la mesa terminó». Y
-- cuando el torneo acaba (terminado o cancelado), se cierran todos los que
-- queden. Lo hacen dos disparadores en la base, para que valga lo cierre quien
-- lo cierre (un jugador al reportar, el juez a mano, el respaldo programado).
-- Si el juez ya había escrito una nota, se respeta.
--
-- Se puede ejecutar dos veces. Sin tablas temporales (tanda 631).

create or replace function public.torneos_cerrar_tickets_de_mesa() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status in ('finished', 'bye', 'forfeit_a', 'forfeit_b', 'forfeit_both')
     and old.status is distinct from new.status then
    update public.judge_calls
       set status = 'resolved',
           resolved_at = now(),
           nota = coalesce(nullif(nota, ''), 'Se cerró solo: la mesa terminó.')
     where match_id = new.id and status in ('open', 'in_progress');
  end if;
  return new;
end $$;

drop trigger if exists tickets_al_cerrar_mesa on public.tournament_matches;
create trigger tickets_al_cerrar_mesa
  after update of status on public.tournament_matches
  for each row execute function public.torneos_cerrar_tickets_de_mesa();

create or replace function public.torneos_cerrar_tickets_del_torneo() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status in ('finished', 'cancelled') and old.status is distinct from new.status then
    update public.judge_calls
       set status = 'resolved',
           resolved_at = now(),
           nota = coalesce(nullif(nota, ''), case when new.status = 'finished'
             then 'Se cerró solo: el torneo terminó.' else 'Se cerró solo: el torneo se canceló.' end)
     where tournament_id = new.id and status in ('open', 'in_progress');
  end if;
  return new;
end $$;

drop trigger if exists tickets_al_acabar_torneo on public.tournaments;
create trigger tickets_al_acabar_torneo
  after update of status on public.tournaments
  for each row execute function public.torneos_cerrar_tickets_del_torneo();

-- Y los que ya se quedaron colgados de mesas terminadas o torneos acabados.
update public.judge_calls j
   set status = 'resolved',
       resolved_at = now(),
       nota = coalesce(nullif(j.nota, ''), 'Se cerró solo: la mesa terminó.')
  from public.tournament_matches m
 where m.id = j.match_id
   and j.status in ('open', 'in_progress')
   and m.status in ('finished', 'bye', 'forfeit_a', 'forfeit_b', 'forfeit_both');

update public.judge_calls j
   set status = 'resolved',
       resolved_at = now(),
       nota = coalesce(nullif(j.nota, ''), 'Se cerró solo: el torneo terminó.')
  from public.tournaments t
 where t.id = j.tournament_id
   and j.status in ('open', 'in_progress')
   and t.status in ('finished', 'cancelled');
