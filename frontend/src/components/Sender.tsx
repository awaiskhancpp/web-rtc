import { useEffect, useRef, useState } from "react"

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

    useEffect(()=>{
        const socket = new WebSocket("ws://localhost:8080")
        socketRef.current = socket;
        socket.onopen = () => {
            socket.send(JSON.stringify({ type: "sender" }))
        }
        socket.onmessage = async (event) =>{
            const message: Signaling = JSON.parse(event.data);
            if (message.type === "createAnswer" && message.receiverId) {
                const pc = pcMapRef.current.get(message.receiverId);
                if (pc && message.sdp) {
                await pc.setRemoteDescription(new RTCSessionDescription(message.sdp));
                console.log(`Set remote description for ${message.receiverId}`);
                }
            } else if (message.type === "iceCandidate" && message.receiverId && message.candidate) {
                const pc = pcMapRef.current.get(message.receiverId);
                if (pc) {
                await pc.addIceCandidate(new RTCIceCandidate(message.candidate));
                console.log(`Added ICE candidate from receiver ${message.receiverId}`);
                }
            }
        }
        return () => {
            socket.close();
            streamRef.current?.getTracks().forEach((t) => t.stop());
            pcMapRef.current.forEach((pc) => pc.close());
        };
    }, [])
    
    const start =async () =>{
        if (!socketRef.current) return;
        if (streamRef.current) {
            console.warn("Already started");
            return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        streamRef.current = stream;
        if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
        }
        console.log("Local stream started");

    }
    
    const connectToReceiver = async (receiverId: string) => {
  if (!socketRef.current || !streamRef.current) {
    console.warn("Socket or stream not ready");
    return;
  }

  const pc = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
  });

  pcMapRef.current.set(receiverId, pc);

  streamRef.current.getTracks().forEach((track) => {
    pc.addTrack(track, streamRef.current!);
  });

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      socketRef.current!.send(JSON.stringify({
        type: "iceCandidate",
        candidate: event.candidate,
        receiverId
      }));
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
    console.log(`Manual offer sent to ${receiverId}`);
  } catch (err) {
    console.error("Offer creation error:", err);
  }
};
  return (
    <div>
      <h1>Sender (Broadcaster)</h1>
      <button onClick={start}>Start Stream</button>
      <div>
        <video ref={localVideoRef} autoPlay muted playsInline style={{ width: 300 }} />
      </div>
      <div>
        <input type="text" id="recId" placeholder="Receiver ID" />
        <button onClick={() => {
          const rid = (document.getElementById("recId") as HTMLInputElement).value;
          if (rid) connectToReceiver(rid);
        }}>Connect to Receiver</button>
      </div>
      <div>
        <p>Active receivers: {Array.from(pcMapRef.current.keys()).join(", ")}</p>
      </div>
    </div>
  )
}


export default Sender;
