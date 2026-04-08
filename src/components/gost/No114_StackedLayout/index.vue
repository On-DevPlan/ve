<template>
  <div class="demo-wrapper">
    <main>
      <article style="--index: 0">
        <div class="article__img">
          <img src="/gost/No114_StackedLayout/img/01.jpg" alt="" />
        </div>
        <div class="article__info">
          <h2>我修好了所有的 bug，却没人来修我</h2>
          <p>I fixed every bug in the system, but no one came to fix me.</p>
        </div>
      </article>
      <article style="--index: 1">
        <div class="article__img">
          <img src="/gost/No114_StackedLayout/img/02.jpg" alt="" />
        </div>
        <div class="article__info">
          <h2>你是我逻辑里唯一的死循环</h2>
          <p>You are the only infinite loop in my logic.</p>
        </div>
      </article>
      <article style="--index: 2">
        <div class="article__img">
          <img src="/gost/No114_StackedLayout/img/03.jpg" alt="" />
        </div>
        <div class="article__info">
          <h2>我写的逻辑没有出口，就像你从没回头</h2>
          <p>My code had no exit, just like you never looked back.</p>
        </div>
      </article>
      <article style="--index: 3">
        <div class="article__img">
          <img src="/gost/No114_StackedLayout/img/04.jpg" alt="" />
        </div>
        <div class="article__info">
          <h2>你删我，只需一个 Delete</h2>
          <p>It took you one Delete key to erase me completely.</p>
        </div>
      </article>
      <article style="--index: 4">
        <div class="article__img">
          <img src="/gost/No114_StackedLayout/img/05.jpg" alt="" />
        </div>
        <div class="article__info">
          <h2>我调试了你，却连报错都得不到</h2>
          <p>I tried debugging us, but I never even got an error message.</p>
        </div>
      </article>
      <article style="--index: 5">
        <div class="article__img">
          <img src="/gost/No114_StackedLayout/img/06.jpg" alt="" />
        </div>
        <div class="article__info">
          <h2>你是我没权限访问的目录</h2>
          <p>You are the forbidden directory I never had access to.</p>
        </div>
      </article>
      <article style="--index: 6">
        <div class="article__img">
          <img src="/gost/No114_StackedLayout/img/07.jpg" alt="" />
        </div>
        <div class="article__info">
          <h2>我写的不是代码，是你不曾读懂的注释</h2>
          <p>I wasn't writing code, I was writing comments you never read.</p>
        </div>
      </article>
      <article style="--index: 7">
        <div class="article__img">
          <img src="/gost/No114_StackedLayout/img/08.jpg" alt="" />
        </div>
        <div class="article__info">
          <h2>你说我们不兼容，我却想为你重构整个世界</h2>
          <p>You said we're not compatible, but I was ready to refactor my whole world for you.</p>
        </div>
      </article>
      <article style="--index: 8">
        <div class="article__img">
          <img src="/gost/No114_StackedLayout/img/09.jpg" alt="" />
        </div>
        <div class="article__info">
          <h2>每条想发给你的消息，都像一行注释，最终被我删掉</h2>
          <p>Every message I wanted to send you ended up as a comment I deleted.</p>
        </div>
      </article>
      <article style="--index: 9">
        <div class="article__img">
          <img src="/gost/No114_StackedLayout/img/10.jpg" alt="" />
        </div>
        <div class="article__info">
          <h2>你离开时没有提示，我却还在原地等待加载</h2>
          <p>You left without a warning, and I'm still here loading endlessly.</p>
        </div>
      </article>
    </main>
  </div>
</template>

<style scoped>
.demo-wrapper {
  width: 100vw;
  overflow: auto;
  margin: 0;
  display: grid;
  place-items: center;
  min-height: 100vh;
}

* {
  padding: 0;
  margin: 0;
  box-sizing: border-box;
}

main {
  width: 100%;
}

article {
  max-width: 100vw;
  height: 100vh;
  display: grid;
  grid-template-rows: 60vh 40vh;
}

article img {
  object-fit: cover;
  width: 100%;
  height: 100%;
  height: 60vh;
}

.article__img {
  position: sticky;
  top: 0;
  left: 0;
  right: 0;
  height: 40vh;
}

main h2 {
  font-size: 2rem;
}

main p {
  font-size: 1.5rem;
}

.article__info {
  text-align: center;
  z-index: 2;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 0.5rem;
  height: 40vh;
  background: canvas;
}
</style>
