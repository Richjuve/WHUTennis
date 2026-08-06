import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, Row, Col } from 'react-bootstrap';
import axios from 'axios';

export default function ScoreModal({ match, tournamentConfig, show, onHide, onSaved, user }) {
  const bestOfSets = tournamentConfig?.bestOfSets || 3;
  const [sets, setSets] = useState(Array.from({ length: bestOfSets }, () => ['', '']));
  const [walkover, setWalkover] = useState(false);
  const [winnerWalkover, setWinnerWalkover] = useState(1);
  const [court, setCourt] = useState('');
  const [referee, setReferee] = useState('');
  const [editing, setEditing] = useState(false);
  const [hasExistingScore, setHasExistingScore] = useState(false);

  useEffect(() => {
    if (show && match) {
      const emptySets = Array.from({ length: bestOfSets }, () => ['', '']);

      if (match.score_detail) {
        try {
          const detail = JSON.parse(match.score_detail);
          if (detail.walkover) {
            setWalkover(true);
            setWinnerWalkover(detail.winnerWalkover || 1);
            setSets(emptySets);
            setHasExistingScore(true);
          } else if (detail.sets && detail.sets.length > 0) {
            const loadedSets = emptySets.map((_, i) =>
              detail.sets[i] ? [detail.sets[i][0] || '', detail.sets[i][1] || ''] : ['', '']
            );
            setSets(loadedSets);
            setWalkover(false);
            setHasExistingScore(true);
          } else {
            setSets(emptySets);
            setWalkover(false);
            setHasExistingScore(false);
          }
        } catch (e) {
          setSets(emptySets);
          setWalkover(false);
          setHasExistingScore(false);
        }
      } else {
        setSets(emptySets);
        setWalkover(false);
        setHasExistingScore(false);
      }

      setCourt(match.court || '');
      setReferee(match.referee_name || '');
      setEditing(!match.score_detail);
    }
  }, [show, match, bestOfSets]);

  const handleSetChange = (setIndex, playerIdx, value) => {
    const newSets = [...sets];
    newSets[setIndex][playerIdx] = value;
    setSets(newSets);
  };

  const submit = async () => {
    let scoreDetail;
    if (walkover) {
      scoreDetail = JSON.stringify({ walkover: true, winnerWalkover });
    } else {
      scoreDetail = JSON.stringify({ sets: sets.filter(s => s[0] !== '' || s[1] !== '') });
    }
    try {
      await axios.put(`/api/matches/${match.id}`, {
        score_detail: scoreDetail,
        court: court || null,
        referee_name: referee || null,
        status: 'finished',
        walkover_type: walkover ? (winnerWalkover === 1 ? 'player1' : 'player2') : null
      }, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      onSaved();
    } catch (err) {
      alert(err.response?.data?.error || '保存失败');
    }
  };

  const formatSetsDisplay = () => {
    if (walkover) {
      const winner = winnerWalkover === 1 ? match.player1_name : match.player2_name;
      return `W/O (${winner} 胜)`;
    }
    const display = sets
      .filter(s => s[0] !== '' || s[1] !== '')
      .map(s => `${s[0] || '-'}-${s[1] || '-'}`)
      .join(', ');
    return display || '未录入';
  };

  return (
    <Modal show={show} onHide={onHide} size="md">
      <Modal.Header closeButton>
        <Modal.Title>{editing ? '编辑比分' : '比赛详情'}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="mb-2">
          <strong>{match.player1_name}{match.player1_seed ? `[${match.player1_seed}]` : ''}</strong>
          {' vs '}
          <strong>{match.player2_name}{match.player2_seed ? `[${match.player2_seed}]` : ''}</strong>
        </p>

        {!editing ? (
          <div>
            <div className="mb-2">
              <strong>比分：</strong>
              {hasExistingScore ? (
                <span className="text-success">{formatSetsDisplay()}</span>
              ) : (
                <span className="text-muted">未录入</span>
              )}
            </div>
            {court && <div className="mb-2"><strong>场地：</strong>{court}</div>}
            {referee && <div className="mb-2"><strong>裁判员：</strong>{referee}</div>}
            {!court && !referee && hasExistingScore && (
              <div className="text-muted small">无场地/裁判信息</div>
            )}
          </div>
        ) : (
          <>
            <Form.Check
              type="checkbox"
              label="弃权/退赛"
              checked={walkover}
              onChange={e => setWalkover(e.target.checked)}
              className="mb-2"
            />
            {walkover && (
              <Form.Select
                className="mb-2"
                value={winnerWalkover}
                onChange={e => setWinnerWalkover(parseInt(e.target.value))}
              >
                <option value={1}>{match.player1_name} 胜</option>
                <option value={2}>{match.player2_name} 胜</option>
              </Form.Select>
            )}
            {!walkover && sets.map((set, i) => (
              <Row key={i} className="mb-2 align-items-center">
                <Col xs={2}>
                  <Form.Label className="mb-0">第{i + 1}盘</Form.Label>
                </Col>
                <Col xs={5}>
                  <Form.Control
                    type="text"
                    placeholder={match.player1_name}
                    value={set[0]}
                    onChange={e => handleSetChange(i, 0, e.target.value)}
                  />
                </Col>
                <Col xs={5}>
                  <Form.Control
                    type="text"
                    placeholder={match.player2_name}
                    value={set[1]}
                    onChange={e => handleSetChange(i, 1, e.target.value)}
                  />
                </Col>
              </Row>
            ))}
            <Form.Group className="mt-3">
              <Form.Label>场地</Form.Label>
              <Form.Control
                value={court}
                onChange={e => setCourt(e.target.value)}
                placeholder="如 1号场"
              />
            </Form.Group>
            <Form.Group className="mt-2">
              <Form.Label>裁判员</Form.Label>
              <Form.Control
                value={referee}
                onChange={e => setReferee(e.target.value)}
                placeholder="裁判姓名"
              />
            </Form.Group>
          </>
        )}
      </Modal.Body>
      <Modal.Footer>
        {editing ? (
          <>
            <Button variant="secondary" onClick={() => setEditing(false)}>取消编辑</Button>
            <Button variant="primary" onClick={submit}>保存比分</Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={onHide}>关闭</Button>
            {hasExistingScore && (
              <Button variant="warning" onClick={() => setEditing(true)}>编辑</Button>
            )}
          </>
        )}
      </Modal.Footer>
    </Modal>
  );
}