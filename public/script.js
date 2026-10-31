// all the states the game can be in
const STATES = {
    MENU: "menu",
    PLAYING: "playing",
    GAME_OVER: "gameOver"
};

let currentState = "";

// which screen belongs to which state
const screens = {
    menu: document.getElementById("menu-screen"),
    playing: document.getElementById("game-screen"),
    gameOver: document.getElementById("gameover-screen")
};

// the ONLY place the state is allowed to change
function changeState(newState) {
    if (!screens[newState]) {
        console.log("Unknown state: " + newState);
        return;
    }

    console.log("State changed: " + currentState + " -> " + newState);
    currentState = newState;

    // hide every screen...
    for (const name in screens) {
        screens[name].classList.add("hidden");
    }

    // ...then show only the one for the new state
    screens[newState].classList.remove("hidden");
    document.getElementById("state-label").textContent = "Current state: " + newState;
}

// buttons just ask for a state change
document.getElementById("play-button").addEventListener("click", function () {
    changeState(STATES.PLAYING);
});

document.getElementById("end-button").addEventListener("click", function () {
    changeState(STATES.GAME_OVER);
});

document.getElementById("again-button").addEventListener("click", function () {
    changeState(STATES.PLAYING);
});

document.getElementById("menu-button").addEventListener("click", function () {
    changeState(STATES.MENU);
});

// start the game on the menu
changeState(STATES.MENU);