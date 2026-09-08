import { COOKIE_FIRST_TOUCH } from "@crm/db/attribution";
import { FORM_DEFAULT_ACCENT, type PublicFormConfig } from "@crm/db/forms";
import { COOKIE_NAME } from "@crm/db/tracking";

function safeJson(value: unknown): string {
	return JSON.stringify(value).replace(/</g, "\\u003c");
}

export function formSource(config: PublicFormConfig, endpoint: string): string {
	const accent = config.brandColor || FORM_DEFAULT_ACCENT;

	return `(function(){
try{
var C=${safeJson(config)},E=${safeJson(endpoint)},N=${safeJson(COOKIE_NAME)},FS=${safeJson(COOKIE_FIRST_TOUCH)},ACC=${safeJson(accent)};
var d=document;
if(!d.__janusForms)d.__janusForms={};
if(d.__janusForms[C.id])return;d.__janusForms[C.id]=1;
function decode(v){try{return decodeURIComponent(v)}catch(e){return null}}
function cookie(n){var m=d.cookie.match(new RegExp("(?:^|; )"+n+"=([^;]*)"));return m?decode(m[1]):null}
function param(q,k){var m=q.match(new RegExp("[?&]"+k+"=([^&]*)"));if(!m)return undefined;var v=decode(m[1].replace(/\\+/g," "));return v?v.slice(0,120):undefined}
function loc(){return d.location||{pathname:"/",search:"",hostname:""}}
function touch(){
 var L=loc(),q=L.search||"",t={landing:(L.pathname||"/").slice(0,120),at:Date.now()};
 var s=param(q,"utm_source"),m=param(q,"utm_medium");
 if(s)t.source=s;
 if(m)t.medium=m;
 var c=param(q,"utm_campaign");if(c)t.campaign=c;
 var tm=param(q,"utm_term");if(tm)t.term=tm;
 var ct=param(q,"utm_content");if(ct)t.content=ct;
 var r=d.referrer;
 if(r){try{if(new URL(r).hostname.toLowerCase()!==(L.hostname||"").toLowerCase())t.referrer=r.slice(0,300)}catch(e){}}
 return t}
function firstTouch(){
 var v=cookie(FS);
 if(!v)return null;
 try{return JSON.parse(v)}catch(e){return null}}
function el(tag){return d.createElement(tag)}
function text(node,s){node.textContent=s}
function run(){
try{
var renderedAt=Date.now();
var vid=cookie(N);
var last=touch();
var first=firstTouch()||last;
var FIELDS=C.fields||[];
var target=d.querySelector('[data-janus-form="'+C.id+'"]');
var inline=!!target;
var host=target;
if(!host){
 host=el("div");
 if(host.style)host.style.cssText="position:fixed;bottom:16px;right:16px;z-index:2147483000;font-family:sans-serif";
 d.body.appendChild(host)}
var root=host.attachShadow({mode:"open"});
var style=el("style");
text(style,"*{box-sizing:border-box}.jf{font-family:inherit;background:#fff;border:1px solid #e2e2e2;border-radius:8px;padding:16px;max-width:320px;box-shadow:0 4px 24px rgba(0,0,0,.12)}.jf h3{margin:0 0 8px;font-size:16px}.jf p{margin:0 0 12px;font-size:13px;color:#555}.jf label{display:block;font-size:12px;margin:8px 0 4px}.jf input,.jf select,.jf textarea{width:100%;padding:6px 8px;border:1px solid #ccc;border-radius:4px;font-size:13px;font-family:inherit}.jf button{margin-top:12px;width:100%;padding:8px;border:0;border-radius:4px;background:"+ACC+";color:#fff;font-size:13px;cursor:pointer}.jf .jf-err{color:#c0392b;font-size:12px;margin-top:4px;min-height:14px}.jf-hp{position:absolute;left:-9999px;top:-9999px;width:0;height:0;opacity:0}.jf-btn{border:0;border-radius:999px;padding:12px 18px;background:"+ACC+";color:#fff;font-size:14px;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,.2)}.jf-panel{display:none;margin-top:8px}.jf-panel.open{display:block}");
root.appendChild(style);
var box=el("div");
box.className="jf";
if(inline){
 root.appendChild(box)
}else{
 var btn=el("button");
 btn.className="jf-btn";
 text(btn,C.buttonLabel||"Contact us");
 var panel=el("div");
 panel.className="jf-panel";
 panel.appendChild(box);
 btn.addEventListener("click",function(){panel.className=panel.className.indexOf("open")>-1?"jf-panel":"jf-panel open"});
 root.appendChild(btn);
 root.appendChild(panel)}
if(C.intro){var p=el("p");text(p,C.intro);box.appendChild(p)}
var h=el("h3");
text(h,C.name);
box.appendChild(h);
var formEl=el("form");
var fieldsInfo=[];
for(var i=0;i<FIELDS.length;i++){
 var f=FIELDS[i];
 var lab=el("label");
 text(lab,f.label+(f.required?" *":""));
 formEl.appendChild(lab);
 var input;
 if(f.type==="MESSAGE"){
  input=el("textarea");
  input.rows=3
 }else if(f.type==="SELECT"){
  input=el("select");
  var opt0=el("option");
  opt0.value="";
  text(opt0,"Select…");
  input.appendChild(opt0);
  var opts=f.options||[];
  for(var j=0;j<opts.length;j++){
   var o=el("option");
   o.value=opts[j];
   text(o,opts[j]);
   input.appendChild(o)}
 }else{
  input=el("input");
  input.type=f.type==="EMAIL"?"email":f.type==="PHONE"?"tel":"text"}
 if(f.required)input.setAttribute("required","required");
 formEl.appendChild(input);
 var err=el("div");
 err.className="jf-err";
 formEl.appendChild(err);
 fieldsInfo.push({id:f.id,input:input,err:err})}
var hp=el("input");
hp.type="text";
hp.name="website_url";
hp.className="jf-hp";
hp.setAttribute("tabindex","-1");
hp.setAttribute("autocomplete","off");
hp.setAttribute("aria-hidden","true");
formEl.appendChild(hp);
var formErr=el("div");
formErr.className="jf-err";
formEl.appendChild(formErr);
var submitBtn=el("button");
submitBtn.type="submit";
text(submitBtn,C.buttonLabel||"Send");
formEl.appendChild(submitBtn);
box.appendChild(formEl);
formEl.addEventListener("submit",function(ev){
 if(ev&&ev.preventDefault)ev.preventDefault();
 for(var k=0;k<fieldsInfo.length;k++)text(fieldsInfo[k].err,"");
 text(formErr,"");
 var answers={};
 for(var i2=0;i2<fieldsInfo.length;i2++)answers[fieldsInfo[i2].id]=fieldsInfo[i2].input.value||"";
 var payload={
  formId:C.id,
  answers:answers,
  honeypot:hp.value||"",
  renderedAt:renderedAt,
  host:loc().hostname||"",
  path:loc().pathname||"/",
  visitorId:vid||null,
  touch:last,
  firstTouch:first};
 submitBtn.disabled=true;
 try{
  fetch(E,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)}).then(function(r){return r.json()}).then(function(res){
   submitBtn.disabled=false;
   if(res&&res.ok){
    while(box.firstChild)box.removeChild(box.firstChild);
    var done=el("p");
    text(done,C.confirmation);
    box.appendChild(done);
    return}
   var errs=res&&res.errors;
   if(!errs){text(formErr,"Something went wrong — please try again.");return}
   for(var k2=0;k2<fieldsInfo.length;k2++){
    var fi=fieldsInfo[k2];
    if(errs[fi.id])text(fi.err,errs[fi.id])}
   if(errs._form)text(formErr,errs._form)
  }).catch(function(){
   submitBtn.disabled=false;
   text(formErr,"Something went wrong — please try again.")})
 }catch(e){
  submitBtn.disabled=false;
  text(formErr,"Something went wrong — please try again.")}
});
}catch(e){}
}
run();
}catch(e){}
})();
`;
}
