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
