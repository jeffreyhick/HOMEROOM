import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useSession } from '@/lib/auth'
import { ToastProvider } from '@/components/UndoToast'
import { LoginPage } from '@/pages/LoginPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { SettingsPage } from '@/pages/SettingsPage'

function App() {
  const { session, loading } = useSession()

  if (loading) return null
  // Dev-only render harness: lets the dashboard shell be inspected without a magic link.
  // `import.meta.env.DEV` is statically false in a production build, so Vite strips the
  // whole branch — the deployed app can never skip the gate. RLS is the real boundary.
  const qaBypass = import.meta.env.DEV && import.meta.env.VITE_QA_BYPASS_AUTH
  if (!session && !qaBypass) return <LoginPage />

  return (
    <BrowserRouter>
      <ToastProvider>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  )
}

export default App
