// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Area, AreaChart } from 'recharts';
import _ from 'lodash';
import * as math from 'mathjs';
import './App.css';

// Dice faces
const DICE = [2, 4, 6, 8, 12];
// Operators
const OPERATORS = ['+', '-', '*', '/'];

// Seeded random number generator (Mulberry32)
const seededRandom = (seed: number) => {
  return () => {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
};

// Seeded shuffle using Fisher-Yates algorithm
const seededShuffle = <T,>(array: T[], seed: number): T[] => {
  const rng = seededRandom(seed);
  const shuffled = [...array];

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
};

// Get today's date as a seed (YYYYMMDD)
const getTodaysSeed = (): number => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return parseInt(`${year}${month}${day}`);
};

// Generate a random practice seed that will never conflict with date seeds
// Date seeds are max 99991231, so we use 100000000+ for practice
const getPracticeSeed = (): number => {
  return Math.floor(Math.random() * 900000000) + 100000000; // Range: 100000000-999999999
};

// Generate a simple player ID from user agent
const generatePlayerId = (): string => {
  const ua = navigator.userAgent;
  // Create a simple hash from user agent
  let hash = 0;
  for (let i = 0; i < ua.length; i++) {
    const char = ua.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return `player_${Math.abs(hash)}`;
};

// Submit hiscore to API
const submitHiscore = async (seed: number, guessCount: number, finalExpression: string, playerId: string) => {
  try {
    const url = `https://biscuitverse-api-production.up.railway.app/api/v1/record-dice-match?seed=${seed}&guess_count=${guessCount}&final_expression=${encodeURIComponent(finalExpression)}&player=${encodeURIComponent(playerId)}&auth=DDD-2PM-TOKEN-XXXX`;
    const response = await fetch(url, { method: 'GET' });
    return response.ok;
  } catch (error) {
    console.error('Failed to submit hiscore:', error);
    return false;
  }
};

const DiceProbabilityGame = () => {
  // Game state
  const [targetExpression, setTargetExpression] = useState(null);
  const [targetDistribution, setTargetDistribution] = useState([]);
  const [currentDice, setCurrentDice] = useState([...DICE]);
  const [currentOperators, setCurrentOperators] = useState([...OPERATORS]);
  const [currentDistribution, setCurrentDistribution] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [draggedItem, setDraggedItem] = useState(null);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [draggedType, setDraggedType] = useState(null);
  const [graphType, setGraphType] = useState('filled-line'); // Options: 'filled-line', 'line', 'bar'
  const [selectedItem, setSelectedItem] = useState(null); // For tap-to-swap interface
  const [currentSeed, setCurrentSeed] = useState<number | null>(null); // Track current puzzle seed
  const [isSolved, setIsSolved] = useState(false); // Track if current puzzle is solved
  const [hiscoreSubmitted, setHiscoreSubmitted] = useState(false); // Track if hiscore was submitted

  // Initialize the game
  useEffect(() => {
    generateNewPuzzle();
  }, []);

  // Generate a puzzle with optional seed (defaults to today's daily challenge)
  const generateNewPuzzle = (seed?: number) => {
    // If no seed provided, use today's seed for daily challenge
    const puzzleSeed = seed !== undefined ? seed : getTodaysSeed();
    setCurrentSeed(puzzleSeed);

    // Shuffle dice and operators with seed
    const shuffledDice = seededShuffle([...DICE], puzzleSeed);
    const shuffledOperators = seededShuffle([...OPERATORS], puzzleSeed + 1); // Use seed + 1 for operators

    // Create a target expression
    const targetExp = createExpression(shuffledDice, shuffledOperators);
    setTargetExpression(targetExp);

    // Calculate target distribution
    const targetDist = calculateDistribution(targetExp);
    setTargetDistribution(targetDist);

    // Set up the player's initial state - different from target
    setCurrentDice([...DICE]);
    setCurrentOperators([...OPERATORS]);

    // Calculate initial distribution
    const initialExp = createExpression([...DICE], [...OPERATORS]);
    const initialDist = calculateDistribution(initialExp);
    setCurrentDistribution(initialDist);

    // Reset attempts
    setAttempts([]);

    // Reset selection
    setSelectedItem(null);

    // Reset solved state
    setIsSolved(false);
    setHiscoreSubmitted(false);
  };

  // Create an expression string from dice and operators
  const createExpression = (dice, operators) => {
    let exp = `${dice[0]}`;
    for (let i = 0; i < operators.length; i++) {
      exp += ` ${operators[i]} ${dice[i + 1]}`;
    }
    return exp;
  };

  // Calculate the probability distribution for an expression
  const calculateDistribution = (expressionString) => {
    // Parse the expression
    const parts = expressionString.split(' ');
    const dice = [];
    const ops = [];

    for (let i = 0; i < parts.length; i++) {
      if (i % 2 === 0) {
        dice.push(parseInt(parts[i]));
      } else {
        ops.push(parts[i]);
      }
    }

    // Generate all possible combinations
    const distributions = {};
    const maxValue = 100; // Reasonable upper bound

    // This is a recursive function to calculate all possible outcomes
    const calculateOutcomes = (diceIndex, currentValue) => {
      if (diceIndex === dice.length) {
        // We've used all dice, record this outcome
        if (Number.isFinite(currentValue) && Math.abs(currentValue) <= maxValue) {
          const roundedValue = Math.round(currentValue * 100) / 100;
          distributions[roundedValue] = (distributions[roundedValue] || 0) + 1;
        }
        return;
      }

      // Roll the current die
      for (let face = 1; face <= dice[diceIndex]; face++) {
        if (diceIndex === 0) {
          // First die, no operation yet
          calculateOutcomes(diceIndex + 1, face);
        } else {
          // Apply operation with previous value
          const op = ops[diceIndex - 1];
          let newValue;

          switch (op) {
            case '+':
              newValue = currentValue + face;
              break;
            case '-':
              newValue = currentValue - face;
              break;
            case '*':
              newValue = currentValue * face;
              break;
            case '/':
              // Handle division by zero
              newValue = face === 0 ? NaN : currentValue / face;
              break;
            default:
              newValue = NaN;
          }

          calculateOutcomes(diceIndex + 1, newValue);
        }
      }
    };

    calculateOutcomes(0, 0);

    // Convert to probability distribution
    const totalOutcomes = Object.values(distributions).reduce((a, b) => a + b, 0);

    // Create array of {value, probability} sorted by value
    const distArray = Object.entries(distributions).map(([value, count]) => ({
      value: parseFloat(value),
      probability: count / totalOutcomes
    })).sort((a, b) => a.value - b.value);

    return distArray;
  };

  // Handle item selection and swapping (tap interface)
  const handleItemSelect = (index, type) => {
    if (!selectedItem) {
      // First tap - select the item
      setSelectedItem({ index, type });
    } else {
      // Second tap - attempt to swap
      if (selectedItem.type === type) {
        // Can only swap items of the same type
        // Perform the swap
        if (type === 'dice') {
          const newDice = [...currentDice];
          const temp = newDice[index];
          newDice[index] = newDice[selectedItem.index];
          newDice[selectedItem.index] = temp;
          setCurrentDice(newDice);

          // Update distribution
          const newExp = createExpression(newDice, currentOperators);
          const newDist = calculateDistribution(newExp);
          setCurrentDistribution(newDist);

          // Add to attempts
          addAttempt(newExp, newDist);
        } else {
          const newOperators = [...currentOperators];
          const temp = newOperators[index];
          newOperators[index] = newOperators[selectedItem.index];
          newOperators[selectedItem.index] = temp;
          setCurrentOperators(newOperators);

          // Update distribution
          const newExp = createExpression(currentDice, newOperators);
          const newDist = calculateDistribution(newExp);
          setCurrentDistribution(newDist);

          // Add to attempts
          addAttempt(newExp, newDist);
        }
      }
      // Reset selection after second tap (whether swap succeeded or not)
      setSelectedItem(null);
    }
  };

  // For desktop compatibility, also keep drag and drop
  const handleDragStart = (index, type) => {
    if (type === 'dice') {
      setDraggedItem(currentDice[index]);
    } else {
      setDraggedItem(currentOperators[index]);
    }
    setDraggedIndex(index);
    setDraggedType(type);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (index, type) => {
    if (draggedType !== type) return; // Can only swap the same type

    if (type === 'dice') {
      const newDice = [...currentDice];
      const temp = newDice[index];
      newDice[index] = newDice[draggedIndex];
      newDice[draggedIndex] = temp;
      setCurrentDice(newDice);

      // Update distribution
      const newExp = createExpression(newDice, currentOperators);
      const newDist = calculateDistribution(newExp);
      setCurrentDistribution(newDist);

      // Add to attempts
      addAttempt(newExp, newDist);
    } else {
      const newOperators = [...currentOperators];
      const temp = newOperators[index];
      newOperators[index] = newOperators[draggedIndex];
      newOperators[draggedIndex] = temp;
      setCurrentOperators(newOperators);

      // Update distribution
      const newExp = createExpression(currentDice, newOperators);
      const newDist = calculateDistribution(newExp);
      setCurrentDistribution(newDist);

      // Add to attempts
      addAttempt(newExp, newDist);
    }

    // Reset dragged item
    setDraggedItem(null);
    setDraggedIndex(null);
    setDraggedType(null);
  };

  // Add an attempt to the history
  const addAttempt = (expression, distribution) => {
    // Calculate distance from target
    const distance = calculateDistance(distribution, targetDistribution);

    const newAttempt = {
      expression,
      distance,
      timestamp: Date.now()
    };

    setAttempts(prev => {
      // Check if this expression already exists
      const existingIndex = prev.findIndex(a => a.expression === expression);

      let updated;
      if (existingIndex !== -1) {
        // Expression exists, update its timestamp
        updated = [...prev];
        updated[existingIndex] = newAttempt;
        updated = updated.sort((a, b) => a.distance - b.distance);
      } else {
        // New expression, add it
        updated = [...prev, newAttempt];
        updated = updated.sort((a, b) => a.distance - b.distance);
      }

      // Check if puzzle is solved (distance very close to 0)
      if (distance < 0.0001 && !isSolved && currentSeed !== null) {
        setIsSolved(true);

        // Only submit hiscore for daily puzzles (seeds < 100000000)
        if (currentSeed < 100000000 && !hiscoreSubmitted) {
          const playerId = generatePlayerId();
          const guessCount = updated.length;

          // Submit hiscore
          submitHiscore(currentSeed, guessCount, expression, playerId).then(success => {
            if (success) {
              setHiscoreSubmitted(true);
              console.log('Hiscore submitted successfully!');
            }
          });
        }
      }

      return updated;
    });
  };

  // Calculate distance between two distributions
  const calculateDistance = (dist1, dist2) => {
    // This is a simple implementation - we can refine later
    // For now, just sum the squared differences of probabilities at each value
    let distance = 0;

    // Create maps for easier lookup
    const map1 = new Map(dist1.map(d => [d.value, d.probability]));
    const map2 = new Map(dist2.map(d => [d.value, d.probability]));

    // All possible values
    const allValues = new Set([...map1.keys(), ...map2.keys()]);

    for (const value of allValues) {
      const p1 = map1.get(value) || 0;
      const p2 = map2.get(value) || 0;
      distance += Math.pow(p1 - p2, 2);
    }

    return Math.sqrt(distance);
  };

  // Create combined chart data
  const createChartData = () => {
    // Combine target and current distributions
    const allValues = new Set([
      ...targetDistribution.map(d => d.value),
      ...currentDistribution.map(d => d.value)
    ]);

    // Create lookup maps
    const targetMap = new Map(targetDistribution.map(d => [d.value, d.probability]));
    const currentMap = new Map(currentDistribution.map(d => [d.value, d.probability]));

    // Find max probability for normalization
    let maxProb = 0;
    for (const p of [...targetMap.values(), ...currentMap.values()]) {
      maxProb = Math.max(maxProb, p);
    }

    // Normalize and interpolate points for smoother curves
    const rawData = Array.from(allValues).sort((a, b) => a - b).map(value => ({
      value,
      target: currentMap.get(value) || 0,
      current: targetMap.get(value) || 0
    }));

    // Add intermediate points for smoother curves (linear interpolation)
    const smoothedData = [];
    for (let i = 0; i < rawData.length; i++) {
      smoothedData.push(rawData[i]);

      // Add intermediate points between this point and the next
      if (i < rawData.length - 1) {
        const current = rawData[i];
        const next = rawData[i + 1];

        // Only add points if they're not too close
        if (next.value - current.value > 0.5) {
          const midValue = (current.value + next.value) / 2;
          const midTarget = (current.target + next.target) / 2;
          const midCurrent = (current.current + next.current) / 2;

          smoothedData.push({
            value: midValue,
            target: midTarget,
            current: midCurrent
          });
        }
      }
    }

    return smoothedData;
  };

  // Get current expression
  const getCurrentExpression = () => {
    return createExpression(currentDice, currentOperators);
  };

  // Load an expression from history
  const loadExpression = (expression: string) => {
    // Parse the expression to extract dice and operators
    const parts = expression.split(' ');
    const dice: number[] = [];
    const operators: string[] = [];

    for (let i = 0; i < parts.length; i++) {
      if (i % 2 === 0) {
        // Dice value
        dice.push(parseInt(parts[i]));
      } else {
        // Operator
        operators.push(parts[i]);
      }
    }

    // Update state
    setCurrentDice(dice);
    setCurrentOperators(operators);

    // Recalculate distribution
    const newDist = calculateDistribution(expression);
    setCurrentDistribution(newDist);

    // Reset selection
    setSelectedItem(null);
  };

  // Get current expression with parentheses showing evaluation order
  const getFormattedExpression = () => {
    if (currentDice.length === 0) return null;

    const parts = [];

    // Add opening parentheses (n-1 for n dice)
    const numOpenParens = currentDice.length - 2;
    if (numOpenParens > 0) {
      parts.push(
        <span key="open-parens" className="faint-paren">
          {'('.repeat(numOpenParens)}
        </span>
      );
    }

    // Add first die
    parts.push(<span key="dice-0">d{currentDice[0]}</span>);

    // Add each operator and die with closing paren
    for (let i = 0; i < currentOperators.length; i++) {
      parts.push(<span key={`op-${i}`}> {currentOperators[i]} </span>);
      parts.push(<span key={`dice-${i + 1}`}>d{currentDice[i + 1]}</span>);

      if (i !== currentOperators.length - 1) {
        parts.push(
          <span key={`close-${i}`} className="faint-paren">
            )
          </span>
        );
      }
    }

    return parts;
  };

  // Main render
  return (
    <div className="flex flex-col w-full min-h-screen p-3 sm:p-6 md:p-8 gap-4 sm:gap-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <h1 className="text-3xl sm:text-4xl md:text-5xl" style={{ fontFamily: 'Cinzel, serif', textShadow: '2px 2px 4px rgba(0,0,0,0.2)' }}>
          Daily Dice Destiny
        </h1>
        <button
          onClick={() => generateNewPuzzle(getPracticeSeed())}
          className="fantasy-button"
        >
          Practice
        </button>
      </div>

      {/* Target Expression */}
      <div className="fantasy-card p-4 sm:p-6">
        <h2 className="fantasy-section-header text-xl sm:text-2xl">Target</h2>
        <div className="help-text text-base sm:text-lg">
          Match this probability distribution by rearranging your dice and operators
        </div>
      </div>

      {/* Chart */}
      <div className="fantasy-card p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3">
          <h2 className="fantasy-section-header text-xl sm:text-2xl mb-0 border-0 pb-0">Distributions</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setGraphType('filled-line')}
              className={`fantasy-button small ${graphType !== 'filled-line' ? 'secondary' : ''}`}
            >
              Filled
            </button>
            <button
              onClick={() => setGraphType('line')}
              className={`fantasy-button small ${graphType !== 'line' ? 'secondary' : ''}`}
            >
              Line
            </button>
            <button
              onClick={() => setGraphType('bar')}
              className={`fantasy-button small ${graphType !== 'bar' ? 'secondary' : ''}`}
            >
              Bar
            </button>
          </div>
        </div>
        <div className="fantasy-chart h-56 sm:h-64 md:h-80">
          <ResponsiveContainer width="100%" height="100%">
            {graphType === 'bar' ? (
              <BarChart data={createChartData()} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="value"
                  domain={['dataMin', 'dataMax']}
                  label={{ value: 'Result Value', position: 'bottom', offset: 0 }}
                />
                <YAxis
                  domain={[0, 'dataMax']}
                  label={{ value: 'Probability', angle: -90, position: 'left' }}
                />
                <Tooltip />
                <Bar dataKey="target" fill="#8884d8" fillOpacity={0.6} name="Target" />
                <Bar dataKey="current" fill="#82ca9d" fillOpacity={0.6} name="Your Solution" />
              </BarChart>
            ) : graphType === 'filled-line' ? (
              <AreaChart data={createChartData()} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="value"
                  domain={['dataMin', 'dataMax']}
                  label={{ value: 'Result Value', position: 'bottom', offset: 0 }}
                />
                <YAxis
                  domain={[0, 'dataMax']}
                  label={{ value: 'Probability', angle: -90, position: 'left' }}
                />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="target"
                  stroke="#8884d8"
                  fill="#8884d8"
                  fillOpacity={0.4}
                  strokeWidth={2}
                  dot={false}
                  name="Target"
                  isAnimationActive={false}
                />
                <Area
                  type="monotone"
                  dataKey="current"
                  stroke="#82ca9d"
                  fill="#82ca9d"
                  fillOpacity={0.4}
                  strokeWidth={2}
                  dot={false}
                  name="Your Solution"
                  isAnimationActive={false}
                />
              </AreaChart>
            ) : (
              <LineChart data={createChartData()} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="value"
                  domain={['dataMin', 'dataMax']}
                  label={{ value: 'Result Value', position: 'bottom', offset: 0 }}
                />
                <YAxis
                  domain={[0, 'dataMax']}
                  label={{ value: 'Probability', angle: -90, position: 'left' }}
                />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="target"
                  stroke="#8884d8"
                  strokeWidth={2}
                  dot={false}
                  name="Target"
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="current"
                  stroke="#82ca9d"
                  strokeWidth={2}
                  dot={false}
                  name="Your Solution"
                  isAnimationActive={false}
                />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* Current Expression Editor */}
      <div className="fantasy-card p-4 sm:p-6">
        <h2 className="fantasy-section-header text-xl sm:text-2xl">Your Expression</h2>
        {isSolved && (
          <div className="mb-4 p-4 bg-green-100 dark:bg-green-900 border-2 border-green-500 rounded-lg text-center">
            <div className="text-2xl font-bold text-green-700 dark:text-green-300 mb-2">
              Puzzle Solved!
            </div>
            {hiscoreSubmitted && currentSeed && currentSeed < 100000000 && (
              <div className="text-base text-green-600 dark:text-green-400">
                Your score has been submitted to the leaderboard
              </div>
            )}
          </div>
        )}
        <div className="expression-display mb-4 text-lg sm:text-xl">
          {getFormattedExpression()}
        </div>
        <div className="flex items-center justify-center flex-wrap gap-2 sm:gap-3 mb-4">
          {currentDice.map((die, index) => (
            <React.Fragment key={`dice-${index}`}>
              <div
                draggable
                onDragStart={() => handleDragStart(index, 'dice')}
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(index, 'dice')}
                onClick={() => handleItemSelect(index, 'dice')}
                className={`fantasy-die flex items-center justify-center ${selectedItem && selectedItem.type === 'dice' && selectedItem.index === index
                  ? 'selected'
                  : ''
                  }`}
              >
                d{die}
              </div>
              {index < currentOperators.length && (
                <div
                  draggable
                  onDragStart={() => handleDragStart(index, 'operator')}
                  onDragOver={handleDragOver}
                  onDrop={() => handleDrop(index, 'operator')}
                  onClick={() => handleItemSelect(index, 'operator')}
                  className={`fantasy-operator flex items-center justify-center ${selectedItem && selectedItem.type === 'operator' && selectedItem.index === index
                    ? 'selected'
                    : ''
                    }`}
                >
                  {currentOperators[index]}
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
        <div className="flex flex-col gap-3">
          <div className="help-text text-base sm:text-lg">
            {selectedItem
              ? `Select another ${selectedItem.type === 'dice' ? 'die' : 'operator'} to swap`
              : 'Tap to select, then tap another to swap. Drag and drop works on desktop.'}
          </div>
          {currentDistribution.length > 0 && (
            <div className="text-center">
              <span className="distance-badge text-base sm:text-lg">
                Distance: {calculateDistance(currentDistribution, targetDistribution).toFixed(4)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Previous Attempts */}
      <div className="fantasy-card p-4 sm:p-6">
        <h2 className="fantasy-section-header text-xl sm:text-2xl">Best Attempts</h2>
        <div className="max-h-48 sm:max-h-64 overflow-y-auto overflow-x-auto">
          {attempts.length === 0 ? (
            <div className="help-text text-center py-8 text-base sm:text-lg">
              No attempts yet. Start swapping to see your results!
            </div>
          ) : (
            <table className="fantasy-table">
              <thead>
                <tr>
                  <th className="text-base sm:text-lg">Expression</th>
                  <th className="text-base sm:text-lg">Distance</th>
                </tr>
              </thead>
              <tbody>
                {attempts.slice(0, 5).map((attempt, i) => (
                  <tr
                    key={i}
                    className={`${i === 0 ? "best-attempt" : ""} cursor-pointer`}
                    onClick={() => loadExpression(attempt.expression)}
                  >
                    <td className="font-mono text-base sm:text-lg">{attempt.expression}</td>
                    <td className="font-semibold text-base sm:text-lg">{attempt.distance.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default DiceProbabilityGame;
