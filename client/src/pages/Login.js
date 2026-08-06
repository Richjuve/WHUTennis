import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [name, setName] = useState('');
  const [sid, setSid] = useState('');
  const [password, setPassword] = useState('');
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await login(name, sid, password);
      navigate('/admin');
    } catch (err) {
      setError(err.response?.data?.error || '登录失败');
    }
  };

  if (user) {
    navigate('/admin');
    return null;
  }

  return (
    <div className="row justify-content-center">
      <div className="col-md-4">
        <h3>账号登录</h3>
        {error && <div className="alert alert-danger">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label>姓名</label>
            <input className="form-control" value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div className="mb-3">
            <label>学号</label>
            <input className="form-control" value={sid} onChange={e => setSid(e.target.value)} required />
          </div>
          <div className="mb-3">
            <label>密码</label>
            <input type="password" className="form-control" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          <button className="btn btn-primary" type="submit">登录</button>
        </form>
      </div>
    </div>
  );
}