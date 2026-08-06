import { createContext } from 'react'

export const AssetsContext = createContext({
  assets: [],
  saveAsset: () => {},
  deleteAsset: () => {},
})
