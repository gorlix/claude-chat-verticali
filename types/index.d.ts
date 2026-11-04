declare module 'claude-code' {
  interface PluginState {
    'chat-verticali': {
      // Bumped to redraw the hub pane after a registry change.
      tick: number
      // Last read of `claude agents --json` and of the tagged tmux windows.
      snap: {
        live: import('../hooks/panel').Live[]
        windows: Record<string, string>
        at: number
      }
    }
  }
}
