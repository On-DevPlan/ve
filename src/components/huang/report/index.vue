<script setup>
import { ref, reactive } from 'vue'

// 粉丝数据
const fanData = reactive({
  // 基本信息
  username: '小黄粉',
  year: new Date().getFullYear(),
  avatar: '',

  // 个人标语
  slogan: '这一年，我追过的光，都在这里',

  // 演唱会记录
  concerts: [
    { artist: '周杰伦', date: '2024-03-15', venue: '北京工人体育场', songs: ['晴天', '七里香', '稻香'] },
    { artist: '五月天', date: '2024-07-20', venue: '上海体育场', songs: ['倔强', '知足', '温柔'] }
  ],

  // 观看视频
  videos: [
    { title: '某UP主年度合集', platform: 'B站', views: '10万+', duration: '45分钟' },
    { title: '偶像vlog日常', platform: '抖音', views: '50万+', duration: '3分钟' },
    { title: '综艺正片', platform: '爱奇艺', views: '-', duration: '90分钟' }
  ],

  // 观看电影
  movies: [
    { title: '流浪地球2', rating: 9.2, date: '2024-02-10', comment: '太震撼了！' },
    { title: '满江红', rating: 8.0, date: '2024-01-25', comment: '剧情反转' }
  ],

  // 阅读记录
  books: [
    { title: '三体', author: '刘慈欣', pages: 302, rating: 9.5 },
    { title: '活着', author: '余华', pages: 191, rating: 9.4 }
  ],

  // 综艺节目
  varieties: [
    { name: '歌手2024', episodes: 12, favorite: '那英' },
    { name: '奔跑吧', episodes: 10, favorite: '全员' }
  ],

  // 数据统计
  stats: {
    concertHours: 8,
    videoHours: 120,
    movieCount: 15,
    bookPages: 2500,
    varietyEpisodes: 30
  },

  // 年度最爱
  favorites: {
    artist: '周杰伦',
    song: '最伟大的作品',
    movie: '流浪地球2',
    variety: '歌手2024',
    vlogger: '某UP主'
  },

  // 粉丝等级
  fanLevel: '资深粉丝',
  fanYears: 5
})

// 新增演唱会
const newConcert = reactive({ artist: '', date: '', venue: '', songs: '' })
const addConcert = () => {
  if (newConcert.artist) {
    fanData.concerts.push({
      ...newConcert,
      songs: newConcert.songs.split(/[,，]/).map(s => s.trim()).filter(Boolean)
    })
    Object.assign(newConcert, { artist: '', date: '', venue: '', songs: '' })
  }
}
const removeConcert = (index) => fanData.concerts.splice(index, 1)

// 新增视频
const newVideo = reactive({ title: '', platform: 'B站', views: '', duration: '' })
const addVideo = () => {
  if (newVideo.title) {
    fanData.videos.push({ ...newVideo })
    Object.assign(newVideo, { title: '', platform: 'B站', views: '', duration: '' })
  }
}
const removeVideo = (index) => fanData.videos.splice(index, 1)

// 新增电影
const newMovie = reactive({ title: '', rating: 8, date: '', comment: '' })
const addMovie = () => {
  if (newMovie.title) {
    fanData.movies.push({ ...newMovie })
    Object.assign(newMovie, { title: '', rating: 8, date: '', comment: '' })
  }
}
const removeMovie = (index) => fanData.movies.splice(index, 1)

// 新增书籍
const newBook = reactive({ title: '', author: '', pages: 0, rating: 8 })
const addBook = () => {
  if (newBook.title) {
    fanData.books.push({ ...newBook })
    Object.assign(newBook, { title: '', author: '', pages: 0, rating: 8 })
  }
}
const removeBook = (index) => fanData.books.splice(index, 1)

// 新增综艺
const newVariety = reactive({ name: '', episodes: 0, favorite: '' })
const addVariety = () => {
  if (newVariety.name) {
    fanData.varieties.push({ ...newVariety })
    Object.assign(newVariety, { name: '', episodes: 0, favorite: '' })
  }
}
const removeVariety = (index) => fanData.varieties.splice(index, 1)

// 主题
const themes = [
  { name: '网易云红', primary: '#ec4141', secondary: '#c72c2c', bg: '#f8f8f8', accent: '#ff6b6b' },
  { name: 'B站粉', primary: '#fb7299', secondary: '#e45e85', bg: '#fff5f8', accent: '#23ade5' },
  { name: '抖音紫', primary: '#7c4dff', secondary: '#651fff', bg: '#f3e5f5', accent: '#00d4aa' },
  { name: 'QQ音乐绿', primary: '#31c27c', secondary: '#24a563', bg: '#f0fdf9', accent: '#ffc107' },
  { name: '极夜黑', primary: '#b886fd', secondary: '#9b6cfd', bg: '#121212', accent: '#00e5ff' }
]
const currentTheme = ref(themes[0])

// 导出
const exportReport = () => window.print()
</script>

<template>
  <div class="fan-report-generator">
    <!-- 左侧编辑区 -->
    <div class="editor-panel">
      <div class="panel-header">
        <h2>🎵 粉丝年报编辑器</h2>
        <button class="export-btn" @click="exportReport">📤 导出</button>
      </div>

      <div class="editor-content">
        <!-- 主题选择 -->
        <section class="form-section">
          <h3>🎨 选择主题</h3>
          <div class="theme-selector">
            <div
              v-for="theme in themes"
              :key="theme.name"
              class="theme-option"
              :class="{ active: currentTheme.name === theme.name }"
              :style="{ '--primary': theme.primary }"
              @click="currentTheme = theme"
            >
              <span>{{ theme.name }}</span>
            </div>
          </div>
        </section>

        <!-- 基本信息 -->
        <section class="form-section">
          <h3>👤 基本信息</h3>
          <div class="form-group">
            <label>昵称</label>
            <input v-model="fanData.username" type="text">
          </div>
          <div class="form-group">
            <label>年度</label>
            <input v-model.number="fanData.year" type="number">
          </div>
          <div class="form-group">
            <label>个人标语</label>
            <textarea v-model="fanData.slogan" rows="2"></textarea>
          </div>
          <div class="form-group">
            <label>粉龄（年）</label>
            <input v-model.number="fanData.fanYears" type="number">
          </div>
          <div class="form-group">
            <label>粉丝等级</label>
            <select v-model="fanData.fanLevel">
              <option>新粉</option>
              <option>铁粉</option>
              <option selected>资深粉丝</option>
              <option>骨灰级粉丝</option>
              <option>元老级粉丝</option>
            </select>
          </div>
        </section>

        <!-- 数据统计 -->
        <section class="form-section">
          <h3>📊 年度数据</h3>
          <div class="form-row">
            <div class="form-group">
              <label>演唱会时长</label>
              <input v-model.number="fanData.stats.concertHours" type="number">
            </div>
            <div class="form-group">
              <label>观看视频(小时)</label>
              <input v-model.number="fanData.stats.videoHours" type="number">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>看电影数</label>
              <input v-model.number="fanData.stats.movieCount" type="number">
            </div>
            <div class="form-group">
              <label>阅读页数</label>
              <input v-model.number="fanData.stats.bookPages" type="number">
            </div>
          </div>
          <div class="form-group">
            <label>综艺集数</label>
            <input v-model.number="fanData.stats.varietyEpisodes" type="number">
          </div>
        </section>

        <!-- 年度最爱 -->
        <section class="form-section">
          <h3>⭐ 年度最爱</h3>
          <div class="form-group">
            <label>最爱的歌手/艺人</label>
            <input v-model="fanData.favorites.artist" type="text">
          </div>
          <div class="form-group">
            <label>最爱的歌曲</label>
            <input v-model="fanData.favorites.song" type="text">
          </div>
          <div class="form-group">
            <label>最爱的电影</label>
            <input v-model="fanData.favorites.movie" type="text">
          </div>
          <div class="form-group">
            <label>最爱的综艺</label>
            <input v-model="fanData.favorites.variety" type="text">
          </div>
          <div class="form-group">
            <label>最爱的UP主/博主</label>
            <input v-model="fanData.favorites.vlogger" type="text">
          </div>
        </section>

        <!-- 演唱会 -->
        <section class="form-section">
          <h3>🎤 演唱会记录</h3>
          <div class="item-list">
            <div v-for="(item, i) in fanData.concerts" :key="i" class="item-card">
              <span>{{ item.artist }} - {{ item.date }}</span>
              <button class="remove-btn" @click="removeConcert(i)">×</button>
            </div>
          </div>
          <div class="form-row">
            <input v-model="newConcert.artist" placeholder="歌手">
            <input v-model="newConcert.date" placeholder="日期" type="date">
            <input v-model="newConcert.venue" placeholder="场馆">
          </div>
          <input v-model="newConcert.songs" placeholder="听到的歌（逗号分隔）" style="margin-top: 8px">
          <button class="add-btn full" @click="addConcert">+ 添加演唱会</button>
        </section>

        <!-- 视频 -->
        <section class="form-section">
          <h3>📺 视频记录</h3>
          <div class="item-list">
            <div v-for="(item, i) in fanData.videos" :key="i" class="item-card">
              <span>{{ item.title }} ({{ item.platform }})</span>
              <button class="remove-btn" @click="removeVideo(i)">×</button>
            </div>
          </div>
          <div class="form-row">
            <input v-model="newVideo.title" placeholder="视频标题" style="flex: 2">
            <select v-model="newVideo.platform">
              <option>B站</option>
              <option>抖音</option>
              <option>快手</option>
              <option>爱奇艺</option>
              <option>优酷</option>
              <option>腾讯视频</option>
            </select>
          </div>
          <div class="form-row" style="margin-top: 8px">
            <input v-model="newVideo.views" placeholder="播放量">
            <input v-model="newVideo.duration" placeholder="时长">
          </div>
          <button class="add-btn full" @click="addVideo">+ 添加视频</button>
        </section>

        <!-- 电影 -->
        <section class="form-section">
          <h3>🎬 电影记录</h3>
          <div class="item-list">
            <div v-for="(item, i) in fanData.movies" :key="i" class="item-card">
              <span>{{ item.title }} ⭐{{ item.rating }}</span>
              <button class="remove-btn" @click="removeMovie(i)">×</button>
            </div>
          </div>
          <div class="form-row">
            <input v-model="newMovie.title" placeholder="电影名称" style="flex: 2">
            <input v-model.number="newMovie.rating" type="number" step="0.1" min="0" max="10" placeholder="评分">
            <input v-model="newMovie.date" type="date">
          </div>
          <input v-model="newMovie.comment" placeholder="短评" style="margin-top: 8px">
          <button class="add-btn full" @click="addMovie">+ 添加电影</button>
        </section>

        <!-- 书籍 -->
        <section class="form-section">
          <h3>📚 阅读记录</h3>
          <div class="item-list">
            <div v-for="(item, i) in fanData.books" :key="i" class="item-card">
              <span>《{{ item.title }}》{{ item.author }}</span>
              <button class="remove-btn" @click="removeBook(i)">×</button>
            </div>
          </div>
          <div class="form-row">
            <input v-model="newBook.title" placeholder="书名" style="flex: 2">
            <input v-model="newBook.author" placeholder="作者">
          </div>
          <div class="form-row" style="margin-top: 8px">
            <input v-model.number="newBook.pages" type="number" placeholder="页数">
            <input v-model.number="newBook.rating" type="number" step="0.1" min="0" max="10" placeholder="评分">
          </div>
          <button class="add-btn full" @click="addBook">+ 添加书籍</button>
        </section>

        <!-- 综艺 -->
        <section class="form-section">
          <h3>🎪 综艺记录</h3>
          <div class="item-list">
            <div v-for="(item, i) in fanData.varieties" :key="i" class="item-card">
              <span>{{ item.name }} ({{ item.episodes }}集)</span>
              <button class="remove-btn" @click="removeVariety(i)">×</button>
            </div>
          </div>
          <div class="form-row">
            <input v-model="newVariety.name" placeholder="综艺名称" style="flex: 2">
            <input v-model.number="newVariety.episodes" type="number" placeholder="集数">
          </div>
          <input v-model="newVariety.favorite" placeholder="最喜欢的嘉宾/选手" style="margin-top: 8px">
          <button class="add-btn full" @click="addVariety">+ 添加综艺</button>
        </section>
      </div>
    </div>

    <!-- 右侧预览区 -->
    <div class="preview-panel">
      <div class="preview-content" :style="{
        '--primary': currentTheme.primary,
        '--secondary': currentTheme.secondary,
        '--bg': currentTheme.bg,
        '--accent': currentTheme.accent,
        '--text': currentTheme.name === '极夜黑' ? '#e0e0e0' : '#333',
        '--text-light': currentTheme.name === '极夜黑' ? '#999' : '#666'
      }">
        <!-- 封面页 -->
        <div class="cover-page">
          <div class="cover-bg"></div>
          <div class="cover-content">
            <div class="year-badge">{{ fanData.year }}</div>
            <h1 class="cover-title">年度报告</h1>
            <p class="cover-slogan">{{ fanData.slogan }}</p>
            <div class="cover-avatar">
              <span>{{ fanData.username.charAt(0) }}</span>
            </div>
            <p class="cover-username">{{ fanData.username }}</p>
            <div class="cover-meta">
              <span class="fan-badge">{{ fanData.fanLevel }}</span>
              <span class="fan-years">{{ fanData.fanYears }}年粉龄</span>
            </div>
          </div>
        </div>

        <!-- 数据概览 -->
        <div class="stats-section">
          <h2 class="section-title">📊 这一年，你的数据</h2>
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-icon">🎤</div>
              <div class="stat-value">{{ fanData.stats.concertHours }}</div>
              <div class="stat-label">小时演唱会</div>
            </div>
            <div class="stat-card">
              <div class="stat-icon">📺</div>
              <div class="stat-value">{{ fanData.stats.videoHours }}</div>
              <div class="stat-label">小时视频</div>
            </div>
            <div class="stat-card">
              <div class="stat-icon">🎬</div>
              <div class="stat-value">{{ fanData.stats.movieCount }}</div>
              <div class="stat-label">部电影</div>
            </div>
            <div class="stat-card">
              <div class="stat-icon">📚</div>
              <div class="stat-value">{{ fanData.stats.bookPages }}</div>
              <div class="stat-label">页阅读</div>
            </div>
          </div>
          <div class="highlight-stat">
            <span class="highlight-label">观看综艺</span>
            <span class="highlight-value">{{ fanData.stats.varietyEpisodes }} <small>集</small></span>
          </div>
        </div>

        <!-- 演唱会 -->
        <div class="section-card" v-if="fanData.concerts.length">
          <h2 class="section-title">🎤 现场回忆</h2>
          <p class="section-subtitle">这一年，你赴了 {{ fanData.concerts.length }} 场音乐之约</p>
          <div class="concert-list">
            <div v-for="(concert, i) in fanData.concerts" :key="i" class="concert-card">
              <div class="concert-date">{{ concert.date }}</div>
              <div class="concert-info">
                <h3>{{ concert.artist }}</h3>
                <p>{{ concert.venue }}</p>
                <div class="concert-songs">
                  <span v-for="song in concert.songs" :key="song" class="song-tag">{{ song }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 视频记录 -->
        <div class="section-card" v-if="fanData.videos.length">
          <h2 class="section-title">📺 屏幕时光</h2>
          <p class="section-subtitle">收藏的精彩视频</p>
          <div class="video-grid">
            <div v-for="(video, i) in fanData.videos" :key="i" class="video-card">
              <div class="video-platform" :class="video.platform">{{ video.platform }}</div>
              <h4>{{ video.title }}</h4>
              <div class="video-meta">
                <span v-if="video.views !== '-'">👁 {{ video.views }}</span>
                <span>⏱ {{ video.duration }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 电影记录 -->
        <div class="section-card" v-if="fanData.movies.length">
          <h2 class="section-title">🎬 光影故事</h2>
          <p class="section-subtitle">{{ fanData.stats.movieCount }} 部电影的陪伴</p>
          <div class="movie-timeline">
            <div v-for="(movie, i) in fanData.movies" :key="i" class="movie-item">
              <div class="timeline-dot"></div>
              <div class="movie-info">
                <div class="movie-header">
                  <h4>{{ movie.title }}</h4>
                  <span class="movie-rating">⭐ {{ movie.rating }}</span>
                </div>
                <p class="movie-date">{{ movie.date }}</p>
                <p v-if="movie.comment" class="movie-comment">{{ movie.comment }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- 阅读记录 -->
        <div class="section-card" v-if="fanData.books.length">
          <h2 class="section-title">📚 阅读足迹</h2>
          <p class="section-subtitle">累计阅读 {{ fanData.stats.bookPages }} 页</p>
          <div class="book-shelf">
            <div v-for="(book, i) in fanData.books" :key="i" class="book-card">
              <div class="book-cover">
                <span class="book-title">{{ book.title.substring(0, 2) }}</span>
              </div>
              <div class="book-info">
                <h4>{{ book.title }}</h4>
                <p>{{ book.author }}</p>
                <span class="book-rating">⭐ {{ book.rating }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 综艺记录 -->
        <div class="section-card" v-if="fanData.varieties.length">
          <h2 class="section-title">🎪 综艺时光</h2>
          <div class="variety-grid">
            <div v-for="(variety, i) in fanData.varieties" :key="i" class="variety-card">
              <div class="variety-cover">{{ variety.name.substring(0, 1) }}</div>
              <div class="variety-info">
                <h4>{{ variety.name }}</h4>
                <p>{{ variety.episodes }} 集</p>
                <span v-if="variety.favorite" class="variety-fav">💝 最爱: {{ variety.favorite }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 年度最爱 -->
        <div class="favorites-section">
          <h2 class="section-title">⭐ 年度最爱 TOP5</h2>
          <div class="favorites-list">
            <div class="favorite-item">
              <span class="favorite-icon">🎤</span>
              <div class="favorite-info">
                <span class="favorite-label">最爱的歌手</span>
                <span class="favorite-value">{{ fanData.favorites.artist }}</span>
              </div>
            </div>
            <div class="favorite-item">
              <span class="favorite-icon">🎵</span>
              <div class="favorite-info">
                <span class="favorite-label">最爱的歌曲</span>
                <span class="favorite-value">{{ fanData.favorites.song }}</span>
              </div>
            </div>
            <div class="favorite-item">
              <span class="favorite-icon">🎬</span>
              <div class="favorite-info">
                <span class="favorite-label">最爱的电影</span>
                <span class="favorite-value">{{ fanData.favorites.movie }}</span>
              </div>
            </div>
            <div class="favorite-item">
              <span class="favorite-icon">🎪</span>
              <div class="favorite-info">
                <span class="favorite-label">最爱的综艺</span>
                <span class="favorite-value">{{ fanData.favorites.variety }}</span>
              </div>
            </div>
            <div class="favorite-item">
              <span class="favorite-icon">📺</span>
              <div class="favorite-info">
                <span class="favorite-label">最爱的UP主</span>
                <span class="favorite-value">{{ fanData.favorites.vlogger }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 结尾 -->
        <div class="ending-section">
          <div class="ending-content">
            <h2>感谢 {{ fanData.year }} 年的陪伴</h2>
            <p>继续做快乐的粉丝，追更多的光</p>
            <div class="ending-footer">
              <span>📷 Generated with 粉丝年度报告</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fan-report-generator {
  display: flex;
  height: 100vh;
  background: #1a1a1a;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

/* 编辑区 */
.editor-panel {
  width: 380px;
  min-width: 380px;
  background: #252525;
  display: flex;
  flex-direction: column;
  border-right: 1px solid #333;
}

.panel-header {
  padding: 16px;
  background: #1f1f1f;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.panel-header h2 {
  margin: 0;
  font-size: 16px;
  color: #fff;
}

.export-btn {
  padding: 8px 16px;
  background: var(--preview-primary, #ec4141);
  color: white;
  border: none;
  border-radius: 20px;
  cursor: pointer;
  font-size: 13px;
}

.editor-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.editor-content::-webkit-scrollbar {
  width: 5px;
}

.editor-content::-webkit-scrollbar-thumb {
  background: #444;
  border-radius: 3px;
}

.form-section {
  background: #333;
  border-radius: 10px;
  padding: 14px;
  margin-bottom: 14px;
}

.form-section h3 {
  margin: 0 0 12px 0;
  font-size: 13px;
  color: #fff;
  display: flex;
  align-items: center;
  gap: 6px;
}

.form-group {
  margin-bottom: 10px;
}

.form-group label {
  display: block;
  font-size: 11px;
  color: #999;
  margin-bottom: 4px;
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 8px 10px;
  background: #1f1f1f;
  border: 1px solid #444;
  border-radius: 6px;
  color: #fff;
  font-size: 12px;
  box-sizing: border-box;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: var(--preview-primary, #ec4141);
}

.form-row {
  display: flex;
  gap: 6px;
}

.item-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 10px;
}

.item-card {
  background: #444;
  padding: 8px 10px;
  border-radius: 6px;
  font-size: 11px;
  color: #fff;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.remove-btn {
  background: none;
  border: none;
  color: #ff6b6b;
  cursor: pointer;
  font-size: 18px;
  width: 20px;
  height: 20px;
  padding: 0;
}

.theme-selector {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 6px;
}

.theme-option {
  background: #444;
  border-radius: 6px;
  padding: 8px 4px;
  text-align: center;
  cursor: pointer;
  font-size: 10px;
  color: #999;
  border: 2px solid transparent;
  transition: all 0.2s;
}

.theme-option.active {
  border-color: var(--primary);
  color: #fff;
}

.add-btn {
  background: var(--preview-primary, #ec4141);
  color: white;
  border: none;
  border-radius: 6px;
  padding: 8px;
  cursor: pointer;
  font-size: 12px;
}

.add-btn.full {
  width: 100%;
  margin-top: 8px;
}

/* 预览区 */
.preview-panel {
  flex: 1;
  overflow-y: auto;
}

.preview-content {
  max-width: 480px;
  margin: 0 auto;
  min-height: 100%;
  background: var(--bg, #f8f8f8);
  --primary: #ec4141;
  --secondary: #c72c2c;
  --accent: #ff6b6b;
  --text: #333;
  --text-light: #666;
}

/* 封面页 */
.cover-page {
  position: relative;
  min-height: 90vh;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.cover-bg {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
}

.cover-bg::before {
  content: '';
  position: absolute;
  inset: 0;
  background: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
}

.cover-content {
  position: relative;
  text-align: center;
  color: white;
  padding: 40px;
}

.year-badge {
  display: inline-block;
  font-size: 80px;
  font-weight: 900;
  line-height: 1;
  margin-bottom: 20px;
  text-shadow: 0 4px 20px rgba(0,0,0,0.3);
}

.cover-title {
  font-size: 42px;
  font-weight: 700;
  margin: 0 0 16px 0;
}

.cover-slogan {
  font-size: 18px;
  opacity: 0.9;
  margin: 0 0 40px 0;
  font-weight: 300;
}

.cover-avatar {
  width: 100px;
  height: 100px;
  margin: 0 auto 20px;
  border-radius: 50%;
  background: rgba(255,255,255,0.2);
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40px;
  font-weight: bold;
  border: 4px solid rgba(255,255,255,0.3);
}

.cover-username {
  font-size: 24px;
  font-weight: 600;
  margin: 0 0 16px 0;
}

.cover-meta {
  display: flex;
  justify-content: center;
  gap: 12px;
}

.fan-badge {
  background: rgba(255,255,255,0.25);
  padding: 6px 16px;
  border-radius: 20px;
  font-size: 14px;
}

.fan-years {
  background: var(--accent);
  padding: 6px 16px;
  border-radius: 20px;
  font-size: 14px;
}

/* 通用区块 */
.section-card {
  background: white;
  border-radius: 20px;
  padding: 28px;
  margin: 20px 16px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.06);
}

.section-title {
  font-size: 28px;
  font-weight: 700;
  color: var(--text);
  margin: 0 0 12px 0;
}

.section-subtitle {
  color: var(--text-light);
  margin: 0 0 24px 0;
  font-size: 14px;
}

/* 数据统计 */
.stats-section {
  padding: 28px 16px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}

.stat-card {
  background: white;
  border-radius: 16px;
  padding: 20px;
  text-align: center;
  box-shadow: 0 2px 12px rgba(0,0,0,0.06);
}

.stat-icon {
  font-size: 28px;
  margin-bottom: 8px;
}

.stat-value {
  font-size: 32px;
  font-weight: 700;
  color: var(--primary);
  line-height: 1;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 12px;
  color: var(--text-light);
}

.highlight-stat {
  background: linear-gradient(135deg, var(--primary), var(--secondary));
  border-radius: 16px;
  padding: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: white;
}

.highlight-label {
  font-size: 14px;
  opacity: 0.9;
}

.highlight-value {
  font-size: 28px;
  font-weight: 700;
}

.highlight-value small {
  font-size: 14px;
  font-weight: 400;
}

/* 演唱会 */
.concert-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.concert-card {
  display: flex;
  gap: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid #f0f0f0;
}

.concert-card:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.concert-date {
  width: 50px;
  height: 50px;
  background: var(--primary);
  color: white;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  flex-shrink: 0;
}

.concert-info h3 {
  margin: 0 0 4px 0;
  font-size: 18px;
  color: var(--text);
}

.concert-info p {
  margin: 0 0 8px 0;
  font-size: 13px;
  color: var(--text-light);
}

.concert-songs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.song-tag {
  background: rgba(236, 65, 65, 0.1);
  color: var(--primary);
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 11px;
}

/* 视频 */
.video-grid {
  display: grid;
  gap: 12px;
}

.video-card {
  background: var(--bg);
  border-radius: 12px;
  padding: 16px;
}

.video-platform {
  display: inline-block;
  font-size: 10px;
  padding: 3px 8px;
  border-radius: 10px;
  margin-bottom: 8px;
}

.video-platform.B站 { background: #00a1d6; color: white; }
.video-platform.抖音 { background: #000; color: white; }
.video-platform.快手 { background: #ff6b00; color: white; }
.video-platform.爱奇艺 { background: #00be06; color: white; }
.video-platform.优酷 { background: #1e88e5; color: white; }
.video-platform.腾讯视频 { background: #ff672d; color: white; }

.video-card h4 {
  margin: 0 0 8px 0;
  font-size: 15px;
  color: var(--text);
}

.video-meta {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: var(--text-light);
}

/* 电影 */
.movie-timeline {
  position: relative;
}

.movie-item {
  display: flex;
  gap: 16px;
  margin-bottom: 20px;
}

.timeline-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--primary);
  margin-top: 4px;
  flex-shrink: 0;
  position: relative;
}

.timeline-dot::after {
  content: '';
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  width: 2px;
  height: calc(100% + 8px);
  background: #f0f0f0;
}

.movie-item:last-child .timeline-dot::after {
  display: none;
}

.movie-info {
  flex: 1;
}

.movie-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.movie-header h4 {
  margin: 0;
  font-size: 16px;
  color: var(--text);
}

.movie-rating {
  background: #ffd700;
  color: #333;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}

.movie-date {
  margin: 0 0 4px 0;
  font-size: 12px;
  color: var(--text-light);
}

.movie-comment {
  margin: 0;
  font-size: 13px;
  color: var(--text);
  font-style: italic;
}

/* 书架 */
.book-shelf {
  display: grid;
  gap: 12px;
}

.book-card {
  display: flex;
  gap: 12px;
  background: var(--bg);
  border-radius: 12px;
  padding: 12px;
}

.book-cover {
  width: 50px;
  height: 70px;
  background: linear-gradient(135deg, var(--primary), var(--secondary));
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 12px;
  font-weight: bold;
  flex-shrink: 0;
}

.book-info {
  flex: 1;
}

.book-info h4 {
  margin: 0 0 4px 0;
  font-size: 15px;
  color: var(--text);
}

.book-info p {
  margin: 0 0 4px 0;
  font-size: 12px;
  color: var(--text-light);
}

.book-rating {
  background: #ffd700;
  padding: 2px 8px;
  border-radius: 8px;
  font-size: 11px;
}

/* 综艺 */
.variety-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.variety-card {
  background: var(--bg);
  border-radius: 12px;
  padding: 14px;
  text-align: center;
}

.variety-cover {
  width: 50px;
  height: 50px;
  margin: 0 auto 10px;
  background: linear-gradient(135deg, var(--accent), var(--primary));
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 20px;
  font-weight: bold;
}

.variety-info h4 {
  margin: 0 0 4px 0;
  font-size: 14px;
  color: var(--text);
}

.variety-info p {
  margin: 0 0 6px 0;
  font-size: 11px;
  color: var(--text-light);
}

.variety-fav {
  display: block;
  font-size: 10px;
  color: var(--primary);
}

/* 年度最爱 */
.favorites-section {
  background: var(--primary);
  border-radius: 20px 20px 0 0;
  padding: 28px 16px;
  color: white;
}

.favorites-section .section-title {
  color: white;
  text-align: center;
}

.favorites-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.favorite-item {
  display: flex;
  align-items: center;
  gap: 16px;
  background: rgba(255,255,255,0.15);
  border-radius: 16px;
  padding: 16px;
}

.favorite-icon {
  font-size: 28px;
  width: 50px;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255,255,255,0.2);
  border-radius: 50%;
}

.favorite-info {
  flex: 1;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.favorite-label {
  font-size: 12px;
  opacity: 0.8;
}

.favorite-value {
  font-size: 16px;
  font-weight: 600;
}

/* 结尾 */
.ending-section {
  background: var(--bg);
  padding: 60px 28px;
  text-align: center;
}

.ending-content h2 {
  margin: 0 0 12px 0;
  font-size: 24px;
  color: var(--text);
}

.ending-content p {
  margin: 0 0 30px 0;
  font-size: 14px;
  color: var(--text-light);
}

.ending-footer {
  font-size: 11px;
  color: var(--text-light);
  opacity: 0.6;
}

/* 打印 */
@media print {
  .editor-panel { display: none; }
  .preview-panel { width: 100%; }
}
</style>
