\set ON_ERROR_STOP on
create table public.resultado (n serial, caso text, ok boolean);
grant all on public.resultado, public.resultado_n_seq to authenticated;
grant all on public.xp_diario to authenticated;
set role authenticated;
set prueba.uid = '00000000-0000-0000-0000-00000000000c';
update user_profiles set is_banned = false, is_muted = false, is_pro = true, is_admin = true where id = '00000000-0000-0000-0000-00000000000c';
insert into resultado (caso, ok) select 'alguien baneado no se quita el baneo ni el silencio', is_banned and is_muted from user_profiles where username = 'castigado';
insert into resultado (caso, ok) select '  …ni se hace Pro ni admin', not is_pro and not is_admin from user_profiles where username = 'castigado';
update user_profiles set total_xp = 999999, level = 'Maestro' where id = '00000000-0000-0000-0000-00000000000c';
insert into resultado (caso, ok) select 'el XP y el nivel no se escriben a pelo', total_xp = 100 and level = 'Novato' from user_profiles where username = 'castigado';
update user_profiles set avatar_url = 'foo" onmouseover="alert(1)' where id = '00000000-0000-0000-0000-00000000000c';
insert into resultado (caso, ok) select 'una foto con comillas no entra', avatar_url = 'https://ejemplo.supabase.co/foto.png' from user_profiles where username = 'castigado';
update user_profiles set avatar_url = 'javascript:alert(1)', banner_url = 'http://sin-s.com/a.png' where id = '00000000-0000-0000-0000-00000000000c';
insert into resultado (caso, ok) select '  …ni una que no es https', avatar_url = 'https://ejemplo.supabase.co/foto.png' and banner_url is null from user_profiles where username = 'castigado';
update user_profiles set avatar_url = 'https://lh3.googleusercontent.com/a/ACg8=s96-c', display_name = 'Nuevo nombre', current_streak = 5 where id = '00000000-0000-0000-0000-00000000000c';
insert into resultado (caso, ok) select 'lo suyo sí: una foto buena, el nombre y la racha', avatar_url like 'https://lh3%' and display_name = 'Nuevo nombre' and current_streak = 5 from user_profiles where username = 'castigado';
select public.premio_de_la_casa(30);
insert into resultado (caso, ok) select 'las funciones de la casa siguen dando XP', total_xp = 130 from user_profiles where username = 'castigado';
select public.xp_sumar(500); select public.xp_sumar(500); select public.xp_sumar(500); select public.xp_sumar(500);
insert into resultado (caso, ok) select 'xp_sumar suma hasta el tope del día (2.000)', total_xp = 2130 and level = 'Coleccionista' from user_profiles where username = 'castigado';
insert into resultado (caso, ok) select '  …y pasado el tope no suma, pero contesta el total', public.xp_sumar(100) = 2130;
-- Una fila nueva que intenta nacer con mando.
set prueba.uid = '00000000-0000-0000-0000-00000000000d';
insert into user_profiles (id, username, is_admin, is_moderator, total_xp, is_pro, avatar_url) values ('00000000-0000-0000-0000-00000000000d', 'nuevo', true, true, 50000, true, 'x" onerror="y');
insert into resultado (caso, ok) select 'una fila nueva nace sin mando, sin XP y sin foto mala', not is_admin and not is_moderator and total_xp = 0 and not is_pro and avatar_url is null from user_profiles where username = 'nuevo';
-- El admin sí.
set prueba.uid = '00000000-0000-0000-0000-00000000000a';
update user_profiles set is_banned = false, is_muted = false where username = 'castigado';
insert into resultado (caso, ok) select 'el admin sí quita un baneo', not is_banned and not is_muted from user_profiles where username = 'castigado';
reset role;
set prueba.uid = '';
update user_profiles set total_xp = 7 where username = 'nuevo';
insert into resultado (caso, ok) select 'desde el SQL Editor se puede todo', total_xp = 7 from user_profiles where username = 'nuevo';
select case when ok then 'ok  ' else 'MAL ' end || caso from resultado order by n;
