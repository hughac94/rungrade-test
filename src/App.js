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
  const [statType, setStatType] = useState('median'); // Add state for mean/median toggle
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
      
      console.log('Frontend: redDotData', data.redDotData); // <-- Add this

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
      const useFilters = filterSettings.removeUnreliableBins ||
        (filterSettings.enableHeartRateFilter &&
          (filterSettings.heartRateFilter.minHR !== null || filterSettings.heartRateFilter.maxHR !== null));

      // Use new endpoint if filters are enabled
      const endpoint = useFilters ? '/api/analyze-with-filters-json' : '/api/advanced-analysis';

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
        <h1>🏃‍♂️ PERSONAL GRADE ADJUSTED RUNNING ANALYSER </h1>
        <p>📁 Upload multiple GPX or FIT files, set filters, and analyse...   </p>
      </header>

      <main className="App-main">
        {/* Upload Section */}
        <div className="upload-section">
          

          <div
  style={{
    background: '#fff',
    borderRadius: 10,
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
    maxWidth: '1150px',
    width: '100%',
    margin: '32px auto 24px auto',
    padding: '24px 28px',
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
  }}
>
  <h2 style={{
    fontSize: '1.2rem',
    fontWeight: 700,
    color: '#fff',
    background: '#10b981',
    padding: '8px 0',
    borderRadius: '6px',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: '0.5px'
  }}>
    Choose Files and Processing Settings 
  </h2>

  <div style={{
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    justifyContent: 'space-between',
    flexWrap: 'wrap'
  }}>
    {/* File input and status */}
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <input
        type="file"
        multiple
        accept=".gpx,.fit"
        onChange={handleFileSelect}
        style={{
          fontSize: '15px',
          padding: '5px 10px',
          borderRadius: 4,
          border: '1px solid #ddd',
          background: '#f6f8fa'
        }}
      />
      {files.length > 0 && (
        <span style={{
          color: '#10b981',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          fontSize: '15px'
        }}>
          <span style={{ fontSize: '18px', marginRight: 4 }}>✅</span>
          {files.length} file{files.length > 1 ? 's' : ''} selected
        </span>
      )}
    </div>

    {/* Bin length select */}
    <div>
      <label htmlFor="binLength" style={{
        fontWeight: 500,
        color: '#333',
        fontSize: '0.98rem',
        marginRight: 6
      }}>
        Bin Length
      </label>
      <select
        id="binLength"
        value={binLength}
        onChange={e => setBinLength(parseInt(e.target.value))}
        style={{
          fontSize: '0.98rem',
          padding: '5px 10px',
          borderRadius: 4,
          border: '1px solid #ddd',
          background: '#f6f8fa'
        }}
      >
        <option value={25}>25m</option>
        <option value={50}>50m</option>
        <option value={100}>100m</option>
        <option value={200}>200m</option>
      </select>
    </div>

    {/* Batch mode toggle */}
    <div>
      <label style={{
        fontWeight: 500,
        color: '#333',
        fontSize: '0.98rem',
        marginRight: 6
      }}>
        Batch Mode
      </label>
      <input
        type="checkbox"
        checked={batchMode}
        onChange={e => setBatchMode(e.target.checked)}
        style={{ marginRight: 6 }}
      />
      <span style={{ color: '#666', fontSize: '0.95rem' }}>
        <span style={{ fontWeight: 400 }}>(recommended for &gt;5 files)</span>
      </span>
    </div>
  </div>

  {/* Upload button */}
  <button
    onClick={batchMode ? uploadAndAnalyzeBatch : uploadAndAnalyze}
    disabled={uploading || files.length === 0}
    style={{
      marginTop: 10,
      padding: '10px 0',
      fontSize: '1.05rem',
      fontWeight: 600,
      background: uploading ? '#e5e7eb' : '#e79d14ff',
      color: uploading ? '#666' : '#fff',
      border: 'none',
      borderRadius: 6,
      cursor: uploading ? 'not-allowed' : 'pointer',
      transition: 'background 0.2s'
    }}
  >
    {uploading ? (
      <span>
        <span className="spinner" style={{
          marginRight: 8,
          verticalAlign: 'middle'
        }}></span>
        {batchMode ? 
          `Processing File ${batchProgress.current}/${batchProgress.total}...` : 
          'Analyzing...'}
      </span>
    ) : (
      batchMode ? '🚀 Click To Upload To Processor (Batch)' : '🚀 Click To Upload To Processor'
    )}
  </button>

  {/* Error message */}
  {error && (
    <div style={{
      color: '#ef4444',
      background: '#fff0f0',
      borderRadius: 4,
      padding: '8px 12px',
      marginTop: 6,
      fontSize: '0.98rem',
      textAlign: 'center'
    }}>
      ❌ {error}
    </div>
  )}
</div>

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
            <div className="summary">
             <h3 style={{
  fontSize: '1.2rem',
  fontWeight: 700,
  color: '#fff',
  background: '#10b981',
  padding: '8px 0',
  borderRadius: '6px',
  marginBottom: 8,
  textAlign: 'center',
  letterSpacing: '0.5px'
}}>
  Summary Stats Of Uploaded Files
</h3>
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
            />

            {/* Show filter summary if filtered results exist */}
            {filteredResults && (
              <div className="filter-summary">
                <p>
                
                  {filterSettings.enableHeartRateFilter &&
                    ` • Heart Rate ${filterSettings.heartRateFilter.minHR || 'min'}-${filterSettings.heartRateFilter.maxHR || 'max'} bpm`
                  }
                </p>
                <p>
                  <strong>{filteredResults.summary.totalFilteredBins}</strong> bins analyzed
                  ({filteredResults.summary.totalOriginalBins - filteredResults.summary.totalFilteredBins} bins filtered out)
                </p>
                {/* Inline exclusion breakdown */}
                {filteredResults.summary.exclusionCounts && (
                  <p style={{ margin: '8px 0', color: '#666' }}>
                    Bins removed due to dodgy...
                    Pace ({filteredResults.summary.exclusionCounts.speed}),
                    Gradient ({filteredResults.summary.exclusionCounts.gradient}),
                    Time ({filteredResults.summary.exclusionCounts.timeInSeconds}),
                    Distance ({filteredResults.summary.exclusionCounts.distance}),
                    Heart Rate ({filteredResults.summary.exclusionCounts.heartRate})
                  </p>
                )}
              </div>
            )}

            {/* le Analysis Button */}
            <div className="analysis-actions">
              <button
                onClick={runAdvancedAnalysis}
                disabled={analyzingPatterns}
                className={`analysis-btn ${analyzingPatterns ? 'analyzing' : ''}`}
                style={{
                  background: analyzingPatterns ? '#e5e7eb' : '#e79d14ff',
                  color: analyzingPatterns ? '#666' : '#fff',
                  border: 'none',
                  borderRadius: 8,
                  fontWeight: 600,
                  fontSize: '16px',
                  padding: '15px 30px',
                  cursor: analyzingPatterns ? 'not-allowed' : 'pointer',
                  transition: 'background 0.2s'
                }}
              >
                {analyzingPatterns ? '🔬 Analyzing Patterns...' : '📈 Analyze'}
              </button>
              
            </div>

            {/* Advanced Analysis Results */}
            {advancedAnalysis && (
              <div className="advanced-analysis">
                <div style={{ marginBottom: '16px', width: '100%' }}>
  <h3 style={{
    fontSize: '1.2rem',
    fontWeight: 700,
    color: '#fff',
    background: '#10b981',
    padding: '8px 0',
    borderRadius: '6px',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: '0.5px',
    width: '100%',
  }}>
    🔬 Advanced Pattern Analysis
  </h3>
  <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
    <StatToggle 
      value={statType} 
      onChange={setStatType}
    />
  </div>
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
                    redDotData={advancedAnalysis.redDotData} // Pass this prop
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
