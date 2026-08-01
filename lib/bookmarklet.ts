/**
 * Source for the "Save to Layrrrd" bookmarklet. It runs in the context of
 * whatever page the user is currently viewing - so it sees the page after
 * any login, paywall, or bot check that page required, the same way the
 * Chrome extension's capture does. It opens /capture on our own origin and
 * hands it the captured fields over postMessage, resending for a few
 * seconds so a slow-loading receiver still gets the payload.
 */
function bookmarkletSource(origin: string): string {
  return `(function(){
  var origin=${JSON.stringify(origin)};
  var w=window.open(origin+"/capture","layrrrd_capture","width=420,height=640");
  if(!w){alert("Please allow pop-ups for this site to use the Layrrrd bookmarklet.");return;}
  var meta=function(sel){var el=document.querySelector(sel);var v=el&&el.getAttribute("content");return v?v.trim():"";};
  var root=document.querySelector("article")||document.querySelector("main")||document.body;
  var text=((root&&root.innerText)||"").replace(/\\s+/g," ").trim().slice(0,20000);
  var payload={url:location.href,title:meta('meta[property="og:title"]')||document.title||"",description:meta('meta[property="og:description"]')||meta('meta[name="description"]')||"",image:meta('meta[property="og:image"]')||"",text:text};
  var tries=0;
  var iv=setInterval(function(){
    tries++;
    try{w.postMessage({type:"layrrrd:capture",payload:payload},origin);}catch(e){}
    if(tries>40||w.closed)clearInterval(iv);
  },250);
})();`;
}

/** A `javascript:` URI a user drags to their bookmarks bar. */
export function bookmarkletHref(origin: string): string {
  return `javascript:${encodeURIComponent(bookmarkletSource(origin))}`;
}
