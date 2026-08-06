const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

router.get('/', (req, res) => {
  const tournaments = db.prepare('SELECT * FROM tournaments ORDER BY created_at DESC').all();
  res.json(tournaments);
});

router.get('/:id', (req, res) => {
  const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(req.params.id);
  if (!tournament) return res.status(404).json({ error: '比赛不存在' });
  tournament.scoring_config = JSON.parse(tournament.scoring_config);
  res.json(tournament);
});

router.post('/', auth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: '仅管理员' });
  const { name, scoring_config } = req.body;
  const config = scoring_config || { bestOfSets: 3, gamesPerSet: 6, tiebreak: true };
  const info = db.prepare('INSERT INTO tournaments (name, scoring_config) VALUES (?,?)')
    .run(name, JSON.stringify(config));
  res.json({ id: info.lastInsertRowid });
});

router.put('/:id', auth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: '仅管理员' });
  const { name, scoring_config, status } = req.body;
  if (scoring_config) db.prepare('UPDATE tournaments SET scoring_config = ? WHERE id = ?').run(JSON.stringify(scoring_config), req.params.id);
  if (name) db.prepare('UPDATE tournaments SET name = ? WHERE id = ?').run(name, req.params.id);
  if (status) db.prepare('UPDATE tournaments SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ success: true });
});

router.delete('/:id', auth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: '仅管理员' });
  db.prepare('DELETE FROM tournaments WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;