<script setup>
</script>

<template>
  <div class="demo-wrapper">
    <div class="shell">
      <div class="left"></div>
      <div class="right">
        <h4>We are<span> GOAT</span></h4>
        <p>Welcome to your arrival, login to your account to enter the page:</p>
        <div class="email">
          <span class="icon">&#9993;</span>
          <input type="email" placeholder="email">
        </div>

        <div class="password">
          <span class="icon">&#128274;</span>
          <input type="password" placeholder="text">
        </div>
        <button>Log in</button>
        <a href="#">Go to Register</a>
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
  justify-content: center;
  align-items: center;
  background-color: #F3F2F2;
  background-image: linear-gradient(to bottom right,
    #91defe,
    #99c0f9,
    #bdb6ec,
    #d7b3e3,
    #efb3d5,
    #f9bccc);
}

.shell {
  display: flex;
  height: 435px;
  background-color: rgb(255, 255, 255);
  box-shadow: 0px 2px 6px -1px rgba(0, 0, 0, 0.3);
  border-radius: 3px;
}

.left {
  width: 220px;
  height: auto;
  background-image: url(/gost/No71_MinimalLogin/img/bg.jpg);
  background-size: cover;
}

.right {
  width: 350px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 40px 30px;
}

.right h4 {
  font-size: 24px;
  color: rgba(0, 0, 0, 0.4);
  margin-bottom: 20px;
}

.right span {
  color: #ABA0E6;
}

.right p {
  max-width: 220px;
  font: 400 14px '';
  margin-bottom: 40px;
}

.email,
.password {
  display: flex;
  height: 56px;
  width: 100%;
}

.icon {
  font-size: 28px;
  line-height: 56px;
  margin-right: 5px;
  color: #D8D8D8;
}

.right input {
  border: none;
  font-size: 16px;
  width: 100%;
  outline: none;
  border-bottom: #ABA0E6 1px dotted;
}

.right button {
  min-width: 100px;
  border-radius: 24px;
  text-align: center;
  padding: 15px 40px;
  background-color: #b08bf8;
  color: #fff;
  font-size: 14px;
  margin-left: auto;
  font-weight: 500;
  box-shadow: 0px 2px 6px -1px rgba(0, 0, 0, 0.13);
  border: none;
  margin-top: 30px;
  cursor: pointer;
}

.right a {
  text-align: right;
  font-size: 10px;
  color: #ABA0E6;
  margin-top: 30px;
  text-decoration: none;
}
</style>
