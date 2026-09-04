#!/usr/bin/env python3
# Rigor de la tanda 256. SIEMPRE en segundo plano.
import subprocess, sys, os
REPO = '/home/user/pingu'
SC = '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad'
MOD = 'js/foro-moderar.js'
FORO = 'js/foro.js'
TEMA = 'js/tema.js'
CSS = 'css/foro.css'

MUTACIONES = [
    # ── Quién ve las herramientas ──
    ('las casillas salen para todo el mundo', FORO,
     "      ${soyStaff ? casillaHtml(t) : ''}",
     "      ${casillaHtml(t)}"),

    ('el menú de moderar sale para todo el mundo', FORO,
     "      ${soyStaff ? botonMenuHtml(t) : ''}",
     "      ${botonMenuHtml(t)}"),

    ('se engancha la moderación aunque no seas del equipo', FORO,
     "  if (soyStaff) engancharModeracion({ foro, temas: lista, soyAdmin })",
     "  engancharModeracion({ foro, temas: lista, soyAdmin })"),

    # ── La barra ──
    ('la barra se queda puesta sin nada marcado', MOD,
     "  if (!n) {\n    b.hidden = true",
     "  if (!n) {\n    b.hidden = false"),

    ('la barra no se esconde nunca (el [hidden] no pinta nada)', CSS,
     ".foro-mod-barra[hidden] {\n  display: none;\n}",
     ".foro-mod-barra[hidden] {\n  display: flex;\n}"),

    ('la cuenta dice singular y plural al revés', MOD,
     "${n} ${n === 1 ? 'tema seleccionado' : 'temas seleccionados'}",
     "${n} ${n === 1 ? 'temas seleccionados' : 'tema seleccionado'}"),

    ('la fila marcada no se distingue', MOD,
     "      c.closest('.foro-tema-fila')?.classList.toggle('foro-tema-marcado', c.checked)\n",
     ""),

    ('«quitar selección» deja las casillas marcadas', MOD,
     "      c.checked = false\n",
     ""),

    # ── Mover ──
    ('mover manda el tema al foro donde ya estaba', MOD,
     "    .update({ board_id: destino })",
     "    .update({ board_id: ctx.foro.id })"),

    ('mover en lote solo mueve el primero', MOD,
     "    .update({ board_id: destino })\n    .in('id', ids)",
     "    .update({ board_id: destino })\n    .in('id', ids.slice(0, 1))"),

    ('se deja mover un tema al foro donde ya está', MOD,
     "  if (destino === ctx.foro?.id) return showToast('Ese tema ya está en este foro.')\n",
     ""),

    ('un moderador ve los foros escondidos', MOD,
     "  const visibles = (foros || []).filter((f) => ctx.soyAdmin || !f.is_hidden)",
     "  const visibles = (foros || []).filter(() => true)"),

    ('un foro escondido no se marca como tal', MOD,
     "    name: f.is_hidden ? `${f.name} (oculto)` : f.name,",
     "    name: f.name,"),

    # ── Etiqueta, fijar, cerrar ──
    ('la etiqueta elegida se pierde por el camino', MOD,
     "    await aplicarCambio(ids, { prefix: e.target.etiqueta.value || null })",
     "    await aplicarCambio(ids, { prefix: null })"),

    ('fijar no alterna: siempre deja el tema arriba', MOD,
     "  if (accion === 'fijar') return aplicarCambio([tema.id], { is_pinned: !tema.is_pinned })",
     "  if (accion === 'fijar') return aplicarCambio([tema.id], { is_pinned: true })"),

    ('el menú no dice el estado del tema', MOD,
     "${tema.is_pinned ? 'Quitar de arriba' : 'Fijar arriba'}",
     "Fijar arriba"),

    # ── Borrar ──
    ('borrar va al primer clic, sin preguntar', MOD,
     "    if (!boton.dataset.armado) {\n      boton.dataset.armado = '1'\n      const respuestas = Math.max(0, (tema.post_count || 1) - 1)\n      boton.textContent = respuestas ? `¿Seguro? Se pierden ${respuestas} respuestas` : '¿Seguro? Borrar'\n      return\n    }\n",
     ""),

    ('la confirmación no dice cuántas respuestas se pierden', MOD,
     "      boton.textContent = respuestas ? `¿Seguro? Se pierden ${respuestas} respuestas` : '¿Seguro? Borrar'",
     "      boton.textContent = '¿Seguro? Borrar'"),

    # ── El silencio de la política ──
    ('no se comprueba que la base haya tocado algo', MOD,
     "  const hechas = data?.length || 0\n  if (hechas === 0) {",
     "  const hechas = esperadas\n  if (hechas === 0) {"),

    ('se canta «movido» aunque no se haya movido nada', MOD,
     "  if (!seHizo(data, error, ids.length, 'No se ha podido mover')) return\n",
     ""),

    ('se canta «borrado» aunque no se haya borrado nada', MOD,
     "  if (!seHizo(data, error, ids.length, 'No se ha podido borrar')) return\n",
     ""),

    # ── Editar el primer mensaje desde la lista ──
    ('el enlace de editar el mensaje no abre el editor', TEMA,
     "  primero.click()\n",
     ""),

    ('el editor se abre solo, sin que nadie lo pida', TEMA,
     "  if (params.get('editar') !== 'primero') return\n",
     ""),

    ('se abre el editor en cualquier página del tema', TEMA,
     "  if (Number(params.get('p') || 1) !== 1) return\n",
     ""),
]


def correr():
    subprocess.run(['bash', f'{SC}/sync-forum.sh'], check=True, capture_output=True)
    r = subprocess.run(['/opt/node22/bin/node', f'{SC}/test-tanda-256.mjs'],
                       capture_output=True, text=True, timeout=900)
    return r.returncode, r.stdout


sin = []
for i, (nombre, fichero, viejo, nuevo) in enumerate(MUTACIONES, 1):
    ruta = os.path.join(REPO, fichero)
    original = open(ruta).read()
    if original.count(viejo) != 1:
        print(f'{i:2}. ⚠️  ANCLA MALA ({original.count(viejo)}): {nombre}', flush=True)
        sin.append(nombre + ' (ancla mala)')
        continue
    try:
        open(ruta, 'w').write(original.replace(viejo, nuevo))
        codigo, salida = correr()
        if codigo == 0:
            print(f'{i:2}. ❌ NO DETECTADA: {nombre}', flush=True)
            sin.append(nombre)
        else:
            print(f'{i:2}. ✅ pillada ({salida.count("FALLA")} fallos): {nombre}', flush=True)
    finally:
        open(ruta, 'w').write(original)

subprocess.run(['bash', f'{SC}/sync-forum.sh'], check=True, capture_output=True)
print()
if sin:
    print(f'❌ {len(sin)} sin detectar:')
    for n in sin: print('   ·', n)
    sys.exit(1)
print(f'✅ Las {len(MUTACIONES)} mutaciones detectadas.')
