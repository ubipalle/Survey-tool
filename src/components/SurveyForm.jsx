import React from 'react';

/**
 * Check which required fields are filled.
 * Returns an object with field names and their filled status.
 */
export function getValidationState(survey) {
  return {
    ceilingHeight: !!survey.ceilingHeight,
    mountingSurface: !!survey.mountingSurface,
    networkConnectivity: !!survey.networkConnectivity,
  };
}

/**
 * Check if all required fields are filled.
 */
export function isFormValid(survey) {
  const state = getValidationState(survey);
  return Object.values(state).every(Boolean);
}

export default function SurveyForm({ survey, onChange, showValidation }) {
  const validation = showValidation ? getValidationState(survey) : {};

  return (
    <div className="animate-in">
      {/* Ceiling Height — required */}
      <div className="form-group">
        <label className="form-label">
          Ceiling Height <span style={{ color: 'var(--danger)', fontWeight: 400 }}>*</span>
        </label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="number"
            className="form-input"
            placeholder="e.g. 2.7"
            value={survey.ceilingHeight}
            onChange={(e) => onChange('ceilingHeight', e.target.value)}
            step="0.1"
            min="0"
            style={{
              flex: 1,
              ...(showValidation && !validation.ceilingHeight
                ? { borderColor: 'var(--danger)' }
                : {}),
            }}
          />
          <select
            className="form-select"
            value={survey.ceilingHeightUnit}
            onChange={(e) => onChange('ceilingHeightUnit', e.target.value)}
            style={{ width: '100px' }}
          >
            <option value="meters">meters</option>
            <option value="feet">feet</option>
          </select>
        </div>
        {showValidation && !validation.ceilingHeight && (
          <div style={{ fontSize: '0.7rem', color: 'var(--danger)', marginTop: '4px' }}>
            Required
          </div>
        )}
      </div>

      {/* Power Outlet Location — optional */}
      <div className="form-group">
        <label className="form-label">Power Outlet Location</label>
        <select
          className="form-select"
          value={survey.powerOutletLocation}
          onChange={(e) => onChange('powerOutletLocation', e.target.value)}
        >
          <option value="">Select location...</option>
          <option value="within-1m">Within 1m of camera position</option>
          <option value="within-3m">Within 3m of camera position</option>
          <option value="within-5m">Within 5m of camera position</option>
          <option value="far">More than 5m away</option>
          <option value="none-visible">No visible power outlet</option>
          <option value="ceiling">Ceiling power available</option>
        </select>
        <div className="form-hint">Nearest power source relative to planned camera mount</div>
      </div>

      {/* Mounting Surface — required */}
      <div className="form-group">
        <label className="form-label">
          Mounting Surface <span style={{ color: 'var(--danger)', fontWeight: 400 }}>*</span>
        </label>
        <select
          className="form-select"
          value={survey.mountingSurface}
          onChange={(e) => onChange('mountingSurface', e.target.value)}
          style={
            showValidation && !validation.mountingSurface
              ? { borderColor: 'var(--danger)' }
              : {}
          }
        >
          <option value="">Select surface type...</option>
          <option value="drywall">Drywall / Plasterboard</option>
          <option value="concrete">Concrete</option>
          <option value="brick">Brick</option>
          <option value="wood">Wood</option>
          <option value="metal">Metal / Steel</option>
          <option value="glass">Glass</option>
          <option value="drop-ceiling">Drop Ceiling / T-bar</option>
          <option value="exposed-beam">Exposed Beam</option>
          <option value="other">Other</option>
        </select>
        {showValidation && !validation.mountingSurface && (
          <div style={{ fontSize: '0.7rem', color: 'var(--danger)', marginTop: '4px' }}>
            Required
          </div>
        )}
      </div>

      {/* Network Connectivity — required */}
      <div className="form-group">
        <label className="form-label">
          Network Connectivity <span style={{ color: 'var(--danger)', fontWeight: 400 }}>*</span>
        </label>
        <select
          className="form-select"
          value={survey.networkConnectivity}
          onChange={(e) => onChange('networkConnectivity', e.target.value)}
          style={
            showValidation && !validation.networkConnectivity
              ? { borderColor: 'var(--danger)' }
              : {}
          }
        >
          <option value="">Select...</option>
          <option value="ethernet-nearby">Ethernet drop nearby</option>
          <option value="ethernet-far">Ethernet drop available (distant)</option>
          <option value="wifi-strong">WiFi — Strong signal</option>
          <option value="wifi-weak">WiFi — Weak signal</option>
          <option value="no-network">No network available</option>
          <option value="poe-available">PoE switch available</option>
        </select>
        {showValidation && !validation.networkConnectivity && (
          <div style={{ fontSize: '0.7rem', color: 'var(--danger)', marginTop: '4px' }}>
            Required
          </div>
        )}
      </div>

      {/* Obstructions — optional */}
      <div className="form-group">
        <label className="form-label">Obstructions / Line of Sight Issues</label>
        <textarea
          className="form-textarea"
          placeholder="Describe any obstructions that may affect the camera's field of view (pillars, shelving, lighting fixtures, etc.)"
          value={survey.obstructions}
          onChange={(e) => onChange('obstructions', e.target.value)}
        />
      </div>

      {/* General Notes — optional */}
      <div className="form-group">
        <label className="form-label">Additional Notes</label>
        <textarea
          className="form-textarea"
          placeholder="Any other observations about this room or camera placement..."
          value={survey.notes}
          onChange={(e) => onChange('notes', e.target.value)}
        />
      </div>
    </div>
  );
}
