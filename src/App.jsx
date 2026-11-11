
import React, { useEffect, useRef, useState } from 'react';
import {
  Home, Search, Compass, Heart, PlusSquare, UserRound, Settings,
  LogOut, Shield, Camera, MessageCircle, Bookmark, MoreHorizontal,
  ImagePlus, X, Menu, Users, Activity, Monitor, Smartphone, Laptop,
  Trash2, Ban, CheckCircle2, ChevronRight, Sparkles
} from 'lucide-react';

// ============================================
// API CONFIGURATION
// ============================================

// Use same-origin API paths. Vercel rewrites /api and /uploads to Render in
// production, while Vite's dev proxy handles them locally. This keeps the
// session cookie first-party in the browser.

const api = async (url, options = {}) => {
  const headers = options.body instanceof FormData
    ? { ...(options.headers || {}) }
    : {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      };

  const res = await fetch(`/api${url}`, {
    ...options,
    credentials: 'include',
    headers
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(
      data.error || `Request failed with status ${res.status}`
    );
  }

  return data;
};

const mediaUrl = value => {
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  return value.startsWith('/') ? value : `/${value}`;
};

const dateText = v =>
  v ? new Date(v.replace(' ', 'T') + 'Z').toLocaleString() : '—';

const lookupStatusText = status => {
  const labels = {
    consent_not_given: 'Lookup was not consented to',
    public_ip_unavailable: 'No public client IP was available to look up',
    vercel_proxy_seen: 'API request passed through the Vercel proxy',
    vercel_proxy_missing: 'API request bypassed the Vercel proxy',
    vercel_geo_ok: 'Vercel provided an approximate location',
    vercel_geo_missing: 'Vercel did not provide location headers to the API',
    isp_not_returned_by_vercel: 'Vercel does not provide ISP names',
    ipwho_ok: 'ipwho.is returned data',
    ipwho_no_record: 'ipwho.is had no record for this address',
    ipwho_timeout: 'ipwho.is timed out',
    ipwho_network_error: 'Could not connect to ipwho.is',
    ipapi_ok: 'ipapi.is returned data',
    ipapi_no_data: 'ipapi.is returned no location or ISP data',
    ipapi_bogon: 'ipapi.is classified the address as private or reserved',
    ipapi_timeout: 'ipapi.is timed out',
    ipapi_network_error: 'Could not connect to ipapi.is',
    ipapi_invalid_response: 'ipapi.is returned an invalid response',
    ipapi_co_ok: 'ipapi.co returned data',
    ipapi_co_no_record: 'ipapi.co had no record for this address',
    ipapi_co_no_data: 'ipapi.co returned no location or ISP data',
    ipapi_co_timeout: 'ipapi.co timed out',
    ipapi_co_network_error: 'Could not connect to ipapi.co',
    ipapi_co_not_consented: 'ipapi.co fallback not consented for this event',
    ipwho_ok_shared_network: 'ipwho.is returned shared-network data'
  };
  if (!status) return '';
  return String(status).split('; ').map(code => {
    if (labels[code]) return labels[code];
    const match = code.match(/^(ipwho|ipapi|ipapi_co)_http_(\d+)$/);
    if (match && match[1] === 'ipapi' && match[2] === '429') {
      return 'ipapi.is request limit reached (HTTP 429)';
    }
    if (match && match[1] === 'ipapi_co' && match[2] === '429') {
      return 'ipapi.co request limit reached (HTTP 429)';
    }
    if (match) {
      const provider = match[1] === 'ipapi_co' ? 'ipapi.co' : `${match[1]}.is`;
      return `${provider} returned HTTP ${match[2]}`;
    }
    return code.replaceAll('_', ' ');
  }).join(' · ');
};

const initials = s =>
  (s || '?').slice(0, 1).toUpperCase();

// ============================================
// AUTHENTICATION
// ============================================

function Auth({ onAuth }) {
  const [mode, setMode] = useState('login');
  const [identity, setIdentity] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [networkInfoConsent, setNetworkInfoConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');

    try {
      const d = await api(
        mode === 'login' ? '/auth/login' : '/auth/register',
        {
          method: 'POST',
          body: JSON.stringify(
            mode === 'login'
              ? { identity, password, networkInfoConsent }
              : { username, email, password, networkInfoConsent }
          )
        }
      );

      onAuth(d.user);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-split">
      <section className="auth-visual">
        <div className="auth-brand">
          <div className="social-camera-mark">
            <svg viewBox="0 0 48 48" aria-hidden="true">
              <rect x="5" y="5" width="38" height="38" rx="11" />
              <circle cx="24" cy="24" r="9" />
              <circle className="camera-dot" cx="35" cy="13" r="2.5" />
            </svg>
          </div>
          <span>Instagram</span>
        </div>

        <div className="visual-copy">
          <h1>
            See everyday moments from your{' '}
            <span>close friends.</span>
          </h1>
          <p>
            Share photos, discover new stories, and stay connected
            with your community.
          </p>
        </div>

        <div className="photo-collage" aria-label="Decorative photo collage">
          <div className="photo-tile tile-one" />
          <div className="photo-tile tile-two" />
          <div className="photo-tile tile-three" />
          <div className="photo-tile tile-four" />
          <span className="collage-heart">♥</span>
          <span className="collage-spark">✦</span>
        </div>

        <div className="visual-caption">
          A LITTLE SPACE FOR YOUR EVERYDAY MOMENTS
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-panel-inner">
          <div className="auth-heading">
            <h2>
              {mode === 'login' ? 'Log in to Instagram' : 'Join InstaClone'}
            </h2>
            <p>
              {mode === 'login'
                ? 'Welcome back. Your community is waiting.'
                : 'Create an account and share your world.'}
            </p>
          </div>

          <form onSubmit={submit} className="auth-form auth-form-reference">
            {mode === 'register' && (
              <>
                <input
                  aria-label="Username"
                  required
                  minLength="3"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="Username"
                />

                <input
                  aria-label="Email"
                  required
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="Email address"
                />
              </>
            )}

            {mode === 'login' && (
              <input
                aria-label="Username or email"
                required
                value={identity}
                onChange={e => setIdentity(e.target.value)}
                placeholder="Username or email"
                autoFocus
              />
            )}

            <input
              aria-label="Password"
              required
              type="password"
              minLength="8"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Password"
            />

            {mode === 'login' && (
              <>
              <p className="privacy-note">
                Failed sign-in attempts record the entered username/email,
                time, server-observed IP, and browser/device details. The
                device's private LAN IP is not exposed to the server. Passwords
                are never recorded. Checking below allows ISP and approximate
                location lookup for this login attempt, including when the
                username is not recognized. Accounts that previously opted in
                also allow lookup for their attempts. The lookup may send the
                public IP to ipwho.is and ipapi.is. Checking below also
                allows ipapi.co as a backup if those services fail.
              </p>
              <label className="network-consent login-network-consent">
                <input
                  type="checkbox"
                  checked={networkInfoConsent}
                  onChange={e => setNetworkInfoConsent(e.target.checked)}
                />
                <span>
                  I consent to an approximate ISP and public-IP location lookup
                  for this sign-in attempt, including if it fails. The public IP
                  may be sent to ipwho.is, ipapi.is, and as a backup to ipapi.co.
                  No GPS or password is collected; the admin can view the estimate.
                </span>
              </label>
              </>
            )}

            {mode === 'register' && (
              <label className="network-consent">
                <input
                  type="checkbox"
                  required
                  checked={networkInfoConsent}
                  onChange={e => setNetworkInfoConsent(e.target.checked)}
                />
                <span>
                  I agree that this demo may record the IP address visible
                  to the server and send it to ipwho.is, ipapi.is, or ipapi.co
                  as needed to estimate ISP and approximate network location for the
                  admin security dashboard. The admin can view this
                  information. No GPS is collected; map pins are approximate
                  and may show a shared network location.
                </span>
              </label>
            )}

            {error && <div className="error">{error}</div>}

            <button className="auth-login-button" disabled={busy}>
              {busy
                ? 'Please wait…'
                : mode === 'login'
                  ? 'Log in'
                  : 'Sign up'}
            </button>
          </form>

          {mode === 'login' && (
            <button
              className="auth-forgot"
              type="button"
              onClick={() =>
                setError(
                  'Password recovery is not enabled in this local demo. Contact the site administrator.'
                )
              }
            >
              Forgot password?
            </button>
          )}

          <div className="auth-divider">
            <span />
            {mode === 'login' ? 'OR' : 'GET STARTED'}
            <span />
          </div>

          <button
            className="auth-create-button"
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setNetworkInfoConsent(false);
              setError('');
            }}
          >
            {mode === 'login' ? 'Create new account' : 'Back to log in'}
          </button>

          <div className="auth-demo-note">
            <Shield size={14} />
            Independent social app demo. Sign in with your InstaClone
            account only.
          </div>

          <div className="auth-meta">
            InstaClone <span>•</span> A community demo
          </div>
        </div>
      </section>

      <footer className="auth-bottom-links">
        ABOUT　 HELP　 PRIVACY　 TERMS　 COMMUNITY　
        <span>© 2026 INSTACLONE</span>
      </footer>
    </div>
  );
}

// ============================================
// SIDEBAR
// ============================================

function Sidebar({ user, page, setPage, onLogout }) {
  const items = [
    ['Feed', Home],
    ['Explore', Compass],
    ['Messages', MessageCircle],
    ['Notifications', Heart],
    ['Create', PlusSquare],
    ['Profile', UserRound]
  ];

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">i.</div>
        <span>InstaClone</span>
      </div>

      <nav>
        {items.map(([name, Icon]) => (
          <button
            key={name}
            className={page === name ? 'nav-item selected' : 'nav-item'}
            onClick={() => setPage(name)}
          >
            <Icon size={20} />
            <span>{name}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-bottom">
        {user.role === 'admin' && (
          <button
            className="nav-item admin-link"
            onClick={() => setPage('Admin')}
          >
            <Shield size={20} />
            <span>Admin console</span>
          </button>
        )}

        <button className="nav-item" onClick={onLogout}>
          <LogOut size={20} />
          <span>Log out</span>
        </button>

        <div className="mini-user">
          <div className="avatar">{initials(user.username)}</div>
          <div>
            <b>{user.username}</b>
            <small>
              {user.role === 'admin' ? 'Administrator' : 'Personal account'}
            </small>
          </div>
          <MoreHorizontal size={18} />
        </div>
      </div>
    </aside>
  );
}

// ============================================
// POSTS
// ============================================

function PostCard({ post, onLike, onComment }) {
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [body, setBody] = useState('');

  async function load() {
    const d = await api(`/posts/${post.id}/comments`);
    setComments(d.comments);
  }

  async function send() {
    if (!body.trim()) return;

    await onComment(post.id, body);
    setBody('');
    await load();
  }

  return (
    <article className="post-card">
      <div className="post-head">
        <div className="avatar">{initials(post.username)}</div>

        <div className="post-author">
          <b>{post.username}</b>
          <small>Community post</small>
        </div>

        <button className="icon-button">
          <MoreHorizontal size={20} />
        </button>
      </div>

      <img
        className="post-image"
        src={mediaUrl(post.image)}
        alt="Community post"
      />

      <div className="post-actions">
        <button
          onClick={() => onLike(post.id)}
          className={post.liked ? 'liked' : ''}
        >
          <Heart size={22} fill={post.liked ? 'currentColor' : 'none'} />
        </button>

        <button
          onClick={() => {
            setShowComments(!showComments);
            if (!showComments) load();
          }}
        >
          <MessageCircle size={22} />
        </button>

        <button>
          <SendIcon />
        </button>

        <button className="save">
          <Bookmark size={22} />
        </button>
      </div>

      <div className="post-meta">
        <b>{post.likes} likes</b>
        <p>
          <b>{post.username}</b> {post.caption}
        </p>

        <button
          className="subtle-link"
          onClick={() => {
            setShowComments(!showComments);
            if (!showComments) load();
          }}
        >
          View all {post.comments} comments
        </button>

        <small>{dateText(post.created_at)}</small>
      </div>

      {showComments && (
        <div className="comments">
          {comments.map(c => (
            <p key={c.id}>
              <b>{c.username}</b> {c.body}
            </p>
          ))}

          <div className="comment-input">
            <input
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Add a comment…"
            />
            <button onClick={send}>Post</button>
          </div>
        </div>
      )}
    </article>
  );
}

function SendIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </svg>
  );
}

// ============================================
// CREATE POST MODAL
// ============================================

function CreateModal({ close, onCreated }) {
  const [file, setFile] = useState(null);
  const [caption, setCaption] = useState('');
  const [preview, setPreview] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function pick(f) {
    if (!f) return;

    if (!f.type.startsWith('image/')) {
      setError('Please select an image.');
      return;
    }

    setFile(f);
    setPreview(URL.createObjectURL(f));
    setError('');
  }

  async function submit() {
    if (!file) {
      setError('Choose an image to post.');
      return;
    }

    setBusy(true);

    try {
      const fd = new FormData();
      fd.append('image', file);
      fd.append('caption', caption);

      await api('/posts', {
        method: 'POST',
        body: fd
      });

      onCreated();
      close();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="modal-backdrop"
      onMouseDown={e => e.target === e.currentTarget && close()}
    >
      <div className="modal">
        <div className="modal-head">
          <b>Create new post</b>
          <button className="icon-button" onClick={close}>
            <X />
          </button>
        </div>

        {preview ? (
          <img className="upload-preview" src={preview} alt="Upload preview" />
        ) : (
          <label className="dropzone">
            <ImagePlus size={42} />
            <b>Share a photo</b>
            <span>JPG, PNG, WEBP or GIF · up to 8 MB</span>

            <input
              type="file"
              accept="image/*"
              onChange={e => pick(e.target.files[0])}
            />

            <span className="choose-file">Choose from computer</span>
          </label>
        )}

        <textarea
          value={caption}
          onChange={e => setCaption(e.target.value)}
          placeholder="Write a caption…"
          maxLength="1000"
        />

        {error && <div className="error">{error}</div>}

        <button
          className="primary full"
          disabled={busy}
          onClick={submit}
        >
          {busy ? 'Sharing…' : 'Share post'}
        </button>
      </div>
    </div>
  );
}

// ============================================
// APPROXIMATE NETWORK LOCATION
// ============================================

function mapLink(s) {
  if (
    Number.isFinite(Number(s.latitude)) &&
    Number.isFinite(Number(s.longitude)) &&
    s.latitude !== null &&
    s.longitude !== null
  ) {
    return `https://www.google.com/maps?q=${encodeURIComponent(
      `${s.latitude},${s.longitude}`
    )}`;
  }

  const place = [s.city, s.region, s.country]
    .filter(Boolean)
    .join(', ');

  return place
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`
    : '';
}

function LocationLink({ record }) {
  const href = mapLink(record);

  const label = [record.city, record.region, record.country]
    .filter(Boolean)
    .join(', ');

  return href ? (
    <a
      className="map-location-link"
      href={href}
      target="_blank"
      rel="noreferrer"
      title="Open approximate network location in Google Maps"
    >
      {label || 'View approximate map'} <span>↗</span>
    </a>
  ) : (
    <small
      className="location-unavailable"
      title="Location requires a public client IP and a successful approximate IP lookup."
    >
      {record.network_info_consent === 0
        ? 'Unavailable · user did not consent to network lookup'
        : record.client_ip && !record.ip_address
        ? 'Unavailable · public IP not received'
        : 'Unavailable · no location estimate recorded'}
    </small>
  );
}

function NetworkMap({ users, events }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef(null);

  const mapRecords = [
    ...(users || []).map(user => ({
      ...user,
      mapTitle: '@' + user.username,
      mapDetail: 'Latest account sign-in'
    })),
    ...(events || [])
      .filter(event => event.network_info_consent === 1)
      .map(event => ({
        ...event,
        username: event.attempted_identity,
        ip_address: event.ip_address || event.client_ip,
        mapTitle: 'Failed sign-in · ' + event.attempted_identity,
        mapDetail: `Attempt ${event.attempt_number} · ${dateText(event.created_at)}`
      }))
  ];

  const mapped = mapRecords.filter(record =>
    Number.isFinite(Number(record.latitude)) &&
    Number.isFinite(Number(record.longitude)) &&
    record.latitude !== null &&
    record.longitude !== null
  );

  useEffect(() => {
    if (!containerRef.current || !window.L) return;

    const L = window.L;

    const map = L.map(containerRef.current, {
      scrollWheelZoom: false
    }).setView([12.8797, 121.7740], 5);

    L.tileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
      }
    ).addTo(map);

    const layer = L.featureGroup().addTo(map);

    mapRef.current = map;
    markersRef.current = layer;

    const timer = setTimeout(() => map.invalidateSize(), 100);

    return () => {
      clearTimeout(timer);
      map.remove();
      mapRef.current = null;
      markersRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = markersRef.current;
    const L = window.L;

    if (!map || !layer || !L) return;

    layer.clearLayers();

    mapped.forEach(record => {
      const marker = L.marker([
        Number(record.latitude),
        Number(record.longitude)
      ]).addTo(layer);

      const popup = document.createElement('div');

      const title = document.createElement('strong');
      title.textContent = record.mapTitle || '@' + record.username;

      const detail = document.createElement('div');
      detail.textContent = [
        record.city,
        record.region,
        record.country
      ].filter(Boolean).join(', ') || record.mapDetail || 'Approximate network location';

      const ip = document.createElement('small');
      ip.textContent = 'Public IP: ' + (record.ip_address || 'Unavailable');

      popup.append(title, detail, ip);
      marker.bindPopup(popup);
    });

    if (mapped.length === 1) {
      map.setView([
        Number(mapped[0].latitude),
        Number(mapped[0].longitude)
      ], 10);
    } else if (mapped.length > 1) {
      map.fitBounds(layer.getBounds().pad(0.18), {
        maxZoom: 10
      });
    }
  }, [users, events]);

  return (
    <section className="admin-card network-map-card">
      <div className="section-head">
        <div>
          <h2>Network location map</h2>
          <p className="muted">
            Approximate public-IP locations from consented successful and
            failed sign-in attempts
          </p>
        </div>

        <span className="map-count">
          {mapped.length} mapped {mapped.length === 1 ? 'sign-in' : 'sign-ins'}
        </span>
      </div>

      <div
        ref={containerRef}
        className="network-map"
        aria-label="Map of approximate network locations"
      />

      {!window.L && (
        <p className="map-unavailable">
          Map library could not load. Check your internet connection and refresh.
        </p>
      )}

      {mapped.length === 0 && (
        <p className="map-disclaimer">
          No consented sign-in has location coordinates yet. Failed attempts
          with consent will appear here when the IP lookup returns coordinates.
        </p>
      )}

      <p className="map-disclaimer">
        Map pins are estimates of the internet connection's public IP
        address. Multiple users on the same school, office, or home Wi-Fi
        may share one pin. They are not exact device or person locations.
      </p>
    </section>
  );
}

// ============================================
// ADMIN DASHBOARD
// ============================================

function Admin({ user }) {
  const [summary, setSummary] = useState(null);
  const [users, setUsers] = useState([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [securityEvents, setSecurityEvents] = useState([]);
  const [error, setError] = useState('');

  async function refresh() {
    try {
      const [s, u, sec] = await Promise.all([
        api('/admin/summary'),
        api('/admin/users'),
        api('/admin/security-events')
      ]);

      setSummary(s);
      setUsers(u.users);
      setSecurityEvents(sec.events || []);
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function search(q) {
    setQuery(q);

    try {
      const d = await api(
        '/admin/users?q=' + encodeURIComponent(q)
      );
      setUsers(d.users);
    } catch (e) {
      setError(e.message);
    }
  }

  async function openSessions(u) {
    try {
      setSelected(u);
      const d = await api(`/admin/users/${u.id}/sessions`);
      setSessions(d.sessions);
    } catch (e) {
      setError(e.message);
    }
  }

  async function status(u) {
    try {
      await api(`/admin/users/${u.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: u.status === 'active' ? 'suspended' : 'active'
        })
      });

      refresh();
    } catch (e) {
      setError(e.message);
    }
  }

  async function remove(u) {
    if (!confirm(`Permanently delete @${u.username} and their content?`)) {
      return;
    }

    try {
      await api(`/admin/users/${u.id}`, {
        method: 'DELETE'
      });

      refresh();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="admin-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">CONTROL CENTER</div>
          <h1>Admin overview</h1>
          <p className="muted">
            Manage community access and review reported sign-in device details.
          </p>
        </div>

        <div className="admin-chip">
          <Shield size={15} /> Admin session
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      {summary && (
        <div className="stats-grid">
          <Stat icon={Users} label="Registered users" value={summary.users} />
          <Stat icon={CheckCircle2} label="Active accounts" value={summary.active} />
          <Stat icon={ImagePlus} label="Total posts" value={summary.posts} />
          <Stat icon={Activity} label="Recorded sign-ins" value={summary.logins} />
        </div>
      )}

      <NetworkMap users={users} events={securityEvents} />

      <div className="admin-card">
        <div className="section-head">
          <div>
            <h2>User management</h2>
            <p className="muted">
              Account and latest reported device information
            </p>
          </div>

          <div className="searchbox">
            <Search size={17} />
            <input
              value={query}
              onChange={e => search(e.target.value)}
              placeholder="Search username or email"
            />
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>USER</th>
                <th>DEVICE</th>
                <th>BROWSER / OS</th>
                <th>LOCAL / PUBLIC IP</th>
                <th>ISP / APPROX. LOCATION</th>
                <th>LAST LOGIN</th>
                <th>STATUS</th>
                <th>ACTIONS</th>
              </tr>
            </thead>

            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td>
                    <div className="table-user">
                      <div className="avatar">{initials(u.username)}</div>
                      <div>
                        <button
                          className="table-user-link"
                          onClick={() => openSessions(u)}
                          aria-label={`View details for ${u.username}`}
                        >
                          @{u.username}
                        </button>
                        <small>{u.email}</small>
                      </div>
                    </div>
                  </td>

                  <td>
                    <span className="device-tag">
                      <DeviceIcon device={u.device} />
                      {u.device || 'Not recorded'}
                    </span>
                  </td>

                  <td>
                    <b className="table-strong">{u.browser || '—'}</b>
                    <small>{u.os || '—'}</small>
                  </td>

                  <td>
                    <div className="ip-stack">
                      <b className="table-strong ip-address">
                        {u.client_ip || 'Client IP unavailable'}
                      </b>
                      <small>Local / client network IP</small>

                      <b className="table-strong ip-address">
                        {u.ip_address || 'Public IP unavailable'}
                      </b>
                      <small>Public internet IP (shared gateway possible)</small>
                    </div>
                  </td>

                  <td>
                    <b className="table-strong">
                      {u.isp || (u.network_source === 'vercel-geo' ? 'ISP not provided' : 'ISP lookup unavailable')}
                    </b>
                    <small><LocationLink record={u} /></small>
                    <small>
                      {u.network_source === 'shared-network'
                        ? 'Shared Wi-Fi/network estimate · map pin is network-level'
                        : u.network_source === 'public-ip'
                          ? 'Public IP estimate · approximate map pin'
                          : u.network_source === 'vercel-geo'
                            ? 'Approximate Vercel IP estimate · no GPS'
                          : ''}
                    </small>
                  </td>

                  <td>{dateText(u.last_login)}</td>

                  <td>
                    <span className={'status ' + u.status}>
                      {u.status}
                    </span>
                  </td>

                  <td>
                    <div className="action-row">
                      <button
                        title="View sign-in history"
                        onClick={() => openSessions(u)}
                      >
                        <Activity size={16} />
                      </button>

                      <button
                        title={u.status === 'active' ? 'Suspend' : 'Activate'}
                        onClick={() => status(u)}
                      >
                        {u.status === 'active'
                          ? <Ban size={16} />
                          : <CheckCircle2 size={16} />}
                      </button>

                      <button
                        title="Delete user"
                        className="danger-icon"
                        onClick={() => remove(u)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {users.length === 0 && (
            <div className="empty-state">No users found.</div>
          )}
        </div>
      </div>

      <div className="admin-card recent-card">
        <div className="section-head">
          <div>
            <h2>Recent sign-ins</h2>
            <p className="muted">
              Latest device and browser details reported at login
            </p>
          </div>
        </div>

        <div className="recent-list">
          {(summary?.recent || []).map((s, i) => (
            <div className="recent-row" key={i}>
              <div className="device-icon">
                <DeviceIcon device={s.device} />
              </div>

              <div className="recent-main">
                <b>@{s.username}</b>
                <small>{s.browser} · {s.os}</small>
                <small>Device/network IP: {s.client_ip || 'Unavailable'}</small>
                <small>Public internet IP: {s.ip_address || 'Unavailable'}</small>
                <small>{s.isp || (s.network_source === 'vercel-geo' ? 'ISP not provided' : 'ISP lookup unavailable')} · <LocationLink record={s} /></small>
                {s.lookup_status && <small>Lookup details: {lookupStatusText(s.lookup_status)}</small>}
                <small>
                  {s.network_source === 'shared-network'
                    ? 'Shared Wi-Fi/network estimate'
                    : s.network_source === 'public-ip'
                      ? 'Public IP estimate'
                      : s.network_source === 'vercel-geo'
                        ? 'Approximate Vercel IP estimate · no GPS'
                      : ''}
                </small>
              </div>

              <span>{s.device}</span>
              <time>{dateText(s.logged_in_at)}</time>
            </div>
          ))}
        </div>
      </div>

      <div className="admin-card recent-card">
        <div className="section-head">
          <div>
            <h2>Login security events</h2>
            <p className="muted">
              Failed sign-in attempts and temporary account lockouts · latest 50
            </p>
          </div>

          <button className="secondary" onClick={refresh}>
            Refresh
          </button>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ACCOUNT ENTERED</th>
                <th>ATTEMPT</th>
                <th>DEVICE</th>
                <th>BROWSER / OS</th>
                <th>CLIENT / PUBLIC IP</th>
                <th>ISP / APPROX. LOCATION</th>
                <th>EVENT</th>
                <th>TIME</th>
              </tr>
            </thead>

            <tbody>
              {securityEvents.map(ev => (
                <tr key={ev.id}>
                  <td><b>{ev.attempted_identity}</b></td>
                  <td>{ev.attempt_number} / 3</td>
                  <td>{ev.device || 'Unknown'}</td>
                  <td>
                    <b className="table-strong">{ev.browser || '—'}</b>
                    <small>{ev.os || '—'}</small>
                    <small title={ev.user_agent || undefined}>
                      {ev.user_agent ? ev.user_agent.slice(0, 90) : 'User-agent unavailable'}
                    </small>
                  </td>
                  <td>
                    <b className="table-strong ip-address">{ev.client_ip || 'Client IP unavailable'}</b>
                    <small>Client IP seen by server</small>
                    <small>Public IP: {ev.ip_address || 'Unavailable'}</small>
                  </td>
                  <td>
                    <b className="table-strong">
                      {ev.network_info_consent === 0
                        ? 'Lookup not consented for this attempt'
                        : ev.network_info_consent === null
                          ? 'Consent not recorded for this event'
                          : ev.isp || 'ISP lookup unavailable'}
                    </b>
                    <small><LocationLink record={ev} /></small>
                    {ev.lookup_status && <small>Lookup details: {lookupStatusText(ev.lookup_status)}</small>}
                    <small>
                      {ev.network_source === 'shared-network'
                        ? 'Shared Wi-Fi/network estimate'
                        : ev.network_source === 'public-ip'
                          ? 'Public IP estimate · approximate map pin'
                          : ev.network_source === 'vercel-geo'
                            ? 'Approximate Vercel IP estimate · no GPS'
                            : ev.network_source === 'public-ip+vercel-geo'
                              ? 'ISP from public-IP lookup · approximate Vercel location · no GPS'
                              : ev.network_source === 'ipapi'
                                ? 'ISP/network and approximate location from fallback provider'
                                : ev.network_source === 'ipapi+vercel-geo'
                                  ? 'ISP/network from fallback provider · approximate Vercel location · no GPS'
                            : ''}
                    </small>
                  </td>
                  <td>
                    <span
                      className={
                        'status ' +
                        (ev.event_type === 'account_locked'
                          ? 'suspended'
                          : 'active')
                      }
                    >
                      {ev.event_type === 'account_locked'
                        ? 'Locked for 15 min'
                        : 'Failed login'}
                    </span>
                  </td>
                  <td>{dateText(ev.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {securityEvents.length === 0 && (
            <div className="empty-state">
              No failed login attempts recorded.
            </div>
          )}
        </div>
      </div>

      {selected && (
        <div
          className="modal-backdrop"
          onMouseDown={e => e.target === e.currentTarget && setSelected(null)}
        >
          <div className="modal session-modal">
            <div className="modal-head">
              <div>
                <b>User details &amp; sign-in history</b>
                <small>@{selected.username}</small>
              </div>

              <button
                className="icon-button"
                onClick={() => setSelected(null)}
              >
                <X />
              </button>
            </div>

            <div className="user-detail-grid">
              <div><small>Email</small><b>{selected.email || 'Unavailable'}</b></div>
              <div><small>Account status</small><b>{selected.status || 'Unknown'}</b></div>
              <div><small>Account type</small><b>{selected.role || 'User'}</b></div>
              <div><small>Created</small><b>{dateText(selected.created_at)}</b></div>
              <div><small>Last login</small><b>{dateText(selected.last_login)}</b></div>
              <div><small>Network lookup consent</small><b>{selected.network_info_consent ? 'Given' : 'Not given'}</b></div>
              <div className="user-detail-bio"><small>Bio</small><b>{selected.bio || 'No bio added'}</b></div>
            </div>

            <h3 className="user-detail-section-title">Recent sign-ins</h3>

            {sessions.map((s, i) => (
              <div className="session-row" key={i}>
                <div className="device-icon">
                  <DeviceIcon device={s.device} />
                </div>

                <div>
                  <b>{s.device}</b>
                  <small>{s.browser} · {s.os}</small>
                  <small>Device/network IP: {s.client_ip || 'Unavailable'}</small>
                  <small>Public internet IP: {s.ip_address || 'Unavailable'}</small>
                  <small>{s.isp || (s.network_source === 'vercel-geo' ? 'ISP not provided' : 'ISP lookup unavailable')} · <LocationLink record={s} /></small>
                  <small>
                    {s.network_source === 'shared-network'
                      ? 'Shared Wi-Fi/network estimate'
                      : s.network_source === 'public-ip'
                        ? 'Public IP estimate'
                        : s.network_source === 'vercel-geo'
                          ? 'Approximate Vercel IP estimate · no GPS'
                        : ''}
                  </small>
                  <small>{dateText(s.logged_in_at)}</small>
                </div>
              </div>
            ))}

            {!sessions.length && (
              <p className="muted">No sign-ins recorded.</p>
            )}

            <p className="privacy-note">
              <Shield size={14} />
              Device details come from the browser user-agent. ISP and
              approximate location are derived from a consented public-IP
              lookup. On local/LAN development, the result may describe
              the shared internet connection rather than the individual
              device. No GPS is collected.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// SMALL COMPONENTS
// ============================================

function DeviceIcon({ device }) {
  if (device === 'Mobile') return <Smartphone size={16} />;
  if (device === 'Tablet') return <Laptop size={16} />;
  return <Monitor size={16} />;
}

function Stat({ icon: Icon, label, value }) {
  return (
    <div className="stat-card">
      <div className="stat-icon">
        <Icon size={19} />
      </div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

// ============================================
// PROFILE
// ============================================

function Profile({ user }) {
  const [bio, setBio] = useState(user.bio || '');
  const [networkInfoConsent, setNetworkInfoConsent] = useState(
    Boolean(user.networkInfoConsent)
  );
  const [data, setData] = useState(null);
  const [message, setMessage] = useState('');

  async function load() {
    const d = await api(`/users/${user.username}`);
    setData(d);
  }

  useEffect(() => {
    load().catch(console.error);
  }, []);

  async function save() {
    try {
      const updated = await api('/profile', {
        method: 'PUT',
        body: JSON.stringify({ bio, networkInfoConsent })
      });

      setNetworkInfoConsent(Boolean(updated.networkInfoConsent));
      setMessage(
        updated.networkInfoConsent
          ? 'Profile saved. Sign out and back in to record network details on your next sign-in.'
          : 'Profile saved. Network details will not be collected on future sign-ins.'
      );
    } catch (e) {
      setMessage(e.message);
    }
  }

  if (!data) {
    return <div className="loading">Loading profile…</div>;
  }

  return (
    <div className="profile-page">
      <div className="profile-top">
        <div className="profile-avatar">{initials(user.username)}</div>

        <div className="profile-info">
          <h1>{user.username}</h1>

          <div className="profile-counts">
            <span><b>{data.counts.posts}</b> posts</span>
            <span><b>{data.counts.followers}</b> followers</span>
            <span><b>{data.counts.following}</b> following</span>
          </div>

          <b>{user.username}</b>

          <textarea
            value={bio}
            onChange={e => setBio(e.target.value)}
            placeholder="Add a short bio…"
            maxLength="160"
          />

          <label className="network-consent profile-consent">
            <input
              type="checkbox"
              checked={networkInfoConsent}
              onChange={e => setNetworkInfoConsent(e.target.checked)}
            />
            <span>
              Allow this demo to look up the ISP and approximate network
              location from the public IP seen at sign-in, using ipwho.is,
              ipapi.is, and ipapi.co as a backup. The admin can view this
              information. No GPS or device's private LAN IP is collected. You
              can turn this off any time. Changes apply to future sign-ins.
            </span>
          </label>

          <button className="secondary" onClick={save}>
            Save profile
          </button>

          {message && <small className="success">{message}</small>}
        </div>
      </div>

      <div className="profile-divider" />

      <div className="profile-grid">
        {data.posts.map(p => (
          <img key={p.id} src={mediaUrl(p.image)} alt="User post" />
        ))}
      </div>
    </div>
  );
}

// ============================================
// MAIN APP
// ============================================

export default function App() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState('Feed');
  const [posts, setPosts] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');

  async function loadFeed() {
    const d = await api('/feed');
    setPosts(d.posts);
  }

  useEffect(() => {
    api('/me')
      .then(d => setUser(d.user))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (user && page === 'Feed') {
      loadFeed().catch(e => notify(e.message));
    }
  }, [user, page]);

  function notify(t) {
    setToast(t);
    setTimeout(() => setToast(''), 3200);
  }

  async function like(id) {
    try {
      await api(`/posts/${id}/like`, {
        method: 'POST'
      });

      setPosts(ps =>
        ps.map(p =>
          p.id === id
            ? {
                ...p,
                liked: !p.liked,
                likes: p.likes + (p.liked ? -1 : 1)
              }
            : p
        )
      );
    } catch (e) {
      notify(e.message);
    }
  }

  async function comment(id, body) {
    await api(`/posts/${id}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body })
    });
  }

  async function logout() {
    try {
      await api('/auth/logout', {
        method: 'POST'
      });
    } finally {
      setUser(null);
      setPage('Feed');
    }
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="brand-mark">i.</div>
        <span>InstaClone</span>
      </div>
    );
  }

  if (!user) {
    return (
      <Auth
        onAuth={u => {
          setUser(u);
          setPage('Feed');
        }}
      />
    );
  }

  return (
    <div className="app-shell">
      <Sidebar
        user={user}
        page={page}
        setPage={p => {
          if (p === 'Create') {
            setShowCreate(true);
            return;
          }
          setPage(p);
        }}
        onLogout={logout}
      />

      <main className="main-content">
        {page === 'Feed' ? (
          <div className="feed-layout">
            <section className="feed-column">
              <div className="mobile-top">
                <b>InstaClone</b>
                <button onClick={logout}>
                  <LogOut />
                </button>
              </div>

              <div className="stories">
                <div
                  className="story add-story"
                  onClick={() => setShowCreate(true)}
                >
                  <div className="story-ring">
                    <span>+</span>
                  </div>
                  <small>Your story</small>
                </div>

                {['noah', 'mika', 'kai', 'sofia', 'liam'].map((n, i) => (
                  <div className="story" key={n}>
                    <div className={'story-ring ring-' + i}>
                      <span>{initials(n)}</span>
                    </div>
                    <small>{n}</small>
                  </div>
                ))}
              </div>

              <div className="feed-heading">
                <div>
                  <div className="eyebrow">YOUR DAILY DOSE</div>
                  <h1>For you</h1>
                </div>

                <button
                  className="secondary"
                  onClick={() => setShowCreate(true)}
                >
                  <PlusSquare size={17} /> Create post
                </button>
              </div>

              {posts.length ? (
                posts.map(p => (
                  <PostCard
                    key={p.id}
                    post={p}
                    onLike={like}
                    onComment={comment}
                  />
                ))
              ) : (
                <div className="empty-feed">
                  <div className="empty-icon">
                    <Camera size={28} />
                  </div>
                  <h2>Your feed starts here</h2>
                  <p>
                    Be the first to share a moment with your community.
                  </p>
                  <button
                    className="primary"
                    onClick={() => setShowCreate(true)}
                  >
                    Create your first post
                  </button>
                </div>
              )}
            </section>

            <aside className="right-rail">
              <div className="rail-user">
                <div className="avatar large">
                  {initials(user.username)}
                </div>

                <div>
                  <b>{user.username}</b>
                  <small>
                    {user.role === 'admin'
                      ? 'Administrator'
                      : 'Welcome to InstaClone'}
                  </small>
                </div>

                <button onClick={() => setPage('Profile')}>
                  Profile
                </button>
              </div>

              <div className="rail-section">
                <div className="rail-title">
                  <b>Suggested for you</b>
                  <span>See all</span>
                </div>

                {['creative.jules', 'dailyframes', 'the.weekend'].map(n => (
                  <div className="suggestion" key={n}>
                    <div className="avatar">{initials(n)}</div>
                    <div>
                      <b>{n}</b>
                      <small>Suggested for you</small>
                    </div>
                    <button>Follow</button>
                  </div>
                ))}
              </div>

              <div className="rail-note">
                <Sparkles size={16} />
                <span>Small moments make a big picture.</span>
              </div>

              <small className="copyright">
                ABOUT · HELP · PRIVACY · TERMS
                <br />
                © 2026 INSTACLONE
              </small>
            </aside>
          </div>
        ) : page === 'Admin' ? (
          <Admin user={user} />
        ) : page === 'Profile' ? (
          <Profile user={user} />
        ) : (
          <div className="placeholder-page">
            <div className="empty-icon">
              <Compass size={28} />
            </div>
            <h1>{page}</h1>
            <p className="muted">
              This section is ready for the next feature.
            </p>
            <button
              className="secondary"
              onClick={() => setPage('Feed')}
            >
              Back to feed
            </button>
          </div>
        )}
      </main>

      {showCreate && (
        <CreateModal
          close={() => setShowCreate(false)}
          onCreated={() => loadFeed().catch(() => {})}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
