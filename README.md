cat > README.md << 'EOF'
# 🎾 WHU Tennis - 校园网球比赛管理系统

一个用于承办学校网球比赛的 Web 应用，支持小组赛和淘汰赛管理。

## 功能

- 🏆 多比赛管理（即将开始/进行中/已结束）
- 👥 选手库管理（Excel 导入/导出）
- 📊 小组赛（循环对阵、自动排名、胜局率统计）
- 🏅 淘汰赛（自定义轮次名称、季军赛、自动晋级）
- 📱 响应式设计，支持手机访问
- 📥 淘汰赛晋级图 PDF 下载

## 技术栈

- 前端：React + Bootstrap 5
- 后端：Node.js + Express
- 数据库：SQLite (sql.js)

## 本地运行

```bash
npm run install-all
npm run dev
浏览器打开 http://localhost:3000

默认管理员：姓名 admin，学号 000000，密码 000000
EOF

git add README.md
git commit -m "添加 README"
git push

---

## 🚀 部署方案

| 方案 | 说明 |
|------|------|
| **Railway / Render** | 免费部署全栈应用，适合个人项目 |
| **Vercel + 后端分离** | 前端 Vercel，后端 Railway |
| **服务器** | 阿里云/腾讯云学生机 |
