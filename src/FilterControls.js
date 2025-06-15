// New file: src/FilterControls.js

import React from 'react';

const FilterControls = ({ 
  filterSettings,
  setFilterSettings,
  hasHeartRateData
}) => {
  return (
    <div className="filter-controls">
      <h3>Analysis Filters</h3>
      
      <div className="filter-section">
        <label>
          <input
            type="checkbox"
            checked={filterSettings.removeUnreliableBins}
            onChange={e => setFilterSettings({
              ...filterSettings,
              removeUnreliableBins: e.target.checked
            })}
          />
          Remove unreliable data bins
        </label>
        <div className="filter-help-text">
          Filters out bins with extreme gradients, unrealistic speeds, or data anomalies
        </div>
      </div>
      
      {hasHeartRateData && (
        <div className="filter-section">
          <div className="filter-header">
            <label>
              <input
                type="checkbox"
                checked={filterSettings.enableHeartRateFilter}
                onChange={e => setFilterSettings({
                  ...filterSettings,
                  enableHeartRateFilter: e.target.checked
                })}
              />
              Filter by heart rate range
            </label>
          </div>
          
          {filterSettings.enableHeartRateFilter && (
            <div className="heart-rate-range">
              <div className="range-input">
                <label>Min HR:</label>
                <input
                  type="number"
                  value={filterSettings.heartRateFilter.minHR || ''}
                  onChange={e => setFilterSettings({
                    ...filterSettings,
                    heartRateFilter: {
                      ...filterSettings.heartRateFilter,
                      minHR: e.target.value ? parseInt(e.target.value) : null
                    }
                  })}
                  min={60}
                  max={220}
                  placeholder="Min"
                />
              </div>
              
              <div className="range-input">
                <label>Max HR:</label>
                <input
                  type="number"
                  value={filterSettings.heartRateFilter.maxHR || ''}
                  onChange={e => setFilterSettings({
                    ...filterSettings,
                    heartRateFilter: {
                      ...filterSettings.heartRateFilter,
                      maxHR: e.target.value ? parseInt(e.target.value) : null
                    }
                  })}
                  min={60}
                  max={220}
                  placeholder="Max"
                />
              </div>
            </div>
          )}
        </div>
      )}
      {/* Remove the Apply Filters button completely */}
    </div>
  );
};

export default FilterControls;