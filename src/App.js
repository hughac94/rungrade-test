import React, { useState } from 'react';
import './App.css';
import /* PaceByGradientDetailChart, */ { GradientPaceChart, GradeAdjustmentChart} from './PaceChart';
import StatToggle from './StatToggle';

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
  const [batchProgress, setBatchProgress] = useState({ percent: 0, current: 0, total: 0 });
  const [processedFiles, setProcessedFiles] = useState(0);

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
  setBatchProgress({ percent: 0, current: 0, total: 0 });
  setProcessedFiles(0);
  
  try {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });
    formData.append('binLength', binLength.toString());

    const response = await fetch(`${BACKEND_URL}/api/analyze-batch`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Handle Server-Sent Events
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let allResults = [];
    let allErrors = [];
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value);

      let lines = buffer.split('\n');
      // Keep the last line in buffer if it's incomplete
      buffer = lines.pop();

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue; // skip empty
          try {
            const data = JSON.parse(jsonStr);

            if (data.type === 'progress') {
              setBatchProgress({
                percent: data.progressPercent,
                current: data.batchIndex,
                total: data.totalBatches
              });
              setProcessedFiles(data.filesProcessed);

              if (data.batchResults) {
                allResults = [...allResults, ...data.batchResults];
              }
              if (data.batchErrors) {
                allErrors = [...allErrors, ...data.batchErrors];
              }

            } else if (data.type === 'complete') {
              const finalResults = {
                success: true,
                results: data.results,
                errors: data.errors,
                summary: {
                  totalFiles: data.totalFiles,
                  successfulFiles: data.successfulFiles,
                  binLength: data.binLength,
                  totalBins: data.totalBins,
                  avgBinsPerFile: Math.round(data.totalBins / data.successfulFiles)
                }
              };
              setResults(finalResults);
              console.log('Batch analysis complete:', finalResults);

            } else if (data.type === 'error') {
              throw new Error(data.error);
            }

          } catch (parseError) {
            // Only log if the line is not empty and not just whitespace
            if (jsonStr) {
              console.error('Error parsing SSE data:', parseError, jsonStr);
            }
          }
        }
      }
    }

  } catch (err) {
    console.error('Batch upload error:', err);
    setError(`Failed to analyze files: ${err.message}`);
  } finally {
    setUploading(false);
  }
};

  const runAdvancedAnalysis = async () => {
    if (!results || !results.results) return;
    
    setAnalyzingPatterns(true);
    
    try {
      
      
      const response = await fetch(`${BACKEND_URL}/api/advanced-analysis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          results: results.results // Send existing results data
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        setAdvancedAnalysis(data.analyses);
        console.log('Advanced analysis complete:', data.analyses);
      } else {
        throw new Error(data.error || 'Analysis failed');
      }
      
      if (data.success) {
  
  setAdvancedAnalysis(data.analyses);
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

  return (
    <div className="App">
      <header className="App-header">
        <h1>🏃‍♂️ GPX & FIT Analysis Test</h1>
        <p>Upload GPX or FIT files to test backend processing</p>
      </header>

      <main className="App-main">
        {/* Upload Section */}
        <div className="upload-section">
          <h2>📁 Upload GPX or FIT Files</h2>
          
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
    Batch Mode (for 10+ files)
  </label>
</div>

          <button
            onClick={batchMode ? uploadAndAnalyzeBatch : uploadAndAnalyze}
            disabled={uploading || files.length === 0}
            className={`upload-btn ${uploading ? 'uploading' : ''}`}
          >
            {uploading ? (
              batchMode ? 
              `⏳ Processing Batch ${batchProgress.current}/${batchProgress.total}...` : 
              '⏳ Analyzing...'
            ) : (
              batchMode ? '🚀 Upload & Analyze (Batch)' : '🚀 Upload & Analyze'
            )}
          </button>

          {/* Batch Progress */}
{uploading && batchMode && (
  <div className="batch-progress">
    <div className="progress-bar" style={{ width: `${batchProgress.percent}%` }}></div>
    <p>
      Processing batch {batchProgress.current} of {batchProgress.total} 
      ({batchProgress.percent}%) • {processedFiles} files completed
    </p>
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

            {/* Advanced Analysis Button */}
            <div className="analysis-actions">
              <button
                onClick={runAdvancedAnalysis}
                disabled={analyzingPatterns}
                className={`analysis-btn ${analyzingPatterns ? 'analyzing' : ''}`}
              >
                {analyzingPatterns ? '🔬 Analyzing Patterns...' : '📈 Analyze Patterns'}
              </button>
              <p className="analysis-note">
                Analyze pace vs gradient, heart rate zones, and performance patterns across all {results.summary.totalBins} bins
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
