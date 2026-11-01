import { useContext } from 'react'
import { IdentityContext, type IdentityContextValue } from './identityContext'

export function useIdentity(): IdentityContextValue {
  const context = useContext(IdentityContext)

  if (!context) {
    throw new Error('useIdentity must be used inside IdentityProvider.')
  }

  return context
}
