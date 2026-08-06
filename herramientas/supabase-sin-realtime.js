// Sustituto de @supabase/realtime-js.
//
// PokeDoc no usa suscripciones en tiempo real en ninguna parte (ni
// .channel() ni .subscribe()): todo son consultas normales. El cliente
// de Supabase, aun así, arrastra el paquete entero de realtime en el
// bundle — y con él un cliente de WebSocket completo.
//
// Esto ocupa su sitio: si algún día alguien escribe .channel(), la
// llamada avisa en vez de fallar de una forma rara.
class RealtimeClient {
  constructor() {}
  channel() {
    throw new Error('PokeDoc no incluye Realtime de Supabase: se quitó del bundle porque no se usa. Ver js/vendor/supabase-js.js.')
  }
  removeChannel() {}
  removeAllChannels() {}
  getChannels() { return [] }
  connect() {}
  disconnect() {}
  setAuth() {}
}
class RealtimeChannel {}
class RealtimePresence {}
const REALTIME_LISTEN_TYPES = { BROADCAST: 'broadcast', PRESENCE: 'presence', POSTGRES_CHANGES: 'postgres_changes', SYSTEM: 'system' }
const REALTIME_SUBSCRIBE_STATES = { SUBSCRIBED: 'SUBSCRIBED', TIMED_OUT: 'TIMED_OUT', CLOSED: 'CLOSED', CHANNEL_ERROR: 'CHANNEL_ERROR' }
const REALTIME_POSTGRES_CHANGES_LISTEN_EVENT = { ALL: '*', INSERT: 'INSERT', UPDATE: 'UPDATE', DELETE: 'DELETE' }
const REALTIME_PRESENCE_LISTEN_EVENTS = { SYNC: 'sync', JOIN: 'join', LEAVE: 'leave' }
const REALTIME_CHANNEL_STATES = { closed: 'closed', errored: 'errored', joined: 'joined', joining: 'joining', leaving: 'leaving' }
export {
  RealtimeClient, RealtimeChannel, RealtimePresence,
  REALTIME_LISTEN_TYPES, REALTIME_SUBSCRIBE_STATES,
  REALTIME_POSTGRES_CHANGES_LISTEN_EVENT, REALTIME_PRESENCE_LISTEN_EVENTS,
  REALTIME_CHANNEL_STATES,
}
export default RealtimeClient
