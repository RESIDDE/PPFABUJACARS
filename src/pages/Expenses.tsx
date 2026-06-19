import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Receipt, Pencil, Trash2, Calendar as CalendarIcon, Car, TrendingUp, TrendingDown, DollarSign, Printer, Download, FileText, Image as ImageIcon, Loader2 } from "lucide-react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { format, isSameMonth, subMonths, isSameWeek } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate } from "@/lib/utils";
import { Pagination } from "@/components/ui/pagination";
// @ts-ignore
import html2canvas from "html2canvas";

const PAGE_SIZE = 10;

const schema = z.object({
  expense_type: z.enum(["job", "other"]).default("job"),
  customer_id: z.string().optional(),
  vehicle_id: z.string().optional(),
  expense_date: z.string().min(1, "Date is required"),
  technician_name: z.string().optional(),
  job_description: z.string().optional(),
  amount: z.coerce.number().optional(),
  other_expenses: z.array(z.object({
    job_description: z.string().min(1, "Expense detail is required"),
    amount: z.coerce.number().min(0, "Amount must be positive")
  })).optional()
}).superRefine((data, ctx) => {
  if (data.expense_type === "job") {
    if (!data.customer_id) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Customer is required", path: ["customer_id"] });
    }
    if (!data.vehicle_id) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Vehicle is required", path: ["vehicle_id"] });
    }
    if (!data.technician_name) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Technician name is required", path: ["technician_name"] });
    }
    if (!data.job_description) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Job description is required", path: ["job_description"] });
    }
    if (data.amount === undefined || data.amount <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Amount must be positive", path: ["amount"] });
    }
  } else {
    if (!data.other_expenses || data.other_expenses.length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "At least one expense is required", path: ["other_expenses"] });
    } else {
      data.other_expenses.forEach((exp, index) => {
        if (!exp.job_description) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Expense detail is required", path: ["other_expenses", index, "job_description"] });
        }
        if (exp.amount === undefined || exp.amount <= 0) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Amount must be positive", path: ["other_expenses", index, "amount"] });
        }
      });
    }
  }
});

type FormData = z.infer<typeof schema>;

// Extracts all loaded CSS rules (including Vite-injected Tailwind) from the current document
function extractAllCss(): string {
  const parts: string[] = [];
  try {
    Array.from(document.styleSheets).forEach((sheet) => {
      try {
        Array.from(sheet.cssRules || []).forEach((rule) => {
          parts.push(rule.cssText);
        });
      } catch {
        // Cross-origin sheet — skip
      }
    });
  } catch {
    // ignore
  }
  return parts.join("\n");
}

const AmountInput = ({ value, onChange, placeholder = "0" }: { value: number | undefined, onChange: (val: number) => void, placeholder?: string }) => {
  const [displayValue, setDisplayValue] = useState(value ? value.toLocaleString('en-US') : "");
  
  useEffect(() => {
    if (value === 0 || value === undefined) {
      setDisplayValue("");
    } else if (Number(displayValue.replace(/,/g, '')) !== value) {
      setDisplayValue(value.toLocaleString('en-US'));
    }
  }, [value, displayValue]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/[^0-9.]/g, '');
    const parts = val.split('.');
    if (parts.length > 2) val = parts[0] + '.' + parts.slice(1).join('');
    if (parts[0]) {
      parts[0] = parseInt(parts[0], 10).toLocaleString('en-US');
    }
    const formatted = parts.join('.');
    setDisplayValue(formatted);
    onChange(val ? Number(val) : 0);
  };

  return <Input type="text" placeholder={placeholder} value={displayValue} onChange={handleChange} />;
};

export default function Expenses() {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [filterVehicle, setFilterVehicle] = useState("all");
  const [filterTime, setFilterTime] = useState("all");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  
  const toggleCard = (id: string) => setExpandedCards(prev => ({ ...prev, [id]: !prev[id] }));

  const parseOtherExpenses = (jobDesc: string) => {
    try {
      const parsed = JSON.parse(jobDesc);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
    return null;
  };
  
  const reportRef = useRef<HTMLDivElement>(null);

  const qc = useQueryClient();

  const { data: expensesRaw = [], isLoading } = useQuery({
    queryKey: ["expenses"],
    queryFn: async (): Promise<any> => {
      const { data, error } = await supabase
        .from("expenses")
        .select("*, vehicles(id, customer_id, make, model, plate_number, vin)")
        .order("expense_date", { ascending: false });
      
      if (error) {
        console.error("Error fetching expenses:", error);
        return [];
      }
      return data ?? [];
    },
  });

  const { data: allVehicles = [] } = useQuery({
    queryKey: ["all-vehicles-list"],
    queryFn: async (): Promise<any> => {
      const { data } = await supabase
        .from("vehicles")
        .select("id, make, model, plate_number, vin")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers-list"],
    queryFn: async (): Promise<any> => {
      const { data } = await supabase.from("customers").select("id, full_name").order("full_name");
      return data ?? [];
    },
  });

  const { data: customerVehicles = [] } = useQuery({
    queryKey: ["customer-vehicles", selectedCustomer],
    queryFn: async (): Promise<any> => {
      if (!selectedCustomer) return [];
      const { data } = await supabase.from("vehicles").select("id, make, model, plate_number, vin").eq("customer_id", selectedCustomer);
      return data ?? [];
    },
    enabled: !!selectedCustomer,
  });

  const expenses = useMemo(() => {
    let filtered = expensesRaw;
    const now = new Date();
    
    if (filterStartDate || filterEndDate) {
      filtered = filtered.filter((e: any) => {
        if (filterStartDate && e.expense_date < filterStartDate) return false;
        if (filterEndDate && e.expense_date > filterEndDate) return false;
        return true;
      });
    } else if (filterTime !== "all") {
      filtered = filtered.filter((e: any) => {
        const d = new Date(e.expense_date);
        if (filterTime === "this_week") return isSameWeek(d, now);
        if (filterTime === "this_month") return isSameMonth(d, now);
        if (filterTime === "last_month") return isSameMonth(d, subMonths(now, 1));
        return true;
      });
    }
    
    if (search) {
      const s = search.toLowerCase();
      filtered = filtered.filter((e: any) => 
        e.technician_name?.toLowerCase().includes(s) || 
        e.job_description?.toLowerCase().includes(s) ||
        e.vehicles?.make?.toLowerCase().includes(s) ||
        e.vehicles?.model?.toLowerCase().includes(s) ||
        e.vehicles?.plate_number?.toLowerCase().includes(s) ||
        e.vehicles?.vin?.toLowerCase().includes(s)
      );
    }

    if (filterVehicle !== "all") {
      filtered = filtered.filter((e: any) => e.vehicle_id === filterVehicle);
    }

    return filtered;
  }, [expensesRaw, search, filterVehicle, filterTime]);

  const dashboardStats = useMemo(() => {
    const now = new Date();
    const lastMonth = subMonths(now, 1);
    
    let total = 0;
    let thisMonthTotal = 0;
    let lastMonthTotal = 0;

    let filteredTotal = 0;
    expenses.forEach((e: any) => {
      filteredTotal += Number(e.amount);
    });

    expensesRaw.forEach((e: any) => {
      total += Number(e.amount);
      const d = new Date(e.expense_date);
      if (isSameMonth(d, now)) {
        thisMonthTotal += Number(e.amount);
      } else if (isSameMonth(d, lastMonth)) {
        lastMonthTotal += Number(e.amount);
      }
    });

    const monthOverMonth = lastMonthTotal === 0 
      ? 100 
      : ((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100;

    return { total, filteredTotal, thisMonthTotal, lastMonthTotal, monthOverMonth };
  }, [expensesRaw, expenses]);

  const totalPages = Math.ceil(expenses.length / PAGE_SIZE);
  const paginated = expenses.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const { register, handleSubmit, reset, setValue, watch, control, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      expense_type: "job",
      expense_date: format(new Date(), "yyyy-MM-dd"),
      other_expenses: [{ job_description: "", amount: 0 }],
    }
  });

  const { fields: otherExpensesFields, append: appendOtherExpense, remove: removeOtherExpense } = useFieldArray({
    control,
    name: "other_expenses"
  });

  const watchOtherExpenses = watch("other_expenses");
  const totalOtherExpenses = watchOtherExpenses?.reduce((sum, item) => sum + (Number(item.amount) || 0), 0) || 0;

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (data.expense_type === "job") {
        const payload = { 
          expense_type: "job",
          vehicle_id: data.vehicle_id,
          expense_date: data.expense_date,
          technician_name: data.technician_name,
          job_description: data.job_description,
          amount: data.amount,
        };

        if (editingId) {
          const { error } = await supabase.from("expenses").update(payload).eq("id", editingId);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("expenses").insert(payload);
          if (error) throw error;
        }
      } else {
        const payload = {
          expense_type: "other",
          expense_date: data.expense_date,
          job_description: JSON.stringify(data.other_expenses),
          amount: data.other_expenses!.reduce((sum, item) => sum + (Number(item.amount) || 0), 0),
        };

        if (editingId) {
          const { error } = await supabase.from("expenses").update(payload).eq("id", editingId);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("expenses").insert(payload);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      toast.success(editingId ? "Expense updated" : "Expense added");
      qc.invalidateQueries({ queryKey: ["expenses"] });
      setDialogOpen(false);
      reset();
      setEditingId(null);
      setSelectedCustomer("");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { 
      toast.success("Expense deleted"); 
      qc.invalidateQueries({ queryKey: ["expenses"] }); 
    },
    onError: (e) => toast.error(e.message),
  });

  const openAdd = () => { 
    reset({ 
      expense_type: "job",
      customer_id: "",
      vehicle_id: "",
      expense_date: format(new Date(), "yyyy-MM-dd"),
      technician_name: "",
      job_description: "",
      amount: 0,
      other_expenses: [{ job_description: "", amount: 0 }],
    }); 
    setSelectedCustomer("");
    setEditingId(null); 
    setDialogOpen(true); 
  };

  const openEdit = (e: any) => {
    const custId = e.vehicles?.customer_id || "";
    setSelectedCustomer(custId);
    reset({ 
      expense_type: e.expense_type || "job",
      customer_id: custId,
      vehicle_id: e.vehicle_id || "",
      expense_date: e.expense_date,
      technician_name: e.technician_name || "",
      job_description: e.expense_type === "job" ? e.job_description : "",
      amount: e.expense_type === "job" ? e.amount : 0,
      other_expenses: e.expense_type === "other" ? (parseOtherExpenses(e.job_description) || [{ job_description: e.job_description, amount: e.amount }]) : [{ job_description: "", amount: 0 }],
    });
    setEditingId(e.id); 
    setDialogOpen(true);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);
  };

  const handlePrint = () => {
    if (!reportRef.current) return;

    const printWindow = window.open("", "_blank", "width=900,height=1200");
    if (!printWindow) {
      alert("Please allow pop-ups for this site to print reports.");
      return;
    }

    const allCss = extractAllCss();

    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Expenses Report</title>
  <style>
    /* ── CSS variable fallbacks (light mode) ── */
    :root {
      --background: 0 0% 100%;
      --foreground: 240 10% 3.9%;
      --card: 0 0% 100%;
      --card-foreground: 240 10% 3.9%;
      --muted: 240 4.8% 95.9%;
      --muted-foreground: 240 3.8% 46.1%;
      --border: 240 5.9% 90%;
      --primary: 270 76% 53%;
      --primary-foreground: 0 0% 100%;
      --radius: 1rem;
    }

    /* ── All Tailwind + app CSS ── */
    ${allCss}

    /* ── Print overrides ── */
    *, *::before, *::after { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 0;
      background: white;
      font-family: "Inter", system-ui, -apple-system, sans-serif;
      font-size: 11px;
      color: #0a0a0f;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .invoice-print-page {
      padding: 24px 32px;
      background: white;
      width: 100%; min-width: 800px; box-sizing: border-box;
      overflow: visible;
    }
    .no-print { display: none !important; }
    @media print {
      .invoice-print-page {
        padding: 20px 28px;
      }
    }
  </style>
</head>
<body>
  <div class="invoice-print-page">
    ${reportRef.current.innerHTML}
  </div>
  <script>
    window.onload = function () {
      setTimeout(function () {
        window.print();
        window.close();
      }, 700);
    };
  </script>
</body>
</html>`);
    printWindow.document.close();
  };

  const handleDownloadPng = async () => {
    if (!reportRef.current) return;
    try {
      setDownloading(true);
      
      // Temporarily remove dark mode for the screenshot
      const isDark = document.documentElement.classList.contains("dark");
      if (isDark) {
        document.documentElement.classList.remove("dark");
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      const canvas = await html2canvas(reportRef.current, { scale: 2, useCORS: true, windowWidth: 1024 });
      
      // Restore dark mode
      if (isDark) {
        document.documentElement.classList.add("dark");
      }

      const link = document.createElement("a");
      link.download = `Expenses-Report-${format(new Date(), 'yyyy-MM-dd')}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (error) {
      console.error("Failed to generate PNG", error);
      toast.error("Failed to download PNG. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Expenses</h1>
          <p className="text-sm text-muted-foreground mt-1">Track job and vehicle expenses</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setReportOpen(true)} title="Export Report">
            <FileText className="h-4 w-4 mr-2" /> Export Report
          </Button>
          <Button onClick={openAdd}><Plus className="h-4 w-4 mr-2 hidden sm:inline" /> Add Expense</Button>
        </div>
      </div>

      {/* Dashboard KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {filterTime !== "all" || filterVehicle !== "all" || search ? "Filtered Total" : "Total Expenses"}
            </CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {formatCurrency(filterTime !== "all" || filterVehicle !== "all" || search ? dashboardStats.filteredTotal : dashboardStats.total)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {filterTime !== "all" || filterVehicle !== "all" || search ? "Total of current filtered list" : "All time expenses"}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{formatCurrency(dashboardStats.thisMonthTotal)}</div>
            <p className="text-xs text-muted-foreground flex items-center mt-1">
              {dashboardStats.monthOverMonth > 0 ? (
                <><TrendingUp className="h-3 w-3 mr-1 text-destructive" /><span className="text-destructive">+{dashboardStats.monthOverMonth.toFixed(1)}%</span></>
              ) : dashboardStats.monthOverMonth < 0 ? (
                <><TrendingDown className="h-3 w-3 mr-1 text-emerald-500" /><span className="text-emerald-500">{dashboardStats.monthOverMonth.toFixed(1)}%</span></>
              ) : (
                <span>0% change</span>
              )}
              <span className="ml-1">from last month</span>
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search description, technician, vehicle, VIN..." className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-1">
            <Input 
              type="date" 
              value={filterStartDate} 
              onChange={(e) => { setFilterStartDate(e.target.value); setPage(1); }}
              className="w-[130px]"
              title="Start Date"
            />
            <span className="text-muted-foreground">-</span>
            <Input 
              type="date" 
              value={filterEndDate} 
              onChange={(e) => { setFilterEndDate(e.target.value); setPage(1); }}
              className="w-[130px]"
              title="End Date"
            />
          </div>
          <Select value={filterTime} onValueChange={(v) => { setFilterTime(v); setPage(1); }}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Time Period" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="this_week">This Week</SelectItem>
              <SelectItem value="this_month">This Month</SelectItem>
              <SelectItem value="last_month">Last Month</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterVehicle} onValueChange={(v) => { setFilterVehicle(v); setPage(1); }}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="All Vehicles" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Vehicles</SelectItem>
              {allVehicles.map((v: any) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.make} {v.model} {v.plate_number ? `(${v.plate_number})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="h-36 rounded-xl shimmer" />)}
        </div>
      ) : expenses.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Receipt className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p className="font-medium">No expenses found</p>
          <p className="text-sm mt-1">Add an expense to start tracking costs</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginated.map((expense: any) => {
              const vehicle = expense.vehicles;
              const parsedOther = expense.expense_type === 'other' ? parseOtherExpenses(expense.job_description) : null;
              return (
                <Card key={expense.id} className="hover:border-primary/30 transition-colors group">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0">
                          <Receipt className="h-5 w-5 text-orange-500" />
                        </div>
                        <div>
                          {expense.expense_type === 'other' ? (
                            <>
                              <p className="font-semibold text-sm line-clamp-1">{parsedOther ? 'Grouped General Expenses' : expense.job_description}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <p className="text-xs font-medium text-destructive">
                                  {formatCurrency(expense.amount)}
                                </p>
                                {parsedOther && (
                                  <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-md text-muted-foreground">
                                    {parsedOther.length} items
                                  </span>
                                )}
                              </div>
                            </>
                          ) : (
                            <>
                              <p className="font-semibold text-sm line-clamp-1">{expense.job_description}</p>
                              <p className="text-xs text-muted-foreground font-medium text-destructive mt-0.5">
                                {formatCurrency(expense.amount)}
                              </p>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit(expense)} className="p-1.5 rounded hover:bg-muted"><Pencil className="h-3.5 w-3.5" /></button>
                        <button onClick={() => { if (confirm("Delete this expense?")) deleteMutation.mutate(expense.id); }} className="p-1.5 rounded hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>

                    {parsedOther && (
                      <div className="mt-2 mb-3">
                        <Button type="button" variant="ghost" size="sm" className="h-7 w-full text-[11px] bg-muted/40 hover:bg-muted/60" onClick={() => toggleCard(expense.id)}>
                          {expandedCards[expense.id] ? "Hide Items" : "View Items"}
                        </Button>
                        {expandedCards[expense.id] && (
                          <div className="mt-2 space-y-1.5 p-2 bg-muted/20 rounded-md border border-border/40">
                            {parsedOther.map((subItem: any, idx: number) => (
                              <div key={idx} className="flex justify-between items-center text-xs">
                                <span className="text-muted-foreground truncate mr-2" title={subItem.job_description}>• {subItem.job_description}</span>
                                <span className="font-medium shrink-0">{formatCurrency(subItem.amount)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="space-y-2 mt-3 text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg border border-border/50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <CalendarIcon className="h-3.5 w-3.5 opacity-70" />
                          <span>{formatDate(expense.expense_date)}</span>
                        </div>
                        <span className="font-medium">{expense.expense_type === 'other' ? '🏢 General' : `👤 ${expense.technician_name}`}</span>
                      </div>
                      <div className="flex flex-col gap-1 pt-1 border-t border-border/50">
                        {expense.expense_type === 'other' ? (
                          <div className="flex items-center gap-1.5">
                            <Receipt className="h-3.5 w-3.5 opacity-70" />
                            <span>Other Expense</span>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-1.5">
                              <Car className="h-3.5 w-3.5 opacity-70" />
                              <span>
                                {vehicle ? `${vehicle.make} ${vehicle.model} ${vehicle.plate_number ? `[${vehicle.plate_number}]` : ''}` : 'Unknown Vehicle'}
                              </span>
                            </div>
                            {vehicle?.vin && (
                              <div className="ml-5 text-[10px] font-mono text-muted-foreground/80 uppercase">
                                VIN: {vehicle.vin}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <div>
            <Pagination page={page} totalPages={totalPages} totalItems={expenses.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
          </div>
        </>
      )}

      {/* FORM DIALOG */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Expense" : "Add New Expense"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4 pt-4">
            
            <div className="space-y-2">
              <Label>Expense Type</Label>
              <Select 
                onValueChange={(v) => setValue("expense_type", v as "job" | "other")} 
                value={watch("expense_type") || "job"}
              >
                <SelectTrigger><SelectValue placeholder="Select type..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="job">Job / Vehicle Expense</SelectItem>
                  <SelectItem value="other">Other Expense (Rent, Utilities, etc.)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {watch("expense_type") === "job" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Customer *</Label>
                  <Select 
                    onValueChange={(v) => { 
                      setSelectedCustomer(v); 
                      setValue("customer_id", v); 
                      setValue("vehicle_id", ""); 
                    }} 
                    value={watch("customer_id") || ""}
                  >
                    <SelectTrigger><SelectValue placeholder="Select customer..." /></SelectTrigger>
                    <SelectContent>
                      {customers.map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.customer_id && <p className="text-xs text-destructive">{errors.customer_id.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label>Vehicle *</Label>
                  <Select 
                    onValueChange={(v) => setValue("vehicle_id", v)} 
                    value={watch("vehicle_id") || ""}
                    disabled={!selectedCustomer}
                  >
                    <SelectTrigger><SelectValue placeholder="Select vehicle..." /></SelectTrigger>
                    <SelectContent>
                      {customerVehicles.map((v: any) => (
                        <SelectItem key={v.id} value={v.id}>
                          <div className="flex flex-col text-left py-1">
                            <span>{v.make} {v.model} {v.plate_number ? `· ${v.plate_number}` : ""}</span>
                            {v.vin && <span className="text-[10px] text-muted-foreground mt-0.5">VIN: {v.vin}</span>}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.vehicle_id && <p className="text-xs text-destructive">{errors.vehicle_id.message}</p>}
                </div>
              </div>
            )}

            {watch("expense_type") === "job" ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="expense_date">Date *</Label>
                    <Input id="expense_date" type="date" {...register("expense_date")} />
                    {errors.expense_date && <p className="text-xs text-destructive">{errors.expense_date.message}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="amount">Amount (₦) *</Label>
                    <AmountInput 
                      value={watch("amount")} 
                      onChange={(val) => setValue("amount", val, { shouldValidate: true })} 
                    />
                    {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="technician_name">Technician Name *</Label>
                  <Input id="technician_name" placeholder="John Doe" {...register("technician_name")} />
                  {errors.technician_name && <p className="text-xs text-destructive">{errors.technician_name.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="job_description">Job Description *</Label>
                  <Textarea 
                    id="job_description" 
                    placeholder="Description of the expense or job done..." 
                    {...register("job_description")} 
                  />
                  {errors.job_description && <p className="text-xs text-destructive">{errors.job_description.message}</p>}
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2 mb-4">
                  <Label htmlFor="expense_date">Date *</Label>
                  <Input id="expense_date" type="date" {...register("expense_date")} className="w-1/2" />
                  {errors.expense_date && <p className="text-xs text-destructive">{errors.expense_date.message}</p>}
                </div>
                
                <div className="space-y-4">
                  {otherExpensesFields.map((field, index) => (
                    <div key={field.id} className="flex gap-3 items-start relative p-3 border rounded-md bg-muted/20">
                      <div className="flex-1 space-y-3">
                        <div className="space-y-1">
                          <Label>Expense Details *</Label>
                          <Input 
                            placeholder="E.g., Office Rent, Electricity Bill..." 
                            {...register(`other_expenses.${index}.job_description`)} 
                          />
                          {errors.other_expenses?.[index]?.job_description && <p className="text-xs text-destructive">{errors.other_expenses[index]?.job_description?.message}</p>}
                        </div>
                        <div className="space-y-1">
                          <Label>Amount (₦) *</Label>
                          <AmountInput 
                            value={watch(`other_expenses.${index}.amount`)} 
                            onChange={(val) => setValue(`other_expenses.${index}.amount`, val, { shouldValidate: true })} 
                          />
                          {errors.other_expenses?.[index]?.amount && <p className="text-xs text-destructive">{errors.other_expenses[index]?.amount?.message}</p>}
                        </div>
                      </div>
                      
                      {otherExpensesFields.length > 1 && (
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="icon" 
                          className="text-destructive mt-6 hover:bg-destructive/10"
                          onClick={() => removeOtherExpense(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  
                  <div className="flex items-center justify-between mt-2 pt-2 border-t">
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm" 
                      onClick={() => appendOtherExpense({ job_description: "", amount: 0 })}
                    >
                      <Plus className="h-4 w-4 mr-2" /> Add Another
                    </Button>
                    
                    <div className="text-right">
                      <p className="text-sm font-medium text-muted-foreground">Total</p>
                      <p className="text-xl font-bold text-primary">{formatCurrency(totalOtherExpenses)}</p>
                    </div>
                  </div>
                </div>
              </>
            )}

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Saving..." : editingId ? "Update Expense" : "Add Expense"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* REPORT PREVIEW DIALOG */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b bg-muted/30">
            <div>
              <DialogTitle>Expenses Report Preview</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">Print to PDF or Download as PNG</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleDownloadPng} disabled={downloading}>
                {downloading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ImageIcon className="h-4 w-4 mr-2" />}
                Save PNG
              </Button>
              <Button onClick={handlePrint}>
                <Printer className="h-4 w-4 mr-2" /> Print / Save PDF
              </Button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-6 bg-muted/10">
            {/* The Document */}
            <div
              ref={reportRef}
              className="print-invoice relative overflow-hidden w-full max-w-[780px] print:w-[780px] print:min-w-[780px] mx-auto bg-card text-card-foreground p-7 md:p-9 shadow-sm border border-border rounded-xl"
            >
              <div
                className="absolute inset-0 pointer-events-none z-0 opacity-[0.03]"
                style={{ backgroundImage: "url(/logo.jpeg)", backgroundPosition: "center", backgroundSize: "60%", backgroundRepeat: "no-repeat" }}
              />
              <div className="relative z-10 space-y-4">
                
                {/* ── HEADER ── */}
                <div className="flex justify-between items-start pb-4 border-b-2 border-primary/10">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-lg overflow-hidden shadow-sm shrink-0 bg-white border border-border">
                      <img src="/logo.jpeg" alt="PPF Abuja Cars Logo" className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <h3 className="font-black text-base text-foreground uppercase tracking-wide">PPF Abuja Cars</h3>
                      <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">Plot 5 Bala Kona Street, off Ahmadu Bello</p>
                      <p className="text-[11px] text-muted-foreground leading-snug">Expressway, Kado, FCT Abuja</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">+234 808 535 9774</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <h1 className="text-3xl font-black text-primary tracking-tight uppercase">Expenses</h1>
                    <p className="text-sm font-semibold text-muted-foreground mt-1 tracking-widest uppercase">Report</p>
                  </div>
                </div>

                {/* ── META INFO ── */}
                <div className="grid grid-cols-2 gap-6 py-3 border-b border-border/50">
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Filters Applied</p>
                    <p className="text-xs text-foreground font-medium">Period: <span className="font-normal">{filterTime === "all" ? "All Time" : filterTime.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase())}</span></p>
                    <p className="text-xs text-foreground font-medium mt-0.5">Vehicle: <span className="font-normal">
                      {filterVehicle === "all" ? "All Vehicles" : allVehicles.find((v:any) => v.id === filterVehicle)?.plate_number || "Selected Vehicle"}
                    </span></p>
                    {search && <p className="text-xs text-foreground font-medium mt-0.5">Search: <span className="font-normal">"{search}"</span></p>}
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Generated On</p>
                    <p className="font-medium text-xs">{formatDate(new Date().toISOString())}</p>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 mt-3">Total Records</p>
                    <p className="font-medium text-xs">{expenses.length} Expense(s)</p>
                  </div>
                </div>

                {/* ── TABLE ── */}
                <div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b-2 border-border/80">
                        <th className="text-left py-2 font-semibold text-muted-foreground w-20">Date</th>
                        <th className="text-left py-2 font-semibold text-muted-foreground w-24">Technician</th>
                        <th className="text-left py-2 font-semibold text-muted-foreground w-40">Vehicle</th>
                        <th className="text-left py-2 font-semibold text-muted-foreground">Description</th>
                        <th className="text-right py-2 font-semibold text-muted-foreground w-28">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {expenses.length > 0 ? (
                        expenses.map((expense: any) => {
                          const vehicle = expense.vehicles;
                          return (
                            <tr key={expense.id} className="align-top">
                              <td className="py-2.5 whitespace-nowrap">{formatDate(expense.expense_date)}</td>
                              <td className="py-2.5 truncate max-w-[100px]">{expense.expense_type === 'other' ? 'General' : expense.technician_name}</td>
                              <td className="py-2.5">
                                {expense.expense_type === 'other' ? (
                                  <div className="font-medium">Other Expense</div>
                                ) : (
                                  <>
                                    <div className="font-medium">{vehicle ? `${vehicle.make} ${vehicle.model}` : 'N/A'}</div>
                                    <div className="text-[10px] text-muted-foreground">{vehicle?.plate_number || ''}</div>
                                  </>
                                )}
                              </td>
                              <td className="py-2.5">
                                {expense.expense_type === 'other' ? (
                                  (() => {
                                    const parsed = parseOtherExpenses(expense.job_description);
                                    if (parsed) {
                                      return (
                                        <div className="space-y-1">
                                          {parsed.map((item: any, idx: number) => (
                                            <div key={idx} className="text-[10px]">
                                              • {item.job_description} ({formatCurrency(item.amount)})
                                            </div>
                                          ))}
                                        </div>
                                      );
                                    }
                                    return <p className="line-clamp-2">{expense.job_description}</p>;
                                  })()
                                ) : (
                                  <p className="line-clamp-2">{expense.job_description}</p>
                                )}
                              </td>
                              <td className="py-2.5 text-right font-medium">{formatCurrency(expense.amount)}</td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={5} className="py-6 text-center text-muted-foreground">No expenses found for this period.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* ── TOTALS ── */}
                <div className="flex justify-end pt-3 border-t-2 border-border/80">
                  <div className="w-64 space-y-2">
                    <div className="flex justify-between text-lg font-bold text-primary">
                      <span>Total Expenses</span>
                      <span>{formatCurrency(dashboardStats.filteredTotal)}</span>
                    </div>
                  </div>
                </div>

                {/* ── FOOTER ── */}
                <div className="pt-6 mt-6 border-t border-border/50 text-center text-[10px] text-muted-foreground">
                  <p className="font-semibold text-foreground mb-0.5">Generated by PPF Abuja Cars System</p>
                  <p>Plot 5 Bala Kona Street, off Ahmadu Bello Expressway, Kado FCT Abuja &nbsp;·&nbsp; +234 808 535 9774</p>
                </div>

              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
