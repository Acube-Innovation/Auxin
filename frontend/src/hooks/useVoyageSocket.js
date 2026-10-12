import { useEffect, useRef } from "react";
import { io as ioClient } from "socket.io-client";
import config from "../config/config";

// Live updates for an open voyage workspace: joins room voyage-<id> and calls onChange(event, payload)
// when someone changes the voyage ('ops-voyage-updated') or due dates move ('ops-dates-changed').
export default function useVoyageSocket(voyageId, onChange) {
  const handler = useRef(onChange);
  useEffect(() => { handler.current = onChange; }, [onChange]);

  useEffect(() => {
    if (!voyageId) return undefined;
    const url = (config.API_BASE_URL || "").replace(/\/api\/?$/, "") || window.location.origin;
    const socket = ioClient(url, { path: "/socket.io", transports: ["websocket", "polling"], reconnection: true });
    socket.on("connect", () => socket.emit("join-voyage", voyageId));
    socket.on("ops-voyage-updated", (p) => handler.current && handler.current("ops-voyage-updated", p));
    socket.on("ops-dates-changed", (p) => handler.current && handler.current("ops-dates-changed", p));
    return () => {
      socket.emit("leave-voyage", voyageId);
      socket.disconnect();
    };
  }, [voyageId]);
}
