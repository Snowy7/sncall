import { useQuery, useMutation } from "convex/react"
import { api, type Id } from "@/lib/api"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Copy, ArrowsClockwise } from "@phosphor-icons/react"
import { toast } from "sonner"
import { useState } from "react"

export function InviteDialog({
  serverId,
  open,
  onOpenChange,
}: {
  serverId: Id<"servers">
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const server = useQuery(api.servers.get, { serverId })
  const regenerate = useMutation(api.servers.regenerateInvite)
  const [pending, setPending] = useState(false)

  const baseUrl = typeof window !== "undefined" ? window.location.origin : ""
  const link = server?.inviteCode ? `${baseUrl}/invite/${server.inviteCode}` : ""

  async function copy() {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      toast.success("Invite link copied")
    } catch {
      toast.error("Couldn't copy")
    }
  }

  async function rotate() {
    if (pending) return
    setPending(true)
    try {
      await regenerate({ serverId })
      toast.success("New invite generated")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed")
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite people to {server?.name}</DialogTitle>
          <DialogDescription>
            Share this link with someone to invite them to your server.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2">
          <Input readOnly value={link} className="font-mono text-xs" />
          <Button onClick={copy} size="icon" variant="outline" aria-label="Copy">
            <Copy className="size-4" />
          </Button>
        </div>
        {server?.role === "owner" && (
          <Button
            onClick={rotate}
            variant="outline"
            disabled={pending}
            className="w-full"
          >
            <ArrowsClockwise className="size-4" />
            {pending ? "Generating…" : "Generate new link"}
          </Button>
        )}
      </DialogContent>
    </Dialog>
  )
}
