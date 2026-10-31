// script.js
// Two players take turns on the same computer.

const cells = document.querySelectorAll(".cell");
const statusText = document.getElementById("status");
const restartButton = document.getElementById("restart");

// all the ways to win
const winLines = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
  [0, 4, 8], [2, 4, 6]             // diagonals
];

let board = [];
let currentPlayer = "";
let gameOver = false;

function startGame() {
  board = ["", "", "", "", "", "", "", "", ""];
  currentPlayer = "X";
  gameOver = false;

  for (let i = 0; i < cells.length; i++) {
    cells[i].textContent = "";
  }

  statusText.textContent = "X's turn";
}

function playMove(index) {
  // ignore clicks on taken squares or after the game ends
  if (gameOver || board[index] !== "") return;

  board[index] = currentPlayer;
  cells[index].textContent = currentPlayer;

  if (checkWin()) {
    statusText.textContent = currentPlayer + " wins!";
    gameOver = true;
  } else if (!board.includes("")) {
    statusText.textContent = "It's a draw!";
    gameOver = true;
  } else {
    switchPlayer();
  }
}

function checkWin() {
  for (let i = 0; i < winLines.length; i++) {
    const a = winLines[i][0];
    const b = winLines[i][1];
    const c = winLines[i][2];

    if (board[a] !== "" && board[a] === board[b] && board[b] === board[c]) {
      return true;
    }
  }
  return false;
}

function switchPlayer() {
  if (currentPlayer === "X") {
    currentPlayer = "O";
  } else {
    currentPlayer = "X";
  }
  statusText.textContent = currentPlayer + "'s turn";
}

// connect each square to its index on the board
for (let i = 0; i < cells.length; i++) {
  cells[i].addEventListener("click", function () {
    playMove(i);
  });
}

restartButton.addEventListener("click", startGame);

startGame();
