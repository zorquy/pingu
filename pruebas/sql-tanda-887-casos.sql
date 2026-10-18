-- Tanda 887: intercambios_de_persona sobre el fixture del Mercado
-- (sql-mercado.sql: misty da Umbreon es y Charizard es+en; brock Umbreon en
-- y Pikachu; gary, baneado, Mew; yo Pikachu).
-- El fixture del Mercado no lleva estado, variante ni gradeo (la tabla de verdad sí).
alter table public.user_collection add column if not exists estado text, add column if not exists variante text, add column if not exists gradeo text;
\i /home/user/pingu/supabase-migration-887-cambios-perfil.sql
select '887 ' || case when count(*) = 3 then 'ok  ' else 'MAL ' end || 'misty da tres líneas (Umbreon es, Charizard es y en)' from public.intercambios_de_persona('00000000-0000-0000-0000-0000000000a2');
select '887 ' || case when count(*) = 0 then 'ok  ' else 'MAL ' end || 'gary, baneado, no da nada' from public.intercambios_de_persona('00000000-0000-0000-0000-0000000000a4');
select '887 ' || case when bool_and(cambio > 0) then 'ok  ' else 'MAL ' end || 'solo lo que se da (cambio > 0)' from public.intercambios_de_persona('00000000-0000-0000-0000-0000000000a3');
select '887 ' || case when count(*) = 1 then 'ok  ' else 'MAL ' end || 'con tope 1, una' from public.intercambios_de_persona('00000000-0000-0000-0000-0000000000a2', 1);
set role anon;
select '887 ' || case when count(*) = 3 then 'ok  ' else 'MAL ' end || 'sin cuenta también se ve (es el escaparate)' from public.intercambios_de_persona('00000000-0000-0000-0000-0000000000a2');
reset role;
select '887 ' || case when count(*) = 0 then 'ok  ' else 'MAL ' end || 'alguien sin nada, nada' from public.intercambios_de_persona('00000000-0000-0000-0000-0000000000a9');
