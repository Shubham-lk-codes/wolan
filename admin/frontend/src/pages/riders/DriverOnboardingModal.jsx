import { useEffect, useState } from 'react';
import { hubService, riderService } from '../../services/resource.service';

const initial = { name: '', phone: '', email: '', password: '', hubId: '', yearsExperience: 0, district: '', division: '', specificStage: '', stageChairmanContact: '', vehicleType: 'Moto / Boda Boda', plateNumber: '', nationalId: '', kinName: '', kinPhone: '', kinRelationship: '', legalAccepted: false };
const cancelled = error => error?.code === 'ERR_CANCELED' || error?.name === 'CanceledError';

function Field({ label, name, type = 'text', placeholder, required = true, min, children, value, onChange }) {
  return <label>{label}{children || <input name={name} type={type} placeholder={placeholder} required={required} min={min} minLength={name === 'password' ? 8 : undefined} value={value} onChange={onChange} />}</label>;
}

export function DriverOnboardingModal({ onClose, onCreated }) {
  const [form, setForm] = useState(initial);
  const [hubs, setHubs] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    hubService.list({ status: 'Active' }, controller.signal).then(items => {
      setHubs(items);
      setForm(current => ({ ...current, hubId: current.hubId || items[0]?._id || '' }));
      setError('');
    }).catch(loadError => { if (!cancelled(loadError)) setError('Active hubs could not be loaded.'); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const close = event => event.key === 'Escape' && onClose();
    document.addEventListener('keydown', close);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', close); document.body.style.overflow = previous; };
  }, [onClose]);

  const change = event => setForm(current => ({ ...current, [event.target.name]: event.target.type === 'checkbox' ? event.target.checked : event.target.value }));

  async function submit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const rider = await riderService.onboard({
        name: form.name.trim(), phone: form.phone.trim(), email: form.email.trim(), password: form.password, hubId: form.hubId,
        yearsExperience: Number(form.yearsExperience), district: form.district.trim(), division: form.division.trim(),
        specificStage: form.specificStage.trim(), stageChairmanContact: form.stageChairmanContact.trim(), vehicleType: form.vehicleType,
        plateNumber: form.plateNumber.trim(), nationalId: form.nationalId.trim(),
        nextOfKin: { name: form.kinName.trim(), phone: form.kinPhone.trim(), relationship: form.kinRelationship.trim() }, legalAccepted: form.legalAccepted,
      });
      onCreated(rider);
    } catch (submitError) {
      setError(submitError.response?.data?.message || 'Driver could not be added. Check every field and try again.');
    } finally { setSubmitting(false); }
  }

  return <div className="driver-modal-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}>
    <form className="driver-modal" onSubmit={submit}>
      <header><div><span>ADMIN DRIVER ONBOARDING</span><h2>Add New Driver</h2><p>Create the login and rider profile for the selected hub. Dispatch access remains locked until KYC documents, legal acceptance, and admin approval are complete.</p></div><button type="button" onClick={onClose} aria-label="Close">×</button></header>
      <div className="driver-modal-scroll">
        <div className="driver-form-grid">
          <Field label="Full Name" name="name" placeholder="Rider full name" value={form.name} onChange={change} />
          <Field label="Phone Number" name="phone" type="tel" placeholder="+256..." value={form.phone} onChange={change} />
          <Field label="Email" name="email" type="email" placeholder="Required for password setup" value={form.email} onChange={change} />
          <Field label="Temporary Password" name="password" type="password" placeholder="Minimum 8 characters" value={form.password} onChange={change} />
          <Field label="Assigned Hub"><select name="hubId" required value={form.hubId} onChange={change}><option value="">Select active hub</option>{hubs.map(hub => <option value={hub._id} key={hub._id}>{hub.name} - {hub.code} ({hub.city})</option>)}</select></Field>
          <Field label="Years of Experience" name="yearsExperience" type="number" min="0" value={form.yearsExperience} onChange={change} />
          <Field label="District" name="district" placeholder="Kampala" value={form.district} onChange={change} />
          <Field label="Division" name="division" placeholder="Central" value={form.division} onChange={change} />
          <Field label="Specific Boda Stage" name="specificStage" placeholder="Pioneer Mall Stage" value={form.specificStage} onChange={change} />
          <Field label="Stage Chairman Contact" name="stageChairmanContact" type="tel" placeholder="+256..." value={form.stageChairmanContact} onChange={change} />
          <Field label="Vehicle Type"><select name="vehicleType" value={form.vehicleType} onChange={change}><option>Moto / Boda Boda</option><option>Voiture / Car/Van</option><option>Bicycle</option></select></Field>
          <Field label="Bike / Vehicle Plate" name="plateNumber" placeholder="UXX 123X" value={form.plateNumber} onChange={change} />
          <Field label="National ID / Passport" name="nationalId" placeholder="NIN or passport number" value={form.nationalId} onChange={change} />
        </div>
        <fieldset><legend>Next of Kin</legend><div><input name="kinName" placeholder="Name" required value={form.kinName} onChange={change} /><input name="kinPhone" type="tel" placeholder="Phone" required value={form.kinPhone} onChange={change} /><input name="kinRelationship" placeholder="Relationship" required value={form.kinRelationship} onChange={change} /></div></fieldset>
        <label className="driver-legal"><input name="legalAccepted" type="checkbox" checked={form.legalAccepted} onChange={change} required /><span><b>Legal acceptance confirmed</b><small>The administrator confirms the driver accepted the platform, privacy, safety, and dispatch terms. The account remains locked pending KYC approval.</small></span></label>
        {error && <div className="warning-note" role="alert">{error}</div>}
      </div>
      <footer><button type="button" onClick={onClose}>Cancel</button><button className="primary" disabled={submitting || !hubs.length}><span>＋</span>{submitting ? 'Adding Driver...' : 'Add Driver'}</button></footer>
    </form>
  </div>;
}
