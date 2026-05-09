import { useEffect, useState } from "react"
import { useMutation, useQuery } from "convex/react"
import { api, type Id } from "@/lib/api"
import { CheckCircle, ChartBar, Circle, X } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"

export function PollCard({ messageId }: { messageId: Id<"messages"> }) {
  const poll = useQuery(api.polls.get, { messageId })
  const me = useQuery(api.users.me)
  const vote = useMutation(api.polls.vote)
  const close = useMutation(api.polls.close)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!poll?.closesAt || poll.closed) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [poll?.closesAt, poll?.closed])

  if (poll === undefined) {
    return (
      <div className="mt-1 rounded-lg border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
        Loading poll…
      </div>
    )
  }
  if (poll === null) return null

  const isAuthor = me?._id === poll.authorId
  const closed = poll.closed
  const remaining = poll.closesAt ? Math.max(0, poll.closesAt - now) : null

  async function onVote(idx: number) {
    if (closed) return
    try {
      await vote({ pollId: poll!.pollId, optionIndex: idx })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Vote failed")
    }
  }

  async function onClose() {
    try {
      await close({ pollId: poll!.pollId })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to close")
    }
  }

  const total = poll.total

  return (
    <div className="mt-1 max-w-md rounded-lg border border-border/60 bg-card/60 p-3 shadow-sm">
      <div className="mb-2 flex items-start gap-2">
        <ChartBar className="mt-0.5 size-4 shrink-0 text-primary" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium leading-snug">{poll.question}</div>
          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
            <span>{total} {total === 1 ? "vote" : "votes"}</span>
            {poll.multiSelect ? <span>· multi-select</span> : null}
            {closed ? (
              <span>· closed</span>
            ) : remaining !== null ? (
              <span>· closes in {formatRemaining(remaining)}</span>
            ) : null}
          </div>
        </div>
        {isAuthor && !closed ? (
          <button
            type="button"
            onClick={onClose}
            className="grid size-6 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Close poll"
            title="Close poll"
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </div>
      <div className="space-y-1.5">
        {poll.options.map((opt, idx) => {
          const count = poll.counts[idx] ?? 0
          const pct = total === 0 ? 0 : Math.round((count / total) * 100)
          const mine = poll.myVotes.includes(idx)
          return (
            <button
              key={idx}
              type="button"
              onClick={() => onVote(idx)}
              disabled={closed}
              className={cn(
                "group relative w-full overflow-hidden rounded-md border px-2 py-1.5 text-left text-sm transition",
                closed
                  ? "border-border/50 cursor-default"
                  : mine
                    ? "border-primary/60 bg-primary/5 hover:bg-primary/10"
                    : "border-border/60 bg-background hover:border-primary/40 hover:bg-accent/40",
              )}
            >
              <span
                className={cn(
                  "absolute inset-y-0 left-0 transition-[width] duration-500 ease-out",
                  mine ? "bg-primary/20" : "bg-muted",
                )}
                style={{ width: `${pct}%` }}
              />
              <span className="relative flex items-center gap-2">
                {mine ? (
                  <CheckCircle className="size-4 text-primary" weight="fill" />
                ) : (
                  <Circle className="size-4 text-muted-foreground" />
                )}
                <span className="flex-1 truncate">{opt}</span>
                <span className="ml-auto tabular-nums text-xs text-muted-foreground">
                  {count} · {pct}%
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function formatRemaining(ms: number) {
  const totalSec = Math.floor(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  if (m === 0) return `${s}s`
  if (m < 60) return `${m}m ${s}s`
  const h = Math.floor(m / 60)
  const remM = m % 60
  return `${h}h ${remM}m`
}

export function PollComposerHelp({
  onUse,
}: {
  onUse: (template: string) => void
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => onUse("/poll Question? | Option A | Option B")}
    >
      <ChartBar className="size-3.5" />
      Poll
    </Button>
  )
}
