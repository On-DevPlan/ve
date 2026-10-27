<script setup lang="ts">
// pages/login/LoginPage.vue —— 登录页(统一身份认证入口)。
//
// 登录/注册已迁到认证中心 go-ah(auth-hub):本页只负责"发起" —— 生成 PKCE 后
// 整页跳到认证中心的授权端点,认证中心承担登录与注册(凭邀请码),完成后
// 302 回 /oidc/callback(OidcCallbackPage.vue)换本系统 JWT。
//
// 路由式入口:
//   - 普通路由页面,/login 直接渲染
//   - 关闭走 router.replace(from || '/')(记下 query.from 让用户回来)
//   - from 原目标路径经 sessionStorage 跨全站跳转传递(见 api/http/oidc.ts)

import { onMounted, onBeforeUnmount, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { jwtAuth } from '@/api/http/auth-store';
import { closeLoginModal } from '@/shared/useLoginModal';
import { startCanvas } from '@/shared/canvas-engine';
import './login-page.css';

const route = useRoute();
const router = useRouter();

const error = ref<string | null>(null);
const redirecting = ref(false);

const canvasRef = ref<HTMLCanvasElement | null>(null);
let engine: { destroy(): void } | null = null;

function ensureEngine() {
  if (canvasRef.value && !engine) engine = startCanvas(canvasRef.value);
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') close();
}

function close() {
  const from = typeof route.query.from === 'string' ? route.query.from : '/';
  closeLoginModal();
  router.replace(from);
}

onMounted(() => {
  ensureEngine();
  window.addEventListener('keydown', onKeydown);
});
onBeforeUnmount(() => {
  engine?.destroy();
  engine = null;
  window.removeEventListener('keydown', onKeydown);
});

/** 发起统一身份登录 —— 整页跳转认证中心,正常不返回(浏览器已离站)。 */
async function beginLogin() {
  error.value = null;
  redirecting.value = true;
  const from = typeof route.query.from === 'string' ? route.query.from : '/';
  try {
    await jwtAuth.beginOidcLogin(from);
  } catch {
    // beginOidcLogin 已把 lastError 写进 store;整页跳转失败才会走到这
    redirecting.value = false;
    error.value = jwtAuth.state.lastError ?? '无法发起统一身份登录';
  }
}
</script>

<template>
  <div class="sl-sl-login-page">
    <canvas
      ref="canvasRef"
      class="sl-sl-canvas"
    />
    <div class="sl-sl-grain" />
    <div class="sl-sl-vignette" />
    <div class="sl-sl-cursor" />

    <div class="sl-sl-form-wrap">
      <div class="sl-sl-card">
        <button
          class="sl-sl-modal-close"
          type="button"
          aria-label="关闭"
          title="关闭"
          @click="close"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>

        <h1>登录</h1>
        <p class="sl-sl-sso-sub">
          登录与注册由统一身份认证中心托管
        </p>

        <div
          v-if="error"
          class="sl-sl-error"
        >
          {{ error }}
        </div>

        <button
          class="sl-sl-btn-primary sl-sl-sso-btn"
          type="button"
          :disabled="redirecting"
          @click="beginLogin"
        >
          <span>{{ redirecting ? '正在前往认证中心...' : '统一身份登录' }}</span>
        </button>

        <p class="sl-sl-sso-hint">
          首次使用需在认证中心注册（凭邀请码）。
          <br>
          已有本站账号的邮箱，首次统一登录会自动接管原有数据。
        </p>
      </div>
    </div>
  </div>
</template>
