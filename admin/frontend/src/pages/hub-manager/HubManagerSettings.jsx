import { useCallback, useEffect, useState } from 'react';
import { hubManagerService } from '../../services/resource.service';

const sections = ['Dispatch', 'Notifications', 'Working Hours'];

function Toggle({ label, note, checked, onChange }) {
  return <div className="setting-toggle"><p><b>{label}</b><span>{note}</span></p><button type="button" role="switch" aria-checked={checked} className={checked?'on':''} onClick={()=>onChange(!checked)}><i/></button></div>;
}

function SaveButton({ busy, message, onClick }) {
  return <div className="hub-settings-actions"><button className="settings-save" type="button" disabled={busy} onClick={onClick}>{busy?'Saving…':'Save Changes'}</button>{message&&<small>{message}</small>}</div>;
}

function NumberField({ label, name, value, onChange, step = 1 }) {
  return <label>{label}<input type="number" min={step} step={step} name={name} value={value} onChange={onChange}/></label>;
}

export function HubManagerSettings() {
  const [active,setActive]=useState('Dispatch');
  const [settings,setSettings]=useState(null);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');
  useEffect(()=>{const controller=new AbortController();hubManagerService.settings(controller.signal).then(setSettings).catch(requestError=>setError(requestError.response?.data?.message||'Hub settings could not be loaded.'));return()=>controller.abort()},[]);
  const update=useCallback((section,name,value)=>setSettings(current=>({...current,[section]:{...current[section],[name]:value}})),[]);
  const numberChange=section=>event=>update(section,event.target.name,Number(event.target.value));
  async function save(section){setBusy(true);setMessage('');setError('');try{const result=await hubManagerService.saveSettings({[section]:settings[section]});setSettings(result);setMessage('Saved for the assigned hub.')}catch(requestError){setError(requestError.response?.data?.message||'Settings could not be saved.')}finally{setBusy(false)}}
  if(!settings)return <div className="settings-page-v2 hub-manager-settings"><aside className="settings-nav">{sections.map((section,index)=><button className={active===section?'active':''} onClick={()=>setActive(section)} key={section}><span>{index+1}</span>{section}</button>)}</aside><main className="settings-content">{error?<div className="warning-note">{error}</div>:<div className="empty-state">Loading assigned hub settings…</div>}</main></div>;
  const dispatch=settings.dispatch;
  const notifications=settings.notifications;
  const workingHours=settings.workingHours;
  return <div className="settings-page-v2 hub-manager-settings">
    <aside className="settings-nav">{sections.map((section,index)=><button className={active===section?'active':''} onClick={()=>{setActive(section);setMessage('');setError('')}} key={section}><span>{index+1}</span>{section}</button>)}</aside>
    <main className="settings-content">
      <div className="hub-settings-scope"><b>Assigned hub settings</b><span>Only dispatch, notification, and working-hours configuration can be changed from this account.</span></div>
      {error&&<div className="warning-note" role="alert">{error}</div>}
      {active==='Dispatch'&&<section className="settings-panel"><header><h2>Dispatch Configuration</h2></header><div className="settings-fields three"><NumberField label="Max Orders per Rider" name="maxOrdersPerDriver" value={dispatch.maxOrdersPerDriver} onChange={numberChange('dispatch')}/><NumberField label="Delivery ETA Default (min)" name="defaultDeliveryEtaMinutes" value={dispatch.defaultDeliveryEtaMinutes} onChange={numberChange('dispatch')}/><NumberField label="Assignment Zone Radius (km)" name="assignmentRadiusKm" value={dispatch.assignmentRadiusKm} step={0.1} onChange={numberChange('dispatch')}/><NumberField label="Idle Alert Threshold (min)" name="idleAlertMinutes" value={dispatch.idleAlertMinutes} onChange={numberChange('dispatch')}/><NumberField label="GPS Dark Alert Threshold (min)" name="gpsDarkAlertMinutes" value={dispatch.gpsDarkAlertMinutes} onChange={numberChange('dispatch')}/><NumberField label="COD Remit Deadline (hrs)" name="codRemitDeadlineHours" value={dispatch.codRemitDeadlineHours} onChange={numberChange('dispatch')}/></div><div className="hub-settings-toggles"><Toggle label="Auto-assign nearest available rider" note="Use availability and distance for dispatch." checked={dispatch.autoAssignNearestDriver} onChange={value=>update('dispatch','autoAssignNearestDriver',value)}/><Toggle label="Prioritize Elite merchant orders" note="Keep priority merchant work ahead in the queue." checked={dispatch.prioritizeEliteMerchants} onChange={value=>update('dispatch','prioritizeEliteMerchants',value)}/><Toggle label="Block offline riders" note="Offline riders cannot receive assignments." checked={dispatch.blockOfflineDrivers} onChange={value=>update('dispatch','blockOfflineDrivers',value)}/><Toggle label="Allow rider self-assignment" note="Permit compatible riders to claim open work." checked={dispatch.allowDriverSelfAssignment} onChange={value=>update('dispatch','allowDriverSelfAssignment',value)}/></div><SaveButton busy={busy} message={message} onClick={()=>save('dispatch')}/></section>}
      {active==='Notifications'&&<section className="settings-panel"><header><h2>Notification Preferences</h2></header><Toggle label="New Order" note="Alert the hub when a new order enters dispatch." checked={notifications.newOrder} onChange={value=>update('notifications','newOrder',value)}/><Toggle label="Driver Offline" note="Alert when an active rider loses availability or GPS." checked={notifications.driverOffline} onChange={value=>update('notifications','driverOffline',value)}/><Toggle label="Failed Delivery" note="Alert operations when a delivery fails." checked={notifications.failedDelivery} onChange={value=>update('notifications','failedDelivery',value)}/><Toggle label="COD Alert" note="Alert when COD exposure or remittance needs attention." checked={notifications.codAlert} onChange={value=>update('notifications','codAlert',value)}/><Toggle label="Delay Alert" note="Alert when a delivery exceeds its ETA." checked={notifications.delayAlert} onChange={value=>update('notifications','delayAlert',value)}/><SaveButton busy={busy} message={message} onClick={()=>save('notifications')}/></section>}
      {active==='Working Hours'&&<section className="settings-panel"><header><h2>Working Hours</h2></header><div className="settings-fields three">{[['Monday - Friday','mondayFriday'],['Saturday','saturday'],['Sunday','sunday']].map(([label,name])=><label key={name}>{label}<input value={workingHours[name]} onChange={event=>update('workingHours',name,event.target.value)}/></label>)}</div><SaveButton busy={busy} message={message} onClick={()=>save('workingHours')}/></section>}
    </main>
  </div>;
}
