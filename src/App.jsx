import { useEffect, useMemo, useState } from 'react'
import L from 'leaflet'
import { MapContainer, TileLayer, Marker, Circle, useMap } from 'react-leaflet'
import {
  Bell,
  Check,
  ChevronLeft,
  Compass,
  Eye,
  EyeOff,
  LocateFixed,
  Map as MapIcon,
  MessageCircle,
  MoreHorizontal,
  Phone,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  UserPlus,
  Users,
  Video,
  X,
} from 'lucide-react'

const DEFAULT_CENTER = [12.9716, 77.5946]

const PEOPLE = [
  { id: 1, name: 'Aarav', age: 22, initials: 'AK', bio: 'Building things, finding good coffee, and always down for a conversation.', interests: ['Design', 'Startups', 'Coffee'], intent: 'Networking', offset: [0.010, -0.005], mutual: 3, tone: 'violet' },
  { id: 2, name: 'Maya', age: 21, initials: 'MS', bio: 'Film, music, little adventures and big playlists.', interests: ['Music', 'Movies', 'Travel'], intent: 'Hang out', offset: [-0.007, 0.010], mutual: 1, tone: 'rose' },
  { id: 3, name: 'Dev', age: 23, initials: 'DR', bio: 'Developer. Probably debugging something right now.', interests: ['Tech', 'Gaming', 'AI'], intent: 'Meet people', offset: [0.005, 0.014], mutual: 4, tone: 'cyan' },
  { id: 4, name: 'Nisha', age: 21, initials: 'NA', bio: 'Books, badminton and trying every dessert place in the city.', interests: ['Books', 'Food', 'Sports'], intent: 'Friends', offset: [-0.012, -0.008], mutual: 2, tone: 'amber' },
  { id: 5, name: 'Kabir', age: 24, initials: 'KM', bio: 'Product, photography and weekend football.', interests: ['Product', 'Photos', 'Football'], intent: 'Networking', offset: [0.015, 0.012], mutual: 0, tone: 'lime' },
  { id: 6, name: 'Ira', age: 22, initials: 'IP', bio: 'Designer with an unreasonable number of saved places.', interests: ['Art', 'Design', 'Food'], intent: 'Explore', offset: [-0.015, 0.004], mutual: 2, tone: 'blue' },
  { id: 7, name: 'Aditya', age: 22, initials: 'AV', bio: 'Student, gym sometimes, games always.', interests: ['Gaming', 'Fitness', 'Tech'], intent: 'Hang out', offset: [0.001, -0.016], mutual: 5, tone: 'orange' },
]

const INITIAL_MESSAGES = {
  2: [
    { id: 1, mine: false, text: 'Hey! You’re nearby too?', time: '10:42 PM' },
    { id: 2, mine: true, text: 'Yeah 😄 just checking out Closeby.', time: '10:43 PM' },
  ],
}

function Recenter({ center }) {
  const map = useMap()
  useEffect(() => {
    map.flyTo(center, 14, { duration: 0.8 })
  }, [center, map])
  return null
}

function personIcon(person, active) {
  return L.divIcon({
    className: 'closeby-div-icon',
    html: `<div class="person-pin ${person.tone} ${active ? 'active' : ''}"><span>${person.initials}</span><i></i></div>`,
    iconSize: [54, 54],
    iconAnchor: [27, 27],
  })
}

function selfIcon() {
  return L.divIcon({
    className: 'closeby-div-icon',
    html: '<div class="self-pin"><div>YOU</div></div>',
    iconSize: [52, 52],
    iconAnchor: [26, 26],
  })
}

function Logo() {
  return (
    <div className="brand">
      <div className="brand-mark"><span /><span /><span /></div>
      <span>Closeby</span>
    </div>
  )
}

function App() {
  const [center, setCenter] = useState(DEFAULT_CENTER)
  const [locationState, setLocationState] = useState('idle')
  const [selected, setSelected] = useState(null)
  const [screen, setScreen] = useState('map')
  const [search, setSearch] = useState('')
  const [discoverable, setDiscoverable] = useState(true)
  const [privacyOpen, setPrivacyOpen] = useState(false)
  const [requests, setRequests] = useState(() => JSON.parse(localStorage.getItem('closeby-requests') || '[]'))
  const [connections, setConnections] = useState(() => JSON.parse(localStorage.getItem('closeby-connections') || '[2]'))
  const [messages, setMessages] = useState(() => JSON.parse(localStorage.getItem('closeby-messages') || JSON.stringify(INITIAL_MESSAGES)))
  const [chatWith, setChatWith] = useState(null)
  const [messageText, setMessageText] = useState('')

  useEffect(() => localStorage.setItem('closeby-requests', JSON.stringify(requests)), [requests])
  useEffect(() => localStorage.setItem('closeby-connections', JSON.stringify(connections)), [connections])
  useEffect(() => localStorage.setItem('closeby-messages', JSON.stringify(messages)), [messages])

  const people = useMemo(() => PEOPLE.map(person => ({
    ...person,
    position: [center[0] + person.offset[0], center[1] + person.offset[1]],
  })), [center])

  const visiblePeople = people.filter(person =>
    person.name.toLowerCase().includes(search.toLowerCase()) ||
    person.interests.some(i => i.toLowerCase().includes(search.toLowerCase()))
  )

  const getLocation = () => {
    if (!navigator.geolocation) {
      setLocationState('error')
      return
    }
    setLocationState('loading')
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setCenter([coords.latitude, coords.longitude])
        setLocationState('ready')
      },
      () => setLocationState('error'),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 120000 },
    )
  }

  useEffect(() => { getLocation() }, [])

  const requestConnection = person => {
    if (!requests.includes(person.id) && !connections.includes(person.id)) {
      setRequests(prev => [...prev, person.id])
    }
  }

  const openChat = person => {
    setChatWith(person)
    setSelected(null)
  }

  const sendMessage = event => {
    event.preventDefault()
    if (!messageText.trim() || !chatWith) return
    const item = { id: Date.now(), mine: true, text: messageText.trim(), time: 'Now' }
    setMessages(prev => ({ ...prev, [chatWith.id]: [...(prev[chatWith.id] || []), item] }))
    setMessageText('')
  }

  const connectedPeople = people.filter(person => connections.includes(person.id))

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Logo />
        <nav>
          <button className={screen === 'map' ? 'nav-item active' : 'nav-item'} onClick={() => setScreen('map')}><MapIcon size={20} /><span>Discover</span></button>
          <button className={screen === 'people' ? 'nav-item active' : 'nav-item'} onClick={() => setScreen('people')}><Users size={20} /><span>Connections</span><em>{connectedPeople.length}</em></button>
          <button className={screen === 'messages' ? 'nav-item active' : 'nav-item'} onClick={() => setScreen('messages')}><MessageCircle size={20} /><span>Messages</span></button>
          <button className="nav-item"><Bell size={20} /><span>Activity</span><i /></button>
        </nav>
        <div className="sidebar-bottom">
          <button className="nav-item" onClick={() => setPrivacyOpen(true)}><ShieldCheck size={20} /><span>Privacy</span></button>
          <button className="nav-item"><Settings size={20} /><span>Settings</span></button>
          <div className="mini-profile">
            <div className="avatar own">R</div>
            <div><strong>Rishi</strong><span>{discoverable ? 'Visible on Closeby' : 'Invisible'}</span></div>
            <MoreHorizontal size={18} />
          </div>
        </div>
      </aside>

      <main className="main-area">
        {screen === 'map' && (
          <>
            <header className="topbar map-topbar">
              <div>
                <div className="eyebrow"><span className="live-dot" /> LIVE AROUND YOU</div>
                <h1>See who’s close.</h1>
              </div>
              <div className="top-actions">
                <div className="search-box"><Search size={17} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search people or interests" />{search && <button onClick={() => setSearch('')}><X size={15} /></button>}</div>
                <button className={discoverable ? 'visibility-pill active' : 'visibility-pill'} onClick={() => setDiscoverable(v => !v)}>{discoverable ? <Eye size={16} /> : <EyeOff size={16} />}{discoverable ? 'Visible' : 'Hidden'}</button>
              </div>
            </header>

            <section className="map-stage">
              <MapContainer center={center} zoom={14} zoomControl={false} attributionControl={false}>
                <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
                <Recenter center={center} />
                <Circle center={center} radius={1800} pathOptions={{ color: '#7b5cff', weight: 1, opacity: .22, fillColor: '#7b5cff', fillOpacity: .035 }} />
                <Marker position={center} icon={selfIcon()} />
                {visiblePeople.map(person => (
                  <Marker key={person.id} position={person.position} icon={personIcon(person, selected?.id === person.id)} eventHandlers={{ click: () => setSelected(person) }} />
                ))}
              </MapContainer>

              <div className="map-gradient" />
              <div className="map-status glass"><Sparkles size={16} /><strong>{visiblePeople.length}</strong> people are active around you</div>
              <div className="map-controls glass">
                <button onClick={getLocation} title="Recenter"><LocateFixed size={19} /></button>
                <div />
                <button title="Explore"><Compass size={19} /></button>
              </div>
              {locationState === 'error' && <div className="location-note">Location permission is off — showing the demo area. <button onClick={getLocation}>Try again</button></div>}

              <div className="nearby-strip">
                <div className="nearby-heading"><span>Nearby now</span><button onClick={() => setScreen('people')}>See connections</button></div>
                <div className="nearby-cards">
                  {visiblePeople.slice(0, 5).map(person => (
                    <button className="nearby-card" key={person.id} onClick={() => setSelected(person)}>
                      <div className={`avatar ${person.tone}`}>{person.initials}<i /></div>
                      <div><strong>{person.name}</strong><span>{person.intent}</span></div>
                      <small>{Math.max(0.4, Math.abs(person.offset[0] + person.offset[1]) * 55).toFixed(1)} km</small>
                    </button>
                  ))}
                </div>
              </div>
            </section>
          </>
        )}

        {screen === 'people' && (
          <section className="content-screen">
            <header className="topbar"><div><div className="eyebrow">YOUR PEOPLE</div><h1>Connections</h1><p>People you’ve connected with on Closeby.</p></div></header>
            <div className="content-grid">
              <div className="panel connections-panel">
                <div className="section-title"><h2>Friends & connections</h2><span>{connectedPeople.length}</span></div>
                {connectedPeople.map(person => (
                  <div className="connection-row" key={person.id}>
                    <div className={`avatar ${person.tone}`}>{person.initials}<i /></div>
                    <div className="connection-copy"><strong>{person.name}</strong><span>{person.interests.join(' · ')}</span></div>
                    <button onClick={() => openChat(person)}><MessageCircle size={18} /></button>
                    <button><Phone size={18} /></button>
                    <button><Video size={18} /></button>
                  </div>
                ))}
              </div>
              <div className="panel invite-panel"><div className="invite-icon"><UserPlus /></div><h3>Grow your circle</h3><p>Explore the map to discover people nearby who are open to connecting.</p><button className="primary-btn" onClick={() => setScreen('map')}>Explore nearby</button></div>
            </div>
          </section>
        )}

        {screen === 'messages' && (
          <section className="content-screen messages-screen">
            <header className="topbar"><div><div className="eyebrow">STAY CLOSE</div><h1>Messages</h1><p>Continue conversations with your connections.</p></div></header>
            <div className="message-list panel">
              {connectedPeople.map(person => {
                const last = (messages[person.id] || []).at(-1)
                return <button key={person.id} className="message-row" onClick={() => openChat(person)}><div className={`avatar ${person.tone}`}>{person.initials}<i /></div><div><strong>{person.name}</strong><span>{last?.text || 'Start a conversation'}</span></div><small>{last?.time || ''}</small></button>
              })}
            </div>
          </section>
        )}
      </main>

      {selected && (
        <div className="profile-sheet glass-heavy">
          <div className="sheet-handle" />
          <button className="close-sheet" onClick={() => setSelected(null)}><X size={18} /></button>
          <div className={`profile-avatar ${selected.tone}`}>{selected.initials}<span className="online-badge"><i /> Active now</span></div>
          <h2>{selected.name}, {selected.age}</h2>
          <p className="profile-intent">{selected.intent} · nearby</p>
          <p className="profile-bio">{selected.bio}</p>
          <div className="chips">{selected.interests.map(i => <span key={i}>{i}</span>)}</div>
          {selected.mutual > 0 && <div className="mutual"><Users size={16} /> {selected.mutual} mutual connection{selected.mutual > 1 ? 's' : ''}</div>}
          {connections.includes(selected.id) ? (
            <div className="profile-actions connected-actions"><button className="primary-btn" onClick={() => openChat(selected)}><MessageCircle size={18} /> Message</button><button className="icon-btn"><Phone size={18} /></button><button className="icon-btn"><Video size={18} /></button></div>
          ) : requests.includes(selected.id) ? (
            <button className="primary-btn requested" disabled><Check size={18} /> Request sent</button>
          ) : (
            <button className="primary-btn" onClick={() => requestConnection(selected)}><UserPlus size={18} /> Connect</button>
          )}
          <div className="privacy-hint"><ShieldCheck size={15} /><span>Closeby never shows another person’s exact location.</span></div>
        </div>
      )}

      {chatWith && (
        <div className="chat-panel glass-heavy">
          <header><button onClick={() => setChatWith(null)}><ChevronLeft size={20} /></button><div className={`avatar ${chatWith.tone}`}>{chatWith.initials}<i /></div><div><strong>{chatWith.name}</strong><span>Active now</span></div><button><Phone size={18} /></button><button><Video size={18} /></button></header>
          <div className="chat-body">
            <div className="chat-date">Today</div>
            {(messages[chatWith.id] || []).map(msg => <div key={msg.id} className={msg.mine ? 'bubble mine' : 'bubble'}><p>{msg.text}</p><span>{msg.time}</span></div>)}
          </div>
          <form className="composer" onSubmit={sendMessage}><input value={messageText} onChange={e => setMessageText(e.target.value)} placeholder={`Message ${chatWith.name}`} /><button type="submit"><Send size={18} /></button></form>
        </div>
      )}

      {privacyOpen && (
        <div className="modal-backdrop" onMouseDown={() => setPrivacyOpen(false)}>
          <div className="privacy-modal" onMouseDown={e => e.stopPropagation()}>
            <div className="modal-icon"><ShieldCheck /></div><button className="modal-x" onClick={() => setPrivacyOpen(false)}><X size={18} /></button>
            <h2>Your presence, your choice.</h2><p>Closeby is designed around approximate discovery—not precise tracking.</p>
            <div className="privacy-option"><div><Eye size={19} /><span><strong>Discoverable</strong><small>Let active people around you see your approximate presence.</small></span></div><button className={discoverable ? 'switch on' : 'switch'} onClick={() => setDiscoverable(v => !v)}><span /></button></div>
            <div className="privacy-point"><Check size={16} /><span>Exact coordinates are never shown to other people.</span></div>
            <div className="privacy-point"><Check size={16} /><span>Only accepted connections can message or call you.</span></div>
            <div className="privacy-point"><Check size={16} /><span>You can disappear from discovery at any time.</span></div>
            <button className="primary-btn modal-done" onClick={() => setPrivacyOpen(false)}>Done</button>
          </div>
        </div>
      )}

      <nav className="mobile-nav">
        <button className={screen === 'map' ? 'active' : ''} onClick={() => setScreen('map')}><MapIcon /><span>Discover</span></button>
        <button className={screen === 'people' ? 'active' : ''} onClick={() => setScreen('people')}><Users /><span>People</span></button>
        <button className={screen === 'messages' ? 'active' : ''} onClick={() => setScreen('messages')}><MessageCircle /><span>Chats</span></button>
        <button onClick={() => setPrivacyOpen(true)}><ShieldCheck /><span>Privacy</span></button>
      </nav>
    </div>
  )
}

export default App
