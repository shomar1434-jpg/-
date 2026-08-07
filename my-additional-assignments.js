/* Compatibility shim: the unified component is the only renderer. */
(function(){
 if(window.UnifiedAssignmentUI){window.MyAdditionalAssignments=window.UnifiedAssignmentUI;return;}
 const s=document.createElement('script');s.src='unified-assignment-ui.js';s.onload=()=>{window.MyAdditionalAssignments=window.UnifiedAssignmentUI};document.head.appendChild(s);
})();
