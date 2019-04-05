const { spawn } = require('child_process');
const csv = require('csv-parse/lib/sync');
const config = require('../config.json');

let vpn;
const prompt = "VPN Server/"+config.adminhub+">";
let initialPrompt ;

function vpnCmd(...cmd) {
  if (!vpn) {
    initialPrompt = true ;

    vpn = spawn(config.vpncmd,["/server",config.host,
      "/adminhub:"+config.adminhub,
      "/password:"+config.password,
      '/csv'],{ windowsHide: true});

    vpn.stderr.on('data', data => console.warn('vpn-stderr',data))
    vpn.on('exit', code => vpn = null) ;
  }

  return new Promise((resolve, reject) => {
      // vpncmd process is running, send the command
      let params = cmd.join(" ");
      let out = "" ;
      function handleOut(data) {
        out += data.toString() ;
        if (out.endsWith(prompt)) {
          out = out.slice(0,-prompt.length) ;
          if (!out && initialPrompt) {
            initialPrompt = false ;
          } else {
            vpn.stdout.off('data', handleOut);
            resolve(out ? csv(out,{
              columns: true,
              skip_empty_lines: true
            }) : {ok:1}) ;
          }
        }
      }
      vpn.stdout.on('data', handleOut);
      vpn.stdin.write(params+"\n");
    });
  }

  module.exports = vpnCmd;
