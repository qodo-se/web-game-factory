// One expanding pane shares the sidebar with the other fixed-height headings.
const sidebar = {
    sections: [],
    init() {
        this.sections=[...document.querySelectorAll('[data-sidebar-section]')];
        const buttons=this.sections.map(section=>section.querySelector('.sidebar-toggle'));
        for(const [index,button] of buttons.entries()) {
            button.addEventListener('click',()=>this.open(button.getAttribute('aria-expanded')==='true'?null:this.sections[index].dataset.sidebarSection));
            button.addEventListener('keydown',event=>{
                let target;
                if(event.key==='ArrowDown')target=(index+1)%buttons.length;
                else if(event.key==='ArrowUp')target=(index-1+buttons.length)%buttons.length;
                else if(event.key==='Home')target=0;
                else if(event.key==='End')target=buttons.length-1;
                else return;
                event.preventDefault();buttons[target].focus();
            });
        }
        let active='orders';
        try {
            const previous=sessionStorage.getItem('imperium-sidebar-section');
            const saved=previous==='recap'?'battles':previous==='region'?'orders':previous;
            if(saved!==null && (saved===''||this.sections.some(s=>s.dataset.sidebarSection===saved)))active=saved;
        } catch { /* Layout still works when storage is unavailable. */ }
        this.open(active||null);
    },
    showTurnReport() {
        this.open('battles');
        document.getElementById('sidebar-battles-body').scrollTop=0;
    },
    open(key) {
        if(key && !this.sections.some(section=>section.dataset.sidebarSection===key))return;
        for(const section of this.sections) {
            const expanded=section.dataset.sidebarSection===key;
            section.classList.toggle('is-expanded',expanded);
            section.querySelector('.sidebar-toggle').setAttribute('aria-expanded',String(expanded));
            section.querySelector('.sidebar-body').hidden=!expanded;
        }
        try { sessionStorage.setItem('imperium-sidebar-section',key||''); } catch {}
    }
};
