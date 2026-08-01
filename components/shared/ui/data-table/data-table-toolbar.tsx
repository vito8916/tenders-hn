"use client"

import { Table } from "@tanstack/react-table"
import { X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DataTableViewOptions } from "@/components/shared/ui/data-table/data-table-view-options"

import { DataTableFacetedFilter } from "@/components/shared/ui/data-table/data-table-faceted-filter"
import DataTableExportOptions from "@/components/shared/ui/data-table/data-table-export-options"
import DataTableDeleteItems from "@/components/shared/ui/data-table/data-table-delete-items"

interface DataTableToolbarProps<TData> {
  table: Table<TData>
  facetedFilters?: {
    label: string
    value: string
    options: { label: string; value: string }[]
  }[],
  filterColumn?: string
  filterPlaceholder?: string,
  onDelete?: (ids: string[]) => Promise<void>
}

export function DataTableToolbar<TData>({
  table,
  facetedFilters = [],
  filterColumn = "name",
  filterPlaceholder = "Filter...",
  onDelete,
}: DataTableToolbarProps<TData>) {
  const isFiltered = table.getState().columnFilters.length > 0

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-1 items-center gap-2">
        <Input
          placeholder={filterPlaceholder}
          value={(table.getColumn(filterColumn)?.getFilterValue() as string) ?? ""}
          onChange={(event) =>
            table.getColumn(filterColumn)?.setFilterValue(event.target.value)
          }
          className="h-8 w-[150px] lg:w-[250px]"
        />
        {table.getSelectedRowModel().rows.length === 0 && (
        <div className="flex items-center gap-2">
        {facetedFilters.map((filter) => (
          <DataTableFacetedFilter
            key={filter.label}
            column={table.getColumn(filter.value)}
            title={filter.label}
            options={filter.options}
          />
        ))}
          
        {isFiltered && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => table.resetColumnFilters()}
          >
            Reset
            <X />
          </Button>
        )}
        </div>
        )}
        {table.getSelectedRowModel().rows.length > 0 && (
          <DataTableDeleteItems table={table} onDelete={onDelete} />
        )} 
      </div>
      <div className="flex items-center gap-2">
        <DataTableViewOptions table={table} />
        <DataTableExportOptions table={table}  />
      </div>
    </div>
  )
}
