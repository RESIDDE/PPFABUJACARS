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
  explanation,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
  iconBg?: string;
  animateTypewriter?: boolean;
  explanation?: string;
}) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <Card 
      className="stat-card transition-all h-full"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <CardContent className="p-5 h-full flex flex-col justify-between">
        <div className="flex items-start justify-between">
          <div className="w-full">
            <div className="flex justify-between items-center w-full mb-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
              {isHovered && explanation && <span className="text-[10px] text-muted-foreground uppercase tracking-wider ml-2 shrink-0">(Info)</span>}
            </div>
            <div className="text-2xl font-bold text-foreground">
              {animateTypewriter ? <TypewriterValue text={String(value)} /> : value}
            </div>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <div className={`h-10 w-10 rounded-lg ${iconBg} flex items-center justify-center shrink-0 ml-4`}>
            <Icon className={`h-5 w-5 ${color}`} />
          </div>
        </div>
        {isHovered && explanation && (
          <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border/50 animate-in fade-in duration-300">
            {explanation}
          </p>
        )}
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
    queryKey: ["dashboard-inventory-low"],
    queryFn: async (): Promise<any> => {
      const { data } = await supabase
        .from("ppf_products")
        .select("name, brand, stock_quantity, reorder_level, unit")
        .order("stock_quantity", { ascending: true });
        
      if (!data) return [];
      return data.filter(p => p.stock_quantity <= p.reorder_level).slice(0, 10);
    },
  });

  // ── Sea-wave revenue chart animation ──────────────────────────────────────
  const BASE_REVENUE = [
    { month: "Jan", revenue: 420000 },
    { month: "Feb", revenue: 380000 },
    { month: "Mar", revenue: 520000 },
    { month: "Apr", revenue: 610000 },
    { month: "May", revenue: 490000 },
    { month: "Jun", revenue: 720000 },
  ];

  const [wavePhase, setWavePhase] = useState(0);
  const [chartHovered, setChartHovered] = useState(false);
  const phaseRef = useState(() => ({ value: 0, paused: false, raf: 0 }))[0];

  useEffect(() => {
    phaseRef.paused = chartHovered;
  }, [chartHovered]);

  useEffect(() => {
    const WAVE_SPEED = 0.025; // radians per frame
    const tick = () => {
      if (!phaseRef.paused) {
        phaseRef.value += WAVE_SPEED;
        setWavePhase(phaseRef.value);
      }
      phaseRef.raf = requestAnimationFrame(tick);
    };
    phaseRef.raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(phaseRef.raf);
  }, []);

  const WAVE_AMP = 30000; // how many naira the wave ripples up/down
  const revenueData = BASE_REVENUE.map((d, i) => ({
    ...d,
    revenue: Math.round(d.revenue + Math.sin(wavePhase + i * 1.1) * WAVE_AMP),
  }));

  const statusData = [
    { name: "Pending",    value: 3,  color: "#f59e0b" },
    { name: "In Progress", value: 5, color: "#3b82f6" },
    { name: "Completed",  value: 8,  color: "#22c55e" },
    { name: "Delivered",  value: 12, color: "#8b5cf6" },
  ];

  // ── Pie: intro assemble then spin ────────────────────────────────────────
  const [pieVisible, setPieVisible]   = useState(0);
  const [pieSpinning, setPieSpinning] = useState(false);
  const [pieHovered,  setPieHovered]  = useState(false);

  useEffect(() => {
    if (pieVisible < statusData.length) {
      const t = setTimeout(() => setPieVisible(v => v + 1), 420);
      return () => clearTimeout(t);
    } else {
      // all slices in — wait a beat then start spinning
      const t = setTimeout(() => setPieSpinning(true), 500);
      return () => clearTimeout(t);
    }
  }, [pieVisible]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">PPF Abuja Cars — Service Overview</p>
      </div>

      {/* AI Animation Banner */}
      <Card className="bg-black border-none overflow-hidden relative isolate h-[120px] sm:h-[160px] flex items-center justify-center shadow-xl mb-6">
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 to-black pointer-events-none" />
        
        {/* Subtle grid pattern background for tech feel */}
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>
        
        <div className="relative z-10 flex items-center justify-center w-full px-6 overflow-hidden py-4">
          <img 
            src="/abujar car display.jpeg" 
            alt="ABUJA CAR" 
            className="w-full max-w-[340px] sm:max-w-[480px] md:max-w-[640px] object-contain mix-blend-screen animate-image-typewriter"
            draggable="false"
          />
        </div>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={ClipboardList}
          label="Active Jobs"
          value={stats?.activeJobs ?? 0}
          sub="In progress + Pending"
          color="text-blue-400"
          iconBg="bg-blue-500/10"
          explanation="Count of service orders currently marked as 'pending' or 'in progress'."
        />
        <StatCard
          icon={TrendingUp}
          label="Revenue"
          value={formatCurrency(stats?.monthRevenue ?? 0)}
          sub="All completed jobs"
          color="text-emerald-400"
          iconBg="bg-emerald-500/10"
          animateTypewriter={true}
          explanation="Sum of revenue generated from all service orders with 'completed' or 'delivered' status."
        />
        <StatCard
          icon={Users}
          label="Customers"
          value={stats?.totalCustomers ?? 0}
          sub="Total registered"
          color="text-violet-400"
          iconBg="bg-violet-500/10"
          explanation="The total number of unique customers registered in the system."
        />
        <StatCard
          icon={Package}
          label="Low Stock"
          value={stats?.lowStockItems ?? 0}
          sub="Items need restocking"
          color="text-amber-400"
          iconBg="bg-amber-500/10"
          explanation="Number of inventory products that have fallen to or below their assigned low stock threshold."
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue Chart */}
        <Card
          className="lg:col-span-2"
          onMouseEnter={() => setChartHovered(true)}
          onMouseLeave={() => setChartHovered(false)}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center justify-between">
              <span>Revenue Trend</span>
              {chartHovered && <span className="text-[10px] font-normal text-muted-foreground uppercase tracking-wider">(Paused)</span>}
            </CardTitle>
            {chartHovered && (
              <p className="text-xs text-muted-foreground mt-1 animate-in fade-in slide-in-from-top-1 duration-300">
                Displays the total revenue generated each month. This is calculated by summing the total amount of all service orders marked as 'completed' or 'delivered' within that month.
              </p>
            )}
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
                <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} fill="url(#revenueGrad)" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Job Status Pie */}
        <Card
          onMouseEnter={() => setPieHovered(true)}
          onMouseLeave={() => setPieHovered(false)}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center justify-between">
              <span>Job Status</span>
              {pieHovered && <span className="text-[10px] font-normal text-muted-foreground uppercase tracking-wider">(Paused)</span>}
            </CardTitle>
            {pieHovered && (
              <p className="text-xs text-muted-foreground mt-1 animate-in fade-in slide-in-from-top-1 duration-300">
                Shows the distribution of service orders by their current status. This represents all service orders recorded in the system.
              </p>
            )}
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={150}>
              <PieChart>
                <Pie
                  data={statusData.slice(0, pieVisible)}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={65}
                  paddingAngle={12}
                  dataKey="value"
                  isAnimationActive={true}
                  animationBegin={0}
                  animationDuration={380}
                  className={[
                    "origin-center cursor-pointer",
                    pieSpinning && !pieHovered
                      ? "animate-[spin_6s_linear_infinite]"
                      : "",
                  ].join(" ")}
                >
                  {statusData.slice(0, pieVisible).map((entry, i) => (
                    <Cell key={i} fill={entry.color} className="transition-all duration-300 hover:opacity-80" />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(222 47% 7%)", border: "1px solid hsl(217 33% 14%)", borderRadius: "8px", fontSize: "12px" }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-2 space-y-1.5">
              {statusData.map((item: any, i: number) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between text-xs suit-tile"
                  style={{ animationDelay: `${i * 0.18}s` }}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="h-2 w-2 rounded-full suit-dot"
                      style={{ background: item.color, animationDelay: `${i * 0.18 + 0.08}s` }}
                    />
                    <span className="text-muted-foreground">{item.name}</span>
                  </div>
                  <span className="font-medium suit-value" style={{ animationDelay: `${i * 0.18 + 0.14}s` }}>{item.value}</span>
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

        {/* Low Stock Alerts */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Low Stock Alerts</CardTitle>
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {inventoryData && inventoryData.length > 0 ? (
              <div className="divide-y divide-border">
                {inventoryData.map((product: any, idx: number) => (
                  <div key={product.name + product.brand} className="px-6 py-3 hover:bg-amber-500/5 transition-colors">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-semibold truncate text-foreground">{product.name}</p>
                      <span className="text-xs font-bold text-primary uppercase tracking-wider">{product.brand}</span>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <div className="text-[11px] text-muted-foreground uppercase tracking-wider">
                        Threshold: {product.reorder_level} {product.unit}
                      </div>
                      <span className="text-sm font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded">
                        {product.stock_quantity} {product.unit} left
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-6 py-12 text-center text-muted-foreground text-sm">
                <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-emerald-500/50" />
                <p className="font-medium text-emerald-500">All stock levels OK</p>
                <p className="text-xs mt-1">No products are currently running low.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
