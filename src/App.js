import React, { useState, useEffect } from 'react';
import './App.css';
import { GradientPaceChart, GradeAdjustmentChart } from './PaceChart';
import StatToggle from './StatToggle';
import FilterControls from './FilterControls'; // Import new component

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';



function App() {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');
  const [binLength, setBinLength] = useState(50); // New state for bin length
  const [advancedAnalysis, setAdvancedAnalysis] = useState(null);
  const [analyzingPatterns, setAnalyzingPatterns] = useState(false);
  const [statType, setStatType] = useState('mean'); // Add state for mean/median toggle
  const [batchMode, setBatchMode] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ percent: 0, current: 0, total: 0, currentFile: '', filesProcessed: 0 });
  const [batchResults, setBatchResults] = useState([]); // For live results
  const [batchErrors, setBatchErrors] = useState([]);   // For live errors

  // Add new state for filters
  const [filterSettings, setFilterSettings] = useState({
    removeUnreliableBins: true, // Default to true - remove bad data
    enableHeartRateFilter: false,
    heartRateFilter: {
      minHR: null,
      maxHR: null
    }
  });
  
  // State to track if files have HR data
  const [hasHeartRateData, setHasHeartRateData] = useState(false);
  
  // Add state for filtered results
  const [filteredResults, setFilteredResults] = useState(null);
  
  

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files);
    setFiles(selectedFiles);
    setError('');
    setResults(null);
  };

  const uploadAndAnalyze = async () => {
    if (files.length === 0) {
      setError('Please select files first');
      return;
    }

    setUploading(true);
    setError('');
    
    try {
      const formData = new FormData();
      files.forEach(file => {
        formData.append('files', file);
      });
      
      formData.append('binLength', binLength.toString()); // Add bin length to form data

   

      const response = await fetch(`${BACKEND_URL}/api/analyze-with-bins`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        setResults(data);
        console.log('Analysis complete:', data);
      } else {
        throw new Error(data.error || 'Analysis failed');
      }

    } catch (err) {
      console.error('Upload error:', err);
      setError(`Failed to analyze files: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

const uploadAndAnalyzeBatch = async () => {
  if (files.length === 0) {
    setError('Please select files first');
    return;
  }

  setUploading(true);
  setError('');
  setBatchProgress({ percent: 0, current: 0, total: files.length, currentFile: '', filesProcessed: 0 });
  setBatchResults([]);
  setBatchErrors([]);
  setResults(null);

  try {
    // STEP 1: Upload the files and get a batch ID
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });
    formData.append('binLength', binLength.toString());

    const uploadResponse = await fetch(`${BACKEND_URL}/api/upload-batch`, {
      method: 'POST',
      body: formData,
    });

    if (!uploadResponse.ok) {
      throw new Error(`HTTP ${uploadResponse.status}: ${uploadResponse.statusText}`);
    }

    const uploadResult = await uploadResponse.json();
    if (!uploadResult.success) {
      throw new Error(uploadResult.error || 'File upload failed');
    }

    // STEP 2: Connect to the SSE endpoint to process the files
    const eventSource = new EventSource(`${BACKEND_URL}/api/process-batch/${uploadResult.batchId}`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        console.log(`SSE Event: ${data.type}, File ${data.fileIndex || 0}/${data.totalFiles || 0}, Progress: ${data.progressPercent || 0}%`);

        if (data.type === 'progress') {
          setBatchProgress({
            percent: data.progressPercent,
            current: data.fileIndex,
            total: data.totalFiles,
            currentFile: data.currentFile,
            filesProcessed: data.filesProcessed
          });
          setBatchResults([...data.resultsSoFar]);
          setBatchErrors([...data.errorsSoFar]);
        } else if (data.type === 'complete') {
          setResults({
            success: true,
            results: data.results,
            errors: data.errors,
            summary: {
              totalFiles: data.totalFiles,
              successfulFiles: data.successfulFiles,
              failedFiles: data.failedFiles,
            }
          });
          setBatchProgress({ 
            percent: 100, 
            current: data.totalFiles, 
            total: data.totalFiles, 
            currentFile: '', 
            filesProcessed: data.totalFiles 
          });
          eventSource.close();
          setUploading(false);
        } else if (data.type === 'error') {
          throw new Error(data.error);
        }
      } catch (parseError) {
        console.error('Error parsing SSE data:', parseError, event.data);
        setError(`Error parsing response: ${parseError.message}`);
        eventSource.close();
        setUploading(false);
      }
    };

    eventSource.onerror = (err) => {
      console.error('EventSource error:', err);
      setError('Connection to server lost');
      eventSource.close();
      setUploading(false);
    };
  } catch (err) {
    console.error('Batch upload error:', err);
    setError(`Failed to analyze files: ${err.message}`);
    setUploading(false);
  }
};

  const runAdvancedAnalysis = async () => {
    if (!results || !results.results) return;
    
    setAnalyzingPatterns(true);
    
    try {
      // Check if any filters are active
      const useFilters = filterSettings.removeUnreliableBins || 
        (filterSettings.enableHeartRateFilter && 
        (filterSettings.heartRateFilter.minHR !== null || filterSettings.heartRateFilter.maxHR !== null));
      
      // Choose endpoint based on whether filters are active
      const endpoint = useFilters ? '/api/analyze-with-filters' : '/api/advanced-analysis';
      
      // Prepare request body with filters if needed
      const requestBody = {
        results: results.results
      };
      
      if (useFilters) {
        requestBody.heartRateFilter = filterSettings.enableHeartRateFilter ? filterSettings.heartRateFilter : null;
        requestBody.removeUnreliableBins = filterSettings.removeUnreliableBins;
        requestBody.filterOptions = {
          maxGradient: 40,
          minSpeed: 0.2,
          maxSpeed: 10
        };
      }
      
      const response = await fetch(`${BACKEND_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        // Set filtered results if filters were applied, otherwise clear them
        if (useFilters) {
          setFilteredResults(data);
        } else {
          setFilteredResults(null);
        }
        
        setAdvancedAnalysis(data.analyses);
        console.log('Advanced analysis complete:', data.analyses);
      } else {
        throw new Error(data.error || 'Analysis failed');
      }

    } catch (err) {
      console.error('Advanced analysis error:', err);
      setError(`Advanced analysis failed: ${err.message}`);
    } finally {
      setAnalyzingPatterns(false);
    }
  };

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hours}h ${minutes}m ${secs}s`;
  };

  const formatPace = (minutes) => {
    const mins = Math.floor(minutes);
    const secs = Math.floor((minutes - mins) * 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Check for HR data after results are available
  useEffect(() => {
    if (results && results.results) {
      const hasHR = results.results.some(result => 
        result.bins && result.bins.some(bin => bin.avgHeartRate !== null)
      );
      setHasHeartRateData(hasHR);
    }
  }, [results]);
  
  return (
    <div className="App">
      <header className="App-header">
        <h1>🏃‍♂️ PERSONAL GRADE RUNNING ANALYSER</h1>
        <p>📁 Upload multiple GPX or FIT files, set filters, and analyse...   </p>
      </header>

      <main className="App-main">
        {/* Upload Section */}
        <div className="upload-section">
          
          <input
            type="file"
            multiple
            accept=".gpx,.fit"
            onChange={handleFileSelect}
            className="file-input"
          />

          {files.length > 0 && (
            <p className="file-count">✅ {files.length} files selected</p>
          )}

          

          <div className="bin-config">
            <label htmlFor="binLength">Bin Length (meters):</label>
            <select 
              id="binLength" 
              value={binLength} 
              onChange={(e) => setBinLength(parseInt(e.target.value))}
              className="bin-select"
            >
              <option value={25}>25m</option>
              <option value={50}>50m</option>
              <option value={100}>100m</option>
              <option value={200}>200m</option>
            </select>
          </div>

          {/* Batch Mode Toggle */}
<div className="batch-toggle">
  <label>
    <input
      type="checkbox"
      checked={batchMode}
      onChange={(e) => setBatchMode(e.target.checked)}
    />
    Batch Mode (for multiple files)
  </label>
</div>

<button
  onClick={batchMode ? uploadAndAnalyzeBatch : uploadAndAnalyze}
  disabled={uploading || files.length === 0}
  className={`upload-btn ${uploading ? 'uploading' : ''}`}
>
  {uploading ? (
    <span className="spinner-container">
      <span className="spinner"></span>
      {batchMode ? 
        `Processing File ${batchProgress.current}/${batchProgress.total}...` : 
        'Analyzing...'}
    </span>
  ) : (
    <>
      {batchMode ? '🚀 Upload To Processor (Batch)' : '🚀 Upload To Processor'}
      {files.length > 0 && <span className="file-count-badge">{files.length}</span>}
    </>
  )}
</button>

          {/* Batch Progress */}
{uploading && batchMode && (
  <div className="batch-progress">
    <div className="progress-bar" style={{ width: `${batchProgress.percent}%` }}></div>
    <p>
      Processing file {batchProgress.current} of {batchProgress.total}
      {batchProgress.currentFile && <>: <b>{batchProgress.currentFile}</b></>}
      <br />
      {batchProgress.percent}% • {batchProgress.filesProcessed} files completed
    </p>
    <div style={{ marginTop: 10 }}>
      <b>Processed Files:</b>
      {(batchResults.length > 0 || batchErrors.length > 0) && (
        <div className="file-list-container">
          <div className="file-list-header">
            <div className="status-column">Status</div>
            <div className="filename-column">Filename</div>
            <div className="data-column">Data</div>
          </div>
          <div className="file-list-scrollable">
            {batchResults.map((r, i) => (
              <div key={i} className="file-list-item">
                <div className="status-column">
                  <span className="status success">✅</span>
                </div>
                <div className="filename-column">{r.filename}</div>
                <div className="data-column">
                  {r.hasHeartRateData && <span className="hr-badge">❤️</span>}
                  <span className="distance-badge">{r.distance ? `${r.distance.toFixed(1)}km` : "N/A"}</span>
                </div>
              </div>
            ))}
            {batchErrors.map((e, i) => (
              <div key={`err-${i}`} className="file-list-item error">
                <div className="status-column">
                  <span className="status fail">❌</span>
                </div>
                <div className="filename-column">{e.filename}</div>
                <div className="data-column">
                  <span className="error-message">{e.error}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  </div>
)}

          {error && (
            <div className="error">
              ❌ {error}
            </div>
          )}
        </div>

        {/* Results Section */}
        {results && (
          <div className="results-section">
            <h2>📊 Results</h2>
            
            {/* Summary */}
            <div className="summary">
              <h3>Summary Statistics</h3>
              {/* --- Calculate summary metrics from the table data --- */}
              {(() => {
                const successfulFiles = results.results.length;
                const totalBins = results.results.reduce((sum, r) => sum + (r.bins?.length || 0), 0);
                const avgBinsPerFile = successfulFiles > 0 ? Math.round(totalBins / successfulFiles) : 0;
                const filesWithHR = results.results.filter(r => r.avgHeartRate).length;
                const totalDistance = results.results.reduce((sum, r) => sum + r.distance, 0);
                const totalTime = results.results.reduce((sum, r) => sum + r.totalTime, 0);
                const totalElevation = results.results.reduce((sum, r) => sum + r.elevationGain, 0);

                return (
                  <div className="stats-grid">
                    <div className="stat">
                      <span className="label">Files Processed:</span>
                      <span className="value">{successfulFiles}/{results.summary?.totalFiles || successfulFiles}</span>
                    </div>
                    <div className="stat">
                      <span className="label">Bin Length:</span>
                      <span className="value">{results.summary?.binLength || binLength}m</span>
                    </div>
                    <div className="stat">
                      <span className="label">Total Bins:</span>
                      <span className="value">{totalBins}</span>
                    </div>
                    <div className="stat">
                      <span className="label">Avg Bins/File:</span>
                      <span className="value">{avgBinsPerFile}</span>
                    </div>
                    <div className="stat">
                      <span className="label">Files with HR:</span>
                      <span className="value">
                        {filesWithHR}/{successfulFiles}
                        {filesWithHR > 0 && (
                          <span style={{fontSize: '12px', display: 'block', color: '#666'}}>
                            ({Math.round((filesWithHR / successfulFiles) * 100)}%)
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="stat">
                      <span className="label">Total Distance:</span>
                      <span className="value">
                        {totalDistance.toFixed(1)} km
                      </span>
                    </div>
                    <div className="stat">
                      <span className="label">Total Time:</span>
                      <span className="value">
                        {formatTime(totalTime)}
                      </span>
                    </div>
                    <div className="stat">
                      <span className="label">Total Elevation:</span>
                      <span className="value">
                        {totalElevation} m
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Filter Controls */}
            <FilterControls
              filterSettings={filterSettings}
              setFilterSettings={setFilterSettings}
              hasHeartRateData={hasHeartRateData}
              // Remove onApplyFilters prop
            />
            
            {/* Show filter summary if filtered results exist */}
            {filteredResults && (
              <div className="filter-summary">
                <p>
                  <strong>Filters applied:</strong> 
                  {filterSettings.removeUnreliableBins && ' Removed unreliable bins'}
                  {filterSettings.enableHeartRateFilter && 
                    ` • Heart Rate ${filterSettings.heartRateFilter.minHR || 'min'}-${filterSettings.heartRateFilter.maxHR || 'max'} bpm`
                  }
                </p>
                <p>
                  <strong>{filteredResults.summary.totalFilteredBins}</strong> bins analyzed 
                  ({filteredResults.summary.totalOriginalBins - filteredResults.summary.totalFilteredBins} bins filtered out)
                </p>
              </div>
            )}

            {/* Advanced Analysis Button */}
            <div className="analysis-actions">
              <button
                onClick={runAdvancedAnalysis}
                disabled={analyzingPatterns}
                className={`analysis-btn ${analyzingPatterns ? 'analyzing' : ''}`}
              >
                {analyzingPatterns ? '🔬 Analyzing Patterns...' : (
                  (filterSettings.removeUnreliableBins || filterSettings.enableHeartRateFilter) ? 
                  '📈 Analyze Patterns (with Filters)' : 
                  '📈 Analyze Patterns'
                )}
              </button>
              <p className="analysis-note">
                Analyze pace vs gradient, heart rate zones, and performance patterns
                {(filterSettings.removeUnreliableBins || filterSettings.enableHeartRateFilter) && 
                  ' with selected filters applied'}
              </p>
            </div>

            {/* Advanced Analysis Results */}
            {advancedAnalysis && (
              <div className="advanced-analysis">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3>🔬 Advanced Pattern Analysis</h3>
                  <StatToggle 
                    value={statType} 
                    onChange={setStatType}
                    style={{ marginLeft: 'auto' }}
                  />
                </div>
                
                {advancedAnalysis.gradientPace && (
                  <GradientPaceChart 
                    gradientData={advancedAnalysis.gradientPace} 
                    statType={statType}
                  />
                )}
                
                {advancedAnalysis.gradeAdjustment && advancedAnalysis.gradientPace && (
                  <GradeAdjustmentChart 
                    adjustmentData={advancedAnalysis.gradeAdjustment}
                    gradientPaceData={advancedAnalysis.gradientPace}
                    statType={statType}
                  />
                )}
              </div>
            )}

            {/* Individual Results */}
            <div className="individual-results">
              <h3>Individual Runs</h3>
              <div className="results-table">
                <div className="table-header">
                  <span data-label="">Filename</span>
                  <span data-label="">Type</span>
                  <span data-label="">Distance</span>
                  <span data-label="">Time</span>
                  <span data-label="">Elevation</span>
                  <span data-label="">Pace</span>
                  <span data-label="">Bins</span>
                  <span data-label="">Heart Rate</span>
                  <span data-label="">Calories</span>
                </div>
                {results.results.map((run, index) => {
                  const avgPace = run.distance > 0 ? (run.totalTime / 60) / run.distance : 0;
                  return (
                    <div key={index} className="table-row">
                      <span className="filename" data-label="Filename">{run.filename}</span>
                      <span className={`file-type ${run.fileType?.toLowerCase()}`} data-label="Type">{run.fileType}</span>
                      <span data-label="Distance">{run.distance.toFixed(1)} km</span>
                      <span data-label="Time">{formatTime(run.totalTime)}</span>
                      <span data-label="Elevation">{run.elevationGain} m</span>
                      <span data-label="Pace">{formatPace(avgPace)}</span>
                      <span data-label="Bins">{run.bins?.length || 0}</span> {/* ADD THIS */}
                      <span data-label="Heart Rate">{run.avgHeartRate ? `${run.avgHeartRate} bpm` : 'N/A'}</span>
                      <span data-label="Calories">{run.calories ? `${run.calories} cal` : 'N/A'}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Errors */}
            {results.errors.length > 0 && (
              <div className="errors">
                <h3>❌ Failed Files ({results.errors.length})</h3>
                {results.errors.map((err, index) => (
                  <div key={index} className="error-item">
                    <strong>{err.filename}:</strong> {err.error}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
