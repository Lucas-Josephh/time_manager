import { Avatar } from 'antd';
import './UserSummary.scss';

type UserSummaryProps = {
  userName: string;
  userRole?: string;
};

export default function UserSummary({ userName, userRole }: UserSummaryProps) {
  return (
    <div className="user-summary">
      <Avatar>YB</Avatar>
      <div className="user-summary_details">
        <p>{userName}</p>
        <p>{userRole}</p>
      </div>
    </div>
  );
}
