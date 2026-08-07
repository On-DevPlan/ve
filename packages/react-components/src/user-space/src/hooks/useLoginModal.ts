// src/hooks/useLoginModal.ts —— host useLoginModal 跨框架桥。
// 组件不重写登录 UI,只调 host open()。

import { useSyncExternalStore } from 'react';
import {
  subscribeLoginModal,
  getLoginModalSnapshot,
  openLoginModal,
  closeLoginModal,
} from '@/shared/useLoginModal';

export function useLoginModal(): { isOpen: boolean; open: () => void; close: () => void } {
  const isOpen = useSyncExternalStore(subscribeLoginModal, getLoginModalSnapshot, getLoginModalSnapshot);
  return { isOpen, open: openLoginModal, close: closeLoginModal };
}
