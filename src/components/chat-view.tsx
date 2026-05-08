import { useEffect, useMemo, useRef, useState } from "react"
import { useMutation, useQuery } from "convex/react"
import { api, type Id } from "@/lib/api"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Hash, PaperPlaneRight, Trash, PencilSimple, X, Check } from "@phosphor-icons/react"
import { Textarea } from "@/components/ui/textarea"
import { formatTimestamp, initialsFromName } from "@/lib/format"
import { toast } from "sonner"

export function ChatView({
  channelId,
  channelName,
  topic,
}: {
  channelId: Id<"channels">
  channelName: string
  topic?: string
}) {
  const messages = useQuery(api.messages.list, { channelId, limit: 200 })
  const send = useMutation(api.messages.send)
  const [content, setContent] = useState("")
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!scrollRef.current) return
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages?.length])

  async function onSend() {
    const text = content.trim()
    if (!text || sending) return
    setSending(true)
    setContent("")
    try {
      await send({ channelId, content: text })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send")
      setContent(text)
    } finally {
      setSending(false)
      taRef.current?.focus()
    }
  }

  const grouped = useMemo(() => {
    if (!messages) return []
    const out: Array<
      | { kind: "msg"; msg: (typeof messages)[number]; showAuthor: boolean }
      | { kind: "divider"; key: string; label: string }
    > = []
    let lastDay = ""
    let lastAuthor = ""
    let lastTime = 0
    for (const m of messages) {
      const day = new Date(m._creationTime).toDateString()
      if (day !== lastDay) {
        out.push({ kind: "divider", key: `d-${day}`, label: day })
        lastDay = day
        lastAuthor = ""
      }
      const showAuthor =
        m.authorId !== lastAuthor || m._creationTime - lastTime > 5 * 60 * 1000
      out.push({ kind: "msg", msg: m, showAuthor })
      lastAuthor = m.authorId
      lastTime = m._creationTime
    }
    return out
  }, [messages])

  return (
    <div className="flex h-svh flex-1 flex-col bg-background">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border/40 px-4">
        <Hash className="size-5 text-muted-foreground" />
        <span className="font-medium">{channelName}</span>
        {topic ? (
          <>
            <span className="mx-2 h-4 w-px bg-border" />
            <span className="truncate text-sm text-muted-foreground">{topic}</span>
          </>
        ) : null}
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        {messages === undefined ? (
          <div className="grid h-full place-items-center text-sm text-muted-foreground">
            Loading messages…
          </div>
        ) : messages.length === 0 ? (
          <div className="grid h-full place-items-center text-center">
            <div>
              <div className="mx-auto mb-3 grid size-14 place-items-center rounded-full bg-primary/10 text-primary">
                <Hash className="size-6" />
              </div>
              <h3 className="text-lg font-medium">Welcome to #{channelName}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                This is the start of the channel. Say hi!
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-0.5">
            {grouped.map((g) => {
              if (g.kind === "divider") {
                return (
                  <div key={g.key} className="my-3 flex items-center gap-3">
                    <div className="h-px flex-1 bg-border/60" />
                    <span className="text-[11px] font-medium text-muted-foreground">
                      {g.label}
                    </span>
                    <div className="h-px flex-1 bg-border/60" />
                  </div>
                )
              }
              return (
                <MessageRow
                  key={g.msg._id}
                  msg={g.msg}
                  showAuthor={g.showAuthor}
                />
              )
            })}
          </div>
        )}
      </div>

      <div className="shrink-0 px-4 pb-4">
        <div className="rounded-xl border border-border/60 bg-card/40 backdrop-blur focus-within:border-primary/60 transition">
          <Textarea
            ref={taRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                onSend()
              }
            }}
            placeholder={`Message #${channelName}`}
            className="min-h-[44px] max-h-40 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 px-3 py-2.5"
            rows={1}
          />
          <div className="flex items-center justify-between px-2 pb-2">
            <span className="text-[11px] text-muted-foreground">
              Enter to send · Shift+Enter for newline
            </span>
            <Button
              size="sm"
              onClick={onSend}
              disabled={sending || content.trim().length === 0}
            >
              <PaperPlaneRight className="size-4" />
              Send
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function MessageRow({
  msg,
  showAuthor,
}: {
  msg: NonNullable<ReturnType<typeof useQuery<typeof api.messages.list>>>[number]
  showAuthor: boolean
}) {
  const me = useQuery(api.users.me)
  const editMutation = useMutation(api.messages.edit)
  const removeMutation = useMutation(api.messages.remove)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(msg.content)

  const isAuthor = me?._id === msg.authorId

  async function saveEdit() {
    const text = draft.trim()
    if (!text) return
    if (text === msg.content) {
      setEditing(false)
      return
    }
    try {
      await editMutation({ messageId: msg._id, content: text })
      setEditing(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed")
    }
  }

  async function onDelete() {
    if (!confirm("Delete this message?")) return
    try {
      await removeMutation({ messageId: msg._id })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed")
    }
  }

  if (!showAuthor) {
    return (
      <div className="group relative flex items-start gap-3 rounded px-2 py-0.5 hover:bg-muted/40">
        <div className="w-10 shrink-0" />
        <div className="flex-1 min-w-0">
          {editing ? (
            <EditForm
              draft={draft}
              setDraft={setDraft}
              onSave={saveEdit}
              onCancel={() => {
                setEditing(false)
                setDraft(msg.content)
              }}
            />
          ) : (
            <div className="text-sm leading-snug whitespace-pre-wrap break-words">
              {msg.content}
              {msg.editedAt ? (
                <span className="ml-1 text-[10px] text-muted-foreground">
                  (edited)
                </span>
              ) : null}
            </div>
          )}
        </div>
        {isAuthor && !editing ? (
          <RowActions
            onEdit={() => {
              setEditing(true)
              setDraft(msg.content)
            }}
            onDelete={onDelete}
          />
        ) : null}
      </div>
    )
  }

  return (
    <div className="group relative mt-3 flex items-start gap-3 rounded px-2 py-1 hover:bg-muted/40">
      <Avatar className="size-10 shrink-0 mt-0.5">
        {msg.author?.imageUrl ? <AvatarImage src={msg.author.imageUrl} /> : null}
        <AvatarFallback>
          {initialsFromName(msg.author?.name ?? "?")}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="font-medium text-sm">{msg.author?.name ?? "Unknown"}</span>
          <span className="text-[11px] text-muted-foreground">
            {formatTimestamp(msg._creationTime)}
          </span>
        </div>
        {editing ? (
          <EditForm
            draft={draft}
            setDraft={setDraft}
            onSave={saveEdit}
            onCancel={() => {
              setEditing(false)
              setDraft(msg.content)
            }}
          />
        ) : (
          <div className="text-sm leading-snug whitespace-pre-wrap break-words">
            {msg.content}
            {msg.editedAt ? (
              <span className="ml-1 text-[10px] text-muted-foreground">
                (edited)
              </span>
            ) : null}
          </div>
        )}
      </div>
      {isAuthor && !editing ? (
        <RowActions
          onEdit={() => {
            setEditing(true)
            setDraft(msg.content)
          }}
          onDelete={onDelete}
        />
      ) : null}
    </div>
  )
}

function EditForm({
  draft,
  setDraft,
  onSave,
  onCancel,
}: {
  draft: string
  setDraft: (v: string) => void
  onSave: () => void
  onCancel: () => void
}) {
  return (
    <div className="mt-1">
      <Textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className="text-sm"
        rows={2}
        autoFocus
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault()
            onSave()
          }
          if (e.key === "Escape") {
            e.preventDefault()
            onCancel()
          }
        }}
      />
      <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
        <span>Enter to save · Esc to cancel</span>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          <X className="size-3.5" />
        </Button>
        <Button size="sm" onClick={onSave}>
          <Check className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}

function RowActions({
  onEdit,
  onDelete,
}: {
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="absolute -top-3 right-3 hidden gap-1 rounded-md border bg-background p-0.5 shadow-sm group-hover:flex">
      <button
        onClick={onEdit}
        className="grid size-7 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label="Edit"
      >
        <PencilSimple className="size-3.5" />
      </button>
      <button
        onClick={onDelete}
        className="grid size-7 place-items-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        aria-label="Delete"
      >
        <Trash className="size-3.5" />
      </button>
    </div>
  )
}
