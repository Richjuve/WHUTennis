import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

export default function Home() {
  const [tournaments, setTournaments] = useState([]);
  useEffect(() => {
    axios.get('/api/tournaments').then(res => setTournaments(res.data));
  }, []);
  return (
    <div>
      <h3>🏆比赛列表</h3>
      <div className="list-group">
        {tournaments.map(t => (
          <Link
            key={t.id}
            to={`/tournament/${t.id}`}
            className="list-group-item list-group-item-action d-flex justify-content-between align-items-center"
          >
            <span>{t.name}</span>
            <span className={`badge ${
              t.status === 'upcoming' ? 'bg-primary' :
              t.status === 'ongoing' ? 'bg-success' :
              t.status === 'finished' ? 'bg-danger' : 'bg-secondary'
            }`}>
              {t.status === 'upcoming' ? '即将开始' :
               t.status === 'ongoing' ? '进行中' :
               t.status === 'finished' ? '已结束' : t.status}
            </span>
          </Link>
        ))}
        {tournaments.length === 0 && <p className="text-muted">暂无比赛</p>}
      </div>
    </div>
  );
}