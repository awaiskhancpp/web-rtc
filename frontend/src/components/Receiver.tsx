import { useEffect, useRef, useState } from "react";

type Signaling = {
  type: string;
  sdp?: any;
  candidate?: any;
  receiverId?: string;
};

const Receiver = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [socketState, setSocketState] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const receiverId = useRef(`receiver-${Math.floor(Math.random() * 1e9)}`);

  useEffect(() => {
    const socket = new WebSocket("ws://localhost:8080");
    socketRef.current = socket;
    
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" }
      ]
    });
    pcRef.current = pc;

    socket.onopen = () => {
      console.log("WebSocket connected, registering as receiver:", receiverId.current);
      setSocketState("connected");
      socket.send(JSON.stringify({ 
        type: "receiver", 
        receiverId: receiverId.current 
      }));
    };

    socket.onerror = (error) => {
      console.error("WebSocket error:", error);
      setSocketState("disconnected");
    };

    socket.onclose = () => {
      console.log("WebSocket disconnected");
      setSocketState("disconnected");
      setIsConnected(false);
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
          type: "iceCandidate",
          candidate: event.candidate,
          receiverId: receiverId.current
        }));
        console.log("Sent ICE candidate to sender");
      }
    };

    pc.ontrack = (event) => {
      console.log("Received track:", event.track.kind);
      if (videoRef.current && event.streams[0]) {
        videoRef.current.srcObject = event.streams[0];
        console.log("Video stream attached to element");
      }
    };

    pc.onconnectionstatechange = () => {
      console.log("Connection state:", pc.connectionState);
      if (pc.connectionState === "connected") {
        setIsConnected(true);
      } else if (["disconnected", "failed", "closed"].includes(pc.connectionState)) {
        setIsConnected(false);
      }
    };

    socket.onmessage = async (event) => {
      const message: Signaling = JSON.parse(event.data);
      console.log("Received message:", message.type);

      switch (message.type) {
        case "createOffer":
          if (message.sdp) {
            try {
              console.log("Setting remote description (offer)");
              await pc.setRemoteDescription(new RTCSessionDescription(message.sdp));
              
              console.log("Creating answer");
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              
              socket.send(JSON.stringify({
                type: "createAnswer",
                sdp: pc.localDescription,
                receiverId: receiverId.current
              }));
              console.log("Answer sent to sender");
            } catch (err) {
              console.error("Error handling createOffer:", err);
            }
          }
          break;
          
        case "iceCandidate":
          if (message.candidate) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(message.candidate));
              console.log("Added ICE candidate from sender");
            } catch (error) {
              console.error("Error adding ICE candidate:", error);
            }
          }
          break;
          
        case "senderDisconnected":
          console.log("Sender disconnected");
          setIsConnected(false);
          if (videoRef.current) {
            videoRef.current.srcObject = null;
          }
          break;
          
        default:
          console.warn("Unknown message type:", message.type);
      }
    };

    return () => {
      pc.close();
      socket.close();
      console.log("Receiver cleanup completed");
    };
  }, []);

  return (
    <div style={{ padding: "20px" }}>
      <h1>Receiver - {receiverId.current}</h1>
      <div>
        <p>WebSocket: {socketState === "connected" ? "🟢 Connected" : socketState === "connecting" ? "🟡 Connecting..." : "🔴 Disconnected"}</p>
        <p>Stream: {isConnected ? "🟢 Connected" : "🔴 Waiting..."}</p>
      </div>
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        style={{ 
          width: "100%", 
          maxWidth: "600px", 
          backgroundColor: "#000",
          marginTop: "10px"
        }} 
      />
      <div style={{ marginTop: "10px", fontSize: "14px", color: "#666" }}>
        <p>Copy this ID and paste it in the Sender to connect: <strong>{receiverId.current}</strong></p>
      </div>
    </div>
  );
};

export default Receiver;