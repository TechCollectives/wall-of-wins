import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Handwriting fonts ship with the app, not from Google (eng review D10). Latin subset, one weight each.
import '@fontsource/caveat/latin-700.css'
import '@fontsource/patrick-hand/latin-400.css'
import '@fontsource/kalam/latin-700.css'
import '@fontsource/gochi-hand/latin-400.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
