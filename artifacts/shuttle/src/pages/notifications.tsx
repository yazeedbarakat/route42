import { useGetNotifications, useMarkNotificationRead } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { format } from "date-fns";

export default function Notifications() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!user) setLocation("/");
  }, [user, setLocation]);

  const { data: notifications, isLoading, refetch } = useGetNotifications();
  const markRead = useMarkNotificationRead();

  const handleMarkRead = async (id: number) => {
    try {
      await markRead.mutateAsync({ id });
      refetch();
    } catch (err) {
      console.error(err);
    }
  };

  if (!user) return null;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="border border-border p-4 bg-card">
        <h1 className="text-xl font-bold text-primary mb-2">{">"} SYSTEM_NOTIFICATIONS</h1>
        <div className="text-sm text-muted-foreground">
          UNREAD: {notifications?.filter(n => !n.isRead).length || 0}
        </div>
      </div>

      <div className="border border-border p-4">
        {isLoading ? (
          <div className="text-muted-foreground blink">FETCHING_MESSAGES...</div>
        ) : notifications?.length === 0 ? (
          <div className="text-muted-foreground">INBOX_EMPTY</div>
        ) : (
          <div className="space-y-4">
            {notifications?.map((notification) => (
              <div 
                key={notification.id} 
                className={`border p-4 relative ${
                  notification.isRead 
                    ? "border-border bg-background opacity-70" 
                    : "border-primary bg-primary/5"
                }`}
              >
                {!notification.isRead && (
                  <div className="absolute top-0 right-0 w-2 h-2 bg-primary"></div>
                )}
                
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <div className="text-xs text-muted-foreground mb-2">
                      [{format(new Date(notification.createdAt), "yyyy-MM-dd HH:mm:ss")}]
                      {" "} TYPE: {notification.type.toUpperCase()}
                    </div>
                    <div className={`font-mono ${!notification.isRead ? "text-foreground font-bold" : "text-muted-foreground"}`}>
                      {notification.message}
                    </div>
                  </div>
                  
                  {!notification.isRead && (
                    <button 
                      onClick={() => handleMarkRead(notification.id)}
                      disabled={markRead.isPending}
                      className="shrink-0 text-xs border border-primary text-primary px-2 py-1 hover:bg-primary hover:text-primary-foreground transition-colors disabled:opacity-50"
                    >
                      ACKNOWLEDGE
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
