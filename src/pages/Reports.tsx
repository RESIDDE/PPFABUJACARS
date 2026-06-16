import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell, Legend
} from "recharts";
import { isSameWeek, isSameMonth, subMonths } from "date-fns";
import { Printer, Download, Loader2 } from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, cn } from "@/lib/utils";

const COLORS = ["#3b82f6", "#8b5cf6", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4"];

export default function Reports() {
  const [filterDate, setFilterDate] = useState("all");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [exportMode, setExportMode] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const { data: ordersDataRaw = [] } = useQuery({
    queryKey: ["reports-orders"],
    queryFn: async (): Promise<any> => {
      const { data } = await supabase.from("service_orders")
        .select("status, total_amount, created_at, technician_name");
      return data ?? [];
    },
  });

  const { data: expensesRaw = [] } = useQuery({
    queryKey: ["reports-expenses"],
    queryFn: async (): Promise<any> => {
      const { data } = await supabase.from("expenses").select("expense_date, amount");
      return data ?? [];
    },
  });

  const { data: inventoryData = [] } = useQuery({
    queryKey: ["reports-inventory"],
    queryFn: async (): Promise<any> => {
      const { data } = await supabase.from("ppf_products").select("name, brand, stock_quantity, unit_cost, selling_price");
      return data ?? [];
    },
  });

  const { data: customersDataRaw = [] } = useQuery({
    queryKey: ["reports-customers"],
    queryFn: async (): Promise<any> => {
      const { data } = await supabase.from("customers")
        .select("id, full_name, created_at");
      return data ?? [];
    },
  });

  const now = new Date();
  const filterByDate = (dateStr: string) => {
    if (filterStartDate || filterEndDate) {
      const dStr = dateStr.split("T")[0];
      if (filterStartDate && dStr < filterStartDate) return false;
      if (filterEndDate && dStr > filterEndDate) return false;
      return true;
    }
    if (filterDate === "all") return true;
    const d = new Date(dateStr);
    if (filterDate === "this_week") return isSameWeek(d, now);
    if (filterDate === "this_month") return isSameMonth(d, now);
    if (filterDate === "last_month") return isSameMonth(d, subMonths(now, 1));
    return true;
  };

  const ordersData = ordersDataRaw.filter((o: any) => filterByDate(o.created_at));
  const expensesData = expensesRaw.filter((e: any) => filterByDate(e.expense_date));
  const customersData = customersDataRaw.filter((c: any) => filterByDate(c.created_at));

  // Financials by month (Revenue & Expenses)
  const financialsByMonth: Record<string, { revenue: number, expenses: number }> = {};
  
  ordersData.forEach((o: any) => {
    if (o.status === "completed" || o.status === "delivered") {
      const month = new Date(o.created_at).toLocaleString("default", { month: "short", year: "2-digit" });
      if (!financialsByMonth[month]) financialsByMonth[month] = { revenue: 0, expenses: 0 };
      financialsByMonth[month].revenue += (o.total_amount ?? 0);
    }
  });

  expensesData.forEach((e: any) => {
    const month = new Date(e.expense_date).toLocaleString("default", { month: "short", year: "2-digit" });
    if (!financialsByMonth[month]) financialsByMonth[month] = { revenue: 0, expenses: 0 };
    financialsByMonth[month].expenses += (e.amount ?? 0);
  });
  
  const revenueChartData = Object.entries(financialsByMonth).map(([month, data]) => ({ month, revenue: data.revenue, expenses: data.expenses }));

  // Status breakdown
  const statusCounts: Record<string, number> = {};
  ordersData.forEach((o: any) => { statusCounts[o.status] = (statusCounts[o.status] ?? 0) + 1; });
  const statusData = Object.entries(statusCounts).map(([name, value], i) => ({ name, value, color: COLORS[i % COLORS.length] }));

  // Stock value by brand
  const brandStock: Record<string, number> = {};
  inventoryData.forEach((p: any) => {
    brandStock[p.brand] = (brandStock[p.brand] ?? 0) + p.stock_quantity * p.unit_cost;
  });
  const brandData = Object.entries(brandStock).map(([brand, value]) => ({ brand, value }));

  // Customers per month
  const customersPerMonth: Record<string, number> = {};
  customersData.forEach((c: any) => {
    const month = new Date(c.created_at).toLocaleString("default", { month: "short", year: "2-digit" });
    customersPerMonth[month] = (customersPerMonth[month] ?? 0) + 1;
  });
  const customerChartData = Object.entries(customersPerMonth).map(([month, count]) => ({ month, count }));

  const totalRevenue = ordersData.filter((o: any) => o.status === "completed" || o.status === "delivered").reduce((s: any, o: any) => s + (o.total_amount ?? 0), 0);
  const totalExpenses = expensesData.reduce((s: any, e: any) => s + (e.amount ?? 0), 0);
  const netProfit = totalRevenue - totalExpenses;
  const totalOrders = ordersData.length;
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    if (!reportRef.current) return;
    try {
      setDownloading(true);
      setExportMode(true);
      
      // Allow React to apply the exportMode styles to the DOM before capturing
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const canvas = await html2canvas(reportRef.current, { 
        scale: 2, 
        useCORS: true,
        backgroundColor: '#ffffff'
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`PPF_Abuja_Cars_Report_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error("Failed to generate PDF", error);
      alert("Failed to download PDF. Please try again.");
    } finally {
      setExportMode(false);
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className={cn("flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sticky top-0 z-10 bg-background/80 backdrop-blur-md p-2 rounded-lg border border-border/50", exportMode ? "hidden" : "no-print")}>
        <div>
          <h1 className="text-2xl font-bold">Reports & Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">Business performance overview</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <Input 
              type="date" 
              value={filterStartDate} 
              onChange={(e) => setFilterStartDate(e.target.value)}
              className="w-[130px]"
              title="Start Date"
            />
            <span className="text-muted-foreground">-</span>
            <Input 
              type="date" 
              value={filterEndDate} 
              onChange={(e) => setFilterEndDate(e.target.value)}
              className="w-[130px]"
              title="End Date"
            />
          </div>
          <Select value={filterDate} onValueChange={setFilterDate}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Time Period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="this_week">This Week</SelectItem>
              <SelectItem value="this_month">This Month</SelectItem>
              <SelectItem value="last_month">Last Month</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleDownloadPdf} disabled={downloading}>
            {downloading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
            Save PDF
          </Button>
          <Button onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" /> Print
          </Button>
        </div>
      </div>

      <div ref={reportRef} className={cn("relative min-h-[800px]", exportMode ? "p-8 bg-white text-black" : "print:p-8 print:bg-white print:text-black")}>
        {/* Print Watermark */}
        <div 
          className={cn("absolute inset-0 pointer-events-none z-0 opacity-5", exportMode ? "block" : "hidden print:block")}
          style={{ 
            backgroundImage: 'url(/logo.jpeg)', 
            backgroundPosition: 'center', 
            backgroundSize: '80%', 
            backgroundRepeat: 'no-repeat' 
          }} 
        />

        <div className="relative z-10">
          {/* Print Header */}
          <div className={cn("justify-between items-start mb-8 pb-8 border-b-2 border-slate-200 gap-6", exportMode ? "flex" : "hidden print:flex")}>
            <div className="flex items-start gap-5">
              <div className="w-20 h-20 rounded-xl overflow-hidden shadow-sm shrink-0 bg-white border border-slate-200">
                <img src="/logo.jpeg" alt="PPF Abuja Cars Logo" className="w-full h-full object-cover" />
              </div>
              <div>
                <h3 className="font-bold text-2xl text-slate-900">PPF Abuja Cars</h3>
                <p className="text-sm text-slate-500 mt-1.5">Abuja, FCT, Nigeria</p>
                <p className="text-sm text-slate-500">info@ppfabujacars.com</p>
                <p className="text-sm text-slate-500">+234 800 0000 000</p>
              </div>
            </div>
            <div className="text-right">
              <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Performance Report</h1>
              <p className="text-sm text-slate-500 font-mono mt-2">Generated: {new Date().toLocaleDateString()}</p>
              <p className="text-sm text-slate-500 font-mono mt-1">
                Period: {filterStartDate || filterEndDate ? `${filterStartDate || 'Start'} to ${filterEndDate || 'End'}` : filterDate === 'all' ? 'All Time' : filterDate.replace('_', ' ').replace(/\b\w/g, (l: any) => l.toUpperCase())}
              </p>
            </div>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {[
              { label: "Total Revenue", value: formatCurrency(totalRevenue), color: "text-emerald-500", explain: "Sum of all service orders marked 'completed' or 'delivered' within the selected date range." },
              { label: "Total Expenses", value: formatCurrency(totalExpenses), color: "text-red-500", explain: "Sum of all logged business expenses within the selected date range." },
              { label: "Net Profit", value: formatCurrency(netProfit), color: "text-emerald-600", explain: "Calculated by subtracting Total Expenses from Total Revenue." },
              { label: "Total Orders", value: totalOrders, color: "text-blue-500", explain: "Total number of service orders created within the selected date range, regardless of status." },
              { label: "Avg Order Value", value: formatCurrency(avgOrderValue), color: "text-violet-500", explain: "Average revenue generated per service order (Total Revenue divided by Total Orders)." },
              { label: "New Customers", value: customersData.length, color: "text-amber-500", explain: "Total number of new customers registered in the system during the selected date range." },
            ].map((s: any) => (
              <Card 
                key={s.label} 
                className={cn("transition-all h-full", exportMode ? "border-slate-200 shadow-none bg-slate-50" : "print:border-slate-200 print:shadow-none bg-card print:bg-slate-50")}
                onMouseEnter={() => setHoveredCard(s.label)}
                onMouseLeave={() => setHoveredCard(null)}
              >
                <CardContent className="p-5 h-full flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <p className={cn("text-xs uppercase tracking-wider", exportMode ? "text-slate-500" : "text-muted-foreground print:text-slate-500")}>{s.label}</p>
                      {hoveredCard === s.label && !exportMode && <span className="text-[10px] text-muted-foreground uppercase tracking-wider shrink-0 ml-2">(Info)</span>}
                    </div>
                    <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  </div>
                  {hoveredCard === s.label && !exportMode && (
                    <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border/50 animate-in fade-in duration-300">
                      {s.explain}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Revenue + Customers */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <Card 
              className={cn("transition-all", exportMode ? "border-slate-200 shadow-none break-inside-avoid bg-white" : "print:border-slate-200 print:shadow-none print:break-inside-avoid")}
              onMouseEnter={() => setHoveredCard("revenue")}
              onMouseLeave={() => setHoveredCard(null)}
            >
              <CardHeader className="pb-2">
                <CardTitle className={cn("text-sm", exportMode ? "text-slate-700" : "print:text-slate-700")}>Revenue vs Expenses</CardTitle>
                {hoveredCard === "revenue" && !exportMode && (
                  <p className="text-xs text-muted-foreground mt-1 animate-in fade-in slide-in-from-top-1 duration-300">
                    Displays total revenue vs expenses each month. Revenue is from completed/delivered orders, while expenses are pulled from the expenses registry.
                  </p>
                )}
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={revenueChartData.length > 0 ? revenueChartData : [{ month: "No data", revenue: 0, expenses: 0 }]}>
                    <defs>
                      <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} tickFormatter={(v) => `₦${(v / 1000).toFixed(0)}k`} />
                    <Tooltip contentStyle={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "8px", color: "#000" }} formatter={(v: number, name: string) => [formatCurrency(v), name.charAt(0).toUpperCase() + name.slice(1)]} />
                    <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} fill="url(#revGrad)" />
                    <Area type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2} fill="url(#expGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card 
              className={cn("transition-all", exportMode ? "border-slate-200 shadow-none break-inside-avoid bg-white" : "print:border-slate-200 print:shadow-none print:break-inside-avoid")}
              onMouseEnter={() => setHoveredCard("customers")}
              onMouseLeave={() => setHoveredCard(null)}
            >
              <CardHeader className="pb-2">
                <CardTitle className={cn("text-sm", exportMode ? "text-slate-700" : "print:text-slate-700")}>New Customers</CardTitle>
                {hoveredCard === "customers" && !exportMode && (
                  <p className="text-xs text-muted-foreground mt-1 animate-in fade-in slide-in-from-top-1 duration-300">
                    Shows the number of new customers added to the system each month based on their registration date.
                  </p>
                )}
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={customerChartData.length > 0 ? customerChartData : [{ month: "No data", count: 0 }]}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "8px", color: "#000" }} />
                    <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Status + Inventory */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card 
              className={cn("transition-all", exportMode ? "border-slate-200 shadow-none break-inside-avoid bg-white" : "print:border-slate-200 print:shadow-none print:break-inside-avoid")}
              onMouseEnter={() => setHoveredCard("status")}
              onMouseLeave={() => setHoveredCard(null)}
            >
              <CardHeader className="pb-2">
                <CardTitle className={cn("text-sm", exportMode ? "text-slate-700" : "print:text-slate-700")}>Order Status Breakdown</CardTitle>
                {hoveredCard === "status" && !exportMode && (
                  <p className="text-xs text-muted-foreground mt-1 animate-in fade-in slide-in-from-top-1 duration-300">
                    Shows the distribution of service orders by their current status. This represents all service orders recorded in the system for the selected period.
                  </p>
                )}
              </CardHeader>
              <CardContent className="flex items-center gap-6">
                <ResponsiveContainer width="40%" height={160}>
                  <PieChart>
                    <Pie data={statusData.length > 0 ? statusData : [{ name: "None", value: 1, color: "#cbd5e1" }]} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value">
                      {(statusData.length > 0 ? statusData : [{ color: "#cbd5e1" }]).map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  {statusData.map((s: any) => (
                    <div key={s.name} className={cn("flex items-center gap-2 text-sm", exportMode ? "text-slate-600" : "print:text-slate-600")}>
                      <div className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                      <span className="capitalize">{s.name.replace("_", " ")}</span>
                      <span className="font-bold ml-auto">{s.value}</span>
                    </div>
                  ))}
                  {statusData.length === 0 && <p className="text-muted-foreground text-sm">No orders yet</p>}
                </div>
              </CardContent>
            </Card>

            <Card 
              className={cn("transition-all", exportMode ? "border-slate-200 shadow-none break-inside-avoid bg-white" : "print:border-slate-200 print:shadow-none print:break-inside-avoid")}
              onMouseEnter={() => setHoveredCard("inventory")}
              onMouseLeave={() => setHoveredCard(null)}
            >
              <CardHeader className="pb-2">
                <CardTitle className={cn("text-sm", exportMode ? "text-slate-700" : "print:text-slate-700")}>Inventory Value by Brand (₦)</CardTitle>
                {hoveredCard === "inventory" && !exportMode && (
                  <p className="text-xs text-muted-foreground mt-1 animate-in fade-in slide-in-from-top-1 duration-300">
                    Displays the total potential value of your current stock, grouped by product brand. Calculated as Stock Quantity × Unit Cost.
                  </p>
                )}
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={brandData.length > 0 ? brandData : [{ brand: "No data", value: 0 }]} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" tick={{ fontSize: 10, fill: "#64748b" }} tickFormatter={(v) => `₦${(v / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="brand" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} width={60} />
                    <Tooltip contentStyle={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "8px", color: "#000" }} formatter={(v: number) => [formatCurrency(v), "Value"]} />
                    <Bar dataKey="value" fill="#22c55e" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
          
          {/* Print Footer */}
          <div className={cn("mt-12 pt-6 border-t border-slate-200 text-center text-xs text-slate-500", exportMode ? "block" : "hidden print:block")}>
            <p>This report is system generated and represents the state of operations as of the generation date.</p>
            <p>PPF Abuja Cars Management System</p>
          </div>
        </div>
      </div>
    </div>
  );
}

