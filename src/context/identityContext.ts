import { createContext } from 'react'
import type { Identity } from '../lib/identity'

export type IdentityContextValue = {
  identity: Identity | null
  createIdentity: () => Identity
  importIdentity: (value: string) => Identity
  signOut: () => void
}

export const IdentityContext = createContext<IdentityContextValue | null>(null)
