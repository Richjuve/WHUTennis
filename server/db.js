const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'database.db');

// 导出对象，后续初始化完成后填充方法
const db = {
  ready: false,
  _sqlDb: null
};

function saveDB() {
  if (!db._sqlDb) return; // 防止 _sqlDb 为 null 时报错
  const data = db._sqlDb.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

async function init() {
  const SQL = await initSqlJs();
  
  let buffer;
  if (fs.existsSync(DB_PATH)) {
    buffer = fs.readFileSync(DB_PATH);
  }
  const sqlDb = new SQL.Database(buffer);

  // 先赋值，这样 saveDB 就能用了
  db._sqlDb = sqlDb;

  // 建表
  sqlDb.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      student_id TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin','referee','venue_manager'))
    );

    CREATE TABLE IF NOT EXISTS tournaments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      scoring_config TEXT NOT NULL DEFAULT '{"bestOfSets":3,"gamesPerSet":6,"tiebreak":true}',
      status TEXT DEFAULT 'upcoming',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

        CREATE TABLE IF NOT EXISTS players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tournament_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      gender TEXT,
      student_id TEXT,
      college TEXT,
      phone TEXT,
      seed INTEGER,
      FOREIGN KEY (tournament_id) REFERENCES tournaments(id)
    );

    CREATE TABLE IF NOT EXISTS stages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tournament_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('group','knockout')),
      order_index INTEGER DEFAULT 0,
      FOREIGN KEY (tournament_id) REFERENCES tournaments(id)
    );

    CREATE TABLE IF NOT EXISTS groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      stage_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      FOREIGN KEY (stage_id) REFERENCES stages(id)
    );

    CREATE TABLE IF NOT EXISTS group_players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL,
      player_id INTEGER NOT NULL,
      final_rank INTEGER,
      FOREIGN KEY (group_id) REFERENCES groups(id),
      FOREIGN KEY (player_id) REFERENCES players(id)
    );

    CREATE TABLE IF NOT EXISTS matches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      stage_id INTEGER NOT NULL,
      group_id INTEGER,
      round TEXT,
      position INTEGER,
      player1_id INTEGER,
      player2_id INTEGER,
      player1_source TEXT DEFAULT 'player',
      player2_source TEXT DEFAULT 'player',
      player1_source_match_id INTEGER,
      player2_source_match_id INTEGER,
      winner_id INTEGER,
      score_detail TEXT,
      court TEXT,
      referee_name TEXT,
      status TEXT DEFAULT 'scheduled',
      walkover_type TEXT,
      FOREIGN KEY (stage_id) REFERENCES stages(id),
      FOREIGN KEY (group_id) REFERENCES groups(id),
      FOREIGN KEY (player1_id) REFERENCES players(id),
      FOREIGN KEY (player2_id) REFERENCES players(id),
      FOREIGN KEY (winner_id) REFERENCES players(id),
      FOREIGN KEY (player1_source_match_id) REFERENCES matches(id),
      FOREIGN KEY (player2_source_match_id) REFERENCES matches(id)
    );
  `);

  // 创建默认管理员
  const result = sqlDb.exec("SELECT * FROM users WHERE student_id = '2021303043020'");
  if (!result.length || !result[0].values.length) {
    const hash = bcrypt.hashSync('Yaoji126', 10);
    sqlDb.run("INSERT INTO users (name, student_id, password_hash, role) VALUES (?,?,?,?)", ['钟一鸣', '2021303043020', hash, 'admin']);
  }

  saveDB();

  // 包装 API，兼容 better-sqlite3 常用语法
  db.prepare = (sql) => {
    let boundParams = [];
    
    const stmtAPI = {
      run: (...params) => {
        const p = params.length ? params : boundParams;
        db._sqlDb.run(sql, p);
        saveDB();
        const res = db._sqlDb.exec("SELECT last_insert_rowid()");
        return { 
          lastInsertRowid: res.length && res[0].values.length ? res[0].values[0][0] : null 
        };
      },
      get: (...params) => {
        const p = params.length ? params : boundParams;
        const stmt = db._sqlDb.prepare(sql);
        stmt.bind(p);
        let row = null;
        if (stmt.step()) {
          const cols = stmt.getColumnNames();
          const vals = stmt.get();
          row = {};
          cols.forEach((col, i) => row[col] = vals[i]);
        }
        stmt.free();
        return row;
      },
      all: (...params) => {
        const p = params.length ? params : boundParams;
        const results = [];
        const stmt = db._sqlDb.prepare(sql);
        stmt.bind(p);
        while (stmt.step()) {
          const cols = stmt.getColumnNames();
          const vals = stmt.get();
          const obj = {};
          cols.forEach((col, i) => obj[col] = vals[i]);
          results.push(obj);
        }
        stmt.free();
        return results;
      }
    };

    // 支持链式 .bind().run() 或直接 .run(params)
    stmtAPI.bind = (...params) => {
      boundParams = params;
      return stmtAPI;
    };

    return stmtAPI;
  };

  db.exec = (sql) => {
    db._sqlDb.run(sql);
    saveDB();
  };

  db.transaction = (fn) => {
    return () => {
      db._sqlDb.run('BEGIN');
      try {
        fn();
        db._sqlDb.run('COMMIT');
        saveDB();
      } catch (e) {
        db._sqlDb.run('ROLLBACK');
        throw e;
      }
    };
  };

  db.ready = true;
  console.log('数据库初始化完成');
}

// 异步初始化
init().catch(err => {
  console.error('数据库初始化失败:', err);
  process.exit(1);
});

module.exports = db;