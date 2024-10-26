import React, { useState, useRef, useEffect } from 'react';
import { Upload, Square, Scissors, Download, Pencil } from 'lucide-react';

const Snip = () => {
  const [image, setImage] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [box, setBox] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [mode, setMode] = useState('box');
  const [path, setPath] = useState([]);
  const [coordinates, setCoordinates] = useState(null);
  const [hasSelection, setHasSelection] = useState(false);
  const [strokeHistory, setStrokeHistory] = useState([]);
  const [strokeColor, setStrokeColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(2);
  
  const imageRef = useRef(null);
  const canvasRef = useRef(null);
  const drawingCanvasRef = useRef(null); // New canvas for drawings only
  const previewCanvasRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (image && canvasRef.current && drawingCanvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      const drawingCtx = drawingCanvasRef.current.getContext('2d');
      const img = new Image();
      img.src = image;
      img.onload = () => {
        // Set up main canvas
        canvasRef.current.width = img.width;
        canvasRef.current.height = img.height;
        ctx.drawImage(img, 0, 0);
        
        // Set up drawing canvas with same dimensions but transparent
        drawingCanvasRef.current.width = img.width;
        drawingCanvasRef.current.height = img.height;
        
        // Initialize preview canvas
        if (previewCanvasRef.current) {
          previewCanvasRef.current.width = img.width;
          previewCanvasRef.current.height = img.height;
        }
      };
    }
  }, [image]);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setImage(e.target.result);
        setPath([]);
        setHasSelection(false);
        setStrokeHistory([]);
        
        // Clear drawing canvas
        if (drawingCanvasRef.current) {
          const ctx = drawingCanvasRef.current.getContext('2d');
          ctx.clearRect(0, 0, drawingCanvasRef.current.width, drawingCanvasRef.current.height);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const getMousePos = (e) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    return {
      x: Math.round((e.clientX - rect.left) * scaleX),
      y: Math.round((e.clientY - rect.top) * scaleY)
    };
  };

  const handleMouseDown = (e) => {
    const pos = getMousePos(e);
    setIsDrawing(true);
    setStartPos(pos);
    
    if (mode === 'draw') {
      const ctx = drawingCanvasRef.current.getContext('2d');
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      setPath([pos]);
    } else if (mode === 'cutout') {
      setPath([pos]);
      // Clear previous path
      const ctx = canvasRef.current.getContext('2d');
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      const img = new Image();
      img.src = image;
      ctx.drawImage(img, 0, 0);
    }
  };

  const handleMouseMove = (e) => {
    if (!isDrawing) return;
    
    const pos = getMousePos(e);
    if (mode === 'draw') {
      const ctx = drawingCanvasRef.current.getContext('2d');
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      setPath([...path, pos]);
    } else if (mode === 'box') {
      const newBox = {
        x: Math.min(startPos.x, pos.x),
        y: Math.min(startPos.y, pos.y),
        width: Math.abs(pos.x - startPos.x),
        height: Math.abs(pos.y - startPos.y)
      };
      setBox(newBox);
      setCoordinates({
        start: startPos,
        current: pos,
        box: newBox
      });
    } else if (mode === 'cutout') {
      setPath([...path, pos]);
      const ctx = canvasRef.current.getContext('2d');
      ctx.beginPath();
      ctx.moveTo(path[path.length - 1].x, path[path.length - 1].y);
      ctx.lineTo(pos.x, pos.y);
      ctx.strokeStyle = '#3B82F6';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  };

  const handleMouseUp = () => {
    if (isDrawing && mode === 'draw') {
      // Save the current drawing canvas state to stroke history
      const imageData = drawingCanvasRef.current.toDataURL();
      setStrokeHistory([...strokeHistory, imageData]);
    }
    
    setIsDrawing(false);
    if (mode === 'box' && box) {
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(box);
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
      setHasSelection(true);
    } else if (mode === 'cutout' && path.length > 2) {
      const ctx = canvasRef.current.getContext('2d');
      ctx.beginPath();
      ctx.moveTo(path[0].x, path[0].y);
      path.forEach(point => ctx.lineTo(point.x, point.y));
      ctx.closePath();
      ctx.strokeStyle = '#3B82F6';
      ctx.lineWidth = 2;
      ctx.stroke();
      setHasSelection(true);
      
      updateCutoutPreview();
    }
  };

  const updateCutoutPreview = () => {
    if (!path.length) return;
    
    const previewCtx = previewCanvasRef.current.getContext('2d');
    const mainCtx = canvasRef.current.getContext('2d');
    
    previewCtx.clearRect(0, 0, previewCanvasRef.current.width, previewCanvasRef.current.height);
    
    previewCtx.beginPath();
    previewCtx.moveTo(path[0].x, path[0].y);
    path.forEach(point => previewCtx.lineTo(point.x, point.y));
    previewCtx.closePath();
    
    previewCtx.save();
    previewCtx.clip();
    const img = new Image();
    img.src = image;
    previewCtx.drawImage(img, 0, 0);
    previewCtx.restore();
  };

  const downloadSelection = () => {
    if (mode === 'draw') {
      // Download only the drawing canvas content
      const link = document.createElement('a');
      link.download = 'drawing.png';
      link.href = drawingCanvasRef.current.toDataURL();
      link.click();
    } else if (mode === 'box' && box) {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = box.width;
      canvas.height = box.height;
      
      ctx.drawImage(
        canvasRef.current,
        box.x,
        box.y,
        box.width,
        box.height,
        0,
        0,
        box.width,
        box.height
      );
      
      const link = document.createElement('a');
      link.download = 'selection.png';
      link.href = canvas.toDataURL();
      link.click();
    } else if (mode === 'cutout' && path.length > 2) {
      const bounds = path.reduce((acc, point) => ({
        minX: Math.min(acc.minX, point.x),
        minY: Math.min(acc.minY, point.y),
        maxX: Math.max(acc.maxX, point.x),
        maxY: Math.max(acc.maxY, point.y)
      }), { 
        minX: path[0].x, 
        minY: path[0].y, 
        maxX: path[0].x, 
        maxY: path[0].y 
      });
      
      const width = bounds.maxX - bounds.minX;
      const height = bounds.maxY - bounds.minY;
      
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = width;
      canvas.height = height;
      
      ctx.beginPath();
      ctx.moveTo(path[0].x - bounds.minX, path[0].y - bounds.minY);
      path.forEach(point => {
        ctx.lineTo(point.x - bounds.minX, point.y - bounds.minY);
      });
      ctx.closePath();
      ctx.clip();
      
      const img = new Image();
      img.src = image;
      ctx.drawImage(img, -bounds.minX, -bounds.minY);
      
      const link = document.createElement('a');
      link.download = 'cutout.png';
      link.href = canvas.toDataURL();
      link.click();
    }
  };

  const undo = () => {
    if (mode === 'draw' && strokeHistory.length > 1) {
      const previousState = strokeHistory[strokeHistory.length - 2];
      const img = new Image();
      img.src = previousState;
      img.onload = () => {
        const ctx = drawingCanvasRef.current.getContext('2d');
        ctx.clearRect(0, 0, drawingCanvasRef.current.width, drawingCanvasRef.current.height);
        ctx.drawImage(img, 0, 0);
      };
      setStrokeHistory(strokeHistory.slice(0, -1));
    } else if (historyIndex > -1) {
      setHistoryIndex(historyIndex - 1);
      setBox(history[historyIndex - 1] || null);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setBox(history[historyIndex + 1]);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-100 font-sans">
      {/* Tools Panel */}
      <div className="w-80 bg-white shadow-lg p-6 space-y-6">
        <h1 className="text-2xl font-bold text-gray-800">Image Tools</h1>
        
        {/* Upload button */}
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium">
            <Upload size={18} />
            <label className="cursor-pointer">
              Upload Image
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
            </label>
          </button>
        </div>

        {/* Selection Tools */}
        <div className="border rounded-xl p-5 bg-blue-50 border-blue-200">
          <h2 className="font-semibold text-blue-800 mb-3 text-lg">
            Tools
          </h2>
          
          <div className="space-y-3">
            <button 
              onClick={() => setMode('box')}
              className={`w-full flex items-center gap-2 px-4 py-3 rounded-lg transition-colors ${
                mode === 'box' ? 'bg-blue-500 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Square size={18} />
              Box Select
            </button>
            
            <button 
              onClick={() => setMode('cutout')}
              className={`w-full flex items-center gap-2 px-4 py-3 rounded-lg transition-colors ${
                mode === 'cutout' ? 'bg-blue-500 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Scissors size={18} />
              Cutout Tool
            </button>

            <button 
              onClick={() => setMode('draw')}
              className={`w-full flex items-center gap-2 px-4 py-3 rounded-lg transition-colors ${
                mode === 'draw' ? 'bg-blue-500 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Pencil size={18} />
              Draw
            </button>
          </div>

          {/* Drawing Tools */}
          {mode === 'draw' && (
            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Stroke Color
                </label>
                <input
                  type="color"
                  value={strokeColor}
                  onChange={(e) => setStrokeColor(e.target.value)}
                  className="w-full h-8 rounded cursor-pointer"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Stroke Width
                </label>
                <input
                  type="range"
                  min="1"
                  max="50"
                  value={strokeWidth}
                  onChange={(e) => setStrokeWidth(parseInt(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>
          )}

          <div className="flex gap-2 mt-4">
            <button 
              onClick={undo}
              disabled={mode === 'draw' ? strokeHistory.length <= 1 : historyIndex < 0}
              className="flex-1 py-2 px-4 bg-white rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Undo
            </button>
            <button 
              onClick={redo}
              disabled={historyIndex >= history.length - 1}
              className="flex-1 py-2 px-4 bg-white rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Redo
            </button>
          </div>
        </div>

        {/* Download Button */}
        {(hasSelection || mode === 'draw') && (
          <button
            onClick={downloadSelection}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium"
          >
            <Download size={18} />
            {mode === 'draw' ? 'Download Drawing' : 'Download Selection'}
          </button>
        )}

        {/* Coordinates Display */}
        {coordinates && mode === 'box' && (
          <div className="border rounded-xl p-4 bg-gray-50 border-gray-200">
            <h3 className="font-medium text-gray-700 mb-2">Current Selection</h3>
            <div className="text-sm space-y-1 text-gray-600">
              <p>Start: ({coordinates.start.x}, {coordinates.start.y})</p>
              <p>Width: {coordinates.box.width}px</p>
              <p>Height: {coordinates.box.height}px</p>
            </div>
          </div>
        )}
      </div>

      {/* Image Area */}
      <div className="flex-1 p-8" ref={containerRef}>
        <div className="relative inline-block">
          {image ? (
            <>
              <canvas
                ref={canvasRef}
                className="max-w-full h-auto rounded-xl shadow-xl"
                style={{ 
                  cursor: mode === 'box' 
                    ? 'crosshair' 
                    : mode === 'draw' 
                    ? 'pointer' 
                    : 'pointer'
                }}
              />
              {/* Drawing Canvas - positioned absolutely over the main canvas */}
              <canvas
                ref={drawingCanvasRef}
                className="absolute top-0 left-0 max-w-full h-auto"
                style={{
                  pointerEvents: mode === 'draw' ? 'auto' : 'none'
                }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              />
              <canvas
                ref={previewCanvasRef}
                className="hidden"
              />
              {mode === 'box' && box && (
                <div
                  className="absolute border-2 border-blue-500 bg-blue-200 bg-opacity-20"
                  style={{
                    left: `${box.x}px`,
                    top: `${box.y}px`,
                    width: `${box.width}px`,
                    height: `${box.height}px`,
                    transform: `scale(${canvasRef.current ? canvasRef.current.width / canvasRef.current.getBoundingClientRect().width : 1})`
                  }}
                />
              )}
            </>
          ) : (
            <div className="w-full h-[600px] bg-white rounded-xl shadow-lg flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-200">
              <Upload size={48} className="mb-4 text-gray-300" />
              <p className="text-lg font-medium">Upload an image to begin</p>
              <p className="text-sm text-gray-400 mt-2">Supports JPG, PNG and GIF</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Snip;