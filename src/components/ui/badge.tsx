import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { EvidenceStatus } from "@/types"
import { evidenceStatusConfig } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-navy-800 text-white",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        destructive: "border-transparent bg-red-100 text-red-700 border-red-200",
        outline: "text-foreground",
        success: "border-transparent bg-green-100 text-green-700 border-green-200",
        warning: "border-transparent bg-amber-100 text-amber-700 border-amber-200",
        info: "border-transparent bg-blue-100 text-blue-700 border-blue-200",
        verified: "bg-green-50 text-green-700 border-green-200",
        supported: "bg-teal-50 text-teal-700 border-teal-200",
        uncertain: "bg-amber-50 text-amber-700 border-amber-200",
        conflicting: "bg-red-50 text-red-700 border-red-200",
        missing_evidence: "bg-purple-50 text-purple-700 border-purple-200",
        superseded: "bg-gray-50 text-gray-600 border-gray-200",
      },
    },
    defaultVariants: { variant: "default" },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export function EvidenceBadge({ status }: { status: EvidenceStatus }) {
  const config = evidenceStatusConfig[status]
  return (
    <span className={cn(
      "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
      config.bg, config.color, config.border
    )}>
      {config.label}
    </span>
  )
}

export { Badge, badgeVariants }
