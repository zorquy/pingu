import { supabase } from './supabase.js'
import { COLUMNAS_RANGO } from './rangos.js'
import { cuentaNoLeidos, ordenarConversaciones } from './mensajes-puro.js'

// Capa de datos compartida para mensajería privada (1 a 1), usada tanto por
// la campanita de mensajes de la navbar (js/nav-messages.js) como por la
// bandeja completa (mensajes.html).

export async function findOrCreateConversation(myId, otherId) {
  if (myId === otherId) throw new Error('No puedes escribirte mensajes a ti mismo.')

  const { data: mine } = await supabase.from('conversation_participants').select('conversation_id').eq('user_id', myId)
  const myConvIds = (mine || []).map((r) => r.conversation_id)
  if (myConvIds.length > 0) {
    const { data: shared } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', otherId)
      .in('conversation_id', myConvIds)
    if (shared && shared.length > 0) return shared[0].conversation_id
  }

  const conversationId = crypto.randomUUID()
  await supabase.from('conversations').insert({ id: conversationId })
  await supabase.from('conversation_participants').insert({ conversation_id: conversationId, user_id: myId })
  await supabase.from('conversation_participants').insert({ conversation_id: conversationId, user_id: otherId })
  return conversationId
}

// Lista de conversaciones con la otra persona, el último mensaje y si hay
// algo sin leer — usada para el desplegable de la navbar y para la bandeja.
export async function listConversations(myId) {
  // Con `*` (1141): `fijada_at` y `archivada_at` vienen si la migración está, y
  // si no, la consulta no falla por pedir una columna que no existe (624).
  const { data: myRows } = await supabase.from('conversation_participants').select('*').eq('user_id', myId)
  const rows = myRows || []
  if (rows.length === 0) return []
  const convIds = rows.map((r) => r.conversation_id)
  const lastReadByConv = Object.fromEntries(rows.map((r) => [r.conversation_id, r.last_read_at]))
  const filaPorConv = Object.fromEntries(rows.map((r) => [r.conversation_id, r]))

  const [{ data: otherParticipants }, { data: messages }] = await Promise.all([
    supabase.from('conversation_participants').select('conversation_id, user_id').in('conversation_id', convIds).neq('user_id', myId),
    supabase.from('private_messages').select('*').in('conversation_id', convIds).order('created_at', { ascending: false }),
  ])

  const otherIdByConv = Object.fromEntries((otherParticipants || []).map((p) => [p.conversation_id, p.user_id]))
  const otherIds = [...new Set(Object.values(otherIdByConv))]
  const { data: profiles } =
    otherIds.length > 0
      // sin rango: en la lista de conversaciones el nombre va dentro del
      // enlace A LA CONVERSACIÓN, no al perfil. Colorearlo diría «pulsa
      // aquí para ver a esta persona» y lleva a otro sitio (tanda 386).
      ? await supabase.from('user_profiles').select('id, username, display_name, avatar_url').in('id', otherIds)
      : { data: [] }
  const profileById = Object.fromEntries((profiles || []).map((p) => [p.id, p]))

  const lastMessageByConv = {}
  for (const m of messages || []) {
    if (!lastMessageByConv[m.conversation_id]) lastMessageByConv[m.conversation_id] = m
  }

  // Cuántos sin leer en cada una (891): la bandeja enseña el número, no
  // solo el nombre en negrita. Lo eliminado no cuenta.
  const porConv = {}
  for (const m of messages || []) (porConv[m.conversation_id] ||= []).push(m)

  return ordenarConversaciones(
    convIds.map((id) => {
      const lastMessage = lastMessageByConv[id] || null
      const lastReadAt = lastReadByConv[id]
      const noLeidos = cuentaNoLeidos(porConv[id], myId, lastReadAt)
      const unread = noLeidos > 0
      const fila = filaPorConv[id] || {}
      return { conversationId: id, otherProfile: profileById[otherIdByConv[id]] || null, lastMessage, unread, noLeidos, fijadaAt: fila.fijada_at || null, archivadaAt: fila.archivada_at || null, conFijar: 'fijada_at' in fila }
    })
  )
}

export async function loadThreadMessages(conversationId) {
  const { data } = await supabase.from('private_messages').select('*').eq('conversation_id', conversationId).order('created_at', { ascending: true })
  return data || []
}

// Comprobación en el cliente de "¿de verdad formo parte de esta
// conversación?", aparte de lo que ya hace RLS en el servidor. No es
// redundante del todo: si algo dejara pasar la petición sin estar en la
// conversación, esto evita mostrar un hilo ajeno solo por adivinar su id.
export async function isParticipant(conversationId, myId) {
  const { data } = await supabase
    .from('conversation_participants')
    .select('user_id')
    .eq('conversation_id', conversationId)
    .eq('user_id', myId)
    .maybeSingle()
  return !!data
}

export async function markConversationRead(conversationId, myId) {
  await supabase.from('conversation_participants').update({ last_read_at: new Date().toISOString() }).eq('conversation_id', conversationId).eq('user_id', myId)
}

// Con fotos (891): `adjuntos` es la lista que devuelve `subirAdjuntos`.
// Solo se manda la columna cuando hay algo: así, sin la migración 891,
// un mensaje de texto sigue entrando como siempre y solo falla el que
// lleva fotos — con su error, que quien llama enseña.
// `replyTo` (1141): el id del mensaje al que se responde; solo se manda si lo
// hay, así que sin la migración un mensaje normal sigue entrando.
export async function sendMessage(conversationId, senderId, body, adjuntos = [], replyTo = null) {
  const fila = { conversation_id: conversationId, sender_id: senderId, body: body || '' }
  if (adjuntos?.length) fila.adjuntos = adjuntos
  if (replyTo) fila.reply_to_id = replyTo
  const { error } = await supabase.from('private_messages').insert(fila)
  if (error) throw error
}

// Borrar deja «Mensaje eliminado» (891): se marca `deleted_at` y se vacía
// el texto y las fotos, en vez de quitar la fila y dejar un hueco. Si la
// migración 891 no está (la columna no existe), se borra como antes.
export async function deleteMessage(messageId) {
  const { error } = await supabase
    .from('private_messages')
    .update({ deleted_at: new Date().toISOString(), body: '', adjuntos: [] })
    .eq('id', messageId)
  if (!error) return
  const { error: e2 } = await supabase.from('private_messages').delete().eq('id', messageId)
  if (e2) throw e2
}

// Hasta cuándo ha leído la OTRA persona (891): para el «Visto» bajo tu
// último mensaje. La política de participantes deja ver las dos filas.
export async function otherLastReadAt(conversationId, myId) {
  const { data } = await supabase
    .from('conversation_participants')
    .select('last_read_at')
    .eq('conversation_id', conversationId)
    .neq('user_id', myId)
    .maybeSingle()
  return data?.last_read_at || null
}

export async function getOtherParticipant(conversationId, myId) {
  const { data } = await supabase.from('conversation_participants').select('user_id').eq('conversation_id', conversationId).neq('user_id', myId).maybeSingle()
  if (!data) return null
  const { data: profile } = await supabase
    .from('user_profiles')
    .select(`id, username, display_name, avatar_url, ${COLUMNAS_RANGO}`)
    .eq('id', data.user_id)
    .single()
  return profile
}

// ── Lo de la 1141: tu fila de la conversación, fijar, archivar y reacciones ──

// Tu fila, entera (`*`): dice si la migración está (`fijada_at` en la fila).
export async function miFilaDeConversacion(conversationId, myId) {
  const { data } = await supabase.from('conversation_participants').select('*').eq('conversation_id', conversationId).eq('user_id', myId).maybeSingle()
  return data || null
}

// Fijar o archivar: en TU fila (la política solo deja esa). Archivar quita lo
// fijado y fijar saca de archivadas: son lo contrario.
export async function ponerEnConversacion(conversationId, myId, que, si) {
  const ahora = si ? new Date().toISOString() : null
  const cambios = que === 'fijar' ? { fijada_at: ahora, ...(si ? { archivada_at: null } : {}) } : { archivada_at: ahora, ...(si ? { fijada_at: null } : {}) }
  const { error } = await supabase.from('conversation_participants').update(cambios).eq('conversation_id', conversationId).eq('user_id', myId)
  if (error) throw error
  return cambios
}

// Las reacciones de una conversación, o null si no se puede saber (sin la
// migración la tabla no existe: entonces no se ofrecen).
export async function reaccionesDe(conversationId) {
  const { data, error } = await supabase.from('private_message_reactions').select('message_id, user_id, kind').eq('conversation_id', conversationId)
  return error ? null : data || []
}

// Poner, cambiar o quitar la tuya (una por mensaje): `kind` null la quita.
export async function reaccionar({ messageId, conversationId, myId, kind, actual }) {
  if (!kind) {
    const { error } = await supabase.from('private_message_reactions').delete().eq('message_id', messageId).eq('user_id', myId)
    if (error) throw error
    return
  }
  const q = actual
    ? supabase.from('private_message_reactions').update({ kind }).eq('message_id', messageId).eq('user_id', myId)
    : supabase.from('private_message_reactions').insert({ message_id: messageId, conversation_id: conversationId, user_id: myId, kind })
  const { error } = await q
  if (error) throw error
}
