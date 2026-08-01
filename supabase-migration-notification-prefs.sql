-- Preferencias de notificaciones: qué tipos de notificación NO quiere
-- recibir cada usuario (todo activado por defecto, array vacío).
alter table user_profiles add column if not exists notification_prefs_disabled text[] not null default '{}';
