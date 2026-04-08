<template>
  <div class="demo-wrapper">
    <div class="wrap">
      <div class="card">
        <div class="card-pic-wrap" style="background-color: #fda09d7a;">
          <img src="/gost/No113_SpyFamilyCard/image/A_02.png" alt="">
        </div>
        <div class="card-content">
          <h3>约尔·福杰</h3>
          <p>
            真名：约尔·布莱尔，代号：荆棘公<br/>
            身份：杀手，伪装成阿尼亚的<br/>
            职业：市政府职员（伪装）<br/>
            特点：战斗力强，性格温柔天<br/>
            理由：为了掩人耳目而结婚
          </p>
        </div>
      </div>
      <div class="card">
        <div class="card-pic-wrap">
          <img src="/gost/No113_SpyFamilyCard/image/A_01.png" alt="">
        </div>
        <div class="card-content">
          <h3>阿尼亚·福杰</h3>
          <p>
            年龄：4岁左右<br/>
            身份：福杰家的养女<br/>
            特点：能读心，是个超能力者<br/>
            性格：可爱调皮，爱看间谍动<br/>
            梦想：帮爸爸完成间谍任务
          </p>
        </div>
      </div>
      <div class="card">
        <div class="card-pic-wrap" style="background-color: #94bab07a;">
          <img src="/gost/No113_SpyFamilyCard/image/A_06.png" alt="">
        </div>
        <div class="card-content">
          <h3>洛伊德·福杰</h3>
          <p>
            真名：不详（代号：黄昏）<br/>
            身份：间谍，伪装成阿尼亚的爸爸<br/>
            职业：精神科医生（伪装）<br/>
            特点：聪明冷静，擅长伪装与战斗<br/>
            目标：完成秘密任务，守护世界和平
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.demo-wrapper {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  margin: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  background-image: linear-gradient(62deg, #8EC5FC 0%, #E0C3FC 100%);
}

* {
  box-sizing: border-box;
  padding: 0;
  margin: 0;
}

.wrap {
  width: 100%;
  display: flex;
  max-width: 1420px;
  justify-content: space-between;
  align-items: center;
}

.card {
  width: 400px;
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  border-radius: 10px;
  background: linear-gradient(to right bottom, rgba(255, 255, 255, .8), rgba(255, 255, 255, .5), rgba(255, 255, 255, .3));
  backdrop-filter: blur(11px);
}

.card-pic-wrap {
  background: #FEEABF7a;
  width: 100%;
  height: 380px;
  position: relative;
  display: flex;
  justify-content: center;
  border-radius: 10px;
}

.card-pic-wrap img {
  position: absolute;
}

.card:nth-child(1) .card-pic-wrap img {
  bottom: -40px;
  width: 380px;
  right: 0;
}

.card:nth-child(2) .card-pic-wrap img {
  width: 130%;
  left: -65px;
  bottom: -17px;
}

.card:nth-child(3) .card-pic-wrap img {
  bottom: -72px;
  left: 45px;
  width: 320px;
}

.card-content {
  padding: 1rem 1.5rem;
  height: 280px;
  width: 100%;
}

.card h3 {
  font-size: 1.7rem;
  margin: 0.75rem 0;
  color: #333;
}

.card p {
  font-size: 1.35rem;
  line-height: 1.7;
}
</style>
