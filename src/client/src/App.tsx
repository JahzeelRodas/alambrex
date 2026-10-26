import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import StatusPage from './pages/StatusPage';
import StreamPage from './pages/StreamPage';
import AdminLoginPage from './pages/AdminLoginPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import SpectatorPage from './pages/SpectatorPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/status/:token" element={<StatusPage />} />
      <Route path="/stream" element={<StreamPage />} />
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route path="/admin" element={<AdminDashboardPage />} />
      <Route path="*" element={<HomePage />} />
      <Route path="/live" element={<SpectatorPage />} />
    </Routes>
  );
}
