import { useState, useCallback } from 'react'

const KEY_LIST   = 'canvas-projects'
const KEY_ACTIVE = 'canvas-active-project'
const dataKey    = id => `canvas-project-data-${id}`
const genId      = () => `proj_${Date.now()}`

function readList() {
  try { return JSON.parse(localStorage.getItem(KEY_LIST) || '[]') } catch { return [] }
}

export function loadSavedProject(id) {
  if (!id) return null
  try { return JSON.parse(localStorage.getItem(dataKey(id)) || 'null') } catch { return null }
}

export function getActiveProjectId() {
  return localStorage.getItem(KEY_ACTIVE) || null
}

export function useProjects() {
  const [projects, setProjects] = useState(readList)
  const [activeId, setActiveId] = useState(getActiveProjectId)

  const _setActive = (id) => {
    if (id) localStorage.setItem(KEY_ACTIVE, id)
    else localStorage.removeItem(KEY_ACTIVE)
    setActiveId(id)
  }

  const _saveList = (list) => {
    localStorage.setItem(KEY_LIST, JSON.stringify(list))
    setProjects(list)
  }

  const saveProject = useCallback((id, nodes, edges, characters) => {
    if (!id) return
    localStorage.setItem(dataKey(id), JSON.stringify({ nodes, edges, characters }))
    _saveList(readList().map(p =>
      p.id === id ? { ...p, updatedAt: new Date().toISOString() } : p
    ))
  }, [])

  const createProject = useCallback((name, nodes, edges, characters) => {
    const id = genId()
    localStorage.setItem(dataKey(id), JSON.stringify({ nodes, edges, characters }))
    _saveList([...readList(), { id, name, updatedAt: new Date().toISOString() }])
    _setActive(id)
    return id
  }, [])

  const switchProject = useCallback((id) => {
    _setActive(id)
    return loadSavedProject(id)
  }, [])

  const deleteProject = useCallback((id) => {
    localStorage.removeItem(dataKey(id))
    const list = readList().filter(p => p.id !== id)
    _saveList(list)
    return list
  }, [])

  const renameProject = useCallback((id, name) => {
    _saveList(readList().map(p => p.id === id ? { ...p, name } : p))
  }, [])

  const activeProject = projects.find(p => p.id === activeId) ?? null

  return {
    projects, activeId, activeProject,
    saveProject, createProject, switchProject, deleteProject, renameProject,
  }
}
