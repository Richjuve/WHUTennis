import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

export default function PlayerManager() {
  const { user } = useAuth();
  const fileInputRef = useRef(null);
  const [tournaments, setTournaments] = useState([]);
  const [selectedTid, setSelectedTid] = useState('');
  const [players, setPlayers] = useState([]);

  // 手动添加表单
  const [name, setName] = useState('');
  const [gender, setGender] = useState('');
  const [sid, setSid] = useState('');
  const [college, setCollege] = useState('');
  const [phone, setPhone] = useState('');
  const [seed, setSeed] = useState('');

  // Excel导入
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  // 编辑状态
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});

  // 排序
  const [sortField, setSortField] = useState('seed'); // name / college / seed
  const [sortOrder, setSortOrder] = useState('asc'); // asc / desc

  // 多选删除
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [selectAll, setSelectAll] = useState(false);

  useEffect(() => {
    axios.get('/api/tournaments').then(res => setTournaments(res.data));
  }, []);

  const loadPlayers = () => {
    if (selectedTid) {
      axios.get(`/api/players/by-tournament/${selectedTid}`).then(res => {
        setPlayers(res.data);
        setSelectedIds(new Set());
        setSelectAll(false);
      });
    } else {
      setPlayers([]);
      setSelectedIds(new Set());
      setSelectAll(false);
    }
  };

  useEffect(() => {
    loadPlayers();
  }, [selectedTid]);

  // 排序后的选手列表
  const sortedPlayers = [...players].sort((a, b) => {
    let valA, valB;
    switch (sortField) {
      case 'name':
        valA = a.name || '';
        valB = b.name || '';
        break;
      case 'college':
        valA = a.college || '';
        valB = b.college || '';
        break;
      case 'seed':
      default:
        valA = a.seed || 999;
        valB = b.seed || 999;
        break;
    }
    if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
    if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const addPlayer = async (e) => {
    e.preventDefault();
    if (!selectedTid) return alert('请选择比赛');
    try {
      await axios.post('/api/players', {
        tournament_id: parseInt(selectedTid),
        name,
        gender: gender || null,
        student_id: sid || null,
        college: college || null,
        phone: phone || null,
        seed: seed ? parseInt(seed) : null
      }, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      setName(''); setGender(''); setSid(''); setCollege(''); setPhone(''); setSeed('');
      loadPlayers();
    } catch (err) {
      alert(err.response?.data?.error || '添加失败');
    }
  };

  const deletePlayer = async (id) => {
    if (!window.confirm('确定删除该选手？')) return;
    await axios.delete(`/api/players/${id}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    });
    loadPlayers();
  };

  // 批量删除
  const batchDelete = async () => {
    if (selectedIds.size === 0) return alert('请先选择选手');
    if (!window.confirm(`确定删除选中的 ${selectedIds.size} 名选手？`)) return;

    try {
      await Promise.all(
        [...selectedIds].map(id =>
          axios.delete(`/api/players/${id}`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
          })
        )
      );
      loadPlayers();
    } catch (err) {
      alert('批量删除失败');
    }
  };

  // 全选/取消全选
  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedIds(new Set());
      setSelectAll(false);
    } else {
      setSelectedIds(new Set(sortedPlayers.map(p => p.id)));
      setSelectAll(true);
    }
  };

  // 单个选择
  const toggleSelect = (id) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
    setSelectAll(newSet.size === sortedPlayers.length);
  };

  const handleExcelImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!selectedTid) {
      alert('请先选择比赛');
      return;
    }
    setImporting(true);
    setImportResult(null);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('tournament_id', selectedTid);
    try {
      const res = await axios.post('/api/players/import', formData, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      setImportResult({ type: 'success', message: res.data.message });
      loadPlayers();
    } catch (err) {
      setImportResult({ type: 'error', message: err.response?.data?.error || '导入失败' });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const startEdit = (player) => {
    setEditingId(player.id);
    setEditData({
      name: player.name,
      gender: player.gender || '',
      student_id: player.student_id || '',
      college: player.college || '',
      phone: player.phone || '',
      seed: player.seed || ''
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditData({});
  };

  const saveEdit = async () => {
    try {
      await axios.put(`/api/players/${editingId}`, {
        name: editData.name,
        gender: editData.gender || null,
        student_id: editData.student_id || null,
        college: editData.college || null,
        phone: editData.phone || null,
        seed: editData.seed ? parseInt(editData.seed) : null
      }, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      setEditingId(null);
      setEditData({});
      loadPlayers();
    } catch (err) {
      alert(err.response?.data?.error || '保存失败');
    }
  };

  const downloadTemplate = () => {
    const header = '姓名,性别,学号,学院,电话号码,种子序号';
    const example = '张三,男,2024001,信息学院,13800138000,1';
    const content = header + '\n' + example;
    const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = '选手导入模板.csv';
    link.click();
  };

  if (!user || user.role !== 'admin') return <div className="alert alert-danger">仅管理员可操作</div>;

  return (
    <div>
      <h5>选手管理</h5>

      <div className="mb-3">
        <select className="form-select" value={selectedTid} onChange={e => setSelectedTid(e.target.value)}>
          <option value="">-- 请选择比赛 --</option>
          {tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>

      {selectedTid && (
        <>
          {/* Excel 导入区域 */}
          <div className="card mb-3">
            <div className="card-header d-flex justify-content-between align-items-center">
              <span>📥 Excel 批量导入</span>
              <button className="btn btn-sm btn-outline-secondary" onClick={downloadTemplate}>
                下载导入模板
              </button>
            </div>
            <div className="card-body">
              <p className="text-muted small">
                支持列：<strong>姓名（必填）、性别、学号、学院、电话号码、种子序号</strong>（列顺序任意）
              </p>
              <div className="input-group">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="form-control"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleExcelImport}
                  disabled={importing}
                />
              </div>
              {importing && <div className="mt-2 text-info">正在导入中...</div>}
              {importResult && (
                <div className={`mt-2 alert ${importResult.type === 'success' ? 'alert-success' : 'alert-danger'} py-1`}>
                  {importResult.message}
                </div>
              )}
            </div>
          </div>

          {/* 手动添加选手 */}
          <div className="card mb-3">
            <div className="card-header">✍️ 手动添加选手</div>
            <div className="card-body">
              <form onSubmit={addPlayer} className="row g-2">
                <div className="col-md-2">
                  <input className="form-control" placeholder="姓名 *" value={name} onChange={e => setName(e.target.value)} required />
                </div>
                <div className="col-md-1">
                  <select className="form-select" value={gender} onChange={e => setGender(e.target.value)}>
                    <option value="">性别</option>
                    <option value="男">男</option>
                    <option value="女">女</option>
                  </select>
                </div>
                <div className="col-md-2">
                  <input className="form-control" placeholder="学号" value={sid} onChange={e => setSid(e.target.value)} />
                </div>
                <div className="col-md-2">
                  <input className="form-control" placeholder="学院" value={college} onChange={e => setCollege(e.target.value)} />
                </div>
                <div className="col-md-2">
                  <input className="form-control" placeholder="电话号码" value={phone} onChange={e => setPhone(e.target.value)} />
                </div>
                <div className="col-md-1">
                  <input className="form-control" type="number" placeholder="种子" value={seed} onChange={e => setSeed(e.target.value)} />
                </div>
                <div className="col-md-1">
                  <button className="btn btn-success w-100" type="submit">添加</button>
                </div>
              </form>
            </div>
          </div>

          {/* 排序 + 批量操作 */}
          <div className="d-flex justify-content-between align-items-center mb-2">
            <div className="d-flex align-items-center gap-2">
              <span className="small text-muted">排序：</span>
              <select
                className="form-select form-select-sm"
                style={{ width: 100 }}
                value={sortField}
                onChange={e => setSortField(e.target.value)}
              >
                <option value="seed">种子序号</option>
                <option value="name">姓名</option>
                <option value="college">学院</option>
              </select>
              <button
                className="btn btn-sm btn-outline-secondary"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              >
                {sortOrder === 'asc' ? '↑ 升序' : '↓ 降序'}
              </button>
            </div>
            {selectedIds.size > 0 && (
              <button className="btn btn-sm btn-danger" onClick={batchDelete}>
                删除选中 ({selectedIds.size})
              </button>
            )}
          </div>

          {/* 选手列表 */}
          <div className="card">
            <div className="card-header d-flex justify-content-between align-items-center">
              <span>📋 选手列表（共 {players.length} 人）</span>
            </div>
            <div className="table-responsive">
              <table className="table table-sm mb-0">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>
                      <input
                        type="checkbox"
                        checked={selectAll}
                        onChange={toggleSelectAll}
                      />
                    </th>
                    <th>姓名</th>
                    <th>性别</th>
                    <th>学号</th>
                    <th>学院</th>
                    <th>电话</th>
                    <th>种子</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPlayers.map(p => (
                    <tr key={p.id} className={`${selectedIds.has(p.id) ? 'table-active' : ''} align-middle`}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(p.id)}
                          onChange={() => toggleSelect(p.id)}
                        />
                      </td>
                      {editingId === p.id ? (
                        <>
                          <td><input className="form-control form-control-sm" value={editData.name} onChange={e => setEditData({...editData, name: e.target.value})} /></td>
                          <td>
                            <select className="form-select form-select-sm" value={editData.gender} onChange={e => setEditData({...editData, gender: e.target.value})}>
                              <option value="">-</option>
                              <option value="男">男</option>
                              <option value="女">女</option>
                            </select>
                          </td>
                          <td><input className="form-control form-control-sm" value={editData.student_id} onChange={e => setEditData({...editData, student_id: e.target.value})} /></td>
                          <td><input className="form-control form-control-sm" value={editData.college} onChange={e => setEditData({...editData, college: e.target.value})} /></td>
                          <td><input className="form-control form-control-sm" value={editData.phone} onChange={e => setEditData({...editData, phone: e.target.value})} /></td>
                          <td><input className="form-control form-control-sm" type="number" value={editData.seed} onChange={e => setEditData({...editData, seed: e.target.value})} /></td>
                          <td>
                            <button className="btn btn-success btn-sm me-1" onClick={saveEdit}>保存</button>
                            <button className="btn btn-secondary btn-sm" onClick={cancelEdit}>取消</button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td>
                            <span>{p.name}{p.seed ? `[${p.seed}]` : ''}</span>
                          </td>
                          <td>{p.gender || '-'}</td>
                          <td>{p.student_id || '-'}</td>
                          <td>{p.college || '-'}</td>
                          <td>{p.phone || '-'}</td>
                          <td>{p.seed || '-'}</td>
                          <td>
                            <button className="btn btn-outline-primary btn-sm me-1" onClick={() => startEdit(p)}>编辑</button>
                            <button className="btn btn-outline-danger btn-sm" onClick={() => deletePlayer(p.id)}>删除</button>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                  {players.length === 0 && (
                    <tr><td colSpan={8} className="text-center text-muted">暂无选手</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}