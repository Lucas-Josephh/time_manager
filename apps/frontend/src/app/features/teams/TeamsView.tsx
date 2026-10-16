'use client';

import PageHeader from '@/components/pageHeader/PageHeader';
import './TeamsView.scss';
import { Plus } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { CloseCircleOutlined, LoadingOutlined } from '@ant-design/icons';
import StatusView from '@/components/loading/StatusView';
import { useTranslations } from 'next-intl';
import Button from '@/components/button/Button';
import CreateTeamModal from './CreateTeamModal';
import TeamCard from './TeamCard';
import TeamsStatistics from './TeamsStatistics';

export type Person = {
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

export type TeamsResponse = {
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

  const loadTeams = useCallback((signal?: AbortSignal) => {
    return fetch('/api/team', { signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error('Failed to load teams');
        }

        return response.json() as Promise<TeamsResponse>;
      })
      .then((result) => {
        if (!signal?.aborted) {
          setTeams(result.data);
        }
      })
      .catch(() => {
        if (!signal?.aborted) {
          setHasError(true);
        }
      })
      .finally(() => {
        if (!signal?.aborted) {
          setLoading(false);
        }
      });
  }, []);

  const handleTeamCreated = () => {
    setLoading(true);
    setHasError(false);
    void loadTeams();
  };

  useEffect(() => {
    const controller = new AbortController();

    void loadTeams(controller.signal);

    return () => controller.abort();
  }, [loadTeams]);

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
      <CreateTeamModal
        open={isModalOpen}
        onClose={handleCloseTeamModal}
        onCreated={handleTeamCreated}
      />
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
        <>
          <TeamsStatistics
            teamCount={teamCount}
            employeesCount={employeesCount}
            departmentCount={departmentCount}
          />
          <div className="teams-list">
            <TeamCard />
          </div>
        </>
      )}
    </div>
  );
}
