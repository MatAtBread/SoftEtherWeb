import { spawn } from 'child_process';
import * as os from 'os';
import { ConnectVpnOptions, Formatter } from '../types'

function deferred<T>(timeout = 30000) {
  let handlers:{
    resolve(value: T | PromiseLike<T>): void;
    reject(reason?: any): void;
  } ;
  let p = new Promise<T>(function(resolve,reject){ handlers = {resolve,reject} }) ;
  setTimeout(() => handlers.reject(new Error("Timed out")),timeout);
  return Object.assign(p,handlers) ;
}

const prompt = /VPN Server(\/[^>]*)?>/;
const errorResponse = /^Error /;

export default function connectVpn(config: ConnectVpnOptions){
  let command: ReturnType<typeof deferred> & { cmd?: string, formatter?: Formatter };
  let vpn: ReturnType<typeof spawn> ;
  const executable = config.vpncmd[os.platform()] || config.vpncmd.default ;

  function vpnCmd(formatter: Formatter, ...cmd: string[]) {
    if (!vpn) {
      let out = "" ;
      if (command)
        command.reject("Aborted") ;

      command = deferred() ;
      /*console.log("spawn",executable,
        "/server",config.host,
        "/password:"+config.password,
        '/csv'
      );*/
      vpn = spawn(executable,[
        "/server",config.host,
        "/password:"+config.password,
        '/csv'
      ],{
        windowsHide: true
      });
      //console.log('vpncmd',vpn);

      vpn.on('exit', code => { vpn = null ; /*console.log('vpncmd exit');*/ }) ;
      vpn.stderr.on('data', data => console.warn('vpn-stderr',data))
      vpn.stdout.on('data', data => {
        //console.log("stdout",data.toString());
        out += data.toString() ;
        if (out.match(errorResponse)) {
          command.reject(new Error(out)) ;
          out = '';
          return;
        }
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
      //console.log("stdin",command.cmd)
      vpn.stdin.write(command.cmd);
      return command ;
    }) ;
  }

  vpnCmd.close = function close(){
    //console.log("stdin",'\n\nexit\n\n');
    vpn.stdin.write('\n\nexit\n\n');
  }

  return vpnCmd;
}
