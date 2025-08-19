import { useEffect, useRef } from "react"


const Receiver = () => {
    const videoRef = useRef<HTMLVideoElement>(null);
    useEffect(()=>{
            const socket = new WebSocket("ws://localhost:8080")
            let pc = new RTCPeerConnection();
            
            socket.onopen = () => {
                socket.send(JSON.stringify({ type: "receiver" }))
            }

            pc.onicecandidate = (event) => {
                if (event.candidate) {
                    socket?.send(JSON.stringify({ type: "iceCandidate", candidate: event.candidate }));
                }
            };
            pc.ontrack = (event)=>{
                const video = document.createElement('video')
                video.srcObject = new MediaStream([event.track]);
                video.autoplay = true;
                document.body.appendChild(video);
                // Ensure the video plays automatically
                video.play()
            }
            
            
            socket.onmessage = async (event)=>{

                const message = JSON.parse(event.data);
                
                if(message.type === "createOffer"){
                    await pc.setRemoteDescription(message.sdp);
                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);
                    
                    socket?.send(JSON.stringify({ type: "createAnswer", sdp: pc.localDescription }));
                    
                    
                    
                }
                else if(message.type === "iceCandidate"){
                    if(pc && message.candidate){
                        await pc.addIceCandidate(message.candidate);
                        
                    }
                }
                
            }
            
        }, [])
  return (
    <div>
      <h1>Receiver</h1>
      <video ref={videoRef} autoPlay muted ></video>
    </div>
  )
}

export default Receiver
