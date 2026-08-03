-- Valoraciones y comentarios sobre las guías (el concepto general: curso +
-- documentación juntos, no una cosa separada por cada uno).
-- Ejecutar en el SQL Editor de Supabase.

create table if not exists guide_reviews (
  id uuid primary key default gen_random_uuid(),
  guide_id uuid not null references guides(id) on delete cascade,
  reviewer_id uuid not null references auth.users(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  body text,
  created_at timestamptz not null default now(),
  unique (guide_id, reviewer_id)
);

create index if not exists guide_reviews_guide_idx on guide_reviews(guide_id);

alter table guide_reviews enable row level security;

drop policy if exists "guide_reviews_select" on guide_reviews;
create policy "guide_reviews_select" on guide_reviews
  for select using (true);

drop policy if exists "guide_reviews_insert" on guide_reviews;
create policy "guide_reviews_insert" on guide_reviews
  for insert with check (auth.uid() = reviewer_id);

drop policy if exists "guide_reviews_update" on guide_reviews;
create policy "guide_reviews_update" on guide_reviews
  for update using (auth.uid() = reviewer_id);

drop policy if exists "guide_reviews_delete" on guide_reviews;
create policy "guide_reviews_delete" on guide_reviews
  for delete using (auth.uid() = reviewer_id or is_admin());
