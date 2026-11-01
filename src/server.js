// server.js
// handles accounts, game rooms, and the tic tac toe games inside them. Every player's browser connects to this.
// we will use socket.io to send messages between the players and the server, and express to serve the HTML/CSS/JS files to the browser.
// the server keeps the real board, so players can't cheat.

// IMPORTANT INITIALIZATION STUFF!
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

// room name -> { players, spectators, board, turn, winner }
// each player is { id, name, mark }
// spectators is a list of socket ids (they can only watch)
let rooms = {};

// all the ways to win
const winLines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
    [0, 4, 8], [2, 4, 6]             // diagonals
];

// game helpers

function resetGame(room) {
    room.board = ["", "", "", "", "", "", "", "", ""];
    room.turn = "X";
    room.winner = ""; // "", "X", "O" or "draw"
}

function checkWinner(board) {
    for (let lineIndex = 0; lineIndex < winLines.length; lineIndex++) {
        const first = winLines[lineIndex][0];
        const second = winLines[lineIndex][1];
        const third = winLines[lineIndex][2];

        if (board[first] !== "" && board[first] === board[second] && board[second] === board[third]) {
            return board[first];
        }
    }

    if (!board.includes("")) {
        return "draw";
    }

    return "";
}

// send the current game to both players in the room
function sendGame(roomName) {
    const room = rooms[roomName];

    io.to(roomName).emit("gameUpdate", {
        board: room.board,
        turn: room.turn,
        winner: room.winner
    });
}

// tell everyone watching a room who is playing in it
function sendSpectatorInfo(roomName) {
    const room = rooms[roomName];

    const playerNames = room.players.map(function (roomPlayer) {
        return roomPlayer.name + " (" + roomPlayer.mark + ")";
    });

    room.spectators.forEach(function (spectatorId) {
        io.to(spectatorId).emit("spectating", {
            roomName: roomName,
            players: playerNames
        });
    });
}

io.on("connection", function (socket) {
    console.log("A player connected");

    let username = "";    // empty until they log in
    let isSpectator = false; // true when watching instead of playing
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

        const room = rooms[roomName];

        if (room === undefined) {
            // room doesn't exist yet, so make it and wait (creator plays X)
            rooms[roomName] = {
                players: [{ id: socket.id, name: username, mark: "X" }],
                spectators: []
            };
            resetGame(rooms[roomName]);

            socket.join(roomName);
            currentRoom = roomName;
            console.log(username + " created room " + roomName);
            socket.emit("waitingForOpponent", roomName);
        } else if (room.players.length === 1) {
            // one player is waiting, so join with the other mark and start
            const firstPlayer = room.players[0];
            const myMark = firstPlayer.mark === "X" ? "O" : "X";

            room.players.push({ id: socket.id, name: username, mark: myMark }); // get the socket id of the player who just joined
            resetGame(room);

            socket.join(roomName);
            currentRoom = roomName;
            console.log(username + " joined room " + roomName);

            // tell each player their mark and who they are playing against
            io.to(firstPlayer.id).emit("matchStarted", {
                roomName: roomName,
                myMark: firstPlayer.mark,
                opponent: username
            });
            socket.emit("matchStarted", {
                roomName: roomName,
                myMark: myMark,
                opponent: firstPlayer.name
            });

            sendSpectatorInfo(roomName); // let anyone watching know who is playing
            sendGame(roomName);
        } else {
            // room already has two players, so join as a spectator
            room.spectators.push(socket.id);
            isSpectator = true;

            socket.join(roomName);
            currentRoom = roomName;
            console.log(username + " is watching room " + roomName);

            sendSpectatorInfo(roomName);
            sendGame(roomName);
        }
    });

    socket.on("leaveRoom", function () {
        leaveCurrentRoom();
    });

    // tic tac toe

    socket.on("makeMove", function (index) {
        const room = rooms[currentRoom];
        if (room === undefined) return;
        if (room.players.length < 2) return; // no opponent yet
        if (room.winner !== "") return;      // game is over

        const player = room.players.find(function (roomPlayer) {
            return roomPlayer.id === socket.id;
        });

        if (player === undefined) return;                         // spectators can't play
        if (player.mark !== room.turn) return;                    // not your turn
        if (!Number.isInteger(index) || index < 0 || index > 8) return; // bad square
        if (room.board[index] !== "") return;                     // square taken

        room.board[index] = player.mark;
        room.winner = checkWinner(room.board);

        if (room.winner === "") {
            room.turn = room.turn === "X" ? "O" : "X";
        }

        sendGame(currentRoom);
    });

    socket.on("rematch", function () {
        const room = rooms[currentRoom];
        if (room === undefined) return;
        if (room.winner === "") return; // only after a game ends
        if (isSpectator) return;        // spectators can't start a rematch

        resetGame(room);
        sendGame(currentRoom);
    });

    socket.on("disconnect", function () {
        console.log("A player disconnected");
        leaveCurrentRoom();
    });

    function leaveCurrentRoom() {
        if (currentRoom === "") return;

        const room = rooms[currentRoom];

        // the room was already closed, or this person was only watching
        if (room === undefined || isSpectator) {
            if (room !== undefined) {
                room.spectators = room.spectators.filter(function (spectatorId) {
                    return spectatorId !== socket.id;
                });
            }

            socket.leave(currentRoom);
            console.log(username + " stopped watching room " + currentRoom);
            isSpectator = false;
            currentRoom = "";
            return;
        }

        room.players = room.players.filter(function (roomPlayer) {
            return roomPlayer.id !== socket.id;
        });

        socket.leave(currentRoom);
        console.log(username + " left room " + currentRoom);

        if (room.players.length === 0) {
            io.to(currentRoom).emit("roomClosed"); // send the spectators back to the lobby
            delete rooms[currentRoom]; // nobody left, remove the room
        } else {
            resetGame(room);
            io.to(room.players[0].id).emit("opponentLeft"); // tell the other player
            sendSpectatorInfo(currentRoom);                   // tell the spectators
            sendGame(currentRoom);
        }

        currentRoom = "";
    }
});

server.listen(PORT, function () {
    console.log("Server running at http://localhost:" + PORT);
});

// notes!!!!! io.to and socket.to are different. io.to sends to everyone in the room including the sender, while socket.to sends to everyone in the room except the sender.
// so basically like the leave function, the opponent left which is the sender, and then it gets send to everyone in the room which is the opponent