import PageHeader from '@/components/pageHeader/PageHeader';
import './page.scss'

export default function Teams() {
  return (
    <div className="teams-view">
      <PageHeader
        title="Teams"
        subtitle="Attendance, absence and hours logged this week."
      ></PageHeader>
    </div>
  );
}
