import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Printer, Image as ImageIcon, Loader2, FileText } from "lucide-react";
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
  return numToWords(Math.floor(n / 1_000_000_000)) + " Billion" + (n % 1_000_000_000 ? " " + numToWords(n % 1_000_000_000) : "");
}

function amountInWords(amount: number): string {
  const naira = Math.floor(amount);
  const kobo = Math.round((amount - naira) * 100);
  let result = numToWords(naira) + " Naira";
  if (kobo > 0) result += " and " + numToWords(kobo) + " Kobo";
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
// ─────────────────────────────────────────────────────────────────────────────

export default function InvoiceDocument({ invoiceId, onClose, hideHeader }: { invoiceId: string; onClose?: () => void; hideHeader?: boolean }) {
  const invoiceRef = useRef<HTMLDivElement>(null);
  const [downloadingType, setDownloadingType] = useState<"png" | "pdf" | null>(null);

  const { data: invoice, isLoading } = useQuery({
    queryKey: ["invoice-detail", invoiceId],
    queryFn: async (): Promise<any> => {
      const { data: inv, error: invErr } = await supabase
        .from("invoices")
        .select("*, customers(*), service_orders(*, service_order_vehicles(vehicles(*)), service_order_items(*, ppf_products(*), vehicles(*)))")
        .eq("id", invoiceId)
        .single();
      if (invErr) throw invErr;
      return inv;
    },
  });

  // ── Print: popup window with extracted CSS so it renders completely isolated ──
  const handlePrint = () => {
    if (!invoiceRef.current) return;

    const printWindow = window.open("", "_blank", "width=900,height=1200");
    if (!printWindow) {
      alert("Please allow pop-ups for this site to print invoices.");
      return;
    }

    const allCss = extractAllCss();

    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Invoice</title>
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
    ${invoiceRef.current.innerHTML}
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
    if (!invoiceRef.current) return;
    try {
      setDownloadingType("png");
      
      // Temporarily remove dark mode for the screenshot
      const isDark = document.documentElement.classList.contains("dark");
      if (isDark) {
        document.documentElement.classList.remove("dark");
        // Wait a tiny bit for the browser to repaint light mode colors
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      const canvas = await html2canvas(invoiceRef.current, { scale: 2, useCORS: true, windowWidth: 1024 });
      
      // Restore dark mode
      if (isDark) {
        document.documentElement.classList.add("dark");
      }

      const link = document.createElement("a");
      link.download = `Invoice-${invoice?.invoice_number}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (error) {
      console.error("Failed to generate PNG", error);
      alert("Failed to download PNG. Please try again.");
    } finally {
      setDownloadingType(null);
    }
  };

  // ── Download PDF ──────────────────────────────────────────────────────────
  const handleDownloadPdf = async () => {
    if (!invoiceRef.current) return;
    try {
      setDownloadingType("pdf");
      
      const isDark = document.documentElement.classList.contains("dark");
      if (isDark) {
        document.documentElement.classList.remove("dark");
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      const canvas = await html2canvas(invoiceRef.current, { scale: 2, useCORS: true, windowWidth: 1024 });
      
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
      pdf.save(`Invoice-${invoice?.invoice_number}.pdf`);
    } catch (error) {
      console.error("Failed to generate PDF", error);
      alert("Failed to download PDF. Please try again.");
    } finally {
      setDownloadingType(null);
    }
  };

  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary opacity-50" /></div>;
  if (!invoice) return <div>Invoice not found</div>;

  const customer = invoice.customers as any;
  const order = invoice.service_orders as any;
  const vehicles = order?.service_order_vehicles?.map((sov: any) => sov.vehicles).filter(Boolean) || [];
  const primaryVehicle = vehicles[0];
  const items = order?.service_order_items || [];

  const isParking = invoice.invoice_type === "parking";
  const displayAmount = invoice.total_amount ?? order?.total_amount ?? 0;
  const balanceDue = Math.max(0, displayAmount - (invoice.amount_paid || 0));

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Toolbar — hidden on print */}
      {!hideHeader && (
        <div className="no-print flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 pr-12 border-b border-border bg-muted/30 sticky top-0 z-10 gap-4">
          <div>
            <h2 className="text-lg font-semibold">Invoice Preview</h2>
            <p className="text-sm text-muted-foreground">Print to PDF or Download as PNG</p>
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
          </div>
        </div>
      )}

      {/* Scrollable preview wrapper */}
      <div className="print-scroll-wrapper overflow-y-auto p-4 md:p-6 flex-1 bg-muted/10">
        {/* ─── The actual invoice document ─── */}
        <div
          ref={invoiceRef}
          className="print-invoice relative overflow-hidden w-full max-w-[780px] print:w-[780px] print:min-w-[780px] mx-auto bg-card text-card-foreground p-7 md:p-9 shadow-sm border border-border rounded-xl"
        >
          {/* Watermark */}
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
                <h1 className="text-3xl font-black text-primary tracking-tight uppercase">Invoice</h1>
                <p className="text-sm text-muted-foreground font-mono mt-1">#{invoice.invoice_number}</p>
                {isParking && (
                  <span className="inline-block mt-2 px-2.5 py-0.5 bg-blue-500/10 text-blue-600 text-[10px] font-bold tracking-wider rounded border border-blue-500/20 uppercase">
                    Parking Invoice
                  </span>
                )}
              </div>
            </div>

            {/* ── BILLED TO + DATES + VEHICLE ── */}
            <div className="grid grid-cols-2 gap-6 py-3 border-b border-border/50">
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Billed To</p>
                <p className="font-semibold text-base">{customer?.full_name}</p>
                {customer?.phone && <p className="text-xs text-muted-foreground">{customer.phone}</p>}
                {customer?.email && <p className="text-xs text-muted-foreground">{customer.email}</p>}
                {customer?.address && <p className="text-xs text-muted-foreground mt-0.5">{customer.address}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Date Issued</p>
                  <p className="font-medium text-xs">{formatDate(invoice.issued_date)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Due Date</p>
                  <p className="font-medium text-xs">{invoice.due_date ? formatDate(invoice.due_date) : "Upon receipt"}</p>
                </div>
                {vehicles.length > 0 && (
                  <div className="col-span-2 mt-1">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Vehicles</p>
                    <div className="space-y-1.5">
                      {vehicles.map((v: any) => (
                        <div key={v.id} className="leading-tight">
                          <p className="font-medium text-xs">{v.make} {v.model} {v.year ? `(${v.year})` : ""}</p>
                          <div className="text-[10px] text-foreground mt-1 space-y-0.5">
                            <p><span className="text-muted-foreground font-medium">Plate:</span> {v.plate_number || "N/A"}</p>
                            <p><span className="text-muted-foreground font-medium">VIN:</span> {v.vin || "N/A"}</p>
                            {v.color && <p><span className="text-muted-foreground font-medium">Color:</span> {v.color}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── ITEMS TABLE ── */}
            <div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b-2 border-border/80">
                    <th className="text-left py-2 font-semibold text-muted-foreground">Description</th>
                    <th className="text-right py-2 font-semibold text-muted-foreground">Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {isParking ? (
                    <tr>
                      <td className="py-2.5">
                        <p className="font-semibold text-foreground">Parking Service</p>
                        {invoice.notes && <p className="text-[10px] text-muted-foreground mt-0.5">{invoice.notes}</p>}
                      </td>
                      <td className="py-2.5 text-right">1</td>
                    </tr>
                  ) : items.length > 0 ? (
                    items.map((item: any) => (
                      <tr key={item.id}>
                        <td className="py-2.5">
                          <p className="font-semibold text-foreground">
                            {item.area_description}
                            {item.vehicles && (
                              <span className="ml-2 font-normal text-[10px] bg-muted/50 px-1 py-0.5 rounded text-muted-foreground">
                                {item.vehicles.make} {item.vehicles.model}
                              </span>
                            )}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{item.ppf_products?.brand} {item.ppf_products?.name}</p>
                        </td>
                        <td className="py-2.5 text-right">{item.quantity_used}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={2} className="py-6 text-center text-muted-foreground">No line items</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* ── TOTALS + AMOUNT IN WORDS ── */}
            <div className="flex gap-6 justify-between items-start border-t border-border/80 pt-3">
              {/* Amount in words */}
              <div className="flex-1 self-end">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Amount in Words</p>
                <p className="text-xs font-semibold text-foreground italic leading-snug">
                  {amountInWords(displayAmount)}
                </p>
              </div>
              {/* Numeric totals */}
              <div className="w-56 space-y-1.5">
                {!isParking && order && (
                  <>
                    {order.discount > 0 && (
                      <div className="flex justify-between text-xs text-emerald-500">
                        <span>Discount</span>
                        <span>-{formatCurrency(order.discount)}</span>
                      </div>
                    )}
                    {order.tax > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">VAT / Tax</span>
                        <span>{formatCurrency(order.tax)}</span>
                      </div>
                    )}
                  </>
                )}
                <div className="flex justify-between text-sm font-bold pt-2 border-t border-border/80">
                  <span>Total</span>
                  <span>{formatCurrency(displayAmount)}</span>
                </div>
                <div className="flex justify-between text-xs text-emerald-500 pb-1.5 border-b border-border/80">
                  <span>Amount Paid</span>
                  <span>{formatCurrency(invoice.amount_paid || 0)}</span>
                </div>
                <div className="flex justify-between text-base font-bold text-primary pt-0.5">
                  <span>Balance Due</span>
                  <span>{formatCurrency(balanceDue)}</span>
                </div>
              </div>
            </div>

            {/* ── FOOTER ── */}
            <div className="pt-3 border-t border-border/50 space-y-3">
              {/* Payment Details */}
              <div className="p-3.5 rounded-lg bg-primary/5 border border-primary/15">
                <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-2 text-center">Payment Details</p>
                <p className="text-[10px] text-muted-foreground text-center mb-2.5">Kindly make payment to the account details below:</p>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">Bank</p>
                    <p className="text-xs font-semibold text-foreground">Providus Bank</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">Account Number</p>
                    <p className="text-xs font-bold font-mono text-primary tracking-wider">1309339336</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">Account Name</p>
                    <p className="text-xs font-semibold text-foreground">ABUJACAR PPF</p>
                  </div>
                </div>
              </div>

              {/* Address + Thank you */}
              <div className="text-center text-[10px] text-muted-foreground">
                <p className="font-semibold text-foreground mb-0.5">Thank you for your business!</p>
                <p>Plot 5 Bala Kona Street, off Ahmadu Bello Expressway, Kado FCT Abuja &nbsp;·&nbsp; +234 808 535 9774</p>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

