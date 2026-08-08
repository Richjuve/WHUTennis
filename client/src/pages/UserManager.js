import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

export default function UserManager() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [name, setName] = useState('');
  const [sid, setSid] = useState('');
  const [role, setRole] = useState('referee');
  const [password, setPassword] = useState('');

  const fetchUsers = () => {
    axios.get('/api/auth/users', {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    })
    .then(res => setUsers(res.data))
    .catch(err => console.error(err));
  };

  useEffect(() => { fetchUsers(); }, []);

  const createUser = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/api/auth/users',
        { name, student_id: sid, role, password },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      setName(''); setSid(''); setPassword('');
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.error || '创建失败');
    }
  };

  const deleteUser = async (id) => {
    if (!window.confirm('确定删除该用户？')) return;
    await axios.delete(`/api/auth/users/${id}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    });
    fetchUsers();
  };

  if (user?.role !== 'admin') return <div className="alert alert-danger">无权限访问</div>;

  return (
    <div>
      <h5>用户管理</h5>
      <form onSubmit={createUser} className="row g-2 mb-3">
        <div className="col-md-2">
          <input className="form-control" placeholder="姓名" value={name} onChange={e => setName(e.target.value)} required />
        </div>
        <div className="col-md-2">
          <input className="form-control" placeholder="学号" value={sid} onChange={e => setSid(e.target.value)} required />
        </div>
        <div className="col-md-2">
          <input className="form-control" placeholder="密码(默认学号)" value={password} onChange={e => setPassword(e.target.value)} />
        </div>
        <div className="col-md-2">
          <select className="form-select" value={role} onChange={e => setRole(e.target.value)}>
            <option value="referee">裁判</option>
            <option value="venue_manager">场地负责人</option>
            <option value="admin">管理员</option>
          </select>
        </div>
        <div className="col-md-2">
          <button className="btn btn-primary" type="submit">创建用户</button>
        </div>
      </form>
      <div className="table-responsive">
        <table className="table table-sm">
          <thead>
            <tr className="text-nowrap">
              <th>姓名</th>
              <th>学号</th>
              <th>角色</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="align-middle text-nowrap">
                <td>{u.name}</td>
                <td>{u.student_id}</td>
                <td>{u.role === 'admin' ? '管理员' : u.role === 'referee' ? '裁判' : '场地负责人'}</td>
                <td>
                  <button className="btn btn-outline-danger btn-sm" onClick={() => deleteUser(u.id)}>删除</button>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr><td colSpan={4} className="text-center text-muted">暂无用户</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}