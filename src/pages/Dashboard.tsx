import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  TrendingUp, Users, Car, ClipboardList, Package,
  FileText, AlertTriangle, CheckCircle2, Clock, Truck
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatDate, getStatusLabel } from "@/lib/utils";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell
} from "recharts";
import { PpfAnimationCard } from "@/components/PpfAnimationCard";

function TypewriterValue({ text }: { text: string }) {
  const [displayedText, setDisplayedText] = useState("");
  const [isHovered, setIsHovered] = useState(false);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setDisplayedText("");
    setIndex(0);
  }, [text]);

  useEffect(() => {
    if (isHovered || index >= text.length) return;
    
    const timeout = setTimeout(() => {
      setDisplayedText(prev => prev + text[index]);
      setIndex(index + 1);
    }, 100);

    return () => clearTimeout(timeout);
  }, [index, isHovered, text]);

  useEffect(() => {
    if (index >= text.length) {
      const timeout = setTimeout(() => {
        if (!isHovered) {
          setDisplayedText("");
          setIndex(0);
        }
      }, 3000);
      return () => clearTimeout(timeout);
    }
  }, [index, text.length, isHovered]);

  return (
    <span 
      onMouseEnter={() => setIsHovered(true)} 
      onMouseLeave={() => setIsHovered(false)}
      className="inline-block relative min-h-[32px] cursor-text"
    >
      {displayedText}
      <span className="animate-pulse border-r-2 border-primary ml-0.5 inline-block h-5 align-middle">&nbsp;</span>
    </span>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color = "text-primary",
  iconBg = "bg-primary/10",
  animateTypewriter = false,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
  iconBg?: string;
  animateTypewriter?: boolean;
}) {
  return (
    <Card className="stat-card">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">{label}</p>
            <div className="text-2xl font-bold text-foreground">
              {animateTypewriter ? <TypewriterValue text={String(value)} /> : value}
            </div>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <div className={`h-10 w-10 rounded-lg ${iconBg} flex items-center justify-center`}>
            <Icon className={`h-5 w-5 ${color}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const COLORS = ["#3b82f6", "#8b5cf6", "#22c55e", "#f59e0b", "#ef4444"];

export default function Dashboard() {
  const { data: ordersData } = useQuery({
    queryKey: ["dashboard-orders"],
    queryFn: async (): Promise<any> => {
      const { data } = await supabase
        .from("service_orders")
        .select("*, customers(full_name), vehicles(make, model, plate_number)")
        .order("created_at", { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async (): Promise<any> => {
      const [orders, customers, vehicles, products] = await Promise.all([
        supabase.from("service_orders").select("status, total_amount"),
        supabase.from("customers").select("id", { count: "exact" }),
        supabase.from("vehicles").select("id", { count: "exact" }),
        supabase.from("ppf_products").select("id, stock_quantity, reorder_level"),
      ]);

      const activeJobs = orders.data?.filter(o => ["pending", "in_progress"].includes(o.status)).length ?? 0;
      const monthRevenue = orders.data?.filter(o => o.status === "completed" || o.status === "delivered")
        .reduce((sum: any, o: any) => sum + (o.total_amount ?? 0), 0) ?? 0;
      const lowStock = products.data?.filter(p => p.stock_quantity <= p.reorder_level).length ?? 0;

      return {
        activeJobs,
        monthRevenue,
        totalCustomers: customers.count ?? 0,
        totalVehicles: vehicles.count ?? 0,
        lowStockItems: lowStock,
      };
    },
  });

  const { data: inventoryData } = useQuery({
    queryKey: ["dashboard-inventory"],
    queryFn: async (): Promise<any> => {
      const { data } = await supabase
        .from("ppf_products")
        .select("name, brand, stock_quantity")
        .order("stock_quantity", { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });

  // Mock revenue chart data
  const revenueData = [
    { month: "Jan", revenue: 420000 },
    { month: "Feb", revenue: 380000 },
    { month: "Mar", revenue: 520000 },
    { month: "Apr", revenue: 610000 },
    { month: "May", revenue: 490000 },
    { month: "Jun", revenue: 720000 },
  ];

  const statusData = [
    { name: "Pending", value: 3, color: "#f59e0b" },
    { name: "In Progress", value: 5, color: "#3b82f6" },
    { name: "Completed", value: 8, color: "#22c55e" },
    { name: "Delivered", value: 12, color: "#8b5cf6" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">PPF Abuja Cars — Service Overview</p>
      </div>

      {/* AI Animation Banner */}
      <PpfAnimationCard />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={ClipboardList}
          label="Active Jobs"
          value={stats?.activeJobs ?? 0}
          sub="In progress + Pending"
          color="text-blue-400"
          iconBg="bg-blue-500/10"
        />
        <StatCard
          icon={TrendingUp}
          label="Revenue"
          value={formatCurrency(stats?.monthRevenue ?? 0)}
          sub="All completed jobs"
          color="text-emerald-400"
          iconBg="bg-emerald-500/10"
          animateTypewriter={true}
        />
        <StatCard
          icon={Users}
          label="Customers"
          value={stats?.totalCustomers ?? 0}
          sub="Total registered"
          color="text-violet-400"
          iconBg="bg-violet-500/10"
        />
        <StatCard
          icon={Package}
          label="Low Stock"
          value={stats?.lowStockItems ?? 0}
          sub="Items need restocking"
          color="text-amber-400"
          iconBg="bg-amber-500/10"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue Chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Revenue Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 33% 14%)" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(215 20% 55%)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(215 20% 55%)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `₦${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ background: "hsl(222 47% 7%)", border: "1px solid hsl(217 33% 14%)", borderRadius: "8px", fontSize: "12px" }}
                  formatter={(v: number) => [formatCurrency(v), "Revenue"]}
                />
                <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} fill="url(#revenueGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Job Status Pie */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Job Status</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={150}>
              <PieChart>
                <Pie 
                  data={statusData} 
                  cx="50%" 
                  cy="50%" 
                  innerRadius={45} 
                  outerRadius={65} 
                  paddingAngle={12} 
                  dataKey="value"
                  className="animate-[spin_6s_linear_infinite] hover:[animation-play-state:paused] origin-center cursor-pointer"
                >
                  {statusData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} className="transition-all duration-300 hover:opacity-80" />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(222 47% 7%)", border: "1px solid hsl(217 33% 14%)", borderRadius: "8px", fontSize: "12px" }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-2 space-y-1.5">
              {statusData.map((item: any) => (
                <div key={item.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full" style={{ background: item.color }} />
                    <span className="text-muted-foreground">{item.name}</span>
                  </div>
                  <span className="font-medium">{item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Orders + Low Stock */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent service orders */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Recent Service Orders</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {ordersData && ordersData.length > 0 ? (
              <div className="divide-y divide-border">
                {ordersData.map((order: Record<string, unknown>) => {
                  const customer = order.customers as { full_name: string } | null;
                  const vehicle = order.vehicles as { make: string; model: string; plate_number: string | null } | null;
                  return (
                    <div key={order.id as string} className="flex items-center justify-between px-6 py-3 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Car className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{order.order_number as string}</p>
                          <p className="text-xs text-muted-foreground">
                            {customer?.full_name} · {vehicle?.make} {vehicle?.model}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold">{formatCurrency(order.total_amount as number)}</span>
                        <Badge variant={(order.status as string).replace("-", "_") as "pending" | "in_progress" | "completed" | "delivered" | "cancelled"}>
                          {getStatusLabel(order.status as string)}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="px-6 py-8 text-center text-muted-foreground text-sm">
                <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-30" />
                No service orders yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Inventory alerts */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Inventory Alerts</CardTitle>
              <AlertTriangle className="h-4 w-4 text-amber-400" />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {inventoryData && inventoryData.length > 0 ? (
              <div className="divide-y divide-border">
                {inventoryData.map((product: any, idx: number) => (
                  <div key={product.name} className="px-6 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-medium truncate">{product.name}</p>
                      <span className="text-xs text-muted-foreground">{product.brand}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all animate-soundbar"
                          style={{ 
                            width: `${Math.min((product.stock_quantity / 20) * 100, 100)}%`,
                            animationDelay: `${idx * 0.15}s`
                          }}
                        />
                      </div>
                      <span className="text-xs font-bold text-foreground">{product.stock_quantity}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-6 py-8 text-center text-muted-foreground text-sm">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
                All stock levels OK
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
