// src/hooks/useLoginModal.ts —— host LoginModal 触发入口(React 端)。
// useSyncExternalStore 安全:isOpen 是 boolean 原始值,快照身份随值变化。

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
