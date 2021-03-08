import pojs from './lib/po.js';

const {div, table, tr, td, button, on, input, img, span} = pojs.tag({},"div,table,tr,td,button,input,img,span");

const serverAdmin = {};
const connection = {};

const api = new Proxy({}, {
  get(target, cmd, receiver) {
    return async (params = {}) => {
      const r = await fetch(connection.host, {
        method: 'POST',
        headers: {
          //'X-VPNADMIN-HUBNAME',
          'X-VPNADMIN-PASSWORD': connection.password
        },
        body: JSON.stringify({
          "jsonrpc": "2.0",
          "id": "rpc_call_id",
          "method": cmd,
          "params": params
        })
      });
      if (r.status === 200)
        return r.json().then(r => r.result);
      throw new Error(await r.text() + "\n(" + r.status + ': ' + r.statusText + ')');
    }
  }
});
window.api = api ;

function value(v) {
  return typeof v==='boolean' ? (v ? '\u2714' : '\u2716') : v
}

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
    const info = this.info;
    this.append(Object.entries(this.info).filter(([k,v]) => k.indexOf(':')<0).map(([k,v]) => tr(td(k.split('_')[0]),td(value(v))))) ;
  }
})

const Session = tr.extended({
    constructed(x) {
      this.append(
        Object.keys(this.session).map(k => td(value(this.session[k]))),
        td(
          button({onclick: (e)=> {
            if (this.onmouseleave)
              this.onmouseleave();
            this.parentElement.onDisconnect(this.session)
          }},'disconnect'),
          div({id:'more'}))
      );
      this.onmouseenter = async (e)=> {
        let info ;
        document.body.append(
          info = SessionInfo({style:{
            fontSize:'0.8em',
            backgroundColor:'rgba(255,255,220,0.9)',
            border:'1px solid black',
            position:'absolute',
            left:8+e.pageX+"px",
            top:8+e.pageY+"px",
          },
          id:'more',
          info: await api.GetSessionStatus({
            HubName_str: this.hub,
            Name_str: this.session.Name_str
          }) 
        }));
        this.onmouseleave = ()=> { document.body.removeChild(info) ; this.onmouseleave = null }
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
      const { SessionList } = await api.EnumSession({ HubName_str: this.hub}) ;
      this.append(Header(Object.keys(SessionList[0]).map(k => k.split('_')[0]),''), SessionList.map(session => Session({ session, hub: this.hub })))
    },
    async onDisconnect(session){
      this.remove(this.children);
      await api.DeleteSession({
        HubName_str: this.hub,
        Name_str: session.Name_str
      }) ; 
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
    this.insertAt(this.firstChild, img({src:'softether.png', style:{ width:'5em' }}))
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

const HubList = div.extended({
  constructed(){
    let list = this;
    this.append(Hub({
        style:{ backgroundColor:'black', color:'yellow'},
        onclick(){
          list.childNodes.forEach(hub => hub.select(false))
          this.select(true);
          list.selected = serverAdmin ;
          list.dispatchEvent(new Event('change')) ;
        }
      },span({style:{fontWeight:700}},"Server")),
      this.hubs.map(hub => Hub({
      async onclick() {
        list.childNodes.forEach(hub => hub.select(false))
        this.select(true);
        list.selected = hub ;
        list.dispatchEvent(new Event('change')) ;
      }
    },hub.HubName_str)))
  }
})

const ServerAdmin = table.extended({
  styles:`
  .ServerAdmin {
    width: 100%;
    border-spacing:0;
  }
  .ServerAdmin > tr {
    vertical-align: top;
    color: white;
    padding-bottom: 0.5em;
    border-bottom: 1px solid black;
    background-color: #333;
  }
  `,
  constructed(){
    const inputAttrs = { type: 'password', style: {display:'block'}} ;
    let pw1, pw2;
    this.append(
      tr(td("New Admin Password"),td(pw1 = input(inputAttrs)),td(button({
        style:{width:'100%'},
        async onclick(){
          if (pw1.value !== pw2.value || !pw1.value)
            alert("Passwords do not match or are blank");
          else {
            await api.SetServerPassword({ PlainTextPassword_str: pw1.value }) ;
            window.location.reload();
          }
        }
      },"set"))),
      tr(td("Confirm password"),td(pw2 = input(inputAttrs)),td())
    )
  },
  prototype:{
    className: 'ServerAdmin'
  }
});

const SEW = div.extended({
  styles:`
  .Menu {
    top:0;
    width:100%;
    min-height:2em;
    line-height:2em;
    padding: 0.5em;
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
        span({style:{fontWeight:700}},"SoftEther VPN Status "),
        input({id:'host',placeholder:'VPN Server:5555',value: localStorage.lastVpnHost||''}),
        input({id:'password',placeholder:'password', type:'password', value: localStorage.lastGoodPassword||''}),
        button({id:'vpnConnected',
          onclick:async (e)=> {
            try {
              this.ids.vpnConnected.disabled = true ;
              this.ids.host.disabled = true ;
              this.ids.password.disabled = true ;

              // Connect and return a list of hubs on the server
              connection.host = "https://"+this.ids.host.value+"/api/";
              connection.password = this.ids.password.value;

              let hubs = await api.EnumHub();
              localStorage.lastVpnHost = this.ids.host.value ;
              this.ids.vpnConnected.dispatchEvent(Object.assign(new Event('change'),{hubs: hubs.HubList}));
              if (confirm("Save the password as a local default [unencrypted browser storage]?")) {
                localStorage.lastGoodPassword = this.ids.password.value;
              } else {
                delete this.ids.password.value;
              }
              this.ids.disconnect.disabled = false ;
            } catch (ex) {
              this.ids.vpnConnected.disabled = false ;
              this.ids.host.disabled = false ;
              this.ids.password.disabled = false ;
              alert(ex.message) ;
            }
            this.ids.password.value = '';
          }
        },"connect"),
        button({ id: 'disconnect', disabled: true, async onclick() { delete localStorage.lastGoodPassword; window.location.reload() }},'log out')
      ),
      (e)=> on (this.ids.vpnConnected) (
        e
        ? [
            HubList({hubs: e.hubs, id:'hubs'}),
            (e)=> on (this.ids.hubs) (this.ids.hubs.selected ? (this.ids.hubs.selected===serverAdmin ? ServerAdmin() : SessionList({ hub: this.ids.hubs.selected.HubName_str })) : div())
        ]
        : div()
      )
    )

    /*if ((await apiPost('isConnected')).connected) {
      try {
        this.ids.vpnConnected.disabled = true ;
        this.ids.host.disabled = true ;
        this.ids.password.disabled = true ;
        let hubs = await apiPost("HubList") ;
        this.ids.vpnConnected.dispatchEvent(Object.assign(new Event('change'),{hubs}));
      } catch (ex) {
        this.ids.vpnConnected.disabled = false ;
        this.ids.host.disabled = false ;
        this.ids.password.disabled = false ;
        alert(ex.message) ;
      }
      this.ids.password.value = '';
    }*/
  }
})

window.onload = function() { document.body.appendChild(SEW()) }
