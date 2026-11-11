'use client';

import { MapPin } from 'lucide-react';
import Button from '../button/Button';
import { useEffect, useState } from 'react';
import './Recording.scss';

export default function Recording() {
  const [second, setSecond] = useState(0);
  const [minute, setMinute] = useState(0);
  const [hour, setHour] = useState(0);
  const [clockOutAt, setClockOutAt] = useState('00:00');
  const [clockedTotal, setClockedTotal] = useState('00:00');
  const [clockInStart, setClockInStart] = useState(false);

  const handleClockOut = () => {
    setClockInStart(false);
    const time = new Date().toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    setClockOutAt(time);

    const [totalHour, totalMinute] = clockedTotal.split(':').map(Number);

    const newMinute = totalMinute + minute;
    const extraHour = Math.floor(newMinute / 60);

    const newHour = totalHour + hour + extraHour;
    const finalMinute = newMinute % 60;

    setClockedTotal(
      `${String(newHour).padStart(2, '0')}:${String(finalMinute).padStart(2, '0')}`,
    );
    setSecond(0);
    setMinute(0);
    setHour(0);
  };

  useEffect(() => {
    if (!clockInStart) return;

    const interval = setInterval(() => {
      setSecond((prevSecond) => {
        if (prevSecond < 59) return prevSecond + 1;

        setMinute((prevMinute) => {
          if (prevMinute < 59) return prevMinute + 1;

          setHour((prevHour) => (prevHour + 1) % 24);
          return 0;
        });

        return 0;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [clockInStart]);

  return (
    <div className="extranet-recording">
      <div className="extranet-recording-container">
        <div className="extranet-recording-container-header">
          <div
            className={`extranet-recording-container-header-title ${clockInStart ? 'extranet-recording-container-header-title__clocked' : ''}`}
          >
            <div
              className={`extranet-recording-container-header-title-point ${clockInStart ? 'extranet-recording-container-header-title-point__clocked' : ''}`}
            ></div>
            You are currently clocked out
          </div>
          <div
            className="extranet-recording-container-header-title"
            style={{ fontWeight: '500' }}
          >
            <MapPin size={14} />
            Office · Montpellier
          </div>
        </div>
        <div className="extranet-recording-container-session text-uppercase">
          Last session
        </div>
        <div className="extranet-recording-container-children">
          <div className="extranet-recording-container-children__time">
            {hour < 10 && 0}
            {hour}:{minute < 10 && 0}
            {minute}:{second < 10 && 0}
            {second}
          </div>
          <div className="extranet-recording-container-children-details">
            <div className="extranet-recording-container-children-details-content">
              <div className="extranet-recording-container-children-details-content__label">
                Clocked out at
              </div>
              <div className="extranet-recording-container-children-details-content__value">
                {clockOutAt}
              </div>
            </div>
            <div className="extranet-recording-container-children-details-content">
              <div className="extranet-recording-container-children-details-content__label">
                Total today
              </div>
              <div className="extranet-recording-container-children-details-content__value">
                {clockedTotal}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="extranet-recording-container-footer">
        {!clockInStart ? (
          <Button variant="clock_in" onClick={() => setClockInStart(true)}>
            Clock In
          </Button>
        ) : (
          <Button variant="clock_out" onClick={handleClockOut}>
            Clock Out
          </Button>
        )}

        <Button variant="timesheet">View timesheet</Button>
      </div>
    </div>
  );
}
