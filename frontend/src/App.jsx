import { Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from './components/Layout'
import LandingPage from './pages/LandingPage'
import ConcisenessPage from './pages/ConcisenessPage'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<LandingPage />} />
        <Route path="conciseness" element={<ConcisenessPage />} />
        {/* Catch-all redirects to landing */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
