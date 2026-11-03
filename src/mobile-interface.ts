import {S,sizePx,templateEl,card} from './model';
import {$} from './dom';
import {renderStage} from './preview';
import {chooseEditorLayout,fitCardZoom,EditorLayout} from './mobile-mode';
import {installMobileGestures} from './mobile-touch';

type Panel='none'|'add'|'file'|'export'|'layers'|'cards'|'images'|'properties';
const root=document.documentElement,app=$('.app') as HTMLElement,outer=$('#canvasOuter') as HTMLElement;
const key='cardstudio.interface-layout';
const mobile=()=>root.dataset.layout==='mobile';
const menus:Record<string,Array<[string,string]>>={
 add:[['add-text','Add text'],['add-image','Add image frame'],['add-shape','Add shape']],
 file:[['new-project','New project'],['open-project','Open project'],['load-template','Open template'],['save-project','Save project'],['save-project-as','Save project as…'],['save-template','Save template'],['save-template-as','Save template as…']],
 export:[['export-current','Export current PNG'],['export-all','Export all cards ZIP'],['export-sheet','Export staging XLSX'],['import-sheet','Import card data CSV/XLSX']]
};
let panel:Panel='none',autoFit=true;
function preference():EditorLayout|null{
 try{const v=localStorage.getItem(key);return v==='desktop'||v==='mobile'?v:null}catch{return null}
}
function fitCanvas(){
 if(!mobile())return;
 const {w,h}=sizePx();S.zoom=fitCardZoom(outer.clientWidth,outer.clientHeight,w,h);
 renderStage();outer.scrollLeft=0;outer.scrollTop=0;autoFit=true;
}
function refresh(){
 if(!document.getElementById('mobileShell'))return;
 const title=document.getElementById('mobileProjectName');if(title)title.textContent=S.projectName;
 const name=document.getElementById('mobileCardLabel');if(name)name.textContent=(card()?.name||'Card')+' · '+(S.cardIndex+1)+' / '+S.cards.length;
 const nav=document.getElementById('mobileCardNav');if(nav)nav.hidden=S.mode!=='cards';
 const selected=S.selected?templateEl(S.selected):null;
 const context=document.getElementById('mobileSelection');if(context)context.hidden=!selected&&S.mode!=='cards';
 const selectedName=document.getElementById('mobileSelectionName');if(selectedName)selectedName.textContent=selected?selected.name:'Card data';
 const scope=document.getElementById('mobileSelectionScope');if(scope)scope.textContent=S.mode==='template'?'Changes every card':'Changes only this card';
 document.querySelectorAll('.m-mode [data-action]').forEach(node=>{
  const button=node as HTMLElement,active=button.dataset.action==='mode-'+S.mode;
  button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));
 });
 document.querySelectorAll('.m-dock [data-mobile]').forEach(node=>node.classList.toggle('active',(node as HTMLElement).dataset.mobile===panel));
}
function closePanel(){panel='none';root.dataset.mobilePanel='none';refresh()}
function showPanel(next:Panel){
 if(!mobile())return;
 if(panel===next){closePanel();return}
 panel=next;root.dataset.mobilePanel=next;
 const label=document.getElementById('mobilePanelTitle');if(label)label.textContent=({add:'Add element',file:'Project',export:'Export'} as any)[next]||next;
 const list=document.getElementById('mobileActionList');
 if(list&&menus[next]){
  list.replaceChildren();
  for(const [action,labelText] of menus[next]){
   const button=document.createElement('button');button.dataset.action=action;button.textContent=labelText;list.append(button);
  }
  if(next==='file'&&root.dataset.appTarget!=='mobile'){
   const button=document.createElement('button');button.dataset.mobile='switch';button.textContent='Switch to desktop layout';list.append(button);
  }
 }
 refresh();
}
function setLayout(next:EditorLayout,remember=false){
 if(remember){try{localStorage.setItem(key,next)}catch{}}
 const previous=root.dataset.layout;root.dataset.layout=next;closePanel();
 if(previous!==next&&next==='mobile')requestAnimationFrame(fitCanvas);
 refresh();
}
function autoLayout(){
 const selected=root.dataset.appTarget==='mobile'?'mobile':chooseEditorLayout(innerWidth,matchMedia('(pointer: coarse)').matches,preference());
 if(root.dataset.layout!==selected)setLayout(selected);
 else if(selected==='mobile'&&autoFit)requestAnimationFrame(fitCanvas);
}
function start(){
 const header=document.createElement('header');header.id='mobileShell';header.className='m-header';
 header.innerHTML='<div class="m-appbar"><button data-mobile="file" aria-label="Project menu">☰</button><strong id="mobileProjectName">Card Studio</strong><button data-action="save-project">Save</button><button data-mobile="export">Export</button></div><div class="m-mode" role="group" aria-label="Editing mode"><button data-action="mode-template">Template</button><button data-action="mode-cards">Cards</button></div>';
 app.prepend(header);
 const nav=document.createElement('div');nav.id='mobileCardNav';nav.className='m-card-nav';
 nav.innerHTML='<button data-action="prev-card" aria-label="Previous card">‹</button><button data-mobile="cards" id="mobileCardLabel">Card</button><button data-action="next-card" aria-label="Next card">›</button>';
 $('.viewport').append(nav);
 const context=document.createElement('div');context.id='mobileSelection';context.className='m-selection';
 context.innerHTML='<div><strong id="mobileSelectionName"></strong><small id="mobileSelectionScope"></small></div><button data-mobile="properties">Edit properties</button>';
 app.append(context);
 const dock=document.createElement('nav');dock.className='m-dock';dock.setAttribute('aria-label','Mobile editing tools');
 dock.innerHTML='<button data-mobile="add"><span>＋</span>Add</button><button data-mobile="layers"><span>▤</span>Layers</button><button data-mobile="cards"><span>▦</span>Cards</button><button data-mobile="images"><span>▧</span>Images</button><button data-mobile="properties"><span>⚙</span>Properties</button><button data-mobile="fit"><span>⛶</span>Fit</button>';
 app.append(dock);
 const scrim=document.createElement('button');scrim.className='m-scrim';scrim.dataset.mobile='close';scrim.setAttribute('aria-label','Close panel');app.append(scrim);
 const sheet=document.createElement('section');sheet.className='m-actions';sheet.setAttribute('aria-label','Mobile actions');
 sheet.innerHTML='<div class="m-sheet-head"><strong id="mobilePanelTitle"></strong><button data-mobile="close" aria-label="Close panel">✕</button></div><div id="mobileActionList" class="m-action-list"></div>';app.append(sheet);
 const leftHead=document.createElement('div');leftHead.className='m-sheet-head m-only';leftHead.innerHTML='<strong>Library</strong><button data-mobile="close" aria-label="Close panel">✕</button>';$('.side-left').prepend(leftHead);
 const rightClose=document.createElement('button');rightClose.className='m-only m-close';rightClose.dataset.mobile='close';rightClose.textContent='✕';rightClose.setAttribute('aria-label','Close properties');$('.side-right .side-head').append(rightClose);
 const desktopSwitch=document.createElement('button');desktopSwitch.dataset.mobile='switch';desktopSwitch.textContent='Switch to mobile layout';$('.file-menu-panel').append(desktopSwitch);
 // Capture before desktop actions repaint and detach the clicked panel row.
 document.addEventListener('click',(e:MouseEvent)=>{
  const target=e.target as HTMLElement,control=target.closest('[data-mobile]') as HTMLElement|null;
  if(control){
   const command=control.dataset.mobile||'';
   if(command==='switch')setLayout(mobile()?'desktop':'mobile',true);
   else if(command==='close')closePanel();
   else if(command==='fit'){fitCanvas();closePanel()}
   else showPanel(command as Panel);
  }
  if(mobile()&&(target.closest('.m-actions [data-action]')||target.closest('.side-left [data-action]')||target.closest('[data-layer]')||target.closest('.sidebar-cards [data-cardindex]')))closePanel();
  requestAnimationFrame(refresh);
 },true);
 document.addEventListener('keydown',(e:KeyboardEvent)=>{if(e.key==='Escape'&&panel!=='none')closePanel()});
 document.addEventListener('change',()=>queueMicrotask(refresh));
 document.addEventListener('pointerup',()=>queueMicrotask(refresh));
 window.addEventListener('resize',autoLayout);
 installMobileGestures(refresh,()=>{autoFit=false});
 autoLayout();refresh();
}
// The existing headless desktop smoke harness has no real browser viewport.
if(document.documentElement && typeof window.matchMedia==='function' && typeof app.prepend==='function')start();
