import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Heart, PenLine, CheckCircle, Plus, RefreshCw, UserPlus, Layers, Loader2, Bell } from 'lucide-react';
import { NotificationItem, NotificationType } from '@/hooks/useNotifications';
import { formatDistanceToNow } from 'date-fns';
import { hashId } from '@/lib/hashId';

interface NotificationPanelProps {
  notifications: NotificationItem[];
  unreadCount: number;
  loading: boolean;
  onClose: () => void;
}

const TYPE_CONFIG: Record<NotificationType, { icon: React.ElementType; color: string; bg: string; label: string }> = {
  new_tool: { icon: Plus, color: '#1D4ED8', bg: 'rgba(29,78,216,0.08)', label: 'New tool' },
  new_collection: { icon: Layers, color: '#2D6A4F', bg: 'rgba(45,106,79,0.08)', label: 'New collection' },
  collection_updated: { icon: RefreshCw, color: '#B45309', bg: 'rgba(180,83,9,0.08)', label: 'Collection updated' },
  new_review: { icon: PenLine, color: '#7E22CE', bg: 'rgba(126,34,206,0.08)', label: 'New review' },
  new_follower: { icon: Heart, color: '#DC2626', bg: 'rgba(220,38,38,0.08)', label: 'New follower' },
  tool_approved: { icon: CheckCircle, color: '#059669', bg: 'rgba(5,150,105,0.08)', label: 'Approved' },
  collection_followed: { icon: UserPlus, color: '#2563EB', bg: 'rgba(37,99,235,0.08)', label: 'Collection followed' },
};

function getNotificationAction(item: NotificationItem): { onClick: () => void; text: string } {
  switch (item.type) {
    case 'new_follower':
      return { onClick: () => {}, text: `${item.actorName || item.actorUsername || 'Someone'} started following you` };
    case 'tool_approved':
      return { onClick: () => {}, text: `Your tool "${item.targetName}" was approved` };
    case 'new_collection':
      return { onClick: () => {}, text: `${item.actorName || item.actorUsername || 'A curator'} published a collection "${item.targetName}"` };
    case 'collection_updated':
      return { onClick: () => {}, text: `Collection "${item.targetName}" was updated` };
    case 'new_review':
      return { onClick: () => {}, text: `${item.actorName || item.actorUsername || 'Someone'} reviewed "${item.targetName}"` };
    case 'new_tool':
      return { onClick: () => {}, text: `${item.actorName || item.actorUsername || 'A curator'} added "${item.targetName}"` };
    case 'collection_followed':
      return { onClick: () => {}, text: `${item.actorName || item.actorUsername || 'Someone'} followed your collection "${item.targetName}"` };
    default:
      return { onClick: () => {}, text: 'New activity' };
  }
}

export default function NotificationPanel({ notifications, unreadCount, loading, onClose }: NotificationPanelProps) {
  const navigate = useNavigate();

  const handleNavigate = (item: NotificationItem) => {
    onClose();
    switch (item.type) {
      case 'new_follower':
        if (item.actorUsername) navigate(`/u/${item.actorUsername}`);
        break;
      case 'tool_approved':
        if (item.targetId) navigate(`/tool/${hashId(item.targetId)}`);
        break;
      case 'new_collection':
      case 'collection_updated':
      case 'collection_followed':
        if (item.targetId) navigate(`/c/${item.targetId}`);
        break;
      case 'new_review':
        if (item.targetId) navigate(`/tool/${hashId(item.targetId)}`);
        break;
      case 'new_tool':
        if (item.targetId) navigate(`/tool/${hashId(item.targetId)}`);
        break;
    }
  };

  return (
    <div className="absolute right-0 top-full mt-2 w-80 bg-surface border-2 border-tv-border rounded-xl shadow-brutal overflow-hidden z-[60]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-tv-border">
        <div className="flex items-center gap-2">
          <Bell size={14} className="text-tv-text-m" />
          <span className="text-[12px] font-mono text-tv-text uppercase tracking-widest">Notifications</span>
          {unreadCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-tv-primary text-white text-[9px] font-mono font-medium leading-none">
              {unreadCount}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-[11px] font-mono text-tv-text-s hover:text-tv-text transition-colors"
        >
          Close
        </button>
      </div>

      <div className="max-h-[420px] overflow-y-auto">
        {loading && notifications.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={16} className="animate-spin text-tv-text-m" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center py-10 text-center px-4">
            <Bell size={24} className="text-tv-text-m mb-3" />
            <p className="text-[13px] font-syne text-tv-text mb-1">No notifications yet</p>
            <p className="text-[11px] font-mono text-tv-text-s leading-relaxed">
              Follow curators and collections. Your activity will appear here.
            </p>
          </div>
        ) : (
          <div>
            {notifications.slice(0, 30).map((item, i) => {
              const config = TYPE_CONFIG[item.type] || TYPE_CONFIG.new_tool;
              const Icon = config.icon;
              const { text } = getNotificationAction(item);
              return (
                <motion.button
                  key={item.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.015, duration: 0.15 }}
                  onClick={() => handleNavigate(item)}
                  className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-s2 transition-colors border-b border-tv-border/50 last:border-b-0"
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: config.bg }}
                  >
                    <Icon size={14} style={{ color: config.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] text-tv-text leading-snug line-clamp-2">{text}</p>
                    <p className="text-[10px] font-mono text-tv-text-m mt-0.5">
                      {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                </motion.button>
              );
            })}
          </div>
        )}
      </div>

      {notifications.length > 0 && (
        <div className="px-4 py-2.5 border-t border-tv-border bg-s2">
          <button
            onClick={() => { onClose(); navigate('/following'); }}
            className="w-full text-center text-[11px] font-mono text-tv-text-s hover:text-tv-primary transition-colors"
          >
            View all activity
          </button>
        </div>
      )}
    </div>
  );
}
