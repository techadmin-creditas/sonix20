import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
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
import Profile from './pages/Profile';
import { NotificationProvider } from './contexts/NotificationContext';

function App() {
  return (
    <NotificationProvider>
      <Router>
        <div className="flex h-screen overflow-hidden bg-background text-on-surface selection:bg-primary/30 selection:text-primary">
          <Sidebar />
          <main className="flex-1 flex flex-col overflow-y-auto overflow-x-hidden">
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
              <Route path="/profile" element={<Profile />} />
            </Routes>
          </main>
        </div>
      </Router>
    </NotificationProvider>
  );
}

export default App;
