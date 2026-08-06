import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [sid, setSid] = useState('');
  const [password, setPassword] = useState('');
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(sid, password);
      navigate('/admin');
    } catch (err) {
      setError(err.response?.data?.error || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  if (user) {
    navigate('/admin');
    return null;
  }

  return (
    <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '70vh' }}>
      <div className="card shadow-sm" style={{ width: 400, borderRadius: 16 }}>
        <div className="card-body p-5">
          <div className="text-center mb-4">
            <div style={{ fontSize: 48 }}>🎾</div>
            <h4 className="fw-bold mt-2" style={{ color: '#7B1FA2', fontFamily: 'Futura'}}>WHU Tennis</h4>
            <p className="text-muted small">请登录以管理比赛</p>
          </div>

          {error && (
            <div className="alert alert-danger py-2 small text-center">{error}</div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="form-label small fw-bold text-muted">学号</label>
              <input
                className="form-control"
                placeholder="请输入学号"
                value={sid}
                onChange={e => setSid(e.target.value)}
                required
              />
            </div>

            <div className="mb-4">
              <label className="form-label small fw-bold text-muted">密码</label>
              <input
                type="password"
                className="form-control"
                placeholder="请输入密码"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>

            <button
              className="btn btn-primary w-100 py-2 fw-bold"
              type="submit"
              disabled={loading}
            >
              {loading ? '登录中...' : '登 录'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}