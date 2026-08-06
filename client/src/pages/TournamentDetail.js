import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Tab, Tabs } from 'react-bootstrap';
import KnockoutBracket from '../components/KnockoutBracket';
import GroupStandings from '../components/GroupStandings';
import { useAuth } from '../context/AuthContext';

export default function TournamentDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [tournament, setTournament] = useState(null);
  const [stages, setStages] = useState([]);
  const [matches, setMatches] = useState([]);

  const load = () => {
    axios.get(`/api/tournaments/${id}`).then(res => setTournament(res.data));
    axios.get(`/api/stages/by-tournament/${id}`).then(res => setStages(res.data));
    axios.get(`/api/matches/by-tournament/${id}`).then(res => setMatches(res.data));
  };

  useEffect(() => { load(); }, [id]);

  const refreshMatches = () => {
    axios.get(`/api/matches/by-tournament/${id}`).then(res => setMatches(res.data));
  };

  if (!tournament) return <div className="text-center mt-5">加载中...</div>;

  return (
    <div>
      <h3>{tournament.name}</h3>
      <Tabs defaultActiveKey="group-0" className="mb-3">
        {stages.filter(s => s.type === 'group').map(stage => (
          <Tab key={stage.id} eventKey={`group-${stage.id}`} title={`📊 ${stage.name}`}>
            <GroupStandings 
              stageId={stage.id} 
              matches={matches.filter(m => m.stage_id === stage.id)} 
              user={user} 
              onUpdate={refreshMatches}
              tournamentConfig={tournament.scoring_config}
            />
          </Tab>
        ))}
        {stages.filter(s => s.type === 'knockout').map(stage => (
          <Tab key={stage.id} eventKey={`knockout-${stage.id}`} title={`🏆 ${stage.name}`}>
            <KnockoutBracket 
              stageId={stage.id} 
              matches={matches.filter(m => m.stage_id === stage.id)} 
              user={user} 
              onUpdate={refreshMatches} 
              tournamentConfig={tournament.scoring_config} 
            />
          </Tab>
        ))}
        
      </Tabs>
    </div>
  );
}