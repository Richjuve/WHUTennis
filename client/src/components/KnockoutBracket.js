import React, { useEffect, useState } from 'react';
import { Button } from 'react-bootstrap';
import axios from 'axios';
import ScoreModal from './ScoreModal';

export default function KnockoutBracket({ stageId, matches, user, onUpdate, tournamentConfig }) {
  const [showModal, setShowModal] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [roundLabels, setRoundLabels] = useState({});
  const [hasThirdPlace, setHasThirdPlace] = useState(false);

  useEffect(() => {
    axios.get(`/api/stages/${stageId}`).then(res => {
      if (res.data.rounds_config) {
        const map = {};
        res.data.rounds_config.forEach(r => { map[r.round] = r.label; });
        setRoundLabels(map);
      }
      setHasThirdPlace(!!res.data.has_third_place);
    }).catch(err => console.error('加载阶段配置失败:', err));
  }, [stageId]);

  const getRoundLabel = (round) => {
    if (round === 'third_place') return '季军赛';
    return roundLabels[String(round)] || `第${round}轮`;
  };

  const mainMatches = matches.filter(m => m.round !== 'third_place');
  const thirdPlaceMatch = matches.find(m => m.round === 'third_place');
  const rounds = [...new Set(mainMatches.map(m => m.round))].sort((a, b) => Number(a) - Number(b));

  const handleSelectMatch = (match) => {
    if (!user) return;
    setSelectedMatch(match);
    setShowModal(true);
  };

  const renderMatchCard = (match, isThirdPlace = false) => {
    let sets = [];
    let walkover = false;

    if (match.score_detail) {
      try {
        const detail = JSON.parse(match.score_detail);
        if (detail.walkover) {
          walkover = true;
        } else if (detail.sets) {
          sets = detail.sets;
        }
      } catch (e) {}
    }

    const p1Name = `${match.player1_name || 'TBD'}${match.player1_seed ? `[${match.player1_seed}]` : ''}`;
    const p2Name = `${match.player2_name || 'TBD'}${match.player2_seed ? `[${match.player2_seed}]` : ''}`;
    const p1Winner = match.winner_id === match.player1_id;
    const p2Winner = match.winner_id === match.player2_id;
    const isFinished = match.status === 'finished';

    return (
      <div
        className={`border p-3 mb-3 bg-white rounded-3 ${isThirdPlace ? 'border-warning' : ''}`}
        style={{
          cursor: user ? 'pointer' : 'default',
          boxShadow: isFinished && (p1Winner || p2Winner) ? '0 2px 12px rgba(123, 31, 162, 0.15)' : '0 1px 3px rgba(0,0,0,0.05)',
          borderLeft: isFinished && (p1Winner || p2Winner) ? '4px solid #7B1FA2' : '1px solid #e0e0e0',
          transition: 'all 0.2s',
          minWidth: 200,
        }}
        onClick={() => handleSelectMatch(match)}
        title={user ? (isFinished ? '点击查看/编辑比分' : '点击录入比分') : ''}
      >
        <table className="mb-0" style={{ fontSize: '0.85rem', width: '100%' }}>
          <tbody>
            <tr>
              <td
                className={`py-1 text-nowrap ${p1Winner ? 'fw-bold' : ''}`}
                style={{
                  paddingRight: 12,
                  maxWidth: 100,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  color: p1Winner ? '#7B1FA2' : '#333'
                }}
              >
                {p1Name}
              </td>
              {sets.map((set, idx) => (
                <td
                  key={idx}
                  className={`text-center px-0 py-1 ${p1Winner ? 'fw-bold' : ''}`}
                  style={{ width: 32, color: p1Winner ? '#7B1FA2' : '#333' }}
                >
                  {set[0]}
                </td>
              ))}
              {walkover && p1Winner && (
                <td className="text-center text-success fw-bold" style={{ width: 40 }}>W/O</td>
              )}
              {sets.length === 0 && !walkover && isFinished && (
                <td className="text-center text-success fw-bold" style={{ width: 40 }}>W/O</td>
              )}
              {sets.length === 0 && !walkover && !isFinished && (
                <td className="text-center text-muted" style={{ width: 32 }}>-</td>
              )}
            </tr>
            <tr>
              <td
                className={`py-1 text-nowrap ${p2Winner ? 'fw-bold' : ''}`}
                style={{
                  paddingRight: 12,
                  maxWidth: 100,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  color: p2Winner ? '#7B1FA2' : '#333'
                }}
              >
                {p2Name}
              </td>
              {sets.map((set, idx) => (
                <td
                  key={idx}
                  className={`text-center px-0 py-1 ${p2Winner ? 'fw-bold' : ''}`}
                  style={{ width: 32, color: p2Winner ? '#7B1FA2' : '#333' }}
                >
                  {set[1]}
                </td>
              ))}
              {walkover && p2Winner && (
                <td className="text-center text-success fw-bold" style={{ width: 40 }}>W/O</td>
              )}
              {sets.length === 0 && !walkover && isFinished && (
                <td className="text-center text-success fw-bold" style={{ width: 40 }}>W/O</td>
              )}
              {sets.length === 0 && !walkover && !isFinished && (
                <td className="text-center text-muted" style={{ width: 32 }}>-</td>
              )}
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div>
      <div id="bracket-container" style={{ overflowX: 'auto' }}>
        <div className="d-flex align-items-start">
          {rounds.map(round => (
            <div
              key={round}
              className="d-flex flex-column justify-content-around"
              style={{ minWidth: 230, marginRight: 20 }}
            >
              <div className="text-center fw-bold mb-3" style={{ color: '#333', fontSize: '0.9rem' }}>
                {getRoundLabel(round)}
              </div>
              {mainMatches
                .filter(m => m.round === round)
                .sort((a, b) => a.position - b.position)
                .map(match => (
                  <div key={match.id}>{renderMatchCard(match)}</div>
                ))}
            </div>
          ))}

          {hasThirdPlace && thirdPlaceMatch && (
            <div
              className="d-flex flex-column justify-content-center"
              style={{ minWidth: 230, marginLeft: 20 }}
            >
              <div className="text-center fw-bold mb-3" style={{ color: '#F4A261', fontSize: '0.9rem' }}>
                🥉 季军赛
              </div>
              {renderMatchCard(thirdPlaceMatch, true)}
            </div>
          )}
        </div>
      </div>

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