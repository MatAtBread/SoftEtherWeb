const { spawn } = require('child_process');
const csv = require('csv-parse/lib/sync');
const config = require('../config.json');

let vpn;
const prompt = "VPN Server/"+config.adminhub+">";

const os = require('os');
const executable = config.vpncmd[os.platform()] ;

console.log("executable",executable) ;

function deferred(timeout = 10000) {
  let handlers ;
  let p = new Promise(function(resolve,reject){ handlers = {resolve,reject} }) ;
  setTimeout(handlers.reject,timeout);
  return Object.assign(p,handlers) ;
}

let command ;

function vpnCmd(...cmd) {
  if (!vpn) {
    let out = "" ;
    if (command) command.reject("Aborted") ;
    command = deferred() ;
    vpn = spawn(executable,["/server",config.host,
      "/adminhub:"+config.adminhub,
      "/password:"+config.password,
      '/csv'],{ windowsHide: true});

    vpn.on('exit', code => vpn = null) ;
    vpn.stderr.on('data', data => console.warn('vpn-stderr',data))
    vpn.stdout.on('data', data => {
      out += data.toString() ;
      let idx = out.indexOf(prompt) ;
      if (idx >= 0) {
        let result = out.slice(0,idx) ;
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
    vpn.stdin.write(cmd.join(" ")+"\n");
    return command ;
  }) ;
}

module.exports = vpnCmd;
