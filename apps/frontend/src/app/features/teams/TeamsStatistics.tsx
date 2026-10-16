'use client';

import { Card } from '@/components/card/card';
import { Clock, Target, TrendingUp } from 'lucide-react';
import { useTranslations } from 'next-intl';

type TeamsStatisticsProps = {
  teamCount: number;
  employeesCount: number;
  departmentCount: number;
};

export default function TeamsStatistics({
  teamCount,
  employeesCount,
  departmentCount,
}: TeamsStatisticsProps) {
  const t = useTranslations('TeamsPage');
  const navigation = useTranslations('Navigation');

  return (
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
  );
}
