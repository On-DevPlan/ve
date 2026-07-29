<!-- 入口文件:让 wb 的 import.meta.glob 能扫到本组件。
     实际实现见 ./gis.vue;这里只是 default re-export。
     用普通 <script> 而不是 <script setup>,因为后者不允许 ES export。 -->
<script>
import Gis from './gis.vue';
export default Gis;
</script>