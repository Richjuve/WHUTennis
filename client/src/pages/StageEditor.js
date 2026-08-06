import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

export default function StageEditor() {
  const { tournamentId } = useParams();
  const { user } = useAuth();
  const [stages, setStages] = useState([]);
  const [stageName, setStageName] = useState('');
  const [stageType, setStageType] = useState('knockout');
  const [players, setPlayers] = useState([]);

  useEffect(() => {
    if (!tournamentId) return;
    axios.get(`/api/stages/by-tournament/${tournamentId}`).then(res => setStages(res.data));
    axios.get(`/api/players/by-tournament/${tournamentId}`).then(res => setPlayers(res.data));
  }, [tournamentId]);

  const addStage = async () => {
    if (!stageName) return;
    try {
      await axios.post('/api/stages',
        { tournament_id: tournamentId, name: stageName, type: stageType },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      setStageName('');
      const res = await axios.get(`/api/stages/by-tournament/${tournamentId}`);
      setStages(res.data);
    } catch (err) {
      alert(err.response?.data?.error || '添加失败');
    }
  };

  const deleteStage = async (id) => {
    if (!window.confirm('确定删除该阶段？所有相关数据将被删除。')) return;
    try {
      await axios.delete(`/api/stages/${id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setStages(stages.filter(s => s.id !== id));
    } catch (err) {
      alert(err.response?.data?.error || '删除失败');
    }
  };

  if (user?.role !== 'admin') return <div className="alert alert-danger">仅管理员可操作</div>;

  return (
    <div>
      <h5>阶段管理 - 比赛 #{tournamentId}</h5>
      <div className="row g-2 mb-3">
        <div className="col-md-3">
          <input className="form-control" placeholder="阶段名称" value={stageName} onChange={e => setStageName(e.target.value)} />
        </div>
        <div className="col-md-2">
          <select className="form-select" value={stageType} onChange={e => setStageType(e.target.value)}>
            <option value="knockout">淘汰赛</option>
            <option value="group">小组赛</option>
          </select>
        </div>
        <div className="col-md-2">
          <button className="btn btn-primary" onClick={addStage}>添加阶段</button>
        </div>
      </div>

      <h6>现有阶段</h6>
      {stages.length === 0 && <p className="text-muted">暂无阶段，请添加</p>}
      {stages.map(stage => (
        <div key={stage.id} className="card mb-3">
          <div className="card-header d-flex justify-content-between align-items-center">
            <span>{stage.name} ({stage.type === 'knockout' ? '淘汰赛' : '小组赛'})</span>
            <button className="btn btn-sm btn-danger" onClick={() => deleteStage(stage.id)}>删除阶段</button>
          </div>
          <div className="card-body">
            {stage.type === 'group' ? (
              <GroupEditor stageId={stage.id} players={players} tournamentId={tournamentId} />
            ) : (
              <KnockoutEditor stageId={stage.id} players={players} tournamentId={tournamentId} />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ==================== 小组赛编辑器 ====================
function GroupEditor({ stageId, players, tournamentId }) {
  const [groups, setGroups] = useState([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [allGroupMembers, setAllGroupMembers] = useState({});
  const [existingMatchCount, setExistingMatchCount] = useState(0);

  const loadAllData = async () => {
    const groupsRes = await axios.get(`/api/stages/${stageId}/groups`);
    const groupList = groupsRes.data;
    setGroups(groupList);
    const membersMap = {};
    for (const g of groupList) {
      const res = await axios.get(`/api/stages/groups/${g.id}/members`);
      membersMap[g.id] = res.data;
    }
    setAllGroupMembers(membersMap);
  };

  const loadMatchCount = async () => {
    try {
      const res = await axios.get(`/api/matches/by-tournament/${tournamentId}`);
      const groupMatches = res.data.filter(m =>
        m.group_id && String(m.stage_id) === String(stageId)
      );
      setExistingMatchCount(groupMatches.length);
    } catch (err) {
      console.error('加载对阵数量失败:', err);
    }
  };

  useEffect(() => {
    loadAllData();
    loadMatchCount();
  }, [stageId]);

  const addGroup = async () => {
    if (!newGroupName) return;
    await axios.post(`/api/stages/${stageId}/groups`,
      { name: newGroupName },
      { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
    );
    setNewGroupName('');
    loadAllData();
  };

  const deleteGroup = async (groupId) => {
    if (!window.confirm('确定删除该小组？')) return;
    await axios.delete(`/api/stages/groups/${groupId}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    });
    loadAllData();
    loadMatchCount();
  };

  const doGenerate = async (showAlert = true) => {
    if (groups.length === 0) {
      if (showAlert) alert('请先添加小组和选手');
      return;
    }
    try {
      let totalCreated = 0;
      let totalSkipped = 0;
      for (const group of groups) {
        const members = allGroupMembers[group.id] || [];
        if (members.length < 2) continue;
        for (let i = 0; i < members.length; i++) {
          for (let j = i + 1; j < members.length; j++) {
            const p1 = members[i];
            const p2 = members[j];
            const allMatches = await axios.get(`/api/matches/by-tournament/${tournamentId}`);
            const exists = allMatches.data.find(m =>
              m.group_id === group.id &&
              String(m.stage_id) === String(stageId) &&
              ((m.player1_id === p1.player_id && m.player2_id === p2.player_id) ||
               (m.player1_id === p2.player_id && m.player2_id === p1.player_id))
            );
            if (!exists) {
              await axios.post('/api/matches', {
                stage_id: parseInt(stageId),
                group_id: group.id,
                round: 'group',
                position: totalCreated + 1,
                player1_id: p1.player_id,
                player2_id: p2.player_id
              }, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
              totalCreated++;
            } else {
              totalSkipped++;
            }
          }
        }
      }
      if (showAlert) {
        let msg = `成功生成 ${totalCreated} 场新对阵`;
        if (totalSkipped > 0) msg += `，已跳过 ${totalSkipped} 场已有对阵`;
        alert(msg);
      }
      await loadMatchCount();
    } catch (err) {
      alert('生成失败: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleRegenerateAll = async () => {
    if (!window.confirm('⚠️ 确定要重新生成所有小组对阵吗？\n\n这将删除该阶段所有小组赛已有对阵及比分数据。')) return;
    try {
      await axios.delete(`/api/matches/batch/group-matches/${stageId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      await doGenerate(false);
      alert('已清空并重新生成全部对阵');
      await loadMatchCount();
    } catch (err) {
      alert('重新生成失败: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleButtonClick = () => {
    if (existingMatchCount > 0) {
      handleRegenerateAll();
    } else {
      doGenerate();
    }
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-2">
        <div className="input-group input-group-sm" style={{ maxWidth: 400 }}>
          <input className="form-control" placeholder="小组名" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} />
          <button className="btn btn-outline-primary" onClick={addGroup}>添加小组</button>
        </div>
        <div className="d-flex align-items-center gap-2">
          <button
            className={`btn btn-sm ${existingMatchCount > 0 ? 'btn-outline-danger' : 'btn-success'}`}
            onClick={handleButtonClick}
          >
            {existingMatchCount > 0 ? '重新生成全部' : '一键生成对阵'}
          </button>
          <small className="text-muted">({existingMatchCount}场)</small>
        </div>
      </div>
      {groups.map(group => (
        <GroupItem
          key={group.id}
          group={group}
          players={players}
          allGroupMembers={allGroupMembers}
          onDelete={() => deleteGroup(group.id)}
          onMembersChange={loadAllData}
        />
      ))}
    </div>
  );
}

// ==================== 单个小组 ====================
function GroupItem({ group, players, allGroupMembers, onDelete, onMembersChange }) {
  const [members, setMembers] = useState([]);
  const [selectedPlayer, setSelectedPlayer] = useState('');

  useEffect(() => {
    setMembers(allGroupMembers[group.id] || []);
  }, [allGroupMembers, group.id]);

  const addMember = async () => {
    if (!selectedPlayer) return;
    await axios.post(`/api/stages/groups/${group.id}/players`,
      { player_id: parseInt(selectedPlayer) },
      { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
    );
    setSelectedPlayer('');
    onMembersChange();
  };

  const removeMember = async (playerId) => {
    await axios.delete(`/api/stages/groups/${group.id}/players/${playerId}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    });
    onMembersChange();
  };

  const usedPlayerIds = new Set();
  Object.values(allGroupMembers).forEach(memberList => {
    memberList.forEach(m => usedPlayerIds.add(m.player_id));
  });

  const availablePlayers = players.filter(p => !usedPlayerIds.has(p.id));

  return (
    <div className="border rounded p-2 mb-2">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <strong>{group.name} ({members.length}人)</strong>
        <button className="btn btn-sm btn-outline-danger" onClick={onDelete}>删除小组</button>
      </div>
      <div className="input-group input-group-sm mb-2">
        <select className="form-select" value={selectedPlayer} onChange={e => setSelectedPlayer(e.target.value)}>
          <option value="">选择选手</option>
          {availablePlayers.map(p => (
            <option key={p.id} value={p.id}>{p.name}{p.seed ? `[${p.seed}]` : ''}</option>
          ))}
        </select>
        <button className="btn btn-success" onClick={addMember} disabled={!selectedPlayer}>+</button>
      </div>
      <ul className="list-group list-group-flush">
        {members.map(m => (
          <li key={m.player_id} className="list-group-item d-flex justify-content-between align-items-center py-1">
            <span>{m.player_name}{m.player_seed ? `[${m.player_seed}]` : ''}</span>
            <button className="btn btn-sm btn-outline-danger py-0" onClick={() => removeMember(m.player_id)}>移除</button>
          </li>
        ))}
        {members.length === 0 && <li className="list-group-item text-muted py-1">暂无选手</li>}
      </ul>
    </div>
  );
}

// ==================== 淘汰赛编辑器 ====================
function KnockoutEditor({ stageId, players, tournamentId }) {
  const [matches, setMatches] = useState([]);
  const [player1, setPlayer1] = useState('');
  const [player2, setPlayer2] = useState('');
  const [playerRankInfo, setPlayerRankInfo] = useState({});
  const [roundLabels, setRoundLabels] = useState({});
  const [hasThirdPlace, setHasThirdPlace] = useState(false);
  const [totalRounds, setTotalRounds] = useState(4);

  useEffect(() => {
    loadMatches();
    loadPlayerRankings();
    loadStageConfig();
  }, [stageId, tournamentId]);

  const loadMatches = async () => {
    const res = await axios.get(`/api/matches/by-tournament/${tournamentId}`);
    const stageMatches = res.data.filter(m => String(m.stage_id) === String(stageId));
    setMatches(stageMatches);
    // 自动计算总轮数
    const mainRounds = [...new Set(stageMatches.filter(m => m.round !== 'third_place').map(m => Number(m.round)))];
    if (mainRounds.length > 0) {
      setTotalRounds(Math.max(...mainRounds));
    }
  };

  const loadStageConfig = async () => {
    try {
      const res = await axios.get(`/api/stages/${stageId}`);
      if (res.data.rounds_config && Array.isArray(res.data.rounds_config)) {
        const map = {};
        res.data.rounds_config.forEach(r => { map[String(r.round)] = r.label; });
        setRoundLabels(map);
      }
      setHasThirdPlace(!!res.data.has_third_place);
      if (res.data.total_rounds) setTotalRounds(res.data.total_rounds);
    } catch (err) {
      console.error('加载阶段配置失败:', err);
    }
  };

  const loadPlayerRankings = async () => {
    // ... 保持不变 ...
    try {
      const stagesRes = await axios.get(`/api/stages/by-tournament/${tournamentId}`);
      const groupStages = stagesRes.data.filter(s => s.type === 'group');
      const info = {};
      for (const stage of groupStages) {
        const groupsRes = await axios.get(`/api/stages/${stage.id}/groups`);
        for (const group of groupsRes.data) {
          const membersRes = await axios.get(`/api/stages/groups/${group.id}/members`);
          for (const member of membersRes.data) {
            info[member.player_id] = {
              stageName: stage.name,
              groupName: group.name,
              rank: member.final_rank
            };
          }
        }
      }
      setPlayerRankInfo(info);
    } catch (err) {
      console.error('加载排名信息失败:', err);
    }
  };

  const saveRoundLabel = (r, label) => {
    const newLabels = { ...roundLabels, [r]: label };
    setRoundLabels(newLabels);
    const config = Object.entries(newLabels)
      .filter(([, v]) => v)
      .map(([k, v]) => ({ round: k, label: v }));
    axios.put(`/api/stages/${stageId}/rounds`, { rounds_config: config }, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    }).catch(err => console.error('保存轮次名称失败:', err));
  };

  const saveTotalRounds = (val) => {
    setTotalRounds(val);
    axios.put(`/api/stages/${stageId}`, { total_rounds: val }, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    }).catch(err => console.error('保存总轮数失败:', err));
  };

  const toggleThirdPlace = () => {
    const newVal = !hasThirdPlace;
    setHasThirdPlace(newVal);
    axios.put(`/api/stages/${stageId}`, { has_third_place: newVal }, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    }).catch(err => console.error('切换季军赛失败:', err));
  };

  const getRoundLabel = (r) => {
    if (r === 'third_place') return '季军赛';
    return roundLabels[String(r)] || `第${r}轮`;
  };

  const formatPlayerLabel = (p) => {
    if (!p) return '';
    let label = p.name || '';
    if (p.seed) label += `[${p.seed}]`;
    const info = playerRankInfo[p.id];
    if (info) {
      label += ` ← ${info.stageName}-${info.groupName}`;
      if (info.rank) label += ` 第${info.rank}名`;
    }
    return label;
  };

  // 添加比赛到指定轮次和位置
  const addMatch = async (round, pos) => {
    try {
      await axios.post('/api/matches', {
        stage_id: parseInt(stageId),
        round: String(round),
        position: pos,
        player1_id: null,
        player2_id: null
      }, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      loadMatches();
    } catch (err) {
      alert(err.response?.data?.error || '添加失败');
    }
  };

  // 更新比赛的选手
  const updateMatchPlayers = async (matchId, p1Id, p2Id) => {
    try {
      await axios.put(`/api/matches/${matchId}/players`, {
        player1_id: p1Id || null,
        player2_id: p2Id || null
      }, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      loadMatches();
    } catch (err) {
      alert(err.response?.data?.error || '更新失败');
    }
  };

  const deleteMatch = async (matchId) => {
    if (!window.confirm('确定删除该比赛？')) return;
    await axios.delete(`/api/matches/${matchId}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    });
    loadMatches();
  };

  // 初始化对阵表
  const initBracket = async () => {
    if (!window.confirm(`将自动生成 ${totalRounds} 轮共 ${Math.pow(2, totalRounds)} 个签位的淘汰赛对阵表，确定？`)) return;
    try {
      // 删除现有对阵
      await axios.delete(`/api/matches/batch/group-matches/${stageId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      // 删除所有该阶段比赛
      const allMatches = await axios.get(`/api/matches/by-tournament/${tournamentId}`);
      const stageMatchIds = allMatches.data
        .filter(m => String(m.stage_id) === String(stageId))
        .map(m => m.id);
      for (const id of stageMatchIds) {
        await axios.delete(`/api/matches/${id}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
      }

      // 生成对阵
      for (let r = 1; r <= totalRounds; r++) {
        const matchCount = Math.pow(2, totalRounds - r);
        for (let p = 1; p <= matchCount; p++) {
          await axios.post('/api/matches', {
            stage_id: parseInt(stageId),
            round: String(r),
            position: p,
            player1_id: null,
            player2_id: null
          }, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
        }
      }
      loadMatches();
      alert('对阵表初始化完成');
    } catch (err) {
      alert('初始化失败: ' + (err.response?.data?.error || err.message));
    }
  };

  const mainMatches = matches.filter(m => m.round !== 'third_place');
  const thirdPlaceMatch = matches.find(m => m.round === 'third_place');
  const mainRounds = [...new Set(mainMatches.map(m => Number(m.round)))].sort((a, b) => a - b);

  return (
    <div>
      {/* 配置区 */}
      <div className="mb-3 p-2 bg-light rounded">
        <div className="row g-2 align-items-end">
          <div className="col-auto">
            <label className="form-label small mb-0">签位数</label>
            <div className="d-flex align-items-center">
              <select
                className="form-select form-select-sm"
                value={Math.pow(2, totalRounds)}
                onChange={e => {
                  const slots = parseInt(e.target.value);
                  const rounds = Math.round(Math.log2(slots));
                  saveTotalRounds(rounds);
                }}
                style={{ width: 100 }}
              >
                <option value={4}>4签</option>
                <option value={8}>8签</option>
                <option value={16}>16签</option>
                <option value={32}>32签</option>
                <option value={64}>64签</option>
                <option value={128}>128签</option>
              </select>
              <span className="small text-muted ms-1">= {totalRounds}轮</span>
              </div>
          </div>
          <div className="col-auto">
            <button className="btn btn-sm btn-warning" onClick={initBracket}>
              初始化对阵表
            </button>
          </div>
          <div className="col-auto">
            <div className="form-check form-switch mb-0">
              <input
                className="form-check-input"
                type="checkbox"
                checked={hasThirdPlace}
                onChange={toggleThirdPlace}
              />
              <label className="form-check-label small">季军赛</label>
            </div>
          </div>
        </div>
        {/* 轮次命名 */}
        {mainRounds.length > 0 && (
          <div className="d-flex flex-wrap gap-2 mt-2">
            <span className="small text-muted">轮次命名：</span>
            {mainRounds.map(r => (
              <div key={r} className="input-group input-group-sm" style={{ width: 160 }}>
                <span className="input-group-text">第{r}轮</span>
                <input
                  className="form-control"
                  value={roundLabels[String(r)] || ''}
                  placeholder="如 1/8决赛"
                  onChange={e => saveRoundLabel(String(r), e.target.value)}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 各轮对阵编辑 */}
      {mainRounds.map(round => (
        <div key={round} className="mb-3">
          <h6>{getRoundLabel(round)} ({mainMatches.filter(m => Number(m.round) === round).length}场)</h6>
          <table className="table table-sm">
            <thead>
              <tr>
                <th style={{ width: 50 }}>#</th>
                <th>选手A</th>
                <th>选手B</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {mainMatches
                .filter(m => Number(m.round) === round)
                .sort((a, b) => a.position - b.position)
                .map(match => (
                  <tr key={match.id}>
                    <td>{match.position}</td>
                    <td>
                      <select
                        className="form-select form-select-sm"
                        value={match.player1_id || ''}
                        onChange={e => updateMatchPlayers(match.id, e.target.value || null, match.player2_id)}
                      >
                        <option value="">-- 待定 --</option>
                        {players.map(p => (
                          <option key={p.id} value={p.id}>{formatPlayerLabel(p)}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        className="form-select form-select-sm"
                        value={match.player2_id || ''}
                        onChange={e => updateMatchPlayers(match.id, match.player1_id, e.target.value || null)}
                      >
                        <option value="">-- 待定 --</option>
                        {players.filter(p => p.id !== match.player1_id).map(p => (
                          <option key={p.id} value={p.id}>{formatPlayerLabel(p)}</option>
                        ))}
                      </select>
                    </td>
                    <td>{match.status === 'finished' ? '✅ 已结束' : match.status === 'scheduled' ? '未开始' : match.status}</td>
                    <td>
                      <button className="btn btn-sm btn-danger" onClick={() => deleteMatch(match.id)}>删除</button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      ))}

      {/* 季军赛 */}
      {hasThirdPlace && (
        <div className="mb-3">
          <h6>🥉 季军赛</h6>
          {thirdPlaceMatch ? (
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>选手A</th>
                  <th>选手B</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <select
                      className="form-select form-select-sm"
                      value={thirdPlaceMatch.player1_id || ''}
                      onChange={e => updateMatchPlayers(thirdPlaceMatch.id, e.target.value || null, thirdPlaceMatch.player2_id)}
                    >
                      <option value="">-- 待定 --</option>
                      {players.map(p => (
                        <option key={p.id} value={p.id}>{formatPlayerLabel(p)}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      className="form-select form-select-sm"
                      value={thirdPlaceMatch.player2_id || ''}
                      onChange={e => updateMatchPlayers(thirdPlaceMatch.id, thirdPlaceMatch.player1_id, e.target.value || null)}
                    >
                      <option value="">-- 待定 --</option>
                      {players.filter(p => p.id !== thirdPlaceMatch.player1_id).map(p => (
                        <option key={p.id} value={p.id}>{formatPlayerLabel(p)}</option>
                      ))}
                    </select>
                  </td>
                  <td>{thirdPlaceMatch.status === 'finished' ? '✅ 已结束' : '未开始'}</td>
                  <td>
                    <button className="btn btn-sm btn-danger" onClick={() => deleteMatch(thirdPlaceMatch.id)}>删除</button>
                  </td>
                </tr>
              </tbody>
            </table>
          ) : (
            <button
              className="btn btn-sm btn-outline-warning"
              onClick={async () => {
                await axios.post('/api/matches', {
                  stage_id: parseInt(stageId),
                  round: 'third_place',
                  position: 1,
                  player1_id: null,
                  player2_id: null
                }, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
                loadMatches();
              }}
            >
              添加季军赛
            </button>
          )}
        </div>
      )}
    </div>
  );
}