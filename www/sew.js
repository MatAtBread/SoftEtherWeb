import pojs from './lib/po.js';

const {div, table, tr, td, button, on, input, img, span} = pojs.tag({},"div,table,tr,td,button,input,img,span");

async function api(...args) {
  let r = await fetch('/vpn/'+args.join('/')) ;
  if (r.status===200)
    return r.json() ;
  throw new Error(await r.text()+"\n("+r.status+': '+r.statusText+')') ;
}

async function apiPost(cmd,data) {
  let r = await fetch('/vpn/'+cmd,{
    method:'POST',
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data)
  }) ;
  if (r.status===200)
    return r.json() ;
  throw new Error(await r.text()+"\n("+r.status+': '+r.statusText+')') ;
}

const sessionFieldList = [
  "Client IP Address",
  "Client Host Name",
  "Client Port",
  "User Name",
  "Server Port",
  "Connection Started",
  "Session has been Established",
  "Number of TCP Connections",
  "Maximum Number of TCP Connections",
  "Physical Underlay Protocol",
  "Outgoing Data Size",
  "Incoming Data Size",
  "Client Product Name",
  "Client Version",
  "Client OS Name",
  "Client OS Version",
  "Client OS Product ID"
];

const Header = tr.extended({
    constructed(){
      let nodes = [...this.childNodes] ;
      this.remove(nodes);
      this.append(nodes.map(node => td(node)))
    },
    prototype:{
      style:{
        fontWeight:700
      }
    }
});

const SessionInfo = table.extended({
  async constructed(){
    const fieldList = "Client Host Name (Reported),Client IP Address (Reported)";
    let info = await api("SessionGet",this.sessionID);
    this.append(sessionFieldList.map(field => info.filter(i => i.Item.indexOf(field)>=0).map(({Item,Value}) => tr(td(Item),td(Value)))))
  }
})
const Session = tr.extended({
    constructed(x) {
      this.append(
        Object.keys(this.session).map(k => td(this.session[k])),
        td(
          button({onclick: e => {
            this.parentElement.onDisconnect(this.session)
          }},'disconnect'),
          div({id:'more'}))
      );
      this.onmouseenter = (e) => {
        let info ;
        document.body.append(
          info = SessionInfo({style:{
            fontSize:'0.8em',
            backgroundColor:'rgba(255,255,220,0.9)',
            border:'1px solid black',
            position:'absolute',
            left:8+e.pageX+"px",
            top:8+e.pageY+"px",
          },id:'more',sessionID:this.session["Session Name"]})
        )
        this.onmouseleave = () => { document.body.removeChild(info) ; this.onmouseleave = null }
      }
    }
});

const SessionList = table.extended({
  styles:`
  .SessionList {
    border-spacing: 0;
    width: 100%;
  }
  .SessionList > tr:nth-child(1n+0):hover {
    background-color: #eff;
  }
  .SessionList > tr:nth-child(even) {
    background-color: #ffe;
  }
  .SessionList > tr {
    background-color: #eee;
  }
  .SessionList > tr > td {
    padding: 3px;
    vertical-align: top;
  }
  `,
  async constructed() {
    await this.populate() ;
  },
  prototype:{
    className:'SessionList',
    async populate(){
      let sessions = await api("SessionList") ;
      this.append(Header(Object.keys(sessions[0]),''), sessions.map(session => Session({ session })))
    },
    async onDisconnect(session){
      this.remove(this.children);
      await api("SessionDisconnect",session["Session Name"]);
      await this.populate() ;
    }
  }
}) ;

const Hub = div.extended({
  styles:`
  .Hub {
    display: inline-block;
    text-align: center;
    border-style: groove;
    margin: 0.5em;
    border-radius: 1em;
    background: #ddd;
    color: blue;
    font-size: 0.9em;
  }
  .Hub > * {
    display: block;
  }
  `,
  constructed(){
    this.insertAt(this.firstChild, img({src:'softether.png', style:{ width:'80px' }}))
  },
  prototype:{
    className:'Hub',
    select(state){
      if (typeof state==='boolean')
        this.style.borderStyle = !state ? '':'ridge'
    else
        this.style.borderStyle = this.style.borderStyle ? '':'ridge'
    }
  }
});

const SEW = div.extended({
  styles:`
  .Menu {
    top:0;
    width:100%;
    height:2em;
    line-height:2em;
    background:#333;
    color:white;
  }
  .Menu > * {
    margin-left: 0.5em;
  }
  #hubs {
    background-color: #999;
  }
  `,
  async constructed() {
    this.append(
      div({ className: 'Menu'},
        span({style:{fontWeight:700}},"SoftEther VPN Status"),
        input({id:'host',placeholder:'VPN Server:5555',value: localStorage.lastVpnHost||''}),
        input({id:'password',placeholder:'password', type:'password'}),
        button({
          onclick:async e => {
            try {
              e.target.disabled = true ;
              this.ids.host.disabled = true ;
              this.ids.password.disabled = true ;
              let hubs = await apiPost('connect',{
                "host":this.ids.host.value,
                "password":this.ids.password.value
              });
              localStorage.lastVpnHost = this.ids.host.value ;
              this.ids.hubs.replace(div({id:'hubs'}, hubs.map(h => Hub({
                onclick:async e => {
                  e.currentTarget.select(true);
                  this.ids.sessions.replace(div({id:'sessions'}))
                  await api("Hub",h["Virtual Hub Name"]);
                  this.ids.sessions.replace(SessionList({id:'sessions'}))
                }
              },h["Virtual Hub Name"]))))
            } catch (ex) {
              e.target.disabled = false ;
              this.ids.host.disabled = false ;
              this.ids.password.disabled = false ;
              this.ids.hubs.replace(div({id:'hubs'}))
              alert(ex.message) ;
            }
            this.ids.password.value = '';
          }
        },"connect"),
        button({ onclick() { window.location.reload() }},'disconnect')
      ),
      div({id:'hubs'}),
      div({id:'sessions'})
    )
  }
})

window.onload = function() { document.body.appendChild(SEW()) }
