import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { api, AuthUser, clearAuthToken, getAuthToken } from './lib/api';
import Dashboard from './pages/Dashboard';
import SessionControl from './pages/SessionControl';
import Sessions from './pages/Sessions';
import SessionDetail from './pages/SessionDetail';
import Personas from './pages/Personas';
import BotConfig from './pages/BotConfig';
import KnowledgeBase from './pages/KnowledgeBase';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import Workflows from './pages/Workflows';
import WorkflowEditor from './pages/WorkflowEditor';
import Login from './pages/Login';
import UserManagement from './pages/UserManagement';
import Profile from './pages/Profile';
import { NotificationProvider } from './contexts/NotificationContext';
import TestUserManagement from './pages/TestUserManagement';
import HomeNew from './pages/HomeNew';
import { hdfcConfig } from './config/tenants/hdfc.config';
import VoicePersonas from './pages/VoicePersonas';
import DiyWithAI from './pages/DiyWithAI';
import DiyPersonaPresets from './pages/DiyPersonaPresets';
import DiyPersonaBuilder from './pages/DiyPersonaBuilder';
import { StudioLayout } from './components/StudioLayout';
import StudioPersonas from './pages/StudioPersonas';
import StudioLibrary from './pages/StudioLibrary';
import StudioTest from './pages/StudioTest';
import StudioDashboard from './pages/StudioDashboard';
import StudioPersonasNew from './pages/StudioPersonasNew';
import { ThemeSynchronizer } from './components/ThemeSynchronizer';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import HomeNewV1 from './pages/HomeNewV1';
import HomeOld from './pages/HomeOld';

function AppContent() {
  const { currentUser, setCurrentUser, isLoading, logout, isAdmin } = useAuth();

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-on-surface-variant font-headline tracking-widest uppercase animate-pulse">Checking neural identity...</div>;
  }

  if (!currentUser) {
    return (
      <Router>
        <Routes>
          <Route path="/" element={<HomeNewV1 />} />
          <Route path="/home" element={<HomeNewV1 />} />
          <Route path="/old" element={<HomeOld />} />
          <Route path="/v2" element={<HomeNew />} />
          <Route path="/hdfc" element={<HomeNew config={hdfcConfig} />} />
          <Route
            path="/login"
            element={
              <Login
                onLoggedIn={async () => {
                  try {
                    const fullUser = await api.me();
                    setCurrentUser(fullUser);
                  } catch (err) {
                    console.error('Failed to fetch full profile after login:', err);
                  }
                }}
              />
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    );
  }

  return (
    <Router>
      <div className="flex min-h-screen text-on-surface selection:bg-primary/30 selection:text-primary">
        <Sidebar
          currentUser={currentUser}
          onLogout={logout}
        />
        <main className="flex-1 flex flex-col min-w-0">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/home" element={<HomeNew />} />
            <Route path="/hdfc" element={<HomeNew config={hdfcConfig} />} />
            
            <Route path="/dashboard" element={
              <ProtectedRoute moduleId="dashboard">
                <Dashboard />
              </ProtectedRoute>
            } />
            
            <Route path="/sessions" element={
              <ProtectedRoute moduleId="sessions">
                <Sessions />
              </ProtectedRoute>
            } />
            
            <Route path="/sessions/live" element={
              <ProtectedRoute moduleId="sessions">
                <SessionControl />
              </ProtectedRoute>
            } />
            
            <Route path="/sessions/:id" element={
              <ProtectedRoute moduleId="sessions">
                <SessionDetail />
              </ProtectedRoute>
            } />
            
            <Route path="/diy-with-ai" element={
              <ProtectedRoute moduleId="studio">
                <DiyWithAI />
              </ProtectedRoute>
            } />
            
            <Route path="/diy-with-ai/personas" element={
              <ProtectedRoute moduleId="studio">
                <DiyPersonaPresets />
              </ProtectedRoute>
            } />
            
            <Route path="/personas" element={
              <ProtectedRoute moduleId="personas">
                <Personas />
              </ProtectedRoute>
            } />
            
            <Route path="/personas/create" element={
              <ProtectedRoute moduleId="personas">
                <BotConfig />
              </ProtectedRoute>
            } />
            
            <Route path="/personas/:id/config" element={
              <ProtectedRoute moduleId="personas">
                <BotConfig />
              </ProtectedRoute>
            } />
            
            <Route path="/personas/:id/config/debug" element={
              <ProtectedRoute moduleId="personas">
                <BotConfig />
              </ProtectedRoute>
            } />
            
            <Route path="/personas/debug" element={
              <ProtectedRoute moduleId="personas" adminOnly>
                <Personas debug />
              </ProtectedRoute>
            } />
            
            <Route path="/knowledge" element={
              <ProtectedRoute moduleId="knowledge">
                <KnowledgeBase />
              </ProtectedRoute>
            } />
            
            <Route path="/workflows" element={
              <ProtectedRoute moduleId="workflows">
                <Workflows />
              </ProtectedRoute>
            } />
            
            <Route path="/workflows/create" element={
              <ProtectedRoute moduleId="workflows">
                <WorkflowEditor />
              </ProtectedRoute>
            } />
            
            <Route path="/workflows/:id/edit" element={
              <ProtectedRoute moduleId="workflows">
                <WorkflowEditor />
              </ProtectedRoute>
            } />
            
            <Route path="/analytics" element={
              <ProtectedRoute moduleId="analytics">
                <Analytics />
              </ProtectedRoute>
            } />
            
            <Route path="/profile" element={
              <ProtectedRoute moduleId="profile">
                <Profile currentUser={currentUser} />
              </ProtectedRoute>
            } />

            {/* --- Voice Persona Studio Routes --- */}
            <Route path="/studio" element={
              <ProtectedRoute moduleId="studio">
                <StudioLayout />
              </ProtectedRoute>
            }>
              <Route index element={<Navigate to="/studio/library" replace />} />
              <Route path="overview" element={<StudioDashboard />} />
              <Route path="agents" element={<StudioPersonas />} />
              <Route path="library" element={<StudioLibrary />} />
              <Route path="test" element={<StudioTest />} />
            </Route>

            <Route path="/persona" element={
              <ProtectedRoute moduleId="persona">
                <StudioLayout />
              </ProtectedRoute>
            }>
              <Route index element={<StudioPersonas />} />
              <Route path="debug" element={<StudioPersonas debug />} />
            </Route>

            <Route path="/settings" element={
              <ProtectedRoute moduleId="settings" adminOnly>
                <Settings />
              </ProtectedRoute>
            } />
            
            <Route path="/users" element={
              <ProtectedRoute moduleId="users" adminOnly>
                <UserManagement />
              </ProtectedRoute>
            } />
            
            <Route path="/test-users" element={
              <ProtectedRoute adminOnly>
                <TestUserManagement />
              </ProtectedRoute>
            } />
            
            <Route path="/login" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <ThemeSynchronizer />
        <AppContent />
      </NotificationProvider>
    </AuthProvider>
  );
}

export default App;
