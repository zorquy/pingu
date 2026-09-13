"""Rigor de la tanda 292 (torneos privados). En segundo plano SIEMPRE."""
import subprocess, sys, os

SC = '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad'
REPO = '/home/user/pingu'

MUTACIONES = [
    ('supabase-migration-torneos-privados.sql', 'lo privado deja de ser privado',
     "      not coalesce(is_private, false)", "      true"),

    ('supabase-migration-torneos-privados.sql', 'quien está inscrito ya no puede ver su torneo',
     "      or torneos_estoy_inscrito(id)", ""),

    ('supabase-migration-torneos-privados.sql', 'los borradores dejan de ser de su organizador',
     "    (status <> 'draft' or admin_id = auth.uid() or torneos_soy_admin())", "    true"),

    ('supabase-migration-torneos-privados.sql', 'la comprobación de inscrito deja de ser SECURITY DEFINER',
     "returns boolean language sql security definer stable set search_path = public as $$",
     "returns boolean language sql stable as $$"),

    ('supabase-migration-torneos-privados.sql', 'el código distingue mayúsculas y espacios',
     "    if lower(trim(coalesce(p_codigo, ''))) <> lower(trim(v_t.join_code)) then",
     "    if coalesce(p_codigo, '') <> v_t.join_code then"),

    ('supabase-migration-torneos-privados.sql', 'el mensaje delata que el torneo existe',
     "      raise exception 'Torneo no encontrado o código incorrecto.';\n    end if;\n  end if;",
     "      raise exception 'El código no es correcto.';\n    end if;\n  end if;"),

    ('supabase-migration-torneos-privados.sql', 'se puede entrar con las inscripciones cerradas',
     "  if v_t.status <> 'registration_open' then", "  if false then"),

    ('supabase-migration-torneos-privados.sql', 'vuelve el grant por columnas que rompe la sección',
     "create index if not exists tournaments_privados",
     "revoke select on public.tournaments from anon;\ncreate index if not exists tournaments_privados"),

    ('netlify/functions/telegram-torneos.mjs', 'el canal canta un torneo privado',
     "        `&or=(is_private.is.null,is_private.is.false)` +", ""),

    ('netlify/functions/telegram-torneos.mjs', 'los torneos de antes de la migración se quedan sin anunciar',
     "        `&or=(is_private.is.null,is_private.is.false)` +", "        `&is_private=is.false` +"),

    ('js/torneos/torneos.js', 'la tarjeta no dice que el torneo es privado',
     "      ${t.is_private ? CHAPA_PRIVADO() : ''}\n      ${esOficial(t) ? CHAPA_OFICIAL() : ''}",
     "      ${esOficial(t) ? CHAPA_OFICIAL() : ''}"),

    ('js/torneos/torneos.js', 'todos los torneos salen como privados',
     "      ${t.is_private ? CHAPA_PRIVADO() : ''}\n      ${esOficial(t) ? CHAPA_OFICIAL() : ''}",
     "      ${true ? CHAPA_PRIVADO() : ''}\n      ${esOficial(t) ? CHAPA_OFICIAL() : ''}"),

    ('js/torneos/torneos.js', 'crear no manda si el torneo es privado',
     "      is_private: Boolean($('torneoPrivado')?.checked),", "      is_private: false,"),

    ('js/torneos/torneos.js', 'el campo del código no se esconde',
     "    document.getElementById('torneoCodigoCampo')?.classList.toggle('hidden', !e.target.checked)",
     "    document.getElementById('torneoCodigoCampo')?.classList.remove('hidden')"),

    ('js/torneos/torneo.js', 'se pide el código sin tener cuenta',
     "  if (!form || !session) return", "  if (!form) return"),

    ('js/torneos/torneo.js', 'el código se manda con los espacios de pegarlo',
     "    const codigo = document.getElementById('torneoCodigoValor').value.trim()",
     "    const codigo = document.getElementById('torneoCodigoValor').value"),

    ('js/torneos/torneo.js', 'la RPC va sin el slug del enlace',
     "      p_slug: new URLSearchParams(window.location.search).get('slug'),", "      p_slug: null,"),

    ('js/torneos/torneo.js', 'la ficha no se recarga al entrar',
     "    window.location.reload()", "    return"),
]

originales = {}
sin_detectar = []
try:
    for fichero, nombre, viejo, nuevo in MUTACIONES:
        ruta = os.path.join(REPO, fichero)
        if ruta not in originales:
            originales[ruta] = open(ruta).read()
        base = originales[ruta]
        if base.count(viejo) != 1:
            print(f'⚠️  ANCLA MALA ({base.count(viejo)} veces) en {fichero}: {nombre}', flush=True)
            sin_detectar.append(f'{nombre} (ancla mala)')
            continue
        open(ruta, 'w').write(base.replace(viejo, nuevo))
        subprocess.run([os.path.join(SC, 'sync-forum.sh')], capture_output=True)
        r = subprocess.run(['/opt/node22/bin/node', os.path.join(SC, 'test-tanda-292.mjs')], capture_output=True, text=True, cwd=SC)
        open(ruta, 'w').write(base)
        if r.returncode == 0:
            print(f'❌ SIN DETECTAR: {nombre}', flush=True)
            sin_detectar.append(nombre)
        else:
            print(f'✅ detectada: {nombre}', flush=True)
finally:
    for ruta, contenido in originales.items():
        open(ruta, 'w').write(contenido)
    subprocess.run([os.path.join(SC, 'sync-forum.sh')], capture_output=True)

if sin_detectar:
    print(f'\n❌ {len(sin_detectar)} sin detectar:')
    for n in sin_detectar:
        print('  -', n)
    sys.exit(1)
print(f'\n✅ Las {len(MUTACIONES)} mutaciones detectadas')
