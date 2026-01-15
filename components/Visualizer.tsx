
import React, { useEffect, useRef } from 'react';

interface VisualizerProps {
  analyser: AnalyserNode | null;
  isActive: boolean;
  color?: string; // Keep base color prop if needed, but it will be overridden when isActive
}

const Visualizer: React.FC<VisualizerProps> = ({ analyser, isActive, color = '#3b82f6' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !analyser) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions explicitly for consistent rendering
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    let animationId: number;

    const draw = () => {
      animationId = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const barWidth = (canvas.width / bufferLength) * 2.5;
      let barHeight;
      let x = 0;

      // Calculate average amplitude for dynamic coloring
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      const averageAmplitude = sum / bufferLength; // Value from 0-255

      if (isActive) {
        // Map averageAmplitude to hue and lightness for a vibrant, reactive color
        // Hue from a deep blue/indigo (240) to a purple/pink (280-300)
        // Lightness from a darker shade (40%) to a brighter one (70%)
        const hue = 240 + (averageAmplitude / 255) * 60; // Range from 240 to 300 (blue to magenta)
        const lightness = 40 + (averageAmplitude / 255) * 30; // Range from 40% to 70%
        ctx.fillStyle = `hsl(${hue}, 90%, ${lightness}%)`;
      } else {
        // When inactive, use a fixed muted color
        ctx.fillStyle = '#4b5563'; // Tailwind slate-600 equivalent
      }

      for (let i = 0; i < bufferLength; i++) {
        barHeight = dataArray[i] / 2; // Adjust divisor for visual scale
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

        x += barWidth + 1; // Add 1px gap between bars
      }
    };

    draw();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [analyser, isActive]); // Removed 'color' from dependency array as it's now dynamically generated
                               // Note: canvas dimensions are set on effect run, consider resizing if window resizes.

  return (
    <canvas 
      ref={canvasRef} 
      // Initial fixed size, will be adjusted by offsetWidth/Height in useEffect
      width={300} 
      height={80} 
      className={`w-full h-20 rounded-lg opacity-80 transition-colors duration-300 ${isActive ? 'border-indigo-400 border-2' : 'border-slate-700 border'}`}
    />
  );
};

export default Visualizer;