import { LoadingOutlined } from '@ant-design/icons';
import './LoadingView.scss'

export default function LoadingView() {
  return (
    <div className="loading-view">
      <p>Loading teams</p> <LoadingOutlined />
    </div>
  );
}
