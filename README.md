# PushUp

Auto-upload files to FTP/SFTP servers on save. Manual upload and download of files and folders via context menus.

## Features

- **Upload on save** — automatically uploads files when you save
- **SFTP & FTP** — supports both protocols
- **Context menus** — right-click files or folders to upload/download
- **Ignore patterns** — glob patterns to skip files (uses picomatch)
- **Connection pooling** — reuses connections with 30s idle timeout
- **Password prompting** — securely prompts for passwords, cached per session

## Quick Start

1. Install the extension
2. Run **PushUp: Initialize Configuration** from the command palette (`Ctrl+Shift+P`)
3. Edit the generated `.pushup.json` with your server details
4. Save a file — it uploads automatically

## Configuration

Create a `.pushup.json` in your project root:

```json
{
  "protocol": "sftp",
  "host": "example.com",
  "port": 22,
  "username": "deploy",
  "password": "",
  "privateKeyPath": "",
  "remotePath": "/var/www/html",
  "uploadOnSave": true,
  "ignore": [
    ".git/**",
    "node_modules/**"
  ]
}
```

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `protocol` | Yes | — | `"sftp"` or `"ftp"` |
| `host` | Yes | — | Server hostname |
| `port` | No | 22/21 | Port (defaults based on protocol) |
| `username` | Yes | — | Login username |
| `password` | No | — | Password (prompted if missing) |
| `privateKeyPath` | No | — | Path to SSH private key (SFTP only) |
| `passphrase` | No | — | Passphrase for private key |
| `remotePath` | Yes | — | Remote directory path |
| `uploadOnSave` | No | `true` | Auto-upload on file save |
| `ignore` | No | see below | Glob patterns to ignore |

**Default ignore patterns** (always included): `.git/**`, `.vscode/**`, `node_modules/**`, `.pushup.json`

## Commands

| Command | Description |
|---------|-------------|
| PushUp: Initialize Configuration | Create a `.pushup.json` template |
| PushUp: Upload File | Upload the current file |
| PushUp: Download File | Download the remote version of the current file |
| PushUp: Upload Folder | Upload all files in a folder |
| PushUp: Download Folder | Download all files from a remote folder |
| PushUp: Show Output | Open the PushUp output channel |

## Troubleshooting

- **"No .pushup.json found"** — Make sure `.pushup.json` exists in a parent directory of the file you're working with.
- **Connection timeouts** — Check host, port, and firewall settings. SFTP connections timeout after 10 seconds.
- **Files not uploading on save** — Verify `uploadOnSave` is `true` and the file doesn't match an ignore pattern.
- **Password prompt keeps appearing** — Passwords are cached for the session. If the connection drops, you may be re-prompted.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for dev setup and guidelines.

## License

MIT
