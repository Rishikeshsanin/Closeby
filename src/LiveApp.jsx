import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import { Circle, MapContainer, Marker, TileLayer, useMap } from 'react-leaflet'
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  Check,
  ChevronRight,
  Compass,
  Eye,
  EyeOff,
  LocateFixed,
  LockKeyhole,
  LogOut,
  Map as MapIcon,
  MessageCircle,
  MoreHorizontal,
  Phone,
  RefreshCw,
  Search,
  Send,
  Settings,
  Shield,
  ShieldCheck,
  Sparkles,
  UserPlus,
  Users,
  Video,
  X,
} from 'lucide-react'
import {
  blockUser,
  clearSession,
  createReport,
  discoverNearby,
  getConnections,
  getCurrentUser,
  getMessages,
  getMyProfile,
  getProfilesByIds,
  getStoredSession,
  getValidSession,
  markConversationRead,
  respondConnectionRequest,
  saveMyProfile,
  sendConnectionRequest,
  sendMessage,
  setOffline,
  signIn,
  signOut,
  signUp,
  touchPresence,
  updateMyProfile,
} from './lib/closebyApi'
import './live.css'

const DEFAULT_CENTER = [12.9716, 77.5946]
const PRESENCE_INTERVAL = 60_000
const DISCOVERY_INTERVAL = 20_000
const CHAT_INTERVAL = 4_000
const CONNECTION_INTERVAL = 12_000

function cx(...values) {
  return values.filter(Boolean).join(' ')
}

function initials(name = '?') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('') || '?'
}

function prettyTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date)
}

function Recenter({ center }) {
  const map = useMap()
  useEffect(() => {
    map.flyTo(center, 14, { duration: 0.65 })
  }, [center, map])
  return null
}

function personIcon(person, selected) {
  const label = initials(person.display_name)
  return L.divIcon({
    className: 'closeby-div-icon',
    html: `<div class="live-person-pin ${selected ? 'is-selected' : ''}"><span>${label}</span><i></i></div>`,
    iconSize: [52, 52],
    iconAnchor: [26, 26],
  })
}

function selfIcon() {
  return L.divIcon({
    className: 'closeby-div-icon',
    html: '<div class="live-self-pin"><span>YOU</span></div>',
    iconSize: [52, 52],
    iconAnchor: [26, 26],
  })
}

function Logo({ compact = false }) {
  return (
    <div className={cx('live-brand', compact && 'compact')}>
      <div className="live-brand-mark"><span /><span /><span /></div>
      {!compact && <strong>Closeby</strong>}
    </div>
  )
}

function LoadingScreen() {
  return (
    <div className="live-gate live-loading">
      <Logo />
      <div className="pulse-loader"><span /><span /><span /></div>
      <p>Opening your circle…</p>
    </div>
  )
}

function AuthScreen({ onReady }) {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    try {
      if (password.length < 8) throw new Error('Use at least 8 characters for your password.')
      const result = mode === 'signup' ? await signUp(email, password) : await signIn(email, password)
      if (result?.access_token || getStoredSession()?.access_token) {
        await onReady()
      } else if (mode === 'signup') {
        setNotice('Account created. Check your email to confirm it, then sign in here.')
        setMode('signin')
      }
    } catch (err) {
      setError(err.message || 'Could not continue')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="live-gate auth-gate">
      <div className="auth-ambient one" />
      <div className="auth-ambient two" />
      <section className="auth-card">
        <Logo />
        <div className="auth-copy">
          <span className="live-kicker"><Sparkles size={14} /> YOUR WORLD, CLOSER</span>
          <h1>{mode === 'signin' ? 'Good to see you.' : 'Find your people.'}</h1>
          <p>{mode === 'signin' ? 'Sign in to see friends and discover people who are around right now.' : 'Create a Closeby account to connect with people around you — without sharing your exact location.'}</p>
        </div>
        <form onSubmit={submit} className="auth-form">
          <label>Email<input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" /></label>
          <label>Password<input type="password" required minLength={8} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" /></label>
          {error && <div className="form-alert error"><AlertTriangle size={16} />{error}</div>}
          {notice && <div className="form-alert success"><Check size={16} />{notice}</div>}
          <button className="live-primary" disabled={busy}>{busy ? 'One moment…' : mode === 'signin' ? 'Sign in' : 'Create account'}<ChevronRight size={18} /></button>
        </form>
        <button className="auth-switch" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); setNotice('') }}>
          {mode === 'signin' ? <>New here? <strong>Create an account</strong></> : <>Already on Closeby? <strong>Sign in</strong></>}
        </button>
        <div className="auth-trust"><ShieldCheck size={16} /><span>Closeby uses approximate discovery. Other users never receive your exact GPS location.</span></div>
      </section>
    </div>
  )
}

function Onboarding({ user, onSaved }) {
  const suggested = (user?.email || 'closeby').split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 20)
  const [form, setForm] = useState({
    username: suggested.length >= 3 ? suggested : `user_${suggested}`,
    display_name: '',
    bio: '',
    interests: '',
    intent: 'friends',
    visibility: 'hidden',
    age_confirmed_18: false,
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function field(key, value) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function submit(event) {
    event.preventDefault()
    setError('')
    if (!form.age_confirmed_18) {
      setError('Closeby discovery is currently limited to users who confirm they are 18 or older.')
      return
    }
    setBusy(true)
    try {
      const profile = await saveMyProfile({
        user_id: user.id,
        username: form.username.trim(),
        display_name: form.display_name.trim(),
        bio: form.bio.trim(),
        interests: form.interests.split(',').map(item => item.trim()).filter(Boolean).slice(0, 12),
        intent: form.intent,
        visibility: form.visibility,
        age_confirmed_18: true,
      })
      onSaved(profile)
    } catch (err) {
      setError(err.message || 'Could not create your profile')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="live-gate onboarding-gate">
      <section className="onboarding-card">
        <Logo />
        <div className="onboarding-head"><span>01 / YOUR PROFILE</span><h1>How should people know you?</h1><p>You control what other people can see. Keep it simple — you can change this later.</p></div>
        <form onSubmit={submit} className="onboarding-form">
          <div className="field-grid two">
            <label>Display name<input required maxLength={60} value={form.display_name} onChange={e => field('display_name', e.target.value)} placeholder="Rishi" /></label>
            <label>Username<div className="username-input"><span>@</span><input required minLength={3} maxLength={24} pattern="[A-Za-z0-9_]{3,24}" value={form.username} onChange={e => field('username', e.target.value)} /></div></label>
          </div>
          <label>Short bio<textarea maxLength={240} rows={3} value={form.bio} onChange={e => field('bio', e.target.value)} placeholder="Developer, music, spontaneous plans…" /></label>
          <label>Interests <small>comma separated, up to 12</small><input value={form.interests} onChange={e => field('interests', e.target.value)} placeholder="AI, Music, Gaming, Coffee" /></label>
          <div className="field-grid two">
            <label>Here for<select value={form.intent} onChange={e => field('intent', e.target.value)}><option value="friends">Friends</option><option value="hangout">Hang out</option><option value="networking">Networking</option><option value="study">Study</option><option value="explore">Explore</option></select></label>
            <label>Start visibility<select value={form.visibility} onChange={e => field('visibility', e.target.value)}><option value="hidden">Hidden — safest default</option><option value="everyone">Visible nearby</option><option value="connections">Connections only</option></select></label>
          </div>
          <label className="age-check"><input type="checkbox" checked={form.age_confirmed_18} onChange={e => field('age_confirmed_18', e.target.checked)} /><span><strong>I confirm I’m 18 or older.</strong><small>Closeby’s people-discovery experience is 18+ in this version.</small></span></label>
          {error && <div className="form-alert error"><AlertTriangle size={16} />{error}</div>}
          <button className="live-primary" disabled={busy}>{busy ? 'Creating profile…' : 'Enter Closeby'}<ChevronRight size={18} /></button>
        </form>
        <div className="auth-trust"><LockKeyhole size={16} /><span>Your raw GPS coordinates are quantized before they are stored for discovery.</span></div>
      </section>
    </div>
  )
}

function Sidebar({ screen, setScreen, profile, connectionsCount, pendingCount, onPrivacy, onLogout }) {
  return (
    <aside className="live-sidebar">
      <Logo />
      <nav>
        <button className={cx(screen === 'discover' && 'active')} onClick={() => setScreen('discover')}><MapIcon size={20} /><span>Discover</span></button>
        <button className={cx(screen === 'connections' && 'active')} onClick={() => setScreen('connections')}><Users size={20} /><span>Connections</span>{connectionsCount > 0 && <em>{connectionsCount}</em>}</button>
        <button className={cx(screen === 'messages' && 'active')} onClick={() => setScreen('messages')}><MessageCircle size={20} /><span>Messages</span></button>
        <button className={cx(screen === 'activity' && 'active')} onClick={() => setScreen('activity')}><Bell size={20} /><span>Requests</span>{pendingCount > 0 && <em>{pendingCount}</em>}</button>
      </nav>
      <div className="sidebar-foot">
        <button onClick={onPrivacy}><Shield size={20} /><span>Privacy</span></button>
        <button disabled title="Coming soon"><Settings size={20} /><span>Settings</span></button>
        <div className="sidebar-profile">
          <div className="live-avatar mine">{initials(profile.display_name)}</div>
          <div><strong>{profile.display_name}</strong><span>@{profile.username}</span></div>
          <button onClick={onLogout} title="Sign out"><LogOut size={17} /></button>
        </div>
      </div>
    </aside>
  )
}

function MobileNav({ screen, setScreen, pendingCount }) {
  const items = [
    ['discover', MapIcon, 'Map'],
    ['connections', Users, 'People'],
    ['messages', MessageCircle, 'Chats'],
    ['activity', Bell, 'Requests'],
  ]
  return <nav className="mobile-nav">{items.map(([key, Icon, label]) => <button key={key} className={cx(screen === key && 'active')} onClick={() => setScreen(key)}><Icon size={20}/>{key === 'activity' && pendingCount > 0 && <i /> }<span>{label}</span></button>)}</nav>
}

function ProfileSheet({ person, status, onClose, onConnect, onMessage, onBlock, onReport, busy }) {
  if (!person) return null
  return (
    <aside className="live-sheet">
      <button className="sheet-close" onClick={onClose}><X size={19} /></button>
      <div className="sheet-profile-avatar">{initials(person.display_name)}<i /></div>
      <h2>{person.display_name}</h2>
      <span className="sheet-handle-name">@{person.username}</span>
      <div className="sheet-status"><span className="live-dot" /> Active recently · {person.distance_band || 'nearby'}</div>
      <p className="sheet-bio">{person.bio || 'No bio yet.'}</p>
      <div className="live-chips">{(person.interests || []).map(item => <span key={item}>{item}</span>)}</div>
      <div className="sheet-actions">
        {status === 'accepted' ? <button className="live-primary" onClick={onMessage}><MessageCircle size={18}/>Message</button> : status === 'pending' ? <button className="live-primary muted" disabled><Check size={18}/>Request pending</button> : <button className="live-primary" disabled={busy} onClick={onConnect}><UserPlus size={18}/>Connect</button>}
        <button className="live-icon-button" disabled title="Voice calls are coming next"><Phone size={18}/></button>
        <button className="live-icon-button" disabled title="Video calls are coming next"><Video size={18}/></button>
      </div>
      <div className="sheet-safety"><ShieldCheck size={16}/><span>Closeby is showing an approximate area, never this person’s exact GPS point.</span></div>
      <div className="sheet-secondary"><button onClick={onReport}>Report</button><button className="danger" onClick={onBlock}>Block</button></div>
    </aside>
  )
}

function PrivacyPanel({ profile, onClose, onChange }) {
  const [busy, setBusy] = useState(false)
  async function choose(value) {
    setBusy(true)
    try { await onChange(value) } finally { setBusy(false) }
  }
  const options = [
    ['everyone', Eye, 'Visible nearby', 'Appear to eligible people near your approximate location.'],
    ['connections', Users, 'Connections only', 'Stay off public discovery; remain available to your connections.'],
    ['hidden', EyeOff, 'Invisible', 'Do not appear on nearby discovery.'],
  ]
  return (
    <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}>
      <section className="privacy-panel">
        <header><div><span>DISCOVERABILITY</span><h2>Who can find you?</h2></div><button onClick={onClose}><X size={18}/></button></header>
        <p>Your precise device location is never exposed to another Closeby user.</p>
        <div className="privacy-options">{options.map(([value, Icon, title, copy]) => <button key={value} disabled={busy} className={cx(profile.visibility === value && 'selected')} onClick={() => choose(value)}><Icon size={20}/><div><strong>{title}</strong><span>{copy}</span></div>{profile.visibility === value && <Check size={18}/>}</button>)}</div>
      </section>
    </div>
  )
}

function ReportDialog({ person, onClose, onSubmit }) {
  const [category, setCategory] = useState('spam')
  const [details, setDetails] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(event) {
    event.preventDefault(); setBusy(true)
    try { await onSubmit(category, details); onClose() } finally { setBusy(false) }
  }
  return (
    <div className="modal-backdrop">
      <form className="report-dialog" onSubmit={submit}>
        <header><div><span>SAFETY</span><h2>Report {person.display_name}</h2></div><button type="button" onClick={onClose}><X size={18}/></button></header>
        <label>Reason<select value={category} onChange={e => setCategory(e.target.value)}><option value="spam">Spam</option><option value="harassment">Harassment</option><option value="impersonation">Impersonation</option><option value="unsafe_behavior">Unsafe behavior</option><option value="underage">Possible underage user</option><option value="other">Other</option></select></label>
        <label>Details <small>optional</small><textarea rows={4} maxLength={1000} value={details} onChange={e => setDetails(e.target.value)} placeholder="Tell us what happened…" /></label>
        <button className="live-primary" disabled={busy}>{busy ? 'Sending…' : 'Submit report'}</button>
      </form>
    </div>
  )
}

function ChatPanel({ chat, userId, onClose, onSent }) {
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const bottomRef = useRef(null)

  const load = useCallback(async () => {
    try {
      const rows = await getMessages(chat.connection.id)
      setMessages(rows)
      await markConversationRead(chat.connection.id).catch(() => {})
    } catch (err) {
      setError(err.message || 'Could not load messages')
    }
  }, [chat.connection.id])

  useEffect(() => {
    load()
    const timer = setInterval(load, CHAT_INTERVAL)
    return () => clearInterval(timer)
  }, [load])

  useEffect(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), [messages.length])

  async function submit(event) {
    event.preventDefault()
    const body = text.trim()
    if (!body || busy) return
    setBusy(true); setError('')
    try {
      await sendMessage(chat.connection.id, body)
      setText('')
      await load()
      onSent?.()
    } catch (err) {
      setError(err.message || 'Could not send')
    } finally { setBusy(false) }
  }

  return (
    <aside className="live-chat-panel">
      <header><button onClick={onClose}><ArrowLeft size={20}/></button><div className="live-avatar">{initials(chat.person.display_name)}<i /></div><div><strong>{chat.person.display_name}</strong><span>@{chat.person.username}</span></div><button disabled title="Voice calls coming next"><Phone size={18}/></button><button disabled title="Video calls coming next"><Video size={18}/></button></header>
      <div className="chat-messages">
        <div className="chat-intro"><ShieldCheck size={19}/><strong>You’re connected</strong><span>Only people in this accepted connection can read this conversation.</span></div>
        {messages.map(message => <div className={cx('chat-bubble-wrap', message.sender_id === userId && 'mine')} key={message.id}><div className="chat-bubble">{message.body}<small>{prettyTime(message.sent_at)}</small></div></div>)}
        <div ref={bottomRef}/>
      </div>
      {error && <div className="chat-error">{error}</div>}
      <form className="chat-compose" onSubmit={submit}><input maxLength={2000} value={text} onChange={e => setText(e.target.value)} placeholder={`Message ${chat.person.display_name}`} /><button disabled={busy || !text.trim()}><Send size={18}/></button></form>
    </aside>
  )
}

function LiveApp() {
  const [booting, setBooting] = useState(true)
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [backendError, setBackendError] = useState('')
  const [screen, setScreen] = useState('discover')
  const [center, setCenter] = useState(DEFAULT_CENTER)
  const [rawLocation, setRawLocation] = useState(null)
  const [locationState, setLocationState] = useState('idle')
  const [nearby, setNearby] = useState([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [connections, setConnections] = useState([])
  const [peerProfiles, setPeerProfiles] = useState({})
  const [privacyOpen, setPrivacyOpen] = useState(false)
  const [reporting, setReporting] = useState(null)
  const [chat, setChat] = useState(null)
  const [actionBusy, setActionBusy] = useState(false)
  const [toast, setToast] = useState('')

  const flash = useCallback(message => {
    setToast(message)
    window.setTimeout(() => setToast(''), 2800)
  }, [])

  const bootstrap = useCallback(async () => {
    setBooting(true); setBackendError('')
    try {
      const valid = await getValidSession()
      if (!valid) { setSession(null); setUser(null); setProfile(null); return }
      const current = await getCurrentUser(valid.access_token)
      setSession(valid); setUser(current)
      try {
        const mine = await getMyProfile(current.id)
        setProfile(mine)
      } catch (err) {
        if (err.status === 406 || err.status === 404) setProfile(null)
        else throw err
      }
    } catch (err) {
      if (String(err.message || '').toLowerCase().includes('schema') || err.status === 406) setBackendError(err.message)
      else { clearSession(); setSession(null); setUser(null); setProfile(null) }
    } finally { setBooting(false) }
  }, [])

  useEffect(() => { bootstrap() }, [bootstrap])

  const getLocation = useCallback(() => {
    if (!navigator.geolocation) { setLocationState('error'); return }
    setLocationState('loading')
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      const point = [coords.latitude, coords.longitude]
      setRawLocation(point); setCenter(point); setLocationState('ready')
    }, () => setLocationState('error'), { enableHighAccuracy: false, timeout: 9000, maximumAge: 120000 })
  }, [])

  useEffect(() => { if (profile) getLocation() }, [profile, getLocation])

  const refreshConnections = useCallback(async () => {
    if (!user?.id || !profile) return
    try {
      const rows = await getConnections(user.id)
      setConnections(rows)
      const ids = rows.map(row => row.requester_id === user.id ? row.addressee_id : row.requester_id)
      const profiles = await getProfilesByIds(ids)
      setPeerProfiles(Object.fromEntries(profiles.map(item => [item.user_id, item])))
    } catch (err) {
      console.warn('Closeby connection refresh:', err)
    }
  }, [user?.id, profile])

  useEffect(() => {
    if (!profile) return
    refreshConnections()
    const timer = setInterval(refreshConnections, CONNECTION_INTERVAL)
    return () => clearInterval(timer)
  }, [profile, refreshConnections])

  const refreshDiscovery = useCallback(async () => {
    if (!profile || profile.visibility !== 'everyone' || !rawLocation) { setNearby([]); return }
    try {
      const rows = await discoverNearby(20, 60)
      setNearby(Array.isArray(rows) ? rows : [])
    } catch (err) {
      console.warn('Closeby discovery refresh:', err)
    }
  }, [profile, rawLocation])

  useEffect(() => {
    if (!profile || !rawLocation) return
    let cancelled = false
    async function pulse() {
      try {
        if (profile.visibility === 'everyone') {
          await touchPresence(rawLocation[0], rawLocation[1])
          if (!cancelled) await refreshDiscovery()
        } else {
          await setOffline().catch(() => {})
          if (!cancelled) setNearby([])
        }
      } catch (err) { console.warn('Closeby presence:', err) }
    }
    pulse()
    const presenceTimer = setInterval(pulse, PRESENCE_INTERVAL)
    const discoveryTimer = setInterval(refreshDiscovery, DISCOVERY_INTERVAL)
    return () => { cancelled = true; clearInterval(presenceTimer); clearInterval(discoveryTimer) }
  }, [profile, rawLocation, refreshDiscovery])

  useEffect(() => {
    const hide = () => { if (profile?.visibility === 'everyone') setOffline().catch(() => {}) }
    window.addEventListener('pagehide', hide)
    return () => window.removeEventListener('pagehide', hide)
  }, [profile?.visibility])

  const accepted = connections.filter(row => row.status === 'accepted')
  const incoming = connections.filter(row => row.status === 'pending' && row.addressee_id === user?.id)
  const outgoing = connections.filter(row => row.status === 'pending' && row.requester_id === user?.id)

  const connectionFor = useCallback(personId => connections.find(row => (row.requester_id === user?.id && row.addressee_id === personId) || (row.addressee_id === user?.id && row.requester_id === personId)), [connections, user?.id])

  const filteredNearby = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return nearby
    return nearby.filter(person => person.display_name.toLowerCase().includes(needle) || person.username.toLowerCase().includes(needle) || (person.interests || []).some(item => item.toLowerCase().includes(needle)))
  }, [nearby, search])

  async function changeVisibility(value) {
    const updated = await updateMyProfile(user.id, { visibility: value })
    setProfile(updated)
    if (value !== 'everyone') { await setOffline().catch(() => {}); setNearby([]) }
    else if (rawLocation) { await touchPresence(rawLocation[0], rawLocation[1]); await refreshDiscovery() }
    flash(value === 'everyone' ? 'You’re visible nearby.' : value === 'hidden' ? 'You’re invisible now.' : 'Discovery limited to connections.')
  }

  async function connect(person) {
    setActionBusy(true)
    try { await sendConnectionRequest(person.user_id); await refreshConnections(); flash('Connection request sent.') } catch (err) { flash(err.message || 'Could not send request') } finally { setActionBusy(false) }
  }

  async function respond(row, accept) {
    setActionBusy(true)
    try { await respondConnectionRequest(row.id, accept); await refreshConnections(); flash(accept ? 'You’re connected.' : 'Request declined.') } catch (err) { flash(err.message || 'Could not respond') } finally { setActionBusy(false) }
  }

  async function doBlock(person) {
    if (!window.confirm(`Block ${person.display_name}? You will disappear from each other’s discovery and any connection will end.`)) return
    setActionBusy(true)
    try { await blockUser(person.user_id); setSelected(null); await refreshConnections(); await refreshDiscovery(); flash(`${person.display_name} blocked.`) } catch (err) { flash(err.message || 'Could not block user') } finally { setActionBusy(false) }
  }

  async function submitReport(category, details) {
    await createReport(user.id, reporting.user_id, category, details)
    flash('Report received. Thank you.')
  }

  function chatForConnection(row) {
    const peerId = row.requester_id === user.id ? row.addressee_id : row.requester_id
    const person = peerProfiles[peerId]
    if (person) setChat({ connection: row, person })
  }

  async function logout() {
    await setOffline().catch(() => {})
    await signOut(session?.access_token).catch(() => clearSession())
    setSession(null); setUser(null); setProfile(null); setNearby([]); setConnections([]); setPeerProfiles({})
  }

  if (booting) return <LoadingScreen />
  if (!session || !user) return <AuthScreen onReady={bootstrap} />
  if (backendError) return (
    <div className="live-gate backend-gate"><section className="backend-card"><Logo/><Shield size={36}/><h1>Live backend is staged.</h1><p>The Closeby database is ready, but the shared Project Hub Data API has not been told to expose the isolated <code>closeby</code> schema yet.</p><small>{backendError}</small><button className="live-primary" onClick={bootstrap}><RefreshCw size={17}/>Retry</button></section></div>
  )
  if (!profile) return <Onboarding user={user} onSaved={setProfile} />

  return (
    <div className="live-shell">
      <Sidebar screen={screen} setScreen={setScreen} profile={profile} connectionsCount={accepted.length} pendingCount={incoming.length} onPrivacy={() => setPrivacyOpen(true)} onLogout={logout} />
      <main className="live-main">
        {screen === 'discover' && <>
          <header className="live-topbar">
            <div><span className="live-kicker"><span className="live-dot"/> LIVE AROUND YOU</span><h1>See who’s close.</h1></div>
            <div className="live-top-actions"><div className="live-search"><Search size={17}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search people or interests" />{search && <button onClick={() => setSearch('')}><X size={15}/></button>}</div><button className={cx('visibility-toggle', profile.visibility === 'everyone' && 'visible')} onClick={() => changeVisibility(profile.visibility === 'everyone' ? 'hidden' : 'everyone')}>{profile.visibility === 'everyone' ? <Eye size={16}/> : <EyeOff size={16}/>}<span>{profile.visibility === 'everyone' ? 'Visible' : 'Hidden'}</span></button></div>
          </header>
          <section className="live-map-stage">
            <MapContainer center={center} zoom={14} zoomControl={false} attributionControl={false}>
              <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
              <Recenter center={center}/>
              <Circle center={center} radius={1800} pathOptions={{ color: '#7d65ff', weight: 1, opacity: .28, fillColor: '#7d65ff', fillOpacity: .04 }}/>
              <Marker position={center} icon={selfIcon()}/>
              {filteredNearby.map(person => person.approx_lat != null && person.approx_lng != null && <Marker key={person.user_id} position={[person.approx_lat, person.approx_lng]} icon={personIcon(person, selected?.user_id === person.user_id)} eventHandlers={{ click: () => setSelected(person) }}/>) }
            </MapContainer>
            <div className="map-vignette"/>
            <div className="live-map-count"><Sparkles size={15}/><strong>{filteredNearby.length}</strong><span>people active nearby</span></div>
            <div className="live-map-tools"><button onClick={getLocation}><LocateFixed size={19}/></button><button onClick={refreshDiscovery}><RefreshCw size={18}/></button><button disabled><Compass size={19}/></button></div>
            {profile.visibility !== 'everyone' && <div className="discovery-off-card"><EyeOff size={20}/><div><strong>You’re invisible</strong><span>Turn on visibility to discover people nearby.</span></div><button onClick={() => changeVisibility('everyone')}>Go visible</button></div>}
            {locationState === 'error' && <div className="location-live-note"><AlertTriangle size={16}/><span>Location is off. Closeby needs approximate location permission for nearby discovery.</span><button onClick={getLocation}>Try again</button></div>}
            {locationState === 'loading' && <div className="location-live-note"><RefreshCw className="spin" size={16}/><span>Finding your area…</span></div>}
            <div className="live-nearby-dock">
              <div className="dock-head"><div><span>NEARBY NOW</span><strong>{filteredNearby.length ? 'People around you' : 'Your area is quiet'}</strong></div><button onClick={refreshDiscovery}><RefreshCw size={16}/></button></div>
              <div className="dock-scroll">{filteredNearby.slice(0, 10).map(person => <button className="dock-person" key={person.user_id} onClick={() => setSelected(person)}><div className="live-avatar">{initials(person.display_name)}<i/></div><div><strong>{person.display_name}</strong><span>{person.intent || 'Open to connect'} · {person.distance_band}</span></div><ChevronRight size={17}/></button>)}{!filteredNearby.length && <div className="dock-empty"><Users size={20}/><span>{profile.visibility === 'everyone' ? 'No discoverable users nearby yet. Invite friends to try Closeby together.' : 'Go visible when you want to discover people around you.'}</span></div>}</div>
            </div>
          </section>
        </>}

        {screen === 'connections' && <section className="live-content"><header><span className="live-kicker">YOUR PEOPLE</span><h1>Connections</h1><p>People who have accepted a connection with you.</p></header><div className="live-list-panel">{accepted.map(row => { const peerId = row.requester_id === user.id ? row.addressee_id : row.requester_id; const person = peerProfiles[peerId]; if (!person) return null; return <div className="live-person-row" key={row.id}><div className="live-avatar">{initials(person.display_name)}<i/></div><div className="row-copy"><strong>{person.display_name}</strong><span>@{person.username} · {(person.interests || []).slice(0,3).join(' · ') || 'Connected on Closeby'}</span></div><button onClick={() => chatForConnection(row)}><MessageCircle size={18}/><span>Message</span></button><button disabled title="Voice calls coming next"><Phone size={18}/></button><button disabled title="Video calls coming next"><Video size={18}/></button></div>})}{!accepted.length && <div className="big-empty"><Users size={30}/><h3>Your circle starts here.</h3><p>Discover someone nearby and send a connection request.</p><button className="live-primary" onClick={() => setScreen('discover')}>Explore nearby</button></div>}</div></section>}

        {screen === 'messages' && <section className="live-content"><header><span className="live-kicker">STAY CLOSE</span><h1>Messages</h1><p>Private conversations with accepted connections.</p></header><div className="live-list-panel message-list-live">{accepted.map(row => { const peerId = row.requester_id === user.id ? row.addressee_id : row.requester_id; const person = peerProfiles[peerId]; if (!person) return null; return <button className="conversation-row" key={row.id} onClick={() => chatForConnection(row)}><div className="live-avatar">{initials(person.display_name)}<i/></div><div><strong>{person.display_name}</strong><span>Open conversation</span></div><ChevronRight size={18}/></button>})}{!accepted.length && <div className="big-empty"><MessageCircle size={30}/><h3>No conversations yet.</h3><p>Messaging unlocks after a connection is accepted.</p></div>}</div></section>}

        {screen === 'activity' && <section className="live-content"><header><span className="live-kicker">CONNECTION REQUESTS</span><h1>Requests</h1><p>You choose who gets into your circle.</p></header><div className="request-columns"><div className="live-list-panel"><div className="list-panel-head"><h2>Incoming</h2><span>{incoming.length}</span></div>{incoming.map(row => { const person = peerProfiles[row.requester_id]; if (!person) return null; return <div className="request-row" key={row.id}><div className="live-avatar">{initials(person.display_name)}</div><div><strong>{person.display_name}</strong><span>@{person.username}</span></div><button className="accept" disabled={actionBusy} onClick={() => respond(row,true)}><Check size={17}/>Accept</button><button disabled={actionBusy} onClick={() => respond(row,false)}><X size={17}/></button></div>})}{!incoming.length && <div className="small-empty">No new requests.</div>}</div><div className="live-list-panel"><div className="list-panel-head"><h2>Sent</h2><span>{outgoing.length}</span></div>{outgoing.map(row => { const person = peerProfiles[row.addressee_id]; if (!person) return null; return <div className="request-row" key={row.id}><div className="live-avatar">{initials(person.display_name)}</div><div><strong>{person.display_name}</strong><span>Waiting for a response</span></div><span className="pending-pill">Pending</span></div>})}{!outgoing.length && <div className="small-empty">No pending sent requests.</div>}</div></div></section>}
      </main>

      <MobileNav screen={screen} setScreen={setScreen} pendingCount={incoming.length}/>
      <ProfileSheet person={selected} status={selected ? connectionFor(selected.user_id)?.status || selected.connection_status : null} busy={actionBusy} onClose={() => setSelected(null)} onConnect={() => connect(selected)} onMessage={() => { const row = connectionFor(selected.user_id); if (row) { setSelected(null); setChat({ connection: row, person: selected }) } }} onBlock={() => doBlock(selected)} onReport={() => setReporting(selected)}/>
      {privacyOpen && <PrivacyPanel profile={profile} onClose={() => setPrivacyOpen(false)} onChange={changeVisibility}/>} 
      {reporting && <ReportDialog person={reporting} onClose={() => setReporting(null)} onSubmit={submitReport}/>} 
      {chat && <ChatPanel chat={chat} userId={user.id} onClose={() => setChat(null)} onSent={refreshConnections}/>} 
      {toast && <div className="live-toast"><Check size={16}/>{toast}</div>}
    </div>
  )
}

export default LiveApp
