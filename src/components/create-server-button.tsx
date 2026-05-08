import { useState } from "react"
import { useMutation } from "convex/react"
import { useNavigate } from "@tanstack/react-router"
import { api } from "@/lib/api"
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
import { toast } from "sonner"

export function CreateServerButton({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<"create" | "join">("create")
  const [name, setName] = useState("")
  const [imageUrl, setImageUrl] = useState("")
  const [code, setCode] = useState("")
  const [pending, setPending] = useState(false)
  const create = useMutation(api.servers.create)
  const join = useMutation(api.servers.joinByInviteCode)
  const navigate = useNavigate()

  async function onCreate(e: React.FormEvent) {
    e.preventDefault()
    if (pending) return
    setPending(true)
    try {
      const id = await create({ name: name.trim(), imageUrl: imageUrl.trim() || undefined })
      setOpen(false)
      setName("")
      setImageUrl("")
      navigate({ to: "/app/$serverId", params: { serverId: id } })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create server")
    } finally {
      setPending(false)
    }
  }

  async function onJoin(e: React.FormEvent) {
    e.preventDefault()
    if (pending) return
    setPending(true)
    try {
      const id = await join({ code: code.trim() })
      setOpen(false)
      setCode("")
      navigate({ to: "/app/$serverId", params: { serverId: id } })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid invite")
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{tab === "create" ? "Create a server" : "Join a server"}</DialogTitle>
          <DialogDescription>
            {tab === "create"
              ? "Servers are where you and your friends hang out."
              : "Enter an invite code to join an existing server."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-1 rounded-lg bg-muted p-1 text-sm">
          <button
            type="button"
            onClick={() => setTab("create")}
            className={`flex-1 rounded-md px-3 py-1.5 transition ${
              tab === "create" ? "bg-background shadow-sm" : "text-muted-foreground"
            }`}
          >
            Create
          </button>
          <button
            type="button"
            onClick={() => setTab("join")}
            className={`flex-1 rounded-md px-3 py-1.5 transition ${
              tab === "join" ? "bg-background shadow-sm" : "text-muted-foreground"
            }`}
          >
            Join with invite
          </button>
        </div>

        {tab === "create" ? (
          <form onSubmit={onCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="server-name">Server name</Label>
              <Input
                id="server-name"
                placeholder="My awesome server"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                maxLength={50}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="server-image">Icon URL (optional)</Label>
              <Input
                id="server-image"
                placeholder="https://…"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={pending || name.trim().length < 2}>
                {pending ? "Creating…" : "Create server"}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <form onSubmit={onJoin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invite-code">Invite code</Label>
              <Input
                id="invite-code"
                placeholder="abc12345"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={pending || code.trim().length === 0}>
                {pending ? "Joining…" : "Join server"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
