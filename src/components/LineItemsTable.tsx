import React from "react";
import { LineItem, TaxBreakdownValue } from "../types";
import { Trash2, Plus, Percent, Sparkles } from "lucide-react";

interface LineItemsTableProps {
  items: LineItem[];
  onChange: (updatedItems: LineItem[]) => void;
}

export default function LineItemsTable({ items, onChange }: LineItemsTableProps) {
  
  const handleItemChange = (index: number, field: keyof LineItem, value: any) => {
    const newItems = [...items];
    const item = { ...newItems[index] };

    if (field === "quantity") {
      const q = value === "" ? null : Number(value);
      item.quantity = q;
      if (q !== null && item.unitPrice !== null) {
        item.amount = Number((q * item.unitPrice).toFixed(2));
      }
    } else if (field === "unitPrice") {
      const p = value === "" ? null : Number(value);
      item.unitPrice = p;
      if (item.quantity !== null && p !== null) {
        item.amount = Number((item.quantity * p).toFixed(2));
      }
    } else if (field === "amount") {
      item.amount = value === "" ? null : Number(value);
    } else if (field === "taxRate") {
      item.taxRate = value === "" ? null : Number(value);
    } else if (field === "tax") {
      item.tax = value === "" ? null : Number(value);
    } else if (field === "taxabilityGroup") {
      item.taxabilityGroup = value;
      if (value === "Zero-Rated" || value === "Exempt") {
        item.tax = 0;
        item.taxRate = 0;
        item.isTaxExempt = true;
      } else {
        item.isTaxExempt = false;
      }
    } else {
      (item as any)[field] = value;
    }

    newItems[index] = item;
    onChange(newItems);
  };

  const addItem = () => {
    const newItem: LineItem = {
      description: "New item description",
      quantity: 1,
      unitPrice: 0,
      amount: 0,
      tax: 0,
      taxRate: 0.13, // Default ON HST rate for ease of use
      isTaxExempt: false,
      taxabilityGroup: "Taxable",
      taxBreakdown: { gst: null, pst: null, hst: null, qst: null, rst: null },
    };
    onChange([...items, newItem]);
  };

  const removeItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    onChange(newItems);
  };

  return (
    <div className="space-y-4 font-sans" id="line-items-table">
      <div className="flex items-center justify-between">
        <h3 className="font-sans font-medium text-xs text-gray-400 uppercase tracking-wider">
          Invoice Line Items
        </h3>
        <button
          type="button"
          onClick={addItem}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded hover:bg-emerald-100 transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" /> Add New Line
        </button>
      </div>

      <div className="overflow-x-auto border border-gray-100 rounded-lg bg-white">
        <table className="min-w-full divide-y divide-gray-100 text-left text-xs">
          <thead className="bg-gray-50 text-gray-500 uppercase tracking-wider font-mono text-[10px]">
            <tr>
              <th className="px-4 py-3 min-w-[220px]">Description</th>
              <th className="px-3 py-3 w-[80px]">Qty</th>
              <th className="px-3 py-3 w-[100px]">Unit Price</th>
              <th className="px-3 py-3 w-[110px]">Line Total</th>
              <th className="px-3 py-3 w-[140px]">Tax Group</th>
              <th className="px-3 py-3 w-[90px]">Tax Rate</th>
              <th className="px-3 py-3 w-[100px]">Tax Amount</th>
              <th className="px-4 py-3 w-[50px]"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {items.map((item, index) => (
              <tr key={index} className="hover:bg-gray-50/50 transition-colors">
                {/* Description */}
                <td className="px-4 py-2.5">
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) => handleItemChange(index, "description", e.target.value)}
                    className="w-full px-2 py-1 text-xs text-gray-800 border border-transparent rounded hover:border-gray-200 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all font-medium"
                    placeholder="Item description"
                  />
                </td>

                {/* Quantity */}
                <td className="px-3 py-2.5">
                  <input
                    type="number"
                    value={item.quantity ?? ""}
                    onChange={(e) => handleItemChange(index, "quantity", e.target.value)}
                    className="w-full px-2 py-1 text-xs text-gray-800 border border-transparent rounded hover:border-gray-200 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all text-center font-mono"
                    placeholder="0"
                    step="any"
                  />
                </td>

                {/* Unit Price */}
                <td className="px-3 py-2.5">
                  <div className="relative">
                    <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">$</span>
                    <input
                      type="number"
                      value={item.unitPrice ?? ""}
                      onChange={(e) => handleItemChange(index, "unitPrice", e.target.value)}
                      className="w-full pl-4 pr-1 py-1 text-xs text-gray-800 border border-transparent rounded hover:border-gray-200 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all font-mono"
                      placeholder="0.00"
                      step="any"
                    />
                  </div>
                </td>

                {/* Amount */}
                <td className="px-3 py-2.5">
                  <div className="relative">
                    <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">$</span>
                    <input
                      type="number"
                      value={item.amount ?? ""}
                      onChange={(e) => handleItemChange(index, "amount", e.target.value)}
                      className="w-full pl-4 pr-1 py-1 text-xs text-gray-800 border border-transparent rounded hover:border-gray-200 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all font-mono font-medium"
                      placeholder="0.00"
                      step="any"
                    />
                  </div>
                </td>

                {/* Taxability Group */}
                <td className="px-3 py-2.5">
                  <select
                    value={item.taxabilityGroup ?? "Taxable"}
                    onChange={(e) => handleItemChange(index, "taxabilityGroup", e.target.value)}
                    className={`w-full px-2 py-1 text-[11px] border border-gray-200 rounded focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium ${
                      item.taxabilityGroup === "Taxable"
                        ? "text-blue-800 bg-blue-50/50"
                        : item.taxabilityGroup === "Zero-Rated"
                        ? "text-emerald-800 bg-emerald-50/50"
                        : "text-amber-800 bg-amber-50/50"
                    }`}
                  >
                    <option value="Taxable">Standard / Taxable</option>
                    <option value="Zero-Rated">Zero-Rated (0%)</option>
                    <option value="Exempt">Exempt / Non-Tax</option>
                  </select>
                </td>

                {/* Tax Rate */}
                <td className="px-3 py-2.5">
                  <div className="relative">
                    <input
                      type="number"
                      value={item.taxRate !== null ? Number((item.taxRate * 100).toFixed(3)) : ""}
                      onChange={(e) => handleItemChange(index, "taxRate", e.target.value === "" ? null : Number(e.target.value) / 100)}
                      className="w-full pr-4 pl-1.5 py-1 text-xs text-gray-800 border border-transparent rounded hover:border-gray-200 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all text-right font-mono"
                      placeholder="0"
                      disabled={item.taxabilityGroup !== "Taxable"}
                      step="any"
                    />
                    <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">%</span>
                  </div>
                </td>

                {/* Tax Amount */}
                <td className="px-3 py-2.5">
                  <div className="relative">
                    <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">$</span>
                    <input
                      type="number"
                      value={item.tax ?? ""}
                      onChange={(e) => handleItemChange(index, "tax", e.target.value)}
                      className="w-full pl-4 pr-1 py-1 text-xs text-gray-800 border border-transparent rounded hover:border-gray-200 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all font-mono"
                      placeholder="0.00"
                      disabled={item.taxabilityGroup !== "Taxable"}
                      step="any"
                    />
                  </div>
                </td>

                {/* Actions */}
                <td className="px-4 py-2.5 text-center">
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    className="text-gray-400 hover:text-rose-500 p-1 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                    title="Remove item"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}

            {items.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                  <Sparkles className="w-6 h-6 mx-auto mb-2 text-gray-300" />
                  No line items registered. Click "Add New Line" to begin.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
