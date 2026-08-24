// Central place for the role checks used to gate admin-panel routes, nav
// links, and actions. Mirrors the role logic in backend/middleware/auth.js.

export function isAdmin(user) {
  return user?.role === 'admin';
}

export function isStaff(user) {
  return user?.role === 'staff';
}

// Staff and admin both get into the panel; only admin gets everything inside it.
export function isPanelUser(user) {
  return isAdmin(user) || isStaff(user);
}
