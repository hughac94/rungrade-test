import React from 'react';
import './App.css';
import { calculateGradeAdjustment } from './Coefficients';

const CustomTooltip = ({ content, visible, x, y }) => {
  if (!visible) return null;
  
  return (
    <div style={{
      position: 'absolute',
      left: x,
      top: y - 35,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      color: 'white',
      padding: '8px 12px',
      borderRadius: '4px',
      fontSize: '12px',
      whiteSpace: 'nowrap',
      zIndex: 1000,
      pointerEvents: 'none',
      transform: 'translateX(-50%)'
    }}>
      {content}
    </div>
  );
};

const GradientPaceChart = ({ gradientData, statType = 'mean' }) => {
  const [tooltip, setTooltip] = React.useState({ visible: false, content: '', x: 0, y: 0 });
  const chartRef = React.useRef();

  if (!gradientData || !gradientData.buckets || gradientData.buckets.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
        No gradient pace data available
      </div>
    );
  }

  // Choose which pace values to display based on statType
  const getPaceValue = (bucket) => statType === 'median' ? bucket.medianPace : bucket.avgPace;
  const getPaceLabel = (bucket) => statType === 'median' ? bucket.medianPaceMinPerKm : bucket.paceMinPerKm;

  // Calculate pace range for bar heights
  const paceValues = gradientData.buckets.map(bucket => getPaceValue(bucket)).filter(pace => pace);
  const maxPace = Math.max(...paceValues);
  const minPace = Math.min(...paceValues);
  const paceRange = maxPace - minPace;

const getBarColor = (bucket) => {
  // Special case for <=-25% label
  if (bucket.label.includes('≤-25') || bucket.label.includes('<=-25')) return '#10b981'; // Green
  const gradient = parseFloat(bucket.label.split(' ')[0]);
  if (gradient < 0) return '#10b981'; // Green for downhill
  if (gradient <= 5) return '#3b82f6'; // Blue for flat to moderate
  return '#ef4444'; // Red for steep uphill
};

  return (
    <div ref={chartRef} style={{ 
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      width: '100%',
      marginTop: 32,
      marginBottom: 40
    }}>
      <div style={{
        position: 'relative',
        background: '#fff',
        borderRadius: 8,
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        padding: '20px',
        maxWidth: '900px',
        width: '100%',
        margin: '0 auto'
      }}>
        {/* Title and subtitle inside white box */}
        <h3 style={{ 
          textAlign: 'center', 
          marginBottom: 8,
          marginTop: 0,
          color: '#333'
        }}>
          📈 Pace vs Gradient Analysis
        </h3>
        <p style={{ 
          textAlign: 'center', 
          maxWidth: '800px',
          marginBottom: 20,
          marginLeft: 'auto',
          marginRight: 'auto',
          color: '#666',
          fontSize: '14px'
        }}>
          How your pace changes with gradient • {gradientData.totalBinsAnalyzed} bins analyzed
        </p>

        {/* Chart bars */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'end',
          gap: '8px',
          width: '100%',
          maxWidth: '800px',
          margin: '0 auto 20px auto'
        }}>
          {gradientData.buckets.map((bucket, index) => {
            const barHeight = paceRange > 0 ? ((getPaceValue(bucket) - minPace) / paceRange) * 200 + 20 : 40;
            const barColor = getBarColor(bucket);
            
            return (
              <div key={index} style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                minWidth: '50px'
              }}>
                <div 
                  style={{ 
                    height: `${barHeight}px`,
                    backgroundColor: barColor,
                    width: '40px',
                    borderRadius: '4px 4px 0 0',
                    position: 'relative',
                    cursor: 'pointer',
                    transition: 'opacity 0.2s',
                    display: 'flex',
                    alignItems: 'flex-end',
                    justifyContent: 'center',
                    paddingBottom: '4px'
                  }}
                  onMouseEnter={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const chartRect = chartRef.current.getBoundingClientRect();
                    setTooltip({
                      visible: true,
                      content: `${getPaceLabel(bucket)} min/km (${bucket.binCount} bins)`,
                      x: rect.left + rect.width/2 - chartRect.left,
                      y: rect.top - chartRect.top
                    });
                  }}
                  onMouseLeave={() => setTooltip({ ...tooltip, visible: false })}
                >
                  <div style={{
                    fontSize: '10px',
                    color: '#fff',
                    fontWeight: 'bold',
                    textShadow: '0 1px 2px rgba(0,0,0,0.5)'
                  }}>
                    {getPaceLabel(bucket)}
                  </div>
                </div>
                <div style={{
                  fontSize: '11px',
                  fontWeight: 'bold',
                  marginTop: '4px',
                  textAlign: 'center',
                  color: '#333'
                }}>
                  {bucket.label}
                </div>
                <div style={{
                  fontSize: '9px',
                  color: '#666',
                  marginTop: '2px'
                }}>
                  {bucket.binCount} bins
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Legend inside white box */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '24px',
          marginTop: '16px',
          flexWrap: 'wrap',
          paddingTop: '16px',
          borderTop: '1px solid #e5e7eb'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <div style={{
              backgroundColor: '#10b981',
              width: '16px',
              height: '16px',
              borderRadius: '2px'
            }}></div>
            <span style={{ fontSize: '12px', color: '#333' }}>Downhill (negative gradient)</span>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <div style={{
              backgroundColor: '#3b82f6',
              width: '16px',
              height: '16px',
              borderRadius: '2px'
            }}></div>
            <span style={{ fontSize: '12px', color: '#333' }}>Flat to moderate uphill (0-5%)</span>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <div style={{
              backgroundColor: '#ef4444',
              width: '16px',
              height: '16px',
              borderRadius: '2px'
            }}></div>
            <span style={{ fontSize: '12px', color: '#333' }}>Steep uphill (+5%)</span>
          </div>
        </div>
      </div>

      <CustomTooltip {...tooltip} />
    </div>
  );
};

const GradeAdjustmentChart = ({ adjustmentData, gradientPaceData, statType = 'mean' }) => {
  // Tooltip state
  const [tooltipData, setTooltipData] = React.useState(null);


  console.log("GradeAdjustmentChart data check:");
  console.log("- adjustmentData:", adjustmentData);
  console.log("- gradientata:", gradientPaceData);

  console.log("Bucket details:");
  gradientPaceData.buckets.forEach((bucket, index) => {
    console.log(`Bucket ${index}:`, {
      label: bucket.label,
      min: bucket.min,
      max: bucket.max,
      calculated_midpoint: (bucket.min + bucket.max) / 2
    });
  });

  if (
    !adjustmentData ||
    !adjustmentData.adjustmentData ||
    adjustmentData.adjustmentData.length === 0
  ) {
    return null;
  }

  // Choose which values to display based on statType
  const data = adjustmentData.adjustmentData;
  const getPersonalAdjustment = (point) => {
    const value = statType === 'median' ? point.personalAdjustmentMedian : point.personalAdjustment;
    return (value != null && !isNaN(value)) ? value : 0;
  };
  const getPaceLabel = (point) => {
    const label = statType === 'median' ? point.medianPaceLabel : point.paceLabel;
    return label || 'N/A';
  };
  const getBasePace = () => {
    const value = statType === 'median' ? adjustmentData.basePaceMedian : adjustmentData.basePace;
    return (value != null && !isNaN(value)) ? value : 1;
  };
  const getBasePaceLabel = () => statType === 'median' ? adjustmentData.basePaceMedianLabel : adjustmentData.basePaceLabel;
  
const skipLabels = [
  '≥35', '>=35',
  '≤-35', '<=-35'
];

const bucketedData = [];
if (gradientPaceData && gradientPaceData.buckets && getBasePace()) {
  gradientPaceData.buckets.forEach(bucket => {
    // Remove spaces AND percent signs for robust matching
    const cleanLabel = bucket.label.replace(/\s/g, '').replace(/%/g, '');
    if (skipLabels.some(skip => cleanLabel.startsWith(skip))) {
      // Debug: log when skipping
      console.log('Skipping bucket:', bucket.label, 'as cleanLabel:', cleanLabel);
      return;
    }
    if (bucket.binCount > 0) {
      const bucketPace = statType === 'median' ? bucket.medianPace : bucket.avgPace;
      if (bucketPace) {
        let midpoint;
        if (bucket.label.includes('≤-25') || bucket.label.includes('<=-25')) {
          midpoint = -27.5;
        } else if (bucket.label.includes('≥25') || bucket.label.includes('>=25')) {
          midpoint = 27.5;
        } else {
          midpoint = (bucket.min + bucket.max) / 2;
        }
        if (
          typeof midpoint === 'number' &&
          !isNaN(midpoint) &&
          midpoint > -31 &&
          midpoint < 31
        ) {
          const adjustmentFactor = bucketPace / getBasePace();
          const literatureAdj = calculateGradeAdjustment(midpoint);
          bucketedData.push({
            midpoint,
            adjustmentFactor,
            literatureAdj,
            label: bucket.label,
            binCount: bucket.binCount,
            avgPace: bucket.avgPace
          });
        }
      }
    }
  });
}

  console.log("Debug median data:");
  console.log("- statType:", statType);
  console.log("- adjustmentData sample:", adjustmentData.adjustmentData[0]);
  console.log("- basePace:", getBasePace());
  console.log("- first point adjustment:", getPersonalAdjustment(data[0]));
  
  // Chart dimensions
  const chartHeight = 400; // Reduced to make room for title/subtitle
  const width = 900;
  const chartPadding = 60; // Increased padding for better spacing
  const chartWidth = width - 2 * chartPadding;

  // Calculate what the polynomial actually reaches across your gradient range
  const polynomialValues = [];
  for (let x = -30; x <= 30; x += 2) {
    polynomialValues.push(calculateGradeAdjustment(x));
  }

  // Find min/max adjustment values for scaling
  const validAdjustments = data
    .map(d => getPersonalAdjustment(d))
    .filter(adj => !isNaN(adj) && adj > 0);

  // Combine all adjustment values
  const allAdjustmentValues = [
    ...validAdjustments,
    ...polynomialValues
  ];

  // Calculate scale
  const maxAdjustment = Math.max(...allAdjustmentValues);
  const minAdjustment = Math.min(...allAdjustmentValues);
  const range = maxAdjustment - minAdjustment;
  const scalePadding = range * 0.1;
  const yMin = Math.max(minAdjustment - scalePadding, 0.3);
  const yMax = maxAdjustment + scalePadding;

  console.log(`Y-axis scale: ${yMin.toFixed(2)} to ${yMax.toFixed(2)}`);

  // Scale for x-axis (gradient)
  const gradientMin = -30;
  const gradientMax = 30;
  const gradientRange = gradientMax - gradientMin;

  const getX = gradientValue =>
    ((gradientValue - gradientMin) / gradientRange) * chartWidth + chartPadding;

  const getY = adjustmentValue =>
    chartHeight - ((adjustmentValue - yMin) / (yMax - yMin)) * (chartHeight - chartPadding) + 40; // Fixed positioning

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
    let adj = Math.floor(yMin / adjustmentStep) * adjustmentStep;
    adj <= yMax;
    adj += adjustmentStep
  ) {
    yGridLines.push(adj);
  }

  // Generate x-axis grid lines (every 5%)
  const xGridLines = [];
  for (let g = -30; g <= 30; g += 5) {
    xGridLines.push(g);
  }
  
  return (
    <div style={{ 
      marginTop: 32,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      width: '100%'
    }}>
      <div style={{
        position: 'relative',
        background: '#fff',
        borderRadius: 8,
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        padding: '20px',
        maxWidth: '900px',
        width: '100%',
        margin: '0 auto'
      }}>
        {/* Title and subtitle inside white box */}
        <h3 style={{ 
          textAlign: 'center', 
          marginBottom: 8,
          marginTop: 0,
          color: '#333'
        }}>
          📊 Grade Adjustment - Personal vs Literature
        </h3>
        <p style={{ 
          textAlign: 'center', 
          maxWidth: '800px',
          marginBottom: 20,
          marginLeft: 'auto',
          marginRight: 'auto',
          color: '#666',
          fontSize: '14px'
        }}>
          How your pace changes relative to flat ground (1.0 = same as flat) • 
          Base pace ({statType}) at 0%: {getBasePaceLabel()} min/km •  
          {data.reduce((sum, d) => sum + d.binCount, 0)} bins analyzed
        </p>

        {/* Chart SVG */}
        <svg width="100%" height={chartHeight + 80} style={{ 
          overflow: 'visible',
          display: 'block',
          margin: '0 auto'
        }}>
          {/* Y-axis grid lines */}
          {yGridLines.map(value => (
            <g key={`y-${value}`}>
              <line
                x1={chartPadding}
                x2={width - chartPadding}
                y1={getY(value)}
                y2={getY(value)}
                stroke="#e5e7eb"
                strokeDasharray="4 2"
                strokeWidth={1}
              />
              <text
                x={chartPadding - 8}
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
                y1={40}
                y2={chartHeight + 40}
                stroke="#e5e7eb"
                strokeDasharray="4 2"
                strokeWidth={1}
              />
              <text
                x={getX(value)}
                y={chartHeight + 56}
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
            x1={chartPadding}
            x2={width - chartPadding}
            y1={getY(1.0)}
            y2={getY(1.0)}
            stroke="#888"
            strokeWidth={1}
          />

          {/* X-axis - positioned at bottom */}
          <line
            x1={chartPadding}
            x2={width - chartPadding}
            y1={chartHeight + 40}
            y2={chartHeight + 40}
            stroke="#888"
            strokeWidth={1}
          />

          {/* Y-axis */}
          <line
            x1={chartPadding}
            x2={chartPadding}
            y1={40}
            y2={chartHeight + 40}
            stroke="#888"
            strokeWidth={1}
          />

          {/* Literature formula line */}
          <path d={literatureLinePath} fill="none" stroke="#3b82f6" strokeWidth={2} />

          {/* Personal data points */}
          {data
            .filter(point => {
              // Remove spaces and percent signs for robust matching
              const cleanLabel = (point.gradient + '').replace(/\s/g, '').replace(/%/g, '');
              // Exclude points with skip labels
              if (skipLabels.some(skip => cleanLabel.startsWith(skip))) return false;
              // Also filter by value
              return point.gradientValue >= -30 && point.gradientValue <= 30;
            })
            .map((point, idx) => (
              <circle
                key={idx}
                cx={getX(point.gradientValue)}
                cy={getY(getPersonalAdjustment(point))}
                r={4}
                fill="#ef4444"
                fillOpacity={0.4}
                stroke="#fff"
                strokeWidth={1}
                onMouseEnter={() => {
                  setTooltipData({
                    x: getX(point.gradientValue),
                    y: getY(getPersonalAdjustment(point)),
                    gradient: point.gradient,
                    personalAdj: getPersonalAdjustment(point) != null ? getPersonalAdjustment(point).toFixed(2) : 'N/A',
                    literatureAdj: calculateGradeAdjustment(point.gradientValue).toFixed(2),
                    binCount: point.binCount,
                    paceLabel: getPaceLabel(point)
                  });
                }}
                onMouseLeave={() => setTooltipData(null)}
                style={{cursor: 'pointer'}}
              />
            ))}

          {/* Bucket/category points */}
          {bucketedData
            .filter(bucket =>
              typeof bucket.midpoint === 'number' &&
              !isNaN(bucket.midpoint) &&
              bucket.midpoint > -31 &&
              bucket.midpoint < 31
            )
            .map((bucket, idx) => (
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
                      personalAdj: bucket.adjustmentFactor != null ? bucket.adjustmentFactor.toFixed(2) : 'N/A',
                      literatureAdj: calculateGradeAdjustment(bucket.midpoint).toFixed(2), // FIXED: use polynomial at this x
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

          {/* Tooltip rendering */}
          {tooltipData && (
            <g>
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

          {/* Legend inside SVG */}
          <g transform="translate(80, 30)">
            <rect width={180} height={55} rx={3} fill="white" fillOpacity={0.9} stroke="#e5e7eb" strokeWidth={1} />
            <circle cx={10} cy={12} r={3} fillOpacity={0.6} fill="#ef4444" />
            <text x={18} y={15} fontSize={10} fill="#333">Individual points</text>
            <rect x={7} y={25} width={6} height={6} fill="#3b82f6" stroke="#fff" strokeWidth={1} />
            <text x={18} y={30} fontSize={10} fill="#333">Bucket averages</text>
            <line x1={10} x2={30} y1={42} y2={42} stroke="#3b82f6" strokeWidth={2} />
            <text x={40} y={45} fontSize={10} fill="#333">Literature formula</text>
          </g>
        </svg>

        {/* Bottom explanation inside white box */}
        <div style={{ 
          marginTop: 8, 
          fontSize: 12, 
          color: '#666', 
          textAlign: 'center',
          maxWidth: '800px',
          marginLeft: 'auto',
          marginRight: 'auto',
          paddingTop: '16px',
          borderTop: '1px solid #e5e7eb'
        }}>
          <span>
            Adjustment factor = pace at gradient / pace at 0% gradient • Higher = slower pace
          </span>
        </div>
      </div>
    </div>
  );
};

export { GradientPaceChart, GradeAdjustmentChart };
