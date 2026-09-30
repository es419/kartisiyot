import { HashRouter, Routes, Route, Outlet } from 'react-router-dom'
import TabBar from './components/TabBar'
import { AuthProvider, useAuth } from './auth'
import AuthPage from './pages/AuthPage'
import Library from './pages/Library'
import SetPage from './pages/SetPage'
import SetEditor, { NewSet } from './pages/SetEditor'
import Flashcards from './pages/Flashcards'
import Learn from './pages/Learn'
import Test from './pages/Test'
import Match from './pages/Match'
import Gravity from './pages/Gravity'
import Review from './pages/Review'
import Journal from './pages/Journal'
import Stats from './pages/Stats'
import SharedSet from './pages/SharedSet'
import Listen from './pages/Listen'
import { Splash } from './components/Logo'

function Protected() {
  const { session, loading } = useAuth()
  if (loading) return <Splash />
  if (!session) return <AuthPage />
  return <Outlet />
}

function Layout() {
  return (
    <>
      <Outlet />
      <TabBar />
    </>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route path="/s/:id" element={<SharedSet />} />
          <Route element={<Protected />}>
            <Route element={<Layout />}>
              <Route path="/" element={<Library />} />
              <Route path="/review" element={<Review />} />
              <Route path="/journal" element={<Journal />} />
              <Route path="/stats" element={<Stats />} />
            </Route>
            <Route path="/set/new" element={<NewSet />} />
            <Route path="/set/:id" element={<SetPage />} />
            <Route path="/set/:id/edit" element={<SetEditor />} />
            <Route path="/set/:id/flashcards" element={<Flashcards />} />
            <Route path="/set/:id/learn" element={<Learn mode="learn" />} />
            <Route path="/set/:id/write" element={<Learn mode="write" />} />
            <Route path="/set/:id/test" element={<Test />} />
            <Route path="/set/:id/match" element={<Match />} />
            <Route path="/set/:id/gravity" element={<Gravity />} />
            <Route path="/set/:id/listen" element={<Listen />} />
          </Route>
        </Routes>
      </HashRouter>
    </AuthProvider>
  )
}
