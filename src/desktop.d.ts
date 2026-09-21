export {}
declare global {
  interface Window {
    facetDesktop?: {
      chooseFolder():Promise<any>;listFolder(relative?:string):Promise<any>;openWorkspaceFile(relative:string):Promise<any>;
      readClipboard():Promise<any>;forgetDocument(index:number):Promise<any>;revealDocument(index:number):Promise<any>;
      open(index?:number):Promise<any>;save(value:any):Promise<any>;recent():Promise<any[]>;
      recovery(value:any):Promise<any>;recoveries():Promise<any[]>;recover(id:string):Promise<any>;
      exportPDF(value:any):Promise<any>;exportArchive(value:any):Promise<any>;
      openExternal(url:string):Promise<void>;openOutput(token:string):Promise<any>;revealOutput(token:string):Promise<any>;
      onClose(callback:()=>void):()=>void;closeReady():void;cancelClose():void;onOpen(callback:(data:any)=>void):()=>void;
    };
    __facet?: any
  }
}
