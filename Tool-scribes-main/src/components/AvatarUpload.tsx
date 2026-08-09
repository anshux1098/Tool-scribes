import { useState, useRef, useCallback } from 'react';
import { Camera, Trash2, Loader2 } from 'lucide-react';
import ImageCropDialog from '@/components/ImageCropDialog';
import { useStorageUpload } from '@/hooks/useStorageUpload';

interface AvatarUploadProps {
  currentUrl: string;
  onUpload: (url: string) => void;
  onRemove: () => void;
  size?: number;
}

export default function AvatarUpload({ currentUrl, onUpload, onRemove, size = 140 }: AvatarUploadProps) {
  const { upload, uploading } = useStorageUpload('avatars');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showCrop, setShowCrop] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    console.log('[AvatarUpload] file selected', file);
    if (!file) return;
    console.log('[AvatarUpload] creating object URL');
    const url = URL.createObjectURL(file);
    console.log('[AvatarUpload] preview created', url);
    setPreviewUrl(url);
    setShowCrop(true);
    console.log('[AvatarUpload] opening crop modal', { showCrop: true, previewUrl: url });
    if (fileRef.current) fileRef.current.value = '';
  }, []);

  const handleCrop = useCallback(async (blob: Blob) => {
    const file = new File([blob], `avatar-${Date.now()}.jpg`, { type: 'image/jpeg' });
    const url = await upload(file);
    if (url) onUpload(url);
    setShowCrop(false);
    setPreviewUrl(null);
    URL.revokeObjectURL(previewUrl || '');
  }, [upload, onUpload, previewUrl]);

  const handleRemove = useCallback(() => {
    onRemove();
  }, [onRemove]);

  return (
    <>
      <div className="relative" style={{ width: size, height: size }}>
        {currentUrl ? (
          <img
            src={currentUrl}
            alt="Avatar"
            className="w-full h-full rounded-full object-cover border-2 border-white shadow-sm"
          />
        ) : (
          <div
            className="w-full h-full rounded-full flex items-center justify-center text-white text-[56px] font-syne font-bold"
            style={{ backgroundColor: '#2D6A4F' }}
          >
            ?
          </div>
        )}
        <div className="absolute inset-0 rounded-full bg-black/0 hover:bg-black/30 transition-colors flex items-center justify-center gap-2 opacity-0 hover:opacity-100">
          <button
            onClick={() => fileRef.current?.click()}
            className="w-9 h-9 rounded-full bg-white/90 flex items-center justify-center hover:bg-white transition-colors shadow-sm"
            title="Upload photo"
          >
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} style={{ color: '#1a1a1a' }} />}
          </button>
          {currentUrl && (
            <button
              onClick={handleRemove}
              className="w-9 h-9 rounded-full bg-white/90 flex items-center justify-center hover:bg-white transition-colors shadow-sm"
              title="Remove photo"
            >
              <Trash2 size={14} style={{ color: '#DC2626' }} />
            </button>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>

      {showCrop && previewUrl && (
        <ImageCropDialog
          open={showCrop}
          onClose={() => { setShowCrop(false); setPreviewUrl(null); }}
          imageUrl={previewUrl}
          onCrop={handleCrop}
          aspectRatio={1}
          title="Crop Avatar"
        />
      )}
    </>
  );
}
