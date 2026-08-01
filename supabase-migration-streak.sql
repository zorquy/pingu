-- Racha diaria: cuántos días seguidos ha entrado el usuario, con un
-- pequeño bonus de XP la primera vez que entra cada día.

alter table user_profiles add column if not exists current_streak integer not null default 0;
alter table user_profiles add column if not exists last_active_date date;
