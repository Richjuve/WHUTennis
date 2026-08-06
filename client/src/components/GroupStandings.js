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

  const calcPlayerStats = (playerId, groupId) => {
    const playerMatches = matches.filter(m =>
      m.group_id === groupId &&
      (m.player1_id === playerId || m.player2_id === playerId) &&
      m.status === 'finished' && m.score_detail
    );
    let winSets = 0, lostSets = 0, winGames = 0, lostGames = 0;
    playerMatches.forEach(m => {
      try {
        const detail = JSON.parse(m.score_detail);
        if (detail.walkover) {
          if ((detail.winnerWalkover === 1 && m.player1_id === playerId) ||
              (detail.winnerWalkover === 2 && m.player2_id === playerId)) {
            winSets += 1;
          } else {
            lostSets += 1;
          }
          return;
        }
        if (detail.sets) {
          detail.sets.forEach(set => {
            const g1 = parseInt(set[0]), g2 = parseInt(set[1]);
            if (isNaN(g1) || isNaN(g2)) return;
            const isPlayer1 = m.player1_id === playerId;
            const myGames = isPlayer1 ? g1 : g2;
            const oppGames = isPlayer1 ? g2 : g1;
            winGames += myGames;
            lostGames += oppGames;
            if (myGames > oppGames) winSets++;
            else lostSets++;
          });
        }
      } catch(e) {}
    });
    const totalSets = winSets + lostSets;
    const totalGames = winGames + lostGames;
    return {
      winSets, lostSets,
      setWinRate: totalSets > 0 ? ((winSets / totalSets) * 100).toFixed(1) + '%' : '-',
      winGames, lostGames,
      gameWinRate: totalGames > 0 ? ((winGames / totalGames) * 100).toFixed(1) + '%' : '-'
    };
  };

  const moveRank = (groupId, playerId, direction) => {
    const current = [...(rankings[groupId] || [])];
    const index = current.findIndex(r => r.player_id === playerId);
    if (index === -1) return;
    if (direction === 'up' && index > 0) {
      [current[index-1], current[index]] = [current[index], current[index-1]];
    } else if (direction === 'down' && index < current.length - 1) {
      [current[index], current[index+1]] = [current[index+1], current[index]];
    } else return;
    const updated = current.map((r, i) => ({ ...r, rank: i + 1 }));
    setRankings({ ...rankings, [groupId]: updated });
    axios.put(`/api/stages/groups/${groupId}/rank`, { rankings: updated }, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    }).catch(err => console.error(err));
  };

  const handleMatchClick = (match) => {
    if (!user || !match.id) return;
    setSelectedMatch(match);
    setShowModal(true);
  };

  const getGroupMatches = (groupId) => matches.filter(m => m.group_id === groupId);

  return (
    <div>
      {groups.map(group => {
        const groupMatches = getGroupMatches(group.id);
        return (
          <div key={group.id} className="card mb-4 border-0 shadow-sm" style={{ borderRadius: 16 }}>
            <div className="card-header bg-white border-0 pt-3 pb-2">
              <h6 className="fw-bold mb-0" style={{ color: '#333', fontSize: '1.2rem'}}>{group.name} - 比赛对阵</h6>
              {groupMatches.length === 0 && (
                <small className="text-muted">请先在管理后台生成对阵</small>
              )}
            </div>

            {groupMatches.length > 0 && (
              <div className="table-responsive px-3">
                <table className="table table-borderless table-sm align-middle">
                  <thead className="text-muted" style={{ fontSize: '0.8rem' }}>
                    <tr>
                      <th>选手A</th>
                      <th>选手B</th>
                      <th className="text-center" style={{ width: 100 }}>比分</th>
                    </tr>
                  </thead>
                  <tbody style={{ fontSize: '0.9rem' }}>
                    {groupMatches.map(match => {
                      let scoreDisplay = '-';
                      let isWalkover = false;
                      let walkoverType = 'wo';
                      if (match.score_detail) {
                        try {
                          const detail = JSON.parse(match.score_detail);
                          if (detail.walkover) {
                            isWalkover = true;
                            walkoverType = detail.walkoverType || 'wo';
                            scoreDisplay = walkoverType === 'ret' ? 'RET.' : 'W/O';
                          } else if (detail.sets) {
                            scoreDisplay = detail.sets.map(s => s.join('-')).join(', ');
                          }
                        } catch(e) {}
                      }
                      const isFinished = match.status === 'finished';
                      const p1Winner = match.winner_id === match.player1_id;
                      const p2Winner = match.winner_id === match.player2_id;

                      return (
                        <tr
                          key={match.id}
                          onClick={() => handleMatchClick(match)}
                          style={{ cursor: user ? 'pointer' : 'default', borderBottom: '1px solid #f0f0f0' }}
                        >
                          <td className={p1Winner ? 'fw-bold' : ''}
                            style={{ color: p1Winner ? '#7B1FA2' : '#333' }}>
                            {match.player1_name}{match.player1_seed ? `[${match.player1_seed}]` : ''}
                          </td>
                          <td className={p2Winner ? 'fw-bold' : ''}
                            style={{ color: p2Winner ? '#7B1FA2' : '#333' }}>
                            {match.player2_name}{match.player2_seed ? `[${match.player2_seed}]` : ''}
                          </td>
                          <td className="text-center" style={{ width: 300 }}>
                            {isFinished ? (
                              <span className="fw-bold" style={{
                                color: isWalkover && walkoverType === 'ret' ? '#E57373' : '#7B1FA2'
                              }}>
                                {scoreDisplay}
                              </span>
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
            <div className="card-footer bg-white border-0 px-3 pb-3">
              <h6 className="fw-bold mb-2" style={{ color: '#333', fontSize: '1.2rem'}}>当前排名</h6>
              <table className="table table-sm table-borderless align-middle">
                <thead className="text-muted" style={{ fontSize: '0.8rem' }}>
                  <tr>
                    <th className="text-center">#</th>
                    <th>选手</th>
                    <th className="text-center">胜负盘</th>
                    <th className="text-center">胜盘率</th>
                    <th className="text-center">胜负局</th>
                    <th className="text-center">胜局率</th>
                    {user && <th className="text-center">调整</th>}
                  </tr>
                </thead>
                <tbody style={{ fontSize: '0.9rem' }}>
                  {(groupMembers[group.id] || [])
                    .sort((a, b) => {
                      const ra = rankings[group.id]?.find(r => r.player_id === a.player_id)?.rank || 999;
                      const rb = rankings[group.id]?.find(r => r.player_id === b.player_id)?.rank || 999;
                      return ra - rb;
                    })
                    .map((member, idx) => {
                      const currentRank = rankings[group.id]?.find(r => r.player_id === member.player_id)?.rank || '-';
                      const stats = calcPlayerStats(member.player_id, group.id);
                      return (
                        <tr key={member.player_id} style={{ backgroundColor: idx % 2 === 0 ? '#fafafa' : '#fff' }}>
                          <td className="text-center fw-bold" style={{ color: '#7B1FA2' }}>{currentRank}</td>
                          <td>{member.player_name}{member.player_seed ? `[${member.player_seed}]` : ''}</td>
                          <td className="text-center">{stats.winSets}-{stats.lostSets}</td>
                          <td className="text-center">{stats.setWinRate}</td>
                          <td className="text-center">{stats.winGames}-{stats.lostGames}</td>
                          <td className="text-center">{stats.gameWinRate}</td>
                          {user && (
                            <td className="text-center">
                              <button className="btn btn-sm btn-outline-secondary me-1 py-0 px-1" onClick={() => moveRank(group.id, member.player_id, 'up')}>↑</button>
                              <button className="btn btn-sm btn-outline-secondary py-0 px-1" onClick={() => moveRank(group.id, member.player_id, 'down')}>↓</button>
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
          onSaved={() => { setShowModal(false); onUpdate(); }}
          user={user}
        />
      )}
    </div>
  );
}