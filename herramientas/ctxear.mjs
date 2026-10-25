// Reescribe un bloque sacado de mi-coleccion.js: los nombres de la lista que
// quedan LIBRES (con la misma cuenta de ámbitos que libres.mjs) pasan a
// `ctx.nombre`. Uso: node ctxear.mjs fichero.js a,b,c > salida.js
import * as acorn from '/opt/node22/lib/node_modules/eslint/node_modules/acorn/dist/acorn.mjs'
import { readFileSync } from 'node:fs'
const GLOBALES = new Set('CSS window document localStorage sessionStorage navigator location history console Math JSON Date Promise Set Map Array Object Number String Boolean Error TypeError RegExp parseInt parseFloat isNaN isFinite encodeURIComponent decodeURIComponent encodeURI setTimeout clearTimeout setInterval clearInterval requestAnimationFrame cancelAnimationFrame fetch URL URLSearchParams Intl structuredClone crypto performance Image Blob File FileReader FormData CustomEvent Event KeyboardEvent MouseEvent Element HTMLElement Node NodeList DOMParser IntersectionObserver MutationObserver ResizeObserver AbortController matchMedia getComputedStyle alert confirm prompt globalThis undefined NaN Infinity arguments Symbol WeakMap WeakSet Proxy Reflect queueMicrotask atob btoa TextEncoder TextDecoder Audio ImageBitmap createImageBitmap OffscreenCanvas HTMLCanvasElement CanvasRenderingContext2D DataTransfer ClipboardItem scrollTo scrollY scrollX innerWidth innerHeight devicePixelRatio open close print Notification ServiceWorkerRegistration caches indexedDB BroadcastChannel Worker SharedWorker visualViewport screen EventTarget AbortSignal Response Request Headers WebSocket XMLHttpRequest HTMLInputElement HTMLSelectElement HTMLTextAreaElement HTMLImageElement HTMLAnchorElement HTMLButtonElement HTMLDialogElement Touch TouchEvent PointerEvent DragEvent FocusEvent InputEvent ErrorEvent PromiseRejectionEvent self top parent frames eval isSecureContext'.split(' '))
const [f, lista] = process.argv.slice(2)
const PEDIDOS = new Set(lista.split(','))
{
  const src = readFileSync(f, 'utf8')
  const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module', locations: true })
  const decl = new Set()
  const addPat = (p) => { if (!p) return; if (p.type === 'Identifier') decl.add(p.name); else if (p.type === 'ObjectPattern') p.properties.forEach((q) => addPat(q.type === 'RestElement' ? q.argument : q.value)); else if (p.type === 'ArrayPattern') p.elements.forEach(addPat); else if (p.type === 'AssignmentPattern') addPat(p.left); else if (p.type === 'RestElement') addPat(p.argument) }
  const libres = new Map(); const trozos = []
  function camina(n, padre, clave, ambito) {
    if (!n || typeof n.type !== 'string') return
    let amb = ambito
    if (n.type === 'ImportDeclaration') { n.specifiers.forEach((s) => decl.add(s.local.name)); return }
    if (['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(n.type)) { amb = new Set(ambito); if (n.id) (padre?.type === 'Program' ? decl : amb).add(n.id.name); if (n.body?.type === 'BlockStatement') for (const st of n.body.body) if (st.type === 'FunctionDeclaration' && st.id) amb.add(st.id.name); n.params.forEach((p) => { const antes = new Set(decl); addPat(p); for (const x of decl) if (!antes.has(x)) { amb.add(x); decl.delete(x) } }) }
    if (n.type === 'CatchClause' && n.param) { amb = new Set(ambito); const antes = new Set(decl); addPat(n.param); for (const x of decl) if (!antes.has(x)) { amb.add(x); decl.delete(x) } }
    if (n.type === 'VariableDeclaration') n.declarations.forEach((d) => { const antes = new Set(decl); addPat(d.id); if (padre?.type !== 'Program') for (const x of decl) if (!antes.has(x)) { amb.add(x); decl.delete(x) } })
    if (n.type === 'ClassDeclaration' && n.id) decl.add(n.id.name)
    if (n.type === 'Identifier') {
      const esProp = padre && padre.type === 'MemberExpression' && clave === 'property' && !padre.computed
      const esClave = padre && padre.type === 'Property' && clave === 'key' && !padre.computed && !padre.shorthand
      const esMeta = padre && (padre.type === 'MetaProperty' || padre.type === 'LabeledStatement' || padre.type === 'BreakStatement' || padre.type === 'ContinueStatement')
      if (!esProp && !esClave && !esMeta && !decl.has(n.name) && !amb.has(n.name) && !GLOBALES.has(n.name)) { libres.set(n.name, (libres.get(n.name) || []).concat(n.loc.start.line)); if (PEDIDOS.has(n.name)) trozos.push({ ini: n.start, fin: n.end, txt: (padre?.type === 'Property' && padre.shorthand) ? `${n.name}: ctx.${n.name}` : `ctx.${n.name}` }) }
    }
    for (const k of Object.keys(n)) { if (['loc', 'type', 'start', 'end'].includes(k)) continue; const v = n[k]; if (Array.isArray(v)) v.forEach((x) => x && typeof x.type === 'string' && camina(x, n, k, amb)); else if (v && typeof v.type === 'string') camina(v, n, k, amb) }
  }
  // dos pasadas: primero las declaraciones top-level (hoisting), luego las referencias
  for (const st of ast.body) { if (st.type === 'FunctionDeclaration') decl.add(st.id.name); if (st.type === 'VariableDeclaration') st.declarations.forEach((d) => addPat(d.id)); if (st.type === 'ImportDeclaration') st.specifiers.forEach((s) => decl.add(s.local.name)); if (st.type === 'ExportNamedDeclaration' && st.declaration) { if (st.declaration.type === 'FunctionDeclaration') decl.add(st.declaration.id.name); if (st.declaration.type === 'VariableDeclaration') st.declaration.declarations.forEach((d) => addPat(d.id)) } }
  camina(ast, null, null, new Set())
  let out = '', pos = 0
  for (const t of trozos.sort((a, b) => a.ini - b.ini)) { if (t.ini < pos) continue; out += src.slice(pos, t.ini) + t.txt; pos = t.fin }
  process.stdout.write(out + src.slice(pos))
}
