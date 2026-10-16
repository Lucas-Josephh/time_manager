'use client';

import PageHeader from '@/components/pageHeader/PageHeader';
import './TeamsView.scss';
import { Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { CloseCircleOutlined, LoadingOutlined } from '@ant-design/icons';
import StatusView from '@/components/loading/StatusView';
import { useTranslations } from 'next-intl';
import Button from '@/components/button/Button';
import CreateTeamModal from './CreateTeamModal';
import TeamCard from './TeamCard';
import TeamsStatistics from './TeamsStatistics';

type Person = {
  id: string;
  firstName: string;
  lastName: string;
  image: string | null;
};

type Team = {
  id: string;
  name: string;
  departmentId: string;
  manager: Person | null;
  members: Person[];
};

type TeamsResponse = {
  success: boolean;
  data: Team[];
};

export default function TeamsView() {
  const t = useTranslations('TeamsPage');
  const navigation = useTranslations('Navigation');

  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const teamCount = teams.length;
  const memberIds = teams.flatMap((team) =>
    team.members.map((member) => member.id),
  );
  const uniqueMemberIds = new Set(memberIds);
  const employeesCount = uniqueMemberIds.size;
  const departmentCount = new Set(teams.map((team) => team.departmentId)).size;

  const showModal = () => {
    setIsModalOpen(true);
  };

  const handleCloseTeamModal = () => {
    setIsModalOpen(false);
  };

  useEffect(() => {
    const controller = new AbortController();

    async function loadTeams() {
      try {
        const response = await fetch('/api/team', {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error();
        }

        const result: TeamsResponse = await response.json();
        setTeams(result.data);
      } catch {
        if (!controller.signal.aborted) {
          setHasError(true);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadTeams();

    return () => controller.abort();
  }, []);

  return (
    <div className="teams-view">
      <PageHeader
        title={navigation('teams')}
        subtitle={t('subtitle')}
        actions={
          <Button icon={Plus} onClick={showModal}>
            Create team
          </Button>
        }
      />
      <CreateTeamModal open={isModalOpen} onClose={handleCloseTeamModal} />
      {loading ? (
        <StatusView
          status="loading"
          message={t('loading')}
          icon={LoadingOutlined}
        />
      ) : hasError ? (
        <StatusView
          status="error"
          message={t('loadFailed')}
          icon={CloseCircleOutlined}
        />
      ) : (
        <TeamsStatistics
          teamCount={teamCount}
          employeesCount={employeesCount}
          departmentCount={departmentCount}
        />
      )}
      <div className="teams-list">
        <TeamCard />
      </div>
    </div>
  );
}
