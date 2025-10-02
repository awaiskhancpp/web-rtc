import { WebSocketServer, WebSocket } from "ws";

const wss = new WebSocketServer({ port: 8080 });

let senderSocket : null | WebSocket = null;
const receivers = new Map<string, WebSocket>();

wss.on("connection",(ws)=>{
    ws.on("error",console.error);
    ws.on("close",()=>{
        for(const [rid, sock] of receivers){
            if (sock === ws) {
                receivers.delete(rid);
                console.log(`Receiver ${rid} disconnected`);
                break;
            }
        }
        if(ws === senderSocket){
            senderSocket = null;
            console.log("Sender disconnected, closing all receiver connections");
        }
    })
    ws.on("message",(data:any)=>{
        const message =JSON.parse(data);
        if(message.type === "sender") {
            senderSocket = ws;
            console.log("Sender connected");
        } else if (message.type === "receiver") {
            const { receiverId } = message;
            if (!receiverId) {
                console.warn("Receiver connected without receiverId");
                return;
            }
            receivers.set(receiverId, ws);
        }else if (message.type === "createOffer"){
            const { receiverId, sdp } = message;
            const recSock = receivers.get(receiverId);
            if(ws === senderSocket && recSock){
                recSock.send(JSON.stringify({
                    type: "createOffer",
                    sdp,
                    receiverId
                    }));
            }
            console.log(`Forwarded offer to receiver ${receiverId}`);
        }else if(message.type === "createAnswer"){
            const { receiverId, sdp } = message;
            const recSock = receivers.get(receiverId);
            if (recSock && ws === recSock && senderSocket) {
                senderSocket.send(JSON.stringify({ type: "createAnswer", sdp, receiverId }));
                console.log(`Forwarded answer from ${receiverId} to sender`);
            }
            console.log(`Forwarded answer from ${receiverId} to sender`);
        }else if(message.type === "iceCandidate"){
            const { receiverId, candidate } = message;
            if(ws === senderSocket){
                const recSock = receivers.get(receiverId);
        recSock?.send(JSON.stringify({
             type: "iceCandidate",
             candidate,
             receiverId
            }));
            console.log(`Sender ICE → receiver ${receiverId}`);
                
            }else{
                if(senderSocket){
                    senderSocket.send(JSON.stringify({
                        type: "iceCandidate",
                        candidate,
                        receiverId
                    }));
                    console.log(`Receiver ${receiverId} ICE → sender`);
                }
            }
        }
    });
    console.log("WebSocket signaling server running on port 8080");
})