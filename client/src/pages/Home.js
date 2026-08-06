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
      <h3 className="mb-4">比赛列表</h3>
      {tournaments.length === 0 && <p className="text-muted">暂无比赛</p>}
      <div className="row g-3">
        {tournaments.map(t => (
          <div key={t.id} className="col-12 col-md-6 col-lg-4">
            <Link
              to={`/tournament/${t.id}`}
              className="text-decoration-none"
            >
              <div className="card h-100 border-0 shadow-sm" style={{ transition: 'transform 0.2s, box-shadow 0.2s', cursor: 'pointer' }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.1)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)';
                }}
              >
                <div className="card-body p-4">
                  <div className="d-flex align-items-start justify-content-between">
                    <div className="d-flex align-items-center">
                      <div className="me-3" style={{ fontSize: '2rem', lineHeight: 1 }}></div>
                      <div>
                        <h6 className="card-title mb-1 fw-bold" style={{ color: '#333' }}>{t.name}</h6>
                        <p className="card-text mb-0">
                          <span className={`badge ${
                            t.status === 'upcoming' ? 'bg-primary' :
                            t.status === 'ongoing' ? 'bg-success' :
                            t.status === 'finished' ? 'bg-danger' : 'bg-secondary'
                          }`}>
                            {t.status === 'upcoming' ? '即将开始' :
                             t.status === 'ongoing' ? '进行中' :
                             t.status === 'finished' ? '已结束' : t.status}
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}