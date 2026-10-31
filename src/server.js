// server.js
// handles accounts and game rooms. Every player's browser connects to this.
// we will use socket.io to send messages between the players and the server, and express to serve the HTML/CSS/JS files to the browser.

const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = 3000; // lowk u can use anyport

// send everything in the "public" folder to the browser
app.use(express.static(path.join(__dirname, "..", "public")));

// username -> password (only saved while the server is running)
let accounts = {};

// room name -> list of the socket ids in that room
let rooms = {};

io.on("connection", function (socket) {
    console.log("A player connected");

    let username = "";    // empty until they log in
    let currentRoom = ""; // empty when they are not in a room

    // create account feature no need for email and such lol 

    socket.on("createAccount", function (data) {
        if (accounts[data.username] !== undefined) {
            socket.emit("accountMessage", "That username is already taken"); // this just sends a message back to the client .emit
            return;
        }

        accounts[data.username] = data.password;
        console.log("Account created: " + data.username);
        socket.emit("accountMessage", "Account created! You can log in now.");
    });

    socket.on("login", function (data) {
        if (accounts[data.username] !== data.password) {
            socket.emit("accountMessage", "Wrong username or password");
            return;
        }

        username = data.username;
        console.log(username + " logged in");
        socket.emit("loginSuccess", username);
    });

    // this is the game rooms logic

    socket.on("joinRoom", function (roomName) {
        if (username === "") return;    // must be logged in
        if (currentRoom !== "") return; // already in a room

        if (rooms[roomName] === undefined) {
            // room doesn't exist yet, so make it and wait
            rooms[roomName] = [socket.id];
            socket.join(roomName);
            currentRoom = roomName;
            console.log(username + " created room " + roomName);
            socket.emit("waitingForOpponent", roomName);
        } else if (rooms[roomName].length === 1) {
            // room has one player waiting, so join and start the match
            rooms[roomName].push(socket.id); // get the socket id of the player who just joined
            socket.join(roomName);
            currentRoom = roomName;
            console.log(username + " joined room " + roomName);
            io.to(roomName).emit("matchStarted", roomName);
        } else {
            socket.emit("lobbyMessage", "That room is full");
        }
    });

    socket.on("leaveRoom", function () {
        leaveCurrentRoom();
    });

    // send a message to the other player in the room only
    socket.on("sendToOpponent", function () {
        if (currentRoom === "") return;
        socket.to(currentRoom).emit("opponentMessage", username + " pressed the button!");
    });

    socket.on("disconnect", function () {
        console.log("A player disconnected");
        leaveCurrentRoom();
    });

    function leaveCurrentRoom() {
        if (currentRoom === "") return;

        let players = rooms[currentRoom];
        players.splice(players.indexOf(socket.id), 1);
        socket.leave(currentRoom);
        console.log(username + " left room " + currentRoom);

        if (players.length === 0) {
            delete rooms[currentRoom]; // nobody left, remove the room
        } else {
            io.to(currentRoom).emit("opponentLeft"); // tell the other player
        }

        currentRoom = "";
    }
});

server.listen(PORT, function () {
    console.log("Server running at http://localhost:" + PORT);
});

// notes!!!!! io.to and socket.to are different. io.to sends to everyone in the room including the sender, while socket.to sends to everyone in the room except the sender.
// so basically like the leave function, the opponent left which is the sender, and then it gets send to everyone in the room which is the opponent