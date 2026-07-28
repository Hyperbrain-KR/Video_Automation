import { useEffect, useRef, useState } from 'react'
import { CANVAS_API } from '../lib/config'

const POLL_INTERVAL = 60 * 1000

export function useVersionCheck() {
  const [hasUpdate, setHasUpdate] = useState(false)
  const [changelog, setChangelog] = useState([])
  const baseStartTime = useRef(null)

  useEffect(() => {
    async function check() {
      try {
        const res = await fetch(`${CANVAS_API}/api/version`)
        if (!res.ok) return
        const data = await res.json()
        if (!baseStartTime.current) {
          baseStartTime.current = data.startTime
          setChangelog(data.changelog ?? [])
          return
        }
        if (data.startTime !== baseStartTime.current) {
          setChangelog(data.changelog ?? [])
          setHasUpdate(true)
        }
      } catch {}
    }

    check()
    const id = setInterval(check, POLL_INTERVAL)
    return () => clearInterval(id)
  }, [])

  return { hasUpdate, changelog }
}
