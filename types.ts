export interface ConnectVpnOptions {
    host: string;
    password: string;
    vpncmd: {
      default: string;
    } & {
      [platform in NodeJS.Platform]: string;
    }
  }
  
export  type Formatter = (x:string) => string | unknown;

export interface ServerOptions {
    SSLcerts: string;
    port: number;
}

export type ConfigOptions = ServerOptions & ConnectVpnOptions 