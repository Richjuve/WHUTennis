import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Tab, Tabs, Table, Form } from 'react-bootstrap';
import KnockoutBracket from '../components/KnockoutBracket';
import GroupStandings from '../components/GroupStandings';
import { useAuth } from '../context/AuthContext';

export default function TournamentDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [tournament, setTournament] = useState(null);
  const [stages, setStages] = useState([]);
  const [matches, setMatches] = useState([]);
  const [players, setPlayers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  const load = () => {
    axios.get(`/api/tournaments/${id}`).then(res => setTournament(res.data));
    axios.get(`/api/stages/by-tournament/${id}`).then(res => setStages(res.data));
    axios.get(`/api/matches/by-tournament/${id}`).then(res => setMatches(res.data));
    axios.get(`/api/players/by-tournament/${id}`).then(res => setPlayers(res.data));
  };

  useEffect(() => {
    load();
  }, [id]);

  const refreshMatches = () => {
    axios.get(`/api/matches/by-tournament/${id}`).then(res => setMatches(res.data));
  };

  if (!tournament) return <div className="text-center mt-5">加载中...</div>;

  const filteredPlayers = players.filter(p =>
    p.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <h3>{tournament.name}</h3>
      <Tabs defaultActiveKey="group-0" className="mb-3">
        {/* 小组赛阶段 */}
        {stages.filter(s => s.type === 'group').map(stage => (
          <Tab key={stage.id} eventKey={`group-${stage.id}`} title={`📊 小组赛`}>
            <GroupStandings
              stageId={stage.id}
              matches={matches.filter(m => m.stage_id === stage.id)}
              user={user}
              onUpdate={refreshMatches}
              tournamentConfig={tournament.scoring_config}
            />
          </Tab>
        ))}

        {/* 淘汰赛阶段 */}
        {stages.filter(s => s.type === 'knockout').map(stage => (
          <Tab key={stage.id} eventKey={`knockout-${stage.id}`} title={`🏆 淘汰赛`}>
            <KnockoutBracket
              stageId={stage.id}
              matches={matches.filter(m => m.stage_id === stage.id)}
              user={user}
              onUpdate={refreshMatches}
              tournamentConfig={tournament.scoring_config}
            />
          </Tab>
        ))}

        {/* 参赛选手（仅登录用户可见） */}
        {user && (
          <Tab eventKey="players" title="👥 参赛选手">
            <div className="mb-3">
              <Form.Control
                type="text"
                placeholder="搜索选手姓名..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{ maxWidth: 300 }}
              />
            </div>
            <div className="table-responsive">
              <Table className="table table-sm align-middle">
                <thead className="text-muted" style={{ fontSize: '0.8rem' }}>
                  <tr>
                    <th className="text-nowrap">姓名</th>
                    <th className="text-nowrap">性别</th>
                    <th className="text-nowrap">学号</th>
                    <th className="text-nowrap">学院</th>
                    <th className="text-nowrap">电话号码</th>
                  </tr>
                </thead>
                <tbody style={{ fontSize: '0.9rem' }}>
                  {filteredPlayers.map(p => (
                    <tr key={p.id}>
                      <td className="text-nowrap">
                        {p.name}
                        {p.seed ? `[${p.seed}]` : ''}
                      </td>
                      <td className="text-nowrap">{p.gender || '-'}</td>
                      <td className="text-nowrap">{p.student_id || '-'}</td>
                      <td className="text-nowrap">{p.college || '-'}</td>
                      <td className="text-nowrap">{p.phone || '-'}</td>
                    </tr>
                  ))}
                  {filteredPlayers.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center text-muted">暂无匹配选手</td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </div>
          </Tab>
        )}
      </Tabs>
    </div>
  );
}