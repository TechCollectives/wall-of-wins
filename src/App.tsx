import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { ErrorBoundary } from './components/ErrorBoundary'
import { PostPage } from './pages/PostPage'
import { WallPage } from './pages/WallPage'

function Home() {
  return (
    <main className="phone center">
      <h1>TIQC Sticky Wall</h1>
      <p>Scan the QR code on the wall to add your sticky.</p>
    </main>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/e/:slug" element={<PostPage />} />
          <Route path="/e/:slug/wall" element={<WallPage />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
