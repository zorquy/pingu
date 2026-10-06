"""Rigor de la tanda 631 — las migraciones se ejecutan sentencia a
sentencia (el SQL Editor de Supabase no conserva una tabla temporal de una
sentencia a la siguiente)."""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

MIG = 'supabase-migration-nombres-energias.sql'

MUTACIONES = [
    (MIG, 'vuelve una tabla temporal entre sentencias', "-- ── 2. Los Amuletos Hada (Sol y Luna), con el tipo como sustantivo ──\n", "-- ── 2. Los Amuletos Hada (Sol y Luna), con el tipo como sustantivo ──\ncreate temp table tipos_631 (en text);\n"),
    (MIG, 'la Telepática se queda sin nombre inglés', "update public.tcg_cards set name_en = 'Telepathic Psychic Energy'", "update public.tcg_cards set name_en = null"),
    (MIG, 'el tipo se queda en inglés', "('Psychic', 'Psíquica'), ('Fighting', 'Lucha'), ('Darkness', 'Oscura'), ('Metal', 'Metálica'),\n               ('Fairy', 'Hada'), ('Dragon', 'Dragón'), ('Colorless', 'Incolora')) as t(en, energia)\n where c.name_es", "('Psychic', 'Psychic'), ('Fighting', 'Lucha'), ('Darkness', 'Oscura'), ('Metal', 'Metálica'),\n               ('Fairy', 'Hada'), ('Dragon', 'Dragón'), ('Colorless', 'Incolora')) as t(en, energia)\n where c.name_es"),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-631.mjs')
