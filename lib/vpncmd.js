const { spawn } = require('child_process');
const os = require('os');

function deferred(timeout = 10000) {
  let handlers ;
  let p = new Promise(function(resolve,reject){ handlers = {resolve,reject} }) ;
  setTimeout(() => handlers.reject(new Error("Timed out")),timeout);
  return Object.assign(p,handlers) ;
}

const prompt = /VPN Server(\/[^>]*)?>/;

module.exports = function connectVpn(config){
  let command, vpn ;
  const executable = config.vpncmd[os.platform()] || config.vpncmd.default ;

  function vpnCmd(formatter,...cmd) {
    if (!vpn) {
      let out = "" ;
      if (command)
        command.reject("Aborted") ;

      command = deferred() ;
      vpn = spawn(executable,[
        "/server",config.host,
        "/password:"+config.password,
        '/csv'
      ],{
        windowsHide: true
      });

      vpn.on('exit', code => vpn = null) ;
      vpn.stderr.on('data', data => console.warn('vpn-stderr',data))
      vpn.stdout.on('data', data => {
        out += data.toString() ;
        let found = out.match(prompt) ;
        if (found && found[0]) {
          let result = out.slice(0,found.index) ;
    	    if (command.cmd && result.startsWith(command.cmd))
    	      result = result.slice(command.cmd.length) ;
          out = out.slice(found.index+found[0].length)
          try {
            command.resolve(command.formatter && command.formatter(result)) ;
          } catch(ex) {
            command.reject(ex) ;
          }
        }
      });
    }
    // Wait for the previous command to complete
    return command.then(() => {
      command = deferred() ;
      command.cmd = cmd.join(" ")+"\n";
      command.formatter = formatter;
      vpn.stdin.write(command.cmd);
      return command ;
    }) ;
  }
  // Issue a dummy command to force a connection to the vpn
  //vpnCmd('ServerInfoGet').then(i => console.log(i),x => console.warn(x));
  return vpnCmd;
}
