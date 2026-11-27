import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { apiFetch } from './config'

const AuthContext = createContext(null)

// 허용 목록은 서버(Railway ALLOWED_EMAILS) 한 곳에서만 관리한다.
// 예전에는 VITE_ALLOWED_EMAILS 를 화면 코드에 넣었는데, 목록이 둘로 갈라지고 이메일이 공개 코드에 노출돼 쓰지 않는다.
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

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext)
