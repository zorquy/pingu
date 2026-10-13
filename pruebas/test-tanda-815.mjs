// Tanda 815 (VE2) — la caché de ir y volver con el tiempo real.
// Con un websocket abierto el navegador no guarda la página, y «Atrás» la
// recargaba entera. Al esconderse se cierra; al volver de la caché se abren
// las mismas escuchas y cada una pide lo suyo una vez.
//
// js/vivo.js se prueba EL DE VERDAD, en una copia con un Supabase y un
// cliente de tiempo real de mentira (en las pruebas de navegador va el doble).
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const RAIZ = '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const dir = mkdtempSync(join(tmpdir(), 'vivo-815-'))
mkdirSync(join(dir, 'vendor'))
copyFileSync(`${RAIZ}/js/vivo.js`, join(dir, 'vivo.js'))
copyFileSync(`${RAIZ}/js/sondeo.js`, join(dir, 'sondeo.js'))
writeFileSync(join(dir, 'supabase.js'), `export const supabase = { supabaseKey: 'k', auth: { getSession: async () => ({ data: {} }), onAuthStateChange: () => {} } }`)
writeFileSync(join(dir, 'vendor', 'supabase-realtime.js'), `
export const registro = { canales: [], conectado: true, desconexiones: 0, conexiones: 0, quitados: [] }
export class RealtimeClient {
  isConnected() { return registro.conectado }
  connect() { registro.conectado = true; registro.conexiones++ }
  disconnect() { registro.conectado = false; registro.desconexiones++ }
  async removeChannel(c) { registro.quitados.push(c.nombre); c.vivo = false; return 'ok' }
  channel(nombre) {
    const c = { nombre, vivo: true, manejadores: 0, on() { c.manejadores++; return c }, subscribe(cb) { cb('SUBSCRIBED'); return c }, unsubscribe() { c.vivo = false } }
    registro.canales.push(c)
    return c
  }
}`)
// El navegador, de mentira: lo justo para los dos eventos.
const oyentes = {}
globalThis.window = { addEventListener: (t, f) => { (oyentes[t] ||= []).push(f) } }
const vivo = await import(join(dir, 'vivo.js'))
const { registro } = await import(join(dir, 'vendor', 'supabase-realtime.js'))
const espera = () => new Promise((r) => setTimeout(r, 20))

let cambios = 0
const estados = []
const parar = vivo.escuchar({ nombre: 'chat-1', tablas: [{ tabla: 'a' }, { tabla: 'b' }], alCambiar: () => cambios++, alEstado: (v) => estados.push(v) })
await espera()
check('la escucha se abre', registro.canales.length === 1 && registro.canales[0].vivo && estados.at(-1) === true)
check('  …y la página se apunta a pagehide y pageshow', oyentes.pagehide?.length === 1 && oyentes.pageshow?.length === 1)

for (const f of oyentes.pagehide) f({ persisted: true })
await espera()
check('al esconderse: canal soltado, websocket cerrado y la página avisada', !registro.canales[0].vivo && registro.desconexiones === 1 && estados.at(-1) === false, JSON.stringify(registro))

for (const f of oyentes.pageshow) f({ persisted: true })
await espera()
const nuevo = registro.canales[1]
check('al volver de la caché: se reabre con un canal NUEVO (no el viejo con sus manejadores)', registro.canales.length === 2 && nuevo.vivo && nuevo.nombre !== registro.canales[0].nombre && nuevo.manejadores === 2, JSON.stringify(registro.canales.map((c) => [c.nombre, c.manejadores])))
check('  …reconecta el websocket', registro.conexiones === 1 && registro.conectado)
check('  …y pide lo suyo una vez (lo de mientras tanto no llegó por el canal)', cambios === 1, cambios)

for (const f of oyentes.pageshow) f({ persisted: false })
await espera()
check('un pageshow normal (la primera carga) no duplica nada', registro.canales.length === 2 && cambios === 1)

parar()
await espera()
for (const f of oyentes.pagehide) f({ persisted: true })
for (const f of oyentes.pageshow) f({ persisted: true })
await espera()
check('una escucha parada no vuelve a abrirse al volver', registro.canales.length === 2 && cambios === 1 && !nuevo.vivo)

console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
