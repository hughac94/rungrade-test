import React from 'react';
import './App.css';
import { calculateGradeAdjustment } from './Coefficients';

function PaceByGradientdDetailChart({ data }) {
  if (!data || data.length === 0) return null;

  // Prepare x-axis categories
  const gradientCategories = ['<=-35', ...Array.from({length: 69}, (_, i) => (i - 34).toString()), '>=35'];
  const dataMap = {};
  data.forEach(row => {
    dataMap[row.gradient] = row;
  });

  // Find min/max pace for scaling
  const validPaces = data.map(d => d.avgPace).filter(Boolean);
  const maxPace = Math.max(...validPaces);
  const minPace = Math.min(...validPaces);
  const paceRange = maxPace - minPace || 1;

  // Calculate grid lines for y axis (every 30 seconds)
  const minPaceSec = Math.floor(minPace * 60) - 30; // start below min pace, but not too far
  const maxPaceSec = Math.ceil(maxPace * 60);
  const yGridStep = 60; // seconds
  const yGridLines = [];
  for (let s = Math.ceil(minPaceSec / yGridStep) * yGridStep; s <= maxPaceSec; s += yGridStep) {
    yGridLines.push(s);
  }

  // Calculate grid lines for x axis (every 5)
  const xGridStep = 5;
  const xGridLines = ['<=-35'];
  for (let g = -35; g <= 35; g += xGridStep) {
    xGridLines.push(g.toString());
  }
  xGridLines.push('>=35');

  // Color by gradient
  const getPointColor = (gradient) => {
    if (gradient === '<=-35') return '#10b981';
    if (gradient === '>=35') return '#ef4444';
    const g = parseInt(gradient, 10);
    if (g < 0) return '#10b981'; // green for downhill
    if (g <= 5) return '#3b82f6'; // blue for flat/moderate
    return '#ef4444'; // red for steep uphill
  };

  // Chart dimensions
  const chartHeight = 220;
  const availableWidth = 840; // Fixed width adjusted for padding and margins
  const pointsWidth = availableWidth - 60; // subtract space for y-axis labels
  // Calculate point spacing dynamically based on available width
  const pointSpacing = pointsWidth / (gradientCategories.length - 1);

  return (
    <div className="gradient-chart pace-gradient-scatter-plot" style={{marginTop: 32}}>
      <h3>📈 Pace vs Gradient Analysis - by individual %</h3>
      <p className="chart-subtitle">
        How your pace changes with gradient • {data.reduce((sum, d) => sum + d.binCount, 0)} bins analyzed
      </p>

      <div style={{
        position: 'relative',
        height: chartHeight + 40, // Add space for x-axis labels
        width: '100%',
        maxWidth: 900,
        margin: '0 auto',
        background: '#fff',
        borderRadius: 8,
        boxShadow: '0 2px 8px #0001',
        padding: '16px 0'
      }}>
        {/* SVG for all grid lines and axes */}
        <svg 
          width="100%" 
          height={chartHeight + 40}
          style={{
            overflow: 'visible'
          }}
        >
          {/* Left margin for y-axis labels */}
          <g transform="translate(60, 0)">
            {/* Y grid lines */}
            {yGridLines.map((s, idx) => {
              const pace = s / 60;
              const y = chartHeight - (((pace - minPace) / paceRange) * 180 + 20);
              return (
                <g key={s}>
                  <line
                    x1={0}
                    x2={pointsWidth}
                    y1={y}
                    y2={y}
                    stroke="#e5e7eb"
                    strokeDasharray="4 2"
                    strokeWidth={1}
                  />
                  <text
                    x={-8}
                    y={y}
                    fontSize={10}
                    fill="#666"
                    textAnchor="end"
                    alignmentBaseline="middle"
                  >
                    {Math.floor(pace)}:{(Math.round((pace - Math.floor(pace)) * 60)).toString().padStart(2, '0')}
                  </text>
                </g>
              );
            })}

            {/* X grid lines */}
            {xGridLines.map((g) => {
              // Calculate position proportionally across the available width
              const index = gradientCategories.indexOf(g);
              if (index < 0) return null;
              const x = index * pointSpacing;
              
              return (
                <g key={g}>
                  <line
                    x1={x}
                    x2={x}
                    y1={0}
                    y2={chartHeight}
                    stroke="#e5e7eb"
                    strokeDasharray="4 2"
                    strokeWidth={1}
                  />
                  {/* X-axis label */}
                  {(g === '<=-35' || g === '>=35' || xGridLines.includes(g)) && (
                    <text
                      x={x}
                      y={chartHeight + 16}
                      fontSize={10}
                      fill="#666"
                      textAnchor="middle"
                    >
                      {g}
                    </text>
                  )}
                </g>
              );
            })}

            {/* X-axis line */}
            <line
              x1={0}
              x2={pointsWidth}
              y1={chartHeight}
              y2={chartHeight}
              stroke="#bbb"
              strokeWidth={1}
            />

            {/* Data points */}
            {gradientCategories.map((grad, idx) => {
              const row = dataMap[grad];
              if (!row) return null;

              // Position points proportionally across available width
              const x = idx * pointSpacing;
              const y = chartHeight - (((row.avgPace - minPace) / paceRange) * 180 + 20);
              
              return (
                <circle
                  key={grad}
                  cx={x}
                  cy={y}
                  r={3.5} // Slightly smaller to avoid overcrowding
                  fill={getPointColor(grad)}
                  stroke="#fff"
                  strokeWidth={1.5}
                  style={{cursor: 'pointer'}}
                  title={`Gradient: ${grad}\nPace: ${row.paceLabel}\nBins: ${row.binCount}`}
                />
              );
            })}
          </g>
        </svg>
      </div>

      <div style={{marginTop: 8, fontSize: 12, color: '#666', textAlign: 'center'}}>
        <span style={{marginRight: 16}}><span style={{color: '#10b981'}}>●</span> Downhill</span>
        <span style={{marginRight: 16}}><span style={{color: '#3b82f6'}}>●</span> Flat/Moderate</span>
        <span><span style={{color: '#ef4444'}}>●</span> Steep Uphill</span>
      </div>
    </div>
  );
}



const GradientPaceChart = ({ gradientData }) => {
  if (!gradientData || !gradientData.buckets || gradientData.buckets.length === 0) {
    return (
      <div className="gradient-chart">
        <h3>📈 Pace vs Gradient Analysis - by bucket</h3>
        <p>No gradient data available</p>
      </div>
    );
  }

  const maxPace = Math.max(...gradientData.buckets.map(b => b.avgPace));
  const minPace = Math.min(...gradientData.buckets.map(b => b.avgPace));
  const paceRange = maxPace - minPace;

  // Function to get color based on gradient range
  const getBarColor = (bucket) => {
    // Extract the numeric gradient from the bucket (use the midpoint of the range)
    const gradientMidpoint = (bucket.min + bucket.max) / 2;
    
    console.log(`Bucket: ${bucket.label}, Min: ${bucket.min}, Max: ${bucket.max}, Midpoint: ${gradientMidpoint}`);
    
    if (gradientMidpoint < 0) {
      return '#10b981'; // Green for downhill
    } else if (gradientMidpoint <= 5) {
      return '#3b82f6'; // Blue for flat to moderate uphill
    } else {
      return '#ef4444'; // Red for steep uphill
    }
  };

  return (
    <div className="gradient-chart">
      <h3>📈 Pace vs Gradient Analysis</h3>
      <p className="chart-subtitle">
        How your pace changes with gradient • {gradientData.totalBinsAnalyzed} bins analyzed
      </p>
      
      <div className="chart-container">
        <div className="chart-bars">
          {gradientData.buckets.map((bucket, index) => {
            const barHeight = paceRange > 0 ? ((bucket.avgPace - minPace) / paceRange) * 200 + 20 : 40;
            const barColor = getBarColor(bucket);
            
            return (
              <div key={index} className="bar-container">
                <div 
                  className="bar" 
                  style={{ 
                    height: `${barHeight}px`,
                    backgroundColor: barColor
                  }}
                  title={`${bucket.label}: ${bucket.paceMinPerKm} pace (${bucket.binCount} bins, ${(bucket.totalDistance/1000).toFixed(1)}km)`}
                >
                  <div className="bar-value">{bucket.paceMinPerKm}</div>
                </div>
                <div className="bar-label">{bucket.label}</div>
                <div className="bar-count">{bucket.binCount} bins</div>
              </div>
            );
          })}
        </div>
      </div>
      
      <div className="chart-legend">
        <div className="legend-item">
          <div className="legend-color" style={{backgroundColor: '#10b981'}}></div>
          <span>Downhill (negative gradient)</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{backgroundColor: '#3b82f6'}}></div>
          <span>Flat to moderate uphill (0-5%)</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{backgroundColor: '#ef4444'}}></div>
          <span>Steep uphill (+5%)</span>
        </div>
      </div>
    </div>
  );
};

const GradeAdjustmentChart = ({ adjustmentData, gradientBuckets }) => {
  if (
    !adjustmentData ||
    !adjustmentData.adjustmentData ||
    adjustmentData.adjustmentData.length === 0
  ) {
    return null;
  }

  const data = adjustmentData.adjustmentData;
  const basePace = adjustmentData.basePace; // assume basePace in min/km is provided
  const basePaceLabel = adjustmentData.basePaceLabel;

  // Chart dimensions (taller)
  const chartHeight = 340;
  const padding = 40;
  const width = 900;
  const chartWidth = width - 2 * padding;

  // Find min/max adjustment values for scaling
  const allPersonalAdj = data.map(d => d.personalAdjustment);
  const allLiteratureAdj = data.map(d => d.literatureAdjustment);

  // Add category adjustment factors if present
  let bucketAdjFactors = [];
  if (gradientBuckets && basePace) {
    bucketAdjFactors = gradientBuckets
      .filter(bucket => bucket.avgPace > 0)
      .map(bucket => ({
        midpoint: (bucket.min + bucket.max) / 2,
        label: bucket.label,
        adjustment: bucket.avgPace / basePace,
        paceLabel: bucket.paceMinPerKm,
        binCount: bucket.binCount,
        totalDistance: bucket.totalDistance,
      }));
  }

  const allBucketAdj = bucketAdjFactors.map(b => b.adjustment);

  const minAdj = Math.min(
    ...allPersonalAdj,
    ...allLiteratureAdj,
    ...allBucketAdj
  ) * 0.95;
  const maxAdj = Math.max(
    ...allPersonalAdj,
    ...allLiteratureAdj,
    ...allBucketAdj
  ) * 1.05;
  const adjRange = maxAdj - minAdj;

  // Scale for x-axis (gradient)
  const gradientMin = -35;
  const gradientMax = 35;
  const gradientRange = gradientMax - gradientMin;

  const getX = gradientValue =>
    ((gradientValue - gradientMin) / gradientRange) * chartWidth + padding;

  const getY = adjustmentValue =>
    chartHeight - ((adjustmentValue - minAdj) / adjRange) * (chartHeight - padding) - padding / 2;

  // Formatter for y-axis labels
  const formatAdjustment = value => value.toFixed(2);

  // Generate points for literature formula line
  const literatureLine = [];
  for (let g = gradientMin; g <= gradientMax; g++) {
    const x = g;
    const y = calculateGradeAdjustment(x);
    literatureLine.push({ x: getX(g), y: getY(y) });
  }
  const literatureLinePath = `M${literatureLine.map(p => `${p.x},${p.y}`).join(' L')}`;

  // Generate y-axis grid lines
  const adjustmentStep = 0.2;
  const yGridLines = [];
  for (
    let adj = Math.floor(minAdj / adjustmentStep) * adjustmentStep;
    adj <= maxAdj;
    adj += adjustmentStep
  ) {
    yGridLines.push(adj);
  }

  // Generate x-axis grid lines (every 5%)
  const xGridLines = [];
  for (let g = -35; g <= 35; g += 5) {
    xGridLines.push(g);
  }

  return (
    <div className="gradient-chart grade-adjustment-chart" style={{ marginTop: 32 }}>
      <h3>📊 Grade Adjustment - Personal vs Literature</h3>
      <p className="chart-subtitle">
        How your pace changes relative to flat ground (1.0 = same as flat) •
        Base pace at 0%: {basePaceLabel} min/km •
        {data.reduce((sum, d) => sum + d.binCount, 0)} bins analyzed
      </p>

      <div
        style={{
          position: 'relative',
          height: chartHeight + 40,
          width: '100%',
          maxWidth: width,
          margin: '0 auto',
          background: '#fff',
          borderRadius: 8,
          boxShadow: '0 2px 8px #0001',
          padding: '16px 0'
        }}
      >
        <svg width="100%" height={chartHeight + 40} style={{ overflow: 'visible' }}>
          {/* Y-axis grid lines */}
          {yGridLines.map(value => (
            <g key={`y-${value}`}>
              <line
                x1={padding}
                x2={width - padding}
                y1={getY(value)}
                y2={getY(value)}
                stroke="#e5e7eb"
                strokeDasharray="4 2"
                strokeWidth={1}
              />
              <text
                x={padding - 8}
                y={getY(value)}
                fontSize={10}
                fill="#666"
                textAnchor="end"
                alignmentBaseline="middle"
              >
                {formatAdjustment(value)}
              </text>
            </g>
          ))}

          {/* X-axis grid lines */}
          {xGridLines.map(value => (
            <g key={`x-${value}`}>
              <line
                x1={getX(value)}
                x2={getX(value)}
                y1={padding / 2}
                y2={chartHeight - padding / 2}
                stroke="#e5e7eb"
                strokeDasharray="4 2"
                strokeWidth={1}
              />
              <text
                x={getX(value)}
                y={chartHeight + 16}
                fontSize={10}
                fill="#666"
                textAnchor="middle"
              >
                {value}%
              </text>
            </g>
          ))}

          {/* Highlight 1.0 (no adjustment) line */}
          <line
            x1={padding}
            x2={width - padding}
            y1={getY(1.0)}
            y2={getY(1.0)}
            stroke="#888"
            strokeWidth={1}
          />

          {/* X-axis */}
          <line
            x1={padding}
            x2={width - padding}
            y1={chartHeight - padding / 2}
            y2={chartHeight - padding / 2}
            stroke="#888"
            strokeWidth={1}
          />

          {/* Y-axis */}
          <line
            x1={padding}
            x2={padding}
            y1={padding / 2}
            y2={chartHeight - padding / 2}
            stroke="#888"
            strokeWidth={1}
          />

          {/* Literature formula line */}
          <path d={literatureLinePath} fill="none" stroke="#3b82f6" strokeWidth={2} />

          {/* Personal data points */}
          {data.map((point, idx) => (
            <circle
              key={idx}
              cx={getX(point.gradientValue)}
              cy={getY(point.personalAdjustment)}
              r={3}
              fill="#ef4444"
              stroke="#fff"
              strokeWidth={1}
              title={`${point.gradient}%: ${point.personalAdjustment} adjustment (${point.binCount} bins)`}
            />
          ))}

          {/* Bucket/category points from Pace vs Gradient Analysis */}
          {bucketAdjFactors.map((bucket, idx) => (
            <rect
              key={`bucket-${idx}`}
              x={getX(bucket.midpoint) - 6}
              y={getY(bucket.adjustment) - 6}
              width={12}
              height={12}
              fill="none"
              stroke="#3b82f6"
              strokeWidth={2}
              rx={2}
              title={`${bucket.label}: ${bucket.paceLabel} min/km, Adjustment: ${bucket.adjustment.toFixed(2)}, ${bucket.binCount} bins, ${(bucket.totalDistance/1000).toFixed(1)}km`}
            />
          ))}
        </svg>

        {/* Legend outside the SVG */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 32, marginTop: 16, fontSize: 14 }}>
          <span>
            <span style={{
              display: 'inline-block',
              verticalAlign: 'middle',
              width: 12, height: 12, borderRadius: '50%',
              background: '#ef4444', marginRight: 6, border: '2px solid #fff'
            }} />
            Your adjustment factor (individual)
          </span>
          <span>
            <span style={{
              display: 'inline-block',
              verticalAlign: 'middle',
              width: 14, height: 14, borderRadius: 3,
              border: '2px solid #3b82f6', background: 'white', marginRight: 6
            }} />
            Bucket average (category)
          </span>
          <span>
            <span style={{
              display: 'inline-block',
              verticalAlign: 'middle',
              width: 32, height: 2, background: '#3b82f6', marginRight: 6
            }} />
            Literature formula
          </span>
        </div>
      </div>

      <div style={{ marginTop: 8, fontSize: 12, color: '#666', textAlign: 'center' }}>
        <span>
          Adjustment factor = pace at gradient / pace at 0% gradient • Higher = slower pace
        </span>
      </div>
    </div>
  );
};


export { GradientPaceChart };
export { GradeAdjustmentChart};
export default PaceByGradientdDetailChart
