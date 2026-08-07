const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

router.get('/by-tournament/:id', (req, res) => {
  const matches = db.prepare(`
    SELECT m.*, p1.name as player1_name, p1.seed as player1_seed,
           p2.name as player2_name, p2.seed as player2_seed
    FROM matches m
    LEFT JOIN players p1 ON m.player1_id = p1.id
    LEFT JOIN players p2 ON m.player2_id = p2.id
    WHERE m.stage_id IN (SELECT id FROM stages WHERE tournament_id = ?)
    ORDER BY m.round, m.position
  `).all(req.params.id);
  res.json(matches);
});

router.post('/', auth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: '仅管理员' });
  const { stage_id, group_id, round, position, player1_id, player2_id } = req.body;
  const info = db.prepare(`INSERT INTO matches (stage_id, group_id, round, position, player1_id, player2_id) VALUES (?,?,?,?,?,?)`)
    .run(stage_id, group_id || null, round, position, player1_id, player2_id);
  res.json({ id: info.lastInsertRowid });
});

router.put('/:id/players', auth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: '仅管理员' });
  const { player1_id, player2_id } = req.body;
  db.prepare('UPDATE matches SET player1_id=?, player2_id=? WHERE id=?').run(player1_id || null, player2_id || null, req.params.id);
  res.json({ success: true });
});

router.put('/:id', auth, async (req, res) => {
  const { score_detail, court, referee_name, notes, status, walkover_type } = req.body;
  const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(req.params.id);
  if (!match) return res.status(404).json({ error: '比赛不存在' });

  let winner_id = null;
  if (score_detail) {
    try {
      const detail = JSON.parse(score_detail);
      if (detail.walkover) {
        winner_id = detail.winnerWalkover === 1 ? match.player1_id : match.player2_id;
      } else if (detail.sets) {
        let p1Sets = 0, p2Sets = 0;
        detail.sets.forEach(set => {
          const g1 = parseInt(set[0]), g2 = parseInt(set[1]);
          if (isNaN(g1) || isNaN(g2)) return;
          if (g1 > g2) p1Sets++;
          else if (g2 > g1) p2Sets++;
        });
        winner_id = p1Sets > p2Sets ? match.player1_id : match.player2_id;
      }
    } catch(e) {}
  }

  db.prepare(`UPDATE matches SET score_detail=?, court=?, referee_name=?, notes=?, status=?, walkover_type=?, winner_id=? WHERE id=?`)
    .run(score_detail || null, court || null, referee_name || null, notes || null, status || 'finished', walkover_type || null, winner_id, req.params.id);

  res.json({ success: true });
});

router.delete('/:id', auth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: '仅管理员' });
  db.prepare('DELETE FROM matches WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

router.delete('/batch/group-matches/:stageId', auth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: '仅管理员' });
  const stageId = parseInt(req.params.stageId);
  const result = db.prepare('DELETE FROM matches WHERE stage_id = ? AND group_id IS NOT NULL').run(stageId);
  res.json({ success: true, deleted: result.changes || 0 });
});

module.exports = router;