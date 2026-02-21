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

  // Get unique floors with names
  const floors = useMemo(() => {
    const seen = new Set();
    const result = [];
    surveyItems.forEach((item) => {
      if (!seen.has(item.floorId)) {
        seen.add(item.floorId);
        result.push({
          id: item.floorId,
          name: item.floorName || `Floor ${result.length + 1}`,
          rooms: surveyItems.filter((i) => i.floorId === item.floorId),
        });
      }
    });
    return result;
  }, [surveyItems]);

  // Auto-select first floor
  const activeFloor = selectedFloor || (floors.length > 0 ? floors[0].id : null);
  const floorRooms = surveyItems.filter((i) => i.floorId === activeFloor);
  const selectedItem = surveyItems.find((i) => i.id === selectedRoomId);

  // Progress stats
  const completed = surveyItems.filter((i) => i.survey.completed).length;
  const total = surveyItems.length;
  const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Find the first ceiling height entered on the same floor as the selected room
  const floorCeilingDefault = useMemo(() => {
    if (!selectedItem) return null;
    const sameFloorItems = surveyItems.filter(
      (i) => i.floorId === selectedItem.floorId && i.id !== selectedItem.id
    );
    const withHeight = sameFloorItems.find((i) => i.survey.ceilingHeight);
    if (withHeight) {
      return {
        height: withHeight.survey.ceilingHeight,
        unit: withHeight.survey.ceilingHeightUnit,
      };
    }
    return null;
  }, [selectedItem, surveyItems]);

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
    const remaining = [
      ...surveyItems.slice(currentIndex + 1),
      ...surveyItems.slice(0, currentIndex),
    ];
    const nextIncomplete = remaining.find((i) => !i.survey.completed);
    if (nextIncomplete) {
      setSelectedFloor(nextIncomplete.floorId);
      setSelectedRoomId(nextIncomplete.id);
    } else {
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
        floorCeilingDefault={floorCeilingDefault}
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
                {floor.name} ({floorCompleted}/{floor.rooms.length})
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
