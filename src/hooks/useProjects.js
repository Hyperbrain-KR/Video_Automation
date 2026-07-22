import { useState, useCallback, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const KEY_ACTIVE = 'canvas-active-project'
const genId = () => `proj_${Date.now()}`

export function getActiveProjectId() {
  return localStorage.getItem(KEY_ACTIVE) || null
}

// 더 이상 사용 안 함 — 데이터는 Supabase에서 비동기 로드
export function loadSavedProject() { return null }

export function useProjects(user) {
  const [projects, setProjects] = useState([])
  const [activeId, setActiveId] = useState(() => localStorage.getItem(KEY_ACTIVE))
  const [loading, setLoading] = useState(true)

  const _setActive = (id) => {
    if (id) localStorage.setItem(KEY_ACTIVE, id)
    else localStorage.removeItem(KEY_ACTIVE)
    setActiveId(id)
  }

  useEffect(() => {
    if (!user) return
    supabase.from('projects')
      .select('id, name, updated_at')
      .order('updated_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) console.error('[projects] 로드 실패:', error)
        if (data) setProjects(data.map(p => ({ id: p.id, name: p.name, updatedAt: p.updated_at })))
        setLoading(false)
      })
      .catch(err => {
        console.error('[projects] 쿼리 실패:', err)
        setLoading(false)
      })
  }, [user])

  const loadProject = useCallback(async (id) => {
    if (!id) return null
    const { data, error } = await supabase.from('projects')
      .select('nodes, edges, characters')
      .eq('id', id)
      .single()
    if (error) { console.error('[loadProject]', error); return null }
    return data
  }, [])

  const saveProject = useCallback(async (id, nodes, edges, characters) => {
    if (!id || !user) return
    const { error } = await supabase.from('projects').upsert({
      id, user_id: user.id, nodes, edges, characters,
      updated_at: new Date().toISOString(),
    })
    if (error) { console.error('[saveProject]', error); throw error }
    setProjects(prev => prev.map(p =>
      p.id === id ? { ...p, updatedAt: new Date().toISOString() } : p
    ))
  }, [user])

  const createProject = useCallback(async (name, nodes, edges, characters) => {
    if (!user) return null
    const id = genId()
    const { error } = await supabase.from('projects').insert({
      id, user_id: user.id, name, nodes, edges, characters,
    })
    if (error) { console.error('[createProject]', error); return null }
    setProjects(prev => [{ id, name, updatedAt: new Date().toISOString() }, ...prev])
    _setActive(id)
    return id
  }, [user])

  const switchProject = useCallback(async (id) => {
    _setActive(id)
    return loadProject(id)
  }, [loadProject])

  const deleteProject = useCallback(async (id) => {
    const { error } = await supabase.from('projects').delete().eq('id', id)
    if (error) console.error('[deleteProject]', error)
    const list = projects.filter(p => p.id !== id)
    setProjects(list)
    return list
  }, [projects])

  const renameProject = useCallback(async (id, name) => {
    await supabase.from('projects').update({ name }).eq('id', id)
    setProjects(prev => prev.map(p => p.id === id ? { ...p, name } : p))
  }, [])

  const activeProject = projects.find(p => p.id === activeId) ?? null

  return {
    projects, activeId, activeProject, loading,
    loadProject, saveProject, createProject, switchProject, deleteProject, renameProject,
  }
}
