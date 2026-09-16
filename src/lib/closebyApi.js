const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://nowlwprtcnieihelqjoa.supabase.co'
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_487zTc09VarME-Fgf6EYig__47s_JTp'
const APP_SCHEMA = 'closeby'
const SESSION_KEY = 'closeby-session-v1'

const jsonHeaders = {
  apikey: SUPABASE_PUBLISHABLE_KEY,
  'Content-Type': 'application/json',
}

function parseMaybeJson(text) {
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function errorMessage(payload, fallback = 'Something went wrong') {
  if (!payload) return fallback
  if (typeof payload === 'string') return payload
  return payload.msg || payload.message || payload.error_description || payload.error || fallback
}

async function http(path, { method = 'GET', body, token, schema, prefer, headers = {} } = {}) {
  const requestHeaders = { ...jsonHeaders, ...headers }
  if (token) requestHeaders.Authorization = `Bearer ${token}`
  if (schema) {
    requestHeaders['Accept-Profile'] = schema
    if (method !== 'GET' && method !== 'HEAD') requestHeaders['Content-Profile'] = schema
  }
  if (prefer) requestHeaders.Prefer = prefer

  const response = await fetch(`${SUPABASE_URL}${path}`, {
    method,
    headers: requestHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  const text = await response.text()
  const payload = parseMaybeJson(text)
  if (!response.ok) {
    const error = new Error(errorMessage(payload, `Request failed (${response.status})`))
    error.status = response.status
    error.payload = payload
    throw error
  }
  return payload
}

export function getStoredSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function storeSession(session) {
  if (!session) {
    localStorage.removeItem(SESSION_KEY)
    return null
  }
  const normalized = {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_in: session.expires_in,
    expires_at: session.expires_at || Math.floor(Date.now() / 1000) + Number(session.expires_in || 3600),
    token_type: session.token_type || 'bearer',
    user: session.user || null,
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(normalized))
  return normalized
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY)
}

export async function signUp(email, password) {
  const payload = await http('/auth/v1/signup', {
    method: 'POST',
    body: { email: email.trim(), password },
  })
  if (payload?.access_token) return storeSession(payload)
  return payload
}

export async function signIn(email, password) {
  const payload = await http('/auth/v1/token?grant_type=password', {
    method: 'POST',
    body: { email: email.trim(), password },
  })
  return storeSession(payload)
}

export async function refreshSession(refreshToken) {
  if (!refreshToken) throw new Error('No refresh token available')
  const payload = await http('/auth/v1/token?grant_type=refresh_token', {
    method: 'POST',
    body: { refresh_token: refreshToken },
  })
  return storeSession(payload)
}

export async function getValidSession() {
  let session = getStoredSession()
  if (!session?.access_token) return null
  const now = Math.floor(Date.now() / 1000)
  if (session.expires_at && session.expires_at - now < 60 && session.refresh_token) {
    try {
      session = await refreshSession(session.refresh_token)
    } catch {
      clearSession()
      return null
    }
  }
  return session
}

export async function getCurrentUser(token) {
  return http('/auth/v1/user', { token })
}

export async function signOut(token) {
  try {
    if (token) await http('/auth/v1/logout', { method: 'POST', token })
  } finally {
    clearSession()
  }
}

async function db(path, options = {}) {
  const session = await getValidSession()
  if (!session?.access_token) throw new Error('Please sign in again')
  return http(`/rest/v1${path}`, {
    ...options,
    token: session.access_token,
    schema: APP_SCHEMA,
  })
}

export async function getMyProfile(userId) {
  const rows = await db(`/profiles?user_id=eq.${encodeURIComponent(userId)}&select=*`)
  return Array.isArray(rows) ? rows[0] || null : null
}

export async function saveMyProfile(profile) {
  const rows = await db('/profiles?on_conflict=user_id', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates,return=representation',
    body: profile,
  })
  return Array.isArray(rows) ? rows[0] || null : rows
}

export async function updateMyProfile(userId, patch) {
  const rows = await db(`/profiles?user_id=eq.${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    prefer: 'return=representation',
    body: patch,
  })
  return Array.isArray(rows) ? rows[0] || null : rows
}

async function rpc(name, args = {}) {
  return db(`/rpc/${name}`, { method: 'POST', body: args })
}

export function touchPresence(latitude, longitude) {
  return rpc('touch_presence', { p_lat: latitude, p_lng: longitude })
}

export function setOffline() {
  return rpc('set_offline')
}

export function discoverNearby(radiusKm = 20, limit = 50) {
  return rpc('discover_nearby', { p_radius_km: radiusKm, p_limit: limit })
}

export function sendConnectionRequest(targetUserId) {
  return rpc('send_connection_request', { p_target: targetUserId })
}

export function respondConnectionRequest(connectionId, accept) {
  return rpc('respond_connection_request', { p_connection_id: connectionId, p_accept: Boolean(accept) })
}

export function disconnect(connectionId) {
  return rpc('disconnect', { p_connection_id: connectionId })
}

export function sendMessage(connectionId, body) {
  return rpc('send_message', { p_connection_id: connectionId, p_body: body })
}

export function markConversationRead(connectionId) {
  return rpc('mark_conversation_read', { p_connection_id: connectionId })
}

export function blockUser(targetUserId) {
  return rpc('block_user', { p_target: targetUserId })
}

export function unblockUser(targetUserId) {
  return rpc('unblock_user', { p_target: targetUserId })
}

export async function createReport(reporterId, reportedId, category, details = '') {
  return db('/reports', {
    method: 'POST',
    prefer: 'return=minimal',
    body: {
      reporter_id: reporterId,
      reported_id: reportedId,
      category,
      details: details.trim().slice(0, 1000),
    },
  })
}

export async function getConnections(userId) {
  const rows = await db(`/connections?or=(requester_id.eq.${encodeURIComponent(userId)},addressee_id.eq.${encodeURIComponent(userId)})&status=in.(pending,accepted)&order=updated_at.desc&select=*`)
  return Array.isArray(rows) ? rows : []
}

export async function getProfilesByIds(ids) {
  const unique = [...new Set(ids.filter(Boolean))]
  if (!unique.length) return []
  const list = unique.join(',')
  const rows = await db(`/profiles?user_id=in.(${encodeURIComponent(list)})&select=user_id,username,display_name,bio,avatar_url,interests,intent,visibility`)
  return Array.isArray(rows) ? rows : []
}

export async function getMessages(connectionId, limit = 100) {
  const rows = await db(`/messages?connection_id=eq.${encodeURIComponent(connectionId)}&select=id,connection_id,sender_id,body,sent_at,read_at&order=sent_at.asc&limit=${Math.min(Math.max(limit, 1), 200)}`)
  return Array.isArray(rows) ? rows : []
}

export const closebyConfig = Object.freeze({
  url: SUPABASE_URL,
  schema: APP_SCHEMA,
  usesPublishableKey: SUPABASE_PUBLISHABLE_KEY.startsWith('sb_publishable_'),
})
