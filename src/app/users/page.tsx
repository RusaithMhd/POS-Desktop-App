'use client';

import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  ShieldCheck, 
  UserCheck, 
  Users, 
  UserCog, 
  KeyRound, 
  GitBranch, 
  BadgeCheck, 
  History, 
  Settings, 
  Search, 
  Plus, 
  Pencil, 
  Trash2, 
  Eye, 
  Lock, 
  Unlock, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  MoreHorizontal, 
  SlidersHorizontal, 
  Download, 
  RefreshCw, 
  Copy, 
  ArrowRight, 
  CheckSquare, 
  Square, 
  Sliders, 
  Check, 
  X, 
  Layers, 
  Sparkles, 
  UserPlus, 
  FileText,
  RotateCcw,
  CheckCircle
} from 'lucide-react';
import { getLocalDb, getRawSqlDb, saveLocalDbState } from '@/infrastructure/database/sqlite/db';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Pagination } from '@/components/ui/pagination';
import { RBACService, AuditLogEntry, ApprovalRule } from '@/services/security/RBACService';
import { AuthService, UserSession } from '@/features/auth/AuthService';
import { formatCurrency } from '@/lib/utils';
import bcrypt from 'bcryptjs';

export default function UsersPage() {
  return (
    <PermissionGuard permission={['users.view', 'users.manage', 'roles.view', 'roles.manage']} moduleName="Security & Access Control Center">
      <UsersContent />
    </PermissionGuard>
  );
}

// Module Group Definitions for Simple & Advanced Modes
const MODULE_GROUPS = [
  {
    id: 'pos',
    name: 'POS & Sales',
    icon: '🛒',
    description: 'Checkout terminal, order entry, discounts & payments',
    modules: ['pos', 'orders', 'payments', 'discounts'],
    permissions: [
      { id: 'p-pos-access', code: 'pos.access', label: 'Access POS Terminal', type: 'VIEW', core: true },
      { id: 'p-orders-view', code: 'orders.view', label: 'View Order History', type: 'VIEW' },
      { id: 'p-orders-create', code: 'orders.create', label: 'Create POS Orders', type: 'CREATE' },
      { id: 'p-orders-edit', code: 'orders.edit', label: 'Edit Active Orders', type: 'EDIT' },
      { id: 'p-orders-cancel', code: 'orders.cancel', label: 'Cancel Active Order', type: 'DELETE' },
      { id: 'p-orders-void', code: 'orders.void', label: 'Void Items & Orders', type: 'OVERRIDE' },
      { id: 'p-pay-accept', code: 'payments.accept', label: 'Accept Customer Payment', type: 'CREATE' },
      { id: 'p-pay-refund', code: 'payments.refund', label: 'Process Customer Refunds', type: 'APPROVE' },
      { id: 'p-disc-apply', code: 'discounts.apply', label: 'Apply Line Discounts', type: 'CREATE' },
      { id: 'p-disc-override', code: 'discounts.override', label: 'Apply Custom High Discount', type: 'OVERRIDE' }
    ]
  },
  {
    id: 'products',
    name: 'Products & Catalog',
    icon: '📦',
    description: 'Product list, prices, categories & SKUs',
    modules: ['products'],
    permissions: [
      { id: 'p-prod-view', code: 'products.view', label: 'View Product Catalog', type: 'VIEW' },
      { id: 'p-prod-create', code: 'products.create', label: 'Create New Products', type: 'CREATE' },
      { id: 'p-prod-edit', code: 'products.edit', label: 'Edit Product Details', type: 'EDIT' },
      { id: 'p-prod-delete', code: 'products.delete', label: 'Delete Products', type: 'DELETE' },
      { id: 'p-prod-price', code: 'products.change_price', label: 'Override POS Price', type: 'OVERRIDE' }
    ]
  },
  {
    id: 'inventory',
    name: 'Inventory & Stock',
    icon: '📊',
    description: 'Stock balances, adjustments & ledger audit',
    modules: ['inventory'],
    permissions: [
      { id: 'p-inv-view', code: 'inventory.view', label: 'View Stock Balances', type: 'VIEW' },
      { id: 'p-inv-adjust', code: 'inventory.adjust', label: 'Adjust Stock Quantities', type: 'EDIT' }
    ]
  },
  {
    id: 'purchasing',
    name: 'Purchasing & Receiving',
    icon: '🛍️',
    description: 'Purchase orders, supplier receiving & stock in',
    modules: ['purchasing'],
    permissions: [
      { id: 'p-purch-view', code: 'purchasing.view', label: 'View Purchase Orders', type: 'VIEW' },
      { id: 'p-purch-create', code: 'purchasing.create', label: 'Create Purchase Orders', type: 'CREATE' },
      { id: 'p-purch-receive', code: 'purchasing.receive', label: 'Receive Deliveries', type: 'EDIT' }
    ]
  },
  {
    id: 'customers_suppliers',
    name: 'Customers & Suppliers',
    icon: '👥',
    description: 'Customer credit, supplier directory & contacts',
    modules: ['customers', 'suppliers'],
    permissions: [
      { id: 'p-cust-view', code: 'customers.view', label: 'View Customer List', type: 'VIEW' },
      { id: 'p-cust-manage', code: 'customers.manage', label: 'Manage Customer Records', type: 'EDIT' },
      { id: 'p-supp-manage', code: 'suppliers.manage', label: 'Manage Suppliers', type: 'EDIT' }
    ]
  },
  {
    id: 'reports',
    name: 'Reports & Analytics',
    icon: '📈',
    description: 'Operational sales reports, financial revenue & exports',
    modules: ['reports', 'dashboard'],
    permissions: [
      { id: 'p-dash-view', code: 'dashboard.view', label: 'View BI Dashboard', type: 'VIEW' },
      { id: 'p-rep-view', code: 'reports.view', label: 'View Sales Reports', type: 'VIEW' },
      { id: 'p-rep-fin', code: 'reports.financial', label: 'View Financial P&L Reports', type: 'EXPORT' },
      { id: 'p-rep-export', code: 'reports.export', label: 'Export Reports to Excel/CSV', type: 'EXPORT' }
    ]
  },
  {
    id: 'kitchen',
    name: 'Kitchen Display (KOT)',
    icon: '🍳',
    description: 'Kitchen display order status & preparation',
    modules: ['kitchen'],
    permissions: [
      { id: 'p-kit-view', code: 'kitchen.view', label: 'View Kitchen Display', type: 'VIEW' },
      { id: 'p-kit-status', code: 'kitchen.update_status', label: 'Update KOT Status', type: 'EDIT' }
    ]
  },
  {
    id: 'shift',
    name: 'Shift & Register',
    icon: '💵',
    description: 'Cash register opening, closing & float reconciliation',
    modules: ['shift'],
    permissions: [
      { id: 'p-shift-open', code: 'cash_register.open', label: 'Open Register Shift', type: 'CREATE' },
      { id: 'p-shift-close', code: 'cash_register.close', label: 'Close Register Shift', type: 'EDIT' }
    ]
  },
  {
    id: 'system',
    name: 'Users & System Administration',
    icon: '⚙️',
    description: 'Staff accounts, custom roles, settings & backup',
    modules: ['users', 'roles', 'settings', 'database', 'audit_logs'],
    permissions: [
      { id: 'p-user-view', code: 'users.view', label: 'View Staff Accounts', type: 'VIEW' },
      { id: 'p-user-manage', code: 'users.manage', label: 'Manage Staff Accounts', type: 'EDIT' },
      { id: 'p-role-view', code: 'roles.view', label: 'View Security Roles', type: 'VIEW' },
      { id: 'p-role-manage', code: 'roles.manage', label: 'Manage Roles & Matrix', type: 'EDIT' },
      { id: 'p-set-view', code: 'settings.view', label: 'View Store Settings', type: 'VIEW' },
      { id: 'p-set-manage', code: 'settings.manage', label: 'Manage System Settings', type: 'EDIT' },
      { id: 'p-db-backup', code: 'database.backup', label: 'Backup SQLite DB', type: 'EXPORT' },
      { id: 'p-db-restore', code: 'database.restore', label: 'Restore Database', type: 'OVERRIDE' },
      { id: 'p-audit-view', code: 'audit_logs.view', label: 'View Audit Logs', type: 'VIEW' }
    ]
  }
];

// Role Presets for Quick Role Creation
const ROLE_PRESETS = [
  {
    id: 'PRESET_CASHIER',
    name: 'Cashier',
    desc: 'Frontline checkout operator managing sales & customer payments',
    perms: ['p-pos-access', 'p-orders-view', 'p-orders-create', 'p-pay-view', 'p-pay-accept', 'p-cust-view', 'p-cust-manage', 'p-disc-view', 'p-disc-apply', 'p-shift-open', 'p-shift-close']
  },
  {
    id: 'PRESET_MANAGER',
    name: 'Store Manager',
    desc: 'Operations manager handling refunds, voids, discounts & staff approvals',
    perms: [
      'p-dash-view', 'p-pos-access', 'p-orders-view', 'p-orders-create', 'p-orders-edit', 'p-orders-cancel', 'p-orders-void', 'p-orders-reopen',
      'p-pay-view', 'p-pay-accept', 'p-pay-refund', 'p-prod-view', 'p-prod-create', 'p-prod-edit', 'p-prod-price',
      'p-inv-view', 'p-inv-adjust', 'p-purch-view', 'p-purch-create', 'p-purch-receive', 'p-cust-view', 'p-cust-manage',
      'p-supp-manage', 'p-disc-view', 'p-disc-apply', 'p-disc-override', 'p-kit-view', 'p-kit-status', 'p-rep-view', 'p-rep-fin',
      'p-rep-export', 'p-user-view', 'p-user-manage', 'p-role-view', 'p-set-view', 'p-set-manage', 'p-db-backup', 'p-audit-view',
      'p-shift-open', 'p-shift-close'
    ]
  },
  {
    id: 'PRESET_INVENTORY',
    name: 'Inventory Manager',
    desc: 'Stock room & warehouse manager handling purchasing & stock counts',
    perms: ['p-prod-view', 'p-prod-create', 'p-prod-edit', 'p-inv-view', 'p-inv-adjust', 'p-purch-view', 'p-purch-create', 'p-purch-receive', 'p-supp-manage']
  },
  {
    id: 'PRESET_ACCOUNTANT',
    name: 'Accountant',
    desc: 'Financial analyst viewing revenue, sales history & financial exports',
    perms: ['p-dash-view', 'p-orders-view', 'p-pay-view', 'p-rep-view', 'p-rep-fin', 'p-rep-export', 'p-purch-view']
  },
  {
    id: 'PRESET_KITCHEN',
    name: 'Kitchen Staff',
    desc: 'Kitchen display operator managing order preparation status',
    perms: ['p-kit-view', 'p-kit-status', 'p-orders-view']
  },
  {
    id: 'PRESET_AUDITOR',
    name: 'Auditor (Read-Only)',
    desc: 'Completely read-only auditor reviewing logs and transactions',
    perms: ['p-dash-view', 'p-orders-view', 'p-pay-view', 'p-prod-view', 'p-inv-view', 'p-rep-view', 'p-audit-view']
  }
];

function UsersContent() {
  const [activeTab, setActiveTab] = useState<'users' | 'roles' | 'matrix' | 'approval' | 'audit'>('users');
  const [matrixMode, setMatrixMode] = useState<'simple' | 'advanced'>('simple');

  // Core Data State
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<any[]>([]);
  const [rolePermissions, setRolePermissions] = useState<Record<string, string[]>>({});
  const [approvalRules, setApprovalRules] = useState<ApprovalRule[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);

  // Pending Changes State
  const [draftRolePermissions, setDraftRolePermissions] = useState<Record<string, string[]>>({});
  const [hasPendingChanges, setHasPendingChanges] = useState(false);

  // Filters
  const [userSearch, setUserSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [matrixSearch, setMatrixSearch] = useState('');
  const [auditSearch, setAuditSearch] = useState('');

  // Modals & Drawers
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [roleId, setRoleId] = useState('');
  const [pin, setPin] = useState('');
  const [password, setPassword] = useState('');
  const [assignedRegister, setAssignedRegister] = useState('POS-01');
  const [formError, setFormError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Effective Access Drawer
  const [viewingUserAccess, setViewingUserAccess] = useState<any | null>(null);

  // Test Access Tool Drawer
  const [isTestAccessOpen, setIsTestAccessOpen] = useState(false);
  const [testUser, setTestUser] = useState<any | null>(null);
  const [testAction, setTestAction] = useState('pos.access');
  const [testResult, setTestResult] = useState<any | null>(null);

  // Custom Role Form State
  const [isRoleFormOpen, setIsRoleFormOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<string>('BLANK');

  // Role Duplication State
  const [isDuplicateRoleOpen, setIsDuplicateRoleOpen] = useState(false);
  const [duplicatingRole, setDuplicatingRole] = useState<any | null>(null);
  const [newDuplicateName, setNewDuplicateName] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    loadAllSecurityData();
  }, []);

  const loadAllSecurityData = async () => {
    try {
      await getLocalDb();
      const raw = getRawSqlDb();

      // Users
      const uStmt = raw.prepare('SELECT u.*, r.name as role_name, r.description as role_desc FROM users u JOIN roles r ON u.role_id = r.id ORDER BY u.full_name ASC');
      const uList: any[] = [];
      while (uStmt.step()) {
        uList.push(uStmt.getAsObject());
      }
      uStmt.free();

      // Roles
      const rStmt = raw.prepare('SELECT * FROM roles ORDER BY is_system DESC, name ASC');
      const rList: any[] = [];
      while (rStmt.step()) {
        rList.push(rStmt.getAsObject());
      }
      rStmt.free();

      // Permissions
      const pStmt = raw.prepare('SELECT * FROM permissions ORDER BY module ASC, name ASC');
      const pList: any[] = [];
      while (pStmt.step()) {
        pList.push(pStmt.getAsObject());
      }
      pStmt.free();

      // Role Permissions Matrix Map
      const rpStmt = raw.prepare('SELECT role_id, permission_id FROM role_permissions');
      const rpMap: Record<string, string[]> = {};
      while (rpStmt.step()) {
        const row = rpStmt.getAsObject();
        const rId = row.role_id as string;
        const pId = row.permission_id as string;
        if (!rpMap[rId]) rpMap[rId] = [];
        rpMap[rId].push(pId);
      }
      rpStmt.free();

      // Audit Logs & Approval Rules
      const logs = RBACService.getAuditLogs(100);
      const rules = RBACService.getApprovalRules();

      setUsers(uList);
      setRoles(rList);
      setPermissions(pList);
      setRolePermissions(rpMap);
      setDraftRolePermissions(JSON.parse(JSON.stringify(rpMap)));
      setAuditLogs(logs);
      setApprovalRules(rules);
      setHasPendingChanges(false);

      if (rList.length > 0 && !roleId) setRoleId(rList[0].id);
      if (uList.length > 0 && !testUser) setTestUser(uList[0]);
    } catch (err) {
      console.error('Failed to load security data:', err);
    }
  };

  const showNotification = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 4000);
  };

  const handleOpenUserForm = (userToEdit?: any) => {
    if (userToEdit) {
      setEditingUser(userToEdit);
      setFullName(userToEdit.full_name || '');
      setUsername(userToEdit.username || '');
      setEmail(userToEdit.email || '');
      setRoleId(userToEdit.role_id || (roles[0]?.id || ''));
      setPin('');
      setPassword('');
      setAssignedRegister(userToEdit.terminal_id || 'POS-01');
    } else {
      setEditingUser(null);
      setFullName('');
      setUsername('');
      setEmail('');
      setRoleId(roles[0]?.id || '');
      setPin('');
      setPassword('Password@123');
      setAssignedRegister('POS-01');
    }
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !username.trim() || !roleId) {
      setFormError('Please complete all required fields.');
      return;
    }

    try {
      const activeUser = AuthService.getActiveSession();
      RBACService.validatePermission(activeUser, 'users.manage', 'User Account');

      const raw = getRawSqlDb();
      const now = new Date().toISOString();

      if (editingUser) {
        // Edit existing user
        let updateQuery = `UPDATE users SET full_name = ?, username = ?, email = ?, role_id = ?, updated_at = ?`;
        const params: any[] = [fullName.trim(), username.trim().toLowerCase(), email.trim(), roleId, now];

        if (password.trim()) {
          updateQuery += `, password_hash = ?`;
          params.push(bcrypt.hashSync(password.trim(), 10));
        }
        if (pin.trim()) {
          updateQuery += `, pin_hash = ?`;
          params.push(bcrypt.hashSync(pin.trim(), 10));
        }

        updateQuery += ` WHERE id = ?`;
        params.push(editingUser.id);

        raw.run(updateQuery, params);
        saveLocalDbState();

        RBACService.logAudit({
          userId: activeUser?.id,
          userName: activeUser?.fullName,
          roleName: activeUser?.roleName,
          action: 'USER_EDITED',
          entity: 'USER',
          entityId: editingUser.id,
          newValue: `Updated account details for ${fullName.trim()}`,
        });

        showNotification(`Staff account "${fullName.trim()}" updated successfully.`);
      } else {
        // Create new user
        const passHash = bcrypt.hashSync(password || 'Password@123', 10);
        const pinHash = pin.trim() ? bcrypt.hashSync(pin.trim(), 10) : null;
        const id = `usr-${Date.now()}`;

        raw.run(
          `INSERT INTO users (id, business_id, branch_id, role_id, username, email, password_hash, pin_hash, full_name, phone, status, is_active, created_at, updated_at)
           VALUES (?, 'biz-001', 'branch-001', ?, ?, ?, ?, ?, ?, '', 'ACTIVE', 1, ?, ?)`,
          [id, roleId, username.trim().toLowerCase(), email.trim() || `${username.trim()}@triwynpos.lk`, passHash, pinHash, fullName.trim(), now, now]
        );

        saveLocalDbState();

        RBACService.logAudit({
          userId: activeUser?.id,
          userName: activeUser?.fullName,
          roleName: activeUser?.roleName,
          action: 'USER_CREATED',
          entity: 'USER',
          entityId: id,
          newValue: `Created user ${fullName.trim()} (${username.trim()})`,
        });

        showNotification(`User account "${fullName.trim()}" created successfully.`);
      }

      setIsFormOpen(false);
      await loadAllSecurityData();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to save user account.');
    }
  };

  const handleToggleUserStatus = async (u: any) => {
    try {
      const activeUser = AuthService.getActiveSession();
      RBACService.validatePermission(activeUser, 'users.manage', 'User Status');

      const raw = getRawSqlDb();
      const currentStatus = u.status || (u.is_active ? 'ACTIVE' : 'DEACTIVATED');
      const newStatus = currentStatus === 'ACTIVE' ? 'DEACTIVATED' : 'ACTIVE';
      const isActiveNum = newStatus === 'ACTIVE' ? 1 : 0;

      raw.run('UPDATE users SET status = ?, is_active = ?, updated_at = ? WHERE id = ?', [
        newStatus,
        isActiveNum,
        new Date().toISOString(),
        u.id,
      ]);

      saveLocalDbState();

      RBACService.logAudit({
        userId: activeUser?.id,
        userName: activeUser?.fullName,
        roleName: activeUser?.roleName,
        action: newStatus === 'ACTIVE' ? 'USER_ACTIVATED' : 'USER_DISABLED',
        entity: 'USER',
        entityId: u.id,
        oldValue: currentStatus,
        newValue: newStatus,
        reason: 'Administrator manual status toggle',
      });

      showNotification(`User "${u.full_name}" is now ${newStatus.toLowerCase()}.`);
      await loadAllSecurityData();
    } catch (err: any) {
      alert(err?.message || 'Failed to toggle user status.');
    }
  };

  const handleCreateCustomRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim()) return;

    try {
      const activeUser = AuthService.getActiveSession();
      RBACService.validatePermission(activeUser, 'roles.manage', 'Role Management');

      const raw = getRawSqlDb();
      const id = `role-${Date.now()}`;
      const now = new Date().toISOString();
      const roleNameFormatted = newRoleName.trim().toUpperCase().replace(/\s+/g, '_');

      raw.run(
        `INSERT INTO roles (id, name, description, is_system, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?)`,
        [id, roleNameFormatted, newRoleDesc.trim() || 'Custom Security Role', now, now]
      );

      // If a preset was selected, copy preset permissions
      const preset = ROLE_PRESETS.find((p) => p.id === selectedPreset);
      if (preset && preset.perms) {
        for (const pId of preset.perms) {
          raw.run('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)', [id, pId]);
        }
      }

      saveLocalDbState();

      RBACService.logAudit({
        userId: activeUser?.id,
        userName: activeUser?.fullName,
        roleName: activeUser?.roleName,
        action: 'ROLE_CREATED',
        entity: 'ROLE',
        entityId: id,
        newValue: `Created custom role ${roleNameFormatted}`,
      });

      setIsRoleFormOpen(false);
      setNewRoleName('');
      setNewRoleDesc('');
      setSelectedPreset('BLANK');
      showNotification(`Custom role "${roleNameFormatted}" created successfully.`);
      await loadAllSecurityData();
    } catch (err: any) {
      alert(err?.message || 'Failed to create custom role.');
    }
  };

  const handleDuplicateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!duplicatingRole || !newDuplicateName.trim()) return;

    try {
      const activeUser = AuthService.getActiveSession();
      RBACService.validatePermission(activeUser, 'roles.manage', 'Duplicate Role');

      const raw = getRawSqlDb();
      const id = `role-${Date.now()}`;
      const now = new Date().toISOString();
      const formattedName = newDuplicateName.trim().toUpperCase().replace(/\s+/g, '_');

      raw.run(
        `INSERT INTO roles (id, name, description, is_system, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?)`,
        [id, formattedName, `Cloned from ${duplicatingRole.name}`, now, now]
      );

      // Clone permissions from duplicatingRole
      const existingPerms = rolePermissions[duplicatingRole.id] || [];
      for (const pId of existingPerms) {
        raw.run('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)', [id, pId]);
      }

      saveLocalDbState();

      RBACService.logAudit({
        userId: activeUser?.id,
        userName: activeUser?.fullName,
        roleName: activeUser?.roleName,
        action: 'ROLE_DUPLICATED',
        entity: 'ROLE',
        entityId: id,
        newValue: `Cloned role ${formattedName} from ${duplicatingRole.name}`,
      });

      setIsDuplicateRoleOpen(false);
      setDuplicatingRole(null);
      setNewDuplicateName('');
      showNotification(`Role duplicated as "${formattedName}".`);
      await loadAllSecurityData();
    } catch (err: any) {
      alert(err?.message || 'Failed to duplicate role.');
    }
  };

  const handleDeleteCustomRole = async (r: any) => {
    if (r.is_system) {
      alert('System roles are protected and cannot be deleted.');
      return;
    }

    if (!confirm(`Are you sure you want to delete custom role "${r.name}"?`)) return;

    try {
      const activeUser = AuthService.getActiveSession();
      RBACService.validatePermission(activeUser, 'roles.manage', 'Delete Role');

      const raw = getRawSqlDb();
      raw.run('DELETE FROM role_permissions WHERE role_id = ?', [r.id]);
      raw.run('DELETE FROM roles WHERE id = ?', [r.id]);

      saveLocalDbState();

      RBACService.logAudit({
        userId: activeUser?.id,
        userName: activeUser?.fullName,
        roleName: activeUser?.roleName,
        action: 'ROLE_DELETED',
        entity: 'ROLE',
        entityId: r.id,
        oldValue: r.name,
      });

      showNotification(`Role "${r.name}" deleted.`);
      await loadAllSecurityData();
    } catch (err: any) {
      alert(err?.message || 'Failed to delete role.');
    }
  };

  // Matrix Edit Handlers
  const handleToggleMatrixPermission = (roleIdToToggle: string, permIdToToggle: string) => {
    const currentList = draftRolePermissions[roleIdToToggle] || [];
    const hasPerm = currentList.includes(permIdToToggle);
    let newList: string[] = [];

    if (hasPerm) {
      newList = currentList.filter((id) => id !== permIdToToggle);
    } else {
      newList = [...currentList, permIdToToggle];

      // Auto-imply view permission for module
      const targetPerm = permissions.find((p) => p.id === permIdToToggle);
      if (targetPerm) {
        const mod = targetPerm.module;
        const parentView = permissions.find((p) => p.module === mod && (p.action_type === 'VIEW' || p.name.endsWith('.view')));
        if (parentView && !newList.includes(parentView.id)) {
          newList.push(parentView.id);
        }
      }
    }

    setDraftRolePermissions({
      ...draftRolePermissions,
      [roleIdToToggle]: newList,
    });
    setHasPendingChanges(true);
  };

  const handleBulkMatrixRole = (roleIdToToggle: string, grantAll: boolean) => {
    const newList = grantAll ? permissions.map((p) => p.id) : [];
    setDraftRolePermissions({
      ...draftRolePermissions,
      [roleIdToToggle]: newList,
    });
    setHasPendingChanges(true);
  };

  const handleSetSimpleModuleAccess = (roleIdToToggle: string, group: typeof MODULE_GROUPS[0], level: 'Full Access' | 'View Only' | 'Create & Edit' | 'No Access') => {
    const current = draftRolePermissions[roleIdToToggle] || [];
    const groupPermIds = group.permissions.map((p) => p.id);
    let updated = current.filter((id) => !groupPermIds.includes(id));

    if (level === 'Full Access') {
      updated = [...updated, ...groupPermIds];
    } else if (level === 'View Only') {
      const viewPerms = group.permissions.filter((p) => p.type === 'VIEW').map((p) => p.id);
      updated = [...updated, ...viewPerms];
    } else if (level === 'Create & Edit') {
      const allowedPerms = group.permissions.filter((p) => p.type === 'VIEW' || p.type === 'CREATE' || p.type === 'EDIT').map((p) => p.id);
      updated = [...updated, ...allowedPerms];
    }

    setDraftRolePermissions({
      ...draftRolePermissions,
      [roleIdToToggle]: updated,
    });
    setHasPendingChanges(true);
  };

  const handleSaveMatrixChanges = async () => {
    try {
      const activeUser = AuthService.getActiveSession();
      RBACService.validatePermission(activeUser, 'roles.manage', 'Save Permission Matrix');

      const raw = getRawSqlDb();
      for (const rId of Object.keys(draftRolePermissions)) {
        raw.run('DELETE FROM role_permissions WHERE role_id = ?', [rId]);
        const pList = draftRolePermissions[rId] || [];
        for (const pId of pList) {
          raw.run('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)', [rId, pId]);
        }
      }

      saveLocalDbState();

      // Sync active session if updated
      if (activeUser && activeUser.roleId && draftRolePermissions[activeUser.roleId]) {
        activeUser.permissions = AuthService.getUserPermissions(activeUser.roleId);
        AuthService.saveSession(activeUser);
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('permissions-updated'));
      }

      RBACService.logAudit({
        userId: activeUser?.id,
        userName: activeUser?.fullName,
        roleName: activeUser?.roleName,
        action: 'PERMISSIONS_MATRIX_SAVED',
        entity: 'ROLE_PERMISSIONS',
        newValue: 'Updated matrix permissions across system roles',
      });

      showNotification('Permissions Matrix saved successfully. Changes are live.');
      await loadAllSecurityData();
    } catch (err: any) {
      alert(err?.message || 'Failed to save matrix permissions.');
    }
  };

  const handleCancelMatrixChanges = () => {
    setDraftRolePermissions(JSON.parse(JSON.stringify(rolePermissions)));
    setHasPendingChanges(false);
  };

  // Test Access Execution
  const handleRunTestAccess = () => {
    if (!testUser) return;
    const userRole = roles.find((r) => r.id === testUser.role_id);
    const userPerms = rolePermissions[testUser.role_id] || [];

    const isSuperAdmin = userRole?.name === 'SUPER_ADMIN' || userRole?.name === 'ADMIN_MANAGER' || userRole?.name === 'ADMIN';

    // Find permission code matching testAction
    const targetPerm = permissions.find((p) => p.name === testAction || p.id === testAction);
    const hasPermission = isSuperAdmin || (targetPerm ? userPerms.includes(targetPerm.id) : false);

    // Check approval requirement
    let requiresApproval = false;
    let requiredRoleName = '';
    if (testAction.includes('refund') || testAction.includes('void') || testAction.includes('price') || testAction.includes('adjust')) {
      requiresApproval = !isSuperAdmin;
      requiredRoleName = 'ADMIN_MANAGER';
    }

    setTestResult({
      allowed: hasPermission,
      user: testUser,
      role: userRole?.name || 'Cashier',
      permissionCode: testAction,
      permissionLabel: targetPerm?.description || targetPerm?.name || testAction,
      requiresApproval,
      requiredRoleName,
    });
  };

  // Filtered Users List
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.full_name.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.username.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.role_name.toLowerCase().includes(userSearch.toLowerCase());
    const matchesRole = !roleFilter || u.role_id === roleFilter;
    const matchesStatus = !statusFilter || (u.status || (u.is_active ? 'ACTIVE' : 'DEACTIVATED')) === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  const totalPages = Math.ceil(filteredUsers.length / pageSize) || 1;
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 font-sans text-slate-900 select-none pb-24">
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed top-4 right-4 z-[9999] bg-slate-900 text-white text-xs font-bold px-4 py-3 rounded-lg shadow-xl flex items-center gap-2 border border-slate-700 animate-slide-in">
          <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{successToast}</span>
        </div>
      )}

      {/* PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold text-slate-900 tracking-tight">Security & Access Control Center</h1>
              <p className="text-xs text-slate-500 font-medium">
                Manage staff accounts, roles, permission matrix tables, approval rules, and audit logs
              </p>
            </div>
          </div>
          <div className="mt-2 text-[11px] text-slate-500 font-medium flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Security system active</span>
            <span className="text-slate-300">•</span>
            <span>Changes apply to authorized sessions in real time</span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsTestAccessOpen(true)}
            className="text-xs font-semibold gap-1.5 border-slate-300 text-slate-700 hover:bg-slate-50"
          >
            <KeyRound className="h-4 w-4 text-amber-600" /> Test Access
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={loadAllSecurityData}
            className="text-xs font-semibold gap-1.5 border-slate-300 text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4 text-slate-500" /> Refresh
          </Button>

          {activeTab === 'users' && (
            <Button
              onClick={() => handleOpenUserForm()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5 cursor-pointer shadow-xs"
            >
              <Plus className="h-4 w-4" /> Add User
            </Button>
          )}

          {activeTab === 'roles' && (
            <Button
              onClick={() => setIsRoleFormOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5 cursor-pointer shadow-xs"
            >
              <Plus className="h-4 w-4" /> Create Role
            </Button>
          )}
        </div>
      </div>

      {/* SEGMENTED TAB NAVIGATION */}
      <div className="flex bg-slate-200/70 p-1 rounded-xl border border-slate-300/60 text-xs font-bold overflow-x-auto">
        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'users'
              ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80 font-extrabold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
          }`}
        >
          <Users className="h-4 w-4 text-slate-500" /> Users ({users.length})
        </button>

        <button
          onClick={() => setActiveTab('roles')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'roles'
              ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80 font-extrabold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
          }`}
        >
          <ShieldCheck className="h-4 w-4 text-slate-500" /> Roles ({roles.length})
        </button>

        <button
          onClick={() => setActiveTab('matrix')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'matrix'
              ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80 font-extrabold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
          }`}
        >
          <KeyRound className="h-4 w-4 text-slate-500" /> Permissions Matrix
        </button>

        <button
          onClick={() => setActiveTab('approval')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'approval'
              ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80 font-extrabold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
          }`}
        >
          <BadgeCheck className="h-4 w-4 text-slate-500" /> Approval Rules
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'audit'
              ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80 font-extrabold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
          }`}
        >
          <History className="h-4 w-4 text-slate-500" /> Audit Logs ({auditLogs.length})
        </button>
      </div>

      {/* TAB 1: USERS LIST */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          {/* Header & Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
            <div className="flex flex-wrap items-center gap-2 flex-1 w-full">
              <div className="relative max-w-xs w-full">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Search staff accounts..."
                  value={userSearch}
                  onChange={(e) => {
                    setUserSearch(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-9 bg-slate-50 border-slate-200 text-xs font-semibold"
                />
              </div>

              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="h-9 px-3 border border-slate-200 rounded-md bg-slate-50 text-xs font-semibold text-slate-700"
              >
                <option value="">All Roles</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-9 px-3 border border-slate-200 rounded-md bg-slate-50 text-xs font-semibold text-slate-700"
              >
                <option value="">All Statuses</option>
                <option value="ACTIVE">Active Only</option>
                <option value="DEACTIVATED">Deactivated Only</option>
              </select>
            </div>
          </div>

          {/* Users Table */}
          <Card className="overflow-hidden border-slate-200 bg-white shadow-xs">
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <th className="p-3 pl-4">STAFF MEMBER</th>
                    <th className="p-3">USERNAME</th>
                    <th className="p-3">SECURITY ROLE</th>
                    <th className="p-3">ASSIGNED REGISTER</th>
                    <th className="p-3 text-center">STATUS</th>
                    <th className="p-3 text-right pr-4">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-xs text-slate-400 font-medium">
                        No matching staff accounts found.
                      </td>
                    </tr>
                  ) : (
                    paginatedUsers.map((u) => {
                      const status = u.status || (u.is_active ? 'ACTIVE' : 'DEACTIVATED');
                      const isSuperAdmin = u.role_name === 'SUPER_ADMIN';

                      return (
                        <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-3 pl-4">
                            <div className="font-extrabold text-slate-900 flex items-center gap-2">
                              {u.full_name}
                              {isSuperAdmin && (
                                <Badge className="bg-amber-100 text-amber-900 text-[9px] font-black px-1.5 py-0 border-amber-300">
                                  OWNER
                                </Badge>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-500">{u.email || u.username}</div>
                          </td>
                          <td className="p-3 font-mono text-slate-600 font-semibold">{u.username}</td>
                          <td className="p-3">
                            <Badge variant="outline" className={`font-extrabold uppercase text-[10px] px-2 py-0.5 ${
                              u.role_name === 'SUPER_ADMIN'
                                ? 'bg-amber-50 text-amber-800 border-amber-300'
                                : u.role_name === 'ADMIN_MANAGER' || u.role_name === 'ADMIN'
                                ? 'bg-purple-50 text-purple-700 border-purple-200'
                                : u.role_name === 'CASHIER'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : u.role_name === 'KITCHEN_USER'
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : 'bg-slate-100 text-slate-700 border-slate-300'
                            }`}>
                              {u.role_name}
                            </Badge>
                          </td>
                          <td className="p-3 font-mono text-slate-500 font-medium">
                            {u.terminal_id || 'POS-01 (Flagship)'}
                          </td>
                          <td className="p-3 text-center">
                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-extrabold ${
                              status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                              {status}
                            </span>
                          </td>
                          <td className="p-3 text-right pr-4">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setViewingUserAccess(u)}
                                title="View Effective Access Breakdown"
                                className="h-7 px-2 text-[10px] font-bold text-slate-700 gap-1 border-slate-200 hover:bg-slate-100"
                              >
                                <Eye className="h-3.5 w-3.5 text-slate-500" /> View Access
                              </Button>

                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenUserForm(u)}
                                title="Edit User Details"
                                className="h-7 px-2 text-[10px] font-bold text-slate-700 gap-1 border-slate-200 hover:bg-slate-100"
                              >
                                <Pencil className="h-3.5 w-3.5 text-slate-500" /> Edit
                              </Button>

                              {!isSuperAdmin && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleToggleUserStatus(u)}
                                  title={status === 'ACTIVE' ? 'Deactivate Account' : 'Activate Account'}
                                  className={`h-7 px-2 text-[10px] font-bold gap-1 ${
                                    status === 'ACTIVE'
                                      ? 'text-rose-700 hover:bg-rose-50 border-rose-200'
                                      : 'text-emerald-700 hover:bg-emerald-50 border-emerald-200'
                                  }`}
                                >
                                  {status === 'ACTIVE' ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={filteredUsers.length}
                pageSize={pageSize}
                onPageChange={(page) => setCurrentPage(page)}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setCurrentPage(1);
                }}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 2: ROLES LIST */}
      {activeTab === 'roles' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Security Roles & Access Levels</h2>
              <p className="text-xs text-slate-500">Define what each type of employee can access across store operations.</p>
            </div>
            <Button
              onClick={() => setIsRoleFormOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5 cursor-pointer shadow-xs"
            >
              <Plus className="h-4 w-4" /> Create Custom Role
            </Button>
          </div>

          <Card className="border-slate-200 bg-white shadow-xs overflow-hidden">
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <th className="p-3 pl-4">ROLE IDENTIFIER</th>
                    <th className="p-3">DESCRIPTION</th>
                    <th className="p-3 text-center">ASSIGNED USERS</th>
                    <th className="p-3 text-center">ACCESS LEVEL</th>
                    <th className="p-3 text-center">TYPE & PROTECTION</th>
                    <th className="p-3 text-right pr-4">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {roles.map((r) => {
                    const assignedUserCount = users.filter((u) => u.role_id === r.id).length;
                    const isProtected = r.is_system;

                    return (
                      <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3 pl-4 font-mono font-extrabold text-slate-900">{r.name}</td>
                        <td className="p-3 text-slate-500 font-medium">{r.description || 'Custom Role Profile'}</td>
                        <td className="p-3 text-center font-bold text-slate-700">{assignedUserCount} staff</td>
                        <td className="p-3 text-center">
                          <Badge variant="outline" className={`font-extrabold text-[10px] ${
                            r.name === 'SUPER_ADMIN'
                              ? 'bg-amber-50 text-amber-800 border-amber-300'
                              : r.name === 'ADMIN_MANAGER' || r.name === 'ADMIN'
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : r.name === 'CASHIER'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-slate-100 text-slate-700 border-slate-300'
                          }`}>
                            {r.name === 'SUPER_ADMIN' ? 'Full Access' : r.name.includes('ADMIN') ? 'Administrative' : r.name === 'CASHIER' ? 'Standard' : 'Operational'}
                          </Badge>
                        </td>
                        <td className="p-3 text-center">
                          {isProtected ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                              <Lock className="h-3 w-3 text-slate-500" /> Protected System
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Custom Role
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-right pr-4">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setDuplicatingRole(r);
                                setNewDuplicateName(`${r.name}_COPY`);
                                setIsDuplicateRoleOpen(true);
                              }}
                              title="Duplicate Role Permissions"
                              className="h-7 px-2 text-[10px] font-bold text-slate-700 gap-1 border-slate-200 hover:bg-slate-100"
                            >
                              <Copy className="h-3.5 w-3.5 text-slate-500" /> Duplicate
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setActiveTab('matrix')}
                              title="Edit Role Permissions Matrix"
                              className="h-7 px-2 text-[10px] font-bold text-slate-700 gap-1 border-slate-200 hover:bg-slate-100"
                            >
                              <Pencil className="h-3.5 w-3.5 text-slate-500" /> Edit Matrix
                            </Button>

                            {!isProtected && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDeleteCustomRole(r)}
                                title="Delete Custom Role"
                                className="h-7 px-2 text-[10px] font-bold text-rose-700 hover:bg-rose-50 border-rose-200"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 3: PERMISSIONS MATRIX (Simple vs Advanced Mode) */}
      {activeTab === 'matrix' && (
        <div className="space-y-4">
          {/* Unsaved Changes Banner */}
          {hasPendingChanges && (
            <div className="bg-amber-50 border border-amber-300 p-3 rounded-lg flex items-center justify-between text-xs text-amber-900 shadow-sm animate-pulse">
              <div className="flex items-center gap-2 font-bold">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                <span>You have unsaved permission matrix changes pending.</span>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={handleCancelMatrixChanges} className="h-7 text-xs font-semibold">
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSaveMatrixChanges} className="h-7 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs">
                  Save Changes Live
                </Button>
              </div>
            </div>
          )}

          {/* Filter & Mode Switcher Header */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700">Display Mode:</span>
              <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-bold">
                <button
                  onClick={() => setMatrixMode('simple')}
                  className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                    matrixMode === 'simple' ? 'bg-white text-slate-900 font-extrabold shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Simple Business Modules
                </button>
                <button
                  onClick={() => setMatrixMode('advanced')}
                  className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                    matrixMode === 'advanced' ? 'bg-white text-slate-900 font-extrabold shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Advanced Code Matrix
                </button>
              </div>
            </div>

            <div className="relative max-w-xs w-full">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Filter permissions..."
                value={matrixSearch}
                onChange={(e) => setMatrixSearch(e.target.value)}
                className="pl-9 bg-slate-50 border-slate-200 text-xs font-semibold"
              />
            </div>
          </div>

          {/* MODE A: SIMPLE BUSINESS MODULE MATRIX */}
          {matrixMode === 'simple' && (
            <div className="space-y-4">
              {MODULE_GROUPS.map((group) => {
                const groupMatch =
                  !matrixSearch.trim() ||
                  group.name.toLowerCase().includes(matrixSearch.toLowerCase()) ||
                  group.description.toLowerCase().includes(matrixSearch.toLowerCase());
                if (!groupMatch) return null;

                return (
                  <Card key={group.id} className="border-slate-200 bg-white shadow-xs overflow-hidden">
                    <CardHeader className="bg-slate-50 border-b border-slate-100 py-3 px-5 flex flex-row items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{group.icon}</span>
                        <div>
                          <CardTitle className="text-sm font-bold text-slate-900">{group.name}</CardTitle>
                          <p className="text-[11px] text-slate-500 font-medium">{group.description}</p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 space-y-4">
                      {/* Access Level Dropdowns by Role */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 border-b border-slate-100 pb-4">
                        {roles.map((r) => {
                          const currentPerms = draftRolePermissions[r.id] || [];
                          const groupPermIds = group.permissions.map((p) => p.id);
                          const assignedCount = groupPermIds.filter((id) => currentPerms.includes(id)).length;

                          let level = 'Custom';
                          if (assignedCount === 0) level = 'No Access';
                          else if (assignedCount === groupPermIds.length) level = 'Full Access';

                          const isSuperAdmin = r.name === 'SUPER_ADMIN';

                          return (
                            <div key={r.id} className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/60 text-xs space-y-1">
                              <div className="flex items-center justify-between font-bold text-slate-900">
                                <span>{r.name}</span>
                                <Badge variant="outline" className="text-[9px] font-extrabold bg-white">
                                  {assignedCount}/{groupPermIds.length} Granted
                                </Badge>
                              </div>
                              <select
                                disabled={isSuperAdmin}
                                value={level}
                                onChange={(e) => handleSetSimpleModuleAccess(r.id, group, e.target.value as any)}
                                className="w-full h-8 px-2 border border-slate-300 rounded bg-white text-xs font-semibold text-slate-800 disabled:opacity-50"
                              >
                                <option value="Full Access">Full Access</option>
                                <option value="Create & Edit">Create & Edit</option>
                                <option value="View Only">View Only</option>
                                <option value="No Access">No Access</option>
                                <option value="Custom">Custom Selection</option>
                              </select>
                            </div>
                          );
                        })}
                      </div>

                      {/* Detailed Permission Checkboxes */}
                      <div className="space-y-2 pt-1">
                        <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                          Specific Granular Permissions for {group.name}:
                        </div>
                        <div className="divide-y divide-slate-100">
                          {group.permissions.map((p) => (
                            <div key={p.id} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 px-2 rounded">
                              <div>
                                <div className="font-extrabold text-slate-900 text-xs flex items-center gap-2">
                                  {p.label}
                                  {p.core && (
                                    <Badge className="bg-emerald-100 text-emerald-800 text-[9px] font-black border-emerald-300">
                                      CORE POS
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono">{p.code}</div>
                              </div>

                              <div className="flex items-center gap-4 overflow-x-auto">
                                {roles.map((r) => {
                                  const isChecked = (draftRolePermissions[r.id] || []).includes(p.id);
                                  const isSuperAdmin = r.name === 'SUPER_ADMIN';

                                  return (
                                    <button
                                      key={r.id}
                                      type="button"
                                      disabled={isSuperAdmin}
                                      onClick={() => handleToggleMatrixPermission(r.id, p.id)}
                                      className={`flex items-center gap-1 text-xs font-semibold p-1 rounded transition-colors ${
                                        isSuperAdmin
                                          ? 'opacity-60 text-emerald-700 cursor-not-allowed'
                                          : isChecked
                                          ? 'text-emerald-700 font-bold hover:bg-emerald-50 cursor-pointer'
                                          : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer'
                                      }`}
                                    >
                                      {isChecked || isSuperAdmin ? (
                                        <CheckSquare className="h-4 w-4 text-emerald-600" />
                                      ) : (
                                        <Square className="h-4 w-4 text-slate-300" />
                                      )}
                                      <span className="text-[10px] uppercase font-mono">{r.name.substring(0, 5)}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* MODE B: ADVANCED CODE MATRIX */}
          {matrixMode === 'advanced' && (
            <Card className="border-slate-200 bg-white shadow-xs overflow-hidden">
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 sticky top-0 z-10">
                      <th className="p-3 min-w-[260px] bg-slate-100">PAGE MODULE / PERMISSION CODE</th>
                      <th className="p-3 text-center w-24 bg-slate-100">LEVEL</th>
                      {roles.map((r) => {
                        const isSuperAdmin = r.name === 'SUPER_ADMIN';
                        return (
                          <th key={r.id} className="p-3 text-center min-w-[120px] bg-slate-100">
                            <div className="font-mono text-[11px] font-extrabold text-slate-900">{r.name}</div>
                            {!isSuperAdmin && (
                              <div className="flex justify-center gap-1 mt-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleBulkMatrixRole(r.id, true)}
                                  className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 cursor-pointer border border-emerald-200"
                                >
                                  All
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleBulkMatrixRole(r.id, false)}
                                  className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 hover:bg-rose-100 cursor-pointer border border-rose-200"
                                >
                                  Clear
                                </button>
                              </div>
                            )}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {MODULE_GROUPS.map((group) => {
                      const groupPerms = group.permissions.filter((p) =>
                        !matrixSearch.trim() ||
                        p.code.toLowerCase().includes(matrixSearch.toLowerCase()) ||
                        p.label.toLowerCase().includes(matrixSearch.toLowerCase())
                      );
                      if (groupPerms.length === 0) return null;

                      return (
                        <React.Fragment key={group.id}>
                          <tr className="bg-slate-100/90 text-slate-900 font-black border-y border-slate-200">
                            <td colSpan={2 + roles.length} className="px-3 py-2 text-[11px] tracking-wide uppercase font-extrabold text-slate-800">
                              {group.icon} {group.name}
                            </td>
                          </tr>
                          {groupPerms.map((p) => {
                            const actionType = p.type;
                            return (
                              <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                                <td className="p-3 pl-5">
                                  <div className="font-extrabold text-slate-900 text-xs flex items-center gap-2">
                                    {p.label}
                                    {p.core && (
                                      <Badge className="bg-emerald-100 text-emerald-800 text-[9px] font-black border-emerald-300">
                                        CORE POS
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-slate-400 font-mono">{p.code}</div>
                                </td>
                                <td className="p-3 text-center">
                                  <Badge variant="outline" className={`text-[9px] font-extrabold uppercase py-0.5 px-2 ${
                                    actionType === 'OVERRIDE' || actionType === 'DELETE'
                                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                                      : actionType === 'CREATE'
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : actionType === 'EDIT'
                                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                                      : 'bg-blue-50 text-blue-700 border-blue-200'
                                  }`}>
                                    {actionType}
                                  </Badge>
                                </td>
                                {roles.map((r) => {
                                  const isChecked = (draftRolePermissions[r.id] || []).includes(p.id);
                                  const isSuperAdmin = r.name === 'SUPER_ADMIN';

                                  return (
                                    <td key={r.id} className="p-3 text-center">
                                      <button
                                        type="button"
                                        disabled={isSuperAdmin}
                                        onClick={() => handleToggleMatrixPermission(r.id, p.id)}
                                        className={`inline-flex items-center justify-center p-1 rounded transition-colors ${
                                          isSuperAdmin
                                            ? 'opacity-60 cursor-not-allowed text-emerald-600'
                                            : isChecked
                                            ? 'text-emerald-600 hover:bg-emerald-50 cursor-pointer'
                                            : 'text-slate-300 hover:bg-slate-100 cursor-pointer'
                                        }`}
                                      >
                                        {isChecked || isSuperAdmin ? (
                                          <CheckSquare className="h-4 w-4 text-emerald-600" />
                                        ) : (
                                          <Square className="h-4 w-4 text-slate-300" />
                                        )}
                                      </button>
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* TAB 4: APPROVAL RULES */}
      {activeTab === 'approval' && (
        <Card className="border-slate-200 bg-white shadow-xs overflow-hidden">
          <CardHeader className="bg-slate-50 border-b border-slate-100 py-3 px-5">
            <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <BadgeCheck className="h-4 w-4 text-amber-600" /> Manager Authorization Threshold Rules
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100 text-xs">
              <div className="grid grid-cols-12 p-3 font-bold text-slate-500 bg-slate-50 border-b border-slate-100">
                <span className="col-span-4">ACTION THRESHOLD TYPE</span>
                <span className="col-span-4">ALLOWED RANGE</span>
                <span className="col-span-4 text-right pr-4">REQUIRED AUTHORIZATION ROLE</span>
              </div>
              {approvalRules.map((rule) => (
                <div key={rule.id} className="grid grid-cols-12 p-4 items-center font-semibold text-slate-900 hover:bg-slate-50">
                  <span className="col-span-4 font-extrabold text-slate-900 font-mono">{rule.ruleType}</span>
                  <span className="col-span-4 text-slate-600 font-mono">
                    {rule.minValue} to {rule.maxValue >= 999999 ? 'Unlimited' : rule.maxValue}
                    {rule.ruleType.includes('PERCENT') ? '%' : ' LKR'}
                  </span>
                  <span className="col-span-4 text-right pr-4">
                    <Badge className="bg-amber-100 text-amber-900 font-extrabold text-[10px]">
                      {rule.requiredRole}
                    </Badge>
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* TAB 5: AUDIT LOGS */}
      {activeTab === 'audit' && (
        <Card className="border-slate-200 bg-white shadow-xs overflow-hidden">
          <CardHeader className="bg-slate-50 border-b border-slate-100 py-3 px-5 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <History className="h-4 w-4 text-emerald-600" /> Immutable Security Audit Trail Log
            </CardTitle>
            <div className="relative max-w-xs">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Search audit logs..."
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                className="pl-9 h-8 text-xs bg-white border-slate-200"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <div className="divide-y divide-slate-100 text-xs min-w-[700px]">
              <div className="grid grid-cols-12 p-3 font-bold text-slate-500 bg-slate-50 border-b border-slate-100">
                <span className="col-span-3">TIMESTAMP & REGISTER</span>
                <span className="col-span-3">USER / ROLE</span>
                <span className="col-span-2">ACTION</span>
                <span className="col-span-4">DETAILS & AUTHORIZER</span>
              </div>
              {auditLogs.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">No audit log entries recorded yet.</div>
              ) : (
                auditLogs
                  .filter((log) =>
                    !auditSearch.trim() ||
                    (log.userName || '').toLowerCase().includes(auditSearch.toLowerCase()) ||
                    (log.action || '').toLowerCase().includes(auditSearch.toLowerCase()) ||
                    (log.reason || '').toLowerCase().includes(auditSearch.toLowerCase())
                  )
                  .map((log) => (
                    <div key={log.id} className="grid grid-cols-12 p-3 items-center text-slate-900 hover:bg-slate-50 font-sans">
                      <div className="col-span-3 font-mono text-[11px]">
                        <div className="font-extrabold text-slate-900">{new Date(log.timestamp).toLocaleString()}</div>
                        <div className="text-[10px] text-slate-400">{log.deviceId || 'POS-TERMINAL-01'}</div>
                      </div>
                      <div className="col-span-3">
                        <div className="font-bold text-slate-900">{log.userName || 'System'}</div>
                        <div className="text-[10px] text-emerald-700 font-extrabold uppercase">{log.roleName || 'SYSTEM'}</div>
                      </div>
                      <div className="col-span-2">
                        <Badge variant="outline" className="text-[9px] font-mono font-bold bg-slate-50">
                          {log.action}
                        </Badge>
                      </div>
                      <div className="col-span-4">
                        <div className="text-slate-700 font-medium">{log.newValue || log.reason || log.entity || 'Security Event'}</div>
                        {log.authorizerName && (
                          <div className="text-[10px] text-amber-800 font-bold">
                            Authorized by: {log.authorizerName}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* CREATE / EDIT USER MODAL */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[999] animate-fade-in">
          <div className="bg-white rounded-xl max-w-lg w-full p-5 space-y-4 shadow-2xl border border-slate-200 text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-emerald-600" />
                <h3 className="text-base font-extrabold text-slate-900">
                  {editingUser ? 'Edit Staff User Account' : 'Add New Staff User Account'}
                </h3>
              </div>
              <button onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-slate-700 font-bold p-1 cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-lg">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveUser} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700">Full Name *</label>
                  <Input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    placeholder="e.g. Sarah Connor"
                    className="mt-1 text-xs bg-slate-50 border-slate-300"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700">Username *</label>
                  <Input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    placeholder="e.g. sarah"
                    className="mt-1 text-xs bg-slate-50 border-slate-300 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700">Assigned Role *</label>
                  <select
                    value={roleId}
                    onChange={(e) => setRoleId(e.target.value)}
                    className="w-full h-9 mt-1 px-3 border border-slate-300 rounded-md bg-slate-50 text-xs font-bold text-slate-900 focus:bg-white"
                  >
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.description || 'System Role'})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700">Assigned POS Terminal</label>
                  <select
                    value={assignedRegister}
                    onChange={(e) => setAssignedRegister(e.target.value)}
                    className="w-full h-9 mt-1 px-3 border border-slate-300 rounded-md bg-slate-50 text-xs font-bold text-slate-900 focus:bg-white"
                  >
                    <option value="POS-01">POS-01 (Flagship Store)</option>
                    <option value="POS-02">POS-02 (Register 02)</option>
                    <option value="ALL">All POS Terminals</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700">Manager Authorization PIN</label>
                  <Input
                    type="password"
                    maxLength={6}
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    placeholder={editingUser ? 'Leave blank to keep existing PIN' : 'e.g. 5555'}
                    className="mt-1 text-xs bg-slate-50 border-slate-300 font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700">Account Password</label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={editingUser ? 'Leave blank to keep existing' : 'Password@123'}
                    className="mt-1 text-xs bg-slate-50 border-slate-300 font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsFormOpen(false)} className="text-xs font-semibold">
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-6">
                  {editingUser ? 'Save User Changes' : 'Create Staff Account'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE ROLE WITH PRESETS MODAL */}
      {isRoleFormOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[999] animate-fade-in">
          <div className="bg-white rounded-xl max-w-lg w-full p-5 space-y-4 shadow-2xl border border-slate-200 text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
                <h3 className="text-base font-extrabold text-slate-900">Create Security Role</h3>
              </div>
              <button onClick={() => setIsRoleFormOpen(false)} className="text-slate-400 hover:text-slate-700 font-bold p-1 cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomRole} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700">Role Identifier Name *</label>
                <Input
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  required
                  placeholder="e.g. SENIOR_CASHIER"
                  className="mt-1 text-xs bg-slate-50 border-slate-300 font-mono uppercase"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700">Role Description</label>
                <Input
                  value={newRoleDesc}
                  onChange={(e) => setNewRoleDesc(e.target.value)}
                  placeholder="e.g. Senior cashier with refund privileges"
                  className="mt-1 text-xs bg-slate-50 border-slate-300"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700">Start From Preset Template:</label>
                <div className="grid grid-cols-2 gap-2 mt-1 max-h-36 overflow-y-auto">
                  <div
                    onClick={() => setSelectedPreset('BLANK')}
                    className={`p-2 rounded border cursor-pointer text-[11px] ${
                      selectedPreset === 'BLANK' ? 'border-emerald-500 bg-emerald-50 font-bold' : 'border-slate-200 bg-slate-50'
                    }`}
                  >
                    <div>○ Blank Role</div>
                    <div className="text-[9px] text-slate-400">Zero default permissions</div>
                  </div>
                  {ROLE_PRESETS.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => {
                        setSelectedPreset(p.id);
                        if (!newRoleName) setNewRoleName(`${p.name.toUpperCase().replace(/\s+/g, '_')}_CUSTOM`);
                        if (!newRoleDesc) setNewRoleDesc(p.desc);
                      }}
                      className={`p-2 rounded border cursor-pointer text-[11px] ${
                        selectedPreset === p.id ? 'border-emerald-500 bg-emerald-50 font-bold' : 'border-slate-200 bg-slate-50'
                      }`}
                    >
                      <div>✓ {p.name}</div>
                      <div className="text-[9px] text-slate-400 truncate">{p.desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsRoleFormOpen(false)} className="text-xs font-semibold">
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-6">
                  Save Role
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DUPLICATE ROLE MODAL */}
      {isDuplicateRoleOpen && duplicatingRole && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[999] animate-fade-in">
          <div className="bg-white rounded-xl max-w-md w-full p-5 space-y-4 shadow-2xl border border-slate-200 text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Copy className="h-5 w-5 text-emerald-600" />
                <h3 className="text-base font-extrabold text-slate-900">Duplicate Security Role</h3>
              </div>
              <button onClick={() => setIsDuplicateRoleOpen(false)} className="text-slate-400 hover:text-slate-700 font-bold p-1 cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Cloning all permissions from <span className="font-extrabold font-mono text-slate-900">{duplicatingRole.name}</span> into a new role.
            </p>

            <form onSubmit={handleDuplicateRole} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700">New Cloned Role Name *</label>
                <Input
                  value={newDuplicateName}
                  onChange={(e) => setNewDuplicateName(e.target.value)}
                  required
                  placeholder="e.g. SENIOR_CASHIER"
                  className="mt-1 text-xs bg-slate-50 border-slate-300 font-mono uppercase"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsDuplicateRoleOpen(false)} className="text-xs font-semibold">
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-6">
                  Duplicate Role
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW EFFECTIVE ACCESS DRAWER */}
      {viewingUserAccess && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-end p-0 z-[999] animate-fade-in">
          <div className="bg-white max-w-md w-full h-full p-5 space-y-4 shadow-2xl border-l border-slate-200 text-slate-900 overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Eye className="h-5 w-5 text-emerald-600" />
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">{viewingUserAccess.full_name}</h3>
                  <p className="text-[10px] text-slate-500 font-mono">Role: {viewingUserAccess.role_name}</p>
                </div>
              </div>
              <button onClick={() => setViewingUserAccess(null)} className="text-slate-400 hover:text-slate-700 font-bold p-1 cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                <div className="font-bold text-slate-900">Effective Access Summary</div>
                <div className="text-[11px] text-slate-500">Calculated effective permissions inherited from role.</div>
              </div>

              <div className="space-y-2">
                {MODULE_GROUPS.map((group) => {
                  const uRolePerms = rolePermissions[viewingUserAccess.role_id] || [];
                  const isSuperAdmin = viewingUserAccess.role_name === 'SUPER_ADMIN' || viewingUserAccess.role_name === 'ADMIN_MANAGER' || viewingUserAccess.role_name === 'ADMIN';

                  const groupPermIds = group.permissions.map((p) => p.id);
                  const grantedCount = groupPermIds.filter((id) => uRolePerms.includes(id)).length;
                  const isFullyAllowed = isSuperAdmin || grantedCount === groupPermIds.length;

                  return (
                    <div key={group.id} className="p-3 rounded-lg border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between font-extrabold text-slate-900">
                        <span className="flex items-center gap-2">{group.icon} {group.name}</span>
                        <Badge className={isFullyAllowed || isSuperAdmin ? 'bg-emerald-100 text-emerald-800' : grantedCount > 0 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}>
                          {isSuperAdmin ? 'Full Access' : isFullyAllowed ? 'Full Access' : grantedCount > 0 ? `${grantedCount} Allowed` : 'No Access'}
                        </Badge>
                      </div>

                      <div className="space-y-1 pt-1">
                        {group.permissions.map((p) => {
                          const isPermGranted = isSuperAdmin || uRolePerms.includes(p.id);
                          return (
                            <div key={p.id} className="flex items-center justify-between text-[11px] py-1 border-t border-slate-100">
                              <span className="text-slate-700">{p.label}</span>
                              {isPermGranted ? (
                                <span className="text-emerald-700 font-bold flex items-center gap-1">
                                  <Check className="h-3 w-3 text-emerald-600" /> Allowed
                                </span>
                              ) : (
                                <span className="text-slate-400 font-bold flex items-center gap-1">
                                  <X className="h-3 w-3 text-slate-300" /> Restricted
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TEST USER ACCESS DRAWER */}
      {isTestAccessOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[999] animate-fade-in">
          <div className="bg-white rounded-xl max-w-lg w-full p-5 space-y-4 shadow-2xl border border-slate-200 text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-amber-600" />
                <h3 className="text-base font-extrabold text-slate-900">Test Staff User Access</h3>
              </div>
              <button onClick={() => setIsTestAccessOpen(false)} className="text-slate-400 hover:text-slate-700 font-bold p-1 cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700">Select Staff User Account:</label>
                <select
                  value={testUser?.id || ''}
                  onChange={(e) => {
                    const found = users.find((u) => u.id === e.target.value);
                    setTestUser(found || null);
                    setTestResult(null);
                  }}
                  className="w-full h-9 mt-1 px-3 border border-slate-300 rounded bg-slate-50 text-xs font-bold text-slate-900"
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name} ({u.role_name})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700">Select Operation / Action to Test:</label>
                <select
                  value={testAction}
                  onChange={(e) => {
                    setTestAction(e.target.value);
                    setTestResult(null);
                  }}
                  className="w-full h-9 mt-1 px-3 border border-slate-300 rounded bg-slate-50 text-xs font-bold text-slate-900"
                >
                  <option value="pos.access">Access POS Checkout Terminal</option>
                  <option value="orders.create">Create POS Orders</option>
                  <option value="payments.refund">Process Customer Refund</option>
                  <option value="orders.void">Void Order / Item</option>
                  <option value="products.change_price">Override Selling Price</option>
                  <option value="inventory.adjust">Adjust Stock Quantities</option>
                  <option value="products.create">Create Products</option>
                  <option value="reports.view">View Operational Reports</option>
                  <option value="settings.manage">Manage System Settings</option>
                </select>
              </div>

              <div className="flex justify-end pt-2">
                <Button onClick={handleRunTestAccess} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5 px-5 cursor-pointer">
                  Run Test Access
                </Button>
              </div>

              {/* Result Banner */}
              {testResult && (
                <div className={`p-4 rounded-lg border text-xs space-y-2 mt-3 ${
                  testResult.allowed ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : 'bg-rose-50 border-rose-300 text-rose-900'
                }`}>
                  <div className="flex items-center gap-2 font-extrabold text-sm">
                    {testResult.allowed ? (
                      <>
                        <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                        <span>ACCESS ALLOWED</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-5 w-5 text-rose-600 shrink-0" />
                        <span>ACCESS DENIED</span>
                      </>
                    )}
                  </div>

                  <div className="text-xs space-y-1 font-mono">
                    <div>• Staff User: <span className="font-bold">{testResult.user.full_name}</span></div>
                    <div>• Security Role: <span className="font-bold">{testResult.role}</span></div>
                    <div>• Action Tested: <span className="font-bold">{testResult.permissionLabel}</span></div>
                    {testResult.requiresApproval && (
                      <div className="text-amber-800 font-bold mt-1">
                        ⚠️ Requires Manager Authorization PIN ({testResult.requiredRoleName})
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
