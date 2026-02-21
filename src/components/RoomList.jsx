import React from 'react';

export default function RoomList({ rooms, onSelect }) {
  return (
    <div className="room-list">
      {rooms.map((item) => (
        <div
          key={item.id}
          className={`room-item ${item.survey.completed ? 'room-item--complete' : ''}`}
          onClick={() => onSelect(item.id)}
        >
          <div
            className={`room-item__status ${
              item.survey.completed ? 'room-item__status--complete' : 'room-item__status--pending'
            }`}
          >
            {item.survey.completed ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              item.index + 1
            )}
          </div>

          <div className="room-item__info">
            <div className="room-item__name">{item.roomName}</div>
            <div className="room-item__meta">
              {item.cameras.length} camera{item.cameras.length !== 1 ? 's' : ''}
              {item.survey.photos.length > 0 && ` · ${item.survey.photos.length} photo${item.survey.photos.length !== 1 ? 's' : ''}`}
            </div>
          </div>

          <div className="room-item__cameras">
            {item.survey.completed ? (
              <span className="badge badge--success">Done</span>
            ) : item.survey.ceilingHeight || item.survey.photos.length > 0 ? (
              <span className="badge badge--warning">In progress</span>
            ) : (
              <span className="badge badge--pending">Pending</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
