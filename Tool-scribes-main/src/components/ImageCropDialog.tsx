import { useState, useRef, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CropIcon, X } from 'lucide-react';

interface ImageCropDialogProps {
  open: boolean;
  onClose: () => void;
  imageUrl: string;
  onCrop: (croppedBlob: Blob) => void;
  aspectRatio?: number;
  title?: string;
}

export default function ImageCropDialog({
  open, onClose, imageUrl, onCrop,
  aspectRatio = 1, title = 'Crop Image',
}: ImageCropDialogProps) {
  const imageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0, size: 200 });
  const [imageSize, setImageSize] = useState({ w: 0, h: 0 });
  /** Zoom factor. Zoom UI is not wired up yet, so this is fixed at 1. */
  const scale = 1;
  const dragStart = useRef({ x: 0, y: 0, cropX: 0, cropY: 0 });

  useEffect(() => {
    if (!open) return;
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      setImageSize({ w, h });
      const maxW = w;
      const maxH = h;
      const size = Math.min(maxW, maxH * aspectRatio) * 0.8;
      setCrop({ x: (w - size) / 2, y: (h - size / aspectRatio) / 2, size });
    };
    img.src = imageUrl;
  }, [open, imageUrl, aspectRatio]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, cropX: crop.x, cropY: crop.y };
  }, [crop]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = (e.clientX - dragStart.current.x) / scale;
    const dy = (e.clientY - dragStart.current.y) / scale;
    const cropH = crop.size / aspectRatio;
    const maxX = imageSize.w - crop.size;
    const maxY = imageSize.h - cropH;
    setCrop(prev => ({
      ...prev,
      x: Math.max(0, Math.min(maxX, dragStart.current.cropX + dx)),
      y: Math.max(0, Math.min(maxY, dragStart.current.cropY + dy)),
    }));
  }, [isDragging, scale, aspectRatio, imageSize, crop.size]);

  const handleMouseUp = useCallback(() => setIsDragging(false), []);

  const handleCrop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const size = Math.min(crop.size, 512);
    canvas.width = size;
    canvas.height = size / aspectRatio;
    ctx.drawImage(
      imageRef.current!,
      crop.x, crop.y, crop.size, crop.size / aspectRatio,
      0, 0, canvas.width, canvas.height
    );
    canvas.toBlob(blob => {
      if (blob) onCrop(blob);
    }, 'image/jpeg', 0.9);
  }, [crop, aspectRatio, onCrop]);

  console.log('[ImageCropDialog] render', { open, imageSize, crop, imageUrl });
  const displaySize = 360;
  const aspect = imageSize.w > 0 && imageSize.h > 0 ? imageSize.w / imageSize.h : 1;
  const imgDisplayH = displaySize / aspect;
  const cropDisplaySize = imageSize.w > 0 ? (crop.size / imageSize.w) * displaySize : 0;

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-[500px]" style={{ zIndex: 9999 }} overlayClassName="z-[9998]" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="font-syne text-[18px]">{title}</DialogTitle>
        </DialogHeader>
        <div
          ref={containerRef}
          className="relative overflow-hidden rounded-lg mx-auto"
          style={{ width: displaySize, height: displaySize / aspectRatio, backgroundColor: '#f0f0f0' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <img
            ref={imageRef}
            src={imageUrl}
            alt="Crop preview"
            className="absolute select-none"
            style={{ width: displaySize, height: imgDisplayH, top: 0, left: 0 }}
            draggable={false}
          />
          <div
            className={`absolute border-2 border-white cursor-move shadow-lg ${aspectRatio === 1 ? 'rounded-full' : 'rounded-lg'}`}
            style={{
              left: (crop.x / (imageSize.w || 1)) * displaySize,
              top: (crop.y / (imageSize.h || 1)) * imgDisplayH,
              width: cropDisplaySize,
              height: imageSize.w > 0 ? cropDisplaySize / aspectRatio : cropDisplaySize,
              boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)',
            }}
          />
        </div>
        <div className="flex justify-end gap-2 mt-2">
          <Button variant="outline" onClick={onClose} size="sm">
            <X size={14} className="mr-1" /> Cancel
          </Button>
          <Button onClick={handleCrop} size="sm" style={{ backgroundColor: '#2D6A4F' }}>
            <CropIcon size={14} className="mr-1" /> Apply Crop
          </Button>
        </div>
        <canvas ref={canvasRef} className="hidden" />
      </DialogContent>
    </Dialog>
  );
}
