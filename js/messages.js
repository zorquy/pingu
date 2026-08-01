import { supabase } from './supabase.js'

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
  const { data: myRows } = await supabase.from('conversation_participants').select('conversation_id, last_read_at').eq('user_id', myId)
  const rows = myRows || []
  if (rows.length === 0) return []
  const convIds = rows.map((r) => r.conversation_id)
  const lastReadByConv = Object.fromEntries(rows.map((r) => [r.conversation_id, r.last_read_at]))

  const [{ data: otherParticipants }, { data: messages }] = await Promise.all([
    supabase.from('conversation_participants').select('conversation_id, user_id').in('conversation_id', convIds).neq('user_id', myId),
    supabase.from('private_messages').select('*').in('conversation_id', convIds).order('created_at', { ascending: false }),
  ])

  const otherIdByConv = Object.fromEntries((otherParticipants || []).map((p) => [p.conversation_id, p.user_id]))
  const otherIds = [...new Set(Object.values(otherIdByConv))]
  const { data: profiles } =
    otherIds.length > 0
      ? await supabase.from('user_profiles').select('id, username, display_name, avatar_url, avatar_color').in('id', otherIds)
      : { data: [] }
  const profileById = Object.fromEntries((profiles || []).map((p) => [p.id, p]))

  const lastMessageByConv = {}
  for (const m of messages || []) {
    if (!lastMessageByConv[m.conversation_id]) lastMessageByConv[m.conversation_id] = m
  }

  return convIds
    .map((id) => {
      const lastMessage = lastMessageByConv[id] || null
      const lastReadAt = lastReadByConv[id]
      const unread = !!lastMessage && lastMessage.sender_id !== myId && (!lastReadAt || new Date(lastMessage.created_at) > new Date(lastReadAt))
      return { conversationId: id, otherProfile: profileById[otherIdByConv[id]] || null, lastMessage, unread }
    })
    .sort((a, b) => new Date(b.lastMessage?.created_at || 0) - new Date(a.lastMessage?.created_at || 0))
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

export async function sendMessage(conversationId, senderId, body) {
  await supabase.from('private_messages').insert({ conversation_id: conversationId, sender_id: senderId, body })
}

export async function deleteMessage(messageId) {
  await supabase.from('private_messages').delete().eq('id', messageId)
}

export async function getOtherParticipant(conversationId, myId) {
  const { data } = await supabase.from('conversation_participants').select('user_id').eq('conversation_id', conversationId).neq('user_id', myId).maybeSingle()
  if (!data) return null
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('id, username, display_name, avatar_url, avatar_color')
    .eq('id', data.user_id)
    .single()
  return profile
}
