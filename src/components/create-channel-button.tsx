import { useState } from "react"
import { useMutation } from "convex/react"
import { useNavigate } from "@tanstack/react-router"
import { api, type Id } from "@/lib/api"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Hash, SpeakerHigh } from "@phosphor-icons/react"
import { toast } from "sonner"

export function CreateChannelButton({
  serverId,
  defaultType = "text",
  children,
}: {
  serverId: Id<"servers">
  defaultType?: "text" | "voice"
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [type, setType] = useState<"text" | "voice">(defaultType)
  const [pending, setPending] = useState(false)
  const create = useMutation(api.channels.create)
  const navigate = useNavigate()

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (pending) return
    setPending(true)
    try {
      const id = await create({ serverId, name: name.trim(), type })
      setOpen(false)
      setName("")
      navigate({
        to: "/app/$serverId/$channelId",
        params: { serverId, channelId: id },
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create channel")
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (o) setType(defaultType)
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create a channel</DialogTitle>
          <DialogDescription>
            Channels are where conversations happen.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Channel type</Label>
            <div className="grid grid-cols-2 gap-2">
              <TypeOption
                active={type === "text"}
                onClick={() => setType("text")}
                icon={<Hash className="size-4" />}
                label="Text"
                desc="Send messages"
              />
              <TypeOption
                active={type === "voice"}
                onClick={() => setType("voice")}
                icon={<SpeakerHigh className="size-4" />}
                label="Voice"
                desc="Talk together"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="channel-name">Channel name</Label>
            <Input
              id="channel-name"
              placeholder={type === "text" ? "new-channel" : "Voice room"}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              maxLength={50}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending || name.trim().length === 0}>
              {pending ? "Creating…" : "Create channel"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function TypeOption({
  active,
  onClick,
  icon,
  label,
  desc,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  desc: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-start gap-3 rounded-lg border p-3 text-left transition ${
        active
          ? "border-primary bg-primary/5"
          : "border-border hover:bg-muted/50"
      }`}
    >
      <div
        className={`grid size-8 place-items-center rounded-md ${
          active ? "bg-primary text-primary-foreground" : "bg-muted"
        }`}
      >
        {icon}
      </div>
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
    </button>
  )
}
