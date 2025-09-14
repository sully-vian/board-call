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
        rooms[roomID] = {
            participants: new Set([socket.id]),
            offer: offer
        };

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
        // exit if call full
        if (room.participants.size >= 2) {
            console.log("Failed to join: call full");
            return;
        }
        room.participants.add(socket.id);
        socket.emit("incoming-offer", room.offer);
    });

    socket.on("send-answer", (answer, roomID) => {
        // store callee's ID
        const room = rooms[roomID];
        if (!room) {
            console.log("Failed to join: unknown roomID:", roomID);
            return;
        }

        // relay to everyone else (only caller normally)
        for (const id of room.participants) {
            if (id !== socket.id) {
                io.to(id).emit("incoming-answer", answer);
                console.log("answering to:", id);
            }
        }
    });

    socket.on("ice-candidate", (candidate, roomID) => {
        const room = rooms[roomID];
        if (!room) {
            console.log("ICE candidate failed: unknown roomID:", roomID);
            return;
        }

        // relay to everyone else (only one normally)
        for (const id of room.participants) {
            if (id !== socket.id) {
                io.to(id).emit("ice-candidate", candidate);
            }
        }
    });

    socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id);
        numSockets--;
        console.log("number of sockets:", numSockets);

        for (const roomID in rooms) {
            const room = rooms[roomID];
            room.participants.delete(socket.id);
            if (room.participants.size == 0) {
                delete rooms[roomID];
                console.log("call empty, removing ", roomID);
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server accessible at http://localhost:${PORT}.`);
});
