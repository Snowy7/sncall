export type SlashCommand = {
  name: string
  hint: string
  description: string
}

export const SLASH_COMMANDS: SlashCommand[] = [
  { name: "me", hint: "/me <action>", description: "Italic third-person action" },
  { name: "shrug", hint: "/shrug [text]", description: "Append ¯\\_(ツ)_/¯" },
  { name: "tableflip", hint: "/tableflip [text]", description: "Append (╯°□°)╯︵ ┻━┻" },
  { name: "unflip", hint: "/unflip [text]", description: "Append ┬─┬ノ( º _ ºノ)" },
  { name: "roll", hint: "/roll <NdM>", description: "Roll dice (e.g. /roll 2d20)" },
  {
    name: "poll",
    hint: "/poll Question | Option | Option [| ...]",
    description: "Create a poll (2–8 options)",
  },
]

export type SlashTransform =
  | { kind: "send"; content: string }
  | { kind: "poll"; question: string; options: string[] }
  | { kind: "error"; message: string }
  | { kind: "noop" }

export function parseSlash(input: string): SlashTransform | null {
  const trimmed = input.trimStart()
  if (!trimmed.startsWith("/")) return null
  const space = trimmed.indexOf(" ")
  const name = (space === -1 ? trimmed.slice(1) : trimmed.slice(1, space)).toLowerCase()
  const rest = space === -1 ? "" : trimmed.slice(space + 1).trim()
  switch (name) {
    case "me": {
      if (!rest) return { kind: "error", message: "/me needs an action" }
      return { kind: "send", content: `/me ${rest}` }
    }
    case "shrug":
      return { kind: "send", content: `${rest ? rest + " " : ""}¯\\_(ツ)_/¯` }
    case "tableflip":
      return {
        kind: "send",
        content: `${rest ? rest + " " : ""}(╯°□°)╯︵ ┻━┻`,
      }
    case "unflip":
      return { kind: "send", content: `${rest ? rest + " " : ""}┬─┬ノ( º _ ºノ)` }
    case "roll": {
      const m = rest.match(/^(\d{1,2})d(\d{1,3})$/i)
      if (!m) return { kind: "error", message: "Usage: /roll NdM (e.g. /roll 2d6)" }
      const n = Math.max(1, Math.min(20, parseInt(m[1]!, 10)))
      const d = Math.max(2, Math.min(120, parseInt(m[2]!, 10)))
      const rolls: number[] = []
      for (let i = 0; i < n; i++) rolls.push(1 + Math.floor(Math.random() * d))
      const sum = rolls.reduce((a, b) => a + b, 0)
      const detail = n === 1 ? `${rolls[0]}` : `${rolls.join(" + ")} = ${sum}`
      return { kind: "send", content: `🎲 rolled ${n}d${d}: ${detail}` }
    }
    case "poll": {
      const parts = rest.split("|").map((p) => p.trim()).filter(Boolean)
      if (parts.length < 3) {
        return {
          kind: "error",
          message: "Usage: /poll Question | Option A | Option B",
        }
      }
      const [question, ...options] = parts
      return { kind: "poll", question: question!, options }
    }
    default:
      return { kind: "error", message: `Unknown command: /${name}` }
  }
}
