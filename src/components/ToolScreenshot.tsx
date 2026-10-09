import { useState, useRef } from 'react';
import { Camera, Upload, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface ToolScreenshotProps {
  screenshotUrl?: string;
  ogImage?: string;
  toolName: string;
  toolIcon?: string;
  canUpload?: boolean;
  toolUuid?: string;
  onUpdate?: (url: string) => void;
  className?: string;
}

export default function ToolScreenshot({ screenshotUrl, ogImage, toolName, canUpload, toolUuid, onUpdate, className = '' }: ToolScreenshotProps) {
  const [imgError, setImgError] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const src = screenshotUrl || ogImage;
  const showImage = src && !imgError;

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !toolUuid) return;
    setUploading(true);
    const session = await supabase.auth.getSession();
    const userId = session.data.session?.user?.id;
    if (!userId) { setUploading(false); return; }
    const ext = file.name.split('.').pop() || 'png';
    const path = `${userId}/${toolUuid}/${Date.now()}.${ext}`;
    const { data, error } = await supabase.storage.from('screenshots').upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    });
    if (error || !data) { setUploading(false); return; }
    const { data: { publicUrl } } = supabase.storage.from('screenshots').getPublicUrl(data.path);
    onUpdate?.(publicUrl);
    setUploading(false);
  };

  return (
    <div className={`relative ${className}`}>
      <div className="aspect-video bg-s2 border border-tv-border rounded-lg overflow-hidden flex items-center justify-center">
        {showImage ? (
          <img
            src={src}
            alt={toolName}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-tv-text-m">
            <Camera size={28} className="opacity-40" />
            <span className="text-[11px] font-mono">No screenshot available yet</span>
          </div>
        )}
      </div>
      {canUpload && toolUuid && (
        <>
          <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleUpload} />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="absolute bottom-2 right-2 flex items-center gap-1.5 px-2.5 py-1.5 bg-white/90 backdrop-blur-sm border border-tv-border rounded-lg text-[11px] font-mono text-tv-text hover:bg-white transition-colors shadow-sm disabled:opacity-50"
          >
            {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
            {uploading ? 'Uploading...' : 'Upload Screenshot'}
          </button>
        </>
      )}
    </div>
  );
}
