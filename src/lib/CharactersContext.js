import { createContext } from 'react'

export const CharactersContext = createContext({
  characters: [],
  saveCharacter: () => {},
  deleteCharacter: () => {},
})
