import pojs from './lib/po.js';

const {div, h2, table, tr, td, button, on} = pojs.tag({},"div,h2,table,tr,td,button");

let api = (...args) => fetch('/vpn/'+args.join('/')).then(r => r.status===200 ? r.json() : r.text().then(info => Promise.reject(r.statusText + "\n" + info)))

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
        td(button({onclick:e => {
          this.ids.more.replace(SessionInfo({id:'more',style:{fontSize:'0.8em'},sessionID:this.session["Session Name"]}))
        }},"more..."),
        button({onclick:async e => {
          await api("SessionDisconnect",this.session["Session Name"]);
          document.body.dispatchEvent(new Event('change'));
        }},'disconnect'),
        div({id:'more'})),
        Object.keys(this.session).map(k => td(this.session[k]))
      )
    }
});

const SessionList = table.extended({
  styles:`
  .SessionList {
    border-spacing: 0;
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
    let sessions = await api("SessionList") ;
    this.append(Header('',Object.keys(sessions[0])), sessions.map(session => Session({session})))
  },
  prototype:{
    className:'SessionList'
  }
}) ;

const SEW = div.extended({
  constructed() {
    this.append(
      h2("SoftEther VPN Status"),
      () => on (document.body) (
        SessionList({
          style: { fontSize:'0.9em' }
        })
      )
    )
  }
})

window.onload = function() { document.body.appendChild(SEW()) }
