const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

// 获取某比赛所有比赛（通过 stage 关联）
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

// 创建比赛
router.post('/', auth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: '仅管理员' });
  const { stage_id, group_id, round, position, player1_id, player2_id, player1_source, player2_source, player1_source_match_id, player2_source_match_id } = req.body;
  const info = db.prepare(`INSERT INTO matches (stage_id, group_id, round, position, player1_id, player2_id, player1_source, player2_source, player1_source_match_id, player2_source_match_id)
    VALUES (?,?,?,?,?,?,?,?,?,?)`)
    .run(stage_id, group_id || null, round, position, player1_id, player2_id, player1_source || 'player', player2_source || 'player', player1_source_match_id || null, player2_source_match_id || null);
  res.json({ id: info.lastInsertRowid });
});

// 更新比赛对阵
router.put('/:id/players', auth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: '仅管理员' });
  const { player1_id, player2_id } = req.body;
  db.prepare('UPDATE matches SET player1_id=?, player2_id=? WHERE id=?').run(player1_id, player2_id, req.params.id);
  res.json({ success: true });
});

// 提交比分
router.put('/:id', auth, async (req, res) => {
  const { score_detail, court, referee_name, status, walkover_type } = req.body;
  const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(req.params.id);
  if (!match) return res.status(404).json({ error: '比赛不存在' });

  let winner_id = null;
  if (walkover_type) {
    winner_id = walkover_type === 'player1' ? match.player1_id : match.player2_id;
  } else if (score_detail) {
    const detail = JSON.parse(score_detail);
    if (detail.walkover) {
      winner_id = detail.winnerWalkover === 1 ? match.player1_id : match.player2_id;
    } else {
      const sets = detail.sets;
      let p1Sets = 0, p2Sets = 0;
      sets.forEach(set => {
        const g1 = parseInt(set[0]), g2 = parseInt(set[1]);
        if (g1 > g2) p1Sets++;
        else if (g2 > g1) p2Sets++;
      });
      if (p1Sets > p2Sets) winner_id = match.player1_id;
      else if (p2Sets > p1Sets) winner_id = match.player2_id;
    }
  }

  db.prepare(`UPDATE matches SET score_detail=?, court=?, referee_name=?, status=?, walkover_type=?, winner_id=? WHERE id=?`)
    .run(score_detail || null, court || null, referee_name || null, status || 'finished', walkover_type || null, winner_id, req.params.id);

  // 淘汰赛自动晋级
  if (match.stage_id) {
    const stage = db.prepare('SELECT type FROM stages WHERE id = ?').get(match.stage_id);
    if (stage && stage.type === 'knockout') {
      updateKnockoutBracket(match);
    }
  }

  res.json({ success: true });
});

// 删除比赛
router.delete('/:id', auth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: '仅管理员' });
  // 先删除引用该比赛作为来源的下一轮比赛关联（设空）
  db.prepare('UPDATE matches SET player1_id = NULL WHERE player1_source_match_id = ?').run(req.params.id);
  db.prepare('UPDATE matches SET player2_id = NULL WHERE player2_source_match_id = ?').run(req.params.id);
  // 删除比赛本身
  db.prepare('DELETE FROM matches WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

function updateKnockoutBracket(match) {
  const nextMatches = db.prepare(`
    SELECT * FROM matches WHERE 
    player1_source_match_id = ? OR player2_source_match_id = ?
  `).all(match.id, match.id);

  for (const next of nextMatches) {
    let p1 = next.player1_id, p2 = next.player2_id;
    if (next.player1_source_match_id === match.id && match.winner_id) {
      p1 = match.winner_id;
    }
    if (next.player2_source_match_id === match.id && match.winner_id) {
      p2 = match.winner_id;
    }
    db.prepare('UPDATE matches SET player1_id=?, player2_id=? WHERE id=?').run(p1, p2, next.id);
  }
}

// 批量删除某阶段的小组赛比赛
router.delete('/batch/group-matches/:stageId', auth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: '仅管理员' });
  const stageId = parseInt(req.params.stageId);
  
  // 先清空引用
  db.prepare(`
    UPDATE matches SET player1_id = NULL, player2_id = NULL 
    WHERE (player1_source_match_id IN (SELECT id FROM matches WHERE stage_id = ? AND group_id IS NOT NULL))
       OR (player2_source_match_id IN (SELECT id FROM matches WHERE stage_id = ? AND group_id IS NOT NULL))
  `).run(stageId, stageId);
  
  // 删除小组赛比赛
  const result = db.prepare('DELETE FROM matches WHERE stage_id = ? AND group_id IS NOT NULL').run(stageId);
  res.json({ success: true, deleted: result.changes || 0 });
});

module.exports = router;