import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

export default function TournamentSettings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tournaments, setTournaments] = useState([]);
  const [name, setName] = useState('');
  const [config, setConfig] = useState({ bestOfSets: 1 });
  const [editingNameId, setEditingNameId] = useState(null);
  const [editName, setEditName] = useState('');

  const fetch = () => {
    axios.get('/api/tournaments').then(res => setTournaments(res.data));
  };

  useEffect(() => {
    fetch();
  }, []);

  const create = async (e) => {
    e.preventDefault();
    if (!name) return alert('请输入比赛名称');
    try {
      await axios.post('/api/tournaments',
        { name, scoring_config: config },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      setName('');
      fetch();
    } catch (err) {
      alert(err.response?.data?.error || '创建失败');
    }
  };

  const deleteTournament = async (id) => {
    if (!window.confirm('确定删除该比赛？所有相关数据将被删除。')) return;
    try {
      await axios.delete(`/api/tournaments/${id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      fetch();
    } catch (err) {
      alert(err.response?.data?.error || '删除失败');
    }
  };

  const changeStatus = async (id, newStatus) => {
    try {
      await axios.put(`/api/tournaments/${id}`, { status: newStatus }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      fetch();
    } catch (err) {
      alert(err.response?.data?.error || '修改失败');
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'upcoming': return <span className="badge bg-primary">即将开始</span>;
      case 'ongoing': return <span className="badge bg-success">进行中</span>;
      case 'finished': return <span className="badge bg-danger">已结束</span>;
      default: return <span className="badge bg-light text-dark">{status}</span>;
    }
  };

  const saveTournamentName = async (id) => {
    if (!editName.trim()) {
      setEditingNameId(null);
      return;
    }
    try {
      await axios.put(`/api/tournaments/${id}`, { name: editName.trim() }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      fetch();
    } catch (err) {
      alert('修改失败');
    }
    setEditingNameId(null);
  };

  return (
    <div>
      <h5>比赛列表</h5>

      {user.role === 'admin' && (
        <form onSubmit={create} className="row g-2 mb-3">
          <div className="col-md-4">
            <input
              className="form-control"
              placeholder="比赛名称"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>
          <div className="col-md-2">
            <select
              className="form-select"
              value={config.bestOfSets}
              onChange={e => setConfig({ bestOfSets: parseInt(e.target.value) })}
            >
              <option value={1}>1盘制</option>
              <option value={3}>3盘制</option>
              <option value={5}>5盘制</option>
            </select>
          </div>
          <div className="col-md-2">
            <button className="btn btn-primary" type="submit">创建比赛</button>
          </div>
        </form>
      )}

      <table className="table">
        <thead>
          <tr>
            <th>名称</th>
            <th>状态</th>
            <th>赛制</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {tournaments.map(t => {
            const cfg = JSON.parse(t.scoring_config);
            return (
              <tr key={t.id} className="align-middle">
                <td>
                  {editingNameId === t.id ? (
                    <input
                      className="form-control form-control-sm"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      onBlur={() => saveTournamentName(t.id)}
                      onKeyDown={e => e.key === 'Enter' && saveTournamentName(t.id)}
                      autoFocus
                      style={{ width: 200 }}
                    />
                  ) : (
                    <span
                      onClick={() => { setEditingNameId(t.id); setEditName(t.name); }}
                      style={{ cursor: 'pointer' }}
                      title="点击修改比赛名称"
                    >
                      {t.name}
                    </span>
                  )}
                </td>
                <td>
                  {user?.role === 'admin' ? (
                    <select
                      className="form-select form-select-sm"
                      value={t.status}
                      onChange={e => changeStatus(t.id, e.target.value)}
                      style={{ width: 120 }}
                    >
                      <option value="upcoming">即将开始</option>
                      <option value="ongoing">进行中</option>
                      <option value="finished">已结束</option>
                    </select>
                  ) : (
                    getStatusBadge(t.status)
                  )}
                </td>
                <td>{cfg.bestOfSets}盘</td>
                <td>
                  <button
                    className="btn btn-outline-primary btn-sm me-1"
                    onClick={() => navigate(`/admin/stages/${t.id}`)}
                  >
                    管理阶段
                  </button>
                  <button
                    className="btn btn-outline-secondary btn-sm me-1"
                    onClick={() => navigate('/admin/players')}
                  >
                    选手库
                  </button>
                  {user?.role === 'admin' && (
                    <button
                      className="btn btn-outline-danger btn-sm"
                      onClick={() => deleteTournament(t.id)}
                    >
                      删除
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
          {tournaments.length === 0 && (
            <tr>
              <td colSpan={4} className="text-center text-muted">暂无比赛</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}