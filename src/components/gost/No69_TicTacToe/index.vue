<script setup>
import { ref, onMounted } from 'vue'

const winningCombinations = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6]
]

const cells = ref([])
const boardRef = ref(null)
const currentStatusRef = ref(null)
const gameEndOverlayRef = ref(null)
const currentBeastImgRef = ref(null)
const winningMessageRef = ref(null)
const winningMessageTextRef = ref(null)

const gameIsLive = ref(true)
const unicornTurn = ref(true)
const winningMessageImg = ref(null)

const setBoardHoverClass = () => {
  if (!boardRef.value) return
  boardRef.value.classList.remove('unicorn', 'dragon')
  if (unicornTurn.value) {
    boardRef.value.classList.add('unicorn')
  } else {
    boardRef.value.classList.add('dragon')
  }
}

const placeBeastImg = (cell, currentBeast) => {
  cell.classList.add(currentBeast)
}

const swapTurns = () => {
  unicornTurn.value = !unicornTurn.value
}

const updateCurrentStatus = () => {
  if (!currentBeastImgRef.value) return
  if (unicornTurn.value) {
    currentBeastImgRef.value.src = '/gost/No69_TicTacToe/1.gif'
    currentBeastImgRef.value.alt = 'unicorn'
  } else {
    currentBeastImgRef.value.src = '/gost/No69_TicTacToe/2.gif'
    currentBeastImgRef.value.alt = 'dragon'
  }
}

const checkWin = (currentBeast) => {
  return winningCombinations.some(combination => {
    return combination.every(i => {
      return cells.value[i].classList.contains(currentBeast)
    })
  })
}

const isDraw = () => {
  return [...cells.value].every(cell => {
    return cell.classList.contains('unicorn') || cell.classList.contains('dragon')
  })
}

const startGame = () => {
  cells.value.forEach(cell => {
    if (winningMessageImg.value) {
      winningMessageImg.value.remove()
    }
    cell.classList.remove('unicorn', 'dragon')
    cell.removeEventListener('click', handleCellClick)
    cell.addEventListener('click', handleCellClick, { once: true })
  })
  setBoardHoverClass()
  if (gameEndOverlayRef.value) {
    gameEndOverlayRef.value.classList.remove('show')
  }
}

const endGame = (draw) => {
  if (!winningMessageTextRef.value || !gameEndOverlayRef.value) return
  if (draw) {
    winningMessageTextRef.value.innerText = `draw!`
  } else {
    winningMessageImg.value = document.createElement('img')
    winningMessageImg.value.src = unicornTurn.value ? '/gost/No69_TicTacToe/1.gif' : '/gost/No69_TicTacToe/2.gif'
    winningMessageImg.value.alt = unicornTurn.value ? 'unicorn' : 'dragon'
    if (winningMessageRef.value) {
      winningMessageRef.value.insertBefore(winningMessageImg.value, winningMessageTextRef.value)
    }
    winningMessageTextRef.value.innerText = `wins!!!`
  }
  gameEndOverlayRef.value.classList.add('show')
}

const handleCellClick = (e) => {
  const cell = e.target
  const currentBeast = unicornTurn.value ? 'unicorn' : 'dragon'
  placeBeastImg(cell, currentBeast)
  if (checkWin(currentBeast)) {
    endGame(false)
  } else if (isDraw()) {
    endGame(true)
  } else {
    swapTurns()
    updateCurrentStatus()
    setBoardHoverClass()
  }
}

const initCells = () => {
  cells.value = Array.from(document.querySelectorAll('[data-cell]'))
}

onMounted(() => {
  initCells()
  startGame()
  const resetButton = document.getElementById('resetButton')
  if (resetButton) {
    resetButton.addEventListener('click', startGame)
  }
})
</script>

<template>
  <div class="demo-wrapper">
    <div class="wrapper">
        <div class="current-status" id="currentStatus">
            <img src="/gost/No69_TicTacToe/1.gif" id="currentBeastImg" alt="">
            <p>&nbsp; 's turn</p>
        </div>
        <div class="board" id="board" ref="boardRef">
            <div class="cell" data-cell></div>
            <div class="cell" data-cell></div>
            <div class="cell" data-cell></div>
            <div class="cell" data-cell></div>
            <div class="cell" data-cell></div>
            <div class="cell" data-cell></div>
            <div class="cell" data-cell></div>
            <div class="cell" data-cell></div>
            <div class="cell" data-cell></div>
        </div>
        <div class="game-end-overlay" id="gameEndOverlay" ref="gameEndOverlayRef">
            <div class="winning-message" data-winning-message ref="winningMessageRef">
                <p ref="winningMessageTextRef"></p>
            </div>
            <div class="btn-container">
                <button class="reset-button" id="resetButton">play again</button>
            </div>
        </div>
    </div>
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Bungee+Inline&display=swap');

.demo-wrapper {
    width: 100vw;
    height: 100vh;
    overflow: hidden;
    margin: 0;
    padding: 0;
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100vh;
    text-align: center;
    font-family: "Bungee Inline", cursive;
    color: #f5f5f5;
    background-color: #1a1a2e;
}

.wrapper {
    background-color: #55acee53;
    padding: 50px;
}

.current-status {
    display: flex;
    justify-content: center;
    align-items: center;
    margin-bottom: 25px;
}

.current-status p {
    margin: 0 5px 0 0;
    font-size: 24px;
}

.current-status img {
    width: auto;
    height: 32px;
}

.board {
    display: grid;
    grid-template-columns: repeat(3, minmax(90px, 1fr));
    grid-template-rows: repeat(3, minmax(90px, 1fr));
    grid-gap: 12px;
    width: 100%;
    height: 100%;
    max-width: 495px;
    margin: 0 auto 15px;
}

.board.unicorn .cell:not(.dragon):not(.unicorn):hover::before,
.board.dragon .cell:not(.dragon):not(.unicorn):hover::before {
    content: "";
    width: 70%;
    height: 70%;
    display: block;
    position: absolute;
    background-repeat: no-repeat;
    top: 50%;
    left: 50%;
    transform: translate3d(-50%, -50%, 0);
    background-size: contain;
    opacity: 50%;
}

.board.unicorn .cell:not(.dragon):hover::before {
    background-image: url('/gost/No69_TicTacToe/1.gif');
}

.board.dragon .cell:not(.unicorn):hover::before {
    background-image: url('/gost/No69_TicTacToe/2.gif');
}

.cell {
    cursor: pointer;
    position: relative;
    background-color: #f5f5f5;
    width: 90px;
    height: 90px;
    opacity: 0.5;
    transition: opacity 0.2s ease-in-out;
}

.cell:hover {
    opacity: 1;
}

.cell.dragon,
.cell.unicorn {
    opacity: 1;
    position: relative;
    cursor: not-allowed;
}

.cell.dragon::before,
.cell.unicorn::before {
    content: "";
    width: 70%;
    height: 70%;
    display: block;
    position: absolute;
    background-repeat: no-repeat;
    top: 50%;
    left: 50%;
    transform: translate3d(-50%, -50%, 0);
    background-size: contain;
}

.cell.dragon::before {
    background-image: url('/gost/No69_TicTacToe/2.gif');
}

.cell.unicorn::before {
    background-image: url('/gost/No69_TicTacToe/1.gif');
}

.game-end-overlay {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: #0d1021;
}

.game-end-overlay.show {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
}

.winning-message {
    margin: -50px 0 20px;
}

.winning-message img {
    width: 100px;
}

.winning-message p {
    font-size: 48px;
    margin: 0;
}

.btn-container {
    position: relative;
}

.reset-button {
    color: #f5f5f5;
    font-family: "Bungee Inline", cursive;
    font-size: 30px;
    white-space: nowrap;
    border: none;
    padding: 10px 20px;
    background-color: #a186be;
    box-shadow: 5px 5px 0 #55acee;
    cursor: pointer;
    transition: transform 0.1s ease-in-out;
    position: relative;
}

.reset-button:hover {
    transform: scale(1.2);
}

.reset-button:active {
    top: 6px;
    left: 6px;
    box-shadow: none;
    background-color: #9475b5;
}
</style>
