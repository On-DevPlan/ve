<script setup lang="ts">
// pages/login/LoginPage.vue —— 登录 / 注册路由版(Mœbius 云上登录)。
//
// 之前是 shared/login-modal.vue 模态版(Teleport to body,App.vue 根挂一份)。
// 路由版:
//   - 普通路由页面,/login 直接渲染
//   - 关闭走 router.replace(from || '/')(记下 query.from 让用户回来)
//   - 登录/注册成功 1.5s showWelcome 后自动回来源
//   - 注册走 jwtAuth.register(→ userV1Service.register → 自动 login)

import { onMounted, onBeforeUnmount, ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { jwtAuth } from '@/shared/auth-store';
import { closeLoginModal } from '@/shared/useLoginModal';
import { startCanvas } from '@/shared/canvas-engine';
import './login-page.css';

const route = useRoute();
const router = useRouter();

// mode: 登录 / 注册
const mode = ref<'login' | 'register'>('login');
const email = ref('');
const password = ref('');
const code = ref('');
const invitationCode = ref('');
const nickname = ref('');
const showPwd = ref(false);
const error = ref<string | null>(null);
const submitting = ref(false);
const showWelcome = ref(false);
const cardGone = ref(false);
const codeSent = ref(false);
const codeCooldown = ref(0);
let cooldownTimer: ReturnType<typeof setInterval> | null = null;

const strength = computed(() => {
  const len = password.value.length;
  if (len === 0) return 0;
  if (len < 4) return 1;
  if (len < 8) return 2;
  if (len < 12) return 3;
  return 4;
});

const isRegister = computed(() => mode.value === 'register');

const canvasRef = ref<HTMLCanvasElement | null>(null);
let engine: { destroy(): void } | null = null;
let successTimer: ReturnType<typeof setTimeout> | null = null;

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
  if (successTimer) clearTimeout(successTimer);
  if (cooldownTimer) clearInterval(cooldownTimer);
  engine?.destroy();
  engine = null;
  window.removeEventListener('keydown', onKeydown);
});

function switchMode(m: 'login' | 'register') {
  mode.value = m;
  error.value = null;
  codeSent.value = false;
}

/** 发验证码(注册用;登录不需要)。60s 冷却。 */
async function sendCode() {
  error.value = null;
  if (!email.value) {
    error.value = '请先填邮箱';
    return;
  }
  submitting.value = true;
  try {
    await jwtAuth.sendCode(email.value);
    codeSent.value = true;
    codeCooldown.value = 60;
    if (cooldownTimer) clearInterval(cooldownTimer);
    cooldownTimer = setInterval(() => {
      codeCooldown.value--;
      if (codeCooldown.value <= 0 && cooldownTimer) {
        clearInterval(cooldownTimer);
        cooldownTimer = null;
      }
    }, 1000);
  } catch {
    error.value = jwtAuth.state.lastError ?? '验证码发送失败';
  } finally {
    submitting.value = false;
  }
}

async function submit() {
  error.value = null;
  if (!email.value || !password.value) {
    error.value = '请输入邮箱和密码';
    return;
  }
  if (isRegister.value && (!code.value || !invitationCode.value)) {
    error.value = '注册需要邮箱验证码和邀请码';
    return;
  }
  submitting.value = true;
  try {
    if (isRegister.value) {
      await jwtAuth.register({
        email: email.value,
        password: password.value,
        code: code.value,
        invitationCode: invitationCode.value,
        nickname: nickname.value.trim() || undefined,
      });
    } else {
      await jwtAuth.login(email.value, password.value);
    }
    cardGone.value = true;
    showWelcome.value = true;
    successTimer = setTimeout(() => close(), 1500);
  } catch {
    error.value = jwtAuth.state.lastError ?? (isRegister.value ? '注册失败' : '登录失败');
  } finally {
    submitting.value = false;
  }
}

function back() {
  showWelcome.value = false;
  cardGone.value = false;
  submitting.value = false;
  error.value = null;
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
      <div
        v-if="!showWelcome"
        class="sl-sl-card"
        :class="{ gone: cardGone }"
      >
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

        <h1>{{ isRegister ? '注册' : '登录' }}</h1>

        <div class="sl-sl-tabs">
          <button
            class="sl-sl-tab"
            :class="{ 'is-active': mode === 'login' }"
            type="button"
            @click="switchMode('login')"
          >
            登录
          </button>
          <button
            class="sl-sl-tab"
            :class="{ 'is-active': mode === 'register' }"
            type="button"
            @click="switchMode('register')"
          >
            注册
          </button>
        </div>

        <div
          v-if="error"
          class="sl-sl-error"
        >
          {{ error }}
        </div>

        <form
          novalidate
          @submit.prevent="submit"
        >
          <div class="sl-sl-field">
            <label for="login-email">邮箱</label>
            <input
              id="login-email"
              v-model="email"
              type="email"
              placeholder="you@cirrus.io"
              autocomplete="email"
              @keydown="onKeydown"
            >
          </div>

          <template v-if="isRegister">
            <div class="sl-sl-field">
              <label for="login-code">邮箱验证码</label>
              <div class="sl-sl-code-row">
                <input
                  id="login-code"
                  v-model="code"
                  type="text"
                  inputmode="numeric"
                  placeholder="6 位验证码"
                  autocomplete="one-time-code"
                  @keydown="onKeydown"
                >
                <button
                  class="sl-sl-btn-send"
                  type="button"
                  :disabled="submitting || codeCooldown > 0"
                  @click="sendCode"
                >
                  {{ codeCooldown > 0 ? `${codeCooldown}s` : (codeSent ? '重新发送' : '发送验证码') }}
                </button>
              </div>
            </div>

            <div class="sl-sl-field">
              <label for="login-invite">邀请码</label>
              <input
                id="login-invite"
                v-model="invitationCode"
                type="text"
                placeholder="朋友的邀请码"
                autocomplete="off"
                @keydown="onKeydown"
              >
            </div>

            <div class="sl-sl-field">
              <label for="login-nickname">昵称(可选)</label>
              <input
                id="login-nickname"
                v-model="nickname"
                type="text"
                placeholder="怎么称呼你"
                autocomplete="nickname"
                @keydown="onKeydown"
              >
            </div>
          </template>

          <div class="sl-sl-field">
            <label for="login-pwd">{{ isRegister ? '设置密码' : '密码' }}</label>
            <input
              id="login-pwd"
              v-model="password"
              :type="showPwd ? 'text' : 'password'"
              placeholder="至少 8 位"
              autocomplete="current-password"
              @keydown="onKeydown"
            >
            <button
              class="sl-sl-eye"
              type="button"
              :aria-pressed="showPwd"
              @click="showPwd = !showPwd"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linecap="round"
              >
                <path d="M2 12s3.8-6 10-6 10 6 10 6-3.8 6-10 6S2 12 2 12Z" /><circle
                  cx="12"
                  cy="12"
                  r="2.6"
                />
              </svg>
            </button>
            <div
              v-if="isRegister"
              class="sl-sl-strength"
              aria-hidden="true"
            >
              <i
                v-for="n in 4"
                :key="n"
                :style="{ background: strength >= n ? 'var(--ink-2)' : 'var(--border)' }"
              />
            </div>
          </div>

          <button
            class="sl-sl-btn-primary"
            type="submit"
            :disabled="submitting"
          >
            <span>{{ submitting ? '处理中...' : (isRegister ? '注册' : '登录') }}</span>
          </button>
        </form>
      </div>

      <div
        class="sl-sl-welcome"
        :class="{ on: showWelcome }"
      >
        <h2>欢迎回来，旅行者</h2>
        <p>云层已为你让开。</p>
        <button
          class="sl-sl-ghost"
          @click="back"
        >
          返回登录
        </button>
      </div>
    </div>
  </div>
</template>
