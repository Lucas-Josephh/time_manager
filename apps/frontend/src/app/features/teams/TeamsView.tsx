'use client';

import PageHeader from '@/components/pageHeader/PageHeader';
import './TeamsView.scss';
import { Card } from '@/components/card/card';
import { Clock, Target, TrendingUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { CloseCircleOutlined, LoadingOutlined } from '@ant-design/icons';
import StatusView from '@/components/loading/StatusView';
import { useTranslations } from 'next-intl';
import { Divider } from 'antd';

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

  const teamCount = teams.length;
  const memberIds = teams.flatMap((team) =>
    team.members.map((member) => member.id),
  );
  const uniqueMemberIds = new Set(memberIds);
  const employeesCount = uniqueMemberIds.size;
  const departmentCount = new Set(teams.map((team) => team.departmentId)).size;

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
      ></PageHeader>
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
        <div className="teams-view_statistics">
          <Card
            subtitle={navigation('teams')}
            icon={Target}
            iconColor="var(--color-primary)"
            footer={t('acrossDepartments', { count: departmentCount })}
          >
            <h2>{teamCount}</h2>
          </Card>
          <Card
            subtitle={navigation('employees')}
            icon={Clock}
            iconColor="var(--color-ink-soft)"
            footer={t('activeContracts')}
          >
            <h2>{employeesCount}</h2>
          </Card>
          <Card
            subtitle={t('workingNow')}
            icon={TrendingUp}
            iconColor="var(--color-success)"
            footer={t('companyPercentage')}
          ></Card>
        </div>
      )}
      <div className="teams-list">
        <Card
          title="teamName"
          subtitle="employees · {departmentName}"
          // type="table"
        >
          <p>
            Manager <b>managerFirstName managerLastName</b>
          </p>
          <Divider />
          <div className="team-card_statistics">
            <div>
              <p>Working now</p>
              <h4>number</h4>
            </div>
            <div>
              <p>Hours this week</p>
              <h4>number</h4>
            </div>
          </div>
          <Divider />
          <div className="team-card_members">
            <p>Avatars</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
