import React, { useState, useMemo, useEffect } from 'react';
import RoomList from './RoomList';
import SurveyView from './SurveyView';

export default function SurveyShell({ config, surveyItems, onUpdateItem, onUpdateCamera, onGoToReview, jumpToRoomId, onJumpHandled }) {
  const [selectedFloor, setSelectedFloor] = useState(null);
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [showRoomList, setShowRoomList] = useState(true);

  // Handle jump-to-room from Review screen
  useEffect(() => {
    if (jumpToRoomId) {
      const targetItem = surveyItems.find((i) => i.id === jumpToRoomId);
      if (targetItem) {
        setSelectedFloor(targetItem.floorId);
        setSelectedRoomId(jumpToRoomId);
        setShowRoomList(false);
      }
      if (onJumpHandled) onJumpHandled();
    }
  }, [jumpToRoomId]);

  // Get unique floors
  const floors = useMemo(() => {
    const floorIds = [...new Set(surveyItems.map((i) => i.floorId))];
    return floorIds.map((fid) => ({
      id: fid,
      rooms: surveyItems.filter((i) => i.floorId === fid),
    }));
  }, [surveyItems]);

  // Auto-select first floor
  const activeFloor = selectedFloor || (floors.length > 0 ? floors[0].id : null);
  const floorRooms = surveyItems.filter((i) => i.floorId === activeFloor);
  const selectedItem = surveyItems.find((i) => i.id === selectedRoomId);

  // Progress stats
  const completed = surveyItems.filter((i) => i.survey.completed).length;
  const total = surveyItems.length;
  const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0;

  const handleSelectRoom = (roomId) => {
    setSelectedRoomId(roomId);
    setShowRoomList(false);
  };

  const handleBackToList = () => {
    setShowRoomList(true);
    setSelectedRoomId(null);
  };

  // Navigate to next incomplete room
  const handleNextRoom = () => {
    const currentIndex = surveyItems.findIndex((i) => i.id === selectedRoomId);
    // Find next incomplete room on same floor, then across floors
    const remaining = [
      ...surveyItems.slice(currentIndex + 1),
      ...surveyItems.slice(0, currentIndex),
    ];
    const nextIncomplete = remaining.find((i) => !i.survey.completed);
    if (nextIncomplete) {
      setSelectedFloor(nextIncomplete.floorId);
      setSelectedRoomId(nextIncomplete.id);
    } else {
      // All done — go to review
      onGoToReview();
    }
  };

  // Mobile: show either room list or survey view
  if (!showRoomList && selectedItem) {
    return (
      <SurveyView
        item={selectedItem}
        config={config}
        onUpdate={(updates) => onUpdateItem(selectedItem.id, updates)}
        onUpdateCamera={(cameraId, updates) => onUpdateCamera(selectedItem.id, cameraId, updates)}
        onBack={handleBackToList}
        onNext={handleNextRoom}
        currentIndex={surveyItems.findIndex((i) => i.id === selectedItem.id) + 1}
        totalRooms={total}
      />
    );
  }

  return (
    <div className="screen animate-in">
      <h1 className="screen__title">Rooms</h1>
      <p className="screen__subtitle">{config.siteName}</p>

      {/* Progress */}
      <div className="progress">
        <div className="progress__bar">
          <div className="progress__fill" style={{ width: `${progressPct}%` }} />
        </div>
        <span className="progress__text">
          {completed}/{total} done
        </span>
      </div>

      {/* Floor Tabs */}
      {floors.length > 1 && (
        <div className="floor-tabs">
          {floors.map((floor) => {
            const floorCompleted = floor.rooms.filter((r) => r.survey.completed).length;
            return (
              <button
                key={floor.id}
                className={`floor-tab ${activeFloor === floor.id ? 'floor-tab--active' : ''}`}
                onClick={() => setSelectedFloor(floor.id)}
              >
                Floor {floor.id.slice(-4)} ({floorCompleted}/{floor.rooms.length})
              </button>
            );
          })}
        </div>
      )}

      {/* Room List */}
      <RoomList rooms={floorRooms} onSelect={handleSelectRoom} />

      {/* Review Button */}
      {completed > 0 && (
        <div style={{ marginTop: '16px' }}>
          <button className="btn btn--primary btn--block" onClick={onGoToReview}>
            Review & Submit ({completed} room{completed !== 1 ? 's' : ''} completed)
          </button>
        </div>
      )}
    </div>
  );
}
