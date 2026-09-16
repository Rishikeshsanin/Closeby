import React from 'react'
import ReactDOM from 'react-dom/client'
import 'leaflet/dist/leaflet.css'
import './styles.css'
import App from './App'
import LiveApp from './LiveApp'

const livePreview = new URLSearchParams(window.location.search).get('live') === '1'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {livePreview ? <LiveApp /> : <App />}
  </React.StrictMode>,
)
