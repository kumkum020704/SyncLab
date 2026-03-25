import { io } from "socket.io-client";

export const initSocket = async () => {
  return io("http://localhost:5000", {
    forceNew: true,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    timeout: 20000,
  });
};