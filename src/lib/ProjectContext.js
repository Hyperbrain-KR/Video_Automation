import { createContext, useContext } from 'react'

export const ProjectContext = createContext(null)

export const useProjectId = () => useContext(ProjectContext)
