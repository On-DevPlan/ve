<script setup>
</script>

<template>
  <div class="demo-wrapper">
    <div class="shell">
      <div class="image"><img src="/gost/No21_MasonryLayout/Image/1 (1).jpeg"></div>
      <div class="image"><img src="/gost/No21_MasonryLayout/Image/1 (2).jpeg"></div>
      <div class="image"><img src="/gost/No21_MasonryLayout/Image/1 (3).jpeg"></div>
      <div class="image"><img src="/gost/No21_MasonryLayout/Image/1 (4).jpeg"></div>
      <div class="image"><img src="/gost/No21_MasonryLayout/Image/1 (5).jpeg"></div>
      <div class="image"><img src="/gost/No21_MasonryLayout/Image/1 (6).jpeg"></div>
      <div class="image"><img src="/gost/No21_MasonryLayout/Image/1 (7).jpeg"></div>
      <div class="image"><img src="/gost/No21_MasonryLayout/Image/1 (8).jpeg"></div>
      <div class="image"><img src="/gost/No21_MasonryLayout/Image/1 (9).jpeg"></div>
      <div class="image"><img src="/gost/No21_MasonryLayout/Image/1 (10).jpeg"></div>
      <div class="image"><img src="/gost/No21_MasonryLayout/Image/1 (11).jpeg"></div>
      <div class="image"><img src="/gost/No21_MasonryLayout/Image/1 (12).jpeg"></div>
      <div class="image"><img src="/gost/No21_MasonryLayout/Image/1 (13).jpeg"></div>
      <div class="image"><img src="/gost/No21_MasonryLayout/Image/1 (14).jpeg"></div>
      <div class="image"><img src="/gost/No21_MasonryLayout/Image/1 (15).jpeg"></div>
      <div class="image"><img src="/gost/No21_MasonryLayout/Image/1 (16).jpeg"></div>
      <div class="image"><img src="/gost/No21_MasonryLayout/Image/1 (17).jpeg"></div>
      <div class="image"><img src="/gost/No21_MasonryLayout/Image/1 (18).jpeg"></div>
      <div class="image"><img src="/gost/No21_MasonryLayout/Image/1 (19).jpeg"></div>
      <div class="image"><img src="/gost/No21_MasonryLayout/Image/1 (20).jpeg"></div>
      <div class="image"><img src="/gost/No21_MasonryLayout/Image/1 (21).jpeg"></div>
      <div class="image"><img src="/gost/No21_MasonryLayout/Image/1 (22).jpeg"></div>
      <div class="image"><img src="/gost/No21_MasonryLayout/Image/1 (23).jpeg"></div>
      <div class="image"><img src="/gost/No21_MasonryLayout/Image/1 (24).jpeg"></div>
      <div class="image"><img src="/gost/No21_MasonryLayout/Image/1 (25).jpeg"></div>
      <div class="image"><img src="/gost/No21_MasonryLayout/Image/1 (26).jpeg"></div>
      <div class="image"><img src="/gost/No21_MasonryLayout/Image/1 (27).jpeg"></div>
      <div class="image"><img src="/gost/No21_MasonryLayout/Image/1 (28).jpeg"></div>
      <div class="image"><img src="/gost/No21_MasonryLayout/Image/1 (29).jpeg"></div>
      <div class="image"><img src="/gost/No21_MasonryLayout/Image/1 (30).jpeg"></div>
    </div>
  </div>
</template>

<style scoped>
.demo-wrapper {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  margin: 0;
  background-color: rgba(130, 140, 250, 0.2);
  display: flex;
  justify-content: center;
}
.shell {
  column-count: 5;
  column-gap: 15px;
  width: 100%;
  max-width: 1200px;
  padding: 20px;
}
.image {
  margin-bottom: 15px;
}
.image img {
  width: 100%;
  display: block;
}
@media (max-width:1200px) {
  .shell {
    column-count: 4;
  }
}
@media (max-width:850px) {
  .shell {
    column-count: 3;
  }
}
@media (max-width:600px) {
  .shell {
    column-count: 2;
  }
}
</style>
