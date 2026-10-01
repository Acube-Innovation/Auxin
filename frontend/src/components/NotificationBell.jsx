import React, { useState, useEffect, useRef, useCallback } from "react";
import styles from "./NotificationBell.module.css";
import belldot from "../assets/dashboard/bell-dot.svg";
import chevrondown from "../assets/dashboard/chevron-down.svg";
import config from '../config/config';
import { io as ioClient } from "socket.io-client";

const REMINDER_NOTIFICATION_TYPES = new Set([
  "meeting-reminder",
  "event-reminder",
  "task-reminder",
]);

function NotificationBell({ small = true }) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationSupported, setNotificationSupported] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState("default");
  const [inAppReminders, setInAppReminders] = useState([]);
  const [showPermissionBanner, setShowPermissionBanner] = useState(false);
  const [permissionBannerMsg, setPermissionBannerMsg] = useState("");
  const dropdownRef = useRef();
  const socketRef = useRef(null);
  const receivedIdsRef = useRef(new Set());
  const isOpenRef = useRef(false);
  const scheduledTimersRef = useRef(new Map());
  const meRef = useRef(null);

  // Initialize appNotifications and load stored notifications
  useEffect(() => {
    // Initialize window.appNotifications
    if (typeof window !== 'undefined') {
      // Load from localStorage
      try {
        const stored = localStorage.getItem('auxin_notifications');
        if (stored) {
          const parsed = JSON.parse(stored);
          setNotifications(parsed);
        }
      } catch (e) {
        console.warn('Failed to parse stored notifications:', e);
      }
      
      // Create appNotifications global object
      window.appNotifications = {
        list: [],
        push: function(item) {
          console.log('📥 Adding notification to bell:', item);
          
          const notification = {
            id: item.id || `notification-${Date.now()}-${Math.random()}`,
            title: item.title || 'Notification',
            body: item.body || '',
            meta: item.meta || {},
            read: false,
            timestamp: new Date(),
            type: item.type || 'notification'
          };
          
          // Add to state
          setNotifications(prev => {
            const updated = [notification, ...prev].slice(0, 100); // Keep last 100
            // Save to localStorage
            try {
              localStorage.setItem('auxin_notifications', JSON.stringify(updated));
            } catch (e) {
              console.warn('Failed to save notifications to localStorage:', e);
            }
            return updated;
          });
          
          // Update unread count
          setUnreadCount(prev => prev + 1);
          
          return notification;
        },
        markAllRead: function() {
          setNotifications(prev => {
            const updated = prev.map(n => ({ ...n, read: true }));
            try {
              localStorage.setItem('auxin_notifications', JSON.stringify(updated));
            } catch (e) {
              console.warn('Failed to save notifications to localStorage:', e);
            }
            return updated;
          });
          setUnreadCount(0);
        }
      };
    }
  }, []);

  // Update unread count when notifications change
  useEffect(() => {
    const unread = notifications.filter(n => !n.read).length;
    setUnreadCount(unread);
  }, [notifications]);

  const playBeep = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(880, ctx.currentTime);
      g.gain.setValueAtTime(0.001, ctx.currentTime);
      o.connect(g);
      g.connect(ctx.destination);
      g.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.01);
      o.start();
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      setTimeout(() => {
        try { o.stop(); ctx.close(); } catch (_) {}
      }, 700);
    } catch (e) {
      console.warn("Audio beep failed:", e);
    }
  }, []);

  const triggerBrowserReminder = useCallback((payload) => {
    if (typeof window === "undefined") return false;
    if (!payload || !REMINDER_NOTIFICATION_TYPES.has(payload.type)) return false;
    if (!("Notification" in window)) return false;

    try {
      if (window.Notification && window.Notification.permission === "granted") {
        const opts = {
          body: payload.body || "",
          tag: payload.id,
          icon: "/auxin_logo.png",
          silent: false,
        };
        const notification = new window.Notification(payload.title || "Reminder", opts);
        notification.onclick = () => {
          try { window.focus(); } catch (_) {}
          const targetUrl = payload.url || payload.meta?.url;
          if (targetUrl) window.location.href = targetUrl;
          notification.close();
        };
        setTimeout(() => notification.close(), 10000);
        return true;
      }
    } catch (err) {
      console.warn("Browser notification failed:", err);
    }
    return false;
  }, []);

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    const supported = typeof window !== "undefined" && "Notification" in window;
    setNotificationSupported(supported && window.isSecureContext);
    if (supported && typeof window.Notification !== "undefined") {
      setPermissionStatus(window.Notification.permission || "default");
    } else {
      setPermissionStatus("unsupported");
    }
  }, []);

  const requestNotificationPermission = useCallback(async () => {
    if (!notificationSupported) {
      console.warn("Browser notifications not supported or not on secure context.");
      return "unsupported";
    }
    try {
      if (window.Notification && window.Notification.permission === "default") {
        const result = await window.Notification.requestPermission();
        setPermissionStatus(result);
        console.log("Notification permission result:", result);
        return result;
      }
      return window.Notification.permission;
    } catch (err) {
      console.error("Error requesting notification permission:", err);
      return "denied";
    }
  }, [notificationSupported]);

  const parseEventDateTime = (ev) => {
    const src = ev.meta?.event || ev.meta?.meeting || ev;
    const dt = ev.date || ev.start || src?.date || null;
    if (!dt) return null;
    try {
      if (ev.time || src?.time) {
        const time = ev.time || src?.time;
        const dateOnly = (typeof dt === 'string') ? dt.split('T')[0] : (dt instanceof Date ? dt.toISOString().split('T')[0] : dt);
        return new Date(`${dateOnly}T${time}:00`);
      }
      return new Date(dt);
    } catch (e) {
      return null;
    }
  };

  const scheduleLocalReminders = useCallback((event) => {
    try {
      if (!event) return;
      const currentUserId = meRef.current?._id || localStorage.getItem('userId');

      const assigned = (event.assignedTeamMembers || event.meta?.event?.assignedTeamMembers || event.assignedTo || []);
      const assignedIds = Array.isArray(assigned) ? assigned.map(String) : [String(assigned)];
      const creators = [event.createdBy, event.assignedBy, event.meta?.event?.assignedBy].filter(Boolean).map(String);

      if (currentUserId && !assignedIds.includes(String(currentUserId)) && !creators.includes(String(currentUserId))) {
        return;
      }

      const reminders = (event.reminders || event.meta?.event?.reminders || []);
      if (!Array.isArray(reminders) || reminders.length === 0) return;

      const dt = parseEventDateTime(event);
      if (!dt || isNaN(dt.getTime())) return;

      reminders.forEach((mins) => {
        const key = `${String(event._id || event.eventId || event.id)}-${mins}`;
        if (scheduledTimersRef.current.has(key) || receivedIdsRef.current.has(key)) return;

        const reminderTime = new Date(dt.getTime() - Number(mins) * 60000);
        const delay = reminderTime.getTime() - Date.now();
        if (delay <= 0) return;

        const timer = setTimeout(() => {
          if (receivedIdsRef.current.has(key)) return;
          receivedIdsRef.current.add(key);

          const payload = {
            id: key,
            type: 'event-reminder',
            title: `Reminder: ${event.title || event.eventName || 'Event'}`,
            body: `Event in ${mins} minutes`,
            meta: { ...event, reminderMinutes: mins }
          };

          // Add to notifications
          if (window.appNotifications?.push) {
            window.appNotifications.push({
              title: payload.title,
              body: payload.body,
              meta: payload.meta,
              type: 'event-reminder'
            });
          }

          const shown = (typeof window !== 'undefined' && window.Notification && window.Notification.permission === 'granted');
          if (shown) {
            try {
              new window.Notification(payload.title, { body: payload.body, tag: payload.id, icon: '/auxin_logo.png' });
            } catch (err) {
              console.warn('Local reminder native Notification failed:', err);
            }
          } else {
            setInAppReminders(prev => {
              const next = [{ id: payload.id, title: payload.title, body: payload.body, meta: payload.meta }, ...prev].slice(0, 6);
              setTimeout(() => setInAppReminders(cur => cur.filter(r => r.id !== payload.id)), 10000);
              return next;
            });
            playBeep();
          }

          scheduledTimersRef.current.delete(key);
        }, delay);

        scheduledTimersRef.current.set(key, timer);
      });
    } catch (e) {
      console.warn('scheduleLocalReminders error', e);
    }
  }, [playBeep]);

  useEffect(() => {
    return () => {
      for (const t of scheduledTimersRef.current.values()) {
        try { clearTimeout(t); } catch (e) {}
      }
      scheduledTimersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    const raw = config.API_BASE_URL || '';
    const socketUrl = raw.replace(/\/api\/?$/, '') || window.location.origin;

    const socket = ioClient(socketUrl, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      timeout: 20000
    });
    socketRef.current = socket;

    socket.on('connect', async () => {
      try {
        const token = localStorage.getItem('token');
        if (token) {
          const resp = await fetch(`${config.API_BASE_URL.replace(/\/api\/?$/, '')}/api/auth/me`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (resp.ok) {
            const me = await resp.json();
            meRef.current = me;
            
            try {
              const eventsResp = await fetch(`${config.API_BASE_URL.replace(/\/api\/?$/, '')}/api/clients/events`, {
                headers: { Authorization: `Bearer ${token}` }
              });
              if (eventsResp.ok) {
                const list = await eventsResp.json();
                (list || []).forEach(ev => scheduleLocalReminders(ev));
              }
              const empEventsResp = await fetch(`${config.API_BASE_URL.replace(/\/api\/?$/, '')}/api/employees/events`, {
                headers: { Authorization: `Bearer ${token}` }
              });
              if (empEventsResp.ok) {
                const list = await empEventsResp.json();
                (list || []).forEach(ev => scheduleLocalReminders(ev));
              }
            } catch (evErr) {
              console.debug('Could not prefetch events:', evErr);
            }
          }
        }
      } catch (meErr) {
        console.warn('Error fetching current user:', meErr);
      }

      console.log('🔌 Notification socket connected', socket.id);
      
      try {
        const token = localStorage.getItem('token');
        if (token) {
          const resp = await fetch(`${config.API_BASE_URL.replace(/\/api\/?$/, '')}/api/auth/me`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (resp.ok) {
            const me = await resp.json();
            const userId = me._id || me.id || localStorage.getItem('userId');
            const userRole = me.role || localStorage.getItem('role');
            const email = me.emailId || me.email || localStorage.getItem('email') || null;

            if (userId) {
              socket.emit('join-user', { userId, role: userRole });
            }
            if (email) {
              socket.emit('join-email', email);
              console.log(`Joining socket email room for ${email}`);
            }
          } else {
            console.warn('Failed to fetch /api/auth/me');
          }
        } else {
          const userIdLS = localStorage.getItem('userId');
          const roleLS = localStorage.getItem('role');
          const emailLS = localStorage.getItem('email');
          if (userIdLS) socket.emit('join-user', { userId: userIdLS, role: roleLS });
          if (emailLS) socket.emit('join-email', emailLS);
        }
      } catch (meErr) {
        console.warn('Error fetching current user for socket join:', meErr);
      }
    });
    
    socket.on('connect_error', (err) => {
      console.error('Notification socket connect_error', err);
    });

    socket.on('disconnect', (reason) => {
      console.log('Notification socket disconnected:', reason);
    });

    // FIXED: Handle all notifications properly
    socket.on('notification', (payload) => {
      console.log('📨 [LIVE] Received socket notification:', payload);
      try {
        const id = payload?.id || `${payload?.type || 'n'}-${payload?.taskId || payload?.clientId || Date.now()}`;
        if (receivedIdsRef.current.has(id)) return;
        receivedIdsRef.current.add(id);
        
        // Add to notifications list
        if (window.appNotifications?.push) {
          window.appNotifications.push({
            title: payload.title || 'Notification',
            body: payload.body || payload.message || '',
            meta: payload.meta || payload,
            type: payload.type || 'notification'
          });
        }
        
        // Show browser notification if permission granted
        if (notificationSupported && permissionStatus === 'granted') {
          try {
            new window.Notification(payload.title || 'Notification', { 
              body: payload.body || '', 
              tag: payload.id, 
              icon: '/auxin_logo.png' 
            });
          } catch (err) {
            console.warn('Failed to show browser notification:', err);
          }
        }
      } catch (e) { 
        console.error('Error handling socket notification', e); 
      }
    });

    // FIXED: Handle event-reminder properly
    socket.on('event-reminder', (payload) => {
      console.log('🎯 [LIVE] Received event-reminder:', payload);
      try {
        const perm = (typeof window !== 'undefined' && window.Notification) ? 
          window.Notification.permission : 'unsupported';
        console.log('🔍 reminder diagnostics: permissionStatus=', perm);

        // Show browser notification
        const shown = triggerBrowserReminder(payload);
        
        // Always add to notifications list
        if (window.appNotifications?.push) {
          window.appNotifications.push({
            title: payload.title || 'Reminder',
            body: payload.body || '',
            meta: payload.meta || payload,
            type: 'event-reminder',
            read: false
          });
        }

        if (!shown) {
          const reason = (typeof window !== 'undefined' && window.Notification)
            ? (window.Notification.permission === 'denied' ? 'blocked (denied by browser)' : 
               (window.isSecureContext ? 'permission not granted' : 'insecure context (requires HTTPS)'))
            : 'notifications API unavailable';
          setPermissionBannerMsg(`Reminder received, but native notifications are ${reason}.`);
          setShowPermissionBanner(true);

          // Show in-app toast
          setInAppReminders(prev => {
            const next = [{
              id: payload.id || `reminder-${Date.now()}`,
              title: payload.title || 'Reminder',
              body: payload.body || '',
              meta: payload.meta || payload
            }, ...prev].slice(0, 6);
            
            setTimeout(() => {
              setInAppReminders(cur => cur.filter(r => r.id !== payload.id));
            }, 10000);
            
            return next;
          });
          playBeep();
        }
      } catch (e) {
        console.error('Error handling event-reminder:', e);
      }
    });

    socket.on('client-event', (payload) => {
      try {
        console.log('client-event received:', payload);
        const ev = payload.event || payload;
        scheduleLocalReminders(ev);
        
        if (window.appNotifications?.push) {
          window.appNotifications.push({
            title: payload.title || 'Client Event',
            body: payload.body || '',
            meta: payload.meta || payload,
            type: 'client-event'
          });
        }
      } catch (err) {
        console.warn('client-event error:', err);
      }
    });
    
    socket.on('employee-event', (payload) => {
      try {
        console.log('employee-event received:', payload);
        const ev = payload.event || payload;
        scheduleLocalReminders(ev);
        
        if (window.appNotifications?.push) {
          window.appNotifications.push({
            title: payload.title || 'Employee Event',
            body: payload.body || '',
            meta: payload.meta || payload,
            type: 'employee-event'
          });
        }
      } catch (err) {
        console.warn('employee-event error:', err);
      }
    });

    socket.on('task-reminder', (payload) => {
      try {
        const id = payload?.id;
        if (id && scheduledTimersRef.current.has(id)) {
          try { clearTimeout(scheduledTimersRef.current.get(id)); } catch (err) {}
          scheduledTimersRef.current.delete(id);
        }
        
        if (window.appNotifications?.push) {
          window.appNotifications.push({
            title: payload.title || 'Reminder',
            body: payload.body || '',
            meta: payload.meta || payload,
            type: 'task-reminder'
          });
        }
        
        const shown = (typeof window !== 'undefined' && window.Notification && window.Notification.permission === 'granted');
        if (!shown) { 
          setInAppReminders(prev => { 
            const next = [{ 
              id: payload.id, 
              title: payload.title, 
              body: payload.body, 
              meta: payload.meta 
            }, ...prev].slice(0,6); 
            setTimeout(()=> setInAppReminders(cur => cur.filter(r=>r.id !== payload.id)),10000); 
            return next; 
          }); 
          playBeep(); 
        }
      } catch (e) { 
        console.warn('task-reminder handler error', e); 
      }
    });

    const onDocClick = (e) => {
      try {
        if (isOpenRef.current && dropdownRef.current && !dropdownRef.current.contains(e.target)) {
          setIsOpen(false);
        }
      } catch (err) {
        console.warn('onDocClick handler error:', err);
      }
    };

    document.addEventListener("click", onDocClick);

    return () => {
      document.removeEventListener("click", onDocClick);
      try { socket.disconnect(); } catch (e) { /* ignore */ }
    };
  }, [notificationSupported, permissionStatus, requestNotificationPermission, triggerBrowserReminder, playBeep, scheduleLocalReminders]);

  const toggleOpen = async () => {
    if (notificationSupported && permissionStatus === "default") {
      await requestNotificationPermission();
    }
    
    const newState = !isOpen;
    setIsOpen(newState);

    // Mark as read when opened
    if (newState) {
      setNotifications(prev => {
        const updated = prev.map(n => ({ ...n, read: true }));
        // Save to localStorage
        try {
          localStorage.setItem('auxin_notifications', JSON.stringify(updated));
        } catch (e) {
          console.warn('Failed to save notifications to localStorage:', e);
        }
        return updated;
      });
      setUnreadCount(0);
    }
  };

  const clearAll = () => {
    setNotifications([]);
    setUnreadCount(0);
    // Clear localStorage
    try {
      localStorage.removeItem('auxin_notifications');
    } catch (e) {
      console.warn('Failed to clear notifications from localStorage:', e);
    }
  };

  const markAsRead = (id) => {
    setNotifications(prev => {
      const updated = prev.map(n => n.id === id ? { ...n, read: true } : n);
      try {
        localStorage.setItem('auxin_notifications', JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to save notifications to localStorage:', e);
      }
      return updated;
    });
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const PermissionHint = () => {
    if (!notificationSupported) {
      return (
        <div style={{ fontSize: 12, color: '#6b7280', marginLeft: 8 }}>
          Browser notifications unavailable — requires HTTPS.
        </div>
      );
    }
    if (permissionStatus === "granted") return null;
    if (permissionStatus === "denied") {
      return (
        <div style={{ fontSize: 12, color: '#b91c1c', marginLeft: 8 }}>
          Notifications disabled — enable from browser settings.
        </div>
      );
    }
    return (
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 8 }}>
        <button
          onClick={() => requestNotificationPermission().then((r) => {
            if (r !== 'granted') {
              console.info('Permission not granted:', r);
            } else {
              setShowPermissionBanner(false);
            }
          })}
          style={{
            fontSize: 12,
            padding: '6px 8px',
            borderRadius: 6,
            border: '1px solid #cbd5e1',
            background: '#fff',
            cursor: 'pointer'
          }}
        >
          Enable browser notifications
        </button>
        <div style={{ fontSize: 12, color: '#6b7280' }}>Click to allow</div>
      </div>
    );
  };

  return (
    <div className={styles.notificationWrapper} ref={dropdownRef}>
      {showPermissionBanner && (
        <div className={styles.permissionBanner}>
          <div className={styles.permissionBannerText}>{permissionBannerMsg}</div>
          <div className={styles.permissionBannerActions}>
            <button onClick={() => requestNotificationPermission().then(res => {
              if (res === 'granted') setShowPermissionBanner(false);
            })} className={styles.permissionBannerEnable}>Enable</button>
            <button onClick={() => setShowPermissionBanner(false)} className={styles.permissionBannerDismiss}>Dismiss</button>
          </div>
        </div>
      )}

      <button className={styles.bellButton} onClick={toggleOpen} aria-label="Notifications">
        <img src={belldot} alt="notifications" className={styles.bellIcon} />
        {unreadCount > 0 && <span className={styles.badge}>{unreadCount > 99 ? '99+' : unreadCount}</span>}
      </button>

      {inAppReminders.length > 0 && (
        <div className={styles.inAppRemindersWrapper}>
          {inAppReminders.map(r => (
            <div key={r.id} className={styles.inAppReminderItem}>
              <div className={styles.inAppReminderContent}>
                <div className={styles.inAppReminderTitle}>{r.title}</div>
                <div className={styles.inAppReminderBody}>{r.body}</div>
              </div>
              <div className={styles.inAppReminderAction}>
                <button onClick={() => {
                  try { window.open(r.meta?.url || r.meta?.link || '/', '_blank'); } catch (e) {}
                }} className={styles.inAppReminderButton}>
                  Open
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {isOpen && (
        <div className={styles.dropdown}>
          <div className={styles.dropdownHeader} style={{ position: 'relative' }}>
            <div className={styles.title}>
              Notifications
              {unreadCount > 0 && (
                <span style={{ 
                  marginLeft: 8, 
                  background: '#ef4444', 
                  color: 'white', 
                  borderRadius: '50%', 
                  width: 20, 
                  height: 20, 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  fontSize: 12
                }}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </div>
            <div className={styles.actions}>
              <PermissionHint />
              {notifications.length > 0 && (
                <button 
                  className={styles.actionBtn} 
                  onClick={clearAll}
                  style={{ marginLeft: 8 }}
                >
                  Clear All
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                aria-label="Close notifications"
                style={{
                  marginLeft: 8,
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 18,
                  lineHeight: '1',
                  color: '#6b7280'
                }}
                title="Close"
              >
                &times;
              </button>
            </div>
          </div>

          <div className={styles.items}>
            {notifications.length === 0 ? (
              <div className={styles.empty}>No notifications yet</div>
            ) : (
              notifications.map((n) => (
                <div 
                  key={n.id} 
                  className={`${styles.item} ${n.read ? styles.read : styles.unread}`}
                  onClick={() => markAsRead(n.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className={styles.itemContent}>
                    <div className={styles.itemTitle}>
                      {n.title || "Notification"}
                      {!n.read && (
                        <span style={{
                          marginLeft: 8,
                          width: 8,
                          height: 8,
                          background: '#3b82f6',
                          borderRadius: '50%',
                          display: 'inline-block'
                        }}></span>
                      )}
                    </div>
                    <div className={styles.itemBody}>{n.body}</div>
                    <div className={styles.itemMeta}>
                      {n.type && (
                        <span className={styles.itemType} style={{
                          background: n.type.includes('reminder') ? '#fee2e2' : 
                                    n.type.includes('event') ? '#dbeafe' : '#f0f9ff',
                          color: n.type.includes('reminder') ? '#991b1b' : 
                                n.type.includes('event') ? '#1e40af' : '#0c4a6e',
                          padding: '2px 8px',
                          borderRadius: 12,
                          fontSize: 11,
                          marginRight: 8
                        }}>
                          {n.type}
                        </span>
                      )}
                      <span className={styles.itemTime}>
                        {n.timestamp ? new Date(n.timestamp).toLocaleTimeString([], { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        }) : 'Just now'}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          
          {notifications.length > 0 && (
            <div className={styles.dropdownFooter}>
              {/* <button 
                className={styles.markAllReadBtn}
                onClick={() => {
                  setNotifications(prev => {
                    const updated = prev.map(n => ({ ...n, read: true }));
                    try {
                      localStorage.setItem('auxin_notifications', JSON.stringify(updated));
                    } catch (e) {
                      console.warn('Failed to save notifications to localStorage:', e);
                    }
                    return updated;
                  });
                  setUnreadCount(0);
                }}
              >
                Mark All as Read
              </button> */}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default NotificationBell;