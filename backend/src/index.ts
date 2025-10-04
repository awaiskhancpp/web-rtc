import { WebSocketServer, WebSocket } from "ws";

const wss = new WebSocketServer({ port: 8080 });

let senderSocket: WebSocket | null = null;
const receivers = new Map();

console.log("WebSocket signaling server running on port 8080");

wss.on("connection", (ws) => {
    ws.on("error", console.error);
    
    ws.on("close", () => {
        // Check if it's a receiver disconnecting
        for (const [rid, sock] of receivers) {
            if (sock === ws) {
                receivers.delete(rid);
                console.log(`Receiver ${rid} disconnected`);
                break;
            }
        }
        
        // Check if it's the sender disconnecting
        if (ws === senderSocket) {
            senderSocket = null;
            console.log("Sender disconnected");
            
            // Notify all receivers that sender disconnected
            receivers.forEach((receiverSocket) => {
                receiverSocket.send(JSON.stringify({
                    type: "senderDisconnected"
                }));
            });
        }
    });
    
    ws.on("message", (data:any) => {
        const message = JSON.parse(data);
        
        switch (message.type) {
            case "sender":
                senderSocket = ws;
                console.log("Sender connected");
                break;
                
            case "receiver":
                const { receiverId } = message;
                if (!receiverId) {
                    console.warn("Receiver connected without receiverId");
                    return;
                }
                receivers.set(receiverId, ws);
                console.log(`Receiver ${receiverId} connected`);
                break;
                
            case "createOffer":
                if (ws === senderSocket && message.receiverId) {
                    const recSock = receivers.get(message.receiverId);
                    if (recSock) {
                        recSock.send(JSON.stringify({
                            type: "createOffer",
                            sdp: message.sdp,
                            receiverId: message.receiverId
                        }));
                        console.log(`Forwarded offer to receiver ${message.receiverId}`);
                    } else {
                        console.warn(`Receiver ${message.receiverId} not found`);
                    }
                }
                break;
                
            case "createAnswer":
                const answererSocket = receivers.get(message.receiverId);
                if (ws === answererSocket && senderSocket) {
                    senderSocket.send(JSON.stringify({
                        type: "createAnswer",
                        sdp: message.sdp,
                        receiverId: message.receiverId
                    }));
                    console.log(`Forwarded answer from ${message.receiverId} to sender`);
                }
                break;
                
            case "iceCandidate":
                if (ws === senderSocket && message.receiverId) {
                    // ICE candidate from sender to specific receiver
                    const recSock = receivers.get(message.receiverId);
                    if (recSock) {
                        recSock.send(JSON.stringify({
                            type: "iceCandidate",
                            candidate: message.candidate,
                            receiverId: message.receiverId
                        }));
                        console.log(`Sender ICE → receiver ${message.receiverId}`);
                    }
                } else {
                    // ICE candidate from receiver to sender
                    if (senderSocket && message.receiverId) {
                        senderSocket.send(JSON.stringify({
                            type: "iceCandidate",
                            candidate: message.candidate,
                            receiverId: message.receiverId
                        }));
                        console.log(`Receiver ${message.receiverId} ICE → sender`);
                    }
                }
                break;
                
            default:
                console.warn(`Unknown message type: ${message.type}`);
        }
    });
});