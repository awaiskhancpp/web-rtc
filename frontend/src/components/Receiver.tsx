import { useEffect, useRef , useState } from "react"

type Signaling = {
  type: string;
  sdp?: any;
  candidate?: any;
  receiverId?: string;
};

const Receiver = () => {
    const videoRef = useRef<HTMLVideoElement>(null);
  const [isConnected, setIsConnected] = useState(false);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const receiverId = useRef(`receiver-${Math.floor(Math.random() * 1e9)}`);

    useEffect(()=>{
            const socket = new WebSocket("ws://localhost:8080")
            socketRef.current = socket;
            let pc = new RTCPeerConnection({
                iceServers: [
                    { urls: "stun:stun.l.google.com:19302" }
                ]
            });
            pcRef.current = pc;
            socket.onopen = () => {
                socket.send(JSON.stringify({ type: "receiver", receiverId: receiverId.current }))
            }

            pc.onicecandidate = (event) => {
                if (event.candidate) {
                    socket.send(JSON.stringify({
                        type: "iceCandidate",
                        candidate: event.candidate,
                        receiverId: receiverId.current
                    }));
                }
            };
            pc.ontrack = (event)=>{
                if(videoRef.current){
                    if (!videoRef.current.srcObject) {
                        videoRef.current.srcObject = event.streams[0];
                    } else {
                        // Add track to existing stream
                        const stream = videoRef.current.srcObject as MediaStream;
                        event.track && stream.addTrack(event.track);
                    }
                    setIsConnected(true);
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
            
            socket.onmessage = async (event)=>{

                const message : Signaling = JSON.parse(event.data);
                
                if(message.type === "createOffer" && message.sdp){
                   try{
                     await pc.setRemoteDescription(new RTCSessionDescription(message.sdp));
                     const answer = await pc.createAnswer();
                     await pc.setLocalDescription(answer);
                    
                     socket.send(JSON.stringify({
                        type: "createAnswer",
                        sdp: pc.localDescription,
                        receiverId: receiverId.current
                     }));
                   }catch(err){
                    console.error("Error handling createOffer:", err);
                   } 
                }
                else if(message.type === "iceCandidate" && message.candidate){
                    try {
                        await pc.addIceCandidate(new RTCIceCandidate(message.candidate));
                    } catch (error) {
                        console.error("Error adding ICE candidate:", error);
                    }
                }
                
            }
            return () => {
            pc.close();
            socket.close();
            console.log("Receiver cleanup completed");
        };
            
        }, [])
  return (
    <div>
      <h1>Receiver ‑ {receiverId.current}</h1>
      <p>Status: {isConnected ? "🟢 Connected" : "🔴 Waiting..."}</p>
      <video ref={videoRef} autoPlay playsInline style={{ width: 300 }} />
    </div>
  )
}

export default Receiver
