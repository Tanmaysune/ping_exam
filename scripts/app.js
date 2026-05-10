/* =========================================================
   app.js — Shared: clock, theme, background canvas, security
   ========================================================= */

// ---- Theme ----
function setTheme(mode) {
  const html = document.documentElement;
  let resolved = mode;
  if (mode === 'system') {
    resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  html.setAttribute('data-theme', resolved);
  localStorage.setItem('pe_theme', mode);
  document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById('btn-' + mode);
  if (btn) btn.classList.add('active');
}

(function initTheme() {
  const saved = localStorage.getItem('pe_theme') || 'light';
  setTheme(saved);
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (localStorage.getItem('pe_theme') === 'system') setTheme('system');
  });
})();

// ---- Live Clock ----
function updateClock() {
  const el = document.getElementById('liveClock');
  const tz = document.getElementById('timezoneLabel');
  if (!el) return;
  const now = new Date();
  el.textContent = now.toLocaleTimeString('en-GB', { hour12: false });
  if (tz) {
    const tzName = Intl.DateTimeFormat().resolvedOptions().timeZone;
    tz.textContent = tzName ? tzName.split('/').pop().replace('_', ' ') : '';
  }
}
updateClock();
setInterval(updateClock, 1000);

// ---- Background Canvas — Watermark Tech Icons ----
(function drawBackground() {
  const canvas = document.getElementById('bgCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = Math.max(document.body.scrollHeight, window.innerHeight);
  }
  resize();
  window.addEventListener('resize', () => { resize(); draw(); });

  const symbols = [
    // Shield
    function shield(x, y, s) {
      ctx.beginPath();
      ctx.moveTo(x, y - s);
      ctx.lineTo(x + s * 0.8, y - s * 0.5);
      ctx.lineTo(x + s * 0.8, y + s * 0.2);
      ctx.quadraticCurveTo(x + s * 0.8, y + s, x, y + s);
      ctx.quadraticCurveTo(x - s * 0.8, y + s, x - s * 0.8, y + s * 0.2);
      ctx.lineTo(x - s * 0.8, y - s * 0.5);
      ctx.closePath();
      ctx.stroke();
    },
    // Lock
    function lock(x, y, s) {
      ctx.strokeRect(x - s * 0.6, y, s * 1.2, s);
      ctx.beginPath();
      ctx.arc(x, y, s * 0.5, Math.PI, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y + s * 0.5, s * 0.1, 0, Math.PI * 2);
      ctx.stroke();
    },
    // Terminal prompt
    function terminal(x, y, s) {
      ctx.strokeRect(x - s, y - s * 0.7, s * 2, s * 1.4);
      ctx.beginPath();
      ctx.moveTo(x - s * 0.7, y);
      ctx.lineTo(x - s * 0.3, y - 0.3 * s);
      ctx.lineTo(x - s * 0.3, y + 0.3 * s);
      ctx.closePath();
      ctx.stroke();
      ctx.fillRect(x - s * 0.1, y - s * 0.06, s * 0.5, s * 0.12);
    },
    // Network node
    function network(x, y, s) {
      ctx.beginPath(); ctx.arc(x, y, s * 0.15, 0, Math.PI * 2); ctx.stroke();
      const pts = [[x - s, y - s * 0.5],[x + s, y - s * 0.5],[x - s, y + s * 0.5],[x + s, y + s * 0.5]];
      pts.forEach(([px, py]) => {
        ctx.beginPath(); ctx.arc(px, py, s * 0.1, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(px, py); ctx.stroke();
      });
    },
    // Key
    function key(x, y, s) {
      ctx.beginPath(); ctx.arc(x - s * 0.3, y, s * 0.35, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y); ctx.lineTo(x + s, y);
      ctx.moveTo(x + s * 0.7, y); ctx.lineTo(x + s * 0.7, y + s * 0.25);
      ctx.moveTo(x + s * 0.5, y); ctx.lineTo(x + s * 0.5, y + s * 0.2);
      ctx.stroke();
    },
    // Binary group
    function binary(x, y, s) {
      ctx.font = `${Math.round(s * 1.4)}px JetBrains Mono,monospace`;
      ctx.textAlign = 'center';
      const str = '01101';
      ctx.fillText(str, x, y);
    },
  ];

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    ctx.strokeStyle = isDark ? '#ffffff' : '#2c3e50';
    ctx.fillStyle   = isDark ? '#ffffff' : '#2c3e50';
    ctx.lineWidth = 1;

    const cols = Math.ceil(canvas.width  / 180);
    const rows = Math.ceil(canvas.height / 180);
    let si = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * 180 + 90 + ((r % 2) * 90);
        const y = r * 180 + 90;
        const fn = symbols[si % symbols.length];
        ctx.save();
        ctx.globalAlpha = 0.6;
        try { fn(x, y, 18); } catch(e) {}
        ctx.restore();
        si++;
      }
    }
  }
  draw();

  // Redraw on theme change
  const observer = new MutationObserver(draw);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
})();

// ---- Security: disable right-click & devtools shortcuts ----
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('keydown', e => {
  if (
    e.key === 'F12' ||
    (e.ctrlKey && e.shiftKey && ['I','J','C'].includes(e.key)) ||
    (e.ctrlKey && e.key === 'U')
  ) {
    e.preventDefault();
    return false;
  }
});

// =========================================================
// HOME PAGE — PORT CHEATSHEET COLLAPSIBLE
// =========================================================
const HOME_PORT_DATA = [
  {port:'7',    proto:'TCP/UDP',      service:'Echo'},
  {port:'9',    proto:'TCP/UDP',      service:'Discard / Wake-on-LAN'},
  {port:'19',   proto:'TCP/UDP',      service:'Chargen'},
  {port:'20',   proto:'TCP/SCTP',     service:'FTP Data'},
  {port:'21',   proto:'TCP/UDP/SCTP', service:'FTP Control'},
  {port:'22',   proto:'TCP/UDP/SCTP', service:'SSH / SCP / SFTP'},
  {port:'23',   proto:'TCP',          service:'Telnet'},
  {port:'25',   proto:'TCP',          service:'SMTP'},
  {port:'42',   proto:'TCP/UDP',      service:'WINS Replication'},
  {port:'43',   proto:'TCP/UDP',      service:'WHOIS'},
  {port:'49',   proto:'UDP',          service:'TACACS / TACACS+'},
  {port:'53',   proto:'TCP/UDP',      service:'DNS'},
  {port:'67',   proto:'UDP',          service:'DHCP Server / BOOTP'},
  {port:'68',   proto:'UDP',          service:'DHCP Client / BOOTP'},
  {port:'69',   proto:'UDP',          service:'TFTP'},
  {port:'70',   proto:'TCP',          service:'Gopher'},
  {port:'79',   proto:'TCP',          service:'Finger'},
  {port:'80',   proto:'TCP/UDP/SCTP', service:'HTTP'},
  {port:'88',   proto:'TCP/UDP',      service:'Kerberos'},
  {port:'101',  proto:'TCP',          service:'Hostname'},
  {port:'102',  proto:'TCP',          service:'Microsoft Exchange ISO-TSAP'},
  {port:'110',  proto:'TCP',          service:'POP3'},
  {port:'113',  proto:'TCP',          service:'Ident'},
  {port:'119',  proto:'TCP',          service:'NNTP (Usenet)'},
  {port:'123',  proto:'UDP',          service:'NTP'},
  {port:'135',  proto:'TCP/UDP',      service:'Microsoft RPC EPMAP'},
  {port:'137',  proto:'TCP/UDP',      service:'NetBIOS-NS'},
  {port:'138',  proto:'TCP/UDP',      service:'NetBIOS-DGM'},
  {port:'139',  proto:'TCP/UDP',      service:'NetBIOS-SSN'},
  {port:'143',  proto:'TCP/UDP',      service:'IMAP'},
  {port:'161',  proto:'UDP',          service:'SNMP Agent'},
  {port:'162',  proto:'UDP',          service:'SNMP Trap'},
  {port:'177',  proto:'UDP',          service:'XDMCP'},
  {port:'179',  proto:'TCP',          service:'BGP'},
  {port:'194',  proto:'UDP',          service:'IRC'},
  {port:'389',  proto:'TCP/UDP',      service:'LDAP'},
  {port:'427',  proto:'TCP',          service:'SLP'},
  {port:'443',  proto:'TCP/UDP/SCTP', service:'HTTPS'},
  {port:'445',  proto:'TCP/UDP',      service:'SMB / Microsoft DS'},
  {port:'464',  proto:'TCP/UDP',      service:'Kerberos (Password Change)'},
  {port:'465',  proto:'TCP',          service:'SMTPS (SMTP over SSL)'},
  {port:'500',  proto:'UDP',          service:'IPSec IKE / ISAKMP'},
  {port:'514',  proto:'UDP',          service:'Syslog'},
  {port:'515',  proto:'TCP',          service:'LPD / LPR (Printing)'},
  {port:'520',  proto:'UDP',          service:'RIP'},
  {port:'521',  proto:'UDP',          service:'RIPng (IPv6)'},
  {port:'540',  proto:'TCP',          service:'UUCP'},
  {port:'546',  proto:'TCP/UDP',      service:'DHCPv6 Client'},
  {port:'547',  proto:'TCP/UDP',      service:'DHCPv6 Server'},
  {port:'548',  proto:'TCP',          service:'AFP (Apple Filing Protocol)'},
  {port:'554',  proto:'TCP/UDP',      service:'RTSP'},
  {port:'563',  proto:'TCP/UDP',      service:'NNTP over SSL'},
  {port:'587',  proto:'TCP',          service:'SMTP Submission (STARTTLS)'},
  {port:'591',  proto:'TCP',          service:'FileMaker'},
  {port:'631',  proto:'TCP',          service:'IPP (Internet Printing)'},
  {port:'636',  proto:'TCP/UDP',      service:'LDAPS (LDAP over SSL)'},
  {port:'646',  proto:'TCP/UDP',      service:'LDP (MPLS)'},
  {port:'873',  proto:'TCP',          service:'rsync'},
  {port:'902',  proto:'TCP/UDP',      service:'VMware Server'},
  {port:'989',  proto:'TCP',          service:'FTPS Data'},
  {port:'990',  proto:'TCP',          service:'FTPS Control'},
  {port:'993',  proto:'TCP',          service:'IMAPS (IMAP over SSL)'},
  {port:'995',  proto:'TCP/UDP',      service:'POP3S (POP3 over SSL)'},
  {port:'1080', proto:'TCP/UDP',      service:'SOCKS Proxy'},
  {port:'1194', proto:'TCP/UDP',      service:'OpenVPN'},
  {port:'1433', proto:'TCP',          service:'MS SQL Server'},
  {port:'1434', proto:'TCP/UDP',      service:'MS SQL Browser'},
  {port:'1494', proto:'TCP',          service:'Citrix ICA'},
  {port:'1512', proto:'TCP/UDP',      service:'WINS'},
  {port:'1701', proto:'UDP',          service:'L2TP'},
  {port:'1723', proto:'TCP/UDP',      service:'PPTP'},
  {port:'1812', proto:'TCP/UDP',      service:'RADIUS Authentication'},
  {port:'1813', proto:'TCP/UDP',      service:'RADIUS Accounting'},
  {port:'2049', proto:'TCP/UDP',      service:'NFS'},
  {port:'2181', proto:'TCP',          service:'ZooKeeper'},
  {port:'2375', proto:'TCP',          service:'Docker API (unencrypted)'},
  {port:'2376', proto:'TCP',          service:'Docker API (TLS)'},
  {port:'2379', proto:'TCP',          service:'etcd Client'},
  {port:'2380', proto:'TCP',          service:'etcd Peer'},
  {port:'2383', proto:'TCP',          service:'MS SQL Analysis Services'},
  {port:'3000', proto:'TCP',          service:'Grafana'},
  {port:'3128', proto:'TCP/UDP',      service:'HTTP Proxy (Squid)'},
  {port:'3260', proto:'TCP/UDP',      service:'iSCSI Target'},
  {port:'3306', proto:'TCP/UDP',      service:'MySQL'},
  {port:'3389', proto:'TCP',          service:'RDP (Remote Desktop)'},
  {port:'3690', proto:'TCP/UDP',      service:'SVN (Subversion)'},
  {port:'4500', proto:'UDP',          service:'IPSec NAT Traversal'},
  {port:'5000', proto:'TCP',          service:'UPnP'},
  {port:'5060', proto:'TCP/UDP',      service:'SIP (VoIP)'},
  {port:'5061', proto:'TCP',          service:'SIP-TLS'},
  {port:'5222', proto:'TCP',          service:'XMPP (Jabber) Client'},
  {port:'5269', proto:'TCP',          service:'XMPP Server-to-Server'},
  {port:'5353', proto:'UDP',          service:'mDNS (Bonjour)'},
  {port:'5432', proto:'TCP',          service:'PostgreSQL'},
  {port:'5672', proto:'TCP',          service:'RabbitMQ AMQP'},
  {port:'5800', proto:'TCP',          service:'VNC over HTTP'},
  {port:'5900', proto:'TCP',          service:'VNC'},
  {port:'6379', proto:'TCP',          service:'Redis'},
  {port:'6443', proto:'TCP',          service:'Kubernetes API Server'},
  {port:'6514', proto:'TCP',          service:'Syslog over TLS'},
  {port:'8000', proto:'TCP',          service:'Splunk Web UI'},
  {port:'8080', proto:'TCP',          service:'HTTP Proxy / Alt HTTP'},
  {port:'8200', proto:'TCP',          service:'HashiCorp Vault'},
  {port:'8443', proto:'TCP',          service:'HTTPS Alternate'},
  {port:'8500', proto:'TCP',          service:'Consul HTTP API'},
  {port:'9042', proto:'TCP',          service:'Cassandra'},
  {port:'9090', proto:'TCP',          service:'Prometheus'},
  {port:'9092', proto:'TCP',          service:'Kafka Broker'},
  {port:'9100', proto:'TCP',          service:'PDL / Network Printing'},
  {port:'9200', proto:'TCP',          service:'Elasticsearch HTTP API'},
  {port:'9300', proto:'TCP',          service:'Elasticsearch Transport'},
  {port:'10161',proto:'TCP',          service:'SNMP Agent (TLS)'},
  {port:'10162',proto:'TCP',          service:'SNMP Trap (TLS)'},
  {port:'27017',proto:'TCP/UDP',      service:'MongoDB'},
  {port:'51820',proto:'UDP',          service:'WireGuard VPN'},
];

let homeCheatRendered = false;

function toggleHomeCheat() {
  const body    = document.getElementById('homeCheatBody');
  const chevron = document.getElementById('cheatChevron');
  if (!body) return;
  const isOpen = body.style.display !== 'none';
  body.style.display = isOpen ? 'none' : '';
  chevron.classList.toggle('open', !isOpen);
  if (!homeCheatRendered && !isOpen) {
    renderHomeCheat();
    homeCheatRendered = true;
  }
}

function renderHomeCheat() {
  const list = document.getElementById('homeCheatGrid');
  const countEl = document.getElementById('homeCheatCount');
  if (!list) return;
  // Keep the sticky header (first child), remove old rows
  while (list.children.length > 1) list.removeChild(list.lastChild);

  HOME_PORT_DATA.forEach(p => {
    const row = document.createElement('div');
    row.className = 'hcl-row';
    row.dataset.search = (p.port + ' ' + p.service + ' ' + p.proto).toLowerCase();
    row.innerHTML =
      '<span class="hcl-port">' + p.port + '</span>' +
      '<span class="hcl-proto">' + p.proto + '</span>' +
      '<span class="hcl-service">' + p.service + '</span>';
    list.appendChild(row);
  });

  if (countEl) countEl.textContent = HOME_PORT_DATA.length + ' ports';
}

function homeFilterPorts(query) {
  const q = query.toLowerCase().trim();
  const rows = document.querySelectorAll('.hcl-row');
  const countEl = document.getElementById('homeCheatCount');
  let visible = 0;
  rows.forEach(row => {
    const match = !q || row.dataset.search.includes(q);
    row.style.display = match ? '' : 'none';
    if (match) visible++;
  });
  if (countEl) countEl.textContent = visible + ' port' + (visible !== 1 ? 's' : '');
  let nr = document.getElementById('homeCheatNoResult');
  if (!nr) {
    nr = document.createElement('div');
    nr.id = 'homeCheatNoResult';
    nr.className = 'hcl-no-results';
    nr.textContent = 'No ports found.';
    document.getElementById('homeCheatGrid').appendChild(nr);
  }
  nr.style.display = visible === 0 ? '' : 'none';
}
