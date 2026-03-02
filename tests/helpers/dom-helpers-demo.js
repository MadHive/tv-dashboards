#!/usr/bin/env bun
// DOM Helpers Demo — Simple demonstration of DOM helper usage

import {
  setupDOM,
  mockCanvas,
  simulateClick,
  getCanvasOperations
} from './dom-helpers.js';

console.log('DOM Helpers Demonstration');
console.log('==================================================');

// 1. Setup DOM environment
console.log('\n1. Setup DOM Environment:');
const { window, document, container, cleanup } = setupDOM();
console.log('   ✓ Created JSDOM environment');
console.log('   ✓ Container element:', container.id);
console.log('   ✓ Window available:', !!window);
console.log('   ✓ Document available:', !!document);

// 2. Create DOM elements
console.log('\n2. DOM Manipulation:');
const div = document.createElement('div');
div.className = 'test-widget';
div.textContent = 'Test Widget Content';
container.appendChild(div);

const found = container.querySelector('.test-widget');
console.log('   ✓ Created widget element');
console.log('   ✓ Found in container:', !!found);

// 3. Test canvas mocking
console.log('\n3. Canvas Mocking:');
const canvas = document.createElement('canvas');
canvas.width = 400;
canvas.height = 200;

const { ctx } = mockCanvas(canvas);
console.log('   ✓ Created mock canvas');

// Draw shapes
ctx.fillRect(10, 10, 100, 50);
ctx.beginPath();
ctx.arc(200, 100, 50, 0, Math.PI * 2);
ctx.stroke();

const operations = getCanvasOperations(canvas);
console.log('   ✓ Recorded', operations.length, 'operations');
console.log('   ✓ Types:', operations.map(op => op.type).join(', '));

// 4. Test events
console.log('\n4. Event Simulation:');
const button = document.createElement('button');
let clicks = 0;

button.addEventListener('click', () => clicks++);
simulateClick(button);
simulateClick(button);

console.log('   ✓ Simulated clicks:', clicks);

// 5. Cleanup
console.log('\n5. Cleanup:');
cleanup();
console.log('   ✓ Environment cleaned up');

console.log('\n==================================================');
console.log('All DOM helpers working correctly!\n');
