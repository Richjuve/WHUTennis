import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import Login from './pages/Login';
import TournamentDetail from './pages/TournamentDetail';
import AdminDashboard from './pages/AdminDashboard';
import AuthProvider, { useAuth } from './context/AuthContext';
import { Button } from 'react-bootstrap';
import './App.css';

function NavBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className="navbar navbar-expand navbar-custom" style={{ position: 'sticky', top: 0 }}>
      <div className="container">
        <Link className="navbar-brand" to="/" style={{ color: '#D6B25E', fontFamily: 'Futura'}}>WHU Tennis</Link>
        <div className="navbar-nav me-auto">
          <Link className={`nav-link ${location.pathname === '/' || location.pathname.startsWith('/tournament') ? 'active' : ''}`} to="/">比赛</Link>
          {user && <Link className={`nav-link ${location.pathname.startsWith('/admin') ? 'active' : ''}`} to="/admin">管理</Link>}
        </div>
        <div className="navbar-nav">
          {user ? (
            <div className="d-flex align-items-center">
              <span className="me-3 small" style={{ color: '#555' }}>
                {user.name}
              </span>
              <Button variant="primary" size="sm" onClick={handleLogout}>
                退出
              </Button>
            </div>
          ) : (
            <Link className="nav-link" to="/login">登录</Link>
          )}
        </div>
      </div>
    </nav>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <NavBar />
        <div className="container mt-4" style={{ paddingBottom: 60 }}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/tournament/:id" element={<TournamentDetail />} />
            <Route path="/admin/*" element={<AdminDashboard />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;