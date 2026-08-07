const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

router.get('/by-tournament/:id', (req, res) => {
  const stages = db.prepare('SELECT * FROM stages WHERE tournament_id = ? ORDER BY order_index').all(req.params.id);
  res.json(stages);
});

router.post('/', auth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: '仅管理员' });
  const { tournament_id, name, type, games_per_set } = req.body;
  const order = db.prepare('SELECT MAX(order_index) as max FROM stages WHERE tournament_id = ?').get(tournament_id).max || 0;
  const info = db.prepare('INSERT INTO stages (tournament_id, name, type, order_index, games_per_set) VALUES (?,?,?,?,?)')
    .run(tournament_id, name, type, order + 1, games_per_set || 6);
  res.json({ id: info.lastInsertRowid });
});

router.put('/:id', auth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: '仅管理员' });
  const { name, has_third_place, total_rounds } = req.body;
  if (name !== undefined) db.prepare('UPDATE stages SET name = ? WHERE id = ?').run(name, req.params.id);
  if (has_third_place !== undefined) db.prepare('UPDATE stages SET has_third_place = ? WHERE id = ?').run(has_third_place ? 1 : 0, req.params.id);
  if (total_rounds !== undefined) db.prepare('UPDATE stages SET total_rounds = ? WHERE id = ?').run(total_rounds, req.params.id);
  res.json({ success: true });
});

router.delete('/:id', auth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: '仅管理员' });
  db.prepare('DELETE FROM stages WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// 获取阶段详情
router.get('/:id', (req, res) => {
  const stage = db.prepare('SELECT * FROM stages WHERE id = ?').get(req.params.id);
  if (!stage) return res.status(404).json({ error: '阶段不存在' });
  try {
    stage.rounds_config = stage.rounds_config ? JSON.parse(stage.rounds_config) : [];
  } catch (e) {
    stage.rounds_config = [];
  }
  res.json(stage);
});

// 保存轮次配置
router.put('/:id/rounds', auth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: '仅管理员' });
  const { rounds_config } = req.body;
  db.prepare('UPDATE stages SET rounds_config = ? WHERE id = ?')
    .run(JSON.stringify(rounds_config || []), req.params.id);
  res.json({ success: true });
});

// 小组相关
router.get('/:stageId/groups', (req, res) => {
  const groups = db.prepare('SELECT * FROM groups WHERE stage_id = ?').all(req.params.stageId);
  res.json(groups);
});

router.post('/:stageId/groups', auth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: '仅管理员' });
  const { name } = req.body;
  const info = db.prepare('INSERT INTO groups (stage_id, name) VALUES (?,?)').run(req.params.stageId, name);
  res.json({ id: info.lastInsertRowid });
});

router.delete('/groups/:groupId', auth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: '仅管理员' });
  db.prepare('DELETE FROM groups WHERE id = ?').run(req.params.groupId);
  res.json({ success: true });
});

router.get('/groups/:groupId/members', (req, res) => {
  const members = db.prepare(`
    SELECT gp.player_id, gp.final_rank, p.name as player_name, p.seed as player_seed
    FROM group_players gp
    JOIN players p ON gp.player_id = p.id
    WHERE gp.group_id = ?
    ORDER BY gp.final_rank ASC, gp.id ASC
  `).all(req.params.groupId);
  res.json(members);
});

router.post('/groups/:groupId/players', auth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: '仅管理员' });
  const { player_id } = req.body;
  try {
    const maxRank = db.prepare('SELECT MAX(final_rank) as max FROM group_players WHERE group_id = ?').get(req.params.groupId);
    const nextRank = (maxRank && maxRank.max) ? maxRank.max + 1 : 1;
    db.prepare('INSERT INTO group_players (group_id, player_id, final_rank) VALUES (?,?,?)')
      .run(req.params.groupId, player_id, nextRank);
    res.json({ success: true, rank: nextRank });
  } catch (e) {
    res.status(400).json({ error: '添加失败，可能已存在' });
  }
});

router.delete('/groups/:groupId/players/:playerId', auth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: '仅管理员' });
  db.prepare('DELETE FROM group_players WHERE group_id = ? AND player_id = ?')
    .run(req.params.groupId, req.params.playerId);
  const remaining = db.prepare('SELECT id FROM group_players WHERE group_id = ? ORDER BY final_rank ASC, id ASC')
    .all(req.params.groupId);
  remaining.forEach((item, index) => {
    db.prepare('UPDATE group_players SET final_rank = ? WHERE id = ?').run(index + 1, item.id);
  });
  res.json({ success: true });
});

router.put('/groups/:groupId/rank', auth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: '仅管理员' });
  const { rankings } = req.body;
  if (!rankings || !Array.isArray(rankings)) {
    return res.status(400).json({ error: '排名数据格式错误' });
  }
  try {
    for (const item of rankings) {
      db.prepare('UPDATE group_players SET final_rank = ? WHERE group_id = ? AND player_id = ?')
        .run(item.rank, parseInt(req.params.groupId), item.player_id);
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '保存排名失败: ' + e.message });
  }
});

module.exports = router;