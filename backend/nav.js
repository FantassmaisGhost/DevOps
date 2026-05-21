const NAV_LINKS = {
  patient: [
    { href: 'dashboard.html',        icon: '🏠', label: 'Dashboard' },
    { href: 'appointment_dash.html', icon: '📅', label: 'My Appointments' },
    { href: 'map.html',              icon: '🗺️', label: 'Book Appointment' },
    { href: 'notifications.html',    icon: '🔔', label: 'Notifications' },
    { href: 'clinic_app.html',       icon: 'ℹ️', label: 'Clinic Info' },
    { href: 'patient_profile.html',  icon: '👤', label: 'My Profile' },
  ],
  admin: [
    { href: 'admin-dashboard.html',  icon: '🏠', label: 'Dashboard' },
    { href: 'map.html',              icon: '🗺️', label: 'Clinic Map' },
    { href: 'SeeFacilities.html',    icon: '🏥', label: 'Facilities' },
    { href: 'Changetime.html',       icon: '⏰', label: 'Operating Hours' },
    { href: 'admin.html',            icon: '📋', label: 'Queue Management' },
  ],
  staff: [
    { href: 'staff-dashboard.html',       icon: '🏠', label: 'Dashboard' },
    { href: 'staff-unavailability.html',  icon: '📅', label: 'Set Unavailability' },
  ],
  receptionist: [
    { href: 'receptionist-dashboard.html',    icon: '🏠', label: 'Dashboard' },
    { href: 'receptionist-appointments.html', icon: '📅', label: 'Appointments' },
    { href: 'admin.html',                     icon: '📋', label: 'Queue Management' },
  ],
};

const ROLE_LABELS = {
  patient:              'Patient',
  admin:                'Admin',
  staff:                'Staff',
  receptionist:         'Receptionist',
  pending:              'Pending Approval',
  pending_receptionist: 'Pending Approval',
};

const CSS = `
#role-nav-overlay {
  display: none;
  position: fixed;
  inset: 0;
  background: rgba(24,22,15,0.55);
  z-index: 999;
  backdrop-filter: blur(2px);
}
#role-nav-overlay.rnav-open { display: block; }

#role-nav-drawer {
  position: fixed;
  top: 0; left: 0;
  height: 100vh;
  width: 252px;
  background: #18160F;
  z-index: 1000;
  transform: translateX(-100%);
  transition: transform 0.24s cubic-bezier(0.4,0,0.2,1);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  box-shadow: 4px 0 32px rgba(0,0,0,0.35);
}
#role-nav-drawer.rnav-open { transform: translateX(0); }

#rnav-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 18px;
  border-bottom: 1px solid rgba(247,244,238,0.1);
  flex-shrink: 0;
}
.rnav-logo {
  display: flex;
  align-items: center;
  gap: 9px;
}
.rnav-logo-icon {
  width: 26px; height: 26px;
  background: #00897B;
  border-radius: 5px;
  display: flex; align-items: center; justify-content: center;
  font-size: 13px; color: #fff;
  flex-shrink: 0;
}
.rnav-logo-name {
  font-size: 14px;
  font-weight: 700;
  color: #F7F4EE;
  letter-spacing: -0.01em;
}
#rnav-close {
  background: none;
  border: none;
  color: rgba(247,244,238,0.35);
  font-size: 18px;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 4px;
  line-height: 1;
  transition: color 0.13s, background 0.13s;
}
#rnav-close:hover { color: #F7F4EE; background: rgba(247,244,238,0.08); }

.rnav-role-strip {
  padding: 10px 18px 8px;
  border-bottom: 1px solid rgba(247,244,238,0.07);
}
.rnav-role-label {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(247,244,238,0.3);
}
.rnav-role-value {
  font-size: 12px;
  font-weight: 600;
  color: rgba(247,244,238,0.6);
  margin-top: 2px;
}

.rnav-list {
  list-style: none;
  padding: 10px 0;
  flex: 1;
}
.rnav-link {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 10px 18px;
  color: rgba(247,244,238,0.55);
  text-decoration: none;
  font-size: 13px;
  font-weight: 500;
  border-left: 3px solid transparent;
  transition: background 0.12s, color 0.12s, border-color 0.12s;
}
.rnav-link:hover {
  background: rgba(247,244,238,0.06);
  color: #F7F4EE;
}
.rnav-link.rnav-active {
  background: rgba(0,137,123,0.14);
  color: #00897B;
  border-left-color: #00897B;
}
.rnav-icon { font-size: 15px; flex-shrink: 0; width: 20px; text-align: center; }

#rnav-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(247,244,238,0.07);
  color: rgba(247,244,238,0.55);
  border: 1.5px solid rgba(247,244,238,0.12);
  border-radius: 7px;
  font-size: 12px;
  font-weight: 700;
  padding: 7px 13px;
  cursor: pointer;
  transition: color 0.13s, border-color 0.13s, background 0.13s;
  white-space: nowrap;
  letter-spacing: 0.01em;
  font-family: inherit;
  flex-shrink: 0;
  margin-right: 4px;
}
#rnav-toggle:hover {
  color: #F7F4EE;
  border-color: rgba(247,244,238,0.3);
  background: rgba(247,244,238,0.1);
}
`;

function init() {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  const role = localStorage.getItem('userRole') || 'patient';
  const links = NAV_LINKS[role] || NAV_LINKS.patient;
  const currentPage = location.pathname.split('/').pop() || '';

  // Overlay
  const overlay = document.createElement('div');
  overlay.id = 'role-nav-overlay';
  document.body.appendChild(overlay);

  // Drawer
  const drawer = document.createElement('nav');
  drawer.id = 'role-nav-drawer';
  drawer.setAttribute('aria-label', 'Main navigation');
  drawer.innerHTML = `
    <div id="rnav-header">
      <span class="rnav-logo">
        <span class="rnav-logo-icon">✚</span>
        <span class="rnav-logo-name">Health-Flow</span>
      </span>
      <button id="rnav-close" aria-label="Close navigation">✕</button>
    </div>
    <div class="rnav-role-strip">
      <div class="rnav-role-label">Signed in as</div>
      <div class="rnav-role-value">${ROLE_LABELS[role] || role}</div>
    </div>
    <ul class="rnav-list">
      ${links.map(l => {
        const active = l.href === currentPage;
        return `<li><a href="${l.href}" class="rnav-link${active ? ' rnav-active' : ''}"${active ? ' aria-current="page"' : ''}>
          <span class="rnav-icon">${l.icon}</span>
          <span>${l.label}</span>
        </a></li>`;
      }).join('\n')}
    </ul>
  `;
  document.body.appendChild(drawer);

  // Toggle button injected into topbar
  const topbar = document.querySelector('.topbar, .hf-topbar');
  if (topbar) {
    const toggle = document.createElement('button');
    toggle.id = 'rnav-toggle';
    toggle.setAttribute('aria-label', 'Open navigation menu');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.innerHTML = '☰ Menu';
    topbar.insertBefore(toggle, topbar.firstChild);
    toggle.addEventListener('click', openNav);
  }

  overlay.addEventListener('click', closeNav);
  drawer.querySelector('#rnav-close').addEventListener('click', closeNav);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && drawer.classList.contains('rnav-open')) closeNav();
  });

  function openNav() {
    drawer.classList.add('rnav-open');
    overlay.classList.add('rnav-open');
    document.body.style.overflow = 'hidden';
    const t = document.getElementById('rnav-toggle');
    if (t) t.setAttribute('aria-expanded', 'true');
  }

  function closeNav() {
    drawer.classList.remove('rnav-open');
    overlay.classList.remove('rnav-open');
    document.body.style.overflow = '';
    const t = document.getElementById('rnav-toggle');
    if (t) t.setAttribute('aria-expanded', 'false');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
