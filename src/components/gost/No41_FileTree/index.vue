<script setup>
</script>

<template>
  <div class="demo-wrapper">
    <div class="shell">
      <details open>
        <summary>Final assignment</summary>
        <div class="folder">
          <p>index.html</p>
          <details open>
            <summary>style</summary>
            <div class="folder">
              <details>
                <summary>css</summary>
                <div class="folder">
                  <p>index.css</p>
                  <p>all.css</p>
                </div>
              </details>
              <details open>
                <summary>js</summary>
                <div class="folder">
                  <p>index.js</p>
                  <p>effect.js</p>
                  <p>all.js</p>
                </div>
              </details>
              <details open>
                <summary>img</summary>
                <div class="folder">
                  <p>background.png</p>
                  <p>logo.png</p>
                  <div class="img-placeholder"></div>
                </div>
              </details>
            </div>
          </details>
          <details open>
            <summary>file</summary>
            <div class="folder">
              <p>Implementation principle.docx</p>
              <p>element.xlsx</p>
            </div>
          </details>
        </div>
      </details>
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
  background: #223;
  color: #aaa;
}

.shell {
  position: relative;
  display: block;
  width: 700px;
}

details {
  position: relative;
  width: auto;
  height: auto;
  overflow: hidden;
  max-height: 2.5em !important;
  transition: 1s;
}

details[open] {
  max-height: 700px !important;
}

details > summary {
  position: relative;
  margin-top: 0.25em;
  color: #99e;
  padding: 0.1em .5em .2em;
  background-color: #444;
}

details > summary::before {
  content: '⊞';
  color: #eee;
  margin-right: 0.5em;
}

details[open] > summary {
  background-color: #66e;
  color: #fff;
}

details[open] > summary::before {
  content: '⊟';
  color: #fff;
}

.folder {
  border-left: 3px dotted #fff;
  border-bottom: 3px dotted #fff;
  margin: 0 0 10px 10px;
  padding: 10px 0 10px 20px;
}

.img-placeholder {
  height: 50px;
  margin: 10px 0;
  background: #555;
  width: 80px;
}
</style>
