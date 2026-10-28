<script setup lang="ts">
// pages/login/OidcCallbackPage.vue —— 统一身份登录回调页(/oidc/callback)。
//
// 认证中心完成登录/注册后 302 回到这里:?code=&state=(或 ?error=&error_description=)。
// 职责链:
//   1. IdP 侧错误(用户拒绝授权 / redirect_uri 不在白名单等)→ 原样展示
//   2. 正常路径 → jwtAuth.completeOidcLogin(code, state)(校验 state + 换本系统 JWT)
//   3. 成功 → 跳回发起前的目标页(sessionStorage 存的 returnTo,默认 '/')
//   4. 交换失败(state 不匹配 / 授权码过期)→ 展示错误 + 回登录页重试
//
// 这个页面是一次性的"中转站":不进导航、不可停留,出错也只提供两个出口
// (重新登录 / 回首页),不留中间态。

import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { jwtAuth } from '@/api/http/auth-store';
import { readOidcReturnTo } from '@/api/http/oidc';
import './login-page.css';

const route = useRoute();
const router = useRouter();

const busy = ref(true);
const error = ref<string | null>(null);

onMounted(async () => {
  const q = route.query;

  // 1) 认证中心侧错误(idp 的 errorRedirect 原样带回 error / error_description / state)
  if (typeof q.error === 'string' && q.error) {
    busy.value = false;
    error.value =
      typeof q.error_description === 'string' && q.error_description
        ? `认证中心拒绝了本次授权：${q.error_description}`
        : `认证中心拒绝了本次授权（${q.error}）`;
    return;
  }

  const code = typeof q.code === 'string' ? q.code : '';
  const state = typeof q.state === 'string' ? q.state : '';
  if (!code || !state) {
    // 直开回调页(无参数)→ 回登录页
    router.replace('/login');
    return;
  }

  // 2) 校验 state + 授权码换本系统 JWT
  try {
    await jwtAuth.completeOidcLogin(code, state);
  } catch {
    busy.value = false;
    error.value = jwtAuth.state.lastError ?? '统一身份登录失败';
    return;
  }

  // 3) 回到发起登录前的目标页
  router.replace(readOidcReturnTo());
});
</script>

<template>
  <div class="sl-sl-login-page">
    <div class="sl-sl-form-wrap">
      <div class="sl-sl-card">
        <template v-if="busy">
          <h1>正在完成登录</h1>
          <p class="sl-sl-sso-sub">
            正在用授权码换取本站会话，请稍候...
          </p>
        </template>
        <template v-else>
          <h1>登录失败</h1>
          <div class="sl-sl-error">
            {{ error }}
          </div>
          <div class="sl-sl-sso-actions">
            <button
              class="sl-sl-btn-primary"
              type="button"
              @click="router.replace('/login')"
            >
              重新登录
            </button>
            <button
              class="sl-sl-sso-link-btn"
              type="button"
              @click="router.replace('/')"
            >
              回首页
            </button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
