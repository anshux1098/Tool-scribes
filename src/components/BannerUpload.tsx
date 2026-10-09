import { useState, useRef, useCallback } from 'react';
import { Camera, Trash2, Loader2 } from 'lucide-react';
import ImageCropDialog from '@/components/ImageCropDialog';
import { useStorageUpload } from '@/hooks/useStorageUpload';

interface BannerUploadProps {
  currentUrl: string;
  onUpload: (url: string) => void;
  onRemove: () => void;
}

export default function BannerUpload({ currentUrl, onUpload, onRemove }: BannerUploadProps) {
  const { upload, uploading } = useStorageUpload('banners');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showCrop, setShowCrop] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setShowCrop(true);
    if (fileRef.current) fileRef.current.value = '';
  }, []);

  const handleCrop = useCallback(async (blob: Blob) => {
    const file = new File([blob], `banner-${Date.now()}.jpg`, { type: 'image/jpeg' });
    const url = await upload(file);
    if (url) onUpload(url);
    setShowCrop(false);
    setPreviewUrl(null);
  }, [upload, onUpload]);

  return (
    <>
      <div
        className="relative w-full h-48 rounded-xl overflow-hidden group"
        style={{ backgroundColor: '#E5E0D6' }}
      >
        {currentUrl ? (
          <img src={currentUrl} alt="Banner" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Camera size={32} style={{ color: '#B0ABA0' }} />
          </div>
        )}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
          <button
            onClick={() => fileRef.current?.click()}
            className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center hover:bg-white transition-colors shadow-sm"
            title="Upload banner"
          >
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} style={{ color: '#1a1a1a' }} />}
          </button>
          {currentUrl && (
            <button
              onClick={onRemove}
              className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center hover:bg-white transition-colors shadow-sm"
              title="Remove banner"
            >
              <Trash2 size={16} style={{ color: '#DC2626' }} />
            </button>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
      </div>

      {showCrop && previewUrl && (
        <ImageCropDialog
          open={showCrop}
          onClose={() => { setShowCrop(false); setPreviewUrl(null); }}
          imageUrl={previewUrl}
          onCrop={handleCrop}
          aspectRatio={3}
          title="Crop Banner"
        />
      )}
    </>
  );
}
