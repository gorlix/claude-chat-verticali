declare module 'claude-code' {
  // One entry of `claude agents --json`, as hooks/panel.ts `Live` (kept self-contained).
  type ChatVerticaliLive = {
    sessionId: string
    id?: string
    name?: string
    kind?: string
    status?: string
    waitingFor?: string
    state?: string
    pid?: number
    cwd?: string
    startedAt?: number
  }

  interface PluginState {
    'chat-verticali': {
      // Bumped to redraw the hub pane after a registry change.
      tick: number
      // Last read of `claude agents --json` and of the tagged tmux windows.
      snap: {
        live: ChatVerticaliLive[]
        windows: Record<string, string>
        at: number
      }
    }
  }
}
