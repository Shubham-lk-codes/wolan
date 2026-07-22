import { useEffect, useMemo, useState } from 'react';
import { merchantService } from '../../services/resource.service';
import { getApiError } from '../../services/api';
import { AddMerchantModal } from './AddMerchantModal';

const seedMerchants = [];

const tiers = ['All','Starter','Active','Priority','Elite'];
const merchantSummaryCards = [
  ['Total Merchants', 'totalMerchants'],
  ['Elite Tier', 'eliteTier', 'orange'],
  ['Priority Tier', 'priorityTier', 'purple'],
  ['Elite Escalations', 'eliteEscalations'],
  ['KYC Pending', 'kycPending', 'red'],
  ['Total COD Pending', 'totalCodPending', 'red', true],
  ['M2M Referrals', 'm2mReferrals', 'green'],
];

const pageMerchant = merchant => ({
  ...merchant,
  id: merchant.merchantCode || merchant._id,
  initials: merchant.name.split(/\s+/).map(word => word[0]).join('').slice(0, 2),
  kyc: merchant.kycStatus,
  wallet: merchant.walletBalance ?? 0,
  cod: merchant.codBalance ?? 0,
  joined: new Date(merchant.createdAt).toLocaleDateString(),
});

function MerchantCard({ merchant, selected, onSelect }) {
  return <button className={`merchant-roster-card ${selected ? 'selected' : ''}`} onClick={onSelect}>
    <div className="merchant-card-head"><span className="merchant-initials">{merchant.initials}</span><div><b>{merchant.name}</b><small>{merchant.owner}</small></div><em>{merchant.tier}</em></div>
    <div className="merchant-badges"><span className={merchant.kyc.includes('Needed') ? 'needed' : 'verified'}>{merchant.kyc}</span>{merchant.locked && <span className="locked-badge">Locked</span>}</div>
    <div className="merchant-card-metrics"><div><b>{merchant.deliveries}</b><span>All Time</span></div><div><b>{merchant.referrals}</b><span>Referrals</span></div><div><b className="green-text">{merchant.cod}</b><span>COD Orders</span></div></div>
    <div className="merchant-level"><span>Level Progress</span><b>{merchant.progress || 0}%</b><i><u style={{width:`${Math.max(0,merchant.progress || 0)}%`}}/></i></div>
    <div className="merchant-money"><p><span>Wallet Balance</span><b>0 UGX</b></p><p><span>Pending COD</span><b>0 UGX</b></p></div>
    <footer><span>Pin &nbsp;{merchant.address}</span><span>Phone &nbsp;{merchant.phone}</span></footer>
  </button>;
}

function Overview({ merchant }) { return <>
  <div className="merchant-info-list"><Info icon="U" label="Owner" value={merchant.owner}/><Info icon="P" label="Phone" value={merchant.phone}/><Info icon="L" label="Address" value={merchant.address}/><Info icon="B" label="Total Deliveries" value={merchant.deliveries}/><Info icon="S" label="KYC Status" value={merchant.kyc}/><Info icon="M" label="M2M Referrals" value={merchant.referrals}/></div>
  <div className="merchant-detail-box"><label>Financial Overview</label><p><span>Wallet Balance</span><b className="green-text">{merchant.wallet} UGX</b></p><p><span>Pending COD</span><b>{merchant.cod} UGX</b></p><p><span>COD Status</span><b>Disabled</b></p></div>
  <div className="merchant-detail-box social"><label>Social Channels in QR</label>{['WhatsApp','TikTok','Instagram','Facebook'].map((x,i)=><div key={x}><span>{x}</span><input defaultValue={[merchant.phone,'@wolandeliver','@wolandelivery','wolandelivery'][i]}/></div>)}<button>Save Social Channels</button></div>
  </>; }

function Info({icon,label,value}) { return <div className="merchant-info"><i>{icon}</i><p><span>{label}</span><b>{value}</b></p></div>; }
function DetailPlaceholder({tab, merchant}) { return <div className="merchant-detail-box detail-placeholder"><label>{tab}</label><h3>{merchant.name}</h3><p>The merchant's {tab.toLowerCase()} controls and records appear here.</p><button>Open {tab} Action</button></div>; }

function MerchantDetail({ merchant }) {
  const [tab,setTab]=useState('Overview');
  return <aside className="merchant-detail">
    <div className="merchant-detail-title"><span className="merchant-initials large">{merchant.initials}</span><div><h2>{merchant.name}</h2><p>{merchant.id.toLowerCase()}a8cded7404136470a</p></div></div>
    <div className="merchant-joined"><span>{merchant.tier}</span><p>Joined {merchant.joined}</p></div>
    <div className="merchant-detail-tabs">{['Overview','Finance','Legal','KYC','Actions'].map(name=><button className={tab===name?'active':''} onClick={()=>setTab(name)} key={name}>{name}</button>)}</div>
    <div className="merchant-detail-scroll">{tab==='Overview'?<Overview merchant={merchant}/>:<DetailPlaceholder tab={tab} merchant={merchant}/>}</div>
  </aside>;
}

export function MerchantsPage(){
  const [merchants,setMerchants]=useState(seedMerchants);
  const [summary,setSummary]=useState(null);
  const [error,setError]=useState('');
  const [showAddMerchant,setShowAddMerchant]=useState(false);
  useEffect(()=>{
    const controller=new AbortController();
    const failed=requestError=>{if(requestError.code!=='ERR_CANCELED')setError(getApiError(requestError));};
    merchantService.list({},controller.signal).then(items=>setMerchants(items.map(pageMerchant))).catch(failed);
    merchantService.summary(controller.signal).then(setSummary).catch(failed);
    return()=>controller.abort();
  },[]);
  const [tier,setTier]=useState('All');
  const [query,setQuery]=useState('');
  const [selectedId,setSelectedId]=useState('');
  const filtered=useMemo(()=>merchants.filter(m=>(tier==='All'||m.tier===tier)&&`${m.name} ${m.owner} ${m.phone}`.toLowerCase().includes(query.toLowerCase())),[tier,query]);
  const selected=merchants.find(m=>m.id===selectedId)||filtered[0];
  function merchantCreated(created){const item=pageMerchant(created);setMerchants(items=>[item,...items]);setSelectedId(item.id);setShowAddMerchant(false);merchantService.summary().then(setSummary).catch(requestError=>setError(getApiError(requestError)))}
  const summaryValue=(key,currency)=>summary ? `${Number(summary[key]??0).toLocaleString()}${currency?` ${summary.currency||'UGX'}`:''}` : '—';
  const escalationCount=summary?.eliteEscalations;
  return <div className="merchants-page">
    <div className="merchants-workspace">
      <div className="merchant-tools"><button className="add-merchant" onClick={()=>setShowAddMerchant(true)}>+ &nbsp; Add Merchant</button><label className="merchant-search"><span>Q</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search merchants..."/></label><div className="merchant-tier-tabs">{tiers.map(name=><button className={tier===name?'active':''} onClick={()=>setTier(name)} key={name}>{name}</button>)}</div></div>
      {error&&<div className="warning-note" role="alert">{error}</div>}
      <div className="merchant-stats">{merchantSummaryCards.map(([label,key,tone,currency])=><Stat label={label} value={summaryValue(key,currency)} tone={tone} key={key}/>)}</div>
      <section className="priority-queue"><div><span>Priority Queue</span><h3>Elite merchant escalations</h3></div><em>{escalationCount==null?'Loading…':`${escalationCount} active`}</em><p>{escalationCount>0?`${escalationCount} unresolved ${escalationCount===1?'escalation requires':'escalations require'} support intervention.`:'No active Elite escalations. Open an escalation from an Elite merchant profile when support intervention is needed.'}</p></section>
      <div className="merchant-roster">{filtered.map(m=><MerchantCard merchant={m} selected={selected?.id===m.id} onSelect={()=>setSelectedId(m.id)} key={m.id}/>)}</div>
    </div>
    {selected&&<MerchantDetail merchant={selected}/>} {showAddMerchant&&<AddMerchantModal onClose={()=>setShowAddMerchant(false)} onCreated={merchantCreated}/>} 
  </div>;
}

function Stat({label,value,tone=''}){return <div className="merchant-stat"><span>{label}</span><b className={tone}>{value}</b></div>}
