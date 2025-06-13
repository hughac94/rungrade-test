import React from 'react';
import './App.css';
import { calculateGradeAdjustment } from './Coefficients';

const CustomTooltip = ({ content, visible, x, y }) => {
  if (!visible) return null;
  
  return (
    <div 
      className="custom-tooltip" 
      style={{
        position: 'absolute',
        left: `${x}px`,
        top: `${y}px`,
        backgroundColor: 'rgba(0,0,0,0.75)',
        color: '#fff',
        padding: '4px 8px',
        borderRadius: '4px',
        fontSize: '11px',
        zIndex: 1000,
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
        transform: 'translate(-50%, -100%)',
        marginTop: '-5px'
      }}
    >
      {content}
    </div>
  );
};


const GradientPaceChart = ({ gradientData }) => {
  const [tooltip, setTooltip] = React.useState({ visible: false, content: '', x: 0, y: 0 });
  const chartRef = React.useRef(null);
  
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
    
  
    
    if (gradientMidpoint < 0) {
      return '#10b981'; // Green for downhill
    } else if (gradientMidpoint <= 5) {
      return '#3b82f6'; // Blue for flat to moderate uphill
    } else {
      return '#ef4444'; // Red for steep uphill
    }
  };

  return (
    <div className="gradient-chart" ref={chartRef} style={{ position: 'relative' }}>
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
                  onMouseEnter={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const chartRect = chartRef.current.getBoundingClientRect();
                    setTooltip({
                      visible: true,
                      content: `${bucket.paceMinPerKm} min/km (${bucket.binCount} bins)`,
                      x: rect.left + rect.width/2 - chartRect.left,
                      y: rect.top - chartRect.top
                    });
                  }}
                  onMouseLeave={() => setTooltip({ ...tooltip, visible: false })}
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

      <CustomTooltip {...tooltip} />
    </div>
  );
};


const GradeAdjustmentChart = ({ adjustmentData, gradientData }) => {
  // Tooltip state
  const [tooltipData, setTooltipData] = React.useState(null);

  if (
    !adjustmentData ||
    !adjustmentData.adjustmentData ||
    adjustmentData.adjustmentData.length === 0
  ) {
    return null;
  }

  const data = adjustmentData.adjustmentData;
  const basePace = adjustmentData.basePace;

  // Calculate bucketed adjustment factors
  const bucketedData = [];
  if (gradientData && gradientData.buckets) {
    gradientData.buckets.forEach(bucket => {
      if (bucket.avgPace && basePace) {
        const midpoint = (bucket.min === -Infinity) ? -30 :
                         (bucket.max === Infinity) ? 30 :
                         (bucket.min + bucket.max) / 2;
        const adjustmentFactor = bucket.avgPace / basePace;
        const literatureAdj = calculateGradeAdjustment(midpoint);
        bucketedData.push({
          midpoint,
          adjustmentFactor,
          literatureAdj,
          label: bucket.label,
          binCount: bucket.binCount
        });
      }
    });
  }

  // Chart dimensions
  const chartHeight = 450;
  const padding = 40;
  const width = 900;
  const chartWidth = width - 2 * padding;

  // Find min/max adjustment values for scaling
  const allPersonalAdj = data.map(d => d.personalAdjustment);
  const allLiteratureAdj = data.map(d => d.literatureAdjustment);

  const minAdj = Math.min(
    ...allPersonalAdj,
    ...allLiteratureAdj,
    ...bucketedData.map(b => b.adjustmentFactor)
  ) * 0.95;
  const maxAdj = Math.max(
    ...allPersonalAdj,
    ...allLiteratureAdj,
    ...bucketedData.map(b => b.adjustmentFactor)
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

  // Tooltip rendering - absolute div in chart container
  const renderTooltip = () => {
    if (!tooltipData) return null;
    // Clamp the tooltip to the visible area if needed
    const tooltipWidth = 180;
    const tooltipHeight = 50;
    let left = tooltipData.x + 15;
    let top = tooltipData.y - tooltipHeight - 10;
    // Clamp left and top
    left = Math.max(left, 0);
    top = Math.max(top, 0);
    return (
      <div
        style={{
          position: 'absolute',
          pointerEvents: 'none',
          left,
          top,
          width: tooltipWidth,
          minHeight: tooltipHeight,
          background: 'rgba(0,0,0,0.85)',
          color: '#fff',
          borderRadius: 6,
          fontSize: 13,
          padding: '8px 12px',
          zIndex: 100,
          boxShadow: '0 2px 8px #0003',
          whiteSpace: 'pre-line',
        }}
      >
       
        
      </div>
    );
  };

  return (
    <div className="gradient-chart grade-adjustment-chart" style={{ marginTop: 32 }}>
      <h3>📊 Grade Adjustment - Personal vs Literature</h3>
      <p className="chart-subtitle">
        How your pace changes relative to flat ground (1.0 = same as flat) •
        Base pace at 0%: {adjustmentData.basePaceLabel} min/km •
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
        {/* Legend - positioned away from y-axis, smaller and more compact */}
        <g transform="translate(80, 20)">
          <rect width={180} height={55} rx={3} fill="white" fillOpacity={0.9} stroke="#e5e7eb" strokeWidth={1} />
          <circle cx={10} cy={12} r={1.5} fillOpacity={0.6} fill="#ef4444" />
          <text x={18} y={15} fontSize={10} fill="#333">Individual points</text>
          <rect x={7} y={25} width={6} height={6} fill="#3b82f6" stroke="#fff" strokeWidth={1} />
          <text x={18} y={30} fontSize={10} fill="#333">Bucket averages</text>
          <line x1={10} x2={35} y1={42} y2={42} stroke="#3b82f6" strokeWidth={2} />
          <text x={40} y={45} fontSize={10} fill="#333">Literature formula</text>
        </g>

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
              r={4}
              fill="#ef4444"
              stroke="#fff"
              strokeWidth={1}
              onMouseEnter={() => {
                setTooltipData({
                  x: getX(point.gradientValue),
                  y: getY(point.personalAdjustment),
                  gradient: point.gradient,
                  personalAdj: point.personalAdjustment.toFixed(2),
                  literatureAdj: point.literatureAdjustment.toFixed(2),
                  binCount: point.binCount
                });
              }}
              onMouseLeave={() => setTooltipData(null)}
              style={{cursor: 'pointer'}}
            />
          ))}

          {/* Bucket/category points */}
          {bucketedData.map((bucket, idx) => (
            <g key={`bucket-${idx}`}>
              <rect
                x={getX(bucket.midpoint) - 4}
                y={getY(bucket.adjustmentFactor) - 4}
                width={8}
                height={8}
                fill="#3b82f6"
                stroke="#fff"
                strokeWidth={1.5}
                onMouseEnter={() => {
                  setTooltipData({
                    x: getX(bucket.midpoint),
                    y: getY(bucket.adjustmentFactor),
                    gradient: bucket.label,
                    personalAdj: bucket.adjustmentFactor.toFixed(2),
                    literatureAdj: bucket.literatureAdj.toFixed(2),
                    binCount: bucket.binCount
                  });
                }}
                onMouseLeave={() => setTooltipData(null)}
                style={{cursor: 'pointer'}}
              />
              {/* Connecting line to literature value */}
              <line
                x1={getX(bucket.midpoint)}
                y1={getY(bucket.adjustmentFactor)}
                x2={getX(bucket.midpoint)}
                y2={getY(bucket.literatureAdj)}
                stroke="#666"
                strokeWidth={1}
                strokeDasharray="2 2"
                opacity={0.6}
              />
            </g>
          ))}

          {/* Tooltip rendering - SVG group for better control */}
          {tooltipData && (
            <g className="tooltip">
              <rect
                x={tooltipData.x + 8}
                y={tooltipData.y - 45}
                width={120}
                height={48}
                rx={3}
                fill="rgba(0,0,0,0.8)"
                stroke="rgba(255,255,255,0.2)"
                strokeWidth={1}
              />
              <text
                x={tooltipData.x + 12}
                y={tooltipData.y - 32}
                fontSize={9}
                fontWeight="bold"
                fill="#fff"
              >
                Gradient: {tooltipData.gradient}%
              </text>
              <text
                x={tooltipData.x + 12}
                y={tooltipData.y - 22}
                fontSize={9}
                fill="#fff"
              >
                Personal: {tooltipData.personalAdj}x
              </text>
              <text
                x={tooltipData.x + 12}
                y={tooltipData.y - 12}
                fontSize={9}
                fill="#fff"
              >
                Literature: {tooltipData.literatureAdj}x
              </text>
              <text
                x={tooltipData.x + 12}
                y={tooltipData.y - 2}
                fontSize={8}
                fill="#ccc"
              >
                {tooltipData.binCount} bins
              </text>
            </g>
          )}
        </svg>

        {/* Tooltip rendered on top of chart */}
        {renderTooltip()}
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
// export default PaceByGradientdDetailChart
