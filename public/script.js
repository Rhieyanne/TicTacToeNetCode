// script.js
// Runs in the browser. Shows the right screen and talks to the server.

const socket = io(); // connect to the server

// game state

const STATES = {
    LOGIN: "login",
    LOBBY: "lobby",
    WAITING: "waiting",
    PLAYING: "playing",
    SPECTATING: "spectating"
};

let currentState = "";

const screens = {
    [STATES.LOGIN]: document.getElementById("login-screen"),
    [STATES.LOBBY]: document.getElementById("lobby-screen"),
    [STATES.WAITING]: document.getElementById("waiting-screen"),
    [STATES.PLAYING]: document.getElementById("playing-screen"),
    [STATES.SPECTATING]: document.getElementById("playing-screen") // same board, but no control
};

const stateLabel = document.getElementById("state-label");

// the ONLY place the state is allowed to change
function changeState(newState) {
    if (!screens[newState]) {
        console.warn("Unknown state: " + newState);
        return;
    }

    console.log("State changed: " + currentState + " -> " + newState);
    currentState = newState;

    for (const name in screens) {
        screens[name].classList.add("hidden");
    }

    screens[newState].classList.remove("hidden");
    stateLabel.textContent = "Current state: " + newState;
}

// login screen

const usernameInput = document.getElementById("username-input");
const passwordInput = document.getElementById("password-input");
const loginMessage = document.getElementById("login-message");
const welcomeText = document.getElementById("welcome-text");

function sendAccountRequest(type) {
    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    if (username === "" || password === "") {
        loginMessage.textContent = "Please fill in both boxes";
        return;
    }

    socket.emit(type, { username: username, password: password });
}

document.getElementById("login-button").addEventListener("click", function () {
    sendAccountRequest("login");
});

document.getElementById("create-button").addEventListener("click", function () {
    sendAccountRequest("createAccount");
});

socket.on("accountMessage", function (message) {
    loginMessage.textContent = message;
});

socket.on("loginSuccess", function (username) {
    welcomeText.textContent = "Welcome, " + username + "!";
    changeState(STATES.LOBBY);
});

// lobby screen

const roomInput = document.getElementById("room-input");
const lobbyMessage = document.getElementById("lobby-message");

document.getElementById("join-button").addEventListener("click", function () {
    const roomName = roomInput.value.trim();

    if (roomName === "") {
        lobbyMessage.textContent = "Please type a room name";
        return;
    }

    socket.emit("joinRoom", roomName);
});

socket.on("lobbyMessage", function (message) {
    lobbyMessage.textContent = message;
});

// waiting screen

const waitingText = document.getElementById("waiting-text");

socket.on("waitingForOpponent", function (roomName) {
    waitingText.textContent = "Room: " + roomName;
    changeState(STATES.WAITING);
});

document.getElementById("waiting-back-button").addEventListener("click", function () {
    socket.emit("leaveRoom");
    backToLobby();
});

// playing screen

const matchText = document.getElementById("match-text");
const gameStatus = document.getElementById("game-status");
const cells = document.querySelectorAll(".cell");
const rematchButton = document.getElementById("rematch-button");

let myMark = "";
let isSpectator = false;

socket.on("matchStarted", function (data) {
    isSpectator = false;
    myMark = data.myMark;
    matchText.textContent = "You are " + myMark + " vs " + data.opponent;
    waitingText.textContent = "Room: " + data.roomName;
    changeState(STATES.PLAYING);
});

// the server sent the newest board, so draw it
socket.on("gameUpdate", function (game) {
    const myTurn = game.turn === myMark && game.winner === "";

    for (let i = 0; i < cells.length; i++) {
        cells[i].textContent = game.board[i];
        cells[i].disabled = !myTurn || game.board[i] !== "";
    }

    if (isSpectator) {
        showSpectatorStatus(game);
        return;
    }

    if (game.winner === "draw") {
        gameStatus.textContent = "It's a draw!";
    } else if (game.winner === myMark) {
        gameStatus.textContent = "You win!";
    } else if (game.winner !== "") {
        gameStatus.textContent = "You lose!";
    } else if (myTurn) {
        gameStatus.textContent = "Your turn";
    } else {
        gameStatus.textContent = "Opponent's turn";
    }

    // only show "Play again" when the game is over
    if (game.winner === "") {
        rematchButton.classList.add("hidden");
    } else {
        rematchButton.classList.remove("hidden");
    }
});

// tell the server which square we clicked
for (let i = 0; i < cells.length; i++) {
    cells[i].addEventListener("click", function () {
        socket.emit("makeMove", i);
    });
}

rematchButton.addEventListener("click", function () {
    socket.emit("rematch");
});

// spectating

// the room was full, so we joined to watch
socket.on("spectating", function (data) {
    isSpectator = true;
    myMark = ""; // spectators have no mark, so they can never click a square
    rematchButton.classList.add("hidden");

    if (data.players.length === 2) {
        matchText.textContent = "Watching " + data.players[0] + " vs " + data.players[1];
    } else {
        matchText.textContent = "Watching " + data.players[0] + ", waiting for another player...";
    }

    changeState(STATES.SPECTATING);
});

// both players left, so the room is gone
socket.on("roomClosed", function () {
    socket.emit("leaveRoom");
    backToLobby();
    lobbyMessage.textContent = "The room you were watching closed";
});

function showSpectatorStatus(game) {
    if (game.winner === "draw") {
        gameStatus.textContent = "It's a draw!";
    } else if (game.winner !== "") {
        gameStatus.textContent = game.winner + " wins!";
    } else {
        gameStatus.textContent = game.turn + "'s turn";
    }
}

// the other player left, so go back to waiting in the same room
socket.on("opponentLeft", function () {
    console.log("Your opponent left the match");
    changeState(STATES.WAITING);
});

document.getElementById("playing-back-button").addEventListener("click", function () {
    socket.emit("leaveRoom");
    backToLobby();
});

// helpers

function backToLobby() {
    isSpectator = false;
    roomInput.value = "";
    lobbyMessage.textContent = "";
    changeState(STATES.LOBBY);
}

// start on the login screen
changeState(STATES.LOGIN);
