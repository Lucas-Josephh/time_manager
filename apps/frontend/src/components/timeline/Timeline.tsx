import { Card } from '../card/card';
import './Timeline.scss';

export default function TimeLine({
  title,
  subtitle,
  element,
}: {
  title: string;
  subtitle: string;
  element: {
    formatDate: Date;
    title: string;
    description: string;
    current: boolean;
  }[];
}) {
  const currentTime: Date = new Date();
  currentTime.setHours(currentTime.getHours(), currentTime.getMinutes(), 0, 0);

  return (
    <Card
      className="extranet-timeline"
      title={title}
      subtitle={subtitle}
      type="table"
    >
      <div className="extranet-timeline-container">
        {element.map((item, index) => (
          <div className="extranet-timeline-container-content" key={index}>
            <span className="extranet-timeline-container-content__hour">
              {item.formatDate.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
            <div>
              <div className="extranet-timeline-container-content-title">
                <div
                  className={
                    item.current
                      ? 'extranet-timeline-container-content-title__current'
                      : currentTime > item.formatDate
                        ? 'extranet-timeline-container-content-title__passed'
                        : currentTime < item.formatDate
                          ? 'extranet-timeline-container-content-title__waiting'
                          : ''
                  }
                ></div>
                <h3>{item.title}</h3>
              </div>
              <p className="extranet-timeline-container-content__description">
                {item.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
