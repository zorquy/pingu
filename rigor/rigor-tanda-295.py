"""Rigor de la tanda 295 (rol de organizador de torneos). En segundo plano SIEMPRE."""
import subprocess, sys, os

SC = '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad'
REPO = '/home/user/pingu'

MUTACIONES = [
    ('js/torneos/comun.js', 'el rol no sirve de nada en pantalla',
     "  return Boolean(perfil?.is_admin || perfil?.is_tournament_admin)", "  return Boolean(perfil?.is_admin)"),

    ('js/torneos/comun.js', 'cualquiera manda en los torneos',
     "  return Boolean(perfil?.is_admin || perfil?.is_tournament_admin)", "  return true"),

    ('supabase-migration-torneos-organizadores.sql', 'la base no conoce el rol',
     "      and (p.is_admin or coalesce(p.is_tournament_admin, false))", "      and p.is_admin"),

    ('supabase-migration-torneos-organizadores.sql', 'el organizador puede marcarse torneos como OFICIALES',
     "  select exists (select 1 from user_profiles p where p.id = auth.uid() and p.is_admin)\n$$;",
     "  select exists (select 1 from user_profiles p where p.id = auth.uid() and (p.is_admin or p.is_tournament_admin))\n$$;"),

    ('supabase-migration-torneos-organizadores.sql', 'el disparador de OFICIAL vuelve a la función ampliada',
     "  if auth.uid() is not null and not public.torneos_soy_admin_del_sitio() then",
     "  if auth.uid() is not null and not public.torneos_soy_admin() then"),

    ('supabase-migration-torneos-organizadores.sql', 'cualquiera puede hacerse admin del sitio',
     "    new.is_admin := old.is_admin;", "    -- sin proteger is_admin"),

    ('supabase-migration-torneos-organizadores.sql', 'cualquiera puede darse el rol de torneos',
     "    new.is_tournament_admin := coalesce(old.is_tournament_admin, false);", "    -- sin proteger el rol"),

    ('supabase-migration-torneos-organizadores.sql', 'se pierde lo que el disparador ya protegía',
     "    new.is_moderator := old.is_moderator;", "    -- sin proteger la moderación"),

    ('admin/js/admin.js', 'el organizador entra al panel de administración',
     "  if (!profile?.is_admin) {", "  if (!profile?.is_admin && !profile?.is_tournament_admin) {"),

    ('admin/js/admin.js', 'el interruptor da admin en vez del rol de torneos',
     "        .update({ is_tournament_admin: dar })", "        .update({ is_admin: dar })"),

    ('admin/js/admin.js', 'el panel no dice hasta dónde llega el rol',
     "                 ? ` <strong>Torneos</strong> da el mando de la sección «Jugar» —crear y llevar cualquier torneo, resolver",
     "                 ? ` <strong>Torneos</strong> —crear y llevar cualquier torneo, resolver"),

    # La escalera de columnas: si el rol viaja pegado al color, faltando
    # la migración de torneos el panel pierde los colores y acusa a la
    # migración equivocada.
    ('admin/js/admin.js', 'el rol viaja pegado al color en la escalera',
     "    { campos: `${FORO}, forum_title_color`, foro: true, color: true, torneos: false },",
     "    { campos: `${FORO}, forum_title_color, is_tournament_admin`, foro: true, color: true, torneos: false },"),

    ('admin/js/admin.js', 'el interruptor se pinta aunque falte la columna',
     "                conTorneos\n                  ? `<button data-toggle-torneos=",
     "                true\n                  ? `<button data-toggle-torneos="),

    ('js/torneos/torneos.js', 'un organizador puede marcar el torneo como oficial',
     "  document.getElementById('torneoOficialCampo')?.classList.toggle('hidden', !perfil?.is_admin)",
     "  document.getElementById('torneoOficialCampo')?.classList.toggle('hidden', !puedeOrganizar(perfil))"),
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
        r = subprocess.run(['/opt/node22/bin/node', os.path.join(SC, 'test-tanda-295.mjs')], capture_output=True, text=True, cwd=SC)
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
