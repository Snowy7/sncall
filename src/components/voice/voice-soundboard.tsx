import { useState } from "react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MusicNotes } from "@phosphor-icons/react"
import { useVoice } from "./voice-provider"
import { SFX_PRESETS } from "./voice-sfx"

export function SoundboardControl() {
  const voice = useVoice()
  const [open, setOpen] = useState(false)
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Soundboard"
          title="Soundboard"
          className="grid size-12 place-items-center rounded-full border border-border/60 bg-card transition hover:bg-accent"
        >
          <MusicNotes className="size-5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" side="top" className="w-64 p-2">
        <DropdownMenuLabel className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Soundboard
        </DropdownMenuLabel>
        <div className="grid grid-cols-2 gap-1">
          {SFX_PRESETS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => voice.emitSfx(s.id)}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition hover:bg-accent"
            >
              <span className="text-base">{s.emoji}</span>
              <span>{s.label}</span>
            </button>
          ))}
        </div>
        <p className="mt-2 px-2 text-[10px] text-muted-foreground">
          Plays for everyone in the call.
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
