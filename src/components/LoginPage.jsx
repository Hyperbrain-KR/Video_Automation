import { supabase } from '../lib/supabase'

export default function LoginPage() {
  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
  }

  return (
    <div style={{
      width: '100vw', height: '100vh',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: '#0A0A0F', gap: 32,
    }}>
      <div style={{ textAlign: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: '#F4F4F4', letterSpacing: '-0.02em' }}>
          Canvas
        </div>
        <div style={{ fontSize: 13, color: 'rgba(244,244,244,0.4)', marginTop: 6 }}>
          AI 콘텐츠 생성 파이프라인
        </div>
      </div>

      <button
        onClick={handleGoogleLogin}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 24px', borderRadius: 10,
          border: '1px solid rgba(255,255,255,0.12)',
          background: 'rgba(255,255,255,0.05)',
          color: '#F4F4F4', fontSize: 14, fontWeight: 600,
          cursor: 'pointer',
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
        onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
      >
        <svg width="18" height="18" viewBox="0 0 48 48">
          <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.6 33.1 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.7 1.1 7.8 2.9l5.7-5.7C34.1 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 19.6-8 19.6-20 0-1.3-.1-2.7-.4-4z"/>
          <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 15.1 18.9 12 24 12c3 0 5.7 1.1 7.8 2.9l5.7-5.7C34.1 6.5 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
          <path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.9 13.5-5l-6.2-5.2C29.4 35.5 26.8 36 24 36c-5.2 0-9.6-2.9-11.3-7.1l-6.6 4.8C9.8 39.8 16.4 44 24 44z"/>
          <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.8 2.3-2.3 4.2-4.2 5.6l6.2 5.2C41 35.2 44 30 44 24c0-1.3-.1-2.7-.4-4z"/>
        </svg>
        Google로 로그인
      </button>
    </div>
  )
}
