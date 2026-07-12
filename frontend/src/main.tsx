import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// A deploy replaces the hashed chunks; a tab opened before it will fail to
// lazy-load routes ("Failed to fetch dynamically imported module"). Reload
// once to pick up the new index.html; the guard prevents a reload loop.
window.addEventListener('vite:preloadError', (e) => {
  const KEY = 'chunk-reload-at'
  const last = Number(sessionStorage.getItem(KEY) ?? 0)
  if (Date.now() - last > 30_000) {
    e.preventDefault()
    sessionStorage.setItem(KEY, String(Date.now()))
    window.location.reload()
  }
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
