import { Outlet, useNavigate, useLocation } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useCRM } from '../contexts/CRMContext';
import { Button } from '../components/ui/button';
import {
  LayoutDashboard, 
  Users, 
  PhoneCall, 
  Calendar, 
  BarChart3, 
  Settings,
  LogOut,
  UserCircle,
  Radio,
  TrendingUp,
  Upload,
  Activity,
  FileText,
  Globe,
  Shield,
  GitBranch,
  UserCheck,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { NotificationsCenter } from '../components/NotificationsCenter';
import { SettingsToolbar } from '../components/SettingsToolbar';

export default function DashboardLayout() {
  const { user, logout, isAuthenticated } = useAuth();
  const { t, language } = useLanguage();
  const { settings } = useCRM();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, navigate]);

  if (!user) return null;

  const isSales = user.role === 'sales';

  const menuItems = [
    { icon: LayoutDashboard, label: t('dashboard'), path: '/dashboard' },
    ...(!isSales ? [{ icon: Globe, label: t('data_collection'), path: '/dashboard/collect' }] : []),
    { icon: Users, label: t('leads'), path: '/dashboard/leads' },
    ...(isSales ? [{ icon: GitBranch, label: t('pipeline'), path: '/dashboard/pipeline' }] : []),
    ...(!isSales ? [{ icon: PhoneCall, label: t('calls'), path: '/dashboard/calls' }] : []),
    ...(!isSales ? [{ icon: Radio, label: t('auto_dial'), path: '/dashboard/auto-dial' }] : []),
    ...(!isSales ? [{ icon: Upload, label: t('import'), path: '/dashboard/import' }] : []),
    ...(!isSales ? [{ icon: Activity, label: t('recent_activity'), path: '/dashboard/activity' }] : []),
    ...(!isSales ? [{ icon: FileText, label: t('templates'), path: '/dashboard/templates' }] : []),
    { icon: Calendar, label: t('calendar'), path: '/dashboard/calendar' },
    ...(!isSales ? [{ icon: BarChart3, label: t('reports'), path: '/dashboard/reports' }] : []),
    ...(!isSales ? [{ icon: TrendingUp, label: t('analytics'), path: '/dashboard/analytics' }] : []),
    ...(!isSales ? [{ icon: Settings, label: t('settings'), path: '/dashboard/settings' }] : []),
    ...(user.role === 'admin' ? [{ icon: UserCheck, label: t('employee_performance'), path: '/dashboard/employee-performance' }] : []),
    ...(user.role === 'admin' || user.role === 'manager' ? [{ icon: Shield, label: t('users'), path: '/dashboard/users' }] : []),
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-background" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Modern Elite Sidebar - Auto collapse/expand on hover */}
      <aside 
        className={`fixed ${language === 'ar' ? 'right-0' : 'left-0'} top-0 h-full ${isSidebarExpanded ? 'w-64' : 'w-16'} bg-card border-${language === 'ar' ? 'l' : 'r'} border-border z-10 backdrop-blur-xl flex flex-col transition-all duration-300 ease-in-out`}
        onMouseEnter={() => setIsSidebarExpanded(true)}
        onMouseLeave={() => setIsSidebarExpanded(false)}
      >
        <div className="p-6 flex-1 overflow-y-auto pb-4 overflow-x-hidden scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {/* Logo Section - Elite Style */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center relative overflow-hidden bg-muted group cursor-pointer shrink-0">
              <PhoneCall className="w-6 h-6 text-muted-foreground relative z-10 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-12" />
            </div>
            <div className={`transition-all duration-300 ${isSidebarExpanded ? 'opacity-100 w-auto' : 'opacity-0 w-0'} overflow-hidden whitespace-nowrap`}>
              <h1 className="font-bold text-xl text-foreground">{settings.companyName || 'LeadEngine'}</h1>
            </div>
          </div>

          {/* Navigation Menu - Modern Design */}
          <nav className="space-y-1">
            {menuItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Button
                  key={item.path}
                  variant={isActive ? "default" : "ghost"}
                  className={`w-full transition-all duration-300 gap-3 group ${
                    isSidebarExpanded ? 'justify-start px-3' : 'justify-center px-0'
                  } ${
                    isActive 
                      ? 'bg-muted text-foreground hover:bg-muted hover:text-foreground shadow-sm' 
                      : 'hover:bg-accent hover:text-accent-foreground text-muted-foreground'
                  } ${language === 'ar' ? 'flex-row-reverse' : ''}`}
                  onClick={() => navigate(item.path)}
                  title={!isSidebarExpanded ? item.label : undefined}
                >
                  <item.icon className="h-5 w-5 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3 shrink-0" />
                  <span className={`transition-all duration-300 ${isSidebarExpanded ? 'opacity-100 w-auto' : 'opacity-0 w-0'} overflow-hidden whitespace-nowrap`}>
                    {item.label}
                  </span>
                </Button>
              );
            })}
          </nav>
        </div>

        {/* User Profile Section - Elite Style */}
        <div className="p-6 border-t border-border bg-card/80 backdrop-blur-sm shrink-0 overflow-hidden">
          <div className={`flex items-center gap-3 mb-3 p-3 rounded-lg bg-accent/50 ${isSidebarExpanded ? '' : 'justify-center p-2'}`}>
            <div className="relative shrink-0">
              <UserCircle className="h-10 w-10 text-muted-foreground" />
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-success rounded-full border-2 border-card"></div>
            </div>
            <div className={`flex-1 min-w-0 transition-all duration-300 ${isSidebarExpanded ? 'opacity-100 w-auto' : 'opacity-0 w-0'} overflow-hidden`}>
              <p className="text-sm font-semibold truncate">{user.name}</p>
              <p className="text-xs text-muted-foreground capitalize">{user.role}</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className={`w-full hover:bg-destructive hover:text-destructive-foreground transition-all duration-200 group ${isSidebarExpanded ? '' : 'px-0 justify-center'}`}
            onClick={handleLogout}
            title={!isSidebarExpanded ? t('sign_out') : undefined}
          >
            <LogOut className={`h-4 w-4 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-12 shrink-0 ${isSidebarExpanded && language === 'ar' ? 'mr-2' : isSidebarExpanded ? 'ml-2' : ''}`} />
            <span className={`transition-all duration-300 ${isSidebarExpanded ? 'opacity-100 w-auto' : 'opacity-0 w-0'} overflow-hidden whitespace-nowrap`}>
              {t('sign_out')}
            </span>
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`${language === 'ar' ? (isSidebarExpanded ? 'mr-64' : 'mr-16') : (isSidebarExpanded ? 'ml-64' : 'ml-16')} min-h-screen transition-all duration-300`}>
        {/* Modern Top Bar with Glass Effect */}
        <div className="sticky top-0 z-20 bg-card/80 backdrop-blur-xl border-b border-border px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex-1"></div>
            <div className="flex items-center gap-3">
              <SettingsToolbar />
              <NotificationsCenter />
            </div>
          </div>
        </div>
        
        {/* Content Area with Animation */}
        <div className="animate-fadeIn">
          <Outlet />
        </div>
      </main>
    </div>
  );
}