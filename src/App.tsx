import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Dices, 
  RotateCcw, 
  RotateCw, 
  FlipHorizontal, 
  Eraser, 
  Pen, 
  Download, 
  Trash2, 
  Undo2, 
  Redo2,
  Settings2,
  Layers,
  Palette,
  Image as ImageIcon,
  Save
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type ShapeType = 'curve' | 'line' | 'circle' | 'rect';

interface ScribbleSettings {
  density: number;
  size: number;
  types: ShapeType[];
  grayscale: boolean;
  opacity: number;
}

interface CanvasState {
  drawData: ImageData;
  scribbleData: ImageData;
}

export default function App() {
  const scribbleCanvasRef = useRef<HTMLCanvasElement>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState<'pen' | 'eraser' | 'scribble-eraser' | 'scribble-rect-eraser'>('pen');
  const [color, setColor] = useState('#141414');
  const [brushSize, setBrushSize] = useState(3);
  const [brushOpacity, setBrushOpacity] = useState(1);
  const [startPoint, setStartPoint] = useState<{x: number, y: number} | null>(null);

  // Canvas size management
  const [canvasDim, setCanvasDim] = useState({ width: 1200, height: 800 });
  const [isAutoFit, setIsAutoFit] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [batchSize, setBatchSize] = useState(1);
  
  // Background Image
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);
  const [bgOpacity, setBgOpacity] = useState(1.0);
  const bgInputRef = useRef<HTMLInputElement>(null);
  
  const [settings, setSettings] = useState<ScribbleSettings>({
    density: 5,
    size: 1.0,
    types: ['curve', 'line', 'circle'],
    grayscale: true,
    opacity: 0.4,
  });

  const [history, setHistory] = useState<CanvasState[]>([]);
  const [redoStack, setRedoStack] = useState<CanvasState[]>([]);
  const [showSettings, setShowSettings] = useState(false);

  // Initialize Canvas Sizes
  const applyDimensions = useCallback((w: number, h: number) => {
    if (!scribbleCanvasRef.current || !drawCanvasRef.current) return;
    
    const dCtx = drawCanvasRef.current.getContext('2d');
    const sCtx = scribbleCanvasRef.current.getContext('2d');
    
    let dData: ImageData | null = null;
    let sData: ImageData | null = null;

    if (dCtx && drawCanvasRef.current.width > 0 && drawCanvasRef.current.height > 0) {
      dData = dCtx.getImageData(0, 0, drawCanvasRef.current.width, drawCanvasRef.current.height);
    }
    if (sCtx && scribbleCanvasRef.current.width > 0 && scribbleCanvasRef.current.height > 0) {
      sData = sCtx.getImageData(0, 0, scribbleCanvasRef.current.width, scribbleCanvasRef.current.height);
    }

    [scribbleCanvasRef.current, drawCanvasRef.current].forEach(canvas => {
      canvas.width = w;
      canvas.height = h;
    });

    if (dCtx && dData) dCtx.putImageData(dData, 0, 0);
    if (sCtx && sData) sCtx.putImageData(sData, 0, 0);
  }, []);

  const fitToScreen = useCallback(() => {
    if (!containerRef.current?.parentElement) return;
    const parent = containerRef.current.parentElement;
    const padding = 64; // Match the p-8 (32px * 2)
    const availableW = parent.clientWidth - padding;
    const availableH = parent.clientHeight - padding;
    
    if (availableW <= 0 || availableH <= 0 || canvasDim.width <= 0 || canvasDim.height <= 0) return;

    const scaleW = availableW / canvasDim.width;
    const scaleH = availableH / canvasDim.height;
    const newZoom = Math.min(scaleW, scaleH, 1);
    
    setZoom(prev => (Math.abs(prev - newZoom) > 0.001 ? newZoom : prev));
  }, [canvasDim.width, canvasDim.height]);

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom(prev => Math.min(Math.max(0.1, prev * delta), 5));
    }
  };

  const getCanvasCoords = (e: React.MouseEvent | React.TouchEvent | any) => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    let clientX, clientY;
    if ('touches' in e && (e as TouchEvent).touches.length > 0) {
      clientX = (e as TouchEvent).touches[0].clientX;
      clientY = (e as TouchEvent).touches[0].clientY;
    } else if ('changedTouches' in e && (e as TouchEvent).changedTouches.length > 0) {
      clientX = (e as TouchEvent).changedTouches[0].clientX;
      clientY = (e as TouchEvent).changedTouches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    return {
      x: (clientX - rect.left) / zoom,
      y: (clientY - rect.top) / zoom
    };
  };

  const resizeCanvas = useCallback(() => {
    if (!containerRef.current || !isAutoFit) return;
    const parent = containerRef.current.parentElement;
    if (!parent) return;

    const padding = 64;
    const { width, height } = parent.getBoundingClientRect();
    const w = Math.floor(width - padding);
    const h = Math.floor(height - padding);
    
    if (w <= 0 || h <= 0) return;

    setCanvasDim(prev => {
      if (prev.width === w && prev.height === h) return prev;
      return { width: w, height: h };
    });
    
    applyDimensions(w, h);
    setZoom(1);
  }, [isAutoFit, applyDimensions]);

  useEffect(() => {
    if (isAutoFit) {
      resizeCanvas();
    }
  }, [isAutoFit, resizeCanvas]);

  useEffect(() => {
    if (!isAutoFit) {
      fitToScreen();
    }
  }, [isAutoFit, fitToScreen]);

  useEffect(() => {
    const handleResize = () => {
      if (isAutoFit) resizeCanvas();
      else fitToScreen();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isAutoFit, resizeCanvas, fitToScreen]);

  // Manually update dimensions when not auto-fitting
  useEffect(() => {
    if (!isAutoFit) {
      applyDimensions(canvasDim.width, canvasDim.height);
    }
  }, [canvasDim, isAutoFit, applyDimensions]);

  const generateScribbles = (append = false) => {
    saveToHistory();
    const canvas = scribbleCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (settings.types.length === 0) {
      alert('図形の種類を少なくとも一つ選択してください');
      return;
    }

    const { width, height } = canvas;
    if (!append) ctx.clearRect(0, 0, width, height);
    
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    const count = settings.density * 12 * batchSize;
    for (let i = 0; i < count; i++) {
      const type = settings.types[Math.floor(Math.random() * settings.types.length)];
      ctx.beginPath();
      
      // 個別の透明度をランダムに設定 (0.1 ~ 0.8)
      const individualAlpha = Math.random() * 0.7 + 0.1;
      
      if (settings.grayscale) {
        const grey = Math.floor(Math.random() * 150 + 50);
        ctx.strokeStyle = `rgba(${grey}, ${grey}, ${grey}, ${individualAlpha})`;
      } else {
        // 彩度と輝度も少しランダムにして表情を出す
        const h = Math.random() * 360;
        const s = Math.random() * 70 + 30;
        const l = Math.random() * 50 + 20;
        ctx.strokeStyle = `hsla(${h}, ${s}%, ${l}%, ${individualAlpha})`;
      }
      
      ctx.lineWidth = (Math.random() * 3 + 0.5) * Math.sqrt(settings.size);

      const baseSize = Math.min(width, height) * 0.15 * settings.size;

      if (type === 'curve') {
        const x1 = Math.random() * width;
        const y1 = Math.random() * height;
        ctx.moveTo(x1, y1);
        ctx.bezierCurveTo(
          x1 + (Math.random() - 0.5) * baseSize * 2, y1 + (Math.random() - 0.5) * baseSize * 2,
          x1 + (Math.random() - 0.5) * baseSize * 2, y1 + (Math.random() - 0.5) * baseSize * 2,
          x1 + (Math.random() - 0.5) * baseSize * 2, y1 + (Math.random() - 0.5) * baseSize * 2
        );
      } else if (type === 'line') {
        const x1 = Math.random() * width;
        const y1 = Math.random() * height;
        ctx.moveTo(x1, y1);
        ctx.lineTo(
          x1 + (Math.random() - 0.5) * baseSize * 2,
          y1 + (Math.random() - 0.5) * baseSize * 2
        );
      } else if (type === 'circle') {
        // 円に加えて楕円と回転を追加
        const centerX = Math.random() * width;
        const centerY = Math.random() * height;
        const radiusX = (Math.random() * 80 + 10) * settings.size;
        const radiusY = (Math.random() * 80 + 10) * settings.size;
        const rotation = Math.random() * Math.PI;
        ctx.ellipse(centerX, centerY, radiusX, radiusY, rotation, 0, Math.PI * 2);
      } else if (type === 'rect') {
        const shapeVar = Math.random();
        const rw = (Math.random() * 150 + 20) * settings.size;
        const rh = (Math.random() * 150 + 20) * settings.size;
        const rx = Math.random() * width;
        const ry = Math.random() * height;
        const angle = Math.random() * Math.PI;

        if (shapeVar < 0.4) {
          // 回転した四角形
          ctx.save();
          ctx.translate(rx, ry);
          ctx.rotate(angle);
          ctx.strokeRect(-rw/2, -rh/2, rw, rh);
          ctx.restore();
        } else if (shapeVar < 0.7) {
          // 平行四辺形 / ひし形
          const skew = (Math.random() - 0.5) * 2 * (rw * 0.5);
          ctx.save();
          ctx.translate(rx, ry);
          ctx.rotate(angle);
          ctx.moveTo(-rw/2 + skew, -rh/2);
          ctx.lineTo(rw/2 + skew, -rh/2);
          ctx.lineTo(rw/2 - skew, rh/2);
          ctx.lineTo(-rw/2 - skew, rh/2);
          ctx.closePath();
          ctx.restore();
        } else {
          // 頂点で回転したダイヤモンド状
          ctx.save();
          ctx.translate(rx, ry);
          ctx.rotate(angle + Math.PI / 4);
          ctx.strokeRect(-rw/2, -rh/2, rw, rh);
          ctx.restore();
        }
      }
      ctx.stroke();
    }
    ctx.restore();
  };

  const saveToHistory = () => {
    const dCanvas = drawCanvasRef.current;
    const sCanvas = scribbleCanvasRef.current;
    if (dCanvas && sCanvas) {
      const dCtx = dCanvas.getContext('2d');
      const sCtx = sCanvas.getContext('2d');
      if (dCtx && sCtx) {
        const state: CanvasState = {
          drawData: dCtx.getImageData(0, 0, dCanvas.width, dCanvas.height),
          scribbleData: sCtx.getImageData(0, 0, sCanvas.width, sCanvas.height)
        };
        setHistory(prev => [...prev.slice(-19), state]);
        setRedoStack([]);
      }
    }
  };

  const undo = () => {
    if (history.length === 0) return;
    const dCanvas = drawCanvasRef.current;
    const sCanvas = scribbleCanvasRef.current;
    const dCtx = dCanvas?.getContext('2d', { willReadFrequently: true });
    const sCtx = sCanvas?.getContext('2d', { willReadFrequently: true });
    if (!dCanvas || !sCanvas || !dCtx || !sCtx) return;

    const currentState: CanvasState = {
      drawData: dCtx.getImageData(0, 0, dCanvas.width, dCanvas.height),
      scribbleData: sCtx.getImageData(0, 0, sCanvas.width, sCanvas.height)
    };
    setRedoStack(prev => [...prev, currentState]);

    const previousState = history[history.length - 1];
    setHistory(prev => prev.slice(0, -1));
    dCtx.putImageData(previousState.drawData, 0, 0);
    sCtx.putImageData(previousState.scribbleData, 0, 0);
  };

  const redo = () => {
    if (redoStack.length === 0) return;
    const dCanvas = drawCanvasRef.current;
    const sCanvas = scribbleCanvasRef.current;
    const dCtx = dCanvas?.getContext('2d', { willReadFrequently: true });
    const sCtx = sCanvas?.getContext('2d', { willReadFrequently: true });
    if (!dCanvas || !sCanvas || !dCtx || !sCtx) return;

    const currentState: CanvasState = {
      drawData: dCtx.getImageData(0, 0, dCanvas.width, dCanvas.height),
      scribbleData: sCtx.getImageData(0, 0, sCanvas.width, sCanvas.height)
    };
    setHistory(prev => [...prev, currentState]);

    const nextState = redoStack[redoStack.length - 1];
    setRedoStack(prev => prev.slice(0, -1));
    dCtx.putImageData(nextState.drawData, 0, 0);
    sCtx.putImageData(nextState.scribbleData, 0, 0);
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    saveToHistory();
    setIsDrawing(true);
    
    // For rect eraser, save starting point
    const coords = getCanvasCoords(e);
    setStartPoint(coords);
    
    if (tool !== 'scribble-rect-eraser') {
      const dCanvas = drawCanvasRef.current;
      const dCtx = dCanvas?.getContext('2d');
      if (dCtx) {
        dCtx.beginPath();
        dCtx.moveTo(coords.x, coords.y);
      }
      draw(e);
    }
  };

  const stopDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (tool === 'scribble-rect-eraser' && startPoint && isDrawing) {
      const canvas = scribbleCanvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (canvas && ctx) {
        const coords = getCanvasCoords(e);
        
        ctx.save();
        ctx.globalAlpha = brushOpacity;
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillRect(
          Math.min(startPoint.x, coords.x),
          Math.min(startPoint.y, coords.y),
          Math.abs(startPoint.x - coords.x),
          Math.abs(startPoint.y - coords.y)
        );
        ctx.restore();
      }
    }

    setIsDrawing(false);
    setStartPoint(null);
    const dCtx = drawCanvasRef.current?.getContext('2d');
    if (dCtx) dCtx.beginPath();
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || tool === 'scribble-rect-eraser') return;

    const dCanvas = drawCanvasRef.current;
    const sCanvas = scribbleCanvasRef.current;
    if (!dCanvas || !sCanvas) return;

    const isScribbleTarget = tool === 'scribble-eraser';
    const targetCanvas = isScribbleTarget ? sCanvas : dCanvas;
    const ctx = targetCanvas.getContext('2d');
    if (!ctx) return;

    const coords = getCanvasCoords(e);

    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = brushOpacity;
    
    if (tool === 'eraser' || tool === 'scribble-eraser') {
      ctx.globalCompositeOperation = 'destination-out';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = color;
    }

    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
  };

  const clearCanvas = () => {
    if (!window.confirm('キャンバスをすべて消去しますか？')) return;
    const ctx = drawCanvasRef.current?.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, drawCanvasRef.current!.width, drawCanvasRef.current!.height);
    setHistory([]);
    setRedoStack([]);
  };

  const handleBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        setBgImage(img);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const downloadImage = (providedFilename?: string) => {
    const sCanvas = scribbleCanvasRef.current;
    const dCanvas = drawCanvasRef.current;
    if (!sCanvas || !dCanvas) return;

    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = sCanvas.width;
    finalCanvas.height = sCanvas.height;
    const ctx = finalCanvas.getContext('2d');
    if (!ctx) return;

    // Background Color
    ctx.fillStyle = '#F5F5F0';
    ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);

    // Background Image
    if (bgImage) {
      ctx.save();
      ctx.globalAlpha = bgOpacity;
      const hRatio = finalCanvas.width / bgImage.width;
      const vRatio = finalCanvas.height / bgImage.height;
      const ratio = Math.max(hRatio, vRatio);
      const centerShiftX = (finalCanvas.width - bgImage.width * ratio) / 2;
      const centerShiftY = (finalCanvas.height - bgImage.height * ratio) / 2;
      ctx.drawImage(bgImage, 0, 0, bgImage.width, bgImage.height,
        centerShiftX, centerShiftY, bgImage.width * ratio, bgImage.height * ratio);
      ctx.restore();
    }
    
    // Scribbles
    ctx.save();
    ctx.globalAlpha = settings.opacity;
    ctx.drawImage(sCanvas, 0, 0);
    ctx.restore();
    
    // Drawing
    ctx.save();
    ctx.globalAlpha = 1.0;
    ctx.drawImage(dCanvas, 0, 0);
    ctx.restore();

    // Generate timestamped filename
    const now = new Date();
    const timestamp = `${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}${now.getSeconds().toString().padStart(2, '0')}`;
    const filename = providedFilename || `pareidolia-sketch_${timestamp}.png`;

    try {
      const link = document.createElement('a');
      link.download = filename;
      link.href = finalCanvas.toDataURL('image/png');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  const toggleShapeType = (type: ShapeType) => {
    setSettings(prev => ({
      ...prev,
      types: prev.types.includes(type) 
        ? prev.types.filter(t => t !== type) 
        : [...prev.types, type]
    }));
  };

  const flipHorizontal = () => {
    const dCanvas = drawCanvasRef.current;
    const sCanvas = scribbleCanvasRef.current;
    
    [dCanvas, sCanvas].forEach(canvas => {
      const ctx = canvas?.getContext('2d');
      if (canvas && ctx) {
        if (canvas === dCanvas) saveToHistory();
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        tempCanvas.getContext('2d')?.drawImage(canvas, 0, 0);
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(tempCanvas, 0, 0);
        ctx.restore();
      }
    });
  };

  const flipVertical = () => {
    const dCanvas = drawCanvasRef.current;
    const sCanvas = scribbleCanvasRef.current;

    [dCanvas, sCanvas].forEach(canvas => {
      const ctx = canvas?.getContext('2d');
      if (canvas && ctx) {
        if (canvas === dCanvas) saveToHistory();
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        tempCanvas.getContext('2d')?.drawImage(canvas, 0, 0);
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.translate(0, canvas.height);
        ctx.scale(1, -1);
        ctx.drawImage(tempCanvas, 0, 0);
        ctx.restore();
      }
    });
  };

  return (
    <div className="flex flex-col h-screen bg-studio-bg overflow-hidden select-none">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-studio-ink/10 bg-white z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-studio-ink flex items-center justify-center rounded-sm">
            <Palette className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-studio-ink">Pareidolia Sketcher</h1>
            <p className="text-[10px] uppercase tracking-widest font-mono text-studio-ink/40">Studio v1.0</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={undo}
            className="p-2 hover:bg-studio-ink/5 rounded-md transition-colors disabled:opacity-30"
            disabled={history.length === 0}
            title="Undo"
          >
            <Undo2 size={20} />
          </button>
          <button 
            onClick={redo}
            className="p-2 hover:bg-studio-ink/5 rounded-md transition-colors disabled:opacity-30"
            disabled={redoStack.length === 0}
            title="Redo"
          >
            <Redo2 size={20} />
          </button>
          <div className="w-px h-6 bg-studio-ink/10 mx-2" />
          <button 
            onClick={clearCanvas}
            className="p-2 hover:bg-red-50 text-red-600 rounded-md transition-colors"
            title="Clear All"
          >
            <Trash2 size={20} />
          </button>
          <button 
            onClick={() => downloadImage()}
            className="flex items-center gap-2 px-6 py-2 bg-studio-ink text-white rounded-md hover:bg-studio-ink/90 transition-all active:scale-95 text-sm font-bold tracking-tight shadow-lg shadow-studio-ink/20"
          >
            <Download size={18} className="text-studio-accent" />
            <span>画像を保存</span>
          </button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {/* Sidebar Controls */}
        <aside className="w-72 bg-white border-r border-studio-ink/10 flex flex-col p-6 overflow-y-auto z-40">
          <div className="space-y-8">
            {/* Generate Section */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-studio-ink/40">Prompt Generator</h3>
                <Settings2 
                  size={14} 
                  className={`cursor-pointer transition-transform ${showSettings ? 'rotate-90 text-studio-accent' : ''}`}
                  onClick={() => setShowSettings(!showSettings)}
                />
              </div>
              
              <div className="flex flex-col gap-2">
                <button 
                  onClick={() => generateScribbles(false)}
                  className="w-full flex items-center justify-center gap-3 py-4 border-2 border-studio-ink rounded-lg font-bold hover:bg-studio-ink hover:text-white transition-all active:scale-95 shadow-[4px_4px_0px_#000]"
                >
                  <Dices size={24} />
                  <span>新規生成</span>
                </button>
                <div className="flex gap-1">
                  <button 
                    onClick={() => generateScribbles(true)}
                    className="flex-1 py-4 text-[11px] font-bold uppercase border border-studio-ink/20 rounded-l hover:bg-studio-ink hover:text-white transition-colors"
                  >
                    線をさらに追加
                  </button>
                  <div className="flex flex-col border-y border-r border-studio-ink/20 rounded-r bg-studio-ink/5">
                    <label className="text-[8px] uppercase font-mono text-studio-ink/40 text-center pt-1 px-2">Boost</label>
                    <input 
                      type="number" 
                      min="1" max="50"
                      value={batchSize}
                      onChange={(e) => setBatchSize(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-12 bg-transparent text-center text-xs font-bold outline-none pb-1"
                    />
                  </div>
                </div>
              </div>

              <AnimatePresence>
                {showSettings && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden space-y-4 pt-4"
                  >
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono uppercase text-studio-ink/60 flex justify-between">
                        Density <span>{settings.density}</span>
                      </label>
                      <input 
                        type="range" 
                        min="1" max="10" 
                        value={settings.density}
                        onChange={(e) => setSettings({...settings, density: parseInt(e.target.value)})}
                        className="w-full accent-studio-ink"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono uppercase text-studio-ink/60 flex justify-between">
                        Scale / Size <span>{settings.size.toFixed(1)}x</span>
                      </label>
                      <input 
                        type="range" 
                        min="0.2" max="5.0" step="0.1"
                        value={settings.size}
                        onChange={(e) => setSettings({...settings, size: parseFloat(e.target.value)})}
                        className="w-full accent-studio-ink"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono uppercase text-studio-ink/60 flex justify-between">
                        Scribble Opacity <span>{Math.round(settings.opacity * 100)}%</span>
                      </label>
                      <input 
                        type="range" 
                        min="0.1" max="1" step="0.1"
                        value={settings.opacity}
                        onChange={(e) => setSettings({...settings, opacity: parseFloat(e.target.value)})}
                        className="w-full accent-studio-ink"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(['curve', 'line', 'circle', 'rect'] as ShapeType[]).map(type => (
                        <button
                          key={type}
                          onClick={() => toggleShapeType(type)}
                          className={`px-2 py-1 text-[10px] uppercase font-bold rounded border ${
                            settings.types.includes(type) 
                            ? 'bg-studio-ink text-white border-studio-ink' 
                            : 'bg-transparent text-studio-ink/40 border-studio-ink/10'
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={settings.grayscale}
                        onChange={(e) => setSettings({...settings, grayscale: e.target.checked})}
                        className="w-4 h-4 accent-studio-ink"
                      />
                      <span className="text-[11px] font-bold uppercase">Grayscale only</span>
                    </label>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>

            {/* Drawing Tools */}
            <section className="space-y-6 pt-4 border-t border-studio-ink/10">
              <h3 className="text-xs font-bold uppercase tracking-widest text-studio-ink/40">Drawing Tools</h3>
              
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setTool('pen')}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${
                    tool === 'pen' ? 'border-studio-accent bg-studio-accent/5 font-bold' : 'border-studio-ink/5'
                  }`}
                >
                  <Pen size={18} className={tool === 'pen' ? 'text-studio-accent' : ''} />
                  <span className="text-[10px] mt-2 uppercase">Pen</span>
                </button>
                <button
                  onClick={() => setTool('eraser')}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${
                    tool === 'eraser' ? 'border-studio-accent bg-studio-accent/5 font-bold' : 'border-studio-ink/5'
                  }`}
                >
                  <Eraser size={18} className={tool === 'eraser' ? 'text-studio-accent' : ''} />
                  <span className="text-[10px] mt-2 uppercase">Eraser</span>
                </button>
              </div>

              <div className="space-y-3">
                <h4 className="text-[10px] font-bold uppercase text-studio-ink/60">Scribble Layer Erasers</h4>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setTool('scribble-eraser')}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${
                      tool === 'scribble-eraser' ? 'border-blue-500 bg-blue-50 font-bold' : 'border-studio-ink/5'
                    }`}
                  >
                    <Layers size={18} className={tool === 'scribble-eraser' ? 'text-blue-500' : ''} />
                    <span className="text-[9px] mt-2 uppercase leading-tight text-center">Scribble<br/>Eraser</span>
                  </button>
                  <button
                    onClick={() => setTool('scribble-rect-eraser')}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${
                      tool === 'scribble-rect-eraser' ? 'border-blue-500 bg-blue-50 font-bold' : 'border-studio-ink/5'
                    }`}
                  >
                    <div className="relative">
                      <Layers size={18} className={tool === 'scribble-rect-eraser' ? 'text-blue-500' : ''} />
                      <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-blue-500 border border-white" />
                    </div>
                    <span className="text-[9px] mt-2 uppercase leading-tight text-center">Rect<br/>Eraser</span>
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase text-studio-ink/60">Brush Size</label>
                  <div className="flex items-center gap-4">
                    <input 
                      type="range" 
                      min="1" max="50" 
                      value={brushSize}
                      onChange={(e) => setBrushSize(parseInt(e.target.value))}
                      className="flex-1 accent-studio-ink"
                    />
                    <div className="w-8 h-8 rounded-full border border-studio-ink/10 flex items-center justify-center bg-white shadow-sm overflow-hidden">
                      <div 
                        className="bg-studio-ink rounded-full" 
                        style={{ width: Math.max(2, brushSize), height: Math.max(2, brushSize) }}
                      />
                    </div>
                  </div>
                </div>
                
                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase text-studio-ink/60 flex justify-between">
                    Brush Opacity <span>{Math.round(brushOpacity * 100)}%</span>
                  </label>
                  <input 
                    type="range" 
                    min="0.01" max="1" step="0.01"
                    value={brushOpacity}
                    onChange={(e) => setBrushOpacity(parseFloat(e.target.value))}
                    className="w-full accent-studio-ink"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase text-studio-ink/60">Ink Color</label>
                  <div className="flex flex-wrap gap-2">
                    {['#141414', '#FF3E00', '#00FF00', '#0000FF', '#FF00FF', '#FFFFFF'].map(c => (
                      <button
                        key={c}
                        onClick={() => {setColor(c); setTool('pen');}}
                        className={`w-8 h-8 rounded-full border-2 transition-transform ${
                          color === c && tool === 'pen' ? 'border-studio-accent scale-110' : 'border-studio-ink/10'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                    <input 
                      type="color" 
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="w-8 h-8 opacity-0 absolute pointer-events-none"
                      id="custom-color"
                    />
                    <label 
                      htmlFor="custom-color" 
                      className="w-8 h-8 rounded-full border-2 border-dashed border-studio-ink/20 flex items-center justify-center cursor-pointer hover:border-studio-ink"
                    >
                      <Palette size={14} className="text-studio-ink/40" />
                    </label>
                  </div>
                </div>
              </div>
            </section>

            {/* Background Section */}
            <section className="space-y-4 pt-4 border-t border-studio-ink/10">
              <h3 className="text-xs font-bold uppercase tracking-widest text-studio-ink/40">Background</h3>
              <div className="space-y-3">
                <input 
                  type="file" 
                  ref={bgInputRef}
                  onChange={handleBgUpload}
                  accept="image/*"
                  className="hidden"
                />
                <button 
                  onClick={() => bgInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 py-2 border border-studio-ink/20 rounded hover:bg-studio-ink/5 transition-colors text-[11px] font-bold uppercase"
                >
                  <ImageIcon size={14} />
                  <span>背景画像を読み込む</span>
                </button>

                {bgImage && (
                  <div className="space-y-3 p-3 bg-studio-ink/5 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase text-studio-ink/60">Image Loaded</span>
                      <button 
                        onClick={() => setBgImage(null)}
                        className="text-[10px] text-red-500 hover:underline uppercase font-bold"
                      >
                        削除
                      </button>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono uppercase text-studio-ink/60 flex justify-between">
                        Opacity <span>{Math.round(bgOpacity * 100)}%</span>
                      </label>
                      <input 
                        type="range" 
                        min="0" max="1" step="0.01"
                        value={bgOpacity}
                        onChange={(e) => setBgOpacity(parseFloat(e.target.value))}
                        className="w-full accent-studio-ink"
                      />
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Canvas Settings */}
            <section className="space-y-4 pt-4 border-t border-studio-ink/10">
              <h3 className="text-xs font-bold uppercase tracking-widest text-studio-ink/40">Canvas Size</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex-1 space-y-1">
                    <label className="text-[10px] uppercase font-mono text-studio-ink/40 text-center block">Width</label>
                    <input 
                      type="number" 
                      value={canvasDim.width}
                      onChange={(e) => {
                        setIsAutoFit(false);
                        setCanvasDim({...canvasDim, width: parseInt(e.target.value) || 0});
                      }}
                      className="w-full px-2 py-1 bg-studio-ink/5 border border-studio-ink/10 rounded text-xs font-mono"
                    />
                  </div>
                  <div className="pt-4 text-studio-ink/20">×</div>
                  <div className="flex-1 space-y-1">
                    <label className="text-[10px] uppercase font-mono text-studio-ink/40 text-center block">Height</label>
                    <input 
                      type="number" 
                      value={canvasDim.height}
                      onChange={(e) => {
                        setIsAutoFit(false);
                        setCanvasDim({...canvasDim, height: parseInt(e.target.value) || 0});
                      }}
                      className="w-full px-2 py-1 bg-studio-ink/5 border border-studio-ink/10 rounded text-xs font-mono"
                    />
                  </div>
                </div>

                <select 
                  className="w-full px-2 py-1.5 bg-studio-ink/5 border border-studio-ink/10 rounded text-[11px] font-bold"
                  value={isAutoFit ? "auto" : "custom"}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "auto") {
                      setIsAutoFit(true);
                      resizeCanvas();
                    } else if (val === "square") {
                      setIsAutoFit(false);
                      setCanvasDim({ width: 1000, height: 1000 });
                    } else if (val === "hd") {
                      setIsAutoFit(false);
                      setCanvasDim({ width: 1920, height: 1080 });
                    } else if (val === "sd") {
                      setIsAutoFit(false);
                      setCanvasDim({ width: 800, height: 600 });
                    } else if (val === "a4") {
                      setIsAutoFit(false);
                      setCanvasDim({ width: 2480, height: 3508 }); // 300dpi approx
                    } else if (val === "insta") {
                      setIsAutoFit(false);
                      setCanvasDim({ width: 1080, height: 1350 });
                    }
                  }}
                >
                  <option value="auto">画面に合わせる (Auto)</option>
                  <option value="custom" disabled>カスタムサイズ</option>
                  <option value="square">正方形 (1:1)</option>
                  <option value="hd">Full HD (16:9)</option>
                  <option value="sd">Classic (4:3)</option>
                  <option value="a4">A4 (Portrait)</option>
                  <option value="insta">Instagram (4:5)</option>
                </select>
              </div>
            </section>

            {/* Transform Section */}
            <section className="space-y-4 pt-4 border-t border-studio-ink/10">
              <h3 className="text-xs font-bold uppercase tracking-widest text-studio-ink/40">Transformation</h3>
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={flipHorizontal}
                  className="flex items-center justify-center gap-2 p-2 text-[10px] uppercase font-bold border border-studio-ink/10 rounded hover:bg-studio-ink hover:text-white transition-colors"
                  title="Horizontal Flip"
                >
                  <FlipHorizontal size={14} />
                  <span>水平反転</span>
                </button>
                <button 
                  onClick={flipVertical}
                  className="flex items-center justify-center gap-2 p-2 text-[10px] uppercase font-bold border border-studio-ink/10 rounded hover:bg-studio-ink hover:text-white transition-colors rotate-90"
                  title="Vertical Flip"
                >
                  <FlipHorizontal size={14} />
                  <span className="-rotate-90">垂直反転</span>
                </button>
              </div>
            </section>
          </div>
          
          <div className="mt-auto pt-8">
            <div className="p-4 bg-studio-ink text-white rounded-lg">
              <p className="text-[10px] font-bold text-studio-accent mb-1 underline tracking-wider uppercase">Pro Tip</p>
              <p className="text-xs leading-relaxed opacity-80">
                ランダムな線を生成し、キャンバスを回転・反転させながら「何か」に見える瞬間を探してみましょう。
              </p>
            </div>
          </div>
        </aside>

        {/* Canvas Area */}
        <div 
          className="flex-1 relative bg-studio-ink/5 overflow-auto p-8 flex items-center justify-center group"
          onWheel={handleWheel}
        >
          <div 
            ref={containerRef}
            className="relative bg-white shadow-[0_20px_50px_rgba(0,0,0,0.1)] transition-all duration-300 origin-center"
            style={{ 
              width: canvasDim.width, 
              height: canvasDim.height, 
              minWidth: canvasDim.width, 
              minHeight: canvasDim.height,
              transform: `scale(${zoom})`
            }}
          >
            {/* Background Image Layer */}
            {bgImage && (
              <img 
                src={bgImage.src} 
                className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                style={{ opacity: bgOpacity }}
                alt="Background"
              />
            )}
            
            {/* Scribble Layer */}
            <canvas
              ref={scribbleCanvasRef}
              className="canvas-layer pointer-events-none transition-opacity duration-300"
              style={{ opacity: settings.opacity }}
            />
            
            {/* Drawing Layer */}
            <canvas
              ref={drawCanvasRef}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseOut={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              className="canvas-layer"
            />

            {/* Selection Guide Layer (Visible only during rect erase) handled by SelectionOverlay */}
          </div>

          {/* Zoom Controls Overlay */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1 p-1 bg-studio-ink text-white rounded-lg shadow-xl z-50">
            <button onClick={() => setZoom(prev => Math.max(0.1, prev - 0.1))} className="p-2 hover:bg-white/10 rounded">-</button>
            <div className="px-3 text-[10px] font-mono min-w-[60px] text-center">{Math.round(zoom * 100)}%</div>
            <button onClick={() => setZoom(prev => Math.min(5, prev + 0.1))} className="p-2 hover:bg-white/10 rounded">+</button>
            <div className="w-px h-4 bg-white/20 mx-1" />
            <button onClick={fitToScreen} className="px-3 py-1 text-[10px] font-bold uppercase hover:bg-white/10 rounded leading-none">全表示</button>
          </div>

          {/* Simple Manual Rect Overlay Implementation */}
          <SelectionOverlay isDrawing={isDrawing} startPoint={startPoint} zoom={zoom} drawCanvasRef={drawCanvasRef} tool={tool} />

          {/* Layer Status Overlay */}
          <div className="absolute bottom-6 right-6 flex flex-col gap-2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">

            <div className="flex items-center gap-2 px-3 py-1.5 bg-studio-ink/80 text-white rounded-full text-[10px] font-mono font-bold backdrop-blur-sm">
              <Layers size={12} className="text-studio-accent" />
              <span>DRAWING LAYER ACTIVE</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white/80 text-studio-ink border border-studio-ink/10 rounded-full text-[10px] font-mono font-bold backdrop-blur-sm">
              <div className="w-2 h-2 rounded-full bg-studio-ink/30 animate-pulse" />
              <span>SCRIBBLE PROMPT: {settings.density * 15} SHAPES</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function SelectionOverlay({ isDrawing, startPoint, zoom, drawCanvasRef, tool }: any) {
  const [currentCoord, setCurrentCoord] = useState<{x: number, y: number} | null>(null);

  useEffect(() => {
    if (!isDrawing) {
      setCurrentCoord(null);
      return;
    }

    const handleMove = (e: MouseEvent | TouchEvent) => {
      const canvas = drawCanvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      
      let clientX, clientY;
      if ('touches' in e && (e as TouchEvent).touches.length > 0) {
        clientX = (e as TouchEvent).touches[0].clientX;
        clientY = (e as TouchEvent).touches[0].clientY;
      } else {
        clientX = (e as MouseEvent).clientX;
        clientY = (e as MouseEvent).clientY;
      }

      setCurrentCoord({ 
        x: (clientX - rect.left) / zoom,
        y: (clientY - rect.top) / zoom
      });
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('touchmove', handleMove);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('touchmove', handleMove);
    };
  }, [isDrawing, drawCanvasRef, zoom]);

  if (!isDrawing || !startPoint || !currentCoord || tool !== 'scribble-rect-eraser') return null;

  const left = Math.min(startPoint.x, currentCoord.x);
  const top = Math.min(startPoint.y, currentCoord.y);
  const width = Math.abs(startPoint.x - currentCoord.x);
  const height = Math.abs(startPoint.y - currentCoord.y);

  return (
    <div 
      className="absolute border border-blue-500 bg-blue-200/20 pointer-events-none z-10"
      style={{ left, top, width, height }}
    />
  );
}
