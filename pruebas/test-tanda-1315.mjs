// Tanda 1315 — R2: las precargas de módulos, generadas. El repo lleva lo que
// sale del generador; cada página precarga lo que importa de forma fija y
// nunca lo que entra por import().
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
const REPO = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }
const G = await import(`${REPO}/generar-precargas.mjs`)
const distintas = G.paginas().filter((p) => { const h = readFileSync(p, 'utf8'); return G.conPrecargas(h, p) !== h }).map((p) => p.replace(REPO + '/', ''))
check('el repo lleva lo que sale de generar-precargas.mjs', !distintas.length, distintas.join(', '))
const bloque = (f) => (readFileSync(`${REPO}/${f}`, 'utf8').match(/<!-- precargas:[\s\S]*?<!-- \/precargas -->/) || [''])[0]
check('la portada precarga home.js y lo suyo', /href="\/js\/home\.js"/.test(bloque('index.html')))
check('la ficha de un torneo precarga hasta el sexto nivel (pintar.js, mesas.js)', /\/js\/torneos\/pintar\.js/.test(bloque('torneo.html')) && /\/js\/torneos\/mesas\.js/.test(bloque('torneo.html')))
check('lo que entra por import() no se precarga (Seguridad en Ajustes, mis-datos)', !/ajustes-seguridad\.js|mis-datos\.js/.test(bloque('ajustes.html')))
check('ningún módulo precargado dos veces en una página', G.paginas().every((p) => { const l = [...readFileSync(p, 'utf8').matchAll(/<link rel="modulepreload" href="([^"]+)"/g)].map((m) => m[1]); return l.length === new Set(l).size }))
const todos = G.paginas().flatMap((p) => [...readFileSync(p, 'utf8').matchAll(/<link rel="modulepreload" href="([^"]+)"/g)].map((m) => m[1]))
check('todo lo precargado existe', todos.every((r) => { try { readFileSync(resolve(REPO + r)); return true } catch { return false } }))
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
