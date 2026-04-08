<template>
  <div class="demo-wrapper">
    <main>
      <section>
        <img src="/gost/No104_ParallaxAlbum/img/01.jpg" />
        <img src="/gost/No104_ParallaxAlbum/img/02.jpg" />
        <img src="/gost/No104_ParallaxAlbum/img/03.jpg" />
        <img src="/gost/No104_ParallaxAlbum/img/04.jpg" />
        <img src="/gost/No104_ParallaxAlbum/img/05.jpg" />
        <img src="/gost/No104_ParallaxAlbum/img/06.jpg" />
        <img src="/gost/No104_ParallaxAlbum/img/19.jpg" />
      </section>
      <section>
        <img src="/gost/No104_ParallaxAlbum/img/07.jpg" />
        <img src="/gost/No104_ParallaxAlbum/img/08.jpg" />
        <img src="/gost/No104_ParallaxAlbum/img/09.jpg" />
        <img src="/gost/No104_ParallaxAlbum/img/10.jpg" />
        <img src="/gost/No104_ParallaxAlbum/img/11.jpg" />
        <img src="/gost/No104_ParallaxAlbum/img/12.jpg" />
        <img src="/gost/No104_ParallaxAlbum/img/20.jpg" />
      </section>
      <section>
        <img src="/gost/No104_ParallaxAlbum/img/13.jpg" />
        <img src="/gost/No104_ParallaxAlbum/img/14.jpg" />
        <img src="/gost/No104_ParallaxAlbum/img/15.jpg" />
        <img src="/gost/No104_ParallaxAlbum/img/16.jpg" />
        <img src="/gost/No104_ParallaxAlbum/img/17.jpg" />
        <img src="/gost/No104_ParallaxAlbum/img/18.jpg" />
        <img src="/gost/No104_ParallaxAlbum/img/21.jpg" />
      </section>
    </main>
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
  background-color: #fffaff;
}

* {
  padding: 0;
  margin: 0;
}

main {
  display: grid;
  gap: 2rem;
  grid-template-columns: repeat(3, 500px);
  overflow-y: hidden;
  padding: 50px;
}

section {
  display: flex;
  gap: 2rem;
  flex-direction: column;
}

section:nth-child(1),
section:nth-child(3) {
  animation: scroller linear;
  animation-timeline: scroll(root);
  flex-direction: column-reverse;
  translate: 0% calc(-100% + 100vh);
}

section img {
  box-shadow: 0 0 10px #0002;
  border-radius: 5px;
  transition: .3s;
}

section img:hover {
  transform: scale(1.05);
  box-shadow: 0 0 20px rgba(150, 50, 50, 0.5);
}

@keyframes scroller {
  to {
    translate: 0% calc(100% - 100vh);
  }
}
</style>
