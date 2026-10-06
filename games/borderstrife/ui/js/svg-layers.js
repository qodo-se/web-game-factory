// Reconcile presentation-only SVG layers. Interactive arrows keep their own
// creation path because their event handlers close over the current orders.
const svgLayers = {
    key(node, index) { return node.getAttribute?.('data-key') ?? node.getAttribute?.('data-id') ?? `${node.nodeName}:${index}`; },
    attributes(node, attrs) {
        for (const attribute of [...node.attributes]) if (!(attribute.name in attrs)) node.removeAttribute(attribute.name);
        for (const [name,value] of Object.entries(attrs)) if (node.getAttribute(name)!==String(value)) node.setAttribute(name,value);
    },
    patch(node, fresh) {
        if(node.nodeType!==fresh.nodeType || node.nodeName!==fresh.nodeName) {node.replaceWith(fresh);return fresh;}
        if(node.nodeType===Node.TEXT_NODE) {if(node.nodeValue!==fresh.nodeValue)node.nodeValue=fresh.nodeValue;return node;}
        this.attributes(node,Object.fromEntries([...fresh.attributes].map(a=>[a.name,a.value])));
        this.sync(node,[...fresh.childNodes]);return node;
    },
    sync(parent, children) {
        const existing=new Map([...parent.childNodes].map((n,i)=>[this.key(n,i),n]));
        let cursor=parent.firstChild;
        for(const [index,fresh] of children.entries()) {
            const key=this.key(fresh,index),old=existing.get(key);
            const node=old?this.patch(old,fresh):fresh;
            existing.delete(key);
            if(node!==cursor)parent.insertBefore(node,cursor?.parentNode===parent?cursor:null);
            cursor=node.nextSibling;
        }
        for(const node of existing.values())node.remove();
    },
    // Terrain paths are large: update them directly, without temporary path nodes.
    paths(parent, entries) {
        const existing=new Map([...parent.children].map(n=>[n.dataset.key,n]));
        let cursor=parent.firstChild;
        for(const {key,attrs} of entries) {
            const node=existing.get(String(key))||document.createElementNS('http://www.w3.org/2000/svg','path');
            existing.delete(String(key));this.attributes(node,{'data-key':key,...attrs});
            if(node!==cursor)parent.insertBefore(node,cursor);
            cursor=node.nextSibling;
        }
        for(const node of existing.values())node.remove();
    },
};
