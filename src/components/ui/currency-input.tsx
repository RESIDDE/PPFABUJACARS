import * as React from "react";
import { Input } from "./input";
import { formatCurrency } from "@/lib/utils";

interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value?: number;
  onChange?: (value: number) => void;
}

export const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value, onChange, placeholder, ...props }, ref) => {
    // Keep local string state for typing
    const [displayValue, setDisplayValue] = React.useState<string>(
      value !== undefined && value !== null ? value.toLocaleString("en-US") : ""
    );

    // Sync from external prop if it changes
    React.useEffect(() => {
      if (value !== undefined && value !== null) {
        // Only update if it's different to avoid cursor jumping
        const numValue = parseFloat(displayValue.replace(/,/g, ''));
        if (numValue !== value) {
          setDisplayValue(value.toLocaleString("en-US"));
        }
      } else if (value === undefined || value === null) {
        setDisplayValue("");
      }
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      // Remove all non-numeric characters except digits and decimal point
      const rawValue = e.target.value.replace(/[^0-9.]/g, "");
      
      // Prevent multiple decimal points
      const parts = rawValue.split('.');
      let cleanValue = parts[0];
      if (parts.length > 1) {
        cleanValue += '.' + parts[1];
      }

      // Format for display
      if (cleanValue === "" || cleanValue === ".") {
        setDisplayValue(cleanValue);
        onChange?.(0);
        return;
      }

      // Keep decimal part intact during typing
      const hasDecimal = cleanValue.includes(".");
      const [whole, decimal] = cleanValue.split(".");
      
      const formattedWhole = parseInt(whole || "0", 10).toLocaleString("en-US");
      const finalDisplay = hasDecimal ? `${formattedWhole}.${decimal}` : formattedWhole;
      
      setDisplayValue(finalDisplay);

      const numericValue = parseFloat(cleanValue);
      if (!isNaN(numericValue)) {
        onChange?.(numericValue);
      }
    };

    return (
      <Input
        {...props}
        ref={ref}
        type="text"
        value={displayValue}
        onChange={handleChange}
        placeholder={placeholder}
      />
    );
  }
);

CurrencyInput.displayName = "CurrencyInput";
