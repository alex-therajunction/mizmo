import { useEffect, useState } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { AuthPanel } from './components/AuthPanel'
import { Modal } from './components/Modal'
import { HomePage } from './pages/HomePage'
import { ImportPage } from './pages/ImportPage'
import { ProfilePage } from './pages/ProfilePage'

function ScrollToTop() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname])

  return null
}

function App() {
  const [authOpen, setAuthOpen] = useState(false)

  return (
    <>
      <ScrollToTop />
      <AppShell onOpenAuth={() => setAuthOpen(true)}>
        <Routes>
          <Route element={<HomePage />} path="/" />
          <Route element={<ImportPage />} path="/import" />
          <Route
            element={<ProfilePage onOpenAuth={() => setAuthOpen(true)} />}
            path="/:id"
          />
          <Route
            element={
              <ProfilePage onOpenAuth={() => setAuthOpen(true)} />
            }
            path="*"
          />
        </Routes>
      </AppShell>

      <Modal
        eyebrow="Your keys, your browser"
        onClose={() => setAuthOpen(false)}
        open={authOpen}
        title="Sign in to miZmo"
      >
        <AuthPanel
          compact
          onAuthenticated={() => setAuthOpen(false)}
        />
      </Modal>
    </>
  )
}

export default App
