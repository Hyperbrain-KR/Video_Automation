import '../lib/loginError.js'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './storyboard.css'
import { AuthProvider } from '../lib/AuthContext.jsx'
import StoryboardApp from './StoryboardApp.jsx'

try {
  document.documentElement.dataset.theme = localStorage.getItem('canvas-theme') ?? 'dark'
} catch {
  document.documentElement.dataset.theme = 'dark'
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <StoryboardApp />
    </AuthProvider>
  </StrictMode>,
)
