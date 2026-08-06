const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');
const multer = require('multer');
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

// 配置文件上传
const upload = multer({ 
  dest: path.join(__dirname, '../uploads/'),
  fileFilter: (req, file, cb) => {
    if (file.originalname.endsWith('.xlsx') || file.originalname.endsWith('.xls') || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('只支持 .xlsx、.xls 或 .csv 格式的文件'));
    }
  }
});

// 获取某比赛的所有选手
router.get('/by-tournament/:id', (req, res) => {
  const players = db.prepare('SELECT * FROM players WHERE tournament_id = ? ORDER BY CASE WHEN seed IS NULL THEN 1 ELSE 0 END, seed ASC, name ASC').all(req.params.id);
  res.json(players);
});

// 手动添加选手
router.post('/', auth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: '仅管理员' });
  const { tournament_id, name, gender, student_id, college, phone, seed } = req.body;
  const info = db.prepare('INSERT INTO players (tournament_id, name, gender, student_id, college, phone, seed) VALUES (?,?,?,?,?,?,?)')
    .run(tournament_id, name, gender || null, student_id || null, college || null, phone || null, seed || null);
  res.json({ id: info.lastInsertRowid });
});

// Excel 批量导入选手
router.post('/import', auth, upload.single('file'), (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: '仅管理员' });
  
  const { tournament_id } = req.body;
  if (!tournament_id) {
    return res.status(400).json({ error: '请指定比赛ID' });
  }

  if (!req.file) {
    return res.status(400).json({ error: '请上传文件' });
  }

  try {
    // 读取 Excel 文件
    const workbook = xlsx.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

    if (data.length < 2) {
      try { fs.unlinkSync(req.file.path); } catch(e) {}
      return res.status(400).json({ error: 'Excel文件为空或只有表头' });
    }

    // 解析表头，自动匹配列
    const header = data[0].map(h => String(h).trim());
    const nameIndex = header.findIndex(h => h.includes('姓名') || h === 'name');
    const genderIndex = header.findIndex(h => h.includes('性别') || h === 'gender');
    const studentIdIndex = header.findIndex(h => h.includes('学号') || h === 'student_id');
    const collegeIndex = header.findIndex(h => h.includes('学院') || h === 'college');
    const phoneIndex = header.findIndex(h => h.includes('电话') || h.includes('手机') || h === 'phone');
    const seedIndex = header.findIndex(h => h.includes('种子') || h === 'seed');

    if (nameIndex === -1) {
      try { fs.unlinkSync(req.file.path); } catch(e) {}
      return res.status(400).json({ error: 'Excel中未找到"姓名"列，请确保第一行是表头，包含"姓名"字段' });
    }

    // 直接逐条插入
    const insertStmt = db.prepare('INSERT INTO players (tournament_id, name, gender, student_id, college, phone, seed) VALUES (?,?,?,?,?,?,?)');
    let successCount = 0;
    let skipCount = 0;
    const tid = parseInt(tournament_id);

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const name = row[nameIndex];
      if (!name || String(name).trim() === '') {
        skipCount++;
        continue;
      }

      const gender = genderIndex !== -1 ? String(row[genderIndex] || '').trim() : null;
      const studentId = studentIdIndex !== -1 ? String(row[studentIdIndex] || '').trim() : null;
      const college = collegeIndex !== -1 ? String(row[collegeIndex] || '').trim() : null;
      const phone = phoneIndex !== -1 ? String(row[phoneIndex] || '').trim() : null;
      const seed = seedIndex !== -1 && row[seedIndex] ? parseInt(row[seedIndex]) : null;

      insertStmt.run(tid, String(name).trim(), gender || null, studentId || null, college || null, phone || null, seed);
      successCount++;
    }

    // 删除临时文件
    try { fs.unlinkSync(req.file.path); } catch(e) {}

    res.json({
      success: true,
      message: `成功导入 ${successCount} 名选手`,
      successCount,
      skipCount,
      total: data.length - 1
    });

  } catch (err) {
    if (req.file) {
      try { fs.unlinkSync(req.file.path); } catch(e) {}
    }
    console.error('Excel导入失败:', err);
    res.status(500).json({ error: 'Excel文件解析失败，请检查文件格式是否正确: ' + err.message });
  }
});

// 更新选手信息（可修改任意字段）
router.put('/:id', auth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: '仅管理员' });
  const { name, gender, student_id, college, phone, seed } = req.body;
  
  // 只更新传入的字段
  const updates = [];
  const params = [];
  
  if (name !== undefined) { updates.push('name=?'); params.push(name); }
  if (gender !== undefined) { updates.push('gender=?'); params.push(gender); }
  if (student_id !== undefined) { updates.push('student_id=?'); params.push(student_id); }
  if (college !== undefined) { updates.push('college=?'); params.push(college); }
  if (phone !== undefined) { updates.push('phone=?'); params.push(phone); }
  if (seed !== undefined) { updates.push('seed=?'); params.push(seed); }

  if (updates.length === 0) {
    return res.status(400).json({ error: '没有需要更新的字段' });
  }

  params.push(req.params.id);
  db.prepare(`UPDATE players SET ${updates.join(', ')} WHERE id=?`).run(...params);
  res.json({ success: true });
});

// 删除选手
router.delete('/:id', auth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: '仅管理员' });
  db.prepare('DELETE FROM players WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;