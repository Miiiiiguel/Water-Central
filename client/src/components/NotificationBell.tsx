import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { Bell, CheckCheck, Inbox } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase, AppNotification } from '@/lib/supabase';

function timeAgo(iso: string, language: string) {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  const mins = Math.floor(seconds / 60);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return language === 'es' ? `hace ${days}d` : `${days}d ago`;
  if (hours > 0) return language === 'es' ? `hace ${hours}h` : `${hours}h ago`;
  if (mins > 0) return language === 'es' ? `hace ${mins}m` : `${mins}m ago`;
  return language === 'es' ? 'ahora' : 'now';
}

export default function NotificationBell() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [, navigate] = useLocation();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;

    supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => setNotifications((data as AppNotification[]) ?? []));

    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        (payload) => setNotifications((prev) => [payload.new as AppNotification, ...prev])
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user) return null;

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    await supabase.from('notifications').update({ read: true }).eq('id', id);
  };

  const markAllAsRead = async () => {
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    await supabase.from('notifications').update({ read: true }).in('id', unreadIds);
  };

  const handleClick = (n: AppNotification) => {
    if (!n.read) markAsRead(n.id);
    setOpen(false);
    if (n.link) navigate(n.link);
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 rounded-full hover:bg-orange-50 transition-colors bg-transparent border-0 cursor-pointer"
        aria-label={language === 'es' ? 'Notificaciones' : 'Notifications'}
      >
        <Bell size={20} className="text-primary" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[90vw] bg-white rounded-2xl app-shadow border border-gray-100 overflow-hidden z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <p className="font-bold text-primary text-sm">{language === 'es' ? 'Notificaciones' : 'Notifications'}</p>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="flex items-center gap-1 text-xs font-semibold text-accent hover:underline bg-transparent border-0 cursor-pointer"
              >
                <CheckCheck size={14} />
                {language === 'es' ? 'Marcar todas' : 'Mark all read'}
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center text-center py-10 px-4">
                <Inbox size={24} className="text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  {language === 'es' ? 'Sin notificaciones todavía.' : 'No notifications yet.'}
                </p>
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors flex gap-2 bg-transparent border-0 cursor-pointer ${!n.read ? 'bg-orange-50/50' : ''}`}
                >
                  <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${!n.read ? 'bg-accent' : 'bg-transparent'}`} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{n.title}</p>
                    {n.body && <p className="text-xs text-muted-foreground line-clamp-2">{n.body}</p>}
                    <p className="text-[11px] text-muted-foreground mt-1">{timeAgo(n.created_at, language)}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
