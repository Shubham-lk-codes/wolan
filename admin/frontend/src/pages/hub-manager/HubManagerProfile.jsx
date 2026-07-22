import { useCallback } from 'react';
import { useApiQuery } from '../../hooks/useApiQuery';
import { hubManagerService } from '../../services/resource.service';
import { useAuth } from '../../state/AuthContext';

export function HubManagerProfile(){
  const{user}=useAuth();
  const loader=useCallback(signal=>hubManagerService.context(signal),[]);
  const{data,error}=useApiQuery(loader,{hub:null,metrics:{}});
  const hub=data.hub;
  return <div className="hub-manager-profile"><section><span>Hub manager profile</span><h1>{user?.name}</h1><p>Your identity and hub assignment are supplied by the existing admin authentication system.</p>{error&&<div className="warning-note">{error}</div>}<div className="profile-facts">{[['Role',user?.role],['Email',user?.email],['Phone',user?.phone],['Assigned Hub',user?.hubId],['Hub Name',hub?.name],['Hub Status',hub?.status]].map(([label,value])=><div key={label}><span>{label}</span><b>{value||'Not set'}</b></div>)}</div></section><aside><b>Access isolation</b><p>This account can operate only on records assigned to {hub?.name||user?.hubId||'its hub'}. Hub scope is enforced by the backend and cannot be changed from the browser.</p></aside></div>;
}
