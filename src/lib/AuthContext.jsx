import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { apiFetch } from './config'

const AuthContext = createContext(null)

async function checkEmailAllowed(email) {
  try {
    const res = await apiFetch('/api/auth/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    const data = await res.json()
    return data.allowed === true
  } catch {
    return false
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined) // undefined = 로딩중, null = 비로그인
  const [denied, setDenied] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const allowed = await checkEmailAllowed(session.user.email)
        if (!allowed) {
          await supabase.auth.signOut()
          setDenied(true)
          setUser(null)
        } else {
          setDenied(false)
          setUser(session.user)
        }
      } else {
        setUser(null)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const allowed = await checkEmailAllowed(session.user.email)
        if (!allowed) {
          await supabase.auth.signOut()
          setDenied(true)
          setUser(null)
        } else {
          setDenied(false)
          setUser(session.user)
        }
      } else {
        setUser(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <AuthContext.Provider value={{ user, denied }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
