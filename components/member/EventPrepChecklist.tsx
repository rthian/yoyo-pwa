/**
 * Member prep checklist — same data as Prompt 22 countdown emails.
 */
import { CheckCircle2, Circle, MinusCircle } from 'lucide-react'
import type { PrepChecklistItem } from '@/lib/prep/checklist'
import { cn } from '@/lib/utils'

export default function EventPrepChecklist({
  items,
  title = 'Prep checklist',
}: {
  items: PrepChecklistItem[]
  title?: string
}) {
  return (
    <div className="rounded-md border p-3 space-y-2">
      <p className="text-sm font-medium">{title}</p>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li
            key={item.key}
            className="flex items-start gap-2 text-sm text-muted-foreground"
          >
            {item.ok === true ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : item.ok === false ? (
              <Circle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            ) : (
              <MinusCircle className="h-4 w-4 shrink-0 mt-0.5 opacity-50" />
            )}
            <span>
              <span
                className={cn(
                  'font-medium',
                  item.ok === true && 'text-foreground',
                  item.ok === false && 'text-amber-800 dark:text-amber-200'
                )}
              >
                {item.label}
              </span>
              : {item.detail}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
