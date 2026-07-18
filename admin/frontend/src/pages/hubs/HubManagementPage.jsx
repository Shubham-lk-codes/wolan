import { useEffect, useMemo, useState } from 'react';
import { hubService } from '../../services/resource.service';

const emptyHub={name:'',location:'',city:'',region:'',zone:'',manager:'',phone:'',email:'',dailyTarget:100,lat:'',lng:''};
const mapHub=hub=>({...hub,id:hub.code,contact:hub.manager,dbId:hub._id});

function HubMetric({label,value,note,tone='purple',icon}){return <div className="hub-metric"><div><span>{label}</span><b className={`hub-metric-value hub-tone-${tone}`}>{value}</b><small>{note}</small></div><i className={`hub-metric-icon hub-tone-${tone}`}>{icon}</i></div>}
function ComparisonChart({hubs}){return <section className="hub-comparison"><div><h3>Hub Comparison - Orders and Revenue</h3><p>Network performance across all hubs</p></div><b>|||</b><div className="hub-chart"><div>{[4,3,2,1,0].map(value=><span key={value}>{value}</span>)}</div><main>{[0,1,2,3,4].map(value=><i style={{top:`${value*25}%`}} key={value}/>)}<footer>{hubs.map(hub=><span key={hub.id}>{hub.name.split(' ')[0]}</span>)}</footer></main><aside>{[4,3,2,1,0].map(value=><span key={value}>{value}</span>)}</aside></div></section>}

function HubForm({hub,onCancel,onSave}){
  const initial=hub?{name:hub.name||'',location:hub.location||'',city:hub.city||'',region:hub.region||'',zone:hub.zone||'',manager:hub.manager||'',phone:hub.phone||'',email:hub.email||'',dailyTarget:hub.dailyTarget??100,lat:hub.coordinates?.lat??'',lng:hub.coordinates?.lng??''}:emptyHub;
  const[form,setForm]=useState(initial),[saving,setSaving]=useState(false),[error,setError]=useState('');
  const change=event=>setForm(current=>({...current,[event.target.name]:event.target.value}));
  async function submit(event){event.preventDefault();setSaving(true);setError('');try{const{lat,lng,...values}=form;await onSave({...values,dailyTarget:Number(values.dailyTarget),manager:values.manager||'Unassigned',coordinates:lat!==''&&lng!==''?{lat:Number(lat),lng:Number(lng)}:undefined})}catch(err){setError(err.response?.data?.message||'Hub could not be saved.')}finally{setSaving(false)}}
  return <form className="hub-create-form hub-operational-form" onSubmit={submit}>
    <div className="hub-form-title"><b>{hub?'Edit Hub':'New Operational Hub'}</b><span>Operational, contact, target, and map fields</span></div>
    <input name="name" value={form.name} onChange={change} placeholder="Hub name" required/><input name="location" value={form.location} onChange={change} placeholder="Street / building" required/><input name="city" value={form.city} onChange={change} placeholder="City" required/><input name="region" value={form.region} onChange={change} placeholder="Region"/><input name="zone" value={form.zone} onChange={change} placeholder="Zone"/><input name="manager" value={form.manager} onChange={change} placeholder="Manager"/><input name="phone" type="tel" value={form.phone} onChange={change} placeholder="Hub phone"/><input name="email" type="email" value={form.email} onChange={change} placeholder="Hub email"/><input name="dailyTarget" type="number" min="0" value={form.dailyTarget} onChange={change} placeholder="Daily target"/><input name="lat" type="number" step="any" min="-90" max="90" value={form.lat} onChange={change} placeholder="Latitude"/><input name="lng" type="number" step="any" min="-180" max="180" value={form.lng} onChange={change} placeholder="Longitude"/>
    <div className="hub-form-actions"><button type="button" onClick={onCancel}>Cancel</button><button disabled={saving}>{saving?'Saving...':hub?'Save Hub':'Create Hub'}</button></div>{error&&<div className="warning-note">{error}</div>}
  </form>;
}

function SelectedHub({hub,onSuspend,onEdit}){return <section className="selected-hub"><div className="selected-hub-title"><div><span>Selected Hub</span><h2>{hub.name}</h2><p>{hub.location}</p></div><div><button type="button" onClick={onEdit}>Edit &nbsp; Manage</button><button type="button" onClick={onSuspend}>{hub.status==='Suspended'?'Reactivate':'X  Suspend'}</button></div></div><div className="selected-hub-facts">{[['Code',hub.id],['City',hub.city],['Zone',hub.zone],['Manager',hub.manager],['Phone',hub.phone],['Email',hub.email]].map(([label,value])=><div key={label}><span>{label}</span><b title={value}>{value||'Not set'}</b></div>)}</div></section>}
function HubCard({hub,selected,onSelect,onEdit}){return <article className={`hq-hub-card ${selected?'selected':''}`}><div className="hq-card-title"><i>◇</i><div><h3>{hub.name}</h3><p>{hub.location}</p></div><span>{hub.status||'Active'}</span></div><p className="hub-contact">Pin &nbsp; {hub.contact||'Unassigned'}</p><div className="hub-card-stats"><p><b>0</b><span>Orders</span></p><p><b className="purple">{hub.manager&&hub.manager!=='Unassigned'?1:0}</b><span>Manager</span></p><p><b className="orange">{hub.dailyTarget||0}</b><span>Daily target</span></p></div><div className="hub-revenue"><span>{hub.city||'City not set'}</span><span>{hub.zone||'Zone not set'}</span></div><footer><button onClick={onSelect}>Eye &nbsp; View</button><button onClick={onEdit}>Edit &nbsp; Manage</button></footer></article>}
function HubTable({hubs,onSelect}){return <section className="hub-table"><div className="hub-table-head"><span>Hub</span><span>Code</span><span>City / Zone</span><span>Manager</span><span>Target</span><span>Phone</span><span>Status</span><span>Action</span></div>{hubs.map(hub=><div className="hub-table-row" key={hub.id}><b>{hub.name}</b><b>{hub.id}</b><span>{hub.city} / {hub.zone}</span><span>{hub.manager}</span><b>{hub.dailyTarget||0}</b><span>{hub.phone||'Not set'}</span><span className="hub-active">{hub.status||'Active'}</span><button onClick={()=>onSelect(hub.id)}>Manage</button></div>)}</section>}
function Isolation(){return <section className="hub-isolation"><div><span>Hub-Level Access Isolation</span><h3>HQ admins can manage the full hub network</h3></div><b>Shield</b><main><p><b>Hub records</b><span>All hubs visible</span></p><p><b>Manager assignment</b><span>Allowed</span></p><p><b>Suspend/reactivate</b><span>Allowed</span></p></main></section>}

export function HubManagementPage(){
  const[hubs,setHubs]=useState([]),[view,setView]=useState('Cards'),[selectedId,setSelectedId]=useState(''),[query,setQuery]=useState(''),[formMode,setFormMode]=useState(''),[error,setError]=useState('');
  useEffect(()=>{
    const controller=new AbortController();
    hubService.list({},controller.signal)
      .then(items=>{
        const mapped=items.map(mapHub);
        setHubs(mapped);
        setSelectedId(current=>current||mapped[0]?.id||'');
        setError('');
      })
      .catch(err=>{
        if(controller.signal.aborted||err.code==='ERR_CANCELED'||err.name==='CanceledError')return;
        setError(err.response?.data?.message||'Hubs could not be loaded.');
      });
    return()=>controller.abort();
  },[]);
  const selected=hubs.find(hub=>hub.id===selectedId)||hubs[0];
  const visible=useMemo(()=>hubs.filter(hub=>`${hub.name} ${hub.manager} ${hub.id} ${hub.city} ${hub.zone}`.toLowerCase().includes(query.toLowerCase())),[hubs,query]);
  async function saveHub(payload){if(formMode==='edit'&&selected?.dbId){const updated=mapHub(await hubService.update(selected.dbId,payload));setHubs(items=>items.map(item=>item.id===selected.id?updated:item));setSelectedId(updated.id);setFormMode('');return}const created=mapHub(await hubService.create(payload));setHubs(items=>[created,...items]);setSelectedId(created.id);setFormMode('')}
  async function toggleHub(){if(!selected?.dbId)return;try{const status=selected.status==='Suspended'?'Active':'Suspended';const updated=mapHub(await hubService.update(selected.dbId,{status}));setHubs(items=>items.map(item=>item.id===selected.id?updated:item))}catch(err){setError(err.response?.data?.message||'Hub status could not be changed.')}}
  const activeCount=hubs.filter(hub=>hub.status!=='Suspended').length;
  return <div className="hub-management-page">
    <div className="hub-page-heading"><div><h1>Hub Management - HQ Master View</h1><p>{hubs.length} hubs across Uganda</p></div><label className="hub-inline-search"><span>Q</span><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search hubs, managers..."/></label><div className="hub-view-toggle"><button className={view==='Cards'?'active':''} onClick={()=>setView('Cards')}>Cards</button><button className={view==='Table'?'active':''} onClick={()=>setView('Table')}>Table</button></div><button className="new-hub-button" onClick={()=>setFormMode(formMode==='create'?'':'create')}>+ &nbsp; New Hub</button></div>
    {formMode&&<HubForm key={`${formMode}-${selectedId}`} hub={formMode==='edit'?selected:null} onCancel={()=>setFormMode('')} onSave={saveHub}/>} {error&&<div className="warning-note">{error}</div>}
    <div className="hub-network-metrics"><HubMetric label="Total Hubs" value={hubs.length} note={`${activeCount} active`} icon="◇"/><HubMetric label="Assigned Managers" value={hubs.filter(hub=>hub.manager&&hub.manager!=='Unassigned').length} note="Hub managers assigned" tone="violet" icon="S"/><HubMetric label="Monthly Orders" value="0" note="All hubs combined" tone="green" icon="R"/><HubMetric label="Total Daily Target" value={hubs.reduce((sum,hub)=>sum+(hub.dailyTarget||0),0)} note="All active hubs" tone="orange" icon="#"/><HubMetric label="Network Active Rate" value={`${hubs.length?Math.round(activeCount/hubs.length*100):0}%`} note="Active hub ratio" tone="green" icon="~"/></div>
    <ComparisonChart hubs={hubs}/>{selected&&<SelectedHub hub={selected} onSuspend={toggleHub} onEdit={()=>setFormMode('edit')}/>}<>{view==='Cards'?<div className="hq-hub-grid">{visible.map(hub=><HubCard hub={hub} selected={hub.id===selectedId} onSelect={()=>setSelectedId(hub.id)} onEdit={()=>{setSelectedId(hub.id);setFormMode('edit')}} key={hub.id}/>)}</div>:<HubTable hubs={visible} onSelect={id=>{setSelectedId(id);setFormMode('edit')}}/>}</><Isolation/>
  </div>;
}
