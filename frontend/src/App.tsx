import { Routes, Route, Navigate } from 'react-router-dom'
import { SignedIn, SignedOut, SignIn, useClerk } from '@clerk/clerk-react'
import { ChakraProvider, Flex, Box } from '@chakra-ui/react'
import { system } from './theme'
import TopNav from './components/Layout/TopNav.tsx'
import ProtectedRoute from './components/Auth/ProtectedRoute.tsx'
import ErrorBoundary from './components/ErrorBoundary.tsx'
import ChatView from './views/ChatView.tsx'
import MetricTreeView from './views/MetricTreeView.tsx'
import ProcessMapView from './views/ProcessMapView.tsx'
import DashboardPage from './views/DashboardPage.tsx'
import DashboardIndex from './views/DashboardIndex.tsx'
import NotAuthorized from './views/NotAuthorized.tsx'

function App() {
  const { loaded } = useClerk()

  if (!loaded) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#6b7280' }}>
        Loading...
      </div>
    )
  }

  return (
    <ChakraProvider value={system}>
      <SignedOut>
        <Flex justify="center" align="center" h="100vh">
          <SignIn routing="hash" />
        </Flex>
      </SignedOut>
      <SignedIn>
        <Flex direction="column" h="100vh" fontFamily="body" bg="bg.page">
          <TopNav />
          <Box flex="1" overflow="hidden">
            <Routes>
              <Route path="/" element={<ProtectedRoute><ErrorBoundary><ChatView /></ErrorBoundary></ProtectedRoute>} />
              <Route path="/metric-tree" element={<ProtectedRoute><ErrorBoundary><MetricTreeView /></ErrorBoundary></ProtectedRoute>} />
              <Route path="/process-map" element={<ProtectedRoute><ErrorBoundary><ProcessMapView /></ErrorBoundary></ProtectedRoute>} />
              <Route path="/dashboards" element={<ProtectedRoute><ErrorBoundary><DashboardIndex /></ErrorBoundary></ProtectedRoute>} />
              <Route path="/dashboards/:slug" element={<ProtectedRoute><ErrorBoundary><DashboardPage /></ErrorBoundary></ProtectedRoute>} />
              <Route path="/not-authorized" element={<NotAuthorized />} />
              <Route path="*" element={<Navigate to="/dashboards" replace />} />
            </Routes>
          </Box>
        </Flex>
      </SignedIn>
    </ChakraProvider>
  )
}

export default App
