import { useState } from 'react';
import { useCRM } from '../contexts/CRMContext';
import { useLanguage } from '../contexts/LanguageContext';
import { User, UserPermissions, defaultPermissions } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Checkbox } from '../components/ui/checkbox';
import { Switch } from '../components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../components/ui/tabs';
import { Plus, UserCircle, Mail, Phone, Edit, Trash2, Shield, Key, Eye, EyeOff, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Users } from 'lucide-react';

interface NewUserForm {
  name: string;
  email: string;
  phone: string;
  role: 'admin' | 'sales' | 'manager';
  password: string;
  confirmPassword: string;
  isActive: boolean;
  permissions: UserPermissions;
}

const emptyForm: NewUserForm = {
  name: '',
  email: '',
  phone: '',
  role: 'sales',
  password: '',
  confirmPassword: '',
  isActive: true,
  permissions: { ...defaultPermissions },
};

export default function UsersPage() {
  const { users, addUser, updateUser, deleteUser } = useCRM();
  const { t, language } = useLanguage();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<(User & { password: string; confirmPassword: string }) | null>(null);
  const [newUser, setNewUser] = useState<NewUserForm>({ ...emptyForm });
  const [showPassword, setShowPassword] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);

  const roleLabels: Record<string, string> = {
    admin: t('perm_users') === 'User Management' ? 'Admin' : 'مدير',
    sales: t('perm_calls') === 'Calls' ? 'Sales' : 'موظف مبيعات',
    manager: t('perm_reports') === 'Reports' ? 'Manager' : 'مدير فريق',
  };

  const roleColors: Record<string, string> = {
    admin: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    sales: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    manager: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  };

  const permissionKeys: { key: keyof UserPermissions; label: string }[] = [
    { key: 'leads', label: t('perm_leads') },
    { key: 'calls', label: t('perm_calls') },
    { key: 'reports', label: t('perm_reports') },
    { key: 'analytics', label: t('perm_analytics') },
    { key: 'settings', label: t('perm_settings') },
    { key: 'users', label: t('perm_users') },
    { key: 'import_data', label: t('perm_import') },
    { key: 'auto_dial', label: t('perm_auto_dial') },
    { key: 'calendar', label: t('perm_calendar') },
    { key: 'templates', label: t('perm_templates') },
    { key: 'data_collection', label: t('perm_data_collection') },
  ];

  const setPermissionsForRole = (role: 'admin' | 'sales' | 'manager'): UserPermissions => {
    if (role === 'admin') {
      return {
        leads: true, calls: true, reports: true, analytics: true,
        settings: true, users: true, import_data: true, auto_dial: true,
        calendar: true, templates: true, data_collection: true,
      };
    }
    if (role === 'manager') {
      return {
        leads: true, calls: true, reports: true, analytics: true,
        settings: false, users: false, import_data: true, auto_dial: true,
        calendar: true, templates: true, data_collection: true,
      };
    }
    return { ...defaultPermissions };
  };

  const handleAddUser = () => {
    if (!newUser.name || !newUser.email) {
      toast.error(language === 'ar' ? 'يرجى إدخال الاسم والبريد الإلكتروني' : 'Please enter name and email');
      return;
    }
    if (!newUser.password || newUser.password.length < 6) {
      toast.error(t('password_min_6'));
      return;
    }
    if (newUser.password !== newUser.confirmPassword) {
      toast.error(t('passwords_not_match'));
      return;
    }
    addUser({
      name: newUser.name,
      email: newUser.email,
      phone: newUser.phone,
      role: newUser.role,
      password: newUser.password,
      isActive: newUser.isActive,
      permissions: newUser.permissions,
    });
    toast.success(language === 'ar' ? 'تم إضافة المستخدم بنجاح' : 'User added successfully');
    setNewUser({ ...emptyForm });
    setIsAddModalOpen(false);
    setShowPassword(false);
  };

  const handleEditUser = () => {
    if (!editingUser) return;
    if (editingUser.password && editingUser.password.length < 6) {
      toast.error(t('password_min_6'));
      return;
    }
    if (editingUser.password && editingUser.password !== editingUser.confirmPassword) {
      toast.error(t('passwords_not_match'));
      return;
    }
    const updates: Partial<User> & { password?: string } = {
      name: editingUser.name,
      email: editingUser.email,
      phone: editingUser.phone,
      role: editingUser.role,
      isActive: editingUser.isActive,
      permissions: editingUser.permissions,
    };
    if (editingUser.password) {
      updates.password = editingUser.password;
    }
    updateUser(editingUser._id, updates);
    toast.success(language === 'ar' ? 'تم تعديل المستخدم بنجاح' : 'User updated successfully');
    setEditingUser(null);
    setShowEditPassword(false);
  };

  const handleDeleteUser = (id: string) => {
    const targetUser = users.find(u => u._id === id);
    if (targetUser?.role === 'admin') {
      toast.error(language === 'ar' ? 'لا يمكن حذف حساب المدير' : 'Admin account cannot be deleted');
      return;
    }
    deleteUser(id);
    toast.success(language === 'ar' ? 'تم حذف المستخدم' : 'User deleted');
  };

  const openEditModal = (user: User) => {
    setEditingUser({
      ...user,
      permissions: user.permissions || { ...defaultPermissions },
      password: '',
      confirmPassword: '',
    });
    setShowEditPassword(false);
  };

  const handleRoleChange = (role: 'admin' | 'sales' | 'manager', isEdit: boolean) => {
    const perms = setPermissionsForRole(role);
    if (isEdit && editingUser) {
      setEditingUser({ ...editingUser, role, permissions: perms });
    } else {
      setNewUser({ ...newUser, role, permissions: perms });
    }
  };

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-primary/10 group hover:bg-primary/20 transition-all duration-300">
            <Users className="h-10 w-10 text-primary transition-transform duration-500 group-hover:rotate-12 group-hover:scale-110" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">{t('user_management_title')}</h1>
            <p className="text-muted-foreground">{t('manage_system_users')}</p>
          </div>
        </div>
        <Button onClick={() => { setNewUser({ ...emptyForm }); setIsAddModalOpen(true); setShowPassword(false); }}>
          <Plus className={`${language === 'ar' ? 'ml-2' : 'mr-2'} h-4 w-4`} />
          {t('add_user')}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t('total_users')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{users.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t('sales_staff')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">
              {users.filter(u => u.role === 'sales').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t('managers_admins')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-600">
              {users.filter(u => u.role === 'admin' || u.role === 'manager').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t('active_users')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {users.filter(u => u.isActive !== false).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t('user_management_title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('full_name')}</TableHead>
                <TableHead>{t('email')}</TableHead>
                <TableHead>{language === 'ar' ? 'الهاتف' : 'Phone'}</TableHead>
                <TableHead>{t('user_role')}</TableHead>
                <TableHead>{t('permissions')}</TableHead>
                <TableHead>{language === 'ar' ? 'الحالة' : 'Status'}</TableHead>
                <TableHead>{language === 'ar' ? 'تاريخ الانضمام' : 'Joined'}</TableHead>
                <TableHead>{language === 'ar' ? 'الإجراءات' : 'Actions'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user._id} className={user.isActive === false ? 'opacity-50' : ''}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <UserCircle className="h-8 w-8 text-muted-foreground" />
                        <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background ${user.isActive !== false ? 'bg-green-500' : 'bg-gray-400'}`} />
                      </div>
                      <span className="font-medium">{user.name}</span>
                    </div>
                  </TableCell>
                  <TableCell dir="ltr" className={language === 'ar' ? 'text-right' : ''}>{user.email}</TableCell>
                  <TableCell dir="ltr" className={language === 'ar' ? 'text-right' : ''}>{user.phone || '-'}</TableCell>
                  <TableCell>
                    <Badge className={roleColors[user.role]}>
                      {roleLabels[user.role]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1 max-w-[200px]">
                      {user.permissions && Object.entries(user.permissions)
                        .filter(([, v]) => v)
                        .slice(0, 3)
                        .map(([k]) => (
                          <Badge key={k} variant="outline" className="text-[10px] px-1.5 py-0">
                            {permissionKeys.find(p => p.key === k)?.label || k}
                          </Badge>
                        ))}
                      {user.permissions && Object.values(user.permissions).filter(Boolean).length > 3 && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          +{Object.values(user.permissions).filter(Boolean).length - 3}
                        </Badge>
                      )}
                      {user.role === 'admin' && !user.permissions && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-red-300 text-red-600">
                          {language === 'ar' ? 'كل الصلاحيات' : 'Full Access'}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {user.isActive !== false ? (
                      <div className="flex items-center gap-1 text-green-600">
                        <CheckCircle2 className="h-4 w-4" />
                        <span className="text-xs">{t('active_status')}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-gray-400">
                        <XCircle className="h-4 w-4" />
                        <span className="text-xs">{t('inactive')}</span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(user.createdAt).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US')}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => openEditModal(user)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      {user.role !== 'admin' && (
                        <Button size="sm" variant="destructive" onClick={() => handleDeleteUser(user._id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add User Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent dir={language === 'ar' ? 'rtl' : 'ltr'} className="max-w-2xl max-h-[90vh] overflow-y-auto" aria-describedby="add-user-desc">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              {t('add_user')}
            </DialogTitle>
            <DialogDescription id="add-user-desc">
              {language === 'ar' ? 'أدخل بيانات المستخدم الجديد وحدد الصلاحيات' : 'Enter new user details and set permissions'}
            </DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="info" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="info" className="flex items-center gap-1">
                <UserCircle className="h-4 w-4" />
                {language === 'ar' ? 'المعلومات' : 'Info'}
              </TabsTrigger>
              <TabsTrigger value="credentials" className="flex items-center gap-1">
                <Key className="h-4 w-4" />
                {t('login_credentials')}
              </TabsTrigger>
              <TabsTrigger value="permissions" className="flex items-center gap-1">
                <Shield className="h-4 w-4" />
                {t('permissions')}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>{t('full_name')} *</Label>
                <Input value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>{t('email')} *</Label>
                <Input type="email" dir="ltr" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>{language === 'ar' ? 'الهاتف' : 'Phone'}</Label>
                <Input dir="ltr" value={newUser.phone} onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>{t('user_role')}</Label>
                <Select value={newUser.role} onValueChange={(v: 'admin' | 'sales' | 'manager') => handleRoleChange(v, false)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sales">{roleLabels.sales}</SelectItem>
                    <SelectItem value="manager">{roleLabels.manager}</SelectItem>
                    <SelectItem value="admin">{roleLabels.admin}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <Label>{language === 'ar' ? 'تفعيل الحساب' : 'Activate Account'}</Label>
                <Switch checked={newUser.isActive} onCheckedChange={(checked) => setNewUser({ ...newUser, isActive: checked })} />
              </div>
            </TabsContent>

            <TabsContent value="credentials" className="space-y-4 mt-4">
              <div className="p-4 rounded-lg bg-muted/50 border">
                <div className="flex items-center gap-2 mb-4">
                  <Key className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">{t('login_credentials')}</h3>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>{t('password')} *</Label>
                    <div className="relative">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        dir="ltr"
                        value={newUser.password}
                        onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        className={`absolute top-1/2 -translate-y-1/2 ${language === 'ar' ? 'left-3' : 'right-3'} text-muted-foreground hover:text-foreground`}
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground">{t('password_min_6')}</p>
                  </div>
                  <div className="space-y-2">
                    <Label>{t('confirm_password')} *</Label>
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      dir="ltr"
                      value={newUser.confirmPassword}
                      onChange={(e) => setNewUser({ ...newUser, confirmPassword: e.target.value })}
                      placeholder="••••••••"
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="permissions" className="space-y-4 mt-4">
              <div className="p-4 rounded-lg bg-muted/50 border">
                <div className="flex items-center gap-2 mb-4">
                  <Shield className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">{t('permissions')}</h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {permissionKeys.map(({ key, label }) => (
                    <div key={key} className="flex items-center space-x-2 space-x-reverse p-2 rounded-md hover:bg-background transition-colors">
                      <Checkbox
                        id={`add-perm-${key}`}
                        checked={newUser.permissions[key]}
                        onCheckedChange={(checked) =>
                          setNewUser({
                            ...newUser,
                            permissions: { ...newUser.permissions, [key]: !!checked },
                          })
                        }
                      />
                      <Label htmlFor={`add-perm-${key}`} className="cursor-pointer text-sm">{label}</Label>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => setIsAddModalOpen(false)} className="flex-1">
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button onClick={handleAddUser} className="flex-1">
              {t('add_user')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit User Modal */}
      <Dialog open={!!editingUser} onOpenChange={(open) => { if (!open) { setEditingUser(null); setShowEditPassword(false); } }}>
        <DialogContent dir={language === 'ar' ? 'rtl' : 'ltr'} className="max-w-2xl max-h-[90vh] overflow-y-auto" aria-describedby="edit-user-desc">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              {t('edit_user')}
            </DialogTitle>
            <DialogDescription id="edit-user-desc">
              {language === 'ar' ? 'تعديل بيانات المستخدم والصلاحيات' : 'Update user details and permissions'}
            </DialogDescription>
          </DialogHeader>
          {editingUser && (
            <Tabs defaultValue="info" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="info" className="flex items-center gap-1">
                  <UserCircle className="h-4 w-4" />
                  {language === 'ar' ? 'المعلومات' : 'Info'}
                </TabsTrigger>
                <TabsTrigger value="credentials" className="flex items-center gap-1">
                  <Key className="h-4 w-4" />
                  {t('login_credentials')}
                </TabsTrigger>
                <TabsTrigger value="permissions" className="flex items-center gap-1">
                  <Shield className="h-4 w-4" />
                  {t('permissions')}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="info" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>{t('full_name')}</Label>
                  <Input value={editingUser.name} onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>{t('email')}</Label>
                  <Input type="email" dir="ltr" value={editingUser.email} onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>{language === 'ar' ? 'الهاتف' : 'Phone'}</Label>
                  <Input dir="ltr" value={editingUser.phone || ''} onChange={(e) => setEditingUser({ ...editingUser, phone: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>{t('user_role')}</Label>
                  <Select value={editingUser.role} onValueChange={(v: 'admin' | 'sales' | 'manager') => handleRoleChange(v, true)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sales">{roleLabels.sales}</SelectItem>
                      <SelectItem value="manager">{roleLabels.manager}</SelectItem>
                      <SelectItem value="admin">{roleLabels.admin}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <Label>{language === 'ar' ? 'حالة الحساب' : 'Account Status'}</Label>
                    <p className="text-xs text-muted-foreground">
                      {editingUser.isActive !== false ? t('account_active') : t('account_inactive')}
                    </p>
                  </div>
                  <Switch
                    checked={editingUser.isActive !== false}
                    onCheckedChange={(checked) => setEditingUser({ ...editingUser, isActive: checked })}
                  />
                </div>
              </TabsContent>

              <TabsContent value="credentials" className="space-y-4 mt-4">
                <div className="p-4 rounded-lg bg-muted/50 border">
                  <div className="flex items-center gap-2 mb-4">
                    <Key className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold">{t('change_password')}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">{t('leave_empty_keep_password')}</p>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>{t('new_password')}</Label>
                      <div className="relative">
                        <Input
                          type={showEditPassword ? 'text' : 'password'}
                          dir="ltr"
                          value={editingUser.password}
                          onChange={(e) => setEditingUser({ ...editingUser, password: e.target.value })}
                          placeholder="••••••••"
                        />
                        <button
                          type="button"
                          className={`absolute top-1/2 -translate-y-1/2 ${language === 'ar' ? 'left-3' : 'right-3'} text-muted-foreground hover:text-foreground`}
                          onClick={() => setShowEditPassword(!showEditPassword)}
                        >
                          {showEditPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>{t('confirm_password')}</Label>
                      <Input
                        type={showEditPassword ? 'text' : 'password'}
                        dir="ltr"
                        value={editingUser.confirmPassword}
                        onChange={(e) => setEditingUser({ ...editingUser, confirmPassword: e.target.value })}
                        placeholder="••••••••"
                      />
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="permissions" className="space-y-4 mt-4">
                <div className="p-4 rounded-lg bg-muted/50 border">
                  <div className="flex items-center gap-2 mb-4">
                    <Shield className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold">{t('permissions')}</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {permissionKeys.map(({ key, label }) => (
                      <div key={key} className="flex items-center space-x-2 space-x-reverse p-2 rounded-md hover:bg-background transition-colors">
                        <Checkbox
                          id={`edit-perm-${key}`}
                          checked={editingUser.permissions[key]}
                          onCheckedChange={(checked) =>
                            setEditingUser({
                              ...editingUser,
                              permissions: { ...editingUser.permissions, [key]: !!checked },
                            })
                          }
                        />
                        <Label htmlFor={`edit-perm-${key}`} className="cursor-pointer text-sm">{label}</Label>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          )}
          <div className="flex gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => { setEditingUser(null); setShowEditPassword(false); }} className="flex-1">
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button onClick={handleEditUser} className="flex-1">
              {language === 'ar' ? 'حفظ' : 'Save'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
