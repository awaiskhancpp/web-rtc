import { useEffect, useRef, useState } from "react";

type Signaling = {
  type: string;
  sdp?: any;
  candidate?: any;
  receiverId?: string;
};

const Sender = () => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pcMapRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const [isStreaming, setIsStreaming] = useState(false);
  const [socketState, setSocketState] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const [receiverInput, setReceiverInput] = useState("");

  useEffect(() => {
    const socket = new WebSocket("ws://localhost:8080");
    socketRef.current = socket;
    
    socket.onopen = () => {
      console.log("WebSocket connected, registering as sender");
      setSocketState("connected");
      socket.send(JSON.stringify({ type: "sender" }));
    };
    
    socket.onerror = (error) => {
      console.error("WebSocket error:", error);
      setSocketState("disconnected");
    };
    
    socket.onclose = () => {
      console.log("WebSocket disconnected");
      setSocketState("disconnected");
    };
    
    socket.onmessage = async (event) => {
      const message: Signaling = JSON.parse(event.data);
      console.log("Received message:", message.type, message.receiverId);
      
      if (message.type === "createAnswer" && message.receiverId) {
        const pc = pcMapRef.current.get(message.receiverId);
        if (pc && message.sdp) {
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(message.sdp));
            console.log(`Set remote description for ${message.receiverId}`);
          } catch (error) {
            console.error("Error setting remote description:", error);
          }
        }
      } else if (message.type === "iceCandidate" && message.receiverId && message.candidate) {
        const pc = pcMapRef.current.get(message.receiverId);
        if (pc) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(message.candidate));
            console.log(`Added ICE candidate from receiver ${message.receiverId}`);
          } catch (error) {
            console.error("Error adding ICE candidate:", error);
          }
        }
      }
    };
    
    return () => {
      socket.close();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      pcMapRef.current.forEach((pc) => pc.close());
    };
  }, []);

  const start = async () => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      alert("WebSocket not connected. Please wait and try again.");
      return;
    }
    
    if (streamRef.current) {
      console.warn("Already streaming");
      return;
    }
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: false 
      });
      streamRef.current = stream;
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      
      setIsStreaming(true);
      console.log("Local stream started");
    } catch (error) {
      console.error("Error accessing media devices:", error);
      alert("Failed to access camera. Please check permissions.");
    }
  };

  const stop = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
      }
      
      // Close all peer connections
      pcMapRef.current.forEach((pc) => pc.close());
      pcMapRef.current.clear();
      
      setIsStreaming(false);
      console.log("Stream stopped");
    }
  };

  const connectToReceiver = async (receiverId: string) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      alert("WebSocket not connected");
      return;
    }
    
    if (!streamRef.current) {
      alert("Please start the stream first");
      return;
    }
    
    // Check if already connected to this receiver
    if (pcMapRef.current.has(receiverId)) {
      console.warn(`Already connected to receiver ${receiverId}`);
      return;
    }

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    });

    pcMapRef.current.set(receiverId, pc);

    // Add tracks to peer connection
    streamRef.current.getTracks().forEach((track) => {
      pc.addTrack(track, streamRef.current!);
      console.log(`Added ${track.kind} track to peer connection`);
    });

    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({
          type: "iceCandidate",
          candidate: event.candidate,
          receiverId
        }));
        console.log("Sent ICE candidate to receiver");
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`Connection ${receiverId} state:`, pc.connectionState);
      if (["disconnected", "failed", "closed"].includes(pc.connectionState)) {
        pcMapRef.current.delete(receiverId);
        pc.close();
      }
    };

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      socketRef.current.send(JSON.stringify({
        type: "createOffer",
        sdp: pc.localDescription,
        receiverId
      }));
      
      console.log(`Offer sent to ${receiverId}`);
      setReceiverInput(""); // Clear input after successful connection
    } catch (err) {
      console.error("Offer creation error:", err);
      pcMapRef.current.delete(receiverId);
      pc.close();
      alert("Failed to connect to receiver");
    }
  };

  const disconnectReceiver = (receiverId: string) => {
    const pc = pcMapRef.current.get(receiverId);
    if (pc) {
      pc.close();
      pcMapRef.current.delete(receiverId);
      console.log(`Disconnected from receiver ${receiverId}`);
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <h1>Sender (Broadcaster)</h1>
      
      <div style={{ marginBottom: "20px" }}>
        <p>WebSocket: {socketState === "connected" ? "🟢 Connected" : socketState === "connecting" ? "🟡 Connecting..." : "🔴 Disconnected"}</p>
        <p>Stream: {isStreaming ? "🟢 Broadcasting" : "🔴 Not Broadcasting"}</p>
      </div>
      
      <div style={{ marginBottom: "20px" }}>
        {!isStreaming ? (
          <button onClick={start} disabled={socketState !== "connected"}>
            Start Stream
          </button>
        ) : (
          <button onClick={stop}>Stop Stream</button>
        )}
      </div>
      
      <div style={{ marginBottom: "20px" }}>
        <video 
          ref={localVideoRef} 
          autoPlay 
          muted 
          playsInline 
          style={{ 
            width: "100%", 
            maxWidth: "600px", 
            backgroundColor: "#000" 
          }} 
        />
      </div>
      
      <div style={{ marginBottom: "20px" }}>
        <input 
          type="text" 
          value={receiverInput}
          onChange={(e) => setReceiverInput(e.target.value)}
          placeholder="Enter Receiver ID" 
          style={{ marginRight: "10px", padding: "5px" }}
        />
        <button 
          onClick={() => {
            if (receiverInput.trim()) {
              connectToReceiver(receiverInput.trim());
            }
          }}
          disabled={!isStreaming || socketState !== "connected"}
        >
          Connect to Receiver
        </button>
      </div>
      
      <div>
        <h3>Active Receivers:</h3>
        {Array.from(pcMapRef.current.keys()).length === 0 ? (
          <p>No receivers connected</p>
        ) : (
          <ul>
            {Array.from(pcMapRef.current.keys()).map((receiverId) => (
              <li key={receiverId}>
                {receiverId} 
                <button 
                  onClick={() => disconnectReceiver(receiverId)}
                  style={{ marginLeft: "10px", fontSize: "12px" }}
                >
                  Disconnect
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default Sender;