import { useEffect, useRef, useState } from "react"


const Receiver = () => {
    const [socket, setSocket] = useState<WebSocket | null>(null)
    const videoRef = useRef<HTMLVideoElement>(null);
    useEffect(()=>{
            const socket = new WebSocket("ws://localhost:8080")

            socket.onopen = () => {
                socket.send(JSON.stringify({ type: "receiver" }))
            }
            setSocket(socket)
            let pc = new RTCPeerConnection();
            socket.onmessage = async (event)=>{

                const message = JSON.parse(event.data);
                
                if(message.type === "createOffer"){
                    pc.setRemoteDescription(message.sdp);
                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);
                    socket?.send(JSON.stringify({ type: "createAnswer", sdp: pc.localDescription }));
                }
                
            }
            pc.onicecandidate = (event) => {
                if (event.candidate) {
                    socket?.send(JSON.stringify({ type: "iceCandidate", candidate: event.candidate }));
                }
            };
            pc.ontrack = (event)=>{
                console.log("Track Received")
                if(videoRef.current?.srcObject==new MediaStream([event.track])){
                videoRef.current.play();
                }
            }
            
        }, [])
  return (
    <div>
      <h1>Receiver</h1>
      <video autoPlay playsInline muted style={{ width: '500px', height: 'auto' }} ref={videoRef}></video>
    </div>
  )
}

export default Receiver
