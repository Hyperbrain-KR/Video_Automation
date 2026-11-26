import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import BoardList from './BoardList'
import BoardView from './BoardView'
import { boardFromUrl } from './nav'
import UpdateNotice from './UpdateNotice'

function Login({ denied }) {
  const login = () => supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.href },
  })
  return (
    <div className="sb-login">
      <img src="/logo-square.png" alt="" width="48" height="48" />
      <h1>Storyboard</h1>
      <p>팀 스토리보드는 허용된 계정으로 로그인해야 볼 수 있습니다.</p>
      {denied && <div className="sb-alert">접근이 허용되지 않은 계정입니다.</div>}
      <button className="sb-btn sb-btn-primary" onClick={login}>Google로 로그인</button>
    </div>
  )
}

export default function StoryboardApp() {
  const { user, denied } = useAuth()
  const [boardId, setBoardId] = useState(boardFromUrl)

  useEffect(() => {
    const sync = () => setBoardId(boardFromUrl())
    window.addEventListener('popstate', sync)
    return () => window.removeEventListener('popstate', sync)
  }, [])

  if (user === undefined) return <div className="sb-center">불러오는 중…</div>
  if (!user) return <Login denied={denied} />
  return (
    <>
      {boardId ? <BoardView key={boardId} boardId={boardId} user={user} /> : <BoardList user={user} />}
      <UpdateNotice />
    </>
  )
}
