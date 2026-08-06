import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import ScoreModal from './ScoreModal';

export default function GroupStandings({ stageId, matches, user, onUpdate, tournamentConfig }) {
  const [groups, setGroups] = useState([]);
  const [groupMembers, setGroupMembers] = useState({});
  const [rankings, setRankings] = useState({});
  
  const [showModal, setShowModal] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState(null);

  useEffect(() => {
    axios.get(`/api/stages/${stageId}/groups`).then(res => {
      setGroups(res.data);
      res.data.forEach(group => {
        axios.get(`/api/stages/groups/${group.id}/members`).then(r => {
          const members = r.data;
          setGroupMembers(prev => ({ ...prev, [group.id]: members }));
          // 用数据库中的 final_rank 初始化，没有则按顺序
          const sorted = [...members].sort((a, b) => {
            if (a.final_rank && b.final_rank) return a.final_rank - b.final_rank;
            if (a.final_rank) return -1;
            if (b.final_rank) return 1;
            return 0;
          });
          const initRank = sorted.map((m, idx) => ({ 
            player_id: m.player_id, 
            rank: m.final_rank || (idx + 1) 
          }));
          setRankings(prev => ({ ...prev, [group.id]: initRank }));
        });
      });
    });
  }, [stageId]);

  // 计算胜局率
  const calcWinRate = (playerId, groupId) => {
    const groupMatches = matches.filter(m => 
      m.group_id === groupId && 
      (m.player1_id === playerId || m.player2_id === playerId) && 
      m.status === 'finished'
    );
    let wins = 0, total = 0;
    groupMatches.forEach(m => {
      if (m.score_detail) {
        try {
          const detail = JSON.parse(m.score_detail);
          if (detail.sets) {
            detail.sets.forEach(set => {
              const g1 = parseInt(set[0]), g2 = parseInt(set[1]);
              if (isNaN(g1) || isNaN(g2)) return;
              total += (g1 + g2);
              if (m.player1_id === playerId) wins += g1;
              else wins += g2;
            });
          }
        } catch(e) {}
      }
    });
    if (total === 0) return '0%';
    return ((wins / total) * 100).toFixed(1) + '%';
  };

  // 调整排名（自动保存到后端）
  const moveRank = (groupId, playerId, direction) => {
    const current = [...(rankings[groupId] || [])];
    const index = current.findIndex(r => r.player_id === playerId);
    if (index === -1) return;

    if (direction === 'up' && index > 0) {
      [current[index-1], current[index]] = [current[index], current[index-1]];
    } else if (direction === 'down' && index < current.length - 1) {
      [current[index], current[index+1]] = [current[index+1], current[index]];
    } else {
      return;
    }

    // 更新排名序号
    const updated = current.map((r, i) => ({ ...r, rank: i + 1 }));
    setRankings({ ...rankings, [groupId]: updated });

    // 自动保存到后端
    axios.put(`/api/stages/groups/${groupId}/rank`, { rankings: updated }, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    }).then(() => {
      if (onUpdate) onUpdate();
    }).catch(err => {
      console.error('自动保存排名失败:', err);
    });
  };

  const handleMatchClick = (match) => {
    if (!user || !match.id) return;
    setSelectedMatch(match);
    setShowModal(true);
  };

  const getGroupMatches = (groupId) => {
    return matches.filter(m => m.group_id === groupId);
  };

  return (
    <div>
      {groups.map(group => {
        const groupMatches = getGroupMatches(group.id);
        return (
          <div key={group.id} className="card mb-3">
            <div className="card-header">
              <strong>{group.name} - 比赛对阵</strong>
              {groupMatches.length === 0 && (
                <span className="text-muted ms-2 small">（请先在管理后台生成对阵）</span>
              )}
            </div>
            {groupMatches.length > 0 && (
              <div className="table-responsive">
                <table className="table table-sm mb-0">
                  <thead>
                    <tr>
                      <th>选手A</th>
                      <th>选手B</th>
                      <th>比分</th>
                      <th>胜者</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupMatches.map(match => {
                      let scoreDisplay = '-';
                      if (match.score_detail) {
                        try {
                          const detail = JSON.parse(match.score_detail);
                          if (detail.walkover) {
                            scoreDisplay = 'W/O';
                          } else if (detail.sets) {
                            scoreDisplay = detail.sets.map(s => s.join('-')).join(', ');
                          }
                        } catch(e) {}
                      }
                      const winnerName = match.winner_id === match.player1_id ? match.player1_name :
                                        match.winner_id === match.player2_id ? match.player2_name : '-';
                      const isFinished = match.status === 'finished';

                      return (
                        <tr
                          key={match.id}
                          onClick={() => handleMatchClick(match)}
                          style={{ 
                            cursor: user ? 'pointer' : 'default',
                            backgroundColor: isFinished ? '#f0fff0' : 'transparent'
                          }}
                          title={user ? '点击录入比分' : ''}
                        >
                          <td>{match.player1_name}{match.player1_seed ? `[${match.player1_seed}]` : ''}</td>
                          <td>{match.player2_name}{match.player2_seed ? `[${match.player2_seed}]` : ''}</td>
                          <td>
                            <span className={isFinished ? 'text-success fw-bold' : 'text-muted'}>
                              {scoreDisplay}
                            </span>
                          </td>
                          <td>
                            {isFinished ? (
                              <span className="badge bg-success">{winnerName}</span>
                            ) : (
                              <span className="text-muted">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* 排名表 */}
            <div className="card-footer">
              <strong>当前排名</strong>
              <small className="text-muted ms-2">（调整后自动保存）</small>
              <table className="table table-sm mb-0 mt-2">
                <thead>
                  <tr>
                    <th style={{width:'60px'}}>排名</th>
                    <th>选手</th>
                    <th style={{width:'80px'}}>胜局率</th>
                    {user && <th style={{width:'80px'}}>调整</th>}
                  </tr>
                </thead>
                <tbody>
                  {(groupMembers[group.id] || [])
                    .sort((a, b) => {
                      const ra = rankings[group.id]?.find(r => r.player_id === a.player_id)?.rank || 999;
                      const rb = rankings[group.id]?.find(r => r.player_id === b.player_id)?.rank || 999;
                      return ra - rb;
                    })
                    .map(member => {
                      const currentRank = rankings[group.id]?.find(r => r.player_id === member.player_id)?.rank || '-';
                      return (
                        <tr key={member.player_id}>
                          <td>{currentRank}</td>
                          <td>{member.player_name}{member.player_seed ? `[${member.player_seed}]` : ''}</td>
                          <td>{calcWinRate(member.player_id, group.id)}</td>
                          {user && (
                            <td>
                              <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => moveRank(group.id, member.player_id, 'up')}>↑</button>
                              <button className="btn btn-sm btn-outline-secondary" onClick={() => moveRank(group.id, member.player_id, 'down')}>↓</button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      {selectedMatch && (
        <ScoreModal
          match={selectedMatch}
          tournamentConfig={tournamentConfig}
          show={showModal}
          onHide={() => setShowModal(false)}
          onSaved={() => {
            setShowModal(false);
            onUpdate();
          }}
          user={user}
        />
      )}
    </div>
  );
}