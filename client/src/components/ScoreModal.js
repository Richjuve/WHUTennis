import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, Row, Col } from 'react-bootstrap';
import axios from 'axios';

export default function ScoreModal({ match, tournamentConfig, show, onHide, onSaved, user }) {
  const bestOfSets = tournamentConfig?.bestOfSets || 3;
  const [sets, setSets] = useState(Array.from({ length: bestOfSets }, () => ['', '']));
  const [walkover, setWalkover] = useState(false);
  const [walkoverType, setWalkoverType] = useState('wo');
  const [winnerWalkover, setWinnerWalkover] = useState(1);
  const [court, setCourt] = useState('');
  const [referee, setReferee] = useState('');
  const [notes, setNotes] = useState('');
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
            setWalkoverType(detail.walkoverType || 'wo');
            setWinnerWalkover(detail.winnerWalkover || 1);
            if (detail.walkoverType === 'ret' && detail.sets && detail.sets.length > 0) {
              const loadedSets = emptySets.map((_, i) =>
                detail.sets[i] ? [detail.sets[i][0] || '', detail.sets[i][1] || ''] : ['', '']
              );
              setSets(loadedSets);
            } else {
              setSets(emptySets);
            }
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
      setNotes(match.notes || '');
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
      const setsData = sets.filter(s => s[0] !== '' || s[1] !== '');
      scoreDetail = JSON.stringify({
        walkover: true,
        winnerWalkover,
        walkoverType,
        sets: setsData.length > 0 ? setsData : undefined
      });
    } else {
      scoreDetail = JSON.stringify({ sets: sets.filter(s => s[0] !== '' || s[1] !== '') });
    }
    try {
      await axios.put(`/api/matches/${match.id}`, {
        score_detail: scoreDetail,
        court: court || null,
        referee_name: referee || null,
        notes: notes || null,
        status: 'finished',
        walkover_type: walkover ? walkoverType : null
      }, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      onSaved();
    } catch (err) {
      alert(err.response?.data?.error || '保存失败');
    }
  };

  const formatSetsDisplay = () => {
    const isPlayer1Winner = match.winner_id === match.player1_id;
    if (walkover) {
      if (walkoverType === 'ret') {
        const setsStr = sets
          .filter(s => s[0] !== '' || s[1] !== '')
          .map(s => {
            let g1 = s[0] !== '' ? s[0] : '0';
            let g2 = s[1] !== '' ? s[1] : '0';
            if (!isPlayer1Winner) [g1, g2] = [g2, g1];
            return g1 + '-' + g2;
          })
          .join(', ');
        return (setsStr || '0-0') + ' (RET.)';
      }
      return 'W/O';
    }
    return sets
      .filter(s => s[0] !== '' || s[1] !== '')
      .map(s => {
        let g1 = s[0] !== '' ? s[0] : '0';
        let g2 = s[1] !== '' ? s[1] : '0';
        if (!isPlayer1Winner) [g1, g2] = [g2, g1];
        return g1 + '-' + g2;
      })
      .join(', ') || '未录入';
  };

  return (
    <Modal 
      show={show} 
      onHide={onHide} 
      size="lg" 
      centered
      contentClassName="border-0 shadow-lg rounded-4"
      dialogClassName="modal-dialog-centered"
    >
      <Modal.Header closeButton className="border-0 pb-0">
        <Modal.Title className="fw-bold" style={{ color: '#7B1FA2' }}>
          {editing ? '✍️ 编辑比分' : '📋 比赛详情'}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body className="pt-2">
        {!editing ? (
          <div className="p-4 bg-light rounded-3 d-flex flex-column align-items-center justify-content-center" style={{ minHeight: '120px' }}>
            <div className="d-flex align-items-center gap-4 mb-3">
              <span className="fw-bold" style={{ color: '#7B1FA2', fontSize: '1.2rem' }}>
                {match.winner_id === match.player1_id
                  ? match.player1_name + (match.player1_seed ? `[${match.player1_seed}]` : '')
                  : match.player2_name + (match.player2_seed ? `[${match.player2_seed}]` : '')}
              </span>
              <div className="bg-white rounded-3 px-4 py-2 shadow-sm">
                <span className="fw-bold fs-5" style={{ color: '#7B1FA2' }}>
                  {hasExistingScore ? formatSetsDisplay() : '未录入'}
                </span>
              </div>
              <span style={{ fontSize: '1.2rem' }}>
                {match.winner_id === match.player1_id
                  ? match.player2_name + (match.player2_seed ? `[${match.player2_seed}]` : '')
                  : match.player1_name + (match.player1_seed ? `[${match.player1_seed}]` : '')}
              </span>
            </div>
            {(court || referee || notes) && (
              <div className="d-flex justify-content-center gap-3 text-muted small">
                {court && <span>📍 {court}</span>}
                {referee && <span>👨‍⚖️ {referee}</span>}
                {notes && <span>📝 {notes}</span>}
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="text-center mb-3">
              <span className="fw-bold fs-5">{match.player1_name}{match.player1_seed ? `[${match.player1_seed}]` : ''}</span>
              <span className="mx-2 text-muted">VS</span>
              <span className="fw-bold fs-5">{match.player2_name}{match.player2_seed ? `[${match.player2_seed}]` : ''}</span>
            </div>

            <div className="mb-3">
              <label className="form-label small fw-bold text-muted mb-2">比赛类型</label>
              <div className="d-flex gap-3">
                <label 
                  className="flex-fill text-center py-3 rounded-4 border fw-bold fs-6"
                  style={{ 
                    cursor: 'pointer', 
                    transition: 'all 0.2s',
                    borderColor: !walkover ? '#7B1FA2' : '#dee2e6',
                    backgroundColor: !walkover ? 'rgba(123, 31, 162, 0.1)' : '#fff',
                    color: !walkover ? '#7B1FA2' : '#333'
                  }}
                  onClick={() => setWalkover(false)}
                >
                  <input type="radio" name="walkoverType" checked={!walkover} onChange={() => {}} style={{ display: 'none' }} />
                  正常比赛
                </label>
                <label 
                  className="flex-fill text-center py-3 rounded-4 border fw-bold fs-6"
                  style={{ 
                    cursor: 'pointer', 
                    transition: 'all 0.2s',
                    borderColor: walkover && walkoverType === 'wo' ? '#7B1FA2' : '#dee2e6',
                    backgroundColor: walkover && walkoverType === 'wo' ? 'rgba(123, 31, 162, 0.1)' : '#fff',
                    color: walkover && walkoverType === 'wo' ? '#7B1FA2' : '#333'
                  }}
                  onClick={() => { setWalkover(true); setWalkoverType('wo'); }}
                >
                  <input type="radio" name="walkoverType" checked={walkover && walkoverType === 'wo'} onChange={() => {}} style={{ display: 'none' }} />
                  W/O
                </label>
                <label 
                  className="flex-fill text-center py-3 rounded-4 border fw-bold fs-6"
                  style={{ 
                    cursor: 'pointer', 
                    transition: 'all 0.2s',
                    borderColor: walkover && walkoverType === 'ret' ? '#E57373' : '#dee2e6',
                    backgroundColor: walkover && walkoverType === 'ret' ? 'rgba(229, 115, 115, 0.1)' : '#fff',
                    color: walkover && walkoverType === 'ret' ? '#E57373' : '#333'
                  }}
                  onClick={() => { setWalkover(true); setWalkoverType('ret'); }}
                >
                  <input type="radio" name="walkoverType" checked={walkover && walkoverType === 'ret'} onChange={() => {}} style={{ display: 'none' }} />
                  RET.
                </label>
              </div>
            </div>

            {walkover && (
              <div className="mb-3">
                <Form.Select
                  value={winnerWalkover}
                  onChange={e => setWinnerWalkover(parseInt(e.target.value))}
                  className="rounded-3"
                >
                  <option value={1}>{match.player1_name} 胜</option>
                  <option value={2}>{match.player2_name} 胜</option>
                </Form.Select>
              </div>
            )}

            {(!walkover || walkoverType === 'ret') && (
              <div className="bg-white rounded-3 p-3 mb-3 border">
                <label className="form-label small fw-bold text-muted mb-2">盘分</label>
                {sets.map((set, i) => (
                  <Row key={i} className="mb-2 align-items-center">
                    <Col xs={2}>
                      <span className="small text-muted">第{i + 1}盘</span>
                    </Col>
                    <Col xs={5}>
                      <Form.Control
                        type="text"
                        placeholder={match.player1_name}
                        value={set[0]}
                        onChange={e => handleSetChange(i, 0, e.target.value)}
                        className="rounded-3"
                      />
                    </Col>
                    <Col xs={5}>
                      <Form.Control
                        type="text"
                        placeholder={match.player2_name}
                        value={set[1]}
                        onChange={e => handleSetChange(i, 1, e.target.value)}
                        className="rounded-3"
                      />
                    </Col>
                  </Row>
                ))}
              </div>
            )}

            <Row className="g-2 mb-2">
              <Col md={6}>
                <Form.Group>
                  <Form.Label className="small text-muted">📍 场地</Form.Label>
                  <Form.Control 
                    value={court} 
                    onChange={e => setCourt(e.target.value)} 
                    placeholder="如 1号场" 
                    className="rounded-3"
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label className="small text-muted">👨‍⚖️ 裁判员</Form.Label>
                  <Form.Control 
                    value={referee} 
                    onChange={e => setReferee(e.target.value)} 
                    placeholder="裁判姓名" 
                    className="rounded-3"
                  />
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-2">
              <Form.Label className="small text-muted">📝 备注</Form.Label>
              <Form.Control 
                as="textarea" 
                rows={4} 
                value={notes} 
                onChange={e => setNotes(e.target.value)} 
                placeholder="备注信息（如因雨暂停、场地变更等）" 
                className="rounded-3"
                style={{ resize: 'vertical' }}
              />
            </Form.Group>
          </>
        )}
      </Modal.Body>
      <Modal.Footer className="border-0 pt-0">
        {editing ? (
          <>
            <Button variant="light" onClick={() => setEditing(false)} className="rounded-3 px-4">取消</Button>
            <Button variant="primary" onClick={submit} className="rounded-3 px-4">保存比分</Button>
          </>
        ) : (
          <>
            <Button variant="light" onClick={onHide} className="rounded-3 px-4">关闭</Button>
            {hasExistingScore && (
              <Button variant="warning" onClick={() => setEditing(true)} className="rounded-3 px-4">编辑</Button>
            )}
          </>
        )}
      </Modal.Footer>
    </Modal>
  );
}