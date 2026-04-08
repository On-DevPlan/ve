<template>
  <div class="demo-wrapper">
    <div class="cards">
      <div class="card">TEXT</div>
      <div class="card">TEXT</div>
      <div class="card">TEXT</div>
      <div class="card">TEXT</div>
      <div class="card">IMG</div>
      <div class="card">TEXT</div>
      <div class="card">TEXT</div>
      <div class="card">TEXT</div>
      <div class="card">IMG</div>
      <div class="card">IMG</div>
      <div class="card">TEXT</div>
      <div class="card">TEXT</div>
      <div class="card">TEXT</div>
      <div class="card">TEXT</div>
      <div class="card">IMG</div>
      <div class="card">TEXT</div>
      <div class="card">TEXT</div>
      <div class="card">TEXT</div>
      <div class="card">TEXT</div>
      <div class="card">IMG</div>
      <div class="card">TEXT</div>
      <div class="card">TEXT</div>
      <div class="card">TEXT</div>
      <div class="card">TEXT</div>
      <div class="card">IMG</div>
      <div class="card">TEXT</div>
      <div class="card">TEXT</div>
      <div class="card">IMG</div>
      <div class="card">TEXT</div>
      <div class="card">TEXT</div>
      <div class="card">TEXT</div>
    </div>
  </div>
</template>

<style scoped>
.demo-wrapper {
  width: 100vw;
  min-block-size: 100vh;
  overflow: hidden;
  margin: 0;
  display: grid;
  place-content: center;
  padding-block: 30dvh;
  background: #f7d6ff;
}

* {
  box-sizing: border-box;
  padding: 0;
  margin: 0;
}

@keyframes slide-fade-in {
  from {
    opacity: 0;
    box-shadow: none;
    transform: scale(.8) translateY(15vh);
  }
}

.cards {
  display: grid;
  gap: 2rem;
  grid-auto-flow: dense;
  grid-template-columns: repeat(4, 30ch);
}

.card {
  animation: slide-fade-in both;
  animation-timeline: view();
  animation-range: contain 0% contain 50%;
  border-radius: 10px;
  line-height: 6;
  box-shadow: 0px 8px 20px #00000022;
  font-size: 32px;
  letter-spacing: 5px;
  color: #fff;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background-image: linear-gradient(to bottom right,
      #91defe,
      #99c0f9,
      #bdb6ec,
      #d7b3e3,
      #efb3d5,
      #f9bccc);
  display: flex;
  justify-content: center;
  align-items: center;
}

.card img {
  width: 100%;
  height: 100%;
}

.card:nth-of-type(4n) {
  grid-column: span 2;
}

.card:nth-of-type(5n) {
  grid-column: span 2;
}

.card:nth-of-type(7n) {
  grid-row: span 2;
}
</style>
