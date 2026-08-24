const request = require('supertest');
const { app } = require('../server');
const AuditLog = require('../models/AuditLog');
const { connect, closeDatabase, clearDatabase } = require('./setup/testDb');
const { createUser, signToken } = require('./helpers/factories');

beforeAll(async () => {
  await connect();
});

afterEach(async () => {
  await clearDatabase();
});

afterAll(async () => {
  await closeDatabase();
});

describe('blocking a user', () => {
  it('writes an audit log entry with the correct actor, action, and target', async () => {
    const { user: staff } = await createUser({ role: 'staff' });
    const staffToken = signToken(staff);
    const { user: member } = await createUser({ role: 'member' });

    const res = await request(app)
      .put(`/api/users/${member._id}/block`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(200);

    const entry = await AuditLog.findOne({ action: 'user.block', targetId: member._id });
    expect(entry).not.toBeNull();
    expect(entry.actor.toString()).toBe(staff._id.toString());
    expect(entry.targetType).toBe('User');
    expect(entry.details.targetEmail).toBe(member.email);
  });
});

describe('role change and delete actions', () => {
  it('each write a correct audit log entry', async () => {
    const { user: admin } = await createUser({ role: 'admin' });
    const adminToken = signToken(admin);
    const { user: memberForRoleChange } = await createUser({ role: 'member' });
    const { user: memberForDelete } = await createUser({ role: 'member' });

    const roleRes = await request(app)
      .put(`/api/users/${memberForRoleChange._id}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'staff' });
    expect(roleRes.status).toBe(200);

    const roleEntry = await AuditLog.findOne({ action: 'user.roleChange', targetId: memberForRoleChange._id });
    expect(roleEntry).not.toBeNull();
    expect(roleEntry.details.from).toBe('member');
    expect(roleEntry.details.to).toBe('staff');
    // Regression coverage: role-change entries used to omit the target's
    // name/email entirely, unlike block/unblock/delete which all include it.
    expect(roleEntry.details.targetName).toBe(memberForRoleChange.name);
    expect(roleEntry.details.targetEmail).toBe(memberForRoleChange.email);

    const deleteRes = await request(app)
      .delete(`/api/users/${memberForDelete._id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(deleteRes.status).toBe(200);

    const deleteEntry = await AuditLog.findOne({ action: 'user.delete', targetId: memberForDelete._id });
    expect(deleteEntry).not.toBeNull();
    expect(deleteEntry.targetId.toString()).toBe(memberForDelete._id.toString());
  });
});

describe('GET /api/audit-log', () => {
  it('is admin-only (member and staff tokens get 403)', async () => {
    const { user: member } = await createUser({ role: 'member' });
    const { user: staff } = await createUser({ role: 'staff' });
    const memberToken = signToken(member);
    const staffToken = signToken(staff);

    const memberRes = await request(app).get('/api/audit-log').set('Authorization', `Bearer ${memberToken}`);
    expect(memberRes.status).toBe(403);

    const staffRes = await request(app).get('/api/audit-log').set('Authorization', `Bearer ${staffToken}`);
    expect(staffRes.status).toBe(403);
  });

  it('returns entries most-recent-first, and the ?action= filter works correctly', async () => {
    const { user: admin } = await createUser({ role: 'admin' });
    const adminToken = signToken(admin);
    const { user: actor } = await createUser({ role: 'staff' });
    const { user: target } = await createUser({ role: 'member' });

    const now = Date.now();
    const blockEntry = await AuditLog.create({
      actor: actor._id,
      action: 'user.block',
      targetType: 'User',
      targetId: target._id,
      timestamp: new Date(now - 3 * 60 * 1000),
    });
    const unblockEntry = await AuditLog.create({
      actor: actor._id,
      action: 'user.unblock',
      targetType: 'User',
      targetId: target._id,
      timestamp: new Date(now - 2 * 60 * 1000),
    });
    const roleChangeEntry = await AuditLog.create({
      actor: actor._id,
      action: 'user.roleChange',
      targetType: 'User',
      targetId: target._id,
      timestamp: new Date(now - 1 * 60 * 1000),
    });

    const allRes = await request(app).get('/api/audit-log').set('Authorization', `Bearer ${adminToken}`);
    expect(allRes.status).toBe(200);

    const ids = allRes.body.map((e) => e._id);
    const blockIndex = ids.indexOf(blockEntry._id.toString());
    const unblockIndex = ids.indexOf(unblockEntry._id.toString());
    const roleChangeIndex = ids.indexOf(roleChangeEntry._id.toString());
    expect(blockIndex).toBeGreaterThan(-1);
    expect(unblockIndex).toBeGreaterThan(-1);
    expect(roleChangeIndex).toBeGreaterThan(-1);
    // most-recent-first: roleChange (now-1m) before unblock (now-2m) before block (now-3m)
    expect(roleChangeIndex).toBeLessThan(unblockIndex);
    expect(unblockIndex).toBeLessThan(blockIndex);

    const timestamps = allRes.body.map((e) => new Date(e.timestamp).getTime());
    for (let i = 1; i < timestamps.length; i += 1) {
      expect(timestamps[i]).toBeLessThanOrEqual(timestamps[i - 1]);
    }

    const filteredRes = await request(app)
      .get('/api/audit-log?action=user.roleChange')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(filteredRes.status).toBe(200);
    expect(filteredRes.body.every((e) => e.action === 'user.roleChange')).toBe(true);

    const filteredIds = filteredRes.body.map((e) => e._id);
    expect(filteredIds).toContain(roleChangeEntry._id.toString());
    expect(filteredIds).not.toContain(blockEntry._id.toString());
    expect(filteredIds).not.toContain(unblockEntry._id.toString());
  });
});
