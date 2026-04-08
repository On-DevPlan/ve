<script setup>
</script>

<template>
  <div class="demo-wrapper">
    <div class="card">
        <input id="open" type="checkbox">
        <label class="open" for="open"></label>
        <div class="card-front">
            <img src="/gost/No66_LoveLetter/love.png" alt="" class="love">
            <div class="note">Open it! 💗💗💗 </div>
        </div>
        <div class="card-inside">
            <div class="text-one">
                <h1>💌520💌</h1>
                <h2>
                    Your eyes are really beautiful, there are rain, sun and moon, mountains,
                    rivers, clouds, flowers and birds,
                    but my eyes are better, because I have you in my eyes.
                </h2>
            </div>
        </div>
    </div>
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Lato:300|Sacramento&display=swap');

.demo-wrapper {
    width: 100vw;
    height: 100vh;
    overflow: hidden;
    margin: 0;
    display: flex;
    justify-content: center;
    align-items: center;
    background-color: #f2acac;
}

input#open {
    display: none;
}

.card {
    position: relative;
    width: 300px;
    height: 300px;
    transform-style: preserve-3d;
    transform: perspective(2500px);
    transition: .3s;
}

.card-front {
    position: relative;
    background-color: #fff0f3;
    width: 300px;
    height: 300px;
    transform-origin: left;
    box-shadow: 30px 0 50px rgba(0, 0, 0, 0.3);
    transition: .3s;
}

.card-front:before {
    content: "";
    position: absolute;
    width: 280px;
    height: 280px;
    background-color: #f38e8e;
    top: 10px;
    left: 10px;
}

.card-inside {
    position: absolute;
    background-color: #fff0f3;
    width: 300px;
    height: 300px;
    z-index: -1;
    left: 0;
    top: 0;
    background-color: #f5f5f5;
}

.open {
    position: absolute;
    width: 300px;
    height: 300px;
    left: 0;
    top: 0;
    background-color: transparent;
    z-index: 6;
    cursor: pointer;
}

#open:checked ~ .card-front {
    transform: rotateY(-145deg);
}

#open:checked ~ .card-front:before {
    z-index: 5;
    background-color: #fff0f3;
    width: 330px;
    height: 300px;
    top: 0;
    left: 0;
    background-image: url(/gost/No66_LoveLetter/love.gif);
    background-size: cover;
    transform: rotateY(155deg) translateX(16px);
}

.note {
    position: relative;
    width: 200px;
    height: 150px;
    background-color: #fff0f3;
    top: 85px;
    left: 50px;
    color: #333;
    font: 900 35px '';
    display: flex;
    align-items: center;
    text-align: center;
    filter: drop-shadow(0 0 20px rgba(0, 0, 0, 0.3));
}

img {
    position: absolute;
    width: 90px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 2;
    top: 25px;
}

.text-one {
    position: absolute;
    color: #333;
    font-size: 15px;
    top: 30px;
    width: 300px;
    text-align: center;
    color: #ff9999;
    font-family: 'Sacramento', cursive;
}

.text-one:after {
    content: "";
    top: 80px;
}
</style>
