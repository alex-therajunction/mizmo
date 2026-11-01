import {
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  createIdentity as makeIdentity,
  forgetIdentity,
  importIdentity as readIdentity,
  loadIdentity,
  persistIdentity,
  type Identity,
} from '../lib/identity'
import { IdentityContext } from './identityContext'

export function IdentityProvider({ children }: { children: ReactNode }) {
  const [identity, setIdentity] = useState<Identity | null>(() => loadIdentity())

  const createIdentity = useCallback(() => {
    const next = makeIdentity()
    persistIdentity(next)
    setIdentity(next)
    return next
  }, [])

  const importIdentity = useCallback((value: string) => {
    const next = readIdentity(value)
    persistIdentity(next)
    setIdentity(next)
    return next
  }, [])

  const signOut = useCallback(() => {
    forgetIdentity()
    setIdentity(null)
  }, [])

  const value = useMemo(
    () => ({ identity, createIdentity, importIdentity, signOut }),
    [createIdentity, identity, importIdentity, signOut],
  )

  return (
    <IdentityContext.Provider value={value}>
      {children}
    </IdentityContext.Provider>
  )
}
