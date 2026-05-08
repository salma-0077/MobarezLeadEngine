import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { 
  Phone, 
  TrendingUp, 
  Target, 
  Clock, 
  Users,
  CheckCircle,
  XCircle,
  AlertCircle,
  DollarSign,
  Calendar,
  Award
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  LineChart, 
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';
import { useCRM } from '../contexts/CRMContext';
import { useLanguage } from '../contexts/LanguageContext';

export default function AnalyticsPage() {
  const { leads, calls, users, meetings } = useCRM();
  const { language } = useLanguage();
  const [timeRange, setTimeRange] = useState('week');
  const [selectedUser, setSelectedUser] = useState('all');

  // Calculate KPIs
  const totalLeads = leads.length;
  const totalCalls = calls.length;
  const answeredCalls = calls.filter(c => c.result === 'answered').length;
  const contactRate = totalCalls > 0 ? (answeredCalls / totalCalls) * 100 : 0;
  const closedLeads = leads.filter(l => l.status === 'closed').length;
  const conversionRate = totalLeads > 0 ? (closedLeads / totalLeads) * 100 : 0;
  const avgCallDuration = answeredCalls > 0 
    ? calls.filter(c => c.result === 'answered').reduce((sum, c) => sum + c.duration, 0) / answeredCalls 
    : 0;

  // Daily calls data from real call records
  const dayNames = language === 'ar' 
    ? ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة']
    : ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const dailyCallsData = dayNames.map((day, idx) => {
    const dayCalls = calls.filter(c => {
      const d = new Date(c.created_at);
      return d.getDay() === ((idx + 6) % 7); // Map to JS day (6=Sat,0=Sun...)
    });
    return {
      day,
      calls: dayCalls.length,
      answered: dayCalls.filter(c => c.result === 'answered').length,
      noAnswer: dayCalls.filter(c => c.result === 'no_answer').length,
      busy: dayCalls.filter(c => c.result === 'busy').length,
    };
  });

  // Lead status distribution
  const leadStatusData = [
    { name: language === 'ar' ? 'جديد' : 'New', value: leads.filter(l => l.status === 'new').length, color: 'rgba(59, 130, 246, 1)' },
    { name: language === 'ar' ? 'تم التواصل' : 'Contacted', value: leads.filter(l => l.status === 'contacted').length, color: 'rgba(16, 185, 129, 1)' },
    { name: language === 'ar' ? 'متابعة' : 'Follow-up', value: leads.filter(l => l.status === 'followup').length, color: 'rgba(245, 158, 11, 1)' },
    { name: language === 'ar' ? 'اجتماع' : 'Meeting', value: leads.filter(l => l.status === 'meeting').length, color: 'rgba(139, 92, 246, 1)' },
    { name: language === 'ar' ? 'مغلق' : 'Closed', value: leads.filter(l => l.status === 'closed').length, color: 'rgba(34, 197, 94, 1)' },
    { name: language === 'ar' ? 'مفقود' : 'Lost', value: leads.filter(l => l.status === 'lost').length, color: 'rgba(239, 68, 68, 1)' },
  ];

  // Source performance
  const sourceData = [
    { source: 'Google Maps', leads: leads.filter(l => l.source === 'gmaps').length, converted: leads.filter(l => l.source === 'gmaps' && l.status === 'closed').length },
    { source: 'Facebook', leads: leads.filter(l => l.source === 'facebook').length, converted: leads.filter(l => l.source === 'facebook' && l.status === 'closed').length },
    { source: language === 'ar' ? 'دليل 140 أونلاين' : '140Online', leads: leads.filter(l => l.source === '140online').length, converted: leads.filter(l => l.source === '140online' && l.status === 'closed').length },
    { source: 'PhantomBuster', leads: leads.filter(l => l.source === 'phantombuster').length, converted: leads.filter(l => l.source === 'phantombuster' && l.status === 'closed').length },
    { source: 'LinkedIn', leads: leads.filter(l => l.source === 'linkedin').length, converted: leads.filter(l => l.source === 'linkedin' && l.status === 'closed').length },
    { source: language === 'ar' ? 'يدوي' : 'Manual', leads: leads.filter(l => l.source === 'manual').length, converted: leads.filter(l => l.source === 'manual' && l.status === 'closed').length },
  ];

  // Team performance
  const teamPerformance = users
    .filter(u => u.role === 'sales')
    .map(user => {
      const userLeads = leads.filter(l => l.assigned_to === user._id);
      const userCalls = calls.filter(c => c.user_id === user._id);
      const userAnswered = userCalls.filter(c => c.result === 'answered').length;
      const userClosed = userLeads.filter(l => l.status === 'closed').length;
      
      return {
        name: user.name,
        calls: userCalls.length,
        answered: userAnswered,
        leads: userLeads.length,
        closed: userClosed,
        contactRate: userCalls.length > 0 ? (userAnswered / userCalls.length) * 100 : 0,
      };
    });

  // Call outcome distribution
  const callOutcomes = [
    { name: language === 'ar' ? 'تم الرد' : 'Answered', value: calls.filter(c => c.result === 'answered').length, color: 'rgba(34, 197, 94, 1)' },
    { name: language === 'ar' ? 'لم يرد' : 'No Answer', value: calls.filter(c => c.result === 'no_answer').length, color: 'rgba(245, 158, 11, 1)' },
    { name: language === 'ar' ? 'مشغول' : 'Busy', value: calls.filter(c => c.result === 'busy').length, color: 'rgba(239, 68, 68, 1)' },
    { name: language === 'ar' ? 'رفض' : 'Rejected', value: calls.filter(c => c.result === 'rejected').length, color: 'rgba(220, 38, 38, 1)' },
  ];

  // Hourly activity from real data
  const hourlyActivity = Array.from({ length: 9 }, (_, i) => {
    const hour = i + 9;
    return {
      hour: String(hour),
      calls: calls.filter(c => new Date(c.created_at).getHours() === hour).length,
      meetings: meetings.filter(m => new Date(m.meeting_date).getHours() === hour).length,
    };
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-primary/10 group hover:bg-primary/20 transition-all duration-300">
            <TrendingUp className="h-10 w-10 text-primary transition-transform duration-500 group-hover:rotate-12 group-hover:scale-110" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{language === 'ar' ? 'التحليلات المتقدمة' : 'Advanced Analytics'}</h1>
            <p className="text-muted-foreground">{language === 'ar' ? 'نظرة شاملة على الأداء والمقاييس' : 'Comprehensive overview of performance and metrics'}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">{language === 'ar' ? 'اليوم' : 'Today'}</SelectItem>
              <SelectItem value="week">{language === 'ar' ? 'هذا الأسبوع' : 'This Week'}</SelectItem>
              <SelectItem value="month">{language === 'ar' ? 'هذا الشهر' : 'This Month'}</SelectItem>
              <SelectItem value="quarter">{language === 'ar' ? 'هذا الربع' : 'This Quarter'}</SelectItem>
              <SelectItem value="year">{language === 'ar' ? 'هذا العام' : 'This Year'}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedUser} onValueChange={setSelectedUser}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{language === 'ar' ? 'جميع الموظفين' : 'All Employees'}</SelectItem>
              {users.filter(u => u.role === 'sales').map(user => (
                <SelectItem key={user._id} value={user._id}>{user.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{language === 'ar' ? 'إجمالي المكالمات' : 'Total Calls'}</CardTitle>
            <Phone className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCalls}</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              <TrendingUp className="w-3 h-3 text-green-500" />
              {language === 'ar' ? '+12% من الأسبوع الماضي' : '+12% from last week'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{language === 'ar' ? 'معدل الرد' : 'Answer Rate'}</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{contactRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              <TrendingUp className="w-3 h-3 text-green-500" />
              {language === 'ar' ? '+5.2% من الأسبوع الماضي' : '+5.2% from last week'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{language === 'ar' ? 'معدل التحويل' : 'Conversion Rate'}</CardTitle>
            <Target className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{conversionRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              <TrendingUp className="w-3 h-3 text-green-500" />
              {language === 'ar' ? '+2.8% من الأسبوع الماضي' : '+2.8% from last week'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{language === 'ar' ? 'متوسط مدة المكالمة' : 'Avg Call Duration'}</CardTitle>
            <Clock className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.floor(avgCallDuration / 60)}:{(avgCallDuration % 60).toString().padStart(2, '0')}</div>
            <p className="text-xs text-muted-foreground">{language === 'ar' ? 'دقيقة' : 'minutes'}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">{language === 'ar' ? 'نظرة عامة' : 'Overview'}</TabsTrigger>
          <TabsTrigger value="calls">{language === 'ar' ? 'المكالمات' : 'Calls'}</TabsTrigger>
          <TabsTrigger value="leads">{language === 'ar' ? 'العملاء' : 'Leads'}</TabsTrigger>
          <TabsTrigger value="team">{language === 'ar' ? 'الفريق' : 'Team'}</TabsTrigger>
          <TabsTrigger value="sources">{language === 'ar' ? 'المصادر' : 'Sources'}</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Daily Calls Trend */}
            <Card>
              <CardHeader>
                <CardTitle>{language === 'ar' ? 'المكالمات اليومية' : 'Daily Calls'}</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={dailyCallsData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Area type="monotone" dataKey="calls" stackId="1" stroke="rgba(147, 167, 255, 0.9)" fill="rgba(147, 167, 255, 0.6)" name={language === 'ar' ? 'المكالمات' : 'Calls'} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Lead Status Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>{language === 'ar' ? 'توزيع حالة العملاء' : 'Lead Status Distribution'}</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={leadStatusData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry) => entry.name}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {leadStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Hourly Activity */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>{language === 'ar' ? 'النشاط بالساعة' : 'Hourly Activity'}</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={hourlyActivity}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="calls" fill="rgba(147, 167, 255, 0.7)" name={language === 'ar' ? 'المكالمات' : 'Calls'} />
                    <Bar dataKey="meetings" fill="rgba(196, 167, 255, 0.7)" name={language === 'ar' ? 'الاجتماعات' : 'Meetings'} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Calls Tab */}
        <TabsContent value="calls" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Call Results */}
            <Card>
              <CardHeader>
                <CardTitle>{language === 'ar' ? 'نتائج المكالمات' : 'Call Results'}</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={callOutcomes}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry) => `${entry.name}: ${entry.value}`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {callOutcomes.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Call Performance */}
            <Card>
              <CardHeader>
                <CardTitle>{language === 'ar' ? 'أداء المكالمات' : 'Call Performance'}</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={dailyCallsData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="answered" fill="rgba(110, 231, 183, 0.7)" name={language === 'ar' ? 'تم الرد' : 'Answered'} />
                    <Bar dataKey="noAnswer" fill="rgba(251, 191, 36, 0.7)" name={language === 'ar' ? 'لم يرد' : 'No Answer'} />
                    <Bar dataKey="busy" fill="rgba(252, 165, 165, 0.7)" name={language === 'ar' ? 'مشغول' : 'Busy'} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Stats */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{language === 'ar' ? 'تم الرد' : 'Answered'}</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{answeredCalls}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{language === 'ar' ? 'لم يرد' : 'No Answer'}</CardTitle>
                <XCircle className="h-4 w-4 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{calls.filter(c => c.result === 'no_answer').length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{language === 'ar' ? 'مشغول' : 'Busy'}</CardTitle>
                <AlertCircle className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{calls.filter(c => c.result === 'busy').length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{language === 'ar' ? 'إجمالي الوقت' : 'Total Time'}</CardTitle>
                <Clock className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {Math.floor(calls.reduce((sum, c) => sum + c.duration, 0) / 60)} {language === 'ar' ? 'دقيقة' : 'min'}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Leads Tab */}
        <TabsContent value="leads" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>{language === 'ar' ? 'مسار العملاء' : 'Lead Pipeline'}</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={leadStatusData} layout="horizontal">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" />
                    <Tooltip />
                    <Bar dataKey="value" fill="rgba(59, 130, 246, 1)" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{language === 'ar' ? 'العملاء حسب الصناعة' : 'Leads by Industry'}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[...new Set(leads.map(l => l.industry))].map(industry => {
                    const count = leads.filter(l => l.industry === industry).length;
                    const percentage = (count / totalLeads) * 100;
                    return (
                      <div key={industry}>
                        <div className="flex justify-between mb-1">
                          <span className="text-sm font-medium">{industry}</span>
                          <span className="text-sm text-muted-foreground">{count} ({percentage.toFixed(0)}%)</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full" 
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Team Tab */}
        <TabsContent value="team" className="space-y-4">
          <Card>
            <CardHeader>
                <CardTitle>{language === 'ar' ? 'أداء الفريق' : 'Team Performance'}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {teamPerformance.map((member, index) => (
                  <div key={index} className="flex items-center gap-4 p-4 border rounded-lg">
                    <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 text-blue-600 font-bold">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold">{member.name}</div>
                      <div className="text-sm text-muted-foreground grid grid-cols-4 gap-4 mt-1">
                        <span>📞 {member.calls} {language === 'ar' ? 'مكالمة' : 'calls'}</span>
                        <span>✅ {member.answered} {language === 'ar' ? 'رد' : 'answered'}</span>
                        <span>👥 {member.leads} {language === 'ar' ? 'عميل' : 'leads'}</span>
                        <span>🎯 {member.closed} {language === 'ar' ? 'مغلق' : 'closed'}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-blue-600">{member.contactRate.toFixed(0)}%</div>
                      <div className="text-xs text-muted-foreground">{language === 'ar' ? 'معدل الرد' : 'Answer Rate'}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
                <CardTitle>{language === 'ar' ? 'مقارنة الأداء' : 'Performance Comparison'}</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={teamPerformance}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="calls" fill="rgba(147, 167, 255, 0.7)" name={language === 'ar' ? 'المكالمات' : 'Calls'} />
                  <Bar dataKey="answered" fill="rgba(110, 231, 183, 0.7)" name={language === 'ar' ? 'تم الرد' : 'Answered'} />
                  <Bar dataKey="closed" fill="rgba(196, 167, 255, 0.7)" name={language === 'ar' ? 'مغلق' : 'Closed'} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sources Tab */}
        <TabsContent value="sources" className="space-y-4">
          <Card>
            <CardHeader>
                <CardTitle>{language === 'ar' ? 'أداء المصادر' : 'Source Performance'}</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={sourceData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="source" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="leads" fill="rgba(147, 167, 255, 0.7)" name={language === 'ar' ? 'العملاء المحتملين' : 'Leads'} />
                  <Bar dataKey="converted" fill="rgba(110, 231, 183, 0.7)" name={language === 'ar' ? 'التحويلات' : 'Conversions'} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
