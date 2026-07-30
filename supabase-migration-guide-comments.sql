-- Comentarios sobre las guías (como el muro de un perfil, pero debajo de
-- una guía). Separado de guide_reviews: guide_reviews es la puntuación de
-- 1 a 5 estrellas, esto es la conversación libre estilo "muro".
-- Ejecutar en el SQL Editor de Supabase.

create table if not exists guide_comments (
  id uuid primary key default gen_random_uuid(),
  guide_id uuid not null references guides(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists guide_comments_guide_idx on guide_comments(guide_id);

alter table guide_comments enable row level security;

create policy "guide_comments_select" on guide_comments
  for select using (true);

create policy "guide_comments_insert" on guide_comments
  for insert with check (auth.uid() = author_id);

create policy "guide_comments_delete" on guide_comments
  for delete using (auth.uid() = author_id or is_admin());
