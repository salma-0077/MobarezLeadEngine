import { useCRM } from '../contexts/CRMContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Award, Target, BarChart3 } from 'lucide-react';

export default function ReportsPage() {
  const { leads, calls, users } = useCRM();
  const { language } = useLanguage();
  // Sales performance by user
  const salesPerformance = users
    .filter(u => u.role === 'sales')
    .map(user => {
      const userCalls = calls.filter(c => c.user_id === user._id);
      const answeredCalls = userCalls.filter(c => c.result === 'answered').length;
      const closedLeads = leads.filter(l => l.assigned_to === user._id && l.status === 'closed').length;
      const totalDuration = userCalls.reduce((sum, c) => sum + c.duration, 0);
      
      return {
        name: user.name,
        calls: userCalls.length,
        answeredCalls: answeredCalls,
        closedDeals: closedLeads,
        totalMinutes: Math.round(totalDuration / 60),
        contactRate: userCalls.length > 0 ? ((answeredCalls / userCalls.length) * 100).toFixed(0) : 0,
      };
    });

  // Lead sources performance
  const sourcePerformance = ['gmaps', 'facebook', '140online', 'phantombuster', 'manual', 'linkedin'].map(source => {
    const sourceLeads = leads.filter(l => l.source === source);
    const closed = sourceLeads.filter(l => l.status === 'closed').length;
    
    const sourceLabels: Record<string, string> = {
      gmaps: 'Google Maps',
      facebook: 'Facebook',
      '140online': language === 'ar' ? 'دليل 140 أونلاين' : '140Online',
      phantombuster: 'PhantomBuster',
      manual: language === 'ar' ? 'يدوي' : 'Manual',
      linkedin: 'LinkedIn',
    };

    return {
      name: sourceLabels[source],
      leads: sourceLeads.length,
      closedDeals: closed,
      conversionRate: sourceLeads.length > 0 ? ((closed / sourceLeads.length) * 100).toFixed(1) : 0,
    };
  }).filter(s => s.leads > 0);

  // Industry performance
  const industries = [...new Set(leads.map(l => l.industry))];
  const industryPerformance = industries.map(industry => {
    const industryLeads = leads.filter(l => l.industry === industry);
    const closed = industryLeads.filter(l => l.status === 'closed').length;
    
    return {
      name: industry,
      value: industryLeads.length,
      closed: closed,
      conversionRate: industryLeads.length > 0 ? ((closed / industryLeads.length) * 100).toFixed(1) : 0,
    };
  });

  // Conversion funnel
  const funnelData = [
    { stage: language === 'ar' ? 'جديد' : 'New', count: leads.filter(l => l.status === 'new').length },
    { stage: language === 'ar' ? 'تم التواصل' : 'Contacted', count: leads.filter(l => l.status === 'contacted').length },
    { stage: language === 'ar' ? 'متابعة' : 'Follow-up', count: leads.filter(l => l.status === 'followup').length },
    { stage: language === 'ar' ? 'اجتماع' : 'Meeting', count: leads.filter(l => l.status === 'meeting').length },
    { stage: language === 'ar' ? 'مغلق' : 'Closed', count: leads.filter(l => l.status === 'closed').length },
  ];

  // Calculate KPIs
  const totalLeads = leads.length;
  const closedLeads = leads.filter(l => l.status === 'closed').length;
  const lostLeads = leads.filter(l => l.status === 'lost').length;
  const conversionRate = totalLeads > 0 ? ((closedLeads / totalLeads) * 100).toFixed(1) : '0';
  const lossRate = totalLeads > 0 ? ((lostLeads / totalLeads) * 100).toFixed(1) : '0';

  const totalCalls = calls.length;
  const answeredCalls = calls.filter(c => c.result === 'answered').length;
  const contactRate = totalCalls > 0 ? ((answeredCalls / totalCalls) * 100).toFixed(1) : '0';

  const avgCallsPerLead = totalLeads > 0 ? (totalCalls / totalLeads).toFixed(1) : '0';

  // Top performer
  const topPerformer = salesPerformance.length > 0
    ? salesPerformance.reduce((prev, current) => 
        current.closedDeals > prev.closedDeals ? current : prev
      , salesPerformance[0])
    : null;

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-2xl bg-primary/10 group hover:bg-primary/20 transition-all duration-300">
          <BarChart3 className="h-10 w-10 text-primary transition-transform duration-500 group-hover:rotate-12 group-hover:scale-110" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">{language === 'ar' ? 'التقارير والتحليلات' : 'Reports & Analytics'}</h1>
          <p className="text-muted-foreground">{language === 'ar' ? 'تحليل شامل لأداء النظام' : 'Comprehensive system performance analysis'}</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{language === 'ar' ? 'معدل التحويل' : 'Conversion Rate'}</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{conversionRate}%</div>
            <p className="text-xs text-muted-foreground mt-1">{closedLeads} {language === 'ar' ? 'من' : 'of'} {totalLeads} {language === 'ar' ? 'عميل' : 'leads'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{language === 'ar' ? 'معدل التواصل' : 'Contact Rate'}</CardTitle>
            <Target className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{contactRate}%</div>
            <p className="text-xs text-muted-foreground mt-1">{answeredCalls} {language === 'ar' ? 'من' : 'of'} {totalCalls} {language === 'ar' ? 'مكالمة' : 'calls'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{language === 'ar' ? 'متوسط المكالمات' : 'Avg Calls'}</CardTitle>
            <Award className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-600">{avgCallsPerLead}</div>
            <p className="text-xs text-muted-foreground mt-1">{language === 'ar' ? 'مكالمة لكل عميل' : 'calls per lead'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{language === 'ar' ? 'معدل الخسارة' : 'Loss Rate'}</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{lossRate}%</div>
            <p className="text-xs text-muted-foreground mt-1">{lostLeads} {language === 'ar' ? 'عميل' : 'leads'}</p>
          </CardContent>
        </Card>
      </div>

      {/* Top Performer */}
      <Card className="border-2" style={{ 
        backgroundColor: 'rgba(102, 126, 234, 0.1)', 
        borderColor: 'rgba(102, 126, 234, 0.3)' 
      }}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5 text-yellow-500" />
            {language === 'ar' ? 'أفضل موظف مبيعات' : 'Top Salesperson'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {topPerformer ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold">{topPerformer.name}</p>
              <p className="text-muted-foreground mt-1">
                {topPerformer.closedDeals} {language === 'ar' ? 'صفقة مغلقة' : 'closed deals'} • {topPerformer.calls} {language === 'ar' ? 'مكالمة' : 'calls'}
              </p>
            </div>
            <div className="text-left">
              <div className="text-3xl font-bold" style={{ color: 'rgba(102, 126, 234, 0.9)' }}>{topPerformer.contactRate}%</div>
              <p className="text-sm text-muted-foreground">{language === 'ar' ? 'معدل التواصل' : 'Contact Rate'}</p>
            </div>
          </div>
          ) : (
          <p className="text-muted-foreground">{language === 'ar' ? 'لا يوجد موظفي مبيعات بعد' : 'No sales staff yet'}</p>
          )}
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Performance */}
        <Card>
          <CardHeader>
            <CardTitle>{language === 'ar' ? 'أداء فريق المبيعات' : 'Sales Team Performance'}</CardTitle>
            <CardDescription>{language === 'ar' ? 'مقارنة أداء الموظفين' : 'Employee performance comparison'}</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={salesPerformance}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="calls" fill="rgba(147, 167, 255, 0.7)" name={language === 'ar' ? 'مكالمات' : 'Calls'} />
                <Bar dataKey="answeredCalls" fill="rgba(196, 167, 255, 0.7)" name={language === 'ar' ? 'مكالمات ناجحة' : 'Answered'} />
                <Bar dataKey="closedDeals" fill="rgba(110, 231, 183, 0.7)" name={language === 'ar' ? 'صفقات مغلقة' : 'Closed Deals'} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Source Performance */}
        <Card>
          <CardHeader>
            <CardTitle>{language === 'ar' ? 'أداء المصادر' : 'Source Performance'}</CardTitle>
            <CardDescription>{language === 'ar' ? 'تقييم مصادر العملاء' : 'Lead source evaluation'}</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={sourcePerformance}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="leads" fill="rgba(251, 191, 36, 0.7)" name={language === 'ar' ? 'عملاء' : 'Leads'} />
                <Bar dataKey="closedDeals" fill="rgba(110, 231, 183, 0.7)" name={language === 'ar' ? 'صفقات مغلقة' : 'Closed Deals'} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Conversion Funnel */}
        <Card>
          <CardHeader>
            <CardTitle>{language === 'ar' ? 'قمع التحويل' : 'Conversion Funnel'}</CardTitle>
            <CardDescription>{language === 'ar' ? 'مراحل رحلة العميل' : 'Lead journey stages'}</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={funnelData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="stage" type="category" width={100} />
                <Tooltip />
                <Bar dataKey="count" fill="rgba(196, 167, 255, 0.7)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Industry Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>{language === 'ar' ? 'أداء الصناعات' : 'Industry Performance'}</CardTitle>
            <CardDescription>{language === 'ar' ? 'معدلات التحويل حسب القطاع' : 'Conversion rates by sector'}</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={industryPerformance}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: ${entry.conversionRate}%`}
                  outerRadius={100}
                  fill="rgba(136, 132, 216, 0.7)"
                  dataKey="value"
                >
                  <Cell fill="rgba(147, 167, 255, 0.7)" />
                  <Cell fill="rgba(110, 231, 183, 0.7)" />
                  <Cell fill="rgba(251, 191, 36, 0.7)" />
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Stats Table */}
      <Card>
        <CardHeader>
          <CardTitle>{language === 'ar' ? 'تفاصيل الأداء حسب الموظف' : 'Performance Details by Employee'}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b">
                <tr>
                  <th className="text-right py-3 px-4">{language === 'ar' ? 'الموظف' : 'Employee'}</th>
                  <th className="text-right py-3 px-4">{language === 'ar' ? 'المكالمات' : 'Calls'}</th>
                  <th className="text-right py-3 px-4">{language === 'ar' ? 'مكالمات ناجحة' : 'Answered'}</th>
                  <th className="text-right py-3 px-4">{language === 'ar' ? 'معدل التواصل' : 'Contact Rate'}</th>
                  <th className="text-right py-3 px-4">{language === 'ar' ? 'صفقات مغلقة' : 'Closed Deals'}</th>
                  <th className="text-right py-3 px-4">{language === 'ar' ? 'إجمالي الدقائق' : 'Total Minutes'}</th>
                </tr>
              </thead>
              <tbody>
                {salesPerformance.map((user) => (
                  <tr key={user.name} className="border-b last:border-b-0">
                    <td className="py-3 px-4 font-medium">{user.name}</td>
                    <td className="py-3 px-4">{user.calls}</td>
                    <td className="py-3 px-4 text-green-600">{user.answeredCalls}</td>
                    <td className="py-3 px-4">
                      <span className="inline-block px-2 py-1 rounded text-sm" style={{ 
                        backgroundColor: 'rgba(59, 130, 246, 0.2)', 
                        color: 'rgba(59, 130, 246, 0.9)' 
                      }}>
                        {user.contactRate}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-emerald-600 font-medium">{user.closedDeals}</td>
                    <td className="py-3 px-4">{user.totalMinutes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
