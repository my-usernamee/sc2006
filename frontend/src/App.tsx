/**
 * The routes of the application. Each route matches one state in the Lab 2
 * dialog map, so the two can be read side by side.
 */
import { AnimatePresence } from 'framer-motion';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { Layout } from './components/Layout';
import { PageTransition } from './components/motion';
import { Loading } from './components/ui';
import { AccountPage } from './pages/AccountPage';
import { BrowsePage } from './pages/BrowsePage';
import { ClaimDetailPage } from './pages/ClaimDetailPage';
import { ClaimsPage } from './pages/ClaimsPage';
import { FoundReportDetailPage } from './pages/FoundReportDetailPage';
import { FoundReportFormPage } from './pages/FoundReportFormPage';
import { LoginPage } from './pages/LoginPage';
import { LostReportDetailPage } from './pages/LostReportDetailPage';
import { LostReportFormPage } from './pages/LostReportFormPage';
import { MyFoundReportDetailPage } from './pages/MyFoundReportDetailPage';
import { MyFoundReportsPage } from './pages/MyFoundReportsPage';
import { MyLostReportsPage } from './pages/MyLostReportsPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { RegisterPage } from './pages/RegisterPage';

export function App() {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Wait until we know whether the saved token is still valid, otherwise the
  // user would be bounced to the login page on every refresh.
  if (loading) return <Loading />;

  // Not logged in: only the login and register screens are reachable.
  if (!user) {
    return (
      // AnimatePresence keeps the outgoing page mounted just long enough to
      // play its exit animation. `mode="wait"` means the old page finishes
      // leaving before the new one arrives, so they never overlap.
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/login" element={<PageTransition><LoginPage /></PageTransition>} />
          <Route path="/register" element={<PageTransition><RegisterPage /></PageTransition>} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AnimatePresence>
    );
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/browse" element={<BrowsePage />} />
        <Route path="/browse/:id" element={<FoundReportDetailPage />} />

        <Route path="/lost" element={<MyLostReportsPage />} />
        <Route path="/lost/new" element={<LostReportFormPage />} />
        <Route path="/lost/:id" element={<LostReportDetailPage />} />
        <Route path="/lost/:id/edit" element={<LostReportFormPage />} />

        <Route path="/found" element={<MyFoundReportsPage />} />
        <Route path="/found/new" element={<FoundReportFormPage />} />
        <Route path="/found/:id" element={<MyFoundReportDetailPage />} />
        <Route path="/found/:id/edit" element={<FoundReportFormPage />} />

        <Route path="/claims" element={<ClaimsPage />} />
        <Route path="/claims/:id" element={<ClaimDetailPage />} />

        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/account" element={<AccountPage />} />

        <Route path="*" element={<Navigate to="/browse" replace />} />
      </Route>
    </Routes>
  );
}
