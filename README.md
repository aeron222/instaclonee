# InstaClone

A dark-premium Instagram-style social app with a local Express + sql.js (SQLite/WASM) backend and a protected administrator console.

## Requirements
- Node.js 20 or newer (no Visual Studio C++ workload required)
- npm

## Run locally
1. Extract the ZIP.
2. Open the `instaclone` folder in VS Code.
3. Open Terminal in that folder.
4. Run `npm install`.
5. Copy `.env.example` to `.env`.
6. Change `ADMIN_PASSWORD` and `SESSION_SECRET` in `.env`.
7. Run `npm run dev`.
8. Open http://localhost:5173

The API runs on http://localhost:4000. SQLite is powered by sql.js (WebAssembly), so npm install does not compile native C++ modules.

## Admin login
- Open http://localhost:5173/admin (the app will show the sign-in page; use the admin account).
- Default username: `admin`
- Default password: `ChangeThisAdminPassword123!`
- Change the password in `.env` before using the app beyond local testing. The admin account is seeded when the database is first created.

## Included
- User registration and sign-in
- Password hashing with bcrypt
- Server-side sessions and protected admin routes
- Image posts, feed, likes and comments
- Profile bio editing and follow/unfollow API
- Admin summary, user search, suspend/reactivate/delete
- Sign-in history showing device category, browser and OS
- Three consecutive failed password attempts trigger a 15-minute account lockout
- Admin-only login security events showing attempted username/email, attempt count, device category, browser, OS and timestamp
- SQLite database stored in `server/data/instaclone.sqlite`
- Uploaded images stored in `server/uploads`

## Device-data notice
At sign-in, the server reads the browser's User-Agent header to infer a broad device category, browser and operating system. It stores those details and the sign-in timestamp for the account and displays them in the administrator console. User-Agent details can be inaccurate and do not provide a unique device identity. This app does not collect ISP, GPS location, contacts, files, camera data or hidden device identifiers. Failed login events never store submitted passwords. A lockout applies to the account being tested, not the entire website.

## Windows install troubleshooting
If npm previously failed, close VS Code terminals and any Node processes, then delete the `node_modules` folder and `package-lock.json` before running `npm install` again. If Windows says files are in use, restart Windows and retry. Multer 2.x is used; the native `better-sqlite3` dependency has been removed.

## Production checklist
This starter is configured for local development. Before public deployment:
- Set a long random `SESSION_SECRET` and a strong unique admin password.
- Serve over HTTPS and set `NODE_ENV=production`.
- Replace Express's default in-memory session store with a persistent production session store.
- Configure trusted origins, secure cookie settings, backups, upload limits and database/file persistence.
- Add CSRF protection and review applicable privacy/retention requirements.
- Do not expose the SQLite file or uploads directory for direct write access.

## Notes
This is an original Instagram-inspired implementation, not affiliated with Instagram or Meta. Some navigation items (Explore, Messages and Notifications) are UI placeholders; core account, feed, post, like, comment and admin flows are functional.


### ISP and approximate location (optional consent)
During registration, users must explicitly consent before the server performs an IP-based lookup for ISP and approximate city/region/country. The app does not request GPS/browser geolocation and does not store the raw IP address in the database. The lookup uses the public IP observed by the server and the ipwho.is service; provider results may be unavailable or inaccurate. Local/private network IPs (for example 10.x.x.x or 192.168.x.x) cannot be geolocated directly. During local/LAN development only, the app falls back to the server's public internet egress and labels it as a shared-network estimate; this may represent a school, office or home Wi-Fi connection, not the individual device. In production, configure a trusted reverse proxy to forward the real public client IP; do not enable TRUST_PROXY unless that proxy is actually in front of the app. Set `TRUST_PROXY=1` only when the app is behind exactly one trusted reverse proxy; otherwise leave it disabled so spoofed forwarding headers are not trusted.


### IP address and approximate map location

When a user explicitly consents during registration, the server records the client IP it observes for admin security review. Public IP geolocation may provide ISP, city/region/country, and approximate coordinates. Admins can open those coordinates in Google Maps. The marker represents an IP/network estimate (often an ISP gateway or shared Wi-Fi egress), not the person's exact physical location. Private LAN addresses cannot be geolocated; in local development the fallback may show the shared network's approximate location. No GPS is collected.


### IP address display correction
In LAN development, the API may see the Vite proxy's loopback/private address (such as `::1`) instead of the browser's public address. The admin table now displays the public internet egress IP returned by the network lookup for shared-network fallback sessions. This is the public IP of the shared Wi-Fi/office/school connection, not a unique device IP. For direct public-client requests behind a reverse proxy, configure `TRUST_PROXY=1` only when exactly one trusted proxy is in front of the API. Older sign-in records containing `::1` are not rewritten; a new sign-in is required to record the corrected value.


### Client LAN IP and public IP display
The admin dashboard separates the client address observed by the app from the public internet egress address. In local-network testing, Vite forwards the client's LAN address to Express and Express trusts only its loopback proxy; for example, the admin may see `10.199.101.100` as the device/network IP and a different public egress IP shared by the Wi-Fi network. This is not the Wi-Fi router's gateway address and does not identify a person or exact physical position. A browser cannot reliably expose its own private address without a separately installed client agent; this value is the network address observed by the server through the local proxy. Public IP geolocation remains approximate.

### Admin dashboard network map and IP columns
The administrator overview includes an embedded OpenStreetMap/Leaflet map. It plots the latest available public-IP geolocation coordinates for each account returned in the user list. The user table separately displays the client/local-network IP observed by the local Vite-to-Express proxy and the public internet egress IP. On your Wi-Fi, the local/client value may be `10.199.101.100`, while the public IP is the shared address used by the Wi-Fi network. Browser-only pages cannot independently read private LAN addresses reliably; this value is observed by the server through the local development proxy. Map markers represent approximate public-IP/network locations, not exact device GPS. The map requires an internet connection to load Leaflet and OpenStreetMap tiles. Existing users will appear only if their latest sign-in has location coordinates; have them sign in again after updating if their previous record has no coordinates.
