/**
 * Two player UI basic version of checkers with 3D pieces.
 * User selects a piece they wish to move and that pieces possible moves, 
including jumps are highlighted.
 * Once the user decides on a piece and clicks a space with a possible 
move, the turn switches to the opponent.
 * Game includes a dynamically changing, colored turn indicator, a game 
over message if one player wins,
 * and a restart game button which resets the board's pieces to its base 
type and start positions.
 * @Author  Vito Leone
 */

'use strict';

// Global WebGL context variable
let gl;

// Drawing Sizes
const SQUARE_SZ = 2/8; // 8 boxes across, screen is 2 units wide (from -1 
to 1)
const PIECE_RADIUS = SQUARE_SZ/2 * 0.8; // make the radius a little 
smaller than a square so it fits inside

// Basic Colors
const WHITE3D = [1.0, 1.0, 1.0, 1.0];
const WHITE = [.6, .6, .6, 1.0];
const BLACK3D = [0.4, 0.4, 0.4, 1.0];
const BLACK = [0.0, 0.0, 0.0, 1.0];

// Square Colors
const DARK_SQUARE = [0.82, 0.55, 0.28, 1.0];
const LIGHT_SQUARE = [1.0, 0.89, 0.67, 1.0];

// Player Highlight Colors
const PLAYER_1_HIGHLIGHT = [0.8, 0.3, 0.3, 1.0]; // lighter red
const PLAYER_2_HIGHLIGHT = [0.3, 0.8, 0.8, 1.0]; // lighter gray

// The possible states for any square on the game board
const NO_PIECE = 0;
const WHITE_PIECE = 1;
const BLACK_PIECE = 2;
const BLACK_KING = 3;
const WHITE_KING = 4;
const HILIGHT = 5;

// Initialize the game board
let board = [
    [WHITE_PIECE, WHITE_PIECE, WHITE_PIECE, WHITE_PIECE],
    [WHITE_PIECE, WHITE_PIECE, WHITE_PIECE, WHITE_PIECE],
    [WHITE_PIECE, WHITE_PIECE, WHITE_PIECE, WHITE_PIECE],
    [NO_PIECE, NO_PIECE, NO_PIECE, NO_PIECE],
    [NO_PIECE, NO_PIECE, NO_PIECE, NO_PIECE],
    [BLACK_PIECE, BLACK_PIECE, BLACK_PIECE, BLACK_PIECE],
    [BLACK_PIECE, BLACK_PIECE, BLACK_PIECE, BLACK_PIECE],
    [BLACK_PIECE, BLACK_PIECE, BLACK_PIECE, BLACK_PIECE],
];

// Initialize the game board
let possibleMoves = [
    [-1,-1,-1,-1],
    [-1,-1,-1,-1],
    [-1,-1,-1,-1],
    [-1,-1,-1,-1],
    [-1,-1,-1,-1],
    [-1,-1,-1,-1],
    [-1,-1,-1,-1],
    [-1,-1,-1,-1],
];

let turn = [WHITE_PIECE, WHITE_KING];
let selectedIndex = []
let possibleJumps = [];


// Once the document is fully loaded run this init function.
window.addEventListener('load', function init() {
    // Get the HTML5 canvas object from it's ID
    const canvas = document.getElementById('webgl-canvas');
    if (!canvas) { window.alert('Could not find #webgl-canvas'); return; }

    // Get the WebGL context (save into a global variable)
    gl = canvas.getContext('webgl2');
    if (!gl) { window.alert("WebGL isn't available"); return; }

    // Configure WebGL
    gl.viewport(0, 0, canvas.width, canvas.height); // this is the region 
of the canvas we want to draw on (all of it)
    gl.clearColor(...LIGHT_SQUARE); // setup the background color

    // Initialize the WebGL program and data
    gl.program = initProgram();
    initBuffers();
    initEvents();

    // Render the static scene
    render();
});


/**
 * Initializes the WebGL program.
 */
function initProgram() {
    // Compile shaders
    // Vertex Shader
    let vert_shader = compileShader(gl, gl.VERTEX_SHADER,
        `#version 300 es
        precision mediump float;

        in vec4 aPosition;
        in vec4 aColor;

        uniform vec2 uPosition;

        out vec4 vColor;

        void main() {

            gl_Position.x = aPosition.x + uPosition[0];
            gl_Position.y = aPosition.y + uPosition[1];

            gl_Position.zw = vec2(0, 1);

            vColor = aColor;
        }`
    );
    // Fragment Shader
    let frag_shader = compileShader(gl, gl.FRAGMENT_SHADER,
        `#version 300 es
        precision mediump float;

        uniform vec4 uColor;

        in vec4 vColor;
        out vec4 fragColor;

        void main() {
            fragColor = uColor;
        }`
    );

    // Link the shaders into a program and use them with the WebGL context
    let program = linkProgram(gl, vert_shader, frag_shader);
    gl.useProgram(program);

    // Get the attribute indices
    program.aPosition = gl.getAttribLocation(program, 'aPosition'); // get 
the vertex shader attribute "aPosition"
    program.aColor = gl.getAttribLocation(program, 'aColor');
    program.uColor = gl.getUniformLocation(program, 'uColor');
    program.uPosition = gl.getUniformLocation(program, 'uPosition');

    return program;
}


/**
 * Initialize the data buffers.
 */
function initBuffers() {
    //Board square coordinates
    gl.coords = [-1,1, -1,6/8, -6/8,6/8, -6/8,6/8, -6/8,1, -1,1];
    //Regular piece coords
    circle(0, 0, PIECE_RADIUS, 64, gl.coords);
    //King Piece coords
    circle(0, 0.01, PIECE_RADIUS, 64, gl.coords);

    gl.boardVAO = gl.createVertexArray();
    gl.bindVertexArray(gl.boardVAO);

    gl.posBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.posBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, Float32Array.from(gl.coords), 
gl.DYNAMIC_DRAW);
    gl.vertexAttribPointer(gl.program.aPosition, 2, gl.FLOAT, false, 0, 
0);
    gl.enableVertexAttribArray(gl.program.aPosition);

    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
}


/**
 * Initialize event handlers
 */
function initEvents() {
    gl.canvas.addEventListener("click", onClick);
    document.getElementById("newGame").addEventListener("click", newGame);
}


/**
 * Render the scene. Uses loop(s) to to go over the entire board and 
render each square and piece.
 * The light squares (which cannot have pieces on them) are not directly 
done here but instead by
 * the clear color.
 */
function render() {
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.bindVertexArray(gl.boardVAO);

    drawObjects();

    gl.bindVertexArray(null);

    window.requestAnimationFrame(render)
}

/**
 * Registers the click on the canvas and converts canvas coordinates into 
x, y coordinates
 */
function onClick(e) {
    e.preventDefault();
    let [x, y, w, h] = [e.offsetX, e.offsetY, gl.canvas.offsetWidth, 
gl.canvas.offsetHeight];

    x = ((2/w)*x) - 1;
    y = -((2/h)*y) +1;

    if(getSelectedSquare(x, y)) {
        gl.canvas.removeEventListener('click', onClick);
    }

}

/**
 * Resets the board, resets text, resets turn to white, and adds the event 
listener back to the
 */
function newGame() {
    board = [
        [WHITE_PIECE, WHITE_PIECE, WHITE_PIECE, WHITE_PIECE],
        [WHITE_PIECE, WHITE_PIECE, WHITE_PIECE, WHITE_PIECE],
        [WHITE_PIECE, WHITE_PIECE, WHITE_PIECE, WHITE_PIECE],
        [NO_PIECE, NO_PIECE, NO_PIECE, NO_PIECE],
        [NO_PIECE, NO_PIECE, NO_PIECE, NO_PIECE],
        [BLACK_PIECE, BLACK_PIECE, BLACK_PIECE, BLACK_PIECE],
        [BLACK_PIECE, BLACK_PIECE, BLACK_PIECE, BLACK_PIECE],
        [BLACK_PIECE, BLACK_PIECE, BLACK_PIECE, BLACK_PIECE],
    ];

    resetHilights();
    turn = [WHITE_PIECE, WHITE_KING];

    setStatusText("TURN:", "color: White", "WHITE")

    gl.canvas.addEventListener("click", onClick);
}

/**
 * Removes Highlights from checkers board
 */
function resetHilights() {
    possibleMoves = [
        [-1,-1,-1,-1],
        [-1,-1,-1,-1],
        [-1,-1,-1,-1],
        [-1,-1,-1,-1],
        [-1,-1,-1,-1],
        [-1,-1,-1,-1],
        [-1,-1,-1,-1],
        [-1,-1,-1,-1],
    ];
}

/**
 * Get the counts of each color of pieces on the board
 * @returns an array containing the counts of both white and black pieces
 */
function getPieceCounts() {
    let whiteCount = 0;
    let blackCount = 0;

    for (let i = 0; i < 8; i++) {

        for (let j = 0; j < 4; j++) {
            if(board[i][j] === WHITE_PIECE || board[i][j] === WHITE_KING) 
{
                whiteCount++;
            } else if(board[i][j] !== NO_PIECE) {
                blackCount++;
            }
        }
    }
    return [whiteCount, blackCount]
}

/**
 * Sets game status text
 * @param {*} status text for status of the game
 * @param {*} color color of the text
 * @param {*} turnText text of the current turn or winner
 */
function setStatusText(status, color, turnText) {
    document.getElementById("gameStatus").innerHTML = status;
    document.getElementById('turnID').style = color;
    document.getElementById("turnID").innerHTML = turnText;
}

/**
 * Checks if game is over. If game is over, new text is set for the game 
status
 */
function checkGameOver() {

    let counts = getPieceCounts();

    if(counts[0] === 0) {

        setStatusText("WINNER:" , "color: black",  "BLACK");
        return true;
    } else if(counts[1] === 0) {

        setStatusText("WINNER:", "color: white", "WHITE");
        return true;
    } else{
        return false;
    }
}

/**
 * Cyclyes through all squares and stops when click coordinates is equal 
to a valid square
 * @param {*} x x value of click
 * @param {*} y x valie of click
 * @returns
 */
function getSelectedSquare(x, y) {

    let x1;
    let x2;
    let y1 = 1;
    let y2 = 1 - SQUARE_SZ;
    let gameOver = false;

    let jOffset;
    let iOffset;

    for (let i = 0; i < 8; i++) {
        if (i % 2 === 0) {
            jOffset = 1;
            x1 = -1;
            x2 = -1 + SQUARE_SZ;

        } else {
            jOffset = -1;
            x1 = -1 + SQUARE_SZ;
            x2 = -1 + (2* SQUARE_SZ);
        }

        for (let j = 0; j < 4; j++) {
            let clickValid = (x >= x1 && x <= x2 && y <= y1 && y >= y2);
            let validSquare = (board[i][j] === turn[0] || board[i][j] === 
turn[1]);
            let validMove = (possibleMoves[i][j] === HILIGHT);

            if(clickValid && validSquare) {
                selectedValidPiece(gameOver, i, j, iOffset, jOffset)
                break;
            }

            if(clickValid && validMove) {
                selectedValidMove(gameOver, i, j)
                break;
            }

            x1 += (2 * SQUARE_SZ);
            x2 += (2 * SQUARE_SZ);
        }

        if(gameOver) {
            break;
        }

        y1 -= SQUARE_SZ;
        y2 -= SQUARE_SZ;

    }

    return gameOver;
}

/**
 * If a valid move is selected, the possible jumps are checked using 
checkPossibleJumps,
 * kings are checked for using checkForKings(),
 * if a piece is jumped it is cleared using clearJumpedPieces(),
 * turns are switched using switchTurns()
 * Hilighted squares are reset using reset hilights
 * gameOver boolean is set to either true or false based on return value 
from checkGameOver()textID
 *
 * @param {*} i y coordinate in 2D board array
 * @param {*} j x coordinate in 2D board array
 * @param {*} gameOver boolean which determines whether or not the game is 
over
 */
function selectedValidMove(gameOver, i, j) {
    board[selectedIndex[0]][selectedIndex[1]] = NO_PIECE;
    board[i][j] = selectedIndex[2];

    checkForJumpedPieces(i, j);
    checkForPossibleKings();
    removeJumpedPieces();
    switchTurns();
    resetHilights();
    gameOver = checkGameOver();
}

/**
 * Resets and Sets highlights if a piece is selected for a users turn by 
calling setPossibleMoves()
 * @param {*} i y coordinate in 2D board array
 * @param {*} j x coordinate in 2D board array
 * @param {*} xOffset array shift in x direction from origonal position
 * @param {*} yOffset array shift in y direction from origonal position
 * @param {*} gameOver boolean for determining whether or not the game is 
over
 */
function selectedValidPiece(gameOver, i, j, iOffset, jOffset) {
    selectedIndex = [];
    gameOver = false;

    resetHilights();
    if(turn[0] === BLACK_PIECE || turn[1] === BLACK_KING) {
        iOffset = -1;
    } else {
        iOffset = 1;
    }

    possibleMoves[i][j] = HILIGHT;

    selectedIndex.push(i,j, board[i][j]);
    checkPossibleMoves(i,j , iOffset, jOffset, selectedIndex[2]);
}

/**
 * Switches turns for players
 */
function switchTurns() {

    if(turn[0] === WHITE_PIECE) {
        turn = [BLACK_PIECE, BLACK_KING];
        setStatusText("TURN:", "color: black", "BLACK")

    } else{
        turn = [WHITE_PIECE, WHITE_KING];
        setStatusText("TURN:", "color: white", "WHITE")
    }

}

/**
 * Sets highlights in squares where a move is possible
 * @param {*} i y coordinate in 2D board array
 * @param {*} j x coordinate in 2D board array
 * @param {*} xOffset array shift in x direction from origonal position
 * @param {*} yOffset array shift in y direction from origonal position
 * @param {*} jumpLeft boolean for if the jump is on the users left 
direction. Array sifts are different if so
 */
function setPossibleMoves(i, j, iOffset, jOffset, jumpLeft) {

    let i2 = i + iOffset;
    let j2 = j;

    if(jumpLeft) {
        j2 = j + jOffset;
    }

    let jumpInbounds = (i+(2*iOffset) >= 0 && i+(2*iOffset) <= 7);
    let iJump = i+(2*iOffset);

    try{
        if (board[i2][j2] === NO_PIECE) {
            possibleMoves[i2][j2] = HILIGHT;

        } else if (jumpInbounds
            && (board[i2][j2] !== turn[0] && board[i2][j2] !== turn[1])
            && board[iJump][j+jOffset] === NO_PIECE) {

            possibleJumps.push(i2, j2);

            if (!jumpLeft) {
                j2 = j + jOffset;
            }

            possibleMoves[iJump][j2] = HILIGHT;

        }
    } catch(error) {
        console.log("A possible move appears off the board")
    }
}

/**
 * Checks for possible moves in all directions if king, and only 2 
directions if not.
 * @param {*} i y coordinate in 2D board array
 * @param {*} j x coordinate in 2D board array
 * @param {*} xOffset array shift in x direction from origonal position
 * @param {*} yOffset array shift in y direction from origonal position
 * @param {*} piece type of piece which movement is being checked for
 */
function checkPossibleMoves(i,j, iOffset, jOffset, piece) {

    possibleJumps = [];

    if (piece === turn[1]) {

        setPossibleMoves(i, j, -iOffset, -jOffset, true)

        setPossibleMoves(i, j, -iOffset, jOffset, false)
    }

    setPossibleMoves(i, j, iOffset, -jOffset, true);

    setPossibleMoves(i, j, iOffset, jOffset, false);
}

/**
 * Checks borad for jumped pieces. If a jumped piece is found the square 
is marked as jumped
 * @param {*} y y coordinate in 2D board array
 * @param {*} x x coordinate in 2D board array
 */
function checkForJumpedPieces(y, x) {
    let piecePresent;
    let smallJumpY;
    let smallJumpX;
    let movedPastPiece;
    for(let i = 0; i < possibleJumps.length; i +=2) {

        piecePresent  = board[possibleJumps[i]][possibleJumps[i+1]] !== 
NO_PIECE;
        smallJumpY = Math.abs(possibleJumps[i] - y) < 2;
        smallJumpX = Math.abs(possibleJumps[i+1] - x) < 2;
        movedPastPiece = possibleJumps[i] !== y;

        if(piecePresent && smallJumpY && smallJumpX && movedPastPiece) {
            possibleMoves[possibleJumps[i]][possibleJumps[i+1]] = 
NO_PIECE;

            break;
        }
    }
}

/**
 * Checks board for jumped pieces. If there was a jumped piece, it is 
removed from the board
 */
function removeJumpedPieces() {
    for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 4; j++) {
            if (possibleMoves[i][j]===NO_PIECE) {
                board[i][j] = NO_PIECE;
            }
        }
    }
}

/**
 * Checks board for possible kings. If a king is possible, the piece is 
turned into a king
 */
function checkForPossibleKings() {
    for (let i = 0; i < 4; i++) {
        if(board[0][i] === BLACK_PIECE) {
            board[0][i] = BLACK_KING
        } else if (board[7][i] === WHITE_PIECE) {
            board[7][i] = WHITE_KING
        }
    }
}

/**
 * Draws all objects on the entire board
 */
function drawObjects() {
    let xOffsetBoard;
    let xOffsetHilight;
    let xOffsetPiece;
    let yOffsetSquares = 0;
    let yOffsetPieces = 7/8;

    for (let i = 0; i < 8; i++) {
        if (i % 2 === 0) {
            xOffsetHilight = 0;
            xOffsetBoard = SQUARE_SZ;
            xOffsetPiece = -7/8;
        } else {
            xOffsetHilight = SQUARE_SZ;
            xOffsetBoard = 0;
            xOffsetPiece = -7/8 + SQUARE_SZ;
        }
        for (let j = 0; j < 4; j++) {

            drawHighLights(i, j, xOffsetHilight, yOffsetSquares);
            drawBoardSquares(xOffsetBoard, yOffsetSquares);
            if(board[i][j] === WHITE_PIECE || board[i][j] === WHITE_KING) 
{
                drawPieces(i, j, xOffsetPiece, yOffsetPieces, WHITE, 
WHITE3D);
            } else if(board[i][j] === BLACK_PIECE || board[i][j] === 
BLACK_KING) {
                drawPieces(i, j, xOffsetPiece, yOffsetPieces, BLACK, 
BLACK3D);
            }

            xOffsetHilight += (2 * SQUARE_SZ);
            xOffsetBoard += (2 * SQUARE_SZ);
            xOffsetPiece += (2 * SQUARE_SZ);

        }
        yOffsetSquares -= SQUARE_SZ;
        yOffsetPieces -= SQUARE_SZ;

    }
}

/**
 * Draws Highlights for possible moves when valid piece is picked
 * @param {*} i y coordinate in 2D board array for highlight
 * @param {*} j x coordinate in 2D board array for highlight
 * @param {*} xOffset how much the highlight should shift in the x 
direction from origonal position
 * @param {*} yOffset how much the highlight should shift in the y 
direction from origonal position
 */
function drawHighLights(i, j, xOffset, yOffset) {
    if(possibleMoves[i][j] === HILIGHT) {
        gl.uniform2f(gl.program.uPosition, xOffset, yOffset);

        if(turn[0] === WHITE_PIECE || turn[1] === WHITE_KING) {
            gl.uniform4fv(gl.program.uColor, PLAYER_1_HIGHLIGHT);
        } else {
            gl.uniform4fv(gl.program.uColor, PLAYER_2_HIGHLIGHT);
        }

        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
}

/**
 * Sends uPosition info into Vertex shader in order to draw the board
 * @param {*} xOffset how much the square should shift in the x direction 
from origonal position
 * @param {*} yOffset how much the square should shift in the y direction 
from origonal position
 */
function drawBoardSquares(xOffset, yOffset) {

    gl.uniform2f(gl.program.uPosition, xOffset, yOffset);

    gl.uniform4fv(gl.program.uColor, DARK_SQUARE);

    gl.drawArrays(gl.TRIANGLES, 0, 6);

}

/**
 * Draws the board pieces
 * @param {*} i y coordinate in 2D board array for piece
 * @param {*} j x coordinate in 2D board array for piece
 * @param {*} xOffset how much the piece should shift in the x direction 
from origonal position
 * @param {*} yOffset how much the piece should shift in the y direction 
from origonal position
 * @param {*} color color of the piece
 * @param {*} color3D color of the "3D" looking part of the piece
 */
function drawPieces(i, j, xOffset, yOffset, color, color3D) {
    gl.uniform2f(gl.program.uPosition, xOffset, yOffset)
    gl.uniform4fv(gl.program.uColor, color)

    gl.drawArrays(gl.TRIANGLE_FAN, 12, (gl.coords.length - 24)/2);

    if(board[i][j] === BLACK_KING || board[i][j] === WHITE_KING) {
        yOffset +=.015;
    }

    gl.uniform2f(gl.program.uPosition, xOffset, yOffset)
    gl.uniform4fv(gl.program.uColor, color3D);

    gl.drawArrays(gl.TRIANGLE_FAN, 77, (gl.coords.length - 154)/2);

}


/**
 * Add the vertices for a circle centered at (cx, cy) with a radius of r 
and n sides to the
 * array coords.
 */
function circle(cx, cy, r, n, coords) {
    // The angle between subsequent vertices
    let theta = 2*Math.PI/n;

    // Push the center vertex (all triangles share this one)
    coords.push(cx, cy);

    // Push the first coordinate around the circle
    coords.push(cx+r, cy);

    // Loop over each of the triangles we have to create
    for (let i = 1; i <= n; ++i) {
        // Push the next coordinate
        coords.push(cx+Math.cos(i*theta)*r, cy+Math.sin(i*theta)*r);
    }
}
