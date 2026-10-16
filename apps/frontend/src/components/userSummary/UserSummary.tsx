import { Avatar } from 'antd';
import './UserSummary.scss'

export default function UserSummary() {
  return (
    <div className="user-summary">
      <Avatar>YB</Avatar>
      <div className="user-summary_details">
        <p>Yarelly Berger</p>
        <p>Role</p>
      </div>
    </div>
  );
}
