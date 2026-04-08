<script setup>
</script>

<template>
  <div class="demo-wrapper">
    <div class="a">
      <div class="b"></div>
      <div class="c">
        <div class="d">
          <h1>Login/Register</h1>
          <input type="text" class="e" placeholder="USER NAME">
          <input type="text" class="e" placeholder="ACCOUNT">
          <input type="password" class="e" placeholder="PASSWORD">
          <a href="#" class="f">Forget the passrword?</a>
          <a href="#" class="g">Login</a>
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
  background-image: linear-gradient(to left, #9c88ff, #3cadeb);
  display: flex;
  justify-content: center;
}
.a {
  position: relative;
  top: 100px;
  width: 1100px;
  height: 550px;
  box-shadow: 0 5px 15px rgba(0,0,0,.8);
  display: flex;
}
.b {
  width: 800px;
  height: 550px;
  background-image: url("/gost/No13_MinimalLogin/201515-158211451517f1.jpg");
  background-size: cover;
}
.c {
  width: 300px;
  height: 550px;
  background-color: white;
  display: flex;
  justify-content: center;
  align-items: center;
}
.d {
  width: 250px;
  height: 500px;
}
.d h1 {
  font: 900 30px '';
}
.e {
  width: 230px;
  margin: 20px 0;
  outline: none;
  border: 0;
  padding: 10px;
  border-bottom: 3px solid rgb(80,80,170);
  font: 900 16px '';
}
.f {
  float: right;
  margin: 10px 0;
}
.g {
  position: absolute;
  margin: 20px;
  bottom: 40px;
  display: block;
  width: 200px;
  height: 60px;
  font: 900 30px '';
  text-decoration: none;
  line-height: 50px;
  border-radius: 30px;
  background-image: linear-gradient(to left, #9c88ff, #3cadeb);
  text-align: center;
}
</style>
