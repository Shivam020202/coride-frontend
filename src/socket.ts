import { io, Socket } from "socket.io-client";

const apiUrl =
  import.meta.env.VITE_API_URL?.replace("/api", "") || "http://localhost:5000";

const socket: Socket = io(apiUrl, {
  autoConnect: true,
});

export default socket;
