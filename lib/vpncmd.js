const { spawn } = require('child_process');
const os = require('os');
const csv = require('csv-parse/lib/sync');

let trace = process.env.DEBUG||1 ? function(...args){ console.log(...args) } : ()=>0;

function deferred(timeout = 10000) {
  let handlers ;
  let p = new Promise(function(resolve,reject){ handlers = {resolve,reject} }) ;
  setTimeout(() => handlers.reject(new Error("Timed out")),timeout);
  return Object.assign(p,handlers) ;
}

module.exports = function connectVpn(config){
  let command, vpn ;
  const prompt = "VPN Server/"+config.adminhub+">";
  const executable = config.vpncmd[os.platform()] ;

  function vpnCmd(...cmd) {
    if (!vpn) {
      let out = "" ;
      if (command) command.reject("Aborted") ;
      command = deferred() ;

      vpn = spawn(executable,["/server",config.host,
        "/adminhub:"+config.adminhub,
        "/password:"+config.password,
        '/csv'],{
          windowsHide: true
        });

      vpn.on('exit', code => vpn = null) ;
      vpn.stderr.on('data', data => console.warn('vpn-stderr',data))
      vpn.stdout.on('data', data => {
        out += data.toString() ;
        let idx = out.indexOf(prompt) ;
        trace("<<",idx,data.toString());
        if (idx >= 0) {
          let result = out.slice(0,idx) ;
    	    if (command.cmd && result.startsWith(command.cmd))
    	      result = result.slice(command.cmd.length) ;
          out = out.slice(idx+prompt.length)
          command.resolve(result ? csv(result,{
            columns: true,
            skip_empty_lines: true
          }) : {ok:1}) ;
        }
      });
    }
    // Wait for the previous command to complete
    return command.then(() => {
      command = deferred() ;
      command.cmd = cmd.join(" ")+"\n";
      trace(">>",command.cmd);
      vpn.stdin.write(command.cmd);
      return command ;
    }) ;
  }
  // Issue a dummy command to force a connection to the vpn
  vpnCmd('ServerInfoGet').then(i => console.log(i),x => console.warn(x));
  return vpnCmd;
}
