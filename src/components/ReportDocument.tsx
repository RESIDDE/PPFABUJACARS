import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate, downloadFile } from "@/lib/utils";
import { Printer, Image as ImageIcon, Loader2, FileText, Calendar, TrendingUp, TrendingDown, DollarSign, Package, ShoppingBag } from "lucide-react";
// @ts-ignore
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

// ─── Amount to Words ──────────────────────────────────────────────────────────
const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen"];
const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function numToWords(n: number): string {
  if (n === 0) return "Zero";
  if (n < 0) return "Minus " + numToWords(-n);
  if (n < 20) return ones[n];
  if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
  if (n < 1000) return ones[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + numToWords(n % 100) : "");
  if (n < 1_000_000) return numToWords(Math.floor(n / 1000)) + " Thousand" + (n % 1000 ? " " + numToWords(n % 1000) : "");
  if (n < 1_000_000_000) return numToWords(Math.floor(n / 1_000_000)) + " Million" + (n % 1_000_000 ? " " + numToWords(n % 1_000_000) : "");
  return numToWords(Math.floor(n / 1_000_000_000)) + " Billion" + (n % 1_000_000_000 ? " " + numToWords(n % 1_000_000) : "");
}

function amountInWords(amount: number): string {
  const naira = Math.floor(Math.abs(amount));
  const kobo = Math.round((Math.abs(amount) - naira) * 100);
  let result = numToWords(naira) + " Naira";
  if (kobo > 0) result += " and " + numToWords(kobo) + " Kobo";
  if (amount < 0) result = "Negative " + result;
  return result + " Only";
}

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

export interface ReportDocumentProps {
  onClose?: () => void;
  hideHeader?: boolean;
  filterPeriodLabel: string;
  startDate?: string;
  endDate?: string;
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  totalOrders: number;
  avgOrderValue: number;
  statusData: Array<{ name: string; value: number; color?: string }>;
  brandData: Array<{ brand: string; value: number }>;
  revenueChartData: Array<{ date: string; revenue: number; expenses: number }>;
  ordersList?: Array<any>;
}

export default function ReportDocument({
  onClose,
  hideHeader,
  filterPeriodLabel,
  startDate,
  endDate,
  totalRevenue,
  totalExpenses,
  netProfit,
  totalOrders,
  avgOrderValue,
  statusData,
  brandData,
  revenueChartData,
  ordersList = [],
}: ReportDocumentProps) {
  const reportRef = useRef<HTMLDivElement>(null);
  const [downloadingType, setDownloadingType] = useState<"png" | "pdf" | null>(null);

  const reportId = `REP-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}`;

  // ── Print: popup window with extracted CSS so it renders completely isolated ──
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
  <title>Business Performance Report - PPF Abuja Cars</title>
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
    @page { margin: 0; }
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
    .report-print-page {
      padding: 24px 32px;
      background: white;
      width: 100%; min-width: 800px; box-sizing: border-box;
      overflow: visible;
    }
    .no-print { display: none !important; }
    @media print {
      .report-print-page {
        padding: 20px 28px;
      }
    }
  </style>
</head>
<body>
  <div class="report-print-page">
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

  // ── Download PNG ──────────────────────────────────────────────────────────
  const handleDownloadPng = async () => {
    if (!reportRef.current) return;
    try {
      setDownloadingType("png");
      
      const isDark = document.documentElement.classList.contains("dark");
      if (isDark) {
        document.documentElement.classList.remove("dark");
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      const canvas = await html2canvas(reportRef.current, { scale: 2, useCORS: true, windowWidth: 1024 });
      
      if (isDark) {
        document.documentElement.classList.add("dark");
      }

      let a4Width = canvas.width;
      let a4Height = Math.floor(a4Width * 1.4142857);

      if (canvas.height > a4Height) {
        a4Height = canvas.height;
        a4Width = Math.floor(a4Height / 1.4142857);
      }

      const a4Canvas = document.createElement("canvas");
      a4Canvas.width = a4Width;
      a4Canvas.height = a4Height;
      const ctx = a4Canvas.getContext("2d");
      
      if (ctx) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, a4Width, a4Height);
        const xOffset = (a4Width - canvas.width) / 2;
        ctx.drawImage(canvas, xOffset, 0);
      }

      await downloadFile(a4Canvas.toDataURL("image/png"), `PPF_Abuja_Cars_Report_${reportId}.png`);
    } catch (error) {
      console.error("Failed to generate PNG", error);
      alert("Failed to download PNG. Please try again.");
    } finally {
      setDownloadingType(null);
    }
  };

  // ── Download PDF ──────────────────────────────────────────────────────────
  const handleDownloadPdf = async () => {
    if (!reportRef.current) return;
    try {
      setDownloadingType("pdf");
      
      const isDark = document.documentElement.classList.contains("dark");
      if (isDark) {
        document.documentElement.classList.remove("dark");
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      const canvas = await html2canvas(reportRef.current, { scale: 2, useCORS: true, windowWidth: 1024 });
      
      if (isDark) {
        document.documentElement.classList.add("dark");
      }

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      await downloadFile(pdf.output("blob"), `PPF_Abuja_Cars_Report_${reportId}.pdf`);
    } catch (error) {
      console.error("Failed to generate PDF", error);
      alert("Failed to download PDF. Please try again.");
    } finally {
      setDownloadingType(null);
    }
  };

  const formattedDateRange = startDate || endDate 
    ? `${startDate ? formatDate(startDate) : "Start"} to ${endDate ? formatDate(endDate) : "Present"}`
    : filterPeriodLabel;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Toolbar — hidden on print */}
      {!hideHeader && (
        <div className="no-print flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border-b border-border bg-muted/30 sticky top-0 z-10 gap-4">
          <div>
            <h2 className="text-lg font-semibold">Report Document Preview</h2>
            <p className="text-sm text-muted-foreground">Print or Export Official Business Report</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <Button variant="outline" onClick={handleDownloadPdf} disabled={!!downloadingType} className="flex-1 sm:flex-none whitespace-nowrap">
              {downloadingType === "pdf" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileText className="h-4 w-4 mr-2" />}
              Save PDF
            </Button>
            <Button variant="outline" onClick={handleDownloadPng} disabled={!!downloadingType} className="flex-1 sm:flex-none whitespace-nowrap">
              {downloadingType === "png" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ImageIcon className="h-4 w-4 mr-2" />}
              Save PNG
            </Button>
            <Button onClick={handlePrint} className="flex-1 sm:flex-none whitespace-nowrap">
              <Printer className="h-4 w-4 mr-2" /> Print / Save PDF
            </Button>
            {onClose && (
              <Button variant="ghost" onClick={onClose} className="flex-1 sm:flex-none whitespace-nowrap">
                Close
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Scrollable preview wrapper */}
      <div className="print-scroll-wrapper overflow-y-auto p-4 md:p-6 flex-1 bg-muted/10">
        {/* ─── The actual report document ─── */}
        <div
          ref={reportRef}
          className="print-invoice relative overflow-hidden w-full max-w-[780px] print:w-[780px] print:min-w-[780px] mx-auto bg-card text-card-foreground p-7 md:p-9 shadow-sm border border-border rounded-xl"
        >
          {/* Watermark */}
          <div
            className="absolute inset-0 pointer-events-none z-0 opacity-[0.03]"
            style={{ backgroundImage: "url(/logo.jpeg)", backgroundPosition: "center", backgroundSize: "60%", backgroundRepeat: "no-repeat" }}
          />

          <div className="relative z-10 space-y-5">

            {/* ── HEADER ── */}
            <div className="flex justify-between items-start pb-4 border-b-2 border-primary/10">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-lg overflow-hidden shadow-sm shrink-0 bg-white border border-border">
                  <img src="/logo.jpeg" alt="PPF Abuja Cars Logo" className="w-full h-full object-cover" />
                </div>
                <div>
                  <h3 className="font-black text-base text-foreground uppercase tracking-wide">PPF ABUJACAR</h3>
                  <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">Plot 5 Bala Kona Street, off Ahmadu Bello</p>
                  <p className="text-[11px] text-muted-foreground leading-snug">Expressway, Kado, FCT Abuja</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">+234 808 535 9774</p>
                </div>
              </div>
              <div className="text-right">
                <h1 className="text-2xl font-black text-primary tracking-tight uppercase">Performance Report</h1>
                <p className="text-xs text-muted-foreground font-mono mt-1">Ref: #{reportId}</p>
                <p className="text-[11px] text-muted-foreground font-medium mt-0.5">Generated: {formatDate(new Date().toISOString())}</p>
              </div>
            </div>

            {/* ── REPORT METADATA BAR ── */}
            <div className="grid grid-cols-3 gap-4 py-3 px-4 bg-primary/5 rounded-lg border border-primary/15">
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">Time Period</p>
                <p className="font-semibold text-xs text-foreground">{formattedDateRange}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">Report Status</p>
                <p className="font-semibold text-xs text-emerald-600 uppercase tracking-wider">Official Summary</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">Net Profit Result</p>
                <p className={`font-bold text-xs ${netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {formatCurrency(netProfit)}
                </p>
              </div>
            </div>

            {/* ── EXECUTIVE FINANCIAL SUMMARY CARDS ── */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Executive Financial Summary</p>
              <div className="grid grid-cols-4 gap-3">
                <div className="p-3 bg-muted/30 rounded-lg border border-border/70">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total Revenue</p>
                  <p className="text-sm font-black text-foreground mt-1">{formatCurrency(totalRevenue)}</p>
                </div>
                <div className="p-3 bg-muted/30 rounded-lg border border-border/70">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total Expenses</p>
                  <p className="text-sm font-black text-rose-600 mt-1">{formatCurrency(totalExpenses)}</p>
                </div>
                <div className="p-3 bg-muted/30 rounded-lg border border-border/70">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Net Profit</p>
                  <p className={`text-sm font-black mt-1 ${netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {formatCurrency(netProfit)}
                  </p>
                </div>
                <div className="p-3 bg-muted/30 rounded-lg border border-border/70">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Orders & Avg Value</p>
                  <p className="text-xs font-black text-foreground mt-1">{totalOrders} Orders</p>
                  <p className="text-[10px] text-muted-foreground">{formatCurrency(avgOrderValue)} avg</p>
                </div>
              </div>
            </div>

            {/* ── FINANCIAL OVERVIEW TABLE ── */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Financial Breakdown Summary</p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b-2 border-border/80 text-muted-foreground">
                    <th className="text-left py-2 font-semibold">Category Metric</th>
                    <th className="text-right py-2 font-semibold">Volume / Count</th>
                    <th className="text-right py-2 font-semibold">Total Value (NGN)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  <tr>
                    <td className="py-2.5 font-medium text-foreground">Completed & Delivered Service Revenue</td>
                    <td className="py-2.5 text-right font-mono">{totalOrders} service orders</td>
                    <td className="py-2.5 text-right font-semibold text-foreground">{formatCurrency(totalRevenue)}</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 font-medium text-foreground">Operating Expenses & Material Costs</td>
                    <td className="py-2.5 text-right font-mono">—</td>
                    <td className="py-2.5 text-right font-semibold text-rose-600">-{formatCurrency(totalExpenses)}</td>
                  </tr>
                  <tr className="bg-primary/5">
                    <td className="py-2.5 font-bold text-foreground">Net Operating Profit</td>
                    <td className="py-2.5 text-right font-mono">—</td>
                    <td className={`py-2.5 text-right font-black ${netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {formatCurrency(netProfit)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* ── VEHICLES SERVICED & PRICING BREAKDOWN ── */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                Vehicles Serviced & Price Breakdown ({ordersList.length} total)
              </p>
              {ordersList.length > 0 ? (
                <div className="border border-border/80 rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/40 border-b border-border/80 text-muted-foreground text-[10px]">
                        <th className="text-left py-2 px-3 font-semibold">Date</th>
                        <th className="text-left py-2 px-3 font-semibold">Order #</th>
                        <th className="text-left py-2 px-3 font-semibold">Vehicle Details</th>
                        <th className="text-left py-2 px-3 font-semibold">Customer</th>
                        <th className="text-left py-2 px-3 font-semibold">Status</th>
                        <th className="text-right py-2 px-3 font-semibold">Price (NGN)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {ordersList.map((order: any) => {
                        const vehList: any[] = [];
                        if (order.vehicles) {
                          vehList.push(order.vehicles);
                        }
                        if (order.service_order_vehicles && Array.isArray(order.service_order_vehicles)) {
                          order.service_order_vehicles.forEach((sov: any) => {
                            if (sov.vehicles && !vehList.some((v: any) => v.id === sov.vehicles.id)) {
                              vehList.push(sov.vehicles);
                            }
                          });
                        }
                        const primaryVeh = vehList[0];
                        const vehText = vehList.length > 0
                          ? vehList.map((v: any) => `${v.make || ''} ${v.model || ''} ${v.year ? `(${v.year})` : ''} ${v.plate_number ? `· ${v.plate_number}` : ''}`.trim()).join(", ")
                          : "No vehicle assigned";

                        return (
                          <tr key={order.id} className="hover:bg-muted/10">
                            <td className="py-2 px-3 text-[11px] text-muted-foreground whitespace-nowrap">
                              {formatDate(order.created_at)}
                            </td>
                            <td className="py-2 px-3 font-mono text-[11px] font-semibold text-foreground">
                              {order.order_number || "—"}
                            </td>
                            <td className="py-2 px-3 text-[11px]">
                              <p className="font-semibold text-foreground">{vehText}</p>
                              {primaryVeh?.vin && <p className="text-[9px] text-muted-foreground font-mono">VIN: {primaryVeh.vin}</p>}
                            </td>
                            <td className="py-2 px-3 text-[11px] text-muted-foreground">
                              {order.customers?.full_name || "Walk-in"}
                            </td>
                            <td className="py-2 px-3 text-[10px] uppercase font-bold tracking-wider">
                              <span className={`inline-block px-1.5 py-0.5 rounded ${
                                order.status === 'completed' || order.status === 'delivered'
                                  ? 'bg-emerald-500/10 text-emerald-600'
                                  : order.status === 'in_progress'
                                  ? 'bg-amber-500/10 text-amber-600'
                                  : 'bg-muted text-muted-foreground'
                              }`}>
                                {order.status}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-foreground">
                              {formatCurrency(order.total_amount || 0)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-primary/5 font-bold border-t border-border/80">
                        <td colSpan={5} className="py-2 px-3 text-right uppercase text-[10px] tracking-wider text-muted-foreground">
                          Total Serviced Value:
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-primary font-black text-xs">
                          {formatCurrency(ordersList.reduce((sum: number, o: any) => sum + (o.total_amount || 0), 0))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <div className="p-4 text-center text-xs text-muted-foreground italic border border-dashed rounded-lg">
                  No vehicle service records found for the selected period.
                </div>
              )}
            </div>

            {/* ── SERVICE ORDER STATUS & INVENTORY TABLES (2 COLUMNS) ── */}
            <div className="grid grid-cols-2 gap-4">
              {/* Order Status Breakdown */}
              <div className="p-3.5 bg-muted/20 rounded-lg border border-border/60">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Service Orders by Status</p>
                {statusData.length > 0 ? (
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="border-b border-border/60 text-muted-foreground text-[10px]">
                        <th className="text-left py-1 font-semibold">Status</th>
                        <th className="text-right py-1 font-semibold">Count</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {statusData.map((item) => (
                        <tr key={item.name}>
                          <td className="py-1.5 capitalize font-medium">{item.name}</td>
                          <td className="py-1.5 text-right font-bold font-mono">{item.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-xs text-muted-foreground italic py-2">No service order data for period</p>
                )}
              </div>

              {/* Stock Value by Brand */}
              <div className="p-3.5 bg-muted/20 rounded-lg border border-border/60">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">PPF Stock Valuation by Brand</p>
                {brandData.length > 0 ? (
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="border-b border-border/60 text-muted-foreground text-[10px]">
                        <th className="text-left py-1 font-semibold">Brand</th>
                        <th className="text-right py-1 font-semibold">Stock Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {brandData.map((item) => (
                        <tr key={item.brand}>
                          <td className="py-1.5 font-medium">{item.brand}</td>
                          <td className="py-1.5 text-right font-semibold font-mono">{formatCurrency(item.value)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-xs text-muted-foreground italic py-2">No inventory stock data</p>
                )}
              </div>
            </div>

            {/* ── REVENUE & EXPENSE TIMELINE SUMMARY ── */}
            {revenueChartData.length > 0 && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Period Financial History</p>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/80 text-muted-foreground text-[10px]">
                      <th className="text-left py-1.5 font-semibold">Date</th>
                      <th className="text-right py-1.5 font-semibold">Revenue</th>
                      <th className="text-right py-1.5 font-semibold">Expenses</th>
                      <th className="text-right py-1.5 font-semibold">Net</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {revenueChartData.slice(-8).map((row, i) => {
                      const dayNet = row.revenue - row.expenses;
                      return (
                        <tr key={i}>
                          <td className="py-1.5 font-medium text-foreground">{row.date}</td>
                          <td className="py-1.5 text-right font-mono text-emerald-600">{formatCurrency(row.revenue)}</td>
                          <td className="py-1.5 text-right font-mono text-rose-600">{formatCurrency(row.expenses)}</td>
                          <td className={`py-1.5 text-right font-mono font-bold ${dayNet >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {formatCurrency(dayNet)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* ── TOTALS + AMOUNT IN WORDS ── */}
            <div className="flex gap-6 justify-between items-start border-t border-border/80 pt-3">
              {/* Net Profit in Words */}
              <div className="flex-1 self-end">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Net Operating Profit in Words</p>
                <p className="text-xs font-semibold text-foreground italic leading-snug">
                  {amountInWords(netProfit)}
                </p>
              </div>
              {/* Numeric totals summary */}
              <div className="w-56 space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Gross Revenue</span>
                  <span className="font-semibold text-foreground">{formatCurrency(totalRevenue)}</span>
                </div>
                <div className="flex justify-between text-xs text-rose-600 pb-1 border-b border-border/80">
                  <span>Total Expenses</span>
                  <span>-{formatCurrency(totalExpenses)}</span>
                </div>
                <div className="flex justify-between text-base font-bold text-primary pt-1">
                  <span>Net Profit</span>
                  <span>{formatCurrency(netProfit)}</span>
                </div>
              </div>
            </div>

            {/* ── FOOTER ── */}
            <div className="pt-3 border-t border-border/50 space-y-3">
              {/* Thank you & Company Address */}
              <div className="text-center text-[10px] text-muted-foreground">
                <p className="font-semibold text-foreground mb-0.5">PPF Abuja Cars — Business Management & Performance Systems</p>
                <p>Plot 5 Bala Kona Street, off Ahmadu Bello Expressway, Kado FCT Abuja &nbsp;·&nbsp; +234 808 535 9774</p>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
