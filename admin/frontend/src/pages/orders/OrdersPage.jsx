import { useEffect, useMemo, useState } from 'react';
import { useDemo } from '../../state/DemoContext';
import { orderService } from '../../services/order.service';
import { merchantService, riderService } from '../../services/resource.service';
import { NewOrderModal } from './NewOrderModal';

const statuses = ['All', 'Pending', 'Picked Up', 'At Hub', 'Out for Delivery', 'Delivered', 'Failed', 'Returned'];
const zones = ['All Zones', 'CBD', 'Kawempe', 'Ntinda', 'Makindye', 'Nakawa', 'Rubaga'];
const fallbackRiders = [];

const money = value => `UGX ${Number(value || 0).toLocaleString()}`;
const statusClass = status => status.toLowerCase().replaceAll(' ', '-');

function Summary({ order }) {
  return <div className="summary-pane">
    <Info label="Merchant"><b>{order.merchant}</b></Info>
    <Info label="Customer"><b>{order.customer}</b><span>{order.phone}</span><span>Location: {order.address}</span></Info>
    <div className="detail-box tracking">
      <label>Tracking IDs</label>
      <div className="pickup-key"><span>Pickup Key</span><b>{order.pickupKey}</b></div>
      <p><span>Rider Tracking</span><b>{order.riderTrackingId}</b></p>
      <p><span>Package Tracking</span><b>{order.packageTrackingId}</b></p>
      <p><span>Physical Tracker</span><b className="ok">Not linked</b></p>
    </div>
    <Info label="Assigned Rider"><div className="assigned"><i>R</i><div><b>{order.rider || 'Unassigned'}</b><small>{order.rider ? '+256 704 225 510' : 'Assign after hub scan'}</small></div></div></Info>
  </div>;
}

function Info({ label, children }) { return <div className="info"><label>{label}</label>{children}</div>; }

function Workflow({ order }) {
  const { verifyPickup, scanAtHub } = useDemo();
  const [pickupKey, setPickupKey] = useState('');
  const [scanCode, setScanCode] = useState('');
  const [message, setMessage] = useState('');
  const handoverDone = order.pickupVerified || order.status !== 'Pending';
  const dispatched = ['Out for Delivery', 'Delivered'].includes(order.status);

  async function run(action) {
    const result = await action();
    setMessage(result?.ok === false ? result.message : 'Control verified successfully.');
  }

  return <div className="workflow-pane">
    {message && <div className={message.startsWith('Control') ? 'success-note' : 'warning-note'}>{message}</div>}
    <div className="detail-box"><label>Assignment Status</label><h3>{order.rider ? 'Accepted' : 'Awaiting assignment'}</h3><p>Merchant handover: <b>{handoverDone ? 'Verified' : 'Required'}</b></p><p>Hub scan-in: <b>{order.hubScanned ? 'Verified' : 'Required'}</b></p></div>
    <div className="detail-box">
      <div className="box-title"><label>Merchant Handover</label><span className={handoverDone ? 'verified' : 'locked'}>{handoverDone ? 'Verified' : 'Required'}</span></div>
      <p>Verify the one-time merchant pickup key before hub scan-in and assignment.</p>
      <div className="form-row"><input value={pickupKey} onChange={event => setPickupKey(event.target.value)} placeholder="6-digit merchant pickup key" inputMode="numeric" maxLength={6}/></div>
      <button className="wide-action" disabled={handoverDone} onClick={() => run(() => verifyPickup(order.id, pickupKey))}>{handoverDone ? 'Handover Verified' : 'Verify Merchant Handover'}</button>
    </div>
    <div className="detail-box"><label>Hub Scan-In</label><h3 className={order.hubScanned ? 'ok' : ''}>{order.hubScanned ? 'Scanned into hub' : 'Awaiting scan'}</h3><p>Assignment stays locked until this scan passes.</p><input className="wide-input" value={scanCode} disabled={!handoverDone || order.hubScanned} onChange={event => setScanCode(event.target.value)} placeholder={order.packageTrackingId}/><button className="wide-secondary" disabled={!handoverDone || order.hubScanned} onClick={() => setScanCode(order.packageTrackingId)}>Use selected package code</button><button className="wide-action" disabled={!handoverDone || order.hubScanned} onClick={() => run(() => scanAtHub(order.id, scanCode))}>{order.hubScanned ? 'Hub Scan Confirmed' : 'Confirm Hub Scan-In'}</button></div>
    <div className="detail-box otp"><label>Driver Delivery Completion</label><h3>{order.status === 'Delivered' ? 'Delivery completed' : dispatched ? 'Awaiting driver OTP verification and proof' : 'Locked until dispatch'}</h3><p>The assigned driver completes this control from the driver application. Admin users can monitor the resulting status and proof record here.</p></div>
  </div>;
}

function Dispatch({ order, riders=fallbackRiders }) {
  const { assignRider, setOrderStatus } = useDemo();
  const [selectedRider, setSelectedRider] = useState(riders[0]?._id||'');
  const [message, setMessage] = useState('');
  async function assign() { const result = await assignRider(order.id, selectedRider); const name=riders.find(item=>item._id===selectedRider)?.name||'Driver'; setMessage(result?.ok === false ? result.message : `${name} assigned successfully.`); }
  return <div className="dispatch-pane">
    <div className="dispatch-facts"><p><span>Order Value</span><b>{money(order.value)}</b></p><p><span>Package Size</span><b>Medium</b></p><div>Pickup: <b>{order.merchant}</b><br/>Drop-off: <b>{order.address}</b><br/>Assigned hub: <b>{order.hubId}</b></div><p><span>Payment Type</span><b className="ok">{order.payment}</b></p></div>
    <div className="detail-box"><label>Automatic Delivery Pricing</label><p>Fee: <b>{money(order.fee)}</b></p><p>Zone: <b>{order.zone}</b></p><p>Service: <b>Standard</b></p></div>
    <select className="wide-input" value={selectedRider} onChange={event => setSelectedRider(event.target.value)}>{riders.map(rider => <option value={rider._id} key={rider._id}>{rider.name}</option>)}</select>
    <button className="wide-action" disabled={order.status === 'Delivered'} onClick={assign}>Auto-Assign Rider</button>
    {message && <div className={message.startsWith('Blocked') ? 'warning-note' : 'success-note'}>{message}</div>}
    {!order.hubScanned && <div className="warning-note">Confirm merchant handover and hub scan before assigning a rider.</div>}
    {order.publicTrackingToken && <a className="wide-secondary dispatch-track-link" href={`/track/${order.publicTrackingToken}`}>Open Customer Tracking Link</a>}
    <textarea id={`failure-${order.id}`} placeholder="Failure or return note"/><button className="wide-secondary" onClick={()=>setOrderStatus(order.id,'Failed',document.getElementById(`failure-${order.id}`)?.value)}>Mark Failed</button><button className="wide-secondary" onClick={()=>setOrderStatus(order.id,'Returned',document.getElementById(`failure-${order.id}`)?.value)}>Return to Merchant</button>
  </div>;
}

function History({ order }) { return <div className="detail-box history"><label>Status Timeline</label>{order.timeline.map((item, index) => <div className="timeline" key={`${item.label}-${index}`}><b>{item.label}</b><span>{order.status}</span><small>{item.at}</small></div>)}</div>; }

function OrderDetails({ order, riders }) {
  const [tab, setTab] = useState('Summary');
  return <aside className="order-detail">
    <div className="detail-title"><div><h2>{order.orderNumber || order.id}</h2><p>{new Date(order.createdAt).toLocaleString()}</p></div><span className={`detail-status ${statusClass(order.status)}`}>{order.status}</span></div>
    <div className="detail-tabs">{['Summary', 'Workflow', 'Dispatch', 'History'].map(name => <button className={tab === name ? 'active' : ''} onClick={() => setTab(name)} key={name}>{name}</button>)}</div>
    <div className="detail-scroll">{tab === 'Summary' && <Summary order={order}/>} {tab === 'Workflow' && <Workflow order={order}/>} {tab === 'Dispatch' && <Dispatch order={order} riders={riders}/>} {tab === 'History' && <History order={order}/>}</div>
  </aside>;
}

export function OrdersPage() {
  const { visibleOrders } = useDemo();
  const [orders,setOrders]=useState(visibleOrders);
  const [merchants,setMerchants]=useState([]);
  const [availableRiders,setAvailableRiders]=useState([]);
  const [selectedId, setSelectedId] = useState(visibleOrders[0]?.id);
  const [status, setStatus] = useState('All');
  const [zone, setZone] = useState('All Zones');
  const [query, setQuery] = useState('');
  const [merchant,setMerchant]=useState('');
  const [rider,setRider]=useState('');
  const [showCreate,setShowCreate]=useState(false);
  const [searching,setSearching]=useState(false);
  useEffect(()=>{const controller=new AbortController();Promise.all([merchantService.list({},controller.signal),riderService.list({},controller.signal)]).then(([merchantRows,riderRows])=>{setMerchants(merchantRows);setAvailableRiders(riderRows)}).catch(()=>{});return()=>controller.abort()},[]);
  useEffect(()=>{const controller=new AbortController();const timer=setTimeout(()=>{setSearching(true);orderService.list({q:query||undefined,status:status==='All'?undefined:status,zone:zone==='All Zones'?undefined:zone,merchant:merchant||undefined,rider:rider||undefined},controller.signal).then(setOrders).catch(()=>{}).finally(()=>setSearching(false))},250);return()=>{clearTimeout(timer);controller.abort()}},[query,status,zone,merchant,rider,visibleOrders]);
  const filtered = useMemo(() => orders,[orders]);
  const selected = orders.find(order => order.id === selectedId) || filtered[0];
  async function create(payload){const item=await orderService.create(payload);setOrders(rows=>[item,...rows]);setSelectedId(item.id);return item;}

  return <div className="orders-page">
    <div className="orders-workspace">
      <div className="orders-tools">
        <div className="tool-row"><button className="new-order" onClick={()=>setShowCreate(true)}>+ &nbsp; New Order</button><label className="order-search"><span>Q</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search by ID, merchant, customer"/>{searching&&<i/>}</label></div>
        <select className="select-button" value={merchant} onChange={event=>setMerchant(event.target.value)}><option value="">All merchants</option>{merchants.map(item=><option value={item._id} key={item._id}>{item.name}</option>)}</select>
        <select className="select-button" value={rider} onChange={event=>setRider(event.target.value)}><option value="">All riders</option>{availableRiders.map(item=><option value={item._id} key={item._id}>{item.name}</option>)}</select>
        <div className="zone-row">{zones.map(item => <button className={zone === item ? 'active' : ''} onClick={() => setZone(item)} key={item}>{item}</button>)}<button aria-label="More filters">Filter</button></div>
      </div>
      <div className="status-row">{statuses.map(item => <button className={status === item ? 'active' : ''} onClick={() => setStatus(item)} key={item}>{item}</button>)}</div>
      <div className="orders-table">
        <div className="orders-head"><span>Order ID</span><span>Merchant - Customer</span><span>Address</span><span>Zone</span><span>Rider</span><span>Status</span><span>Value</span><span>Actions</span></div>
        {filtered.map(order => <div className={`order-row ${selected?.id === order.id ? 'selected-order' : ''}`} onClick={() => setSelectedId(order.id)} key={order.id}><div><b>{order.orderNumber || order.id}</b><small>{new Date(order.createdAt).toLocaleString()}</small></div><div><b>{order.merchant}</b><small>{order.customer}</small></div><div><span>Pin &nbsp;{order.address}</span></div><div><span>{order.zone}</span></div><div>{order.rider || 'Unassigned'}</div><div><span className={`status-chip ${statusClass(order.status)}`}>{order.status}</span></div><div><b>{money(order.value)}</b><small>{order.payment}</small><strong>Fee {money(order.fee)}</strong><small>{order.packageSize||'Medium'} package</small></div><div><button aria-label="View on map">Pin</button><button aria-label="View tracking code">QR</button></div></div>)}
        {!filtered.length && <div className="empty-state">No orders match these filters.</div>}
      </div>
    </div>
    {selected && <OrderDetails order={selected} riders={availableRiders.filter(item=>!item.locked&&item.kycStatus==='KYC Verified')}/>} {showCreate&&<NewOrderModal onClose={()=>setShowCreate(false)} onCreate={create}/>} 
  </div>;
}
