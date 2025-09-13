const express = require("express");
const http = require("http");
const socketIo = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const rooms = {};
let numSockets = 0;

app.use(express.static("public"));

io.on("connection", (socket) => {
    console.log("User connected:", socket.id);
    numSockets++;
    console.log("number of sockets:", numSockets);

    socket.on("start-call", (offer) => {
        const roomID = crypto.randomUUID();

        // store room
        rooms[roomID] = { callerID: socket.id, offer: offer };

        // send back generated ID
        socket.emit("room-id", roomID);
        console.log("generated roomID:", roomID);
    });

    socket.on("join-call", (roomID) => {
        const room = rooms[roomID];
        // exit if non-existing
        if (!room) {
            console.log("Failed to join: unknown roomID:", roomID);
            return;
        }
        // exit if already connected
        if (room.calleeID && room.calleeID != socket.id) {
            console.log("Failed to join: call full");
            return;
        }
        socket.emit("incoming-offer", room.offer);
    });

    socket.on("send-answer", (answer, roomID) => {
        // store callee's ID
        const room = rooms[roomID];
        room.calleeID = socket.id;

        // relay to caller
        const callerID = room.callerID;
        io.to(callerID).emit("incoming-answer", answer);
        console.log("answering to:", callerID);
    });

    socket.on("ice-candidate", (candidate, roomID) => {
        const room = rooms[roomID];
        if (!room) {
            console.log("ICE candidate faile: unknown roomID:", roomID);
            return;
        }
        const callerID = room.callerID;
        const calleeID = room.calleeID;
        // forward to other peer
        if (socket.id == callerID) {
            io.to(calleeID).emit("ice-candidate", candidate);
        } else if (socket.id == calleeID) {
            io.to(callerID).emit("ice-candidate", candidate);
        } else {
            console.log("socket id is neither caller nor callee")
        }
    });

    socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id);
        numSockets--;
        console.log("number of sockets:", numSockets);

        for (const roomID in rooms) {
            const room = rooms[roomID];
            if (room.callerID === socket.id || room.calleeID === socket.id) {
                delete rooms[roomID];
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server accessible at http://localhost:${PORT}.`);
});
