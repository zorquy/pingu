-- Tanda 1331 — Las tiendas organizan sus torneos (G11 del plan 2027).
--
-- Un torneo «de tienda» es el que crea una cuenta de tipo tienda: no hace falta
-- otra columna para eso (se mira `user_profiles.tipo` de quien lo creó). Lo
-- nuevo es el precio de la inscripción, INFORMATIVO: se paga en persona y
-- PokeDoc no cobra nada (sin pagos, como siempre). Lo puede poner cualquiera
-- que organice; en una tienda se lee «10 € en tienda».
--
-- Re-ejecutable.

alter table public.tournaments add column if not exists precio_entrada numeric(8,2);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tournaments_precio_entrada_ok') then
    alter table public.tournaments
      add constraint tournaments_precio_entrada_ok
      check (precio_entrada is null or (precio_entrada >= 0 and precio_entrada <= 1000));
  end if;
end $$;

comment on column public.tournaments.precio_entrada is
  'Inscripción en euros, solo informativa (se paga en persona; PokeDoc no cobra). NULL = no se dice.';

notify pgrst, 'reload schema';
