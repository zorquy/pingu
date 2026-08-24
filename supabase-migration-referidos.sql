-- ═══════════════════════════════════════════════════════════════════
-- INVITA A UN AMIGO (referidos)
-- Ejecutar A MANO en Supabase → SQL Editor. Se puede repetir sin miedo.
--
-- Qué monta:
--   1. user_profiles.referred_by: quién invitó a esta cuenta. Lo escribe
--      el propio invitado al terminar su onboarding (una sola vez), a
--      partir del enlace /r/<usuario> con el que llegó.
--   2. Tres trofeos: dos para quien invita (1 y 5 invitados) y uno de
--      bienvenida para quien llega invitado. El XP lo reparte el propio
--      sistema de trofeos (xp_reward), cada cual en SU sesión — sin
--      escrituras cruzadas entre cuentas.
-- ═══════════════════════════════════════════════════════════════════

alter table public.user_profiles
  add column if not exists referred_by uuid references auth.users (id) on delete set null;

-- El contador de "cuántos he traído" filtra por esta columna.
create index if not exists user_profiles_referred_by on public.user_profiles (referred_by)
  where referred_by is not null;

-- Los trofeos. `id` es la clave elegida a mano, como los demás; el
-- `where not exists` hace la migración repetible sin duplicar.
insert into public.achievement_definitions (id, title, description, emoji, condition, rarity, xp_reward, is_active)
select 'embajador', 'Embajador', 'Trae a tu primer amigo a PokeDoc con tu enlace de invitación.',
       '🤝', '{"type": "referrals_count", "count": 1}'::jsonb, 'silver', 50, true
where not exists (select 1 from public.achievement_definitions where id = 'embajador');

insert into public.achievement_definitions (id, title, description, emoji, condition, rarity, xp_reward, is_active)
select 'embajador-oro', 'Embajador de oro', 'Cinco personas se han unido a PokeDoc gracias a ti.',
       '🏅', '{"type": "referrals_count", "count": 5}'::jsonb, 'gold', 150, true
where not exists (select 1 from public.achievement_definitions where id = 'embajador-oro');

insert into public.achievement_definitions (id, title, description, emoji, condition, rarity, xp_reward, is_active)
select 'invitado-de-honor', 'Invitado de honor', 'Llegaste a PokeDoc invitado por alguien de la comunidad.',
       '💌', '{"type": "was_referred", "count": 1}'::jsonb, 'bronze', 25, true
where not exists (select 1 from public.achievement_definitions where id = 'invitado-de-honor');

notify pgrst, 'reload schema';
