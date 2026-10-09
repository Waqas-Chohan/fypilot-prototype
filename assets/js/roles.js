/* ==========================================================================
   FYPilot - roles.js (Activity 2)
   Role-preview page for Panelist / Coordinator / Library roles.
   ========================================================================== */
(function () {
  "use strict";

  const $ = (sel, ctx) => (ctx || document).querySelector(sel);

  const session = window.FYP.requireRole(["panelist", "coordinator", "library"]);
  if (!session) return;

  const META = {
    panelist: { label: "Panelist", accent: "var(--role-panelist)", icon: "&#128221;" },
    coordinator: { label: "Coordinator", accent: "var(--role-coordinator)", icon: "&#128202;" },
    library: { label: "Library Staff", accent: "var(--role-library)", icon: "&#128218;" }
  };

  const m = META[session.role] || META.coordinator;

  const tag = $("#rpRoleTag");
  const name = $("#rpRoleName");
  const icon = $("#rpIcon");
  const user = $("#rpUser");
  const logout = $("#rpLogout");

  if (tag) tag.textContent = m.label;
  if (name) name.textContent = m.label;
  if (icon) {
    icon.style.background = m.accent;
    icon.style.color = "#fff";
    icon.innerHTML = m.icon;
  }
  if (user) user.textContent = session.name;
  if (logout) logout.addEventListener("click", function (e) {
    e.preventDefault();
    window.FYP.logout();
  });
})();
