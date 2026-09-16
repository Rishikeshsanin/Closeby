import React from 'react'
import ReactDOM from 'react-dom/client'
import 'leaflet/dist/leaflet.css'
import './styles.css'
import App from './App'
import LiveAppV2 from './LiveAppV2'

const demoMode = new URLSearchParams(window.location.search).get('demo') === '1'

// Some desktop browsers scroll the entire document when the chat's bottom
// sentinel calls scrollIntoView(). Keep that scroll contained inside chat.
if (typeof Element !== 'undefined' && !window.__closebyChatScrollGuard) {
  window.__closebyChatScrollGuard = true
  const nativeScrollIntoView = Element.prototype.scrollIntoView
  Element.prototype.scrollIntoView = function scrollIntoView(options) {
    const chatBody = this?.closest?.('.cb2-chat-body')
    if (chatBody) {
      const behavior = typeof options === 'object' && options?.behavior === 'smooth' ? 'smooth' : 'auto'
      if (typeof chatBody.scrollTo === 'function') {
        chatBody.scrollTo({ top: chatBody.scrollHeight, behavior })
      } else {
        chatBody.scrollTop = chatBody.scrollHeight
      }
      return
    }
    if (typeof nativeScrollIntoView === 'function') {
      return nativeScrollIntoView.call(this, options)
    }
  }
}

class ClosebyErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Closeby client render error:', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <main style={{ minHeight: '100dvh', background: '#07070a', color: '#f7f6fa', display: 'grid', placeItems: 'center', padding: 24, fontFamily: 'DM Sans, system-ui, sans-serif' }}>
        <section style={{ width: 'min(460px, 100%)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 18, background: '#101014', padding: 28, boxShadow: '0 30px 80px rgba(0,0,0,.35)' }}>
          <div style={{ fontSize: 13, letterSpacing: '.08em', color: '#9b8dff', fontWeight: 800 }}>CLOSEBY</div>
          <h1 style={{ margin: '10px 0 8px', fontSize: 26 }}>Something in this view crashed.</h1>
          <p style={{ margin: 0, color: '#96929f', lineHeight: 1.55, fontSize: 13 }}>Your account and messages are safe. Reload Closeby to recover this screen.</p>
          <button onClick={() => window.location.reload()} style={{ marginTop: 20, minHeight: 42, border: 0, borderRadius: 10, padding: '0 16px', color: 'white', background: '#8068ff', fontWeight: 700, cursor: 'pointer' }}>Reload Closeby</button>
        </section>
      </main>
    )
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ClosebyErrorBoundary>
      {demoMode ? <App /> : <LiveAppV2 />}
    </ClosebyErrorBoundary>
  </React.StrictMode>,
)
