import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline, CircularProgress, Box } from '@mui/material';
import { theme } from './theme';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { CollectionReportPage } from './pages/CollectionReportPage';
import { AccountCodesPage } from './pages/AccountCodesPage';
import { ReportsPage } from './pages/ReportsPage';
import { SignatoriesPage } from './pages/SignatoriesPage';
import { RPTCollectionPage } from './pages/RPTCollectionPage';
import { SettingsPage } from './pages/SettingsPage';
import { Layout } from './components/Layout';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/useAuth';

// Protected Route Component
const ProtectedRoute = ({ children }: { children: React.ReactElement }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

// Public Route (redirects to dashboard if already logged in)
const PublicRoute = ({ children }: { children: React.ReactElement }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={
        <PublicRoute>
          <LoginPage />
        </PublicRoute>
      } />
      
      {/* Protected Routes wrapped in Layout */}
      <Route element={
        <ProtectedRoute>
          <Layout />
        </ProtectedRoute>
      }>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/collection" element={<CollectionReportPage />} />
        <Route path="/account-codes" element={<AccountCodesPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/signatories" element={<SignatoriesPage />} />
        <Route path="/rpt-collection" element={<RPTCollectionPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <Router>
          <AppRoutes />
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
