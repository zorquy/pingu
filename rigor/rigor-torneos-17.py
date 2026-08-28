#!/usr/bin/env python3
"""Rompe los avisos de la tanda 223; mira si test-torneos-17 se entera."""
import subprocess, sys, os
REPO = '/home/user/pingu'
SC = '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad'
B = 'netlify/functions/torneos-barredor.mjs'

ROTURAS = [
    ('cancelar no avisa a nadie', B,
     """      if (ids.length) {
        await avisarPorTodo(ids, {
          title: `Torneo cancelado — ${t.name}`,""",
     """      if (false) {
        await avisarPorTodo(ids, {
          title: `Torneo cancelado — ${t.name}`,"""),
    ('el aviso de cancelación se repite cada minuto', B,
     """      await rest(`tournaments?id=eq.${t.id}`, clave, {
        method: 'PATCH',
        body: JSON.stringify({ cancel_notified_at: ahora.toISOString() }),
      })
      cancelaciones++""",
     '      cancelaciones++'),
    ('se avisa también a quien se dio de baja', B,
     "`tournament_registrations?tournament_id=eq.${t.id}&status=in.(active,waitlisted)&select=user_id`",
     "`tournament_registrations?tournament_id=eq.${t.id}&select=user_id`"),
    ('el borrado diferido no llega a borrar', B,
     """      if (t.delete_after_notice_at) {
        await rest(`tournaments?id=eq.${t.id}`, clave, { method: 'DELETE' })
        borrados++
      }""", ''),
    ('el correo del borrado apunta a una ficha muerta', B,
     """          link: new URL(
            t.delete_after_notice_at ? '/torneos' : `/torneo?slug=${encodeURIComponent(t.slug)}`,
            sitio
          ).href,""",
     "          link: new URL(`/torneo?slug=${encodeURIComponent(t.slug)}`, sitio).href,"),
    ('el recordatorio no mira la hora: avisa de todo', B,
     "&start_at=gte.${ahora.toISOString()}&start_at=lte.${dentroDeUnaHora}", ''),
    ('el recordatorio se repite cada minuto', B,
     """      await rest(`tournaments?id=eq.${t.id}`, clave, {
        method: 'PATCH',
        body: JSON.stringify({ reminder_notified_at: ahora.toISOString() }),
      })
      recordatorios++""",
     '      recordatorios++'),
    ('el recordatorio también va a la lista de espera', B,
     "`tournament_registrations?tournament_id=eq.${t.id}&status=eq.active&select=user_id`",
     "`tournament_registrations?tournament_id=eq.${t.id}&select=user_id`"),
    ('el correo ignora quién lo ha apagado', B,
     "    const quieren = perfiles.filter((p) => !(p.notification_email_disabled || []).includes(tipo))",
     '    const quieren = perfiles'),
    ('no se encola ningún correo', B,
     """    await rest('email_outbox', clave, {""",
     """    if (false) await rest('email_outbox', clave, {"""),
    ('el correo pierde su tipo (la baja lo apagaría todo)', B,
     '          type: tipo,', "          type: 'otro',"),
    # ── Tanda 224 ──
    ('la campanita no se escribe', B,
     "    await rest('user_notifications', clave, {",
     "    if (false) await rest('user_notifications', clave, {"),
    ('la campanita ignora a quien la apagó', B,
     "    const quieren = perfiles.filter((p) => !(p.notification_prefs_disabled || []).includes(tipo))",
     "    const quieren = perfiles"),
    ('el aviso saldría DOS veces (sin marcar como empujado)', B,
     "          pushed_at: mandar ? ahora.toISOString() : null,",
     "          pushed_at: null,"),
    ('marca como empujado aunque no haya push (se perdería)', B,
     "          pushed_at: mandar ? ahora.toISOString() : null,",
     "          pushed_at: ahora.toISOString(),"),
    ('al terminar no se avisa al resto', B,
     "      const resto = ids.filter((id) => id !== campeon)",
     "      const resto = []"),
    ('el aviso de final se repite cada minuto', B,
     "        body: JSON.stringify({ finish_notified_at: ahora.toISOString() }),\n      })\n      finales++",
     "        body: JSON.stringify({}),\n      })\n      finales++"),
    ('al campeón se le trata como a uno más', B,
     "      const campeon = t.champion_id && ids.includes(t.champion_id) ? t.champion_id : null",
     "      const campeon = null"),
    ('se avisa también a quien se quedó en la cola', B,
     "`tournament_registrations?tournament_id=eq.${t.id}&status=in.(active,dropped)&select=user_id`",
     "`tournament_registrations?tournament_id=eq.${t.id}&select=user_id`"),
]


def correr():
    r = subprocess.run(['/opt/node22/bin/node', f'{SC}/test-torneos-17.mjs'],
                       capture_output=True, text=True, cwd=REPO)
    salida = r.stdout + r.stderr
    fallos = [l.strip() for l in salida.splitlines() if l.startswith('  FALLA')]
    if r.returncode != 0 and not fallos:
        fallos = ['la prueba se corta: ' + (salida.strip().splitlines() or ['sin salida'])[-1][:90]]
    return (1 if fallos else 0), fallos


print('== Estado de partida ==', flush=True)
code, fallos = correr()
print(f'   {"VERDE" if code == 0 else "ROJO"} ({len(fallos)})', flush=True)
if code != 0:
    for f in fallos[:6]:
        print('   ', f, flush=True)
    sys.exit(1)

malas = []
for nombre, fich, viejo, nuevo in ROTURAS:
    ruta = os.path.join(REPO, fich)
    original = open(ruta).read()
    if viejo not in original:
        print(f'✘ NO SE PUEDE ROMPER: {nombre}', flush=True)
        malas.append(nombre)
        continue
    open(ruta, 'w').write(original.replace(viejo, nuevo, 1))
    try:
        code, fallos = correr()
    finally:
        open(ruta, 'w').write(original)
    if code == 0:
        print(f'✘ LA PRUEBA NO SE ENTERA: {nombre}', flush=True)
        malas.append(nombre)
    else:
        print(f'✔ pillado: {nombre} — {fallos[0][:72]}', flush=True)

print()
if malas:
    print(f'✘ {len(malas)} roturas sin detectar:')
    for m in malas:
        print('   -', m)
    sys.exit(1)
print(f'✔ las {len(ROTURAS)} roturas se detectan')
