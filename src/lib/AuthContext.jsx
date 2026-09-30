import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { apiFetch } from './config'

const AuthContext = createContext(null)

// VITE_ALLOWED_EMAILS가 설정되면 서버 없이 프론트에서 직접 체크
const LOCAL_ALLOWED = import.meta.env.VITE_ALLOWED_EMAILS
  ? import.meta.env.VITE_ALLOWED_EMAILS.split(',').map(e => e.trim().toLowerCase())
  : []

async function checkEmailAllowed(email) {
  const lowerEmail = email?.toLowerCase()
  // 로컬 허용 목록이 있으면 서버 없이 즉시 판단
  if (LOCAL_ALLOWED.length > 0) {
    return LOCAL_ALLOWED.includes(lowerEmail)
  }
  // 서버 체크 (Railway 등 배포 환경에서 VITE_ALLOWED_EMAILS 미설정 시)
  try {
    const res = await apiFetch('/api/auth/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    const data = await res.json()
    return data.allowed === true
  } catch {
    // 서버 응답 없으면 허용 (Google OAuth 인증 자체가 1차 게이트)
    return true
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
