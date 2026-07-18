import { useEffect, useRef, useState } from 'react'; import { riderService } from '../../services/resource.service';

const views=['Default','Satellite','Terrain'];
const overlays=['Traffic','Transit','Street View'];

export function LiveMapPage(){
  const mapRef=useRef(null);const[riders,setRiders]=useState([]);
  const [view,setView]=useState('Default');
  const [overlay,setOverlay]=useState('Traffic');
  const [focus,setFocus]=useState(true);
  const [zoom,setZoom]=useState(10);
  useEffect(()=>{const controller=new AbortController();riderService.list({},controller.signal).then(setRiders).catch(()=>{});return()=>controller.abort();},[]);
  useEffect(()=>{const key=import.meta.env.VITE_GOOGLE_MAPS_API_KEY;if(!key||!mapRef.current)return;let cancelled=false;const render=()=>{if(cancelled)return;const map=new window.google.maps.Map(mapRef.current,{center:{lat:0.3476,lng:32.5825},zoom:mapRef.current.dataset.zoom?Number(mapRef.current.dataset.zoom):zoom,mapTypeId:view==='Satellite'?'satellite':view==='Terrain'?'terrain':'roadmap'});riders.filter(r=>r.location?.lat&&r.location?.lng).forEach(r=>new window.google.maps.Marker({map,position:r.location,title:r.name}));};if(window.google?.maps)render();else{let script=document.querySelector('script[data-wolan-google-maps]');if(!script){script=document.createElement('script');script.dataset.wolanGoogleMaps='true';script.src=`https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}`;script.async=true;document.head.appendChild(script);}script.addEventListener('load',render,{once:true});}return()=>{cancelled=true;};},[riders,view,zoom]);
  return <div className={`live-map-page ${view.toLowerCase()} ${focus?'focus':''}`}>
    <div className="map-command-bar">
      <div className="command-label"><i/><b>Live Command<br/>View - All</b></div>
      <div className="map-option-group"><span>View</span>{views.map(item=><button className={view===item?'active':''} onClick={()=>setView(item)} key={item}>{item}</button>)}</div>
      <div className="map-option-group overlays"><span>Overlays</span>{overlays.map(item=><button className={overlay===item?'active':''} onClick={()=>setOverlay(item)} key={item}>{item}</button>)}</div>
      <div className="active-count"><b>{riders.filter(r=>r.availability!=='Offline').length}</b><span>Active</span></div>
      <div className="map-signal">⌾ &nbsp; Mapbox - {view}</div>
      <div className="map-signal">▱ &nbsp; {overlay}</div>
      <button className={`focus-button ${focus?'active':''}`} onClick={()=>setFocus(!focus)}>◉ &nbsp; 3D Focus</button>
      <div className="map-signal alert-signal">△ &nbsp; 0 Mismatch Alerts</div>
    </div>
    <div className="gps-toast"><span>⌁</span><div><b>Waiting for rider GPS</b><p>Planned route shown. Live traffic ETA starts automatically after the next GPS fix.</p></div></div>
    <div className="map-canvas" ref={mapRef}>{!import.meta.env.VITE_GOOGLE_MAPS_API_KEY&&<><div className="map-pin">Add VITE_GOOGLE_MAPS_API_KEY</div><div className="map-roads road-a"/><div className="map-roads road-b"/></>}</div>
    <div className="map-tools primary"><button>▥</button><button>⌁</button><button className="active">⌘</button></div>
    <div className="map-tools secondary"><button onClick={()=>setZoom(z=>z+1)}>⊕</button><button onClick={()=>setZoom(z=>z-1)}>⊖</button><button>▱</button><button>➤</button></div>
    <div className="map-bottom"><div><button>⌾ &nbsp; Zones</button><button>◇ &nbsp; Packages</button></div><span>Mapbox style active | {overlay} layer active | Zoom {zoom}</span></div>
  </div>;
}
