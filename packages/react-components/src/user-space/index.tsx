// index.tsx —— UserSpace 组件入口
// 布局:左 sidebar(工作空间列表) + 右 tab(概览/成员/邀请/库存)
// 登录态读 host jwtAuth;未登录展示 "登录后查看" 引导
// 一切副作用(创建/修改/删除)走 host createUserSpaceStore()

import { useCallback, useEffect, useMemo, useState } from 'react';
import './index.css';
import { useUserSpaceStore } from './src/hooks/useUserSpaceStore';
import { useJwtAuth } from './src/hooks/useAuth';
import { useLoginModal } from './src/hooks/useLoginModal';
import Sidebar from './src/pages/Sidebar';
import Overview from './src/pages/Overview';
import Members from './src/pages/Members';
import Invitations from './src/pages/Invitations';
import Inventory from './src/pages/Inventory';
import type {
  GroupInvitationView,
  GroupMemberView,
  GroupSummary,
  ViewMode,
} from './src/types';

const VIEW_TABS: { key: ViewMode; label: string }[] = [
  { key: 'overview', label: '概览' },
  { key: 'members', label: '成员' },
  { key: 'invitations', label: '邀请' },
  { key: 'inventory', label: 'KV 库存' },
];

export default function UserSpace() {
  const auth = useJwtAuth();
  const loginModal = useLoginModal();
  const { groups, defaultGroupId, loading, error, reload, store } = useUserSpaceStore();

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [view, setView] = useState<ViewMode>('overview');
  const [actionError, setActionError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // ── 各视图子状态 ─────────────────────────────────
  const [members, setMembers] = useState<GroupMemberView[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);

  const [invitations, setInvitations] = useState<GroupInvitationView[]>([]);
  const [invitationsLoading, setInvitationsLoading] = useState(false);
  const [invitationsError, setInvitationsError] = useState<string | null>(null);

  const [inventory, setInventory] = useState<{
    groupId: number;
    total: number;
    keys: { key: string; valuePreview: string; valueLength: number; tags: string[] }[];
  } | null>(null);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventoryError, setInventoryError] = useState<string | null>(null);

  // 选中态:默认进第一个组 / 用户手动选过的优先
  const currentSelected = useMemo(() => {
    if (selectedId && groups?.some((g) => g.id === selectedId)) return selectedId;
    if (defaultGroupId && groups?.some((g) => g.id === defaultGroupId)) return defaultGroupId;
    if (groups && groups.length > 0) return groups[0].id;
    return null;
  }, [selectedId, defaultGroupId, groups]);

  const selectedGroup: GroupSummary | null = useMemo(() => {
    if (!currentSelected || !groups) return null;
    return groups.find((g) => g.id === currentSelected) ?? null;
  }, [currentSelected, groups]);

  // 切换组时清空子视图缓存,避免脏数据
  useEffect(() => {
    setMembers([]);
    setInvitations([]);
    setInventory(null);
    setMembersError(null);
    setInvitationsError(null);
    setInventoryError(null);
  }, [currentSelected]);

  // ── 各视图 lazy load ───────────────────────────────
  const loadMembers = useCallback(async () => {
    if (!currentSelected) return;
    setMembersLoading(true);
    setMembersError(null);
    try {
      const list = await store.listMembers(currentSelected);
      setMembers(list);
    } catch (e) {
      setMembersError(e instanceof Error ? e.message : 'load members failed');
    } finally {
      setMembersLoading(false);
    }
  }, [currentSelected, store]);

  const loadInvitations = useCallback(async () => {
    if (!currentSelected) return;
    setInvitationsLoading(true);
    setInvitationsError(null);
    try {
      const list = await store.listInvitations(currentSelected);
      setInvitations(list);
    } catch (e) {
      setInvitationsError(e instanceof Error ? e.message : 'load invitations failed');
    } finally {
      setInvitationsLoading(false);
    }
  }, [currentSelected, store]);

  const loadInventory = useCallback(async () => {
    if (!currentSelected) return;
    setInventoryLoading(true);
    setInventoryError(null);
    try {
      const inv = await store.inventory(currentSelected, 10);
      setInventory(inv);
    } catch (e) {
      setInventoryError(e instanceof Error ? e.message : 'load inventory failed');
    } finally {
      setInventoryLoading(false);
    }
  }, [currentSelected, store]);

  useEffect(() => {
    if (view === 'members') void loadMembers();
    if (view === 'invitations') void loadInvitations();
    if (view === 'inventory') void loadInventory();
  }, [view, loadMembers, loadInvitations, loadInventory]);

  // ── 动作封装(展示态) ──────────────────────────────
  async function withError(fn: () => Promise<void>): Promise<void> {
    setActionError(null);
    setSaving(true);
    try {
      await fn();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '操作失败');
    } finally {
      setSaving(false);
    }
  }

  async function handleCreate(name: string, description: string): Promise<void> {
    await withError(async () => {
      const created = await store.createGroup({ name, description });
      await reload();
      setSelectedId(created.id);
    });
  }

  async function handleSetDefault(id: number): Promise<void> {
    await withError(async () => {
      await store.setDefaultGroup(id);
      await reload();
    });
  }

  async function handleSaveOverview(args: { name?: string; description?: string }): Promise<void> {
    if (!currentSelected) return;
    await withError(async () => {
      await store.updateGroup(currentSelected, args);
      await reload();
    });
  }

  async function handleLeave(): Promise<void> {
    if (!currentSelected) return;
    await withError(async () => {
      await store.leaveGroup(currentSelected);
      setSelectedId(null);
      await reload();
    });
  }

  async function handleDissolve(): Promise<void> {
    if (!currentSelected) return;
    await withError(async () => {
      await store.dissolveGroup(currentSelected);
      setSelectedId(null);
      await reload();
    });
  }

  async function handleChangeRole(userId: number, role: GroupMemberView['role']): Promise<void> {
    if (!currentSelected) return;
    await withError(async () => {
      await store.changeMemberRole(currentSelected, userId, role);
      await loadMembers();
    });
  }

  async function handleRemoveMember(userId: number): Promise<void> {
    if (!currentSelected) return;
    await withError(async () => {
      await store.removeMember(currentSelected, userId);
      await loadMembers();
    });
  }

  async function handleCreateInvite(args: {
    inviteeEmail: string;
    role: Exclude<GroupInvitationView['role'], 'owner'>;
    maxUses?: number;
    ttlSeconds?: number;
  }): Promise<GroupInvitationView> {
    if (!currentSelected) throw new Error('no group selected');
    let created: GroupInvitationView | null = null;
    await withError(async () => {
      created = await store.createInvitation(currentSelected, args);
      await loadInvitations();
    });
    if (!created) throw new Error('create invitation failed');
    return created;
  }

  async function handleRevokeInvite(invitationId: number): Promise<void> {
    if (!currentSelected) return;
    await withError(async () => {
      await store.revokeInvitation(currentSelected, invitationId);
      await loadInvitations();
    });
  }

  async function handleAccept(code: string): Promise<GroupSummary> {
    let joined: GroupSummary | null = null;
    await withError(async () => {
      joined = await store.acceptInvitation(code);
      await reload();
      setSelectedId(joined!.id);
    });
    if (!joined) throw new Error('accept failed');
    return joined;
  }

  // ── 渲染 ─────────────────────────────────────────
  if (auth.jwtAuthState !== 'logged-in' || !auth.token) {
    return (
      <div className="sl-us-root sl-us-gate">
        <div className="sl-us-gate__card">
          <h2 className="sl-us-gate__title">用户空间</h2>
          <p className="sl-us-gate__desc">
            登录后查看工作空间、成员、邀请和 KV 库存。
          </p>
          <button
            className="sl-us-btn sl-us-btn--primary"
            onClick={loginModal.open}
          >
            登录
          </button>
        </div>
      </div>
    );
  }

  if (loading && (!groups || groups.length === 0)) {
    return (
      <div className="sl-us-root sl-us-gate">
        <div className="sl-us-gate__card">
          <span className="sl-us-muted">正在加载工作空间…</span>
        </div>
      </div>
    );
  }

  if (error && (!groups || groups.length === 0)) {
    return (
      <div className="sl-us-root sl-us-gate">
        <div className="sl-us-gate__card">
          <h2 className="sl-us-gate__title">加载失败</h2>
          <p className="sl-us-error">{error}</p>
          <button
            className="sl-us-btn"
            onClick={() => void reload()}
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  const safeGroups = groups ?? [];

  return (
    <div className="sl-us-root">
      <Sidebar
        groups={safeGroups}
        selectedGroupId={currentSelected}
        defaultGroupId={defaultGroupId}
        onSelect={(id) => setSelectedId(id)}
        onCreate={(name, description) => handleCreate(name, description)}
        onSetDefault={(id) => handleSetDefault(id)}
        disabled={saving}
      />

      <main className="sl-us-main">
        {actionError && (
          <div className="sl-us-error sl-us-error--banner">{actionError}</div>
        )}

        {selectedGroup ? (
          <>
            <header className="sl-us-header">
              <div className="sl-us-header__title">
                <h2 className="sl-us-header__name">{selectedGroup.name}</h2>
                <span className={`sl-us-badge sl-us-badge--role-${selectedGroup.myRole}`}>
                  {selectedGroup.myRole.toUpperCase()}
                </span>
                {selectedGroup.isDefault && (
                  <span className="sl-us-badge sl-us-badge--default">默认</span>
                )}
              </div>
              <nav className="sl-us-tabs">
                {VIEW_TABS.map((t) => (
                  <button
                    key={t.key}
                    className={`sl-us-tab ${view === t.key ? 'is-active' : ''}`}
                    onClick={() => setView(t.key)}
                  >
                    {t.label}
                  </button>
                ))}
              </nav>
            </header>

            {view === 'overview' && (
              <Overview
                group={selectedGroup}
                saving={saving}
                onSave={handleSaveOverview}
                onLeave={handleLeave}
                onDissolve={handleDissolve}
              />
            )}
            {view === 'members' && (
              <Members
                group={selectedGroup}
                members={members}
                loading={membersLoading}
                error={membersError}
                saving={saving}
                onChangeRole={handleChangeRole}
                onRemove={handleRemoveMember}
                onReload={loadMembers}
              />
            )}
            {view === 'invitations' && (
              <Invitations
                group={selectedGroup}
                invitations={invitations}
                loading={invitationsLoading}
                error={invitationsError}
                saving={saving}
                onCreate={handleCreateInvite}
                onRevoke={handleRevokeInvite}
                onReload={loadInvitations}
                onAcceptExternal={handleAccept}
              />
            )}
            {view === 'inventory' && (
              <Inventory
                group={selectedGroup}
                inventory={inventory}
                loading={inventoryLoading}
                error={inventoryError}
                onReload={loadInventory}
              />
            )}
          </>
        ) : (
          <div className="sl-us-empty">
            <h3>还没有工作空间</h3>
            <p>在左侧点击「+ 新建工作空间」创建第一个组。</p>
          </div>
        )}
      </main>
    </div>
  );
}
