import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import { Circle, MapContainer, Marker, TileLayer, useMap } from 'react-leaflet'
import {
  AlertTriangle, ArrowLeft, Bell, Check, ChevronRight, Crosshair, Eye, EyeOff,
  LocateFixed, LockKeyhole, LogOut, Map as MapIcon, MapPin, MessageCircle,
  Navigation, Phone, RefreshCw, Search, Send, Settings, Shield, ShieldCheck,
  Sparkles, UserPlus, Users, Video, X,
} from 'lucide-react'
import {
  blockUser, clearSession, createReport, discoverNearby, getConnections,
  getCurrentUser, getMessages, getMyProfile, getProfilesByIds, getStoredSession,
  getValidSession, markConversationRead, respondConnectionRequest, saveMyProfile,
  sendConnectionRequest, sendMessage, setOffline, signIn, signOut, signUp,
  touchPresence, updateMyProfile,
} from './lib/closebyApi'
import './live-v2.css'

const DEFAULT_CENTER = [12.9716, 77.5946]
const PRESENCE_INTERVAL = 45_000
const DISCOVERY_INTERVAL = 15_000
const CONNECTION_INTERVAL = 12_000
const CHAT_INTERVAL = 4_000
const LOCATION_OVERRIDE_KEY = 'closeby-location-override-v1'

const cx = (...v) => v.filter(Boolean).join(' ')
const initials = (name = '?') => name.split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]?.toUpperCase()).join('') || '?'
const prettyTime = value => {
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '' : new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(d)
}

function readOverride() {
  try {
    const raw = localStorage.getItem(LOCATION_OVERRIDE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function saveOverride(value) {
  if (!value) localStorage.removeItem(LOCATION_OVERRIDE_KEY)
  else localStorage.setItem(LOCATION_OVERRIDE_KEY, JSON.stringify(value))
}

function Recenter({ center }) {
  const map = useMap()
  useEffect(() => { map.flyTo(center, 14, { duration: .55 }) }, [center, map])
  return null
}

function personIcon(person, selected) {
  return L.divIcon({
    className: 'cb2-div-icon',
    html: `<div class="cb2-person-pin ${selected ? 'selected' : ''}"><span>${initials(person.display_name)}</span><i></i></div>`,
    iconSize: [50, 50], iconAnchor: [25, 25],
  })
}

function selfIcon() {
  return L.divIcon({
    className: 'cb2-div-icon',
    html: '<div class="cb2-self-pin"><span>YOU</span></div>',
    iconSize: [50, 50], iconAnchor: [25, 25],
  })
}

function Logo() {
  return <div className="cb2-brand"><div className="cb2-logo"><span/><span/><span/></div><strong>Closeby</strong></div>
}

function Loading() {
  return <div className="cb2-gate cb2-loading"><Logo/><div className="cb2-dots"><i/><i/><i/></div><span>Opening your circle…</span></div>
}

function Auth({ onReady }) {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)

  async function submit(e) {
    e.preventDefault(); setBusy(true); setMessage(null)
    try {
      if (password.length < 8) throw new Error('Use at least 8 characters for your password.')
      const result = mode === 'signup' ? await signUp(email, password) : await signIn(email, password)
      if (result?.access_token || getStoredSession()?.access_token) await onReady()
      else {
        setMessage({ ok: true, text: 'Account created. Confirm your email if Supabase asks you to, then sign in.' })
        setMode('signin')
      }
    } catch (err) { setMessage({ ok: false, text: err.message || 'Could not continue' }) }
    finally { setBusy(false) }
  }

  return <div className="cb2-gate cb2-auth"><section className="cb2-auth-card">
    <Logo/>
    <div className="cb2-auth-copy"><span><Sparkles size={14}/> YOUR WORLD, CLOSER</span><h1>{mode === 'signin' ? 'Good to see you.' : 'Find your people.'}</h1><p>{mode === 'signin' ? 'Sign in to see friends and discover people around you.' : 'Create an account to connect without exposing your exact GPS location.'}</p></div>
    <form onSubmit={submit} className="cb2-form">
      <label>Email<input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com"/></label>
      <label>Password<input type="password" required minLength={8} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters"/></label>
      {message && <div className={cx('cb2-alert', message.ok ? 'ok' : 'error')}>{message.ok ? <Check size={16}/> : <AlertTriangle size={16}/>}<span>{message.text}</span></div>}
      <button className="cb2-primary" disabled={busy}>{busy ? 'One moment…' : mode === 'signin' ? 'Sign in' : 'Create account'}<ChevronRight size={17}/></button>
    </form>
    <button className="cb2-auth-switch" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setMessage(null) }}>{mode === 'signin' ? <>New here? <b>Create an account</b></> : <>Already on Closeby? <b>Sign in</b></>}</button>
    <div className="cb2-trust"><ShieldCheck size={16}/><span>Other users only receive a deliberately coarse discovery position.</span></div>
  </section></div>
}

function Onboarding({ user, onSaved }) {
  const suggested = (user?.email || 'closeby').split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 20)
  const [form, setForm] = useState({ username: suggested.length >= 3 ? suggested : `user_${suggested}`, display_name: '', bio: '', interests: '', intent: 'friends', visibility: 'hidden', age_confirmed_18: false })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const field = (key, value) => setForm(v => ({ ...v, [key]: value }))

  async function submit(e) {
    e.preventDefault(); setError('')
    if (!form.age_confirmed_18) return setError('Closeby people discovery is currently 18+ only.')
    setBusy(true)
    try {
      const p = await saveMyProfile({
        user_id: user.id, username: form.username.trim(), display_name: form.display_name.trim(), bio: form.bio.trim(),
        interests: form.interests.split(',').map(x => x.trim()).filter(Boolean).slice(0, 12), intent: form.intent,
        visibility: form.visibility, age_confirmed_18: true,
      })
      onSaved(p)
    } catch (err) { setError(err.message || 'Could not create profile') }
    finally { setBusy(false) }
  }

  return <div className="cb2-gate cb2-onboarding"><section className="cb2-onboard-card">
    <Logo/>
    <header><span>01 / YOUR PROFILE</span><h1>How should people know you?</h1><p>You control what people can see. You can change this later.</p></header>
    <form onSubmit={submit} className="cb2-form cb2-onboard-form">
      <div className="cb2-grid2"><label>Display name<input required maxLength={60} value={form.display_name} onChange={e => field('display_name', e.target.value)} placeholder="Rishi"/></label><label>Username<div className="cb2-userinput"><span>@</span><input required minLength={3} maxLength={24} pattern="[A-Za-z0-9_]{3,24}" value={form.username} onChange={e => field('username', e.target.value)}/></div></label></div>
      <label>Short bio<textarea rows={3} maxLength={240} value={form.bio} onChange={e => field('bio', e.target.value)} placeholder="Developer, music, spontaneous plans…"/></label>
      <label>Interests <small>comma separated, up to 12</small><input value={form.interests} onChange={e => field('interests', e.target.value)} placeholder="AI, Music, Gaming, Coffee"/></label>
      <div className="cb2-grid2"><label>Here for<select value={form.intent} onChange={e => field('intent', e.target.value)}><option value="friends">Friends</option><option value="hangout">Hang out</option><option value="networking">Networking</option><option value="study">Study</option><option value="explore">Explore</option></select></label><label>Start visibility<select value={form.visibility} onChange={e => field('visibility', e.target.value)}><option value="hidden">Hidden — safest default</option><option value="everyone">Visible nearby</option><option value="connections">Connections only</option></select></label></div>
      <label className="cb2-age"><input type="checkbox" checked={form.age_confirmed_18} onChange={e => field('age_confirmed_18', e.target.checked)}/><span><b>I confirm I’m 18 or older.</b><small>Closeby discovery is 18+ in this version.</small></span></label>
      {error && <div className="cb2-alert error"><AlertTriangle size={16}/><span>{error}</span></div>}
      <button className="cb2-primary" disabled={busy}>{busy ? 'Creating profile…' : 'Enter Closeby'}<ChevronRight size={17}/></button>
    </form>
    <div className="cb2-trust"><LockKeyhole size={16}/><span>Your raw browser location is quantized before it is stored for discovery.</span></div>
  </section></div>
}

function LocationModal({ current, onClose, onUseDevice, onChoose }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function searchArea(e) {
    e.preventDefault(); if (!query.trim()) return
    setBusy(true); setError('')
    try {
      const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query.trim())}&limit=6`)
      if (!res.ok) throw new Error('Location search is temporarily unavailable.')
      const data = await res.json()
      const next = (data.features || []).map(f => ({
        lat: Number(f.geometry.coordinates[1]), lng: Number(f.geometry.coordinates[0]),
        label: [f.properties.name, f.properties.city, f.properties.state, f.properties.country].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(', '),
      })).filter(x => Number.isFinite(x.lat) && Number.isFinite(x.lng))
      setResults(next)
      if (!next.length) setError('No matching area found. Try a city or neighborhood name.')
    } catch (err) { setError(err.message || 'Could not search that area') }
    finally { setBusy(false) }
  }

  return <div className="cb2-modal" onMouseDown={e => e.target === e.currentTarget && onClose()}><section className="cb2-location-modal">
    <header><div><span>LOCATION</span><h2>Correct your area</h2></div><button onClick={onClose}><X size={18}/></button></header>
    <p>Browser location can be wrong on laptops, VPNs and privacy-focused browsers. Choose your rough area — Closeby will still store only a coarse position.</p>
    <div className="cb2-current-location"><MapPin size={18}/><div><b>{current?.label || (current?.source === 'manual' ? 'Manual area' : 'Device location')}</b><span>{current?.accuracy ? `Browser accuracy: about ${current.accuracy >= 1000 ? `${(current.accuracy/1000).toFixed(1)} km` : `${Math.round(current.accuracy)} m`}` : 'Approximate discovery area'}</span></div></div>
    <button className="cb2-secondary-wide" onClick={onUseDevice}><LocateFixed size={17}/>Retry device location</button>
    <div className="cb2-divider"><span>or set an area manually</span></div>
    <form onSubmit={searchArea} className="cb2-area-search"><Search size={17}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="City or neighborhood, e.g. Bengaluru"/><button disabled={busy}>{busy ? 'Searching…' : 'Search'}</button></form>
    {error && <div className="cb2-alert error"><AlertTriangle size={15}/><span>{error}</span></div>}
    <div className="cb2-area-results">{results.map((r, i) => <button key={`${r.lat}-${r.lng}-${i}`} onClick={() => onChoose(r)}><MapPin size={16}/><span>{r.label || 'Selected area'}</span><ChevronRight size={16}/></button>)}</div>
    <small className="cb2-geocode-note">Area search uses OpenStreetMap-based Photon geocoding. Do not search your exact home address; a neighborhood or city is enough.</small>
  </section></div>
}

function Sidebar({ screen, setScreen, profile, accepted, incoming, onPrivacy, onLocation, onLogout }) {
  const nav = [['discover', MapIcon, 'Discover'], ['connections', Users, 'Connections'], ['messages', MessageCircle, 'Messages'], ['activity', Bell, 'Requests']]
  return <aside className="cb2-sidebar"><Logo/><nav>{nav.map(([key, Icon, label]) => <button key={key} className={cx(screen === key && 'active')} onClick={() => setScreen(key)}><Icon size={20}/><span>{label}</span>{key === 'connections' && accepted > 0 && <em>{accepted}</em>}{key === 'activity' && incoming > 0 && <em>{incoming}</em>}</button>)}</nav><div className="cb2-side-bottom"><button onClick={onLocation}><MapPin size={19}/><span>My area</span></button><button onClick={onPrivacy}><Shield size={19}/><span>Privacy</span></button><button disabled><Settings size={19}/><span>Settings</span></button><div className="cb2-me"><div className="cb2-avatar mine">{initials(profile.display_name)}</div><div><b>{profile.display_name}</b><span>@{profile.username}</span></div><button onClick={onLogout}><LogOut size={17}/></button></div></div></aside>
}

function MobileNav({ screen, setScreen, incoming }) {
  const nav = [['discover', MapIcon, 'Map'], ['connections', Users, 'People'], ['messages', MessageCircle, 'Chats'], ['activity', Bell, 'Requests']]
  return <nav className="cb2-mobile-nav">{nav.map(([key, Icon, label]) => <button key={key} className={cx(screen === key && 'active')} onClick={() => setScreen(key)}><Icon size={20}/>{key === 'activity' && incoming > 0 && <i/>}<span>{label}</span></button>)}</nav>
}

function PrivacyModal({ profile, onClose, onChange }) {
  const [busy, setBusy] = useState(false)
  const options = [['everyone', Eye, 'Visible nearby', 'Appear to eligible people around your coarse location.'], ['connections', Users, 'Connections only', 'Stay off public nearby discovery.'], ['hidden', EyeOff, 'Invisible', 'Do not appear in discovery.']]
  async function choose(v) { setBusy(true); try { await onChange(v) } finally { setBusy(false) } }
  return <div className="cb2-modal" onMouseDown={e => e.target === e.currentTarget && onClose()}><section className="cb2-privacy"><header><div><span>DISCOVERABILITY</span><h2>Who can find you?</h2></div><button onClick={onClose}><X size={18}/></button></header><p>Your precise device location is never returned to another user.</p><div>{options.map(([v, Icon, title, copy]) => <button key={v} disabled={busy} className={cx(profile.visibility === v && 'selected')} onClick={() => choose(v)}><Icon size={19}/><span><b>{title}</b><small>{copy}</small></span>{profile.visibility === v && <Check size={17}/>}</button>)}</div></section></div>
}

function ProfileDrawer({ person, status, busy, onClose, onConnect, onMessage, onBlock, onReport }) {
  if (!person) return null
  return <aside className="cb2-drawer"><button className="cb2-close" onClick={onClose}><X size={18}/></button><div className="cb2-profile-avatar">{initials(person.display_name)}<i/></div><h2>{person.display_name}</h2><span className="cb2-handle">@{person.username}</span><div className="cb2-online"><i/>Active recently · {person.distance_band || 'nearby'}</div><p>{person.bio || 'No bio yet.'}</p><div className="cb2-chips">{(person.interests || []).map(x => <span key={x}>{x}</span>)}</div><div className="cb2-profile-actions">{status === 'accepted' ? <button className="cb2-primary" onClick={onMessage}><MessageCircle size={17}/>Message</button> : status === 'pending' ? <button className="cb2-primary muted" disabled><Check size={17}/>Request pending</button> : <button className="cb2-primary" disabled={busy} onClick={onConnect}><UserPlus size={17}/>Connect</button>}<button disabled><Phone size={17}/></button><button disabled><Video size={17}/></button></div><div className="cb2-safety"><ShieldCheck size={16}/><span>This marker is deliberately approximate.</span></div><div className="cb2-danger-actions"><button onClick={onReport}>Report</button><button onClick={onBlock}>Block</button></div></aside>
}

function ReportModal({ person, onClose, onSubmit }) {
  const [category, setCategory] = useState('spam')
  const [details, setDetails] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(e) { e.preventDefault(); setBusy(true); try { await onSubmit(category, details); onClose() } finally { setBusy(false) } }
  return <div className="cb2-modal"><form className="cb2-report" onSubmit={submit}><header><div><span>SAFETY</span><h2>Report {person.display_name}</h2></div><button type="button" onClick={onClose}><X size={18}/></button></header><label>Reason<select value={category} onChange={e => setCategory(e.target.value)}><option value="spam">Spam</option><option value="harassment">Harassment</option><option value="impersonation">Impersonation</option><option value="unsafe_behavior">Unsafe behavior</option><option value="underage">Possible underage user</option><option value="other">Other</option></select></label><label>Details <small>optional</small><textarea rows={4} maxLength={1000} value={details} onChange={e => setDetails(e.target.value)} placeholder="Tell us what happened…"/></label><button className="cb2-primary" disabled={busy}>{busy ? 'Sending…' : 'Submit report'}</button></form></div>
}

function Chat({ chat, userId, onClose }) {
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const bottom = useRef(null)
  const load = useCallback(async () => { try { const rows = await getMessages(chat.connection.id); setMessages(rows); await markConversationRead(chat.connection.id).catch(() => {}) } catch (e) { setError(e.message || 'Could not load messages') } }, [chat.connection.id])
  useEffect(() => { load(); const t = setInterval(load, CHAT_INTERVAL); return () => clearInterval(t) }, [load])
  useEffect(() => bottom.current?.scrollIntoView({ behavior: 'smooth' }), [messages.length])
  async function submit(e) { e.preventDefault(); const body = text.trim(); if (!body || busy) return; setBusy(true); setError(''); try { await sendMessage(chat.connection.id, body); setText(''); await load() } catch (err) { setError(err.message || 'Could not send') } finally { setBusy(false) } }
  return <aside className="cb2-chat"><header><button onClick={onClose}><ArrowLeft size={19}/></button><div className="cb2-avatar">{initials(chat.person.display_name)}<i/></div><div><b>{chat.person.display_name}</b><span>@{chat.person.username}</span></div><button disabled><Phone size={17}/></button><button disabled><Video size={17}/></button></header><div className="cb2-chat-body"><div className="cb2-chat-intro"><ShieldCheck size={18}/><b>You’re connected</b><span>Only members of this accepted connection can read these messages.</span></div>{messages.map(m => <div key={m.id} className={cx('cb2-bubble-wrap', m.sender_id === userId && 'mine')}><div className="cb2-bubble">{m.body}<small>{prettyTime(m.sent_at)}</small></div></div>)}<div ref={bottom}/></div>{error && <div className="cb2-chat-error">{error}</div>}<form onSubmit={submit}><input maxLength={2000} value={text} onChange={e => setText(e.target.value)} placeholder={`Message ${chat.person.display_name}`}/><button disabled={busy || !text.trim()}><Send size={17}/></button></form></aside>
}

export default function LiveAppV2() {
  const [booting, setBooting] = useState(true)
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [backendError, setBackendError] = useState('')
  const [screen, setScreen] = useState('discover')
  const [location, setLocation] = useState(null)
  const [locationState, setLocationState] = useState('idle')
  const [nearby, setNearby] = useState([])
  const [discoveryError, setDiscoveryError] = useState('')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [connections, setConnections] = useState([])
  const [peerProfiles, setPeerProfiles] = useState({})
  const [privacyOpen, setPrivacyOpen] = useState(false)
  const [locationOpen, setLocationOpen] = useState(false)
  const [reporting, setReporting] = useState(null)
  const [chat, setChat] = useState(null)
  const [actionBusy, setActionBusy] = useState(false)
  const [toast, setToast] = useState('')
  const flash = useCallback(text => { setToast(text); window.setTimeout(() => setToast(''), 2800) }, [])

  const bootstrap = useCallback(async () => {
    setBooting(true); setBackendError('')
    try {
      const valid = await getValidSession()
      if (!valid) { setSession(null); setUser(null); setProfile(null); return }
      const current = await getCurrentUser(valid.access_token)
      setSession(valid); setUser(current)
      try { setProfile(await getMyProfile(current.id)) }
      catch (err) { if (err.status === 404 || err.status === 406) setProfile(null); else throw err }
    } catch (err) {
      if (String(err.message || '').toLowerCase().includes('schema') || err.status === 406) setBackendError(err.message)
      else { clearSession(); setSession(null); setUser(null); setProfile(null) }
    } finally { setBooting(false) }
  }, [])
  useEffect(() => { bootstrap() }, [bootstrap])

  const getDeviceLocation = useCallback((clearManual = false) => {
    if (clearManual) saveOverride(null)
    if (!navigator.geolocation) { setLocationState('error'); return }
    setLocationState('loading')
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      const next = { lat: coords.latitude, lng: coords.longitude, accuracy: coords.accuracy, source: 'device', label: 'Device location' }
      setLocation(next); setLocationState('ready')
      if (coords.accuracy > 5000) setLocationOpen(true)
    }, () => { setLocationState('error'); setLocationOpen(true) }, { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 })
  }, [])

  useEffect(() => {
    if (!profile) return
    const manual = readOverride()
    if (manual?.lat != null && manual?.lng != null) { setLocation({ ...manual, source: 'manual' }); setLocationState('ready') }
    else getDeviceLocation(false)
  }, [profile, getDeviceLocation])

  const refreshConnections = useCallback(async () => {
    if (!user?.id || !profile) return
    try {
      const rows = await getConnections(user.id)
      setConnections(rows)
      const ids = rows.map(r => r.requester_id === user.id ? r.addressee_id : r.requester_id)
      const profiles = await getProfilesByIds(ids)
      setPeerProfiles(Object.fromEntries(profiles.map(p => [p.user_id, p])))
    } catch (err) { console.warn('Closeby connections:', err) }
  }, [user?.id, profile])
  useEffect(() => { if (!profile) return; refreshConnections(); const t = setInterval(refreshConnections, CONNECTION_INTERVAL); return () => clearInterval(t) }, [profile, refreshConnections])

  const refreshDiscovery = useCallback(async () => {
    if (!profile || profile.visibility !== 'everyone' || !location) { setNearby([]); return }
    try { setDiscoveryError(''); const rows = await discoverNearby(20, 60); setNearby(Array.isArray(rows) ? rows : []) }
    catch (err) { setDiscoveryError(err.message || 'Could not refresh nearby people') }
  }, [profile, location])

  useEffect(() => {
    if (!profile || !location) return
    let stopped = false
    const pulse = async () => {
      try {
        if (profile.visibility === 'everyone') {
          await touchPresence(location.lat, location.lng)
          if (!stopped) await refreshDiscovery()
        } else { await setOffline().catch(() => {}); if (!stopped) setNearby([]) }
      } catch (err) { if (!stopped) setDiscoveryError(err.message || 'Could not update your presence') }
    }
    pulse()
    const p = setInterval(pulse, PRESENCE_INTERVAL)
    const d = setInterval(refreshDiscovery, DISCOVERY_INTERVAL)
    return () => { stopped = true; clearInterval(p); clearInterval(d) }
  }, [profile, location, refreshDiscovery])

  const accepted = connections.filter(r => r.status === 'accepted')
  const incoming = connections.filter(r => r.status === 'pending' && r.addressee_id === user?.id)
  const outgoing = connections.filter(r => r.status === 'pending' && r.requester_id === user?.id)
  const connectionFor = useCallback(id => connections.find(r => (r.requester_id === user?.id && r.addressee_id === id) || (r.addressee_id === user?.id && r.requester_id === id)), [connections, user?.id])
  const filtered = useMemo(() => { const q = search.trim().toLowerCase(); return q ? nearby.filter(p => p.display_name.toLowerCase().includes(q) || p.username.toLowerCase().includes(q) || (p.interests || []).some(x => x.toLowerCase().includes(q))) : nearby }, [nearby, search])

  async function chooseManualArea(area) {
    const manual = { lat: area.lat, lng: area.lng, label: area.label || 'Manual area', source: 'manual' }
    saveOverride(manual); setLocation(manual); setLocationState('ready'); setLocationOpen(false); flash('Discovery area updated.')
  }
  async function changeVisibility(value) {
    const updated = await updateMyProfile(user.id, { visibility: value }); setProfile(updated)
    if (value !== 'everyone') { await setOffline().catch(() => {}); setNearby([]) }
    else if (location) { await touchPresence(location.lat, location.lng); window.setTimeout(refreshDiscovery, 250) }
    flash(value === 'everyone' ? 'You’re visible nearby.' : value === 'hidden' ? 'You’re invisible now.' : 'Discovery limited to connections.')
  }
  async function connect(person) { setActionBusy(true); try { await sendConnectionRequest(person.user_id); await refreshConnections(); flash('Connection request sent.') } catch (e) { flash(e.message || 'Could not send request') } finally { setActionBusy(false) } }
  async function respond(row, accept) { setActionBusy(true); try { await respondConnectionRequest(row.id, accept); await refreshConnections(); flash(accept ? 'You’re connected.' : 'Request declined.') } catch (e) { flash(e.message || 'Could not respond') } finally { setActionBusy(false) } }
  async function doBlock(person) { if (!window.confirm(`Block ${person.display_name}?`)) return; setActionBusy(true); try { await blockUser(person.user_id); setSelected(null); await refreshConnections(); await refreshDiscovery(); flash(`${person.display_name} blocked.`) } catch (e) { flash(e.message || 'Could not block') } finally { setActionBusy(false) } }
  async function submitReport(category, details) { await createReport(user.id, reporting.user_id, category, details); flash('Report received. Thank you.') }
  function openChat(row, personOverride) { const peerId = row.requester_id === user.id ? row.addressee_id : row.requester_id; const person = personOverride || peerProfiles[peerId]; if (person) setChat({ connection: row, person }) }
  async function logout() { await setOffline().catch(() => {}); await signOut(session?.access_token).catch(() => clearSession()); setSession(null); setUser(null); setProfile(null); setNearby([]); setConnections([]) }

  if (booting) return <Loading/>
  if (!session || !user) return <Auth onReady={bootstrap}/>
  if (backendError) return <div className="cb2-gate"><section className="cb2-error-card"><Logo/><AlertTriangle size={28}/><h1>Backend unavailable</h1><p>{backendError}</p><button className="cb2-primary" onClick={bootstrap}><RefreshCw size={17}/>Retry</button></section></div>
  if (!profile) return <Onboarding user={user} onSaved={setProfile}/>

  const center = location ? [location.lat, location.lng] : DEFAULT_CENTER
  return <div className="cb2-shell">
    <Sidebar screen={screen} setScreen={setScreen} profile={profile} accepted={accepted.length} incoming={incoming.length} onPrivacy={() => setPrivacyOpen(true)} onLocation={() => setLocationOpen(true)} onLogout={logout}/>
    <main className="cb2-main">
      {screen === 'discover' && <section className="cb2-discover">
        <header className="cb2-topbar"><div><span className="cb2-kicker"><i/>LIVE AROUND YOU</span><h1>See who’s close.</h1></div><div className="cb2-top-actions"><div className="cb2-search"><Search size={17}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search people or interests"/>{search && <button onClick={() => setSearch('')}><X size={14}/></button>}</div><button className={cx('cb2-visible', profile.visibility === 'everyone' && 'on')} onClick={() => changeVisibility(profile.visibility === 'everyone' ? 'hidden' : 'everyone')}>{profile.visibility === 'everyone' ? <Eye size={17}/> : <EyeOff size={17}/>}<span>{profile.visibility === 'everyone' ? 'Visible' : 'Hidden'}</span></button></div></header>
        <div className="cb2-map-wrap">
          <MapContainer center={center} zoom={14} zoomControl={false} attributionControl={true} scrollWheelZoom={true}>
            <TileLayer className="cb2-osm-tiles" attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
            <Recenter center={center}/><Circle center={center} radius={1800} pathOptions={{ color: '#806cff', weight: 1, opacity: .35, fillColor: '#806cff', fillOpacity: .04 }}/><Marker position={center} icon={selfIcon()}/>
            {filtered.map(p => p.approx_lat != null && p.approx_lng != null && <Marker key={p.user_id} position={[p.approx_lat, p.approx_lng]} icon={personIcon(p, selected?.user_id === p.user_id)} eventHandlers={{ click: () => setSelected(p) }}/>) }
          </MapContainer>
          <div className="cb2-map-vignette"/>
          <div className="cb2-count"><Sparkles size={15}/><b>{filtered.length}</b><span>people active nearby</span></div>
          <div className="cb2-map-tools"><button onClick={() => getDeviceLocation(true)} title="Retry device location"><LocateFixed size={19}/></button><button onClick={refreshDiscovery} title="Refresh nearby"><RefreshCw size={18}/></button><button onClick={() => setLocationOpen(true)} title="Correct my area"><MapPin size={18}/></button></div>
          <button className="cb2-location-pill" onClick={() => setLocationOpen(true)}><Navigation size={14}/><span>{location?.source === 'manual' ? (location.label || 'Manual area') : locationState === 'loading' ? 'Finding your location…' : locationState === 'error' ? 'Location needs attention' : 'Device location'}</span><small>Wrong area? Change</small></button>
          {profile.visibility !== 'everyone' && <div className="cb2-off"><EyeOff size={20}/><div><b>You’re invisible</b><span>Turn on visibility to discover people nearby.</span></div><button onClick={() => changeVisibility('everyone')}>Go visible</button></div>}
          {discoveryError && <div className="cb2-map-error"><AlertTriangle size={15}/><span>{discoveryError}</span><button onClick={refreshDiscovery}>Retry</button></div>}
        </div>
        <section className="cb2-nearby"><header><div><span>NEARBY NOW</span><h2>{filtered.length ? 'People around you' : 'Your area is quiet'}</h2></div><button onClick={refreshDiscovery}><RefreshCw size={17}/></button></header><div className="cb2-nearby-list">{filtered.map(p => <button className="cb2-person-row" key={p.user_id} onClick={() => setSelected(p)}><div className="cb2-avatar">{initials(p.display_name)}<i/></div><div><b>{p.display_name}</b><span>{p.intent || 'Open to connect'} · {p.distance_band}</span></div><ChevronRight size={17}/></button>)}{!filtered.length && <div className="cb2-empty-row"><Users size={21}/><div><b>No discoverable people nearby yet.</b><span>If another device is in the same place but missing, use “Wrong area? Change” on both devices and choose the same city/neighborhood.</span></div></div>}</div></section>
      </section>}

      {screen === 'connections' && <section className="cb2-content"><header><span>YOUR PEOPLE</span><h1>Connections</h1><p>People who accepted a connection with you.</p></header><div className="cb2-list">{accepted.map(row => { const peerId = row.requester_id === user.id ? row.addressee_id : row.requester_id; const p = peerProfiles[peerId]; if (!p) return null; return <div className="cb2-list-row" key={row.id}><div className="cb2-avatar">{initials(p.display_name)}<i/></div><div><b>{p.display_name}</b><span>@{p.username}</span></div><button onClick={() => openChat(row)}><MessageCircle size={17}/>Message</button></div>})}{!accepted.length && <div className="cb2-big-empty"><Users size={30}/><h3>Your circle starts here.</h3><p>Discover someone nearby and send a request.</p><button className="cb2-primary" onClick={() => setScreen('discover')}>Explore nearby</button></div>}</div></section>}

      {screen === 'messages' && <section className="cb2-content"><header><span>STAY CLOSE</span><h1>Messages</h1><p>Private conversations with accepted connections.</p></header><div className="cb2-list">{accepted.map(row => { const peerId = row.requester_id === user.id ? row.addressee_id : row.requester_id; const p = peerProfiles[peerId]; if (!p) return null; return <button className="cb2-conversation" key={row.id} onClick={() => openChat(row)}><div className="cb2-avatar">{initials(p.display_name)}<i/></div><div><b>{p.display_name}</b><span>Open conversation</span></div><ChevronRight size={17}/></button>})}{!accepted.length && <div className="cb2-big-empty"><MessageCircle size={30}/><h3>No conversations yet.</h3><p>Messaging unlocks after a connection is accepted.</p></div>}</div></section>}

      {screen === 'activity' && <section className="cb2-content"><header><span>CONNECTION REQUESTS</span><h1>Requests</h1><p>You choose who gets into your circle.</p></header><div className="cb2-request-grid"><div className="cb2-list"><div className="cb2-list-head"><h2>Incoming</h2><span>{incoming.length}</span></div>{incoming.map(row => { const p = peerProfiles[row.requester_id]; if (!p) return null; return <div className="cb2-request" key={row.id}><div className="cb2-avatar">{initials(p.display_name)}</div><div><b>{p.display_name}</b><span>@{p.username}</span></div><button className="accept" disabled={actionBusy} onClick={() => respond(row, true)}><Check size={16}/>Accept</button><button disabled={actionBusy} onClick={() => respond(row, false)}><X size={16}/></button></div>})}{!incoming.length && <div className="cb2-small-empty">No new requests.</div>}</div><div className="cb2-list"><div className="cb2-list-head"><h2>Sent</h2><span>{outgoing.length}</span></div>{outgoing.map(row => { const p = peerProfiles[row.addressee_id]; if (!p) return null; return <div className="cb2-request" key={row.id}><div className="cb2-avatar">{initials(p.display_name)}</div><div><b>{p.display_name}</b><span>Waiting for a response</span></div><em>Pending</em></div>})}{!outgoing.length && <div className="cb2-small-empty">No pending sent requests.</div>}</div></div></section>}
    </main>

    <MobileNav screen={screen} setScreen={setScreen} incoming={incoming.length}/>
    <ProfileDrawer person={selected} status={selected ? connectionFor(selected.user_id)?.status || selected.connection_status : null} busy={actionBusy} onClose={() => setSelected(null)} onConnect={() => connect(selected)} onMessage={() => { const row = connectionFor(selected.user_id); if (row) { setSelected(null); openChat(row, selected) } }} onBlock={() => doBlock(selected)} onReport={() => setReporting(selected)}/>
    {privacyOpen && <PrivacyModal profile={profile} onClose={() => setPrivacyOpen(false)} onChange={changeVisibility}/>} 
    {locationOpen && <LocationModal current={location} onClose={() => setLocationOpen(false)} onUseDevice={() => { setLocationOpen(false); getDeviceLocation(true) }} onChoose={chooseManualArea}/>} 
    {reporting && <ReportModal person={reporting} onClose={() => setReporting(null)} onSubmit={submitReport}/>} 
    {chat && <Chat chat={chat} userId={user.id} onClose={() => setChat(null)}/>} 
    {toast && <div className="cb2-toast"><Check size={16}/>{toast}</div>}
  </div>
}
