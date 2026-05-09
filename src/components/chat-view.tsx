import { useEffect, useMemo, useRef, useState } from "react"
import { useMutation, useQuery } from "convex/react"
import { api, type Id } from "@/lib/api"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Hash,
  PaperPlaneRight,
  Trash,
  PencilSimple,
  X,
  Check,
  ArrowBendUpLeft,
  Smiley,
  Paperclip,
  At,
  Microphone,
  Terminal,
} from "@phosphor-icons/react"
import { Textarea } from "@/components/ui/textarea"
import { formatTimestamp, initialsFromName } from "@/lib/format"
import { toast } from "sonner"
import { MobileSidebarTrigger, MobileMembersTrigger } from "./mobile-nav"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { uploadFile, MAX_ATTACHMENTS, MAX_FILE_SIZE, type UploadedAttachment } from "@/lib/upload"
import { SLASH_COMMANDS, parseSlash } from "@/lib/slash-commands"
import { PollCard } from "@/components/chat/poll-card"
import { VoiceMessage } from "@/components/chat/voice-message"
import { VoiceMessageRecorder } from "@/components/chat/voice-message-recorder"

const REACTION_PICKER = ["👍", "❤️", "😂", "🎉", "😮", "😢", "🔥", "👀", "🙏", "💯"] as const
const STATUS_COLORS = {
  online: "bg-emerald-500",
  idle: "bg-amber-500",
  dnd: "bg-rose-500",
  offline: "bg-zinc-500",
} as const

type MessageList = NonNullable<ReturnType<typeof useQuery<typeof api.messages.list>>>
type MessageDoc = MessageList[number]

type ChatHeader =
  | { kind: "channel"; name: string; topic?: string; serverId: Id<"servers"> }
  | {
      kind: "dm"
      other: {
        _id: Id<"users">
        name: string
        imageUrl?: string
        status: "online" | "idle" | "dnd" | "offline"
      }
    }

type Mentionable = { _id: Id<"users">; name: string; imageUrl?: string }

export function ChatView({
  channelId,
  channelName,
  topic,
  serverId,
}: {
  channelId: Id<"channels">
  channelName: string
  topic?: string
  serverId: Id<"servers">
}) {
  const members = useQuery(api.members.listForServer, { serverId })
  const mentionables: Mentionable[] = useMemo(
    () =>
      (members ?? []).map((m) => ({
        _id: m.userId,
        name: m.nickname ?? m.name,
        imageUrl: m.imageUrl,
      })),
    [members],
  )
  return (
    <ChatViewInner
      channelId={channelId}
      header={{ kind: "channel", name: channelName, topic, serverId }}
      mentionables={mentionables}
    />
  )
}

export function DmChatView({
  channelId,
  other,
}: {
  channelId: Id<"channels">
  other: {
    _id: Id<"users">
    name: string
    imageUrl?: string
    status: "online" | "idle" | "dnd" | "offline"
  }
}) {
  const mentionables: Mentionable[] = [
    { _id: other._id, name: other.name, imageUrl: other.imageUrl },
  ]
  return (
    <ChatViewInner
      channelId={channelId}
      header={{ kind: "dm", other }}
      mentionables={mentionables}
    />
  )
}

function ChatViewInner({
  channelId,
  header,
  mentionables,
}: {
  channelId: Id<"channels">
  header: ChatHeader
  mentionables: Mentionable[]
}) {
  const messages = useQuery(api.messages.list, { channelId, limit: 200 })
  const send = useMutation(api.messages.send)
  const createPoll = useMutation(api.polls.create)
  const generateUploadUrl = useMutation(api.files.generateUploadUrl)
  const markRead = useMutation(api.readState.markRead)
  const pingTyping = useMutation(api.typing.ping)
  const stopTyping = useMutation(api.typing.stop)
  const typing = useQuery(api.typing.list, { channelId })

  const [content, setContent] = useState("")
  const [sending, setSending] = useState(false)
  const [replyTo, setReplyTo] = useState<MessageDoc | null>(null)
  const [pending, setPending] = useState<UploadedAttachment[]>([])
  const [uploading, setUploading] = useState(0)
  const [mentions, setMentions] = useState<Set<Id<"users">>>(new Set())
  const [mentionAnchor, setMentionAnchor] = useState<{
    start: number
    query: string
  } | null>(null)
  const [mentionIdx, setMentionIdx] = useState(0)
  const [lightbox, setLightbox] = useState<{ url: string; name: string } | null>(null)
  const [recording, setRecording] = useState(false)
  const [slashIdx, setSlashIdx] = useState(0)

  const scrollRef = useRef<HTMLDivElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const lastTypingPingAt = useRef(0)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    if (distanceFromBottom < 200) {
      el.scrollTop = el.scrollHeight
    }
  }, [messages?.length])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
    setReplyTo(null)
    setPending([])
    setMentions(new Set())
    setMentionAnchor(null)
  }, [channelId])

  useEffect(() => {
    if (!messages || messages.length === 0) return
    if (typeof document !== "undefined" && document.hidden) return
    void markRead({ channelId }).catch(() => {})
  }, [channelId, messages, markRead])

  useEffect(() => {
    function onVisible() {
      if (!document.hidden) void markRead({ channelId }).catch(() => {})
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => document.removeEventListener("visibilitychange", onVisible)
  }, [channelId, markRead])

  function emitTyping() {
    const now = Date.now()
    if (now - lastTypingPingAt.current < 2500) return
    lastTypingPingAt.current = now
    void pingTyping({ channelId }).catch(() => {})
  }

  async function pickFiles(list: FileList | File[]) {
    const files = Array.from(list)
    if (files.length === 0) return
    const remaining = MAX_ATTACHMENTS - pending.length
    if (remaining <= 0) {
      toast.error(`Max ${MAX_ATTACHMENTS} attachments per message`)
      return
    }
    const accepted = files.slice(0, remaining)
    for (const f of accepted) {
      if (f.size > MAX_FILE_SIZE) {
        toast.error(`${f.name} is too large (max 10 MB)`)
        continue
      }
      setUploading((c) => c + 1)
      try {
        const url = await generateUploadUrl()
        const att = await uploadFile(url, f)
        setPending((p) => [...p, att])
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Upload failed")
      } finally {
        setUploading((c) => c - 1)
      }
    }
  }

  function onPaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const items = e.clipboardData?.items
    if (!items) return
    const files: File[] = []
    for (const it of Array.from(items)) {
      if (it.kind === "file") {
        const f = it.getAsFile()
        if (f) files.push(f)
      }
    }
    if (files.length > 0) {
      e.preventDefault()
      void pickFiles(files)
    }
  }

  async function onSend() {
    const text = content.trim()
    const hasAttachments = pending.length > 0

    if (text.startsWith("/") && !hasAttachments) {
      const parsed = parseSlash(text)
      if (parsed && parsed.kind === "error") {
        toast.error(parsed.message)
        return
      }
      if (parsed && parsed.kind === "poll") {
        try {
          await createPoll({
            channelId,
            question: parsed.question,
            options: parsed.options,
          })
          setContent("")
          setReplyTo(null)
          setMentions(new Set())
          setMentionAnchor(null)
          taRef.current?.focus()
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Failed")
        }
        return
      }
      if (parsed && parsed.kind === "send") {
        setContent(parsed.content)
        await onSendRaw(parsed.content)
        return
      }
    }

    if ((!text && !hasAttachments) || sending || uploading > 0) return
    await onSendRaw(text)
  }

  async function onSendRaw(text: string) {
    setSending(true)
    setContent("")
    setPending([])
    const replySnapshot = replyTo
    const mentionsSnapshot = [...mentions]
    setReplyTo(null)
    setMentions(new Set())
    setMentionAnchor(null)
    try {
      await send({
        channelId,
        content: text,
        replyToId: replySnapshot?._id,
        mentions:
          mentionsSnapshot.length > 0 ? mentionsSnapshot : undefined,
        attachments:
          pending.length > 0
            ? (pending.map((p) => ({
                storageId: p.storageId as Id<"_storage">,
                name: p.name,
                contentType: p.contentType,
                size: p.size,
                width: p.width,
                height: p.height,
              })) as never)
            : undefined,
      })
      void stopTyping({ channelId }).catch(() => {})
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send")
      setContent(text)
      setReplyTo(replySnapshot)
      setMentions(new Set(mentionsSnapshot))
    } finally {
      setSending(false)
      taRef.current?.focus()
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) void pickFiles(files)
  }

  function updateMentionAnchor(value: string, caret: number) {
    let i = caret - 1
    while (i >= 0 && /[\w@]/.test(value[i] ?? "") && value[i] !== "@") i--
    if (value[i] === "@") {
      const before = i === 0 || /\s/.test(value[i - 1] ?? "")
      if (before) {
        const query = value.slice(i + 1, caret)
        if (query.length <= 24) {
          setMentionAnchor({ start: i, query })
          setMentionIdx(0)
          return
        }
      }
    }
    setMentionAnchor(null)
  }

  function applyMention(user: Mentionable) {
    if (!mentionAnchor || !taRef.current) return
    const ta = taRef.current
    const before = content.slice(0, mentionAnchor.start)
    const after = content.slice(
      mentionAnchor.start + mentionAnchor.query.length + 1,
    )
    const insert = `@${user.name} `
    const next = `${before}${insert}${after}`
    setContent(next)
    setMentions((s) => new Set([...s, user._id]))
    setMentionAnchor(null)
    requestAnimationFrame(() => {
      const pos = before.length + insert.length
      ta.setSelectionRange(pos, pos)
      ta.focus()
    })
  }

  const filteredMentions = useMemo(() => {
    if (!mentionAnchor) return []
    const q = mentionAnchor.query.toLowerCase()
    const list = q
      ? mentionables.filter((m) => m.name.toLowerCase().includes(q))
      : mentionables
    return list.slice(0, 6)
  }, [mentionAnchor, mentionables])

  const slashSuggestions = useMemo(() => {
    if (!content.startsWith("/")) return []
    const head = content.slice(1).split(/\s/)[0] ?? ""
    if (content.includes(" ")) return []
    const q = head.toLowerCase()
    return SLASH_COMMANDS.filter((c) => c.name.startsWith(q)).slice(0, 6)
  }, [content])

  const grouped = useMemo(() => {
    if (!messages) return []
    const out: Array<
      | { kind: "msg"; msg: MessageDoc; showAuthor: boolean }
      | { kind: "divider"; key: string; label: string }
    > = []
    let lastDay = ""
    let lastAuthor = ""
    let lastTime = 0
    let lastReplyTarget = ""
    for (const m of messages) {
      const day = new Date(m._creationTime).toDateString()
      if (day !== lastDay) {
        out.push({ kind: "divider", key: `d-${day}`, label: day })
        lastDay = day
        lastAuthor = ""
      }
      const isReply = !!m.replyTo
      const showAuthor =
        isReply ||
        m.authorId !== lastAuthor ||
        m._creationTime - lastTime > 5 * 60 * 1000 ||
        m.replyTo?._id !== lastReplyTarget
      out.push({ kind: "msg", msg: m, showAuthor })
      lastAuthor = m.authorId
      lastTime = m._creationTime
      lastReplyTarget = m.replyTo?._id ?? ""
    }
    return out
  }, [messages])

  return (
    <div
      className="flex h-svh min-w-0 flex-1 flex-col bg-background"
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
    >
      <header className="flex h-12 shrink-0 items-center gap-1.5 border-b border-border/40 px-2 md:px-4">
        <MobileSidebarTrigger
          serverId={
            header.kind === "channel" ? header.serverId : undefined
          }
        />
        {header.kind === "channel" ? (
          <>
            <Hash className="size-5 shrink-0 text-muted-foreground" />
            <span className="truncate font-medium">{header.name}</span>
            {header.topic ? (
              <>
                <span className="mx-2 hidden h-4 w-px shrink-0 bg-border md:inline-block" />
                <span className="hidden truncate text-sm text-muted-foreground md:inline">
                  {header.topic}
                </span>
              </>
            ) : null}
          </>
        ) : (
          <>
            <div className="relative">
              <Avatar className="size-6">
                {header.other.imageUrl ? (
                  <AvatarImage src={header.other.imageUrl} />
                ) : null}
                <AvatarFallback className="text-[10px]">
                  {initialsFromName(header.other.name)}
                </AvatarFallback>
              </Avatar>
              <span
                className={cn(
                  "absolute -right-0.5 -bottom-0.5 size-2 rounded-full ring-2 ring-background",
                  STATUS_COLORS[header.other.status],
                )}
              />
            </div>
            <span className="truncate font-medium">{header.other.name}</span>
          </>
        )}
        <div className="ml-auto flex items-center gap-1">
          {header.kind === "channel" ? (
            <MobileMembersTrigger serverId={header.serverId} />
          ) : null}
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        {messages === undefined ? (
          <div className="grid h-full place-items-center text-sm text-muted-foreground">
            Loading messages…
          </div>
        ) : messages.length === 0 ? (
          <EmptyState header={header} />
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
                  onReply={(m) => setReplyTo(m)}
                  onOpenLightbox={setLightbox}
                />
              )
            })}
          </div>
        )}
      </div>

      <TypingRow typing={typing ?? []} />

      <div className="shrink-0 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-4 sm:pb-4">
        {replyTo ? <ReplyPreviewChip msg={replyTo} onClear={() => setReplyTo(null)} /> : null}
        {recording ? (
          <VoiceMessageRecorder
            onCancel={() => setRecording(false)}
            onSend={async (file) => {
              setRecording(false)
              try {
                const url = await generateUploadUrl()
                const att = await uploadFile(url, file)
                await send({
                  channelId,
                  content: "",
                  attachments: [
                    {
                      storageId: att.storageId as Id<"_storage">,
                      name: att.name,
                      contentType: att.contentType,
                      size: att.size,
                    },
                  ] as never,
                })
              } catch (err) {
                toast.error(
                  err instanceof Error ? err.message : "Failed to send",
                )
              }
            }}
          />
        ) : null}
        {pending.length > 0 || uploading > 0 ? (
          <PendingAttachmentsRow
            pending={pending}
            uploading={uploading}
            onRemove={(idx) =>
              setPending((p) => p.filter((_, i) => i !== idx))
            }
          />
        ) : null}
        <div className="relative rounded-xl border border-border/60 bg-card/40 backdrop-blur focus-within:border-primary/60 transition">
          <Textarea
            ref={taRef}
            value={content}
            onChange={(e) => {
              setContent(e.target.value)
              if (e.target.value.length > 0) emitTyping()
              const caret = e.target.selectionStart ?? e.target.value.length
              updateMentionAnchor(e.target.value, caret)
            }}
            onKeyDown={(e) => {
              if (slashSuggestions.length > 0) {
                if (e.key === "ArrowDown") {
                  e.preventDefault()
                  setSlashIdx((i) => (i + 1) % slashSuggestions.length)
                  return
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault()
                  setSlashIdx(
                    (i) =>
                      (i - 1 + slashSuggestions.length) %
                      slashSuggestions.length,
                  )
                  return
                }
                if (e.key === "Tab") {
                  e.preventDefault()
                  const cmd = slashSuggestions[slashIdx]!
                  setContent(`/${cmd.name} `)
                  return
                }
              }
              if (mentionAnchor && filteredMentions.length > 0) {
                if (e.key === "ArrowDown") {
                  e.preventDefault()
                  setMentionIdx(
                    (i) => (i + 1) % filteredMentions.length,
                  )
                  return
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault()
                  setMentionIdx(
                    (i) =>
                      (i - 1 + filteredMentions.length) %
                      filteredMentions.length,
                  )
                  return
                }
                if (e.key === "Enter" || e.key === "Tab") {
                  e.preventDefault()
                  applyMention(filteredMentions[mentionIdx]!)
                  return
                }
                if (e.key === "Escape") {
                  e.preventDefault()
                  setMentionAnchor(null)
                  return
                }
              }
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                onSend()
              }
              if (e.key === "Escape" && replyTo) {
                e.preventDefault()
                setReplyTo(null)
              }
            }}
            onPaste={onPaste}
            placeholder={
              header.kind === "channel"
                ? `Message #${header.name}`
                : `Message ${header.other.name}`
            }
            className="min-h-[44px] max-h-40 resize-none border-0 bg-transparent px-3 py-2.5 text-base shadow-none focus-visible:ring-0 sm:text-sm"
            rows={1}
          />
          {slashSuggestions.length > 0 ? (
            <div className="absolute bottom-full left-0 mb-1 w-72 overflow-hidden rounded-md border border-border bg-popover shadow-md">
              <div className="border-b border-border/40 bg-muted/40 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Slash commands · Tab to complete
              </div>
              {slashSuggestions.map((cmd, i) => (
                <button
                  key={cmd.name}
                  type="button"
                  onClick={() => setContent(`/${cmd.name} `)}
                  className={cn(
                    "flex w-full items-start gap-2 px-2 py-1.5 text-left",
                    i === slashIdx ? "bg-accent" : "hover:bg-accent/50",
                  )}
                >
                  <Terminal className="mt-0.5 size-3.5 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-xs">{cmd.hint}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {cmd.description}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : null}
          {mentionAnchor && filteredMentions.length > 0 ? (
            <div className="absolute bottom-full left-0 mb-1 w-64 overflow-hidden rounded-md border border-border bg-popover shadow-md">
              <div className="border-b border-border/40 bg-muted/40 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Members matching @{mentionAnchor.query}
              </div>
              {filteredMentions.map((m, i) => (
                <button
                  key={m._id}
                  type="button"
                  onClick={() => applyMention(m)}
                  className={cn(
                    "flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm",
                    i === mentionIdx ? "bg-accent" : "hover:bg-accent/50",
                  )}
                >
                  <Avatar className="size-5">
                    {m.imageUrl ? <AvatarImage src={m.imageUrl} /> : null}
                    <AvatarFallback className="text-[9px]">
                      {initialsFromName(m.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate">{m.name}</span>
                </button>
              ))}
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-2 px-2 pb-2">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                aria-label="Attach files"
                className="grid size-7 place-items-center rounded text-muted-foreground transition hover:bg-accent hover:text-foreground"
              >
                <Paperclip className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setRecording(true)}
                disabled={recording}
                aria-label="Record voice message"
                className="grid size-7 place-items-center rounded text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:opacity-50"
              >
                <Microphone className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setContent("/")}
                aria-label="Slash commands"
                className="grid size-7 place-items-center rounded text-muted-foreground transition hover:bg-accent hover:text-foreground"
              >
                <Terminal className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  const ta = taRef.current
                  if (!ta) return
                  const pos = ta.selectionStart ?? content.length
                  const before = content.slice(0, pos)
                  const after = content.slice(pos)
                  const next = `${before}@${after}`
                  setContent(next)
                  requestAnimationFrame(() => {
                    ta.focus()
                    ta.setSelectionRange(pos + 1, pos + 1)
                    setMentionAnchor({ start: pos, query: "" })
                  })
                }}
                aria-label="Mention"
                className="grid size-7 place-items-center rounded text-muted-foreground transition hover:bg-accent hover:text-foreground"
              >
                <At className="size-4" />
              </button>
              <input
                ref={fileRef}
                type="file"
                multiple
                hidden
                onChange={(e) => {
                  if (e.target.files) void pickFiles(e.target.files)
                  e.target.value = ""
                }}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden text-[11px] text-muted-foreground sm:inline">
                Enter to send · Shift+Enter for newline
              </span>
              <Button
                size="sm"
                onClick={onSend}
                disabled={
                  sending ||
                  uploading > 0 ||
                  (content.trim().length === 0 && pending.length === 0)
                }
                className="shrink-0"
              >
                <PaperPlaneRight className="size-4" />
                Send
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Lightbox
        open={!!lightbox}
        onClose={() => setLightbox(null)}
        url={lightbox?.url}
        name={lightbox?.name}
      />
    </div>
  )
}

function EmptyState({ header }: { header: ChatHeader }) {
  if (header.kind === "channel") {
    return (
      <div className="grid h-full place-items-center text-center">
        <div>
          <div className="mx-auto mb-3 grid size-14 place-items-center rounded-full bg-primary/10 text-primary">
            <Hash className="size-6" />
          </div>
          <h3 className="text-lg font-medium">Welcome to #{header.name}</h3>
          <p className="text-sm text-muted-foreground mt-1">
            This is the start of the channel. Say hi!
          </p>
        </div>
      </div>
    )
  }
  return (
    <div className="grid h-full place-items-center text-center">
      <div>
        <Avatar className="mx-auto size-16">
          {header.other.imageUrl ? (
            <AvatarImage src={header.other.imageUrl} />
          ) : null}
          <AvatarFallback>{initialsFromName(header.other.name)}</AvatarFallback>
        </Avatar>
        <h3 className="mt-3 text-lg font-medium">{header.other.name}</h3>
        <p className="text-sm text-muted-foreground mt-1">
          This is the start of your direct message history.
        </p>
      </div>
    </div>
  )
}

function TypingRow({
  typing,
}: {
  typing: { userId: Id<"users">; name: string }[]
}) {
  if (typing.length === 0) return null
  const names = typing.slice(0, 3).map((t) => t.name)
  const text =
    names.length === 1
      ? `${names[0]} is typing…`
      : names.length === 2
        ? `${names[0]} and ${names[1]} are typing…`
        : typing.length > 3
          ? `${names.join(", ")} and ${typing.length - 3} more are typing…`
          : `${names.join(", ")} are typing…`
  return (
    <div className="px-4 pb-1 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1">
        <span className="flex gap-0.5">
          <span className="size-1 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:-0.3s]" />
          <span className="size-1 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:-0.15s]" />
          <span className="size-1 rounded-full bg-muted-foreground/60 animate-bounce" />
        </span>
        {text}
      </span>
    </div>
  )
}

function ReplyPreviewChip({
  msg,
  onClear,
}: {
  msg: MessageDoc
  onClear: () => void
}) {
  return (
    <div className="mb-1 flex items-center gap-2 rounded-md border border-border/60 bg-muted/40 px-2 py-1 text-xs">
      <ArrowBendUpLeft className="size-3.5 text-muted-foreground" />
      <span className="text-muted-foreground">Replying to</span>
      <span className="font-medium">{msg.author?.name ?? "Unknown"}</span>
      <span className="truncate text-muted-foreground">{msg.content || "(attachment)"}</span>
      <button
        type="button"
        onClick={onClear}
        aria-label="Cancel reply"
        className="ml-auto grid size-5 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <X className="size-3.5" />
      </button>
    </div>
  )
}

function PendingAttachmentsRow({
  pending,
  uploading,
  onRemove,
}: {
  pending: UploadedAttachment[]
  uploading: number
  onRemove: (idx: number) => void
}) {
  return (
    <div className="mb-1 flex flex-wrap gap-2 rounded-md border border-dashed border-border/60 bg-muted/30 p-2">
      {pending.map((p, i) => (
        <div
          key={`${p.storageId}-${i}`}
          className="relative flex items-center gap-2 rounded-md border border-border/60 bg-background px-2 py-1 text-xs"
        >
          <Paperclip className="size-3 text-muted-foreground" />
          <span className="max-w-[160px] truncate">{p.name}</span>
          <span className="text-muted-foreground">
            {(p.size / 1024).toFixed(0)} KB
          </span>
          <button
            type="button"
            onClick={() => onRemove(i)}
            aria-label="Remove"
            className="grid size-4 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="size-3" />
          </button>
        </div>
      ))}
      {uploading > 0 ? (
        <span className="text-xs text-muted-foreground">
          Uploading {uploading}…
        </span>
      ) : null}
    </div>
  )
}

function MessageRow({
  msg,
  showAuthor,
  onReply,
  onOpenLightbox,
}: {
  msg: MessageDoc
  showAuthor: boolean
  onReply: (msg: MessageDoc) => void
  onOpenLightbox: (info: { url: string; name: string }) => void
}) {
  const me = useQuery(api.users.me)
  const editMutation = useMutation(api.messages.edit)
  const removeMutation = useMutation(api.messages.remove)
  const toggleReaction = useMutation(api.reactions.toggle)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(msg.content)

  const isAuthor = me?._id === msg.authorId
  const mentionsMe = me ? msg.mentions.some((m) => m._id === me._id) : false

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

  async function onReact(emoji: string) {
    try {
      await toggleReaction({ messageId: msg._id, emoji })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed")
    }
  }

  const wrapperClass = cn(
    "group relative rounded px-2 hover:bg-muted/40",
    mentionsMe && "border-l-2 border-amber-500 bg-amber-500/5 hover:bg-amber-500/10",
  )

  if (!showAuthor) {
    return (
      <div className={cn(wrapperClass, "flex items-start gap-3 py-0.5")}>
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
            <>
              <MessageContent msg={msg} />
              {msg.content.startsWith("📊 ") ? (
                <PollCard messageId={msg._id} />
              ) : null}
              <AttachmentList msg={msg} onOpenLightbox={onOpenLightbox} />
              <ReactionsRow reactions={msg.reactions} onReact={onReact} />
            </>
          )}
        </div>
        {!editing ? (
          <RowActions
            isAuthor={isAuthor}
            onEdit={() => {
              setEditing(true)
              setDraft(msg.content)
            }}
            onDelete={onDelete}
            onReply={() => onReply(msg)}
            onReact={onReact}
          />
        ) : null}
      </div>
    )
  }

  return (
    <div className={cn(wrapperClass, "mt-3 py-1")}>
      {msg.replyTo ? (
        <div className="ml-12 flex items-center gap-1.5 text-xs text-muted-foreground">
          <ArrowBendUpLeft className="size-3.5" />
          <span className="font-medium text-foreground/80">
            {msg.replyTo.author?.name ?? "Unknown"}
          </span>
          <span className="truncate">{msg.replyTo.content || "(attachment)"}</span>
        </div>
      ) : null}
      <div className="flex items-start gap-3">
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
            <>
              <MessageContent msg={msg} />
              {msg.content.startsWith("📊 ") ? (
                <PollCard messageId={msg._id} />
              ) : null}
              <AttachmentList msg={msg} onOpenLightbox={onOpenLightbox} />
              <ReactionsRow reactions={msg.reactions} onReact={onReact} />
            </>
          )}
        </div>
        {!editing ? (
          <RowActions
            isAuthor={isAuthor}
            onEdit={() => {
              setEditing(true)
              setDraft(msg.content)
            }}
            onDelete={onDelete}
            onReply={() => onReply(msg)}
            onReact={onReact}
          />
        ) : null}
      </div>
    </div>
  )
}

function MessageContent({ msg }: { msg: MessageDoc }) {
  const me = useQuery(api.users.me)
  const myId = me?._id
  const myName = me?.name
  const isMe = msg.content.startsWith("/me ")
  const isPoll = msg.content.startsWith("📊 ")
  const body = isMe ? msg.content.slice(4) : msg.content
  const segments = useMemo(
    () => parseMentions(body, msg.mentions, myId, myName),
    [body, msg.mentions, myId, myName],
  )
  if (isPoll || msg.content.length === 0) return null
  return (
    <div
      className={cn(
        "text-sm leading-snug whitespace-pre-wrap break-words",
        isMe && "italic text-muted-foreground",
      )}
    >
      {isMe ? (
        <span className="mr-1 font-semibold text-foreground">
          * {msg.author?.name ?? "Someone"}
        </span>
      ) : null}
      {segments.map((s, i) =>
        s.kind === "mention" ? (
          <span
            key={i}
            className={cn(
              "rounded px-1 font-medium",
              s.mine
                ? "bg-amber-500/30 text-amber-700 dark:text-amber-300"
                : "bg-primary/15 text-primary",
            )}
          >
            @{s.name}
          </span>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
      {msg.editedAt ? (
        <span className="ml-1 text-[10px] text-muted-foreground">(edited)</span>
      ) : null}
    </div>
  )
}

function parseMentions(
  content: string,
  mentions: { _id: Id<"users">; name: string }[],
  myId?: Id<"users">,
  _myName?: string,
): Array<
  | { kind: "text"; text: string }
  | { kind: "mention"; name: string; mine: boolean }
> {
  if (mentions.length === 0) return [{ kind: "text", text: content }]
  const sortedNames = [...mentions]
    .map((m) => m.name)
    .sort((a, b) => b.length - a.length)
  const escaped = sortedNames.map((n) => n.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&"))
  const re = new RegExp(`@(${escaped.join("|")})\\b`, "g")
  const out: Array<
    | { kind: "text"; text: string }
    | { kind: "mention"; name: string; mine: boolean }
  > = []
  let last = 0
  let m
  while ((m = re.exec(content)) !== null) {
    if (m.index > last) {
      out.push({ kind: "text", text: content.slice(last, m.index) })
    }
    const name = m[1]!
    const target = mentions.find((x) => x.name === name)
    out.push({
      kind: "mention",
      name,
      mine: !!myId && target?._id === myId,
    })
    last = m.index + m[0].length
  }
  if (last < content.length) {
    out.push({ kind: "text", text: content.slice(last) })
  }
  return out.length > 0 ? out : [{ kind: "text", text: content }]
}

function AttachmentList({
  msg,
  onOpenLightbox,
}: {
  msg: MessageDoc
  onOpenLightbox: (info: { url: string; name: string }) => void
}) {
  if (msg.attachments.length === 0) return null
  return (
    <div className="mt-1 flex flex-wrap gap-2">
      {msg.attachments.map((a, i) => {
        if (!a.url) {
          return (
            <span
              key={`${msg._id}-att-${i}`}
              className="text-xs text-muted-foreground"
            >
              (deleted attachment)
            </span>
          )
        }
        const isImage = a.contentType.startsWith("image/")
        const isAudio = a.contentType.startsWith("audio/")
        if (isAudio) {
          return (
            <VoiceMessage
              key={`${msg._id}-att-${i}`}
              url={a.url}
              size={a.size}
            />
          )
        }
        if (isImage) {
          return (
            <button
              key={`${msg._id}-att-${i}`}
              type="button"
              onClick={() =>
                onOpenLightbox({ url: a.url!, name: a.name })
              }
              className="block overflow-hidden rounded-md border border-border/60 bg-muted/40 transition hover:border-primary/40"
            >
              <img
                src={a.url}
                alt={a.name}
                className="max-h-72 max-w-sm object-contain"
                loading="lazy"
              />
            </button>
          )
        }
        return (
          <a
            key={`${msg._id}-att-${i}`}
            href={a.url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs hover:border-primary/40"
          >
            <Paperclip className="size-4 text-muted-foreground" />
            <span className="flex flex-col">
              <span className="font-medium">{a.name}</span>
              <span className="text-muted-foreground">
                {(a.size / 1024).toFixed(0)} KB
              </span>
            </span>
          </a>
        )
      })}
    </div>
  )
}

function ReactionsRow({
  reactions,
  onReact,
}: {
  reactions: MessageDoc["reactions"]
  onReact: (emoji: string) => void
}) {
  if (reactions.length === 0) return null
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {reactions.map((r) => (
        <button
          key={r.emoji}
          type="button"
          onClick={() => onReact(r.emoji)}
          className={cn(
            "flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs transition",
            r.mine
              ? "border-primary/50 bg-primary/15 text-primary"
              : "border-border/60 bg-muted/30 text-muted-foreground hover:border-primary/40",
          )}
          title={r.mine ? "Click to remove" : undefined}
        >
          <span>{r.emoji}</span>
          <span className="tabular-nums">{r.count}</span>
        </button>
      ))}
    </div>
  )
}

function RowActions({
  isAuthor,
  onEdit,
  onDelete,
  onReply,
  onReact,
}: {
  isAuthor: boolean
  onEdit: () => void
  onDelete: () => void
  onReply: () => void
  onReact: (emoji: string) => void
}) {
  return (
    <div className="absolute -top-3 right-3 hidden gap-1 rounded-md border bg-background p-0.5 shadow-sm group-hover:flex">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="grid size-7 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="React"
          >
            <Smiley className="size-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="p-2">
          <div className="grid grid-cols-5 gap-1">
            {REACTION_PICKER.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => onReact(e)}
                className="grid size-8 place-items-center rounded-md text-lg transition hover:bg-accent"
              >
                {e}
              </button>
            ))}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
      <button
        onClick={onReply}
        className="grid size-7 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label="Reply"
      >
        <ArrowBendUpLeft className="size-3.5" />
      </button>
      {isAuthor ? (
        <>
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
        </>
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

function Lightbox({
  open,
  onClose,
  url,
  name,
}: {
  open: boolean
  onClose: () => void
  url?: string
  name?: string
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl border-0 bg-transparent p-0 shadow-none">
        <DialogTitle className="sr-only">{name ?? "Image"}</DialogTitle>
        {url ? (
          <img
            src={url}
            alt={name ?? "Image"}
            className="max-h-[85vh] w-auto rounded-lg object-contain"
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
