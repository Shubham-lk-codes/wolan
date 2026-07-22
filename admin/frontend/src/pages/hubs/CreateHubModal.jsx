import { useEffect, useMemo, useState } from 'react';
import { adminService, hubService } from '../../services/resource.service';

const initialForm = Object.freeze({
  name: '', code: '', address: '', city: '', region: '', country: 'Uganda', zone: '',
  phone: '', email: '', lat: '', lng: '', dailyTarget: '150', active: true,
  managerId: '', managerName: '', managerEmail: '', managerPhone: '', managerPassword: '',
});

export function CreateHubModal({ assignedManagerIds = [], onClose, onCreated }) {
  const [form, setForm] = useState(initialForm);
  const [managers, setManagers] = useState([]);
  const [loadingManagers, setLoadingManagers] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const assigned = useMemo(() => new Set(assignedManagerIds.map(String)), [assignedManagerIds]);
  const availableManagers = useMemo(() => managers.filter(manager => !assigned.has(String(manager._id))), [assigned, managers]);
  const creatingManager = !form.managerId;

  useEffect(() => {
    const controller = new AbortController();
    adminService.users({ role: 'HUB_MANAGER', limit: 100 }, controller.signal)
      .then(setManagers)
      .catch(fetchError => {
        if (fetchError.code !== 'ERR_CANCELED') setError('Existing managers could not be loaded. You can still create a new manager below.');
      })
      .finally(() => setLoadingManagers(false));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const close = event => { if (event.key === 'Escape' && !submitting) onClose(); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [onClose, submitting]);

  const change = event => {
    const { name, type, checked, value } = event.target;
    setForm(current => ({
      ...current,
      [name]: type === 'checkbox' ? checked : name === 'code' ? value.toUpperCase().replace(/\s+/g, '_') : value,
    }));
  };

  async function submit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        name: form.name,
        code: form.code,
        address: form.address,
        city: form.city,
        region: form.region,
        country: form.country,
        zone: form.zone,
        phone: form.phone,
        email: form.email,
        coordinates: { lat: Number(form.lat), lng: Number(form.lng) },
        dailyTarget: Number(form.dailyTarget),
        status: form.active ? 'ACTIVE' : 'SUSPENDED',
        ...(form.managerId ? { managerId: form.managerId } : {
          manager: {
            name: form.managerName,
            email: form.managerEmail || undefined,
            phone: form.managerPhone || undefined,
            password: form.managerPassword || undefined,
          },
        }),
      };
      const result = await hubService.create(payload);
      onCreated(result);
    } catch (submitError) {
      const details = submitError.response?.data?.error?.details;
      const fieldMessage = Object.values(details?.fieldErrors || {}).flat()[0] || details?.formErrors?.[0];
      setError(fieldMessage || submitError.response?.data?.message || 'Hub could not be created.');
    } finally {
      setSubmitting(false);
    }
  }

  return <div className="create-hub-backdrop" onMouseDown={event => event.target === event.currentTarget && !submitting && onClose()}>
    <form className="create-hub-modal" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="create-hub-title">
      <header>
        <div><h2 id="create-hub-title">Create Hub</h2><p>Hub profile, manager assignment, and operational status</p></div>
        <button type="button" onClick={onClose} disabled={submitting} aria-label="Close">×</button>
      </header>
      <main>
        <div className="create-hub-grid">
          <input name="name" value={form.name} onChange={change} placeholder="Hub name" aria-label="Hub name" required minLength="2"/>
          <input name="code" value={form.code} onChange={change} placeholder="Hub code" aria-label="Hub code" required pattern="[A-Z0-9][A-Z0-9_-]{1,23}"/>
          <input name="address" value={form.address} onChange={change} placeholder="Address" aria-label="Address" required minLength="3"/>
          <input name="city" value={form.city} onChange={change} placeholder="City" aria-label="City" required/>
          <input name="region" value={form.region} onChange={change} placeholder="State / region" aria-label="State or region" required/>
          <input name="country" value={form.country} onChange={change} placeholder="Country" aria-label="Country" required/>
          <input name="zone" value={form.zone} onChange={change} placeholder="Zone" aria-label="Zone" required/>
          <input name="phone" type="tel" value={form.phone} onChange={change} placeholder="Contact phone" aria-label="Contact phone" required/>
          <input name="email" type="email" value={form.email} onChange={change} placeholder="Contact email" aria-label="Contact email" required/>
          <input name="lat" type="number" step="any" min="-90" max="90" value={form.lat} onChange={change} placeholder="Hub latitude" aria-label="Hub latitude" required/>
          <input name="lng" type="number" step="any" min="-180" max="180" value={form.lng} onChange={change} placeholder="Hub longitude" aria-label="Hub longitude" required/>
          <select name="managerId" value={form.managerId} onChange={change} aria-label="Existing Hub Manager">
            <option value="">Create a new Hub Manager</option>
            {availableManagers.map(manager => <option value={manager._id} key={manager._id}>{manager.name} · {manager.email || manager.phone}</option>)}
          </select>
          <input name="dailyTarget" type="number" min="0" max="100000" value={form.dailyTarget} onChange={change} placeholder="Daily target" aria-label="Daily target" required/>
          <label className="create-hub-active"><input name="active" type="checkbox" checked={form.active} onChange={change}/><span>Active</span></label>
        </div>
        <p className="hub-geofence-note">Hub latitude and longitude define the rider collection geofence. Riders can collect scanned packages only while their live GPS is near this hub.</p>
        <section className={`hub-manager-account ${creatingManager ? '' : 'existing'}`}>
          <header><i aria-hidden="true">⌘</i><div><h3>{creatingManager ? 'Create Hub Manager Login' : 'Assign Existing Hub Manager'}</h3><p>{creatingManager ? 'Enter a new manager below. A secure temporary password will be generated if left blank.' : 'This manager will be assigned to the new hub with hub-only access.'}</p></div></header>
          {creatingManager && <div className="hub-manager-fields">
            <input name="managerName" value={form.managerName} onChange={change} placeholder="Manager full name" aria-label="Manager full name" required/>
            <input name="managerEmail" type="email" value={form.managerEmail} onChange={change} placeholder="Manager email" aria-label="Manager email" required/>
            <input name="managerPhone" type="tel" value={form.managerPhone} onChange={change} placeholder="Phone number" aria-label="Manager phone number" required/>
            <input name="managerPassword" type="text" minLength="8" value={form.managerPassword} onChange={change} placeholder="Temporary password (auto-generate if blank)" aria-label="Temporary password"/>
          </div>}
          <div className="hub-manager-confirmation">Saving this hub will {creatingManager ? 'create the new manager above' : 'assign the selected manager'} with hub-only access through the existing Admin Login.</div>
        </section>
        {loadingManagers && <div className="create-hub-status">Loading existing Hub Managers…</div>}
        {error && <div className="create-hub-error" role="alert">{error}</div>}
      </main>
      <footer><button type="button" onClick={onClose} disabled={submitting}>Cancel</button><button className="save" disabled={submitting}>{submitting ? 'Saving Hub…' : 'Save Hub'}</button></footer>
    </form>
  </div>;
}
