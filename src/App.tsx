import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Area, AreaChart } from 'recharts';
import _ from 'lodash';
import * as math from 'mathjs';

// Dice faces
const DICE = [2, 4, 6, 8, 12];
// Operators
const OPERATORS = ['+', '-', '*', '/'];

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

  // Initialize the game
  useEffect(() => {
    generateNewPuzzle();
  }, []);

  // Generate a new random puzzle
  const generateNewPuzzle = () => {
    // Shuffle dice and operators
    const shuffledDice = _.shuffle([...DICE]);
    const shuffledOperators = _.shuffle([...OPERATORS]);

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
      const updated = [...prev, newAttempt];
      // Sort by lowest distance
      return updated.sort((a, b) => a.distance - b.distance);
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
      target: targetMap.get(value) || 0,
      current: currentMap.get(value) || 0
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

  // Main render
  return (
    <div className="flex flex-col w-full h-full p-4 space-y-4 bg-gray-50">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dice Probability Matching Game</h1>
        <button
          onClick={generateNewPuzzle}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          New Puzzle
        </button>
      </div>

      {/* Target Expression */}
      <div className="p-4 bg-white rounded shadow">
        <h2 className="text-lg font-semibold mb-2">Target Distribution</h2>
        <div className="text-gray-500 mb-2">
          Try to match this probability distribution by rearranging your dice and operators
        </div>
      </div>

      {/* Chart */}
      <div className="p-4 bg-white rounded shadow">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold">Probability Distributions</h2>
          <div className="flex space-x-2">
            <button
              onClick={() => setGraphType('filled-line')}
              className={`px-2 py-1 text-sm rounded ${graphType === 'filled-line' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
            >
              Filled
            </button>
            <button
              onClick={() => setGraphType('line')}
              className={`px-2 py-1 text-sm rounded ${graphType === 'line' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
            >
              Line
            </button>
            <button
              onClick={() => setGraphType('bar')}
              className={`px-2 py-1 text-sm rounded ${graphType === 'bar' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
            >
              Bar
            </button>
          </div>
        </div>
        <div className="h-64">
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
      <div className="p-4 bg-white rounded shadow">
        <h2 className="text-lg font-semibold mb-2">Your Expression: {getCurrentExpression()}</h2>
        <div className="flex items-center space-x-2 text-lg">
          {currentDice.map((die, index) => (
            <React.Fragment key={`dice-${index}`}>
              <div
                draggable
                onDragStart={() => handleDragStart(index, 'dice')}
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(index, 'dice')}
                onClick={() => handleItemSelect(index, 'dice')}
                className={`flex items-center justify-center w-12 h-12 border-2 rounded bg-white cursor-pointer
                  ${selectedItem && selectedItem.type === 'dice' && selectedItem.index === index
                    ? 'border-yellow-500 bg-yellow-100'
                    : 'border-blue-500'}`}
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
                  className={`flex items-center justify-center w-10 h-10 border-2 rounded bg-white cursor-pointer
                    ${selectedItem && selectedItem.type === 'operator' && selectedItem.index === index
                      ? 'border-yellow-500 bg-yellow-100'
                      : 'border-red-500'}`}
                >
                  {currentOperators[index]}
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
        <div className="mt-4 text-sm">
          <p>
            {selectedItem
              ? `Select another ${selectedItem.type === 'dice' ? 'die' : 'operator'} to swap with`
              : 'Tap an item to select, then tap another to swap. You can also drag and drop on desktop.'}
          </p>
          <p>Current distance from target: {attempts.length > 0 ? attempts[0].distance.toFixed(4) : "N/A"}</p>
        </div>
      </div>

      {/* Previous Attempts */}
      <div className="p-4 bg-white rounded shadow">
        <h2 className="text-lg font-semibold mb-2">Best Attempts</h2>
        <div className="max-h-48 overflow-y-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-left p-2">Expression</th>
                <th className="text-left p-2">Distance</th>
              </tr>
            </thead>
            <tbody>
              {attempts.slice(0, 5).map((attempt, i) => (
                <tr key={i} className={i === 0 ? "bg-green-100" : ""}>
                  <td className="p-2">{attempt.expression}</td>
                  <td className="p-2">{attempt.distance.toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DiceProbabilityGame;
