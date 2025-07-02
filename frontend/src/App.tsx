import React, { useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ThemeProvider as MUIThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import 'dayjs/locale/he';

import { useTheme } from './contexts/ThemeContext';
import { useAuth } from './hooks/useAuth';
import LoadingScreen from './components/common/LoadingScreen';
import Layout from './components/layout/Layout';
import PrivateRoute from './components/auth/PrivateRoute';

// Lazy load pages
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Login = lazy(() => import('./pages/auth/Login'));
const Register = lazy(() => import('./pages/auth/Register'));
const Agents = lazy(() => import('./pages/agents/Agents'));
const AgentBuilder = lazy(() => import('./pages/agents/AgentBuilder'));
const Conversations = lazy(() => import('./pages/conversations/Conversations'));
const ConversationDetail = lazy(() => import('./pages/conversations/ConversationDetail'));
const KnowledgeBase = lazy(() => import('./pages/knowledge/KnowledgeBase'));
const Integrations = lazy(() => import('./pages/integrations/Integrations'));
const Analytics = lazy(() => import('./pages/analytics/Analytics'));
const Settings = lazy(() => import('./pages/settings/Settings'));
const Profile = lazy(() => import('./pages/Profile'));

function App() {
  const { i18n } = useTranslation();
  const { theme } = useTheme();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    // Set document direction based on language
    document.documentElement.dir = i18n.language === 'he' ? 'rtl' : 'ltr';
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <MUIThemeProvider theme={theme}>
      <CssBaseline />
      <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="he">
        <Suspense fallback={<LoadingScreen />}>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={!isAuthenticated ? <Login /> : <Navigate to="/" />} />
            <Route path="/register" element={!isAuthenticated ? <Register /> : <Navigate to="/" />} />
            
            {/* Private routes */}
            <Route element={<PrivateRoute><Layout /></PrivateRoute>}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/agents" element={<Agents />} />
              <Route path="/agents/new" element={<AgentBuilder />} />
              <Route path="/agents/:id/edit" element={<AgentBuilder />} />
              <Route path="/conversations" element={<Conversations />} />
              <Route path="/conversations/:id" element={<ConversationDetail />} />
              <Route path="/knowledge" element={<KnowledgeBase />} />
              <Route path="/integrations" element={<Integrations />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/profile" element={<Profile />} />
            </Route>
            
            {/* 404 */}
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Suspense>
      </LocalizationProvider>
    </MUIThemeProvider>
  );
}

export default App;