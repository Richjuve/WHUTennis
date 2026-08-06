import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';
import Home from './pages/Home';
import Login from './pages/Login';
import TournamentDetail from './pages/TournamentDetail';
import AdminDashboard from './pages/AdminDashboard';
import AuthProvider, { useAuth } from './context/AuthContext';
import { Button } from 'react-bootstrap';

function NavBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className="navbar navbar-expand navbar-dark bg-dark">
      <div className="container">
        <Link className="navbar-brand" to="/" style={{ color: '#CCFF00', fontFamily: 'Futura'}}>WHU Tennis</Link>
        <div className="navbar-nav me-auto">
          <Link className="nav-link" to="/">比赛</Link>
          {user && <Link className="nav-link" to="/admin">管理</Link>}
        </div>
        <div className="navbar-nav">
          {user ? (
            <div className="d-flex align-items-center">
              <span className="me-3 small" style={{ color: '#E8E8E8' }}>
                {user.name} ({user.role === 'admin' ? '管理员' : user.role === 'referee' ? '裁判' : '场地负责人'})
              </span>
              <Button variant="dark" size="sm" onClick={handleLogout} style={{ color: '#E8E8E8' }}>
                退出登录
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