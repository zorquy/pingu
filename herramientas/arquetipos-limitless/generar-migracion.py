#!/usr/bin/env python3
"""De `compacto.txt` (lo que deja derivar-en-navegador.js en window.__compacto)
a la migración de los arquetipos de Limitless (tanda 1460).

    python3 generar-migracion.py compacto.txt NNNN > supabase-migration-NNNN-arquetipos-limitless.sql

Lo que el SQL Editor de Supabase lee mal (CLAUDE.md, 1281): «into» y «$»
dentro de una cadena van escapados en el JSON, y los comentarios sin comillas.
"""
import json, re, sys, unicodedata

def plano(t):
    t = ''.join(c for c in unicodedata.normalize('NFD', t) if unicodedata.category(c) != 'Mn')
    return re.sub(r'\s+', ' ', t.lower()).strip()

def filas_de(texto):
    filas = []
    for linea in texto.strip().split('\n'):
        id_, nombre, iconos, req = linea.split('|')
        ics = []
        for x in filter(None, iconos.split(';')):
            s, num, nom = x.split(',', 2)
            ics.append({'set': s, 'numero': num, 'nombre': nom} if s and num else {'nombre': nom})
        requiere = []
        for x in req.split('~'):
            m = None
            if '*' in x:
                x, m = x.rsplit('*', 1)
            noms = []
            for y in x.split('^'):
                y = y.strip().rstrip('.').strip()
                if len(y) >= 3 and plano(y) not in [plano(z) for z in noms]:
                    noms.append(y)
            r = {'nombres': noms}
            if m and int(m) > 1:
                r['minimo'] = int(m)
            requiere.append(r)
        filas.append({'id': id_, 'nombre': nombre, 'iconos': ics, 'requiere': requiere})
    return filas

def sql_de(filas, tanda):
    txt = json.dumps(filas, ensure_ascii=False, separators=(',', ':'))
    txt = re.sub(r'(?i)into', lambda m: '\\u0069' + m.group(0)[1:], txt)
    txt = txt.replace('$', '\\u0024')
    lit = txt.replace("'", "''")
    n = len(filas)
    return f"""-- LOS ARQUETIPOS DE LIMITLESS EN EL CATALOGO (tanda {tanda})
-- {n} arquetipos con el id y el nombre de Limitless, sus iconos y lo que tiene
-- que llevar un mazo para serlo. Ver normas/jugar.md y SCHEMA 1460.
-- Re-ejecutable: lo que ya este en la tabla no se toca.

begin;

insert into public.tcg_archetypes (id, nombre, iconos, requiere, activo)
select x.id, x.nombre, x.iconos, x.requiere, true
from jsonb_to_recordset('{lit}'::jsonb) as x(id text, nombre text, iconos jsonb, requiere jsonb)
on conflict (id) do nothing;

commit;

select count(*) as arquetipos_catalogados from public.tcg_archetypes where activo;
"""

if __name__ == '__main__':
    texto = open(sys.argv[1], encoding='utf8').read()
    print(sql_de(filas_de(texto), sys.argv[2] if len(sys.argv) > 2 else 'NNNN'), end='')
