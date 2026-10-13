# QuickShare

Simple file sharing: upload once, download anytime via an unguessable link or file ID.

- **Frontend:** React + TypeScript + Vite, Tailwind CSS, shadcn/ui (Radix), Lucide, Sonner toasts
- **Backend:** Node.js + Express 5, MySQL/MariaDB (`mysql2`), Multer
- **Storage:** server filesystem, outside any public web root (`server/storage` by default)

## How it works

- Each upload gets a 144-bit random **file ID** (24 chars). The download link is `/api/files/<id>/download`; anyone with the link can download until it expires.
- Files are stored on disk under random server-generated names; the original filename lives only in the DB.
- **Ownership:** no accounts. Each browser generates a random owner token (kept in `localStorage`, no file data). Only its SHA-256 hash is stored. The token is required to list and delete your files. Clearing browser storage means you lose the ability to list/delete (links still work).
- Expired files return `410` and are removed by a cleanup job.

## API

| Method | Path | Description |
|---|---|---|
| GET | `/api/config` | Limits, allowed extensions, expiry |
| POST | `/api/files` | Upload (`multipart`, field `files`, header `X-Owner-Token`) |
| GET | `/api/files?q=&sort=newest\|oldest\|name` | List your files |
| GET | `/api/files/:id` | File metadata |
| GET | `/api/files/:id/download` | Download |
| DELETE | `/api/files/:id` | Delete (owner only) |
| GET | `/api/health` | Health check |

Errors: `{ "error": { "code", "message" } }`. Internal errors and paths are never exposed.

## Local development

Requires Node 18+ and MySQL/MariaDB.

```bash
cd server
npm install
cp .env.example .env        # edit DB_* values
npm run migrate             # creates database + tables
npm run dev                 # API on :4000

cd ../client
npm install
npm run dev                 # UI on :5173 (proxies /api to :4000)
```

For dev set `CORS_ORIGIN=http://localhost:5173` only if you bypass the Vite proxy.

## Configuration (`server/.env`)

See [server/.env.example](server/.env.example). Key settings:

```ini
MAX_FILE_SIZE_MB=100        # per-file limit (enforced on client and server)
FILE_EXPIRY_HOURS=168       # 7 days; 0 = never expire
CLEANUP_INTERVAL_MINUTES=60 # in-process cleanup; 0 = disable, use cron instead
ALLOWED_EXTENSIONS=jpg,png,pdf,docx,zip,mp4   # optional allowlist override
```

Executables, scripts, HTML and SVG are always blocked regardless of the allowlist. Double extensions (`a.php.txt`) and executable content disguised by extension are rejected.

## Deploy on a Linux VPS (Ubuntu/Debian)

### 1. Install packages

```bash
sudo apt update
sudo apt install -y nginx mariadb-server git
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### 2. Database

```bash
sudo mysql -e "CREATE DATABASE quickshare CHARACTER SET utf8mb4;
CREATE USER 'quickshare'@'localhost' IDENTIFIED BY 'STRONG_PASSWORD';
GRANT ALL ON quickshare.* TO 'quickshare'@'localhost';"
```

### 3. App

```bash
sudo useradd -r -m -d /opt/quickshare quickshare
sudo -u quickshare git clone <your-repo> /opt/quickshare/app   # or upload the project
cd /opt/quickshare/app/client && sudo -u quickshare npm ci && sudo -u quickshare npm run build
cd ../server && sudo -u quickshare npm ci --omit=dev
sudo -u quickshare cp .env.example .env && sudo -u quickshare nano .env
```

In `.env` set `DB_*`, `PUBLIC_URL=https://files.example.com`, `TRUST_PROXY=true`, and
`STORAGE_DIR=/var/lib/quickshare` (outside the web root):

```bash
sudo mkdir -p /var/lib/quickshare && sudo chown quickshare: /var/lib/quickshare && sudo chmod 700 /var/lib/quickshare
sudo -u quickshare npm run migrate
```

### 4. systemd service

`/etc/systemd/system/quickshare.service`:

```ini
[Unit]
Description=QuickShare
After=network.target mariadb.service

[Service]
User=quickshare
WorkingDirectory=/opt/quickshare/app/server
ExecStart=/usr/bin/node src/index.js
Restart=on-failure
Environment=NODE_ENV=production
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=/var/lib/quickshare
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload && sudo systemctl enable --now quickshare
```

### 5. nginx reverse proxy

`/etc/nginx/sites-available/quickshare`:

```nginx
server {
    listen 80;
    server_name files.example.com;
    client_max_body_size 110m;      # a bit above MAX_FILE_SIZE_MB

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_request_buffering off;
        proxy_read_timeout 300s;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/quickshare /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo apt install -y certbot python3-certbot-nginx && sudo certbot --nginx -d files.example.com
```

### 6. Expired-file cleanup

The server runs cleanup hourly by default. To use cron instead, set `CLEANUP_INTERVAL_MINUTES=0` and add:

```cron
0 * * * * cd /opt/quickshare/app/server && /usr/bin/node scripts/cleanup.js
```

### 7. Updating

```bash
cd /opt/quickshare/app && git pull
cd client && npm ci && npm run build
cd ../server && npm ci --omit=dev && npm run migrate
sudo systemctl restart quickshare
```

## Security notes

- Server-side validation of size, extension allowlist and content type; client-side checks are a convenience only.
- Random server filenames, hashed-prefix directories, path traversal impossible (IDs are regex-validated, paths built from hex names).
- Downloads are always `Content-Disposition: attachment` with `nosniff`; uploaded files are never executed or served from a public directory.
- Helmet headers, per-IP rate limits (general and upload), request validation with zod.
- Secrets live in `.env` (git-ignored).
- Back up both the database and `STORAGE_DIR`.
