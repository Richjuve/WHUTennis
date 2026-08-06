const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const authRoutes = require('./routes/auth');
const tournamentRoutes = require('./routes/tournaments');
const playerRoutes = require('./routes/players');
const stageRoutes = require('./routes/stages');
const matchRoutes = require('./routes/matches');

const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(bodyParser.json());

app.use('/api/auth', authRoutes);
app.use('/api/tournaments', tournamentRoutes);
app.use('/api/players', playerRoutes);
app.use('/api/stages', stageRoutes);
app.use('/api/matches', matchRoutes);

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
  });
}

// 等待数据库就绪后再启动服务
function startServer() {
  if (db.ready) {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } else {
    setTimeout(startServer, 100);
  }
}
startServer();