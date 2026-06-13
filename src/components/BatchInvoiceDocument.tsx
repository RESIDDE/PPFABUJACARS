import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Printer, Image as ImageIcon, Loader2 } from "lucide-react";
import InvoiceDocument from "./InvoiceDocument";
// @ts-ignore
import html2canvas from "html2canvas";
// @ts-ignore
import { jsPDF } from "jspdf";

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

export default function BatchInvoiceDocument({ invoiceIds, onClose }: { invoiceIds: string[]; onClose: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  // ── Print: popup window with extracted CSS so every invoice gets its own page ──
  const handlePrint = () => {
    if (!containerRef.current) return;

    const invoiceEls = containerRef.current.querySelectorAll(".invoice-page");
    if (!invoiceEls.length) return;

    const printWindow = window.open("", "_blank", "width=900,height=1200");
    if (!printWindow) {
      alert("Please allow pop-ups for this site to print invoices.");
      return;
    }

    // Build one <section> per invoice, each on its own printed page
    const pagesHtml = Array.from(invoiceEls)
      .map((el, i) => {
        const isLast = i === invoiceEls.length - 1;
        return `<section class="invoice-print-page" style="page-break-after:${isLast ? "avoid" : "always"};break-after:${isLast ? "avoid" : "page"};">
  ${el.innerHTML}
</section>`;
      })
      .join("\n");

    // Pull ALL live CSS rules (Tailwind + custom) from the current page
    const allCss = extractAllCss();

    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Invoices</title>
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
    /* Hide the InvoiceDocument toolbar (hideHeader=true hides it anyway, belt-and-braces) */
    .no-print { display: none !important; }
    /* Remove card shadows/borders that look odd on paper */
    @media print {
      .invoice-print-page {
        padding: 20px 28px;
      }
    }
  </style>
</head>
<body>
${pagesHtml}
<script>
  window.onload = function () {
    setTimeout(function () {
      window.print();
      window.close();
    }, 700);
  };
<\/script>
</body>
</html>`);

    printWindow.document.close();
  };

  // ── Download PDF ───────────────────────────────────────────────────────────
  const handleDownloadPdf = async () => {
    if (!containerRef.current) return;
    try {
      setDownloading(true);
      
      // Temporarily remove dark mode for the screenshot
      const isDark = document.documentElement.classList.contains("dark");
      if (isDark) {
        document.documentElement.classList.remove("dark");
        // Wait a tiny bit for the browser to repaint light mode colors
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      const pdf = new jsPDF("p", "mm", "a4");
      const invoiceEls = containerRef.current.querySelectorAll(".invoice-page");

      for (let i = 0; i < invoiceEls.length; i++) {
        const el = invoiceEls[i] as HTMLElement;
        const canvas = await html2canvas(el, { scale: 2, useCORS: true, windowWidth: 1024 });
        const imgData = canvas.toDataURL("image/png");
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      }
      
      // Restore dark mode
      if (isDark) {
        document.documentElement.classList.add("dark");
      }

      pdf.save("Customer-Invoices-Batch.pdf");
    } catch (error) {
      console.error("Failed to generate PDF", error);
      alert("Failed to download PDF. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Toolbar */}
      <div className="no-print flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border-b border-border bg-muted/30 sticky top-0 z-10 gap-4">
        <div>
          <h2 className="text-lg font-semibold">Batch Invoices Preview</h2>
          <p className="text-sm text-muted-foreground">
            {invoiceIds.length} invoice{invoiceIds.length !== 1 ? "s" : ""} · each prints on its own page
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <Button variant="outline" onClick={handleDownloadPdf} disabled={downloading} className="flex-1 sm:flex-none whitespace-nowrap">
            {downloading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ImageIcon className="h-4 w-4 mr-2" />}
            Save as PDF
          </Button>
          <Button onClick={handlePrint} className="flex-1 sm:flex-none whitespace-nowrap">
            <Printer className="h-4 w-4 mr-2" /> Print All ({invoiceIds.length} page{invoiceIds.length !== 1 ? "s" : ""})
          </Button>
        </div>
      </div>

      {/* Invoice pages preview */}
      <div className="overflow-y-auto p-4 md:p-8 flex-1 bg-muted/10 flex flex-col gap-12" ref={containerRef}>
        {invoiceIds.map((id, index) => (
          <div key={id} className="invoice-page">
            <InvoiceDocument invoiceId={id} hideHeader={true} />
            {index < invoiceIds.length - 1 && (
              <div className="no-print mt-10 border-b-2 border-dashed border-border relative">
                <span className="absolute left-1/2 -top-3 -translate-x-1/2 bg-background px-4 text-xs text-muted-foreground uppercase tracking-wider">
                  — Page {index + 2} starts below —
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}


