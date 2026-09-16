import React from 'react'
import ReactDOM from 'react-dom/client'
import 'leaflet/dist/leaflet.css'
import './styles.css'
import App from './App'
import LiveAppV2 from './LiveAppV2'

const demoMode = new URLSearchParams(window.location.search).get('demo') === '1'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {demoMode ? <App /> : <LiveAppV2 />}
  </React.StrictMode>,
)
