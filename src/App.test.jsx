import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import App from './App';

// Mock StadiumCanvas since WebGL/Canvas is not supported in jsdom
vi.mock('./components/StadiumCanvas', () => {
  return {
    default: ({ telemetry, activeGate, setActiveGate }) => (
      <div data-testid="stadium-canvas">
        <div data-testid="active-gate">{activeGate || 'none'}</div>
        {Object.entries(telemetry.gates).map(([key, _gate]) => (
          <button
            key={key}
            data-testid={`canvas-gate-${key}`}
            onClick={() => setActiveGate(key)}
          >
            {key}
          </button>
        ))}
      </div>
    ),
  };
});

// Mock SpeechRecognition to avoid window errors in jsdom environment
if (typeof window !== 'undefined') {
  window.SpeechRecognition = window.SpeechRecognition || vi.fn();
  window.webkitSpeechRecognition = window.webkitSpeechRecognition || vi.fn();
  window.HTMLElement.prototype.scrollIntoView = window.HTMLElement.prototype.scrollIntoView || vi.fn();
}

describe('Stadium Operations App Tests', () => {
  let fetchSpy;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const getSliderForGate = (gateName) => {
    const gateElement = screen.getByText(gateName);
    let parent = gateElement.parentElement;
    while (parent && !parent.querySelector('input[type="range"]')) {
      parent = parent.parentElement;
    }
    return parent ? parent.querySelector('input[type="range"]') : null;
  };

  test('1. Changing a gate occupancy slider correctly updates its state value', () => {
    render(<App />);
    
    const slider = getSliderForGate('Gate A - North Access');
    expect(slider).toBeDefined();
    
    // Change value to 45%
    fireEvent.change(slider, { target: { value: '45' } });
    
    // Check if the displayed congestion updates
    const valueDisplays = screen.getAllByText(/45%/);
    expect(valueDisplays.length).toBeGreaterThan(0);
  });

  test('2. A gate with occupancy above 80% is correctly flagged as "heavy" status', () => {
    render(<App />);
    
    const slider = getSliderForGate('Gate A - North Access');
    
    // Change occupancy to 85% (> 80%)
    fireEvent.change(slider, { target: { value: '85' } });
    
    // Locate the container and check status
    const gateElement = screen.getByText('Gate A - North Access');
    const container = gateElement.closest('div.cursor-pointer');
    expect(container.textContent).toContain('heavy');
  });

  test('3. The app handles a missing or failed Gemini API response gracefully without crashing', async () => {
    // Mock API failure (status 500)
    fetchSpy.mockImplementation(() =>
      Promise.resolve({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      })
    );

    render(<App />);

    // Click on Gate D to select it (initial congestion 82% -> status heavy)
    const gateElement = screen.getByText('Gate D - South East Entry');
    fireEvent.click(gateElement.closest('div.cursor-pointer'));

    // Wait for the debounce (500ms) plus a buffer
    await new Promise((resolve) => setTimeout(resolve, 700));

    // Verify fallback UI is rendered (e.g. "HEAVY CONGESTION WARNING" from alternate gate fallback)
    const fallbackUi = await screen.findByText('HEAVY CONGESTION WARNING');
    expect(fallbackUi).toBeDefined();
  });

  test('4. A gate at 0% occupancy is correctly flagged as "clear" status', () => {
    render(<App />);
    
    const slider = getSliderForGate('Gate C - East Plaza'); // initially 48% (moderate)
    
    // Change occupancy to 0%
    fireEvent.change(slider, { target: { value: '0' } });
    
    // Locate the container and check status
    const gateElement = screen.getByText('Gate C - East Plaza');
    const container = gateElement.closest('div.cursor-pointer');
    expect(container.textContent).toContain('clear');
  });
});
