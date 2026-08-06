const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../db');
const auth = require('../middleware/auth');
const path = require('path');
const fs = require('fs');
const SECRET = 'school_tennis_secret_key';

router.post('/login', (req, res) => {
  const { student_id, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE student_id = ?').get(student_id);
  if (!user) return res.status(401).json({ error: '学号错误' });
  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: '密码错误' });
  const token = jwt.sign({ id: user.id, role: user.role }, SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, name: user.name, student_id: user.student_id, role: user.role } });
});

router.get('/me', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: '未登录' });
  try {
    const decoded = jwt.verify(token, SECRET);
    const user = db.prepare('SELECT id, name, student_id, role FROM users WHERE id = ?').get(decoded.id);
    if (!user) return res.status(401).json({ error: '用户不存在' });
    res.json(user);
  } catch (err) {
    res.status(401).json({ error: '登录过期' });
  }
});

// 备份下载数据库（通过 token 参数）
router.get('/backup', (req, res) => {
  const token = req.query.token;
  if (!token) return res.status(401).json({ error: '缺少 token' });
  try {
    const decoded = jwt.verify(token, SECRET);
    if (decoded.role !== 'admin') return res.status(403).json({ error: '仅管理员' });
  } catch (err) {
    return res.status(401).json({ error: 'token 无效或过期' });
  }

  const dbPath = path.join(__dirname, '../database.db');
  if (!fs.existsSync(dbPath)) {
    return res.status(404).json({ error: '数据库文件不存在' });
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  res.download(dbPath, `backup-${timestamp}.db`);
});

router.put('/password', auth, (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(oldPassword, user.password_hash)) {
    return res.status(400).json({ error: '原密码错误' });
  }
  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, user.id);
  res.json({ success: true });
});

router.post('/users', auth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: '仅管理员可操作' });
  const { name, student_id, role, password } = req.body;
  const hash = bcrypt.hashSync(password || student_id, 10);
  try {
    db.prepare('INSERT INTO users (name, student_id, password_hash, role) VALUES (?,?,?,?)')
      .run(name, student_id, hash, role);
    res.json({ success: true });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(400).json({ error: '学号已存在' });
    res.status(500).json({ error: err.message });
  }
});

router.get('/users', auth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: '仅管理员' });
  const users = db.prepare('SELECT id, name, student_id, role FROM users').all();
  res.json(users);
});

router.delete('/users/:id', auth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: '仅管理员' });
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;