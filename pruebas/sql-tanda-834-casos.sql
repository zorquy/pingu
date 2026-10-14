\set ON_ERROR_STOP on
create table public.resultado (n serial, caso text, ok boolean);
grant all on public.resultado, public.resultado_n_seq to authenticated, anon;
-- La fila de Misty, puesta desde el SQL Editor (sin RLS).
insert into user_play_pokemon (user_id, player_id, player_name, birth_date) values ('00000000-0000-0000-0000-00000000000b', '2222222', 'Misty Waterflower', '2005-02-02');
set role authenticated;
set prueba.uid = '00000000-0000-0000-0000-00000000000a';
-- Ash guarda la suya sin decir user_id: el default es él.
insert into user_play_pokemon (player_id, player_name, birth_date) values ('1111111', 'Ash Ketchum', '2010-05-22');
insert into resultado (caso, ok) select 'cada uno guarda su fila (user_id por defecto = quien escribe)', count(*) = 1 from user_play_pokemon where user_id = '00000000-0000-0000-0000-00000000000a';
insert into resultado (caso, ok) select 'y solo ve la SUYA: la de Misty no sale', count(*) = 1 and bool_and(player_id = '1111111') from user_play_pokemon;
update user_play_pokemon set player_id = '9999999' where user_id = '00000000-0000-0000-0000-00000000000b';
delete from user_play_pokemon where user_id = '00000000-0000-0000-0000-00000000000b';
do $$ begin
  insert into user_play_pokemon (user_id, player_id) values ('00000000-0000-0000-0000-00000000000b', '3333333')
    on conflict (user_id) do update set player_id = excluded.player_id;
  insert into resultado (caso, ok) values ('no puede escribir la fila de otro (upsert)', false);
exception when others then
  insert into resultado (caso, ok) values ('no puede escribir la fila de otro (upsert)', sqlstate = '42501');
end $$;
do $$ begin
  update user_play_pokemon set player_id = 'abc' where user_id = auth.uid();
  insert into resultado (caso, ok) values ('un Player ID con letras no entra', false);
exception when check_violation then
  insert into resultado (caso, ok) values ('un Player ID con letras no entra', true);
end $$;
update user_play_pokemon set player_id = '1234567' where user_id = auth.uid();
insert into resultado (caso, ok) select 'el suyo sí lo cambia', player_id = '1234567' from user_play_pokemon where user_id = auth.uid();
reset role;
insert into resultado (caso, ok) select 'la fila de Misty sigue intacta (ni update ni delete ajenos)', player_id = '2222222' from user_play_pokemon where user_id = '00000000-0000-0000-0000-00000000000b';
set role anon;
set prueba.uid = '';
do $$ begin
  perform 1 from user_play_pokemon;
  insert into resultado (caso, ok) values ('sin cuenta no se lee nada (anon sin permiso)', false);
exception when insufficient_privilege then
  insert into resultado (caso, ok) values ('sin cuenta no se lee nada (anon sin permiso)', true);
end $$;
reset role;
delete from user_profiles where id = '00000000-0000-0000-0000-00000000000a';
insert into resultado (caso, ok) select 'borrar la cuenta se lleva sus datos de Play! Pokémon', count(*) = 0 from user_play_pokemon where user_id = '00000000-0000-0000-0000-00000000000a';
select case when ok then 'ok  ' else 'MAL ' end || caso from resultado order by n;
