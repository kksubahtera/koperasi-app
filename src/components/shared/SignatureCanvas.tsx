import { useRef, useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Check, RotateCcw, Pencil, Mouse } from 'lucide-react';
import { useThemeLanguage } from '@/contexts/ThemeLanguageContext';

interface SignatureCanvasProps {
  onSave: (base64: string) => void;
  onCancel: () => void;
  width?: number;
  height?: number;
}

export const SignatureCanvas = ({ 
  onSave, 
  onCancel, 
  width = 320, 
  height = 160 
}: SignatureCanvasProps) => {
  const { t } = useThemeLanguage();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  // Initialize and resize canvas
  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Get container width and calculate proportional height
    const containerWidth = container.clientWidth;
    const canvasWidth = Math.min(containerWidth, width);
    const canvasHeight = Math.round(canvasWidth * (height / width));

    // Set actual canvas dimensions (not CSS)
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // Set white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    
    // Set drawing style
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, [width, height]);

  useEffect(() => {
    setupCanvas();
    
    // Re-setup on window resize
    const handleResize = () => {
      if (!hasDrawn) {
        setupCanvas();
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [setupCanvas, hasDrawn]);

  const getCoordinates = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    
    let clientX: number, clientY: number;

    if ('touches' in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if ('changedTouches' in e && e.changedTouches.length > 0) {
      clientX = e.changedTouches[0].clientX;
      clientY = e.changedTouches[0].clientY;
    } else if ('clientX' in e) {
      clientX = e.clientX;
      clientY = e.clientY;
    } else {
      return { x: 0, y: 0 };
    }

    // Direct coordinate mapping - canvas size matches display size
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    return { x, y };
  }, []);

  const startDrawing = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;

    setIsDrawing(true);
    setHasDrawn(true);

    const { x, y } = getCoordinates(e);
    lastPointRef.current = { x, y };
    
    // Draw a dot at start position
    ctx.beginPath();
    ctx.arc(x, y, 1.25, 0, Math.PI * 2);
    ctx.fillStyle = '#000000';
    ctx.fill();
  }, [getCoordinates]);

  const draw = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !lastPointRef.current) return;

    const { x, y } = getCoordinates(e);
    
    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(x, y);
    ctx.stroke();
    
    lastPointRef.current = { x, y };
  }, [isDrawing, getCoordinates]);

  const stopDrawing = useCallback((e?: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setIsDrawing(false);
    lastPointRef.current = null;
  }, []);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
    lastPointRef.current = null;
  }, []);

  const saveSignature = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Convert to PNG with transparent background
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;

    // Copy original canvas
    tempCtx.drawImage(canvas, 0, 0);

    // Get image data and make white pixels transparent
    const imageData = tempCtx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      // If pixel is white or near-white, make it transparent
      if (data[i] > 240 && data[i + 1] > 240 && data[i + 2] > 240) {
        data[i + 3] = 0;
      }
    }

    tempCtx.putImageData(imageData, 0, 0);
    const base64 = tempCanvas.toDataURL('image/png');
    onSave(base64);
  }, [onSave]);

  // Prevent page scroll when touching canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const preventScroll = (e: TouchEvent) => {
      e.preventDefault();
    };

    canvas.addEventListener('touchstart', preventScroll, { passive: false });
    canvas.addEventListener('touchmove', preventScroll, { passive: false });
    
    return () => {
      canvas.removeEventListener('touchstart', preventScroll);
      canvas.removeEventListener('touchmove', preventScroll);
    };
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
        <Mouse className="h-3 w-3" />
        <span>{t('Gunakan mouse atau jari untuk menggambar', 'Use mouse or finger to draw')}</span>
        <Pencil className="h-3 w-3 ml-1" />
      </div>
      
      <div 
        ref={containerRef}
        className="border-2 border-dashed border-primary/50 rounded-lg overflow-hidden bg-white"
        style={{ maxWidth: width }}
      >
        <canvas
          ref={canvasRef}
          className="cursor-crosshair block w-full"
          style={{ touchAction: 'none' }}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          onTouchCancel={stopDrawing}
        />
      </div>
      
      <p className="text-xs text-muted-foreground text-center">
        {t('Gambar tanda tangan Anda di area di atas', 'Draw your signature in the area above')}
      </p>

      <div className="flex gap-2 justify-end">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={clearCanvas}
          className="gap-1"
        >
          <RotateCcw className="h-3 w-3" />
          {t('Hapus', 'Clear')}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onCancel}
        >
          {t('Batal', 'Cancel')}
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={saveSignature}
          disabled={!hasDrawn}
          className="gap-1"
        >
          <Check className="h-3 w-3" />
          {t('Simpan', 'Save')}
        </Button>
      </div>
    </div>
  );
};