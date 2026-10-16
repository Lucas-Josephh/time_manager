import { Divider } from 'antd';
import { Card } from '@/components/card/card';

export default function TeamCard() {
  return (
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
  );
}
