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

function App() {
  const [checkingAuth, setCheckingAuth] = React.useState(true);
  const [currentUser, setCurrentUser] = React.useState<AuthUser | null>(null);

  React.useEffect(() => {
    async function bootstrap() {
      const token = getAuthToken();
      if (!token) {
        setCurrentUser(null);
        setCheckingAuth(false);
        return;
      }
      try {
        const me = await api.me();
        setCurrentUser(me);
      } catch {
        clearAuthToken();
        setCurrentUser(null);
      } finally {
        setCheckingAuth(false);
      }
    }
    void bootstrap();
  }, []);

  if (checkingAuth) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-on-surface-variant">Checking session...</div>;
  }

  if (!currentUser) {
    return (
      <Router>
        <Routes>
          <Route
            path="/login"
            element={
              <Login
                onLoggedIn={(user) => {
                  setCurrentUser(user);
                }}
              />
            }
          />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
    );
  }

  return (
    <NotificationProvider>
      <Router>
        <div className="flex min-h-screen bg-background text-on-surface selection:bg-primary/30 selection:text-primary">
          <Sidebar
            currentUser={currentUser}
            onLogout={() => {
              clearAuthToken();
              setCurrentUser(null);
            }}
          />
          <main className="flex-1 flex flex-col">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/sessions" element={<Sessions />} />
              <Route path="/sessions/live" element={<SessionControl />} />
              <Route path="/sessions/:id" element={<SessionDetail />} />
              <Route path="/personas" element={<Personas />} />
              <Route path="/personas/create" element={<BotConfig />} />
              <Route path="/personas/:id/config" element={<BotConfig />} />
              <Route path="/knowledge" element={<KnowledgeBase />} />
              <Route path="/workflows" element={<Workflows />} />
              <Route path="/workflows/create" element={<WorkflowEditor />} />
              <Route path="/workflows/:id/edit" element={<WorkflowEditor />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/profile" element={<Profile currentUser={currentUser} />} />
              <Route
                path="/users"
                element={currentUser.role === 'admin' ? <UserManagement /> : <Navigate to="/" replace />}
              />
              <Route path="/login" element={<Navigate to="/" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </Router>
    </NotificationProvider>
  );
}

export default App;
