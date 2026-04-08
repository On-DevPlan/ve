<template>
  <div class="demo-wrapper">
    <div class="neumorphic-panel raised">
      RAISED
    </div>

    <div class="neumorphic-panel pressed">
      PRESSED
    </div>

    <div class="neumorphic-panel rounded">
      ROUNDED
    </div>
  </div>
</template>

<style scoped>
.demo-wrapper {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  margin: 0;
  background-color: #E8EAE9;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3rem;
  padding: 3rem;
  font-family: system-ui, sans-serif;
}

.raised {
  box-shadow:
    -31px -31px 43px 0px rgba(255, 255, 255, 1),
    8px 8px 10px 0px rgba(13, 39, 80, 0.04);
}

.pressed {
  box-shadow:
    -31px -31px 43px 0px rgba(255, 255, 255, 1),
    8px 8px 10px 0px rgba(13, 39, 80, 0.04),
    inset -33px -33px 46px 0px rgba(255, 255, 255, 0.64),
    inset 28px 28px 54px 0px rgba(13, 39, 80, 0.16);
}

.neumorphic-panel {
  width: 300px;
  aspect-ratio: 1;
  background-color: #e8eae9;
  border-radius: 64px;
  display: flex;
  justify-content: center;
  align-items: center;
  color: #ced3d9;
  font-size: 2rem;
  font-weight: 700;
  letter-spacing: 2px;
}
</style>
