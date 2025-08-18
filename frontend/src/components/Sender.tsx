import { useEffect, useRef, useState } from "react"

const Sender = () => {
    const [socket, setSocket] = useState<WebSocket | null>(null)
    const localVideoRef = useRef<HTMLVideoElement>(null);
    useEffect(()=>{
        const socket = new WebSocket("ws://localhost:8080")
        socket.onopen = () => {
            socket.send(JSON.stringify({ type: "sender" }))
        }
        setSocket(socket)
        
    }, [])
    const startSendingVideo =async () =>{
        if (!socket) return;
        //create an instance of RTC peer Connection
        const pc = new RTCPeerConnection();
        pc.onnegotiationneeded = async () => {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            
            pc.onicecandidate = (event) => {
                if(event.candidate){
                    socket.send(JSON.stringify({ type: "iceCandidate", candidate: event.candidate }));
                }
            }

            socket?.send(JSON.stringify({ type: "createOffer", sdp : pc.localDescription }));
        };
        socket.onmessage = async (event) => {
            const data = JSON.parse(event.data);
            if (data.type === "createAnswer") {
                await pc.setRemoteDescription(data.sdp);
            } else if (data.type === "iceCandidate") {
                await pc.addIceCandidate(data.candidate);
            }
        }
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false});
        // stream.getTracks().forEach(track => pc.addTrack(track, stream));
        if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
        }
        pc.addTrack(stream.getVideoTracks()[0]);
    }

  return (
    <div>
      <h1>Sender</h1>
      <button onClick={startSendingVideo}>Send Video</button>
      <video ref={localVideoRef} autoPlay playsInline muted />
    </div>
  )
}

export default Sender
