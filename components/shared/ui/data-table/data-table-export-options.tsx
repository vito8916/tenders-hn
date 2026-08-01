import { Button } from '@/components/ui/button'
import { Table } from '@tanstack/react-table'
import { Download } from 'lucide-react'
import React from 'react'
import { toast } from 'sonner'
import { format } from 'date-fns'

export default function DataTableExportOptions<TData>({ table }: { table: Table<TData> }) {
    const columns = table.getAllColumns()
    const handleExport = () => {
        const rowCount = table.getRowCount()
    
        if (rowCount === 0) {
          toast.info("There are no rows to export.")
          return
        }
    
        try {
          // Filter out non-data columns (select and actions)
          const exportableColumns = columns.filter(
            (col) =>
              col.id !== "select" &&
              col.id !== "actions" &&
              "accessorKey" in col &&
              col.accessorKey
          )
    
          if (exportableColumns.length === 0) {
            toast.error("No exportable columns found.")
            return
          }
    
          // Create headers with proper names
          const headers = exportableColumns.map((column) => {
            if (typeof column.columnDef.header === "string") {
              return column.columnDef.header as string
            }
            // For non-string headers, use the accessor key as fallback
            const accessorKey =
              "accessorKey" in column ? column.accessorKey : ""
            return accessorKey ? String(accessorKey) : "Unknown"
          })
    
          // Process rows with proper data handling
          const rows = table.getRowModel().rows.map((row) =>
            exportableColumns.map((column) => {
              const accessorKey =
                "accessorKey" in column
                  ? (column.accessorKey as string)
                  : undefined
              if (!accessorKey) return ""
    
              const record = row.original as Record<string, unknown>
              let value = record[accessorKey]
    
              // Handle date formatting
              if (accessorKey === "createdAt" && value) {
                try {
                  value = format(new Date(value as string), "dd MMM, yyyy")
                } catch (error) {
                  console.warn("Date formatting error:", error)
                }
              }
    
              // Handle null/undefined values
              if (value === null || value === undefined) {
                return ""
              }
    
              // Convert to string and escape commas and quotes
              let stringValue = String(value)
              // If the value contains commas, quotes, or newlines, wrap it in quotes
              if (
                stringValue.includes(",") ||
                stringValue.includes('"') ||
                stringValue.includes("\n")
              ) {
                // Escape existing quotes by doubling them
                stringValue = '"' + stringValue.replace(/"/g, '""') + '"'
              }
              return stringValue
            })
          )
    
          // Create CSV content with proper escaping
          const csvContent = [
            headers
              .map((header: string) =>
                header.includes(",") || header.includes('"')
                  ? `"${header.replace(/"/g, '""')}"`
                  : header
              )
              .join(","),
            ...rows.map((row: string[]) => row.join(",")),
          ].join("\n")
    
          // Add BOM for proper UTF-8 encoding in Excel
          const BOM = "\uFEFF"
          const blob = new Blob([BOM + csvContent], {
            type: "text/csv;charset=utf-8;",
          })
    
          // Create download link
          const link = document.createElement("a")
          link.href = URL.createObjectURL(blob)
          // Generate filename with timestamp
          const now = new Date()
          const timestamp = format(now, "yyyy-MM-dd_HH-mm-ss")
          link.download = `export_${timestamp}.csv`
    
          // Trigger download
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
    
          // Clean up the blob URL
          URL.revokeObjectURL(link.href)
    
          // Show success notification
          toast.success("Export completed!", {
            description: `Exported ${rowCount} item${
              rowCount !== 1 ? "s" : ""
            } to CSV.`,
            duration: 3000,
          })
        } catch (error) {
          console.error("Export error:", error)
          toast.error("Export failed", {
            description:
              error instanceof Error
                ? error.message
                : "An unexpected error occurred during export.",
            duration: 5000,
          })
        }
      }
  return (
    <div>
      <Button
        onClick={handleExport}
        variant="outline"
        size="sm"
        disabled={table.getRowCount() === 0}
      >
        <Download className="mr-2 h-4 w-4" />
        Export CSV
      </Button>
    </div>
  )
}
