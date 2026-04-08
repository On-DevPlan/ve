<script setup>
</script>

<template>
  <div class="demo-wrapper">
    <div class="shell">
      <div class="tall">
        <img src="/gost/No30_DiamondLayout/img_19.jpeg" alt="">
        <span>1</span>
      </div>
      <div>
        <img src="/gost/No30_DiamondLayout/img_2.jpeg" alt="">
        <span>2</span>
      </div>
      <div>
        <img src="/gost/No30_DiamondLayout/img_1.jpeg" alt="">
        <span>3</span>
      </div>
      <div class="wide">
        <img src="/gost/No30_DiamondLayout/img_34.jpeg" alt="">
        <span>4</span>
      </div>
      <div>
        <img src="/gost/No30_DiamondLayout/img_8.jpeg" alt="">
        <span>5</span>
      </div>
      <div class="tall">
        <img src="/gost/No30_DiamondLayout/img_40.jpeg" alt="">
        <span>6</span>
      </div>
      <div class="big">
        <img src="/gost/No30_DiamondLayout/img_7.jpeg" alt="">
        <span>7</span>
      </div>
      <div>
        <img src="/gost/No30_DiamondLayout/img_5.jpeg" alt="">
        <span>8</span>
      </div>
      <div class="wide">
        <img src="/gost/No30_DiamondLayout/img_6.jpeg" alt="">
        <span>9</span>
      </div>
      <div class="big">
        <img src="/gost/No30_DiamondLayout/img_10.jpeg" alt="">
        <span>10</span>
      </div>
      <div class="tall">
        <img src="/gost/No30_DiamondLayout/img_39.jpeg" alt="">
        <span>11</span>
      </div>
      <div>
        <img src="/gost/No30_DiamondLayout/img_12.jpeg" alt="">
        <span>12</span>
      </div>
      <div>
        <img src="/gost/No30_DiamondLayout/img_13.jpeg" alt="">
        <span>13</span>
      </div>
      <div>
        <img src="/gost/No30_DiamondLayout/img_14.jpeg" alt="">
        <span>14</span>
      </div>
      <div>
        <img src="/gost/No30_DiamondLayout/img_15.jpeg" alt="">
        <span>15</span>
      </div>
      <div class="wide">
        <img src="/gost/No30_DiamondLayout/img_35.jpeg" alt="">
        <span>16</span>
      </div>
      <div>
        <img src="/gost/No30_DiamondLayout/img_17.jpeg" alt="">
        <span>17</span>
      </div>
      <div>
        <img src="/gost/No30_DiamondLayout/img_18.jpeg" alt="">
        <span>18</span>
      </div>
      <div class="wide">
        <img src="/gost/No30_DiamondLayout/img_38.jpeg" alt="">
        <span>19</span>
      </div>
      <div>
        <img src="/gost/No30_DiamondLayout/img_20.jpeg" alt="">
        <span>20</span>
      </div>
      <div class="wide">
        <img src="/gost/No30_DiamondLayout/img_21.jpeg" alt="">
        <span>21</span>
      </div>
      <div class="big">
        <img src="/gost/No30_DiamondLayout/img_22.jpeg" alt="">
        <span>22</span>
      </div>
      <div>
        <img src="/gost/No30_DiamondLayout/img_23.jpeg" alt="">
        <span>23</span>
      </div>
      <div>
        <img src="/gost/No30_DiamondLayout/img_24.jpeg" alt="">
        <span>24</span>
      </div>
      <div class="big">
        <img src="/gost/No30_DiamondLayout/img_25.jpeg" alt="">
        <span>25</span>
      </div>
      <div class="tall">
        <img src="/gost/No30_DiamondLayout/img_39.jpeg" alt="">
        <span>26</span>
      </div>
      <div>
        <img src="/gost/No30_DiamondLayout/img_27.jpeg" alt="">
        <span>27</span>
      </div>
      <div>
        <img src="/gost/No30_DiamondLayout/img_28.jpeg" alt="">
        <span>28</span>
      </div>
      <div>
        <img src="/gost/No30_DiamondLayout/img_29.jpeg" alt="">
        <span>29</span>
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
  background-color: rgb(235, 151, 151);
}
img {
  width: 100%;
  height: 100%;
  vertical-align: middle;
  display: inline-block;
}
.shell {
  display: grid;
  padding: 20px;
  grid-gap: 20px;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  grid-auto-rows: 270px;
  grid-auto-flow: dense;
}
.shell > div {
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: rgb(61, 51, 51);
  border-radius: 5px;
  color: rgb(255, 255, 255);
  font: 100 100px 'Kristen ITC';
  position: relative;
}
span {
  position: absolute;
  top: -10px;
  left: 30px;
  text-shadow: -5px 0 rgb(0, 0, 0), 0 5px rgb(0, 0, 0), 5px 0 rgb(0, 0, 0), 0 -5px rgb(0, 0, 0);
}
.shell .wide {
  grid-column: span 2;
}
.shell .tall {
  grid-row: span 2;
}
.shell .big {
  grid-column: span 2;
  grid-row: span 2;
}
</style>
