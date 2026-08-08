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
  const [gamesPerSet, setGamesPerSet] = useState(6);

  useEffect(() => {
    axios.get(`/api/stages/${stageId}`).then(res => {
      setGamesPerSet(res.data.games_per_set || 6);
    });
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

  const calcPlayerStats = (playerId, groupId, bestOfSets) => {
    const playerMatches = matches.filter(m =>
      m.group_id === groupId &&
      (m.player1_id === playerId || m.player2_id === playerId) &&
      m.status === 'finished' && m.score_detail
    );
    let winSets = 0, lostSets = 0, winGames = 0, lostGames = 0;
    let winMatches = 0, lostMatches = 0;

    playerMatches.forEach(m => {
      try {
        const detail = JSON.parse(m.score_detail);
        const isPlayer1 = m.player1_id === playerId;

        let iWin;
        if (detail.walkover) {
          const winnerWalkover = detail.winnerWalkover;
          iWin = (winnerWalkover === 1 && isPlayer1) || (winnerWalkover === 2 && !isPlayer1);
        } else {
          iWin = m.winner_id === playerId;
        }

        if (iWin) winMatches++;
        else lostMatches++;

        if (detail.walkover) {
          if (detail.walkoverType === 'ret') {
            const setsToWin = Math.ceil(bestOfSets / 2);
            if (iWin) winSets += setsToWin;
            else lostSets += setsToWin;
            return;
          } else {
            if (iWin) {
              winSets += 1;
              winGames += gamesPerSet;
            } else {
              lostSets += 1;
              lostGames += gamesPerSet;
            }
            return;
          }
        }

        if (detail.sets) {
          detail.sets.forEach(set => {
            const rawG1 = String(set[0]).replace(/\(.*\)/, '');
            const rawG2 = String(set[1]).replace(/\(.*\)/, '');
            const g1 = parseInt(rawG1) || 0;
            const g2 = parseInt(rawG2) || 0;
            if (isNaN(g1) || isNaN(g2)) return;
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
      winMatches, lostMatches,
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

  const formatScore = (score) => {
    const str = String(score);
    const m = str.match(/^(\d+)\((\d+)\)$/);
    if (m) {
      const superscripts = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
      const sup = m[2].split('').map(c => superscripts[c] || c).join('');
      return <span>{m[1]}<sup style={{ fontSize: '0.85em' }}>{sup}</sup></span>;
    }
    return str;
  };

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
              <div className="px-3 pt-2">
                <div className="row g-2">
                  {groupMatches.map(match => {
                    let sets = [];
                    let walkover = false;
                    let walkoverType = 'wo';

                    if (match.score_detail) {
                      try {
                        const detail = JSON.parse(match.score_detail);
                        if (detail.walkover) {
                          walkover = true;
                          walkoverType = detail.walkoverType || 'wo';
                        } else if (detail.sets) {
                          sets = detail.sets;
                        }
                      } catch(e) {}
                    }

                    const p1Name = `${match.player1_name || 'TBD'}${match.player1_seed ? `[${match.player1_seed}]` : ''}`;
                    const p2Name = `${match.player2_name || 'TBD'}${match.player2_seed ? `[${match.player2_seed}]` : ''}`;
                    const p1Winner = match.winner_id === match.player1_id;
                    const p2Winner = match.winner_id === match.player2_id;
                    const isFinished = match.status === 'finished';

                    return (
                      <div key={match.id} className="col-12 col-md-6">
                        <div
                          className={`border p-3 bg-white rounded-3`}
                          style={{
                            cursor: user ? 'pointer' : 'default',
                            boxShadow: isFinished && (p1Winner || p2Winner) ? '0 2px 12px rgba(123, 31, 162, 0.1)' : '0 1px 3px rgba(0,0,0,0.05)',
                            borderLeft: isFinished && (p1Winner || p2Winner) ? '4px solid #7B1FA2' : '1px solid #e0e0e0',
                            transition: 'all 0.2s',
                            minHeight: '60px'
                          }}
                          onClick={() => handleMatchClick(match)}
                          title={user ? (isFinished ? '点击查看/编辑比分' : '点击录入比分') : ''}
                        >
                          <table className="mb-0" style={{ fontSize: '1.0rem', width: '100%' }}>
                            <tbody>
                              <tr>
                                <td
                                  className={`py-1 text-nowrap ${p1Winner ? 'fw-bold' : ''}`}
                                  style={{
                                    paddingRight: 12, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis',
                                    color: p1Winner ? '#7B1FA2' : '#333'
                                  }}
                                >
                                  {p1Name}
                                </td>
                                {sets.map((set, idx) => {
                                  const g1 = parseInt(set[0]);
                                  const g2 = parseInt(set[1]);
                                  const p1WonSet = !isNaN(g1) && !isNaN(g2) && g1 > g2;
                                  return (
                                    <td key={idx} className={`text-center px-0 py-1 ${p1WonSet ? 'fw-bold' : ''}`}
                                      style={{ width: 32, color: p1WonSet ? '#7B1FA2' : '#333', fontSize: '1.0rem', fontFamily: '"Futura", system-ui, -apple-system, sans-serif' }}>
                                      {formatScore(set[0])}
                                    </td>
                                  );
                                })}
                                {walkover && walkoverType === 'wo' && p1Winner && (
                                  <td className="text-center fw-bold" style={{ width: 40, color: '#7B1FA2', fontFamily: '"Futura", "Segoe UI", system-ui, -apple-system, sans-serif'}}>W/O</td>
                                )}
                                {walkover && walkoverType === 'ret' && !p1Winner && (
                                  <td className="text-center fw-bold" style={{ width: 40, color: '#E57373', fontFamily: '"Futura", "Segoe UI", system-ui, -apple-system, sans-serif'}}>RET.</td>
                                )}
                                {walkover && walkoverType === 'wo' && !p1Winner && <td style={{ width: 40 }}></td>}
                                {walkover && walkoverType === 'ret' && p1Winner && <td style={{ width: 40 }}></td>}
                                {!walkover && !isFinished && <td className="text-center text-muted" style={{ width: 32 }}>-</td>}
                              </tr>
                              <tr>
                                <td
                                  className={`py-1 text-nowrap ${p2Winner ? 'fw-bold' : ''}`}
                                  style={{
                                    paddingRight: 12, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis',
                                    color: p2Winner ? '#7B1FA2' : '#333'
                                  }}
                                >
                                  {p2Name}
                                </td>
                                {sets.map((set, idx) => {
                                  const g1 = parseInt(set[0]);
                                  const g2 = parseInt(set[1]);
                                  const p2WonSet = !isNaN(g1) && !isNaN(g2) && g2 > g1;
                                  return (
                                    <td key={idx} className={`text-center px-0 py-1 ${p2WonSet ? 'fw-bold' : ''}`}
                                      style={{ width: 32, color: p2WonSet ? '#7B1FA2' : '#333', fontSize: '1.0rem', fontFamily: '"Futura", system-ui, -apple-system, sans-serif' }}>
                                      {formatScore(set[1])}
                                    </td>
                                  );
                                })}
                                {walkover && walkoverType === 'wo' && p2Winner && (
                                  <td className="text-center fw-bold" style={{ width: 40, color: '#7B1FA2', fontFamily: '"Futura", "Segoe UI", system-ui, -apple-system, sans-serif'}}>W/O</td>
                                )}
                                {walkover && walkoverType === 'ret' && !p2Winner && (
                                  <td className="text-center fw-bold" style={{ width: 40, color: '#E57373', fontFamily: '"Futura", "Segoe UI", system-ui, -apple-system, sans-serif'}}>RET.</td>
                                )}
                                {walkover && walkoverType === 'wo' && !p2Winner && <td style={{ width: 40 }}></td>}
                                {walkover && walkoverType === 'ret' && p2Winner && <td style={{ width: 40 }}></td>}
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="card-footer bg-white border-0 px-3 pb-3">
              <h6 className="fw-bold mb-2" style={{ color: '#333', fontSize: '1.2rem'}}>当前排名</h6>
              <div className="table-responsive">
                <table className="table table-sm table-borderless align-middle">
                  <thead className="text-muted" style={{ fontSize: '0.8rem' }}>
                    <tr>
                      <th className="text-center text-nowrap">#</th>
                      <th className="text-nowrap">选手</th>
                      <th className="text-center text-nowrap">胜负场</th>
                      <th className="text-center text-nowrap">胜负盘</th>
                      <th className="text-center text-nowrap">胜盘率</th>
                      <th className="text-center text-nowrap">胜负局</th>
                      <th className="text-center text-nowrap">胜局率</th>
                      {user && <th className="text-center text-nowrap">调整</th>}
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
                        const stats = calcPlayerStats(member.player_id, group.id, tournamentConfig?.bestOfSets || 3);
                        return (
                          <tr key={member.player_id} style={{ backgroundColor: idx % 2 === 0 ? '#fafafa' : '#fff' }}>
                            <td className="text-center fw-bold text-nowrap" style={{ color: '#7B1FA2' }}>{currentRank}</td>
                            <td className="text-nowrap">{member.player_name}{member.player_seed ? `[${member.player_seed}]` : ''}</td>
                            <td className="text-center text-nowrap">{stats.winMatches}-{stats.lostMatches}</td>
                            <td className="text-center text-nowrap">{stats.winSets}-{stats.lostSets}</td>
                            <td className="text-center text-nowrap">{stats.setWinRate}</td>
                            <td className="text-center text-nowrap">{stats.winGames}-{stats.lostGames}</td>
                            <td className="text-center text-nowrap">{stats.gameWinRate}</td>
                            {user && (
                              <td className="text-center text-nowrap">
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