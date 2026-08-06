import React from 'react';
import { Link, Routes, Route, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import TournamentSettings from './TournamentSettings';
import PlayerManager from './PlayerManager';
import StageEditor from './StageEditor';
import UserManager from './UserManager';

export default function AdminDashboard() {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return (
      <div className="text-center mt-5">
        <h4>请先登录</h4>
        <Link to="/login" className="btn btn-primary">去登录</Link>
      </div>
    );
  }

  const handleBackup = () => {
    const token = localStorage.getItem('token');
    window.open(`/api/auth/backup?token=${token}`, '_blank');
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4>管理后台 - 欢迎, {user.name} ({user.role === 'admin' ? '管理员' : user.role === 'referee' ? '裁判' : '场地负责人'})</h4>
        {user.role === 'admin' && (
          <button className="btn btn-outline-primary btn-sm" onClick={handleBackup}>
            💾 备份数据库
          </button>
        )}
      </div>

      <ul className="nav nav-tabs mb-3">
        <li className="nav-item">
          <Link
            className={`nav-link ${location.pathname === '/admin' || location.pathname === '/admin/' ? 'active' : ''}`}
            to="/admin"
          >
            比赛管理
          </Link>
        </li>
        <li className="nav-item">
          <Link
            className={`nav-link ${location.pathname === '/admin/players' ? 'active' : ''}`}
            to="/admin/players"
          >
            选手库
          </Link>
        </li>
        {user.role === 'admin' && (
          <li className="nav-item">
            <Link
              className={`nav-link ${location.pathname === '/admin/users' ? 'active' : ''}`}
              to="/admin/users"
            >
              用户管理
            </Link>
          </li>
        )}
      </ul>

      <Routes>
        <Route path="/" element={<TournamentSettings />} />
        <Route path="/players" element={<PlayerManager />} />
        <Route path="/users" element={<UserManager />} />
        <Route path="/stages/:tournamentId" element={<StageEditor />} />
        <Route path="/stages/:tournamentId" element={<StageEditor />} />
      </Routes>
    </div>
  );
}